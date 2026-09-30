// render.mjs — STEP 3 (center Hindi overlay) + STEP 3B (Ken Burns) + STEP 6 (mix)
import fs from 'node:fs';
import path from 'node:path';
import { OUT, ROOT, info, run, runBash, ensureDir, fetchBuffer } from './util.mjs';
import { resolveDP, makeBadge } from './dp.mjs';

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
  const w = settings.images.width;
  const h = settings.images.height;

  // Badge (circular DP + golden ring + golden @handle) — ek baar banao, har scene par lagega
  let badgePath = null;
  try {
    const dp = await resolveDP();
    badgePath = makeBadge(settings, dp);
    info(`  badge ready (${dp ? 'DP + ' : ''}${settings.brand?.handle || '@sql.ssl'}) ✓`);
  } catch (e) {
    info(`  badge skip: ${e.message}`);
  }

  for (let i = 1; i <= moments.length; i++) {
    const src = path.join(OUT, `image_${i}.png`);
    const out = path.join(OUT, `image_${i}_ov.png`);
    const ovPng = path.join(OUT, `ov_${i}_box.png`);

    // Reference-reel style: neon rounded border box + bold white Hindi text (Pillow se)
    const pos = run('python3', [
      path.join(ROOT, 'scripts', 'make_overlay.py'),
      '--text', String(moments[i - 1].overlay || ''),
      '--font', font,
      '--size', String(o.font_size),
      '--wrap', String(o.wrap_chars),
      '--max-lines', String(o.max_lines),
      '--out', ovPng,
      '--width', String(w),
      '--height', String(h),
      '--y-ratio', String(o.y_center_ratio),
      '--border-color', String(o.box_color || '62,207,214'),
      '--border-width', String(o.box_border || 5),
    ]);
    const m = pos.match(/x=(-?\d+) y=(-?\d+)/);
    if (!m || !fs.existsSync(ovPng)) throw new Error(`make_overlay fail: ${pos.slice(0, 200)}`);
    const ox = m[1];
    const oy = m[2];

    const inputs = ['-y', '-i', src, '-i', ovPng];
    const chain = [`[0:v][1:v]overlay=x=${ox}:y=${oy}[v0]`];
    if (badgePath && fs.existsSync(badgePath)) {
      inputs.push('-i', badgePath);
      const bx = settings.brand?.dp_margin ?? 44;
      const byBottom = settings.brand?.dp_bottom ?? 78;
      chain.push(`[v0][2:v]overlay=x=${bx}:y=H-h-${byBottom}[v]`);
      run('ffmpeg', [...inputs, '-filter_complex', chain.join(';'), '-map', '[v]', '-frames:v', '1', out]);
    } else {
      run('ffmpeg', [...inputs, '-filter_complex', chain.join(';'), '-map', '[v]', '-frames:v', '1', out]);
    }
    fs.rmSync(ovPng, { force: true });
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
  const env = {
    ...process.env,
    NUM_IMAGES: String(num),
    IN_DIR: OUT,
    OUT_DIR: OUT,
    VIDEO_OUT: path.join(OUT, 'video_no_audio.mp4'),
    FPS: String(settings.video.fps),
  };
  if (Array.isArray(imageDuration)) {
    // 100% voice-image sync: har scene ki duration = us voice line ki audio length + gap
    const f = path.join(OUT, 'scene_durations.txt');
    fs.writeFileSync(f, imageDuration.map((d) => Number(d).toFixed(4)).join('\n') + '\n');
    env.SCENE_DURATIONS = f;
    env.IMAGE_DURATION = String(Number(imageDuration[0]).toFixed(4));
    const tot = imageDuration.reduce((a, b) => a + b, 0);
    info(`  per-scene durations: ${imageDuration.length} scenes, total=${tot.toFixed(2)}s ✓`);
  } else {
    env.IMAGE_DURATION = String(imageDuration);
  }
  runBash('bash scripts/kenburns.sh', { cwd: ROOT, env });
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
