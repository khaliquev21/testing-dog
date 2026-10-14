#!/bin/sh
# Creates SYNTHETIC layout-test fixtures (labelled "TEST FIXTURE"). They are never product imagery
# and are git-ignored. Needs ImageMagick (convert) and ffmpeg.
set -e
cd "$(dirname "$0")"
mkdir -p fixtures && cd fixtures
FONT=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf
i=1
for spec in "FCE5D8|Main image" "F3EEE8|Bristle close-up" "FFF4EC|Self-cleaning" "E9E2DA|Mist and tank" "FAF7F2|IPX7" "EDE6DE|In the box" "FCE5D8|Lifestyle dog" "F3EEE8|Lifestyle cat"; do
  bg="${spec%%|*}"; label="${spec##*|}"
  convert -size 1200x1200 "xc:#$bg" -fill '#202020' -font DejaVu-Sans-Bold -pointsize 54 -gravity center -annotate +0-60 "TEST FIXTURE $i" -pointsize 34 -annotate +0+20 "$label" -fill '#A04423' -pointsize 28 -annotate +0+90 "layout test only - not a product photo" "fixture-$i.png"
  i=$((i+1))
done
convert -size 1200x900 "xc:#FCE5D8" -fill '#202020' -font DejaVu-Sans-Bold -pointsize 54 -gravity center -annotate +0-40 "TEST FIXTURE (wide)" -pointsize 28 -annotate +0+40 "layout test only - not a product photo" fixture-wide.png
ffmpeg -hide_banner -loglevel error -y -f lavfi -i "gradients=s=1280x720:d=4:r=24:c0=0xFCE5D8:c1=0xE8754A:speed=0.8" -vf "drawtext=fontfile=$FONT:text='TEST CLIP A':fontsize=64:fontcolor=0x202020:x=(w-text_w)/2:y=(h-text_h)/2-30,drawtext=fontfile=$FONT:text='layout test only - not product footage':fontsize=30:fontcolor=0x202020:x=(w-text_w)/2:y=(h-text_h)/2+40" -an -c:v libvpx-vp9 -b:v 600k -pix_fmt yuv420p clip-a.webm
ffmpeg -hide_banner -loglevel error -y -f lavfi -i "gradients=s=720x900:d=4:r=24:c0=0xF3EEE8:c1=0xC25B33:speed=0.6" -vf "drawtext=fontfile=$FONT:text='TEST CLIP B':fontsize=56:fontcolor=0x202020:x=(w-text_w)/2:y=(h-text_h)/2-30,drawtext=fontfile=$FONT:text='not product footage':fontsize=30:fontcolor=0x202020:x=(w-text_w)/2:y=(h-text_h)/2+40" -an -c:v libvpx-vp9 -b:v 500k -pix_fmt yuv420p clip-b.webm
echo "fixtures written to $(pwd)"
