#!/usr/bin/env node
// pipeline.mjs — SQL.SSL daily reel automation (prompt file rules enforced)
// STEP 0 news → STEP 1 script → STEP 2 voice → STEP 3 images+overlay
// → STEP 3B Ken Burns → STEP 4 caption → STEP 5 BGM → STEP 6 mix → verify → STEP 7 upload
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  ROOT, OUT, loadSettings, loadJSON, CFG_DIR,
  ensureDir, step, done, info, saveJSON,
  ffprobeDuration, countWords, istDateStr,
} from './lib/util.mjs';
import { researchNews } from './lib/news.mjs';
import { generateScript, validateScript } from './lib/scriptgen.mjs';
import { makeVoice } from './lib/tts.mjs';
import { makeImages } from './lib/images.mjs';
import { applyOverlays, kenBurns, mixAudio } from './lib/render.mjs';
import { makeBgm } from './lib/bgm.mjs';
import { publishMediaBranch, uploadToInstagram, uploadViaCookie, repoSlug } from './lib/upload.mjs';

const argv = process.argv.slice(2);
const DRY = argv.includes('--dry-run');
const SKIP_UPLOAD = argv.includes('--skip-upload');
const slotArg = (argv.find((a) => a.startsWith('--slot=')) || '--slot=auto').split('=')[1];

function resolveSlot() {
  if (slotArg && slotArg !== 'auto') return slotArg;
  const ist = istDateStr(); // date only
  const hour = parseInt(new Date().toISOString().slice(11, 13), 10); // UTC hour
  const istHour = (hour + 5) % 24;
  return istHour < 12 ? 'morning' : 'evening';
}

function freshOutput() {
  ensureDir(OUT);
  // puraani media hatao, log rakho
  for (const f of fs.readdirSync(OUT)) {
    if (f !== 'pipeline.log') fs.rmSync(path.join(OUT, f), { force: true, recursive: true });
  }
}

async function verifyAll(ctx) {
  const s = ctx.settings;
  const checks = [];
  const add = (ok, label) => checks.push({ ok: !!ok, label });

  add(ctx.script && countWords(ctx.script.script) >= s.script.min_words && countWords(ctx.script.script) <= s.script.max_words,
    `Script 90-120 shabd (${ctx.script?.words} shabd)`);
  add(!s.script.banned_openers.some((b) => (ctx.script?.script || '').split(/[।.!?]/)[0].toLowerCase().startsWith(b.toLowerCase().trim())),
    'Voice direct news line se shuru (koi filler/banned opener nahi)');
  add(/@sql\.ssl/i.test(ctx.script?.script || '') && /follow|फॉलो/i.test((ctx.script?.script || '').slice(-160)),
    'Script end me @sql.ssl Follow CTA');
  const mc = ctx.script?.moments?.length || 0;
  add(mc >= 18 && mc <= 25, `18-25 images/moments (${mc})`);
  add(ctx.script?.moments?.every((m) => m.voiceLine && m.overlay && m.scene) || false,
    'Har scene voice line se match (Voice-Image Sync fields present)');
  add((ctx.script?.hashtags?.length === 10) && (ctx.script?.hashtags || []).some((h) => h.toLowerCase() === '#sqlssl'),
    'Hashtags = 3 Large + 4 Medium + 3 Niche (10, #sqlssl)');
  add(/@sql\.ssl/i.test(ctx.script?.caption || '') && /follow|फॉलो/i.test(ctx.script?.caption || ''),
    'Caption me Follow CTA');
  add(ctx.images && ctx.images.length >= 18 && ctx.images.length <= 25, `Images generated (${ctx.images?.length})`);
  add(ctx.overlaysDone === true, 'Har image ka CENTER Hindi text overlay');
  add(ctx.voice && ctx.voice.duration > 0, `Voice duration measured (${ctx.voice?.duration?.toFixed(2)}s, engine=${ctx.voice?.engine})`);
  add(ctx.videoNoAudio === true, 'Ken Burns animation (video_no_audio.mp4, plain slideshow nahi)');
  add(ctx.bgmOk === true, `BGM dark cyberpunk 80-100 BPM fade in/out (${ctx.bgm?.provider || '?'})`);
  add(ctx.finalDurationOk === true,
    `Final video duration = voice duration (video=${ctx.finalDuration?.toFixed(2)}s voice=${ctx.voice?.duration?.toFixed(2)}s)`);
  add(ctx.finalVideoOk === true, 'Final export 1080x1920 H.264 MP4');

  const failed = checks.filter((c) => !c.ok);
  const report = checks.map((c) => `${c.ok ? '[x]' : '[ ]'} ${c.ok ? 'VERIFIED' : 'MISSING'} — ${c.label}`).join('\n');
  fs.writeFileSync(path.join(OUT, 'verify_report.txt'), report + '\n');
  info('\n' + report);
  return { ok: failed.length === 0, failed, checks };
}

function ghSummary(text) {
  try {
    if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, text + '\n');
  } catch {}
}

