import subprocess
import re
import shutil
from pathlib import Path
import imageio_ffmpeg

ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
BASE = Path("video_photos")
TEMP = BASE / "_tmp"
OUTPUT = BASE / "final_video.mp4"

MAX_DURATION = 240   # 4 minutes
IMAGE_DURATION = 3   # seconds per image
RES = "1920:1080"
FPS = "30"
AUDIO_RATE = "48000"

SEQUENCE = [
    "1.png",
    "2.png",
    "4.png",
    "4.4.png",
    "4.5.mp4",
    "5.png",
    "20260418_005404_part2a.mp4",
    "6.png",
    "20260418_005404_part2b.mp4",
    "7.png",
]


def get_duration(path):
    r = subprocess.run([ffmpeg, "-i", str(path)], capture_output=True, text=True)
    m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", r.stderr)
    if m:
        return int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))
    return 0


def run(cmd, label=""):
    print(f"  {label or cmd[0]}")
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


# -- Calculate speedup --
images = [f for f in SEQUENCE if f.endswith(".png")]
videos = [f for f in SEQUENCE if f.endswith(".mp4")]
total_video_secs = sum(get_duration(BASE / v) for v in videos)
video_budget = MAX_DURATION - len(images) * IMAGE_DURATION
speedup = round(total_video_secs / video_budget, 4)
print(f"Images: {len(images)} x {IMAGE_DURATION}s = {len(images)*IMAGE_DURATION}s")
print(f"Videos: {total_video_secs:.1f}s  |  Budget: {video_budget}s  |  Speedup: {speedup:.2f}x\n")

# -- Prepare temp dir --
if TEMP.exists():
    shutil.rmtree(TEMP)
TEMP.mkdir()

scale_pad = (
    f"scale={RES}:force_original_aspect_ratio=decrease,"
    f"pad={RES}:(ow-iw)/2:(oh-ih)/2,setsar=1"
)

clips = []
for i, item in enumerate(SEQUENCE):
    src = BASE / item
    out = TEMP / f"clip_{i:03d}.mp4"
    print(f"[{i+1}/{len(SEQUENCE)}] {item}")

    if item.endswith(".png"):
        run([
            ffmpeg, "-y",
            "-loop", "1", "-i", str(src),
            "-f", "lavfi", "-i", f"anullsrc=channel_layout=stereo:sample_rate={AUDIO_RATE}",
            "-t", str(IMAGE_DURATION),
            "-vf", scale_pad,
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", FPS,
            "-c:a", "aac", "-shortest",
            str(out),
        ], label=f"image -> {IMAGE_DURATION}s clip")
    else:
        run([
            ffmpeg, "-y", "-i", str(src),
            "-vf", f"setpts=PTS/{speedup},{scale_pad}",
            "-af", f"atempo={speedup}",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", FPS,
            "-c:a", "aac",
            str(out),
        ], label=f"video -> {speedup:.2f}x speedup")

    clips.append(out)

# -- Concat --
concat_file = TEMP / "list.txt"
concat_file.write_text("\n".join(f"file '{c.resolve()}'" for c in clips))

print(f"\nConcatenating {len(clips)} clips...")
run([
    ffmpeg, "-y",
    "-f", "concat", "-safe", "0",
    "-i", str(concat_file),
    "-c", "copy",
    str(OUTPUT),
], label="concat")

print(f"\nDone! -> {OUTPUT}")
