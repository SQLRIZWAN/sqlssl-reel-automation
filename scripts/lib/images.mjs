// images.mjs — STEP 3: 18-25 images (Pollinations free → OpenAI → Gemini)
import fs from 'node:fs';
import path from 'node:path';
import { OUT, info, fetchBuffer, fetchJson, sleep, run } from './util.mjs';

function fullPrompt(moment, settings, index) {
  const brandHint =
    'Natural @sql.ssl / SQL.SSL branding embedded in the scene (monitor corner signature, jacket emblem, phone screen signature or code line) — not promotional, part of the environment. No login screen, no hacked-account screen.';
  return [
    `Cyber-security and ethical hacking themed digital illustration: ${moment.scene}`,
    `Scene must visually match this exact voice line: "${moment.voiceLine}"`,
    'Clear hacking imagery: computer screens with code, server racks, hooded figures at keyboards, glowing red alerts, network maps, firewalls, data streams — choose what fits the line.',
    settings.images.style,
    brandHint,
    `Vertical 9:16 illustration number ${index}, fully painted digital art, subject centered with tall composition, mobile-safe. Do NOT include: ${moment.avoid || 'photorealistic photo, blurry, watermark, captions, extra fingers'}`,
  ].filter(Boolean).join(' ');
}

const NEGATIVE = 'photograph, realistic photo, blurry, watermark, logo text, captions, landscape, cropped subject, low quality, deformed hands';

async function saveRaw(buf, i) {
  const raw = path.join(OUT, `raw_${i}.png`);
  fs.writeFileSync(raw, buf);
  return raw;
}

async function fetchImage(url, opts = {}) {
  const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(150000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const isJpeg = buf[0] === 0xff && buf[1] === 0xd8;
  const isPng = buf[0] === 0x89 && buf[1] === 0x50;
  if (buf.length < 8000 || !(isJpeg || isPng)) throw new Error(`not an image (${buf.length}b)`);
  return buf;
}

async function pollinations(moment, settings, i) {
  const prompt = encodeURIComponent(fullPrompt(moment, settings, i));
  const qs = `width=${settings.images.width}&height=${settings.images.height}&nologo=true&seed=${1000 + i * 7}&referrer=github.com/SQLRIZWAN/sqlssl-reel-automation&negative_prompt=${encodeURIComponent(NEGATIVE)}`;
  const opts = {};
  if (process.env.POLLINATIONS_TOKEN) {
    opts.headers = { Authorization: `Bearer ${process.env.POLLINATIONS_TOKEN}` };
  }
  try {
    return await saveRaw(await fetchImage(`https://image.pollinations.ai/prompt/${prompt}?${qs}`, opts), i);
  } catch (e1) {
    // kuch nodes sirf POST /prompt route support karte hain — fallback
    info(`    image ${i} pollinations GET fail (${e1.message}) → POST try`);
    const res = await fetch(`https://image.pollinations.ai/prompt/${prompt}?${qs}`, {
      ...opts,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
      body: '{}',
      signal: AbortSignal.timeout(150000),
    });
    if (!res.ok) throw new Error(`POST HTTP ${res.status} (GET: ${e1.message})`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 8000 || buf[0] !== 0xff) throw new Error(`POST not an image (${buf.length}b, GET: ${e1.message})`);
    return await saveRaw(buf, i);
  }
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
  const models = ['gemini-2.5-flash-image', 'gemini-2.0-flash-preview-image-generation'];
  let lastErr = null;
  for (const model of models) {
    try {
      const j = await fetchJson(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
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
      if (!b64) throw new Error(`${model}: no data`);
      const raw = path.join(OUT, `raw_${i}.png`);
      fs.writeFileSync(raw, Buffer.from(b64, 'base64'));
      return raw;
    } catch (e) {
      info(`    gemini image ${model}: ${e.message.slice(0, 140)}`);
      lastErr = e;
    }
  }
  throw lastErr;
}

const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'to', 'with', 'that', 'this', 'showing', 'shows', 'visual', 'style', 'scene', 'must', 'avoid', 'shot', 'like', 'over', 'into', 'from', 'for', 'at', 'by', 'as', 'be', 'are', 'was', 'were', 'his', 'her', 'their', 'has', 'have', 'been', 'being', 'also', 'after', 'before', 'during', 'through', 'says', 'said']);

function searchQuery(moment) {
  const words = `${moment.scene || ''} ${moment.voiceLine || ''}`
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOP.has(w));
  return [...new Set(words)].slice(0, 6).join(' ') || 'technology computer';
}

