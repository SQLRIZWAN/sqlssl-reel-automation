#!/bin/bash
# STEP 3B — Ken Burns Effect (prompt file wala rule, parameterized paths)
# env: NUM_IMAGES IMAGE_DURATION IN_DIR OUT_DIR VIDEO_OUT FPS
set -euo pipefail

NUM_IMAGES=${NUM_IMAGES:?NUM_IMAGES required}
# Per-scene sync: SCENE_DURATIONS file (har line = ek scene duration) ya phir sab ke liye IMAGE_DURATION
SCENE_DURATIONS=${SCENE_DURATIONS:-}
IMAGE_DURATION=${IMAGE_DURATION:-}
if [ -z "$SCENE_DURATIONS" ] && [ -z "$IMAGE_DURATION" ]; then
  echo "SCENE_DURATIONS ya IMAGE_DURATION required" >&2; exit 1
fi
IN_DIR=${IN_DIR:?IN_DIR required}
OUT_DIR=${OUT_DIR:-$IN_DIR}
VIDEO_OUT=${VIDEO_OUT:?VIDEO_OUT required}
FPS=${FPS:-30}

# हर इमेज पर Ken Burns apply करो — animated clip बनाओ
for i in $(seq 1 "$NUM_IMAGES"); do

  # Har scene ki apni duration (voice-line ke exactly barabar) + frames
  if [ -n "$SCENE_DURATIONS" ]; then
    DUR=$(sed -n "${i}p" "$SCENE_DURATIONS")
  else
    DUR=$IMAGE_DURATION
  fi
  FRAMES=$(awk -v d="$DUR" -v f="$FPS" 'BEGIN{printf "%d", d*f+0.5}')

  # Alternate: zoom-in और zoom-out + slight pan — variety के लिए
  if [ $(( i % 3 )) -eq 0 ]; then
    # Zoom In + Slight Left Pan
    ZOOM_FILTER="zoompan=z='zoom+0.0015':x='iw/2-(iw/zoom/2)-((iw/zoom/2)*0.03*on/$FRAMES)':y='ih/2-(ih/zoom/2)':d=$FRAMES:s=1080x1920:fps=$FPS"
  elif [ $(( i % 3 )) -eq 1 ]; then
    # Zoom Out (start zoomed, pull back)
    ZOOM_FILTER="zoompan=z='if(lte(zoom,1.0),1.5,max(1.001,zoom-0.0015))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=$FRAMES:s=1080x1920:fps=$FPS"
  else
    # Zoom In + Slight Right Pan
    ZOOM_FILTER="zoompan=z='zoom+0.0015':x='iw/2-(iw/zoom/2)+((iw/zoom/2)*0.03*on/$FRAMES)':y='ih/2-(ih/zoom/2)':d=$FRAMES:s=1080x1920:fps=$FPS"
  fi

  ffmpeg -y -loop 1 -i "$IN_DIR/image_${i}.png" \
    -vf "$ZOOM_FILTER" \
    -t "$DUR" \
    -c:v libx264 -pix_fmt yuv420p -crf 18 -preset medium \
    "$OUT_DIR/clip_${i}.mp4"

  echo "Clip $i animated ✓"
done

echo "सभी clips animated — Ken Burns complete!"

# ── सभी animated clips को एक list में लिखो ───────────────────────────────────
> "$OUT_DIR/clips.txt"
for i in $(seq 1 "$NUM_IMAGES"); do
  echo "file '$OUT_DIR/clip_${i}.mp4'" >> "$OUT_DIR/clips.txt"
done
echo "clips.txt तैयार ✓"

# ── सभी clips को एक video में जोड़ो (बिना audio) ─────────────────────────────
ffmpeg -y -f concat -safe 0 -i "$OUT_DIR/clips.txt" \
  -c:v libx264 -pix_fmt yuv420p -crf 18 -preset medium \
  "$VIDEO_OUT"

echo "Animated video (बिना audio) तैयार ✓"