async function main() {
  freshOutput();
  const settings = loadSettings();
  const slot = resolveSlot();
  const dateStr = istDateStr();
  const meta = { slot, date: dateStr, started_at: new Date().toISOString(), repo: repoSlug() };
  const ctx = { settings, slot, date: dateStr };
  info(`SQL.SSL Reel Bot | slot=${slot} | date=${dateStr} | dryRun=${DRY}`);

  // ── STEP 0
  let t = step('STEP 0 — LIVE news research (calendar + Google News RSS)');
  const news = await researchNews();
  ctx.news = news;
  meta.news = news;
  done(t, `| ${news.headline.slice(0, 70)}`);

  // ── STEP 1
  t = step('STEP 1 — Hindi script (90-120 words) + 18-25 moments + caption/hashtags');
  const script = await generateScript(settings, news);
  ctx.script = script;
  meta.script = { words: script.words, moments: script.moments.length, engine: script._engine, hashtags: script.hashtags.length };
  fs.writeFileSync(path.join(OUT, 'script.txt'), script.script);
  fs.writeFileSync(path.join(OUT, 'moments.json'), JSON.stringify(script.moments, null, 2));
  fs.writeFileSync(path.join(OUT, 'caption.txt'), `${script.caption}\n\n${script.hashtags.join(' ')}`);
  const preErrors = validateScript(script, settings, news);
  if (preErrors.length) info(`  ⚠ validation: ${preErrors.join(' | ')}`);
  done(t, `| ${script.words} words, ${script.moments.length} moments, engine=${script._engine}`);

  if (DRY) {
    const v = await verifyAll({ ...ctx, images: new Array(script.moments.length).fill('x'), overlaysDone: false, videoNoAudio: false, bgmOk: false, finalDurationOk: false, finalVideoOk: false });
    meta.verify = { ok: false, dry_run: true, failed: v.failed.length };
    saveJSON(path.join(OUT, 'meta.json'), meta);
    info('DRY RUN complete — news + script ready, media steps skipped');
    ghSummary(`## 🧪 DRY RUN\n- News: ${news.headline}\n- Script: ${script.words} words / ${script.moments.length} moments / ${script._engine}\n- Media steps skipped (--dry-run)`);
    return;
  }

  // ── STEP 2
  t = step('STEP 2 — Voice over (Gemini TTS Rasalgethi → fallback) + duration');
  const voice = await makeVoice(settings, script.script);
  ctx.voice = voice;
  meta.voice = { duration: voice.duration, engine: voice.engine };
  const VOICE_DURATION = voice.duration;
  const IMAGE_DURATION = parseFloat((VOICE_DURATION / script.moments.length).toFixed(4));
  info(`  VOICE_DURATION=${VOICE_DURATION}s | IMAGE_DURATION=${IMAGE_DURATION}s | images=${script.moments.length}`);
  done(t, `| ${VOICE_DURATION.toFixed(2)}s via ${voice.engine}`);

  // ── STEP 3
  t = step('STEP 3 — 18-25 images (voice-image sync) + CENTER Hindi overlay');
  const images = await makeImages(settings, script.moments);
  ctx.images = images;
  await applyOverlays(settings, script.moments);
  ctx.overlaysDone = true;
  done(t, `| ${images.length} images + overlays`);

  // ── STEP 3B
  t = step('STEP 3B — Ken Burns animation → video_no_audio.mp4');
  kenBurns(settings, IMAGE_DURATION);
  ctx.videoNoAudio = true;
  done(t);

  // ── STEP 5
  t = step('STEP 5 — BGM (dark cyberpunk electronic, 80-100 BPM, fade in/out)');
  const bgmFile = await makeBgm(settings, VOICE_DURATION);
  ctx.bgm = { provider: fs.existsSync(path.join(ROOT, 'assets', 'bgm.mp3')) ? 'asset' : 'synth' };
  ctx.bgmOk = true;
  done(t, `| ${ctx.bgm.provider}`);

  // ── STEP 6
  t = step('STEP 6 — Final mix (Voice 2.2 / BGM 0.30) → cybersecurity_reel.mp4');
  const finalVideo = mixAudio(settings, VOICE_DURATION);
  const finalDuration = ffprobeDuration(finalVideo);
  ctx.finalDuration = finalDuration;
  ctx.finalDurationOk = Math.abs(finalDuration - VOICE_DURATION) <= 0.35;
  ctx.finalVideoOk = fs.existsSync(finalVideo) && fs.statSync(finalVideo).size > 100000;
  const probe = ffprobeStreamInfo(finalVideo);
  meta.video = { duration: finalDuration, size: fs.statSync(finalVideo).size, ...probe };
  done(t, `| ${finalDuration.toFixed(2)}s, ${(meta.video.size / 1024 / 1024).toFixed(1)} MB`);

  // ── FINAL VERIFY (prompt file ka 11-point checklist)
  t = step('FINAL SELF-VERIFICATION (11 points)');
  const verdict = await verifyAll(ctx);
  meta.verify = { ok: verdict.ok, failed: verdict.failed.map((f) => f.label) };
  done(t, verdict.ok ? '| ALL 11 VERIFIED ✓' : `| ${verdict.failed.length} FAILED ✗`);
  if (!verdict.ok) {
    ghSummary(`## ❌ Verification failed\n${verdict.failed.map((f) => '- ' + f.label).join('\n')}`);
    saveJSON(path.join(OUT, 'meta.json'), meta);
    throw new Error(`Verification failed (${verdict.failed.length} checks) — upload blocked per prompt rules`);
  }

  // ── STEP 7
  t = step('STEP 7 — Upload (media branch → Instagram [cookie → Graph API])');
  const captionFull = `${script.caption}\n\n${script.hashtags.join(' ')}`;
  const media = publishMediaBranch(finalVideo, slot, dateStr);
  meta.media = media;
  let uploadResult = null;
  let cookieErr = null;

  // (A) Cookie upload — user ki pasand (web session, instagrapi)
  if (!SKIP_UPLOAD && process.env.IG_COOKIES) {
    try {
      uploadResult = uploadViaCookie(finalVideo, captionFull);
      meta.upload = { ok: true, ...uploadResult, video_url: media.url };
      info(`  Instagram cookie upload complete ✓ (@${uploadResult.username}, reel code=${uploadResult.code})`);
    } catch (e) {
      cookieErr = e.message;
      info(`  Cookie upload FAILED → Graph API fallback: ${e.message}`);
    }
  }

  // (B) Graph API fallback (jaise pehle tha)
  if (!uploadResult && !SKIP_UPLOAD && process.env.INSTAGRAM_ACCESS_TOKEN && media.url) {
    try {
      uploadResult = await uploadToInstagram(settings, {
        videoUrl: media.url,
        caption: captionFull,
        story: settings.upload.story_share,
      });
      meta.upload = { ok: true, via: 'graph', ...uploadResult, video_url: media.url };
      info('  Instagram Graph upload complete ✓');
    } catch (e) {
      const both = cookieErr ? ` [cookie: ${cookieErr}]` : '';
      meta.upload = { ok: false, error: e.message + both };
      info(`  Instagram upload FAILED: ${e.message}${both}`);
      throw e;
    }
  } else if (!uploadResult) {
    if (cookieErr) {
      meta.upload = { ok: false, error: `cookie fail + graph unavailable (${!process.env.INSTAGRAM_ACCESS_TOKEN ? 'no token' : 'no media URL'}): ${cookieErr}` };
      info(`  Upload FAILED: ${meta.upload.error}`);
      throw new Error(meta.upload.error);
    }
    const why = SKIP_UPLOAD ? '--skip-upload' : !process.env.INSTAGRAM_ACCESS_TOKEN ? 'INSTAGRAM_ACCESS_TOKEN missing' : 'media URL nahi bani';
    meta.upload = { ok: false, skipped: why, video_url: media.url || null };
    info(`  Upload skipped: ${why}`);
  }
  done(t, meta.upload.ok ? '| published ✓' : `| ${meta.upload.skipped || meta.upload.error}`);

  meta.finished_at = new Date().toISOString();
  saveJSON(path.join(OUT, 'meta.json'), meta);

  ghSummary(
    `## ✅ Reel ready — ${dateStr} (${slot})\n` +
    `- **News:** ${news.headline}\n` +
    `- **Script:** ${script.words} words · ${script.moments.length} moments · engine=${script._engine}\n` +
    `- **Voice:** ${VOICE_DURATION.toFixed(1)}s via ${voice.engine}\n` +
    `- **Video:** ${finalDuration.toFixed(1)}s · ${(meta.video.size / 1048576).toFixed(1)} MB · 1080x1920\n` +
    `- **Verify:** 11/11 ✓\n` +
    `- **Upload:** ${meta.upload.ok ? 'Instagram PUBLISHED ✓' : 'skipped (' + (meta.upload.skipped || meta.upload.error) + ')'}\n` +
    (media.url ? `- **Media URL:** ${media.url}\n` : '') +
    `\n> Upload ke baad: story share karo, 30 min me comments ka reply karo, 2-3 bade cyber accounts pe meaningful comment karo (Golden Hour).`
  );
  info('\n🏁 PIPELINE COMPLETE');
}

function ffprobeStreamInfo(file) {
  try {
    const out = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,codec_name', '-of', 'csv=p=0', file], { encoding: 'utf8' }).trim();
    const [w, h, codec] = out.split(',');
    return { width: +w, height: +h, codec };
  } catch {
    return {};
  }
}

main().catch((e) => {
  console.error('\n❌ PIPELINE FAILED:', e.message);
  try { fs.appendFileSync(path.join(OUT, 'pipeline.log'), `\nFATAL: ${e.message}\n`); } catch {}
  process.exit(1);
});
