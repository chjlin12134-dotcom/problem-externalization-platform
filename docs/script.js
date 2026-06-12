const GOOGLE_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRg6ipvyGpLk798f_lhPiPJeLFYZePDEn9P9goeKsF2foaBK8t02PvmDFsNaA8d-eOHoNpYNy1c9nE_/pub?output=csv";

let stories = [];

const storyGrid = document.querySelector("#storyGrid");
const searchInput = document.querySelector("#searchInput");
const typeFilter = document.querySelector("#typeFilter");
const audioFilter = document.querySelector("#audioFilter");
const viewerDialog = document.querySelector("#viewerDialog");
const viewerTitle = document.querySelector("#viewerTitle");
const viewerMeta = document.querySelector("#viewerMeta");
const viewerFrame = document.querySelector("#viewerFrame");
const openExternal = document.querySelector("#openExternal");
const gallerySummary = document.querySelector("#gallerySummary");

const cardAccents = ["teal", "coral", "gold", "leaf", "sky", "plum", "clay", "moss", "rose"];

function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function csvToStories(csvText) {
  const clean = csvText.replace(/^\uFEFF/, "");
  const lines = clean.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  return lines.slice(1)
    .map(function (line) {
      var c = parseCSVLine(line);
      return {
        className: c[0] || "",
        author: c[1] || "",
        title: c[2] || "",
        type: c[3] || "storybook",
        url: c[4] || "",
        thumbnail: c[5] || "",
        status: c[6] || "",
        theme: "",
        permission: true,
        narration: false,
        subtitles: false,
        bgm: false,
      };
    })
    .filter(function (s) { return s.title; });
}

async function loadFromGoogleSheet() {
  try {
    var res = await fetch(GOOGLE_CSV_URL);
    if (!res.ok) throw new Error("HTTP " + res.status);
    var data = csvToStories(await res.text());
    if (data.length) return data;
  } catch (e) {
    console.warn("Google Sheet 載入失敗，使用備份資料:", e);
  }
  return [...(window.STORY_WORKS || [])];
}

async function init() {
  var sheetData = await loadFromGoogleSheet();
  var localData = JSON.parse(localStorage.getItem("externalizedProblemStories") || "[]");
  var staticData = [...(window.STORY_WORKS || [])];
  
  // 合并所有数据，静态数据优先（如果标题和作者相同，则使用静态数据）
  var allData = localData.concat(sheetData);
  staticData.forEach(function(staticItem) {
    var exists = allData.some(function(item) {
      return item.title === staticItem.title && item.author === staticItem.author;
    });
    if (!exists) {
      allData.push(staticItem);
    }
  });
  
  stories = allData;
  renderStories();
}

function renderStories() {
  const keyword = searchInput ? searchInput.value.trim().toLowerCase() : "";
  const type = typeFilter ? typeFilter.value : "all";
  const audio = audioFilter ? audioFilter.value : "all";

  const filtered = stories.filter((story) => {
    const searchable = `${story.title} ${story.author} ${story.theme} ${story.className || ""} ${story.status || ""}`.toLowerCase();
    const matchesKeyword = !keyword || searchable.includes(keyword);
    const matchesType = type === "all" || story.type === type;
    const matchesAudio = audio === "all" || story[audio];
    return matchesKeyword && matchesType && matchesAudio;
  });

  storyGrid.innerHTML = filtered.length
    ? filtered.map((story) => createStoryCard(story, stories.indexOf(story))).join("")
    : `<p class="empty">目前沒有符合條件的作品。</p>`;

  if (gallerySummary) {
    gallerySummary.textContent = "";
  }
}

function createStoryCard(story, index) {
  const accent = story.accent || cardAccents[index % cardAccents.length];
  const thumbnail = story.thumbnail
    ? `<span class="menu-thumb image-thumb" style="background-image: url('${escapeHtml(story.thumbnail)}')"></span>`
    : `<span class="menu-thumb no-image">${getInitials(story.title)}</span>`;

  return `
    <article class="story-card menu-item ${story.type} accent-${accent}" data-index="${index}" tabindex="0" aria-label="檢視 ${escapeHtml(story.title)}">
      <div class="story-art">
        ${thumbnail}
      </div>
      <div class="menu-copy">
        <strong>${escapeHtml(story.title)}</strong>
        <small>${escapeHtml(story.author || "作者待補")}</small>
      </div>
    </article>
  `;
}

function openViewer(index) {
  const story = stories[index];
  viewerTitle.textContent = story.title;
  viewerMeta.textContent = `${story.author || "作者待補"} · ${story.type === "video" ? "動態繪本" : "Gemini Storybook"}`;
  openExternal.href = story.url;

  if (story.type === "video") {
    viewerFrame.innerHTML = story.url.includes("youtube.com/embed")
      ? `<iframe src="${story.url}" title="${escapeHtml(story.title)}" allowfullscreen></iframe>`
      : `<video src="${story.url}" controls></video>`;
  } else {
    viewerFrame.innerHTML = `<iframe src="${story.url}" title="${escapeHtml(story.title)}"></iframe>`;
  }

  viewerDialog.showModal();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return map[char];
  });
}

function getInitials(title) {
  return String(title)
    .replace(/[「」《》:：\s]/g, "")
    .slice(0, 2);
}

storyGrid.addEventListener("click", (event) => {
  if (event.target.closest("a")) return;
  const card = event.target.closest(".story-card[data-index]");
  if (card) openViewer(Number(card.dataset.index));
});

storyGrid.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const card = event.target.closest(".story-card[data-index]");
  if (!card) return;
  event.preventDefault();
  openViewer(Number(card.dataset.index));
});

document.querySelector("#closeViewer").addEventListener("click", () => {
  viewerFrame.innerHTML = "";
  viewerDialog.close();
});

[searchInput, typeFilter, audioFilter].filter(Boolean).forEach(function (control) {
  control.addEventListener("input", renderStories);
});

init();
