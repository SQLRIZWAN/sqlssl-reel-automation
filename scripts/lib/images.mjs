// images.mjs — STEP 3: 18-25 images (Pollinations free → OpenAI → Gemini)
import fs from 'node:fs';
import path from 'node:path';
import { OUT, info, fetchBuffer, fetchJson, sleep, run } from './util.mjs';

function fullPrompt(moment, settings, index) {
  const brandHint =
    'Natural @sql.ssl / SQL.SSL branding embedded in the scene (monitor corner signature, jacket emblem, phone screen signature or code line) — not promotional, part of the environment. No login screen, no hacked-account screen.';
  const overlayNote = '';
  return [
    moment.scene,
    `Scene must visually match this exact voice line: "${moment.voiceLine}"`,
    `Avoid: ${moment.avoid || 'generic random hacker'}`,
    brandHint,
    settings.images.style,
    `Vertical 9:16 illustration number ${index}, fully painted, no photograph.`,
    overlayNote,
  ].filter(Boolean).join(' ');
}

async function pollinations(moment, settings, i) {
  const prompt = encodeURIComponent(fullPrompt(moment, settings, i));
  let url = `https://image.pollinations.ai/prompt/${prompt}?width=${settings.images.width}&height=${settings.images.height}&model=flux&nologo=true&seed=${1000 + i * 7}&referrer=github.com/SQLRIZWAN/sqlssl-reel-automation`;
  const opts = {};
  if (process.env.POLLINATIONS_TOKEN) {
    opts.headers = { Authorization: `Bearer ${process.env.POLLINATIONS_TOKEN}` };
  }
  const buf = await fetchBuffer(url, opts, 4);
  const raw = path.join(OUT, `raw_${i}.png`);
  fs.writeFileSync(raw, buf);
  return raw;
}

async function openaiImg(moment, settings, i) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY missing');
  const j = await fetchJson('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt: fullPrompt(moment, settings, i),
      size: '1024x1536',
      n: 1,
    }),
  }, 2);
  const b64 = j.data?.[0]?.b64_json;
  if (!b64) throw new Error('OpenAI image: no data');
  const raw = path.join(OUT, `raw_${i}.png`);
  fs.writeFileSync(raw, Buffer.from(b64, 'base64'));
  return raw;
}

async function geminiImg(moment, settings, i) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY missing');
  const j = await fetchJson(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: fullPrompt(moment, settings, i) }] }],
        generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
      }),
    }, 2
  );
  const part = j.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data || p.inline_data?.data);
  const b64 = part?.inlineData?.data || part?.inline_data?.data;
  if (!b64) throw new Error('Gemini image: no data');
  const raw = path.join(OUT, `raw_${i}.png`);
  fs.writeFileSync(raw, Buffer.from(b64, 'base64'));
  return raw;
}

const PROVIDERS = { pollinations: pollinations, openai: openaiImg, gemini: geminiImg };
let lastReqAt = 0;

async function genOne(moment, settings, i) {
  for (const name of settings.images.provider_priority) {
    const retries = settings.images.retries + 2;
    for (let a = 0; a < retries; a++) {
      try {
        // anonymous tier: 1 req / 15s — spacing lagao (token ho to kam)
        const since = Date.now() - lastReqAt;
        const gap = (process.env.POLLINATIONS_TOKEN ? 6 : settings.images.min_interval_seconds || 15) * 1000;
        if (since < gap && name === 'pollinations') await sleep(gap - since);
        const raw = await PROVIDERS[name](moment, settings, i);
        lastReqAt = Date.now();
        // normalize to exact 1080x1920
        const final = path.join(OUT, `image_${i}.png`);
        run('ffmpeg', [
          '-y', '-i', raw,
          '-vf', `scale=${settings.images.width}:${settings.images.height}:force_original_aspect_ratio=increase,crop=${settings.images.width}:${settings.images.height}`,
          final,
        ]);
        fs.rmSync(raw, { force: true });
        if (fs.statSync(final).size < 5000) throw new Error('image too small');
        return final;
      } catch (e) {
        info(`    image ${i} via ${name} try ${a + 1} failed: ${e.message}`);
        lastReqAt = Date.now();
        await sleep(3000 * (a + 1));
      }
    }
  }
  throw new Error(`Image ${i}: sab providers fail`);
}

export async function makeImages(settings, moments) {
  const n = moments.length;
  info(`  ${n} images ban rahi hain (${settings.images.provider_priority.join(' → ')})`);
  const conc = settings.images.concurrency;
  const files = new Array(n);
  let next = 0;

  async function worker() {
    while (next < n) {
      const i = next++;
      files[i] = await genOne(moments[i], settings, i + 1);
      if ((i + 1) % 5 === 0 || i + 1 === n) info(`  images: ${i + 1}/${n} ✓`);
    }
  }
  await Promise.all(Array.from({ length: conc }, worker));
  return files;
}
