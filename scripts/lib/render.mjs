// render.mjs — STEP 3 (center Hindi overlay) + STEP 3B (Ken Burns) + STEP 6 (mix)
import fs from 'node:fs';
import path from 'node:path';
import { OUT, ROOT, info, run, runBash, ensureDir, fetchBuffer } from './util.mjs';

const FONT_CANDIDATES = [
  path.join(ROOT, 'assets', 'fonts', 'NotoSansDevanagari-Bold.ttf'),
  path.join(ROOT, 'assets', 'fonts', 'NotoSansDevanagari.ttf'),
  '/usr/share/fonts/truetype/noto/NotoSansDevanagari-Bold.ttf',
  '/usr/share/fonts/truetype/noto/NotoSansDevanagari-Regular.ttf',
  '/usr/share/fonts/noto/NotoSansDevanagari-Bold.ttf',
];

const FONT_URLS = [
  'https://raw.githubusercontent.com/google/fonts/main/ofl/notosansdevanagari/NotoSansDevanagari%5Bwdth%2Cwght%5D.ttf',
  'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notosansdevanagari/NotoSansDevanagari%5Bwdth%2Cwght%5D.ttf',
];

export async function ensureFont() {
  for (const f of FONT_CANDIDATES) if (fs.existsSync(f)) return f;
  ensureDir(path.join(ROOT, 'assets', 'fonts'));
  for (const url of FONT_URLS) {
    try {
      info(`  Font download: ${url.slice(0, 80)}...`);
      const buf = await fetchBuffer(url, {}, 2);
      const dest = path.join(ROOT, 'assets', 'fonts', 'NotoSansDevanagari-Bold.ttf');
      fs.writeFileSync(dest, buf);
      info(`  Font saved (${buf.length} bytes)`);
      return dest;
    } catch (e) {
      info(`  font url failed: ${e.message}`);
    }
  }
  // system search
  try {
    const found = runBash("fc-list :lang=hi file | head -1 | cut -d: -f1").trim().replace(/:$/, '');
    if (found && fs.existsSync(found)) return found;
  } catch {}
  throw new Error('Devanagari font nahi mili (NotoSansDevanagari)');
}

function wrapText(text, wrapChars, maxLines) {
  const words = text.replace(/\s+/g, ' ').trim().split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > wrapChars && cur) {
      lines.push(cur.trim());
      cur = w;
    } else {
      cur = (cur + ' ' + w).trim();
    }
  }
  if (cur) lines.push(cur.trim());
  if (lines.length > maxLines) {
    // merge extra lines into last allowed
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = (kept[maxLines - 1] + ' ' + lines.slice(maxLines).join(' ')).trim();
    return kept;
  }
  return lines;
}

export async function applyOverlays(settings, moments) {
  const font = await ensureFont();
  const o = settings.overlay;
  const made = [];
  for (let i = 1; i <= moments.length; i++) {
    const src = path.join(OUT, `image_${i}.png`);
    const out = path.join(OUT, `image_${i}_ov.png`);
    const lines = wrapText(moments[i - 1].overlay, o.wrap_chars, o.max_lines);
    const txtFile = path.join(OUT, `ov_${i}.txt`);
    fs.writeFileSync(txtFile, lines.join('\n'));

    const w = settings.images.width;
    const h = settings.images.height;
    const fs0 = o.font_size;
    const cx = Math.round(w * 0.5);
    const cy = Math.round(h * o.y_center_ratio);

    // center safe zone: 2 layers (faux bold) + dark border for readability
    const draw = (dx, dy, color, z) =>
      `drawtext=fontfile='${font}':textfile='${txtFile}':fontsize=${fs0}:fontcolor=${color}` +
      `:borderw=${o.border_width}:bordercolor=black@0.85` +
      `:x=${cx}-(text_w/2)+${dx}:y=${cy}-(text_h/2)+${dy}:line_spacing=14${z}`;

    const vf = [draw(3, 3, 'black@0.9', ''), draw(0, 0, 'white', ':shadowcolor=black@0.6:shadowx=2:shadowy=2')].join(',');

    run('ffmpeg', ['-y', '-i', src, '-vf', vf, '-frames:v', '1', out]);
    fs.rmSync(txtFile, { force: true });
    // replace original with overlaid version (ken burns isi ko use karega)
    fs.renameSync(out, src);
    made.push(src);
    if (i % 5 === 0 || i === moments.length) info(`  overlay: ${i}/${moments.length} ✓`);
  }
  return made;
}

export function kenBurns(settings, imageDuration) {
  info('  STEP 3B: Ken Burns animation');
  const num = fs.readdirSync(OUT).filter((f) => /^image_\d+\.png$/.test(f)).length;
  runBash('bash scripts/kenburns.sh', {
    cwd: ROOT,
    env: {
      ...process.env,
      NUM_IMAGES: String(num),
      IMAGE_DURATION: String(imageDuration),
      IN_DIR: OUT,
      OUT_DIR: OUT,
      VIDEO_OUT: path.join(OUT, 'video_no_audio.mp4'),
      FPS: String(settings.video.fps),
    },
  });
  const v = path.join(OUT, 'video_no_audio.mp4');
  if (!fs.existsSync(v)) throw new Error('video_no_audio.mp4 nahi bani');
  return v;
}

export function mixAudio(settings, voiceDuration) {
  info('  STEP 6: audio mix (Voice 2.2 | BGM 0.30)');
  runBash('bash scripts/mix.sh', {
    cwd: ROOT,
    env: {
      ...process.env,
      IN_VIDEO: path.join(OUT, 'video_no_audio.mp4'),
      VOICE: path.join(OUT, 'narration.wav'),
      BGM: path.join(OUT, 'bgm.wav'),
      OUT_VIDEO: path.join(OUT, 'cybersecurity_reel.mp4'),
      VOICE_DURATION: String(voiceDuration),
      VOICE_VOLUME: String(settings.voice.volume),
      BGM_VOLUME: String(settings.bgm.volume),
      FADE: String(settings.bgm.fade_in),
    },
  });
  return path.join(OUT, 'cybersecurity_reel.mp4');
}
