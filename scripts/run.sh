#!/bin/bash
# run.sh — entry point for GitHub Actions / local run
set -euo pipefail
cd "$(dirname "$0")/.."

echo "── SQL.SSL Reel Bot — environment setup ──"

command -v ffmpeg >/dev/null || { echo "ffmpeg missing"; exit 1; }
command -v node >/dev/null || { echo "node missing"; exit 1; }

# edge-tts (free Hindi TTS fallback) — sirf tab install jab tak hai
if ! python3 -m edge_tts --help >/dev/null 2>&1; then
  echo "edge-tts install ho raha hai (free Hindi voice)..."
  pip3 install --quiet --disable-pip-version-check --break-system-packages edge-tts \
    || pip3 install --quiet --disable-pip-version-check edge-tts \
    || echo "edge-tts install skip (fallback engines available)"
fi

# pipeline chalao
ARGS=("$@")
node scripts/pipeline.mjs "${ARGS[@]}"
