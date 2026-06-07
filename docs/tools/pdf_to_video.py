import argparse
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
PYDEPS = ROOT / ".pydeps"
if PYDEPS.exists():
    sys.path.insert(0, str(PYDEPS))

import pypdfium2 as pdfium  # noqa: E402


def render_frames(pdf_path, frame_dir, seconds_per_page, width, height, scale):
    frame_dir.mkdir(parents=True, exist_ok=True)
    for old in frame_dir.glob("frame_*.jpg"):
        old.unlink()

    doc = pdfium.PdfDocument(str(pdf_path))
    canvas_size = (width, height)
    frame_paths = []

    for index, page in enumerate(doc, 1):
        page_image = page.render(scale=scale).to_pil().convert("RGB")
        background = make_background(page_image, canvas_size)

        foreground = page_image.copy()
        foreground.thumbnail((width - 120, height - 70), Image.Resampling.LANCZOS)
        x = (width - foreground.width) // 2
        y = (height - foreground.height) // 2
        background.paste(foreground, (x, y))

        frame_path = frame_dir / f"frame_{index:03d}.jpg"
        background.save(frame_path, quality=92)
        frame_paths.append(frame_path)

    doc.close()

    concat_path = frame_dir / "concat.txt"
    lines = []
    for frame_path in frame_paths:
        lines.append(f"file '{frame_path.resolve().as_posix()}'")
        lines.append(f"duration {seconds_per_page}")
    lines.append(f"file '{frame_paths[-1].resolve().as_posix()}'")
    concat_path.write_text("\n".join(lines), encoding="utf-8")
    return concat_path, len(frame_paths)


def make_background(image, canvas_size):
    width, height = canvas_size
    base = Image.new("RGB", canvas_size, (250, 247, 238))
    blur = image.copy()
    ratio = max(width / blur.width, height / blur.height)
    blur = blur.resize((int(blur.width * ratio), int(blur.height * ratio)), Image.Resampling.LANCZOS)
    left = (blur.width - width) // 2
    top = (blur.height - height) // 2
    blur = blur.crop((left, top, left + width, top + height)).filter(ImageFilter.GaussianBlur(18))
    return Image.blend(blur, base, 0.38)


def build_ffmpeg_command(concat_path, output_path, audio_path=None, bgm_path=None, bgm_volume=0.18):
    command = [
        "ffmpeg",
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        str(concat_path),
    ]

    if audio_path:
        command.extend(["-i", str(audio_path)])
    if bgm_path:
        command.extend(["-stream_loop", "-1", "-i", str(bgm_path)])

    command.extend(["-vf", "fps=30,format=yuv420p", "-c:v", "libx264", "-preset", "medium", "-crf", "20"])

    if audio_path and bgm_path:
        command.extend(
            [
                "-filter_complex",
                f"[2:a]volume={bgm_volume}[bgm];[1:a][bgm]amix=inputs=2:duration=first:dropout_transition=2[a]",
                "-map",
                "0:v",
                "-map",
                "[a]",
                "-c:a",
                "aac",
                "-shortest",
            ]
        )
    elif audio_path:
        command.extend(["-map", "0:v", "-map", "1:a", "-c:a", "aac", "-shortest"])
    elif bgm_path:
        command.extend(
            [
                "-filter_complex",
                f"[1:a]volume={bgm_volume}[bgm]",
                "-map",
                "0:v",
                "-map",
                "[bgm]",
                "-c:a",
                "aac",
                "-shortest",
            ]
        )

    command.extend(["-movflags", "+faststart", str(output_path)])
    return command


def main():
    parser = argparse.ArgumentParser(description="Convert a picture-book PDF to an MP4 slideshow.")
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--seconds-per-page", type=float, default=4)
    parser.add_argument("--width", type=int, default=1920)
    parser.add_argument("--height", type=int, default=1080)
    parser.add_argument("--scale", type=float, default=2.4)
    parser.add_argument("--audio", type=Path)
    parser.add_argument("--bgm", type=Path)
    parser.add_argument("--bgm-volume", type=float, default=0.18)
    args = parser.parse_args()

    frame_dir = args.out.with_suffix("")
    frame_dir = frame_dir.parent / f"{frame_dir.name}_frames"
    concat_path, page_count = render_frames(
        args.pdf,
        frame_dir,
        args.seconds_per_page,
        args.width,
        args.height,
        args.scale,
    )
    args.out.parent.mkdir(parents=True, exist_ok=True)
    command = build_ffmpeg_command(concat_path, args.out, args.audio, args.bgm, args.bgm_volume)
    subprocess.run(command, check=True)
    print(f"created={args.out.resolve()}")
    print(f"pages={page_count}")


if __name__ == "__main__":
    main()