async function openverse(moment, settings, i) {
  const full = searchQuery(moment);
  let lastErr = null;
  for (const q of [full.split(' ').slice(0, 4).join(' '), full.split(' ').slice(0, 2).join(' ')]) {
    const j = await fetchJson(
      `https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&license_type=commercial&page_size=10&mature=false`,
      {}, 2
    );
    const results = (j.results || []).filter((r) => r.url);
    if (!results.length) { lastErr = new Error(`0 results for "${q}"`); continue; }
    for (let k = 0; k < Math.min(3, results.length); k++) {
      const r = results[(i + k) % results.length];
      try {
        const buf = await fetchImage(r.url, {}, 1);
        return await saveRaw(buf, i);
      } catch (e) {
        lastErr = e;
      }
    }
  }
  throw new Error(`openverse: ${lastErr?.message || 'fail'}`);
}

async function picsum(moment, settings, i) {
  const buf = await fetchImage(
    `https://picsum.photos/seed/sqlssl${i * 31}/${settings.images.width}/${settings.images.height}`,
    {}, 1
  );
  return await saveRaw(buf, i);
}

const PROVIDERS = { pollinations: pollinations, openai: openaiImg, gemini: geminiImg, openverse, picsum };
let lastReqAt = 0;
let pollFail = 0;
const runDead = new Set();

async function genOne(moment, settings, i) {
  for (let round = 0; round < 4; round++) {
    let tried = 0;
    for (const name of settings.images.provider_priority) {
      if (runDead.has(name)) continue;
      tried += 1;
      try {
        if (name === 'pollinations') {
          const since = Date.now() - lastReqAt;
          const gap = (process.env.POLLINATIONS_TOKEN ? 6 : settings.images.min_interval_seconds || 32) * 1000;
          if (since < gap) await sleep(gap - since);
        }
        const raw = await PROVIDERS[name](moment, settings, i);
        lastReqAt = Date.now();
        if (name === 'pollinations') pollFail = 0;
        const final = path.join(OUT, `image_${i}.png`);
        run('ffmpeg', [
          '-y', '-i', raw,
          '-vf', `scale=${settings.images.width}:${settings.images.height}:force_original_aspect_ratio=increase,crop=${settings.images.width}:${settings.images.height}`,
          final,
        ]);
        fs.rmSync(raw, { force: true });
        if (fs.statSync(final).size < 5000) throw new Error('image too small');
        if (name === 'pollinations') info(`  image ${i} via ${name} ✓`);
        return final;
      } catch (e) {
        info(`    image ${i} via ${name} try ${round + 1} failed: ${e.message}`);
        lastReqAt = Date.now();
        if (/missing/i.test(e.message)) runDead.add(name);
        else if ((name === 'openai' || name === 'gemini') && /HTTP (403|404|429)|credits|billing|leaked/i.test(e.message)) {
          runDead.add(name);
          info(`    ${name} is run ke liye skip (permanent error) — fallback chain se chalega`);
        }
        if (name === 'pollinations') {
          pollFail += 1;
          const maxFails = process.env.POLLINATIONS_TOKEN ? 8 : 3;
          if (pollFail >= maxFails) {
            runDead.add('pollinations');
            info('    pollinations quota/IP limit — is run ke liye skip (POLLINATIONS_TOKEN se ye limit hatti hai)');
          }
          await sleep(27000 + Math.floor(Math.random() * 7000));
        } else if (name === 'openverse' && round >= 2) {
          runDead.add('openverse');
        } else {
          await sleep(2500);
        }
      }
    }
    if (tried === 0 || runDead.size >= settings.images.provider_priority.length) break;
  }
  throw new Error(`Image ${i}: sab providers fail`);
}

export async function makeImages(settings, moments) {
  const n = moments.length;
  runDead.clear();
  pollFail = 0;
  lastReqAt = 0;
  // Gemini key ho to pehle gemini (fast, free tier, topical art) — quota waste nahi hota
  let chain = [...settings.images.provider_priority];
  if (process.env.GEMINI_API_KEY && chain.includes('gemini')) {
    chain = ['gemini', ...chain.filter((c) => c !== 'gemini')];
  }
  info(`  ${n} images ban rahi hain (${chain.join(' → ')})`);
  const runSettings = { ...settings, images: { ...settings.images, provider_priority: chain } };
  const conc = settings.images.concurrency;
  const files = new Array(n);
  let next = 0;

  async function worker() {
    while (next < n) {
      const i = next++;
      files[i] = await genOne(moments[i], runSettings, i + 1);
      if ((i + 1) % 5 === 0 || i + 1 === n) info(`  images: ${i + 1}/${n} ✓`);
    }
  }
  await Promise.all(Array.from({ length: conc }, worker));
  return files;
}
