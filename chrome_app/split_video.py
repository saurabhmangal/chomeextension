import subprocess
import imageio_ffmpeg

ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
INPUT = "video_photos/20260418_005404.mp4"
SPLIT_AT = "00:17:30"

subprocess.run([ffmpeg, "-y", "-i", INPUT, "-to", SPLIT_AT, "-c", "copy",
                "video_photos/20260418_005404_part1.mp4"], check=True)

subprocess.run([ffmpeg, "-y", "-i", INPUT, "-ss", SPLIT_AT, "-c", "copy",
                "video_photos/20260418_005404_part2.mp4"], check=True)

print("Done! part1.mp4 and part2.mp4 saved.")
