#!/bin/bash
# STEP 6 — Voice:BGM mix (prompt file wala rule, parameterized)
# env: IN_VIDEO VOICE BGM OUT_VIDEO VOICE_DURATION VOICE_VOLUME BGM_VOLUME FADE
set -euo pipefail

IN_VIDEO=${IN_VIDEO:?IN_VIDEO required}
VOICE=${VOICE:?VOICE required}
BGM=${BGM:?BGM required}
OUT_VIDEO=${OUT_VIDEO:?OUT_VIDEO required}
VOICE_DURATION=${VOICE_DURATION:?VOICE_DURATION required}
VOICE_VOLUME=${VOICE_VOLUME:-2.2}
BGM_VOLUME=${BGM_VOLUME:-0.30}
FADE=${FADE:-3}

OUT_START=$(awk -v d="$VOICE_DURATION" -v f="$FADE" 'BEGIN{r=d-f; if(r<0) r=0; printf "%.3f", r}')

ffmpeg -y \
  -i "$IN_VIDEO" \
  -i "$VOICE" \
  -i "$BGM" \
  -filter_complex \
    "[1:a]volume=${VOICE_VOLUME}[a1]; \
     [2:a]volume=${BGM_VOLUME},afade=t=in:ss=0:d=${FADE},afade=t=out:st=${OUT_START}:d=${FADE}[a2]; \
     [a1][a2]amix=inputs=2:duration=first[aout]" \
  -map 0:v \
  -map "[aout]" \
  -c:v copy \
  -c:a aac -b:a 192k \
  -t "$VOICE_DURATION" \
  "$OUT_VIDEO"

echo "Final Video तैयार!"
echo "Video Duration = Voice Over Duration = $VOICE_DURATION seconds"
