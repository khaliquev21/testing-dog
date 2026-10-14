#!/usr/bin/env bash
# Turn a short piece of REAL product footage into a seamless, muted, web-optimised loop.
#
#   scripts/make-loop.sh <input-video> <start-seconds> <loop-seconds> <output-name> [options]
#
# Options:
#   --crossfade <s>   Blend the end back into the start over <s> seconds so the loop has no jump
#                     (default 0.5). Use 0 if the footage already loops cleanly.
#   --crop <w:h>      Centre-crop to an aspect ratio, e.g. 16:9, 4:5 or 1:1 (default: keep original).
#   --width <px>      Output width in pixels, never upscaled (default 1280).
#   --fps <n>         Frame rate (default 30).
#
# Produces, next to <output-name>:
#   <output-name>.mp4         H.264, no audio, +faststart. Upload this to Shopify (Content > Files).
#   <output-name>.webm        VP9 version (optional; use with the "direct link" setting).
#   <output-name>-poster.jpg  Cover image (upload as the video's cover image).
#
# It only edits the footage you give it: trim, crop, scale, crossfade. It never adds effects.
set -euo pipefail

if [ "$#" -lt 4 ]; then
  sed -n '2,22p' "$0" | sed 's/^# \{0,1\}//'
  exit 1
fi

input="$1"; start="$2"; length="$3"; out="$4"; shift 4
fade="0.5"; crop=""; width="1280"; fps="30"
while [ "$#" -gt 0 ]; do
  case "$1" in
    --crossfade) fade="$2"; shift 2 ;;
    --crop)      crop="$2"; shift 2 ;;
    --width)     width="$2"; shift 2 ;;
    --fps)       fps="$2"; shift 2 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

command -v ffmpeg >/dev/null || { echo "ffmpeg is required (https://ffmpeg.org)" >&2; exit 1; }
[ -f "$input" ] || { echo "Input not found: $input" >&2; exit 1; }

# Optional centre crop to the requested aspect ratio.
crop_filter=""
if [ -n "$crop" ]; then
  cw="${crop%%:*}"; ch="${crop##*:}"
  crop_filter="crop='if(gte(iw/ih,${cw}/${ch}),ih*${cw}/${ch},iw)':'if(gte(iw/ih,${cw}/${ch}),ih,iw*${ch}/${cw})',"
fi
# Even dimensions, never upscaled.
scale_filter="scale='min(${width},iw)':-2:flags=lanczos,format=yuv420p"

if awk "BEGIN{exit !(${fade} > 0)}"; then
  # Need <length + fade> seconds of source. The first <fade> seconds are blended with the extra tail,
  # so the last frame flows straight into the first one.
  if ! awk "BEGIN{exit !(${length} > 2*${fade})}"; then
    echo "loop-seconds must be more than twice the crossfade" >&2; exit 1
  fi
  total=$(awk "BEGIN{print ${length}+${fade}}")
  filter="[0:v]trim=start=${start}:duration=${total},setpts=PTS-STARTPTS,fps=${fps},${crop_filter}${scale_filter},split=3[a][b][c];\
[a]trim=0:${fade},setpts=PTS-STARTPTS[head];\
[b]trim=${fade}:${length},setpts=PTS-STARTPTS[body];\
[c]trim=${length}:${total},setpts=PTS-STARTPTS[tail];\
[tail][head]xfade=transition=fade:duration=${fade}:offset=0[blend];\
[blend][body]concat=n=2:v=1:a=0[out]"
else
  filter="[0:v]trim=start=${start}:duration=${length},setpts=PTS-STARTPTS,fps=${fps},${crop_filter}${scale_filter}[out]"
fi

ffmpeg -hide_banner -loglevel error -y -i "$input" -filter_complex "$filter" -map "[out]" -an \
  -c:v libx264 -preset slow -crf 26 -movflags +faststart -pix_fmt yuv420p "${out}.mp4"
ffmpeg -hide_banner -loglevel error -y -i "$input" -filter_complex "$filter" -map "[out]" -an \
  -c:v libvpx-vp9 -crf 34 -b:v 0 -row-mt 1 -pix_fmt yuv420p "${out}.webm"
ffmpeg -hide_banner -loglevel error -y -i "${out}.mp4" -frames:v 1 -q:v 3 "${out}-poster.jpg"

for f in "${out}.mp4" "${out}.webm" "${out}-poster.jpg"; do
  printf '%-34s %s\n' "$f" "$(du -h "$f" | cut -f1)"
done
echo "Done. Aim for under ~3 MB per loop. If larger: shorter loop, lower --width, or higher crf."
