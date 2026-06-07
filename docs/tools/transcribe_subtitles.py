import sys, os, json
from faster_whisper import WhisperModel

def format_timestamp(seconds, sep=","):
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds - int(seconds)) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d}{sep}{ms:03d}"

def segments_to_srt(segments, output_path):
    with open(output_path, "w", encoding="utf-8") as f:
        for i, seg in enumerate(segments, 1):
            f.write(f"{i}\n")
            f.write(f"{format_timestamp(seg.start)} --> {format_timestamp(seg.end)}\n")
            f.write(f"{seg.text.strip()}\n\n")

def segments_to_vtt(segments, output_path):
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("WEBVTT\n\n")
        for seg in segments:
            f.write(f"{format_timestamp(seg.start, '.')} --> {format_timestamp(seg.end, '.')}\n")
            f.write(f"{seg.text.strip()}\n\n")

def segments_to_text(segments, output_path):
    with open(output_path, "w", encoding="utf-8") as f:
        for seg in segments:
            f.write(f"[{format_timestamp(seg.start)} --> {format_timestamp(seg.end)}] {seg.text.strip()}\n")

def main():
    audio_path = sys.argv[1]
    output_dir = sys.argv[2] if len(sys.argv) > 2 else os.path.dirname(audio_path)
    base = os.path.splitext(os.path.basename(audio_path))[0].replace("_audio", "")

    print(f"音檔: {audio_path}")
    print("載入 faster-whisper medium 模型（第一次會下載）...")
    model = WhisperModel("medium", device="cpu", compute_type="int8")

    print("開始語音辨識...")
    segments, info = model.transcribe(audio_path, language="zh", beam_size=5, vad_filter=True)

    seg_list = list(segments)
    print(f"辨識完成，共 {len(seg_list)} 個段落")

    srt_path = os.path.join(output_dir, f"{base}.srt")
    vtt_path = os.path.join(output_dir, f"{base}.vtt")
    txt_path = os.path.join(output_dir, f"{base}_逐字稿.txt")

    segments_to_srt(seg_list, srt_path)
    segments_to_vtt(seg_list, vtt_path)
    segments_to_text(seg_list, txt_path)

    print(f"SRT: {srt_path}")
    print(f"VTT: {vtt_path}")
    print(f"逐字稿: {txt_path}")

if __name__ == "__main__":
    main()
