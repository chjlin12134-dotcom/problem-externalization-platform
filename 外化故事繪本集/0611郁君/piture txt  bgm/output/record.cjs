// Record HTML animation to silent webm
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const TOTAL_DUR_MS = 245000; // 245s with buffer

(async () => {
  const rendersDir = path.join(__dirname, 'renders');
  if (!fs.existsSync(rendersDir)) fs.mkdirSync(rendersDir, { recursive: true });

  const browser = await chromium.launch({
    args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'],
  });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    recordVideo: { dir: rendersDir, size: { width: 1920, height: 1080 } },
  });
  const page = await context.newPage();
  const fileUrl = 'file:///' + path.join(__dirname, 'index.html').replace(/\\/g, '/');
  console.log('Loading:', fileUrl);
  await page.goto(fileUrl);
  await page.waitForTimeout(1000);
  // Click play overlay
  await page.click('#playOverlay');
  console.log(`Recording ${TOTAL_DUR_MS/1000}s...`);
  await page.waitForTimeout(TOTAL_DUR_MS);
  await context.close();
  await browser.close();
  console.log('Recording done.');
})();
