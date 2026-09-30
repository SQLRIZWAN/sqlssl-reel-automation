// tts.mjs — STEP 2: Gemini TTS (Rasalgethi) → OpenAI TTS → Edge TTS fallback
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, OUT, info, run, runBash, ffprobeDuration, ensureDir, sleep } from './util.mjs';

// "deep, heavy, commanding" tone (prompt-file rule) + loudness normalize
const HEAVY_EQ = 'bass=g=4:f=110,equalizer=f=3200:t=q:w=1.2:g=2,loudnorm=I=-16:TP=-1.5:LRA=11';

function base64ToWav(b64, outFile) {
  const raw = path.join(OUT, 'tts_raw.bin');
  fs.writeFileSync(raw, Buffer.from(b64, 'base64'));
  // Gemini TTS default: PCM 24kHz mono
  run('ffmpeg', ['-y', '-f', 's16le', '-ar', '24000', '-ac', '1', '-i', raw, '-ar', '44100', '-ac', '1', outFile]);
  fs.rmSync(raw, { force: true });
}

async function geminiTTS(settings, text, outFile) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY missing');
  const v = settings.voice;
  const prompt = text + '\n\n' + v.directors_notes;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${v.gemini_model}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: v.gemini_voice } } },
        },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini TTS HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = await res.json();
  const part = j.candidates?.[0]?.content?.parts?.[0];
  const b64 = part?.inlineData?.data || part?.inline_data?.data;
  if (!b64) throw new Error('Gemini TTS: audio nahi mila: ' + JSON.stringify(j).slice(0, 300));
  base64ToWav(b64, outFile);
}

async function openaiTTS(settings, text, outFile) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY missing');
  const v = settings.voice;
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: v.openai_model,
      voice: v.openai_voice,
      input: text,
      instructions: v.directors_notes,
      response_format: 'mp3',
      speed: 0.92,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI TTS HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const mp3 = path.join(OUT, 'tts_openai.mp3');
  fs.writeFileSync(mp3, buf);
  run('ffmpeg', ['-y', '-i', mp3, '-ar', '44100', '-ac', '1', outFile]);
  fs.rmSync(mp3, { force: true });
}

async function edgeTTS(settings, text, outFile) {
  const v = settings.voice;
  const mp3 = path.join(OUT, 'tts_edge.mp3');
  fs.rmSync(mp3, { force: true });
  const speak = text;
  const pitch = /^[+-]/.test(String(v.edge_pitch || '')) ? v.edge_pitch : `+${v.edge_pitch || '0Hz'}`;
  await run('python3', [
    '-m', 'edge_tts',
    `--voice=${v.edge_voice}`,
    `--rate=${v.edge_rate}`,
    `--pitch=${pitch}`,
    `--text=${speak}`,
    `--write-media=${mp3}`,
  ]);
  if (!fs.existsSync(mp3) || fs.statSync(mp3).size < 1000) throw new Error('edge-tts: empty output');
  run('ffmpeg', ['-y', '-i', mp3, '-af', HEAVY_EQ, '-ar', '44100', '-ac', '1', outFile]);
  fs.rmSync(mp3, { force: true });
}

// Google Translate TTS (bina key, Hindi ki sabse saaf free voice) — chunks me stitch
async function gtransTTS(settings, text, outFile) {
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
  const clean = text.replace(/\[pauses\]/g, '');
  const parts = clean.split(/(?<=[।?!])\s+/).map((s) => s.trim()).filter(Boolean);
  const chunks = [];
  for (let p of parts) {
    while (p.length > 170) {
      let cut = Math.max(p.lastIndexOf(',', 160), p.lastIndexOf(' ', 160));
      if (cut < 40) cut = 160;
      chunks.push(p.slice(0, cut).trim());
      p = p.slice(cut + 1).trim();
    }
    if (p) chunks.push(p);
  }
  const dir = path.join(OUT, 'gtrans');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const files = [];
  for (let i = 0; i < chunks.length; i++) {
    const u = 'https://translate.google.com/translate_tts?ie=UTF-8&tl=hi&client=tw-ob&q=' + encodeURIComponent(chunks[i]);
    let done = false;
    for (let a = 0; a < 3 && !done; a++) {
      const res = await fetch(u, { headers: { 'User-Agent': UA, Referer: 'https://translate.google.com/' } });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > 800) {
          const f = path.join(dir, `c${String(i).padStart(3, '0')}.mp3`);
          fs.writeFileSync(f, buf);
          files.push(f);
          done = true;
          break;
        }
      }
      await sleep(1500 * (a + 1));
    }
    if (!done) throw new Error(`gtrans chunk ${i} fail (${chunks.length} chunks)`);
    await sleep(280);
  }
  const list = path.join(dir, 'list.txt');
  fs.writeFileSync(list, files.map((f) => `file '${f}'`).join('\n'));
  run('ffmpeg', [
    '-y', '-f', 'concat', '-safe', '0', '-i', list,
    '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
    '-ar', '44100', '-ac', '1', outFile,
  ]);
}

// Piper offline Hindi male (Rohan) — no-key backup jab edge/gemini dono down ho
async function piperTTS(settings, text, outFile) {
  const cache = path.join(ROOT, '.piper-cache');
  const model = path.join(cache, 'hi_IN-rohan-medium.onnx');
  const cfgJson = model + '.json';
  if (!fs.existsSync(model) || !fs.existsSync(cfgJson) || fs.statSync(model).size < 1000000) {
    ensureDir(cache);
    info('    piper: Hindi male model download ho rahi hai (~63MB, sirf pehli baar)...');
    const base = 'https://huggingface.co/rhasspy/piper-voices/resolve/main/hi/hi_IN/rohan/medium/hi_IN-rohan-medium.onnx';
    run('curl', ['-sL', '--retry', '3', '-o', model, base]);
    run('curl', ['-sL', '--retry', '3', '-o', cfgJson, base + '.json']);
    if (fs.statSync(model).size < 1000000) throw new Error('piper model download failed');
  }
  try { run('python3', ['-c', 'import piper']); }
  catch { run('python3', ['-m', 'pip', 'install', '--quiet', '--break-system-packages', 'piper-tts']); }

  const raw = path.join(OUT, 'tts_piper_raw.wav');
  fs.rmSync(raw, { force: true });
  const ls = settings.voice.piper_length_scale || 1.1;
  runBash(`python3 -m piper -m ${JSON.stringify(model)} -f ${JSON.stringify(raw)} --length-scale ${ls} <<'PIPEREOF'\n${text}\nPIPEREOF`);
  if (!fs.existsSync(raw) || fs.statSync(raw).size < 1000) throw new Error('piper: empty output');
  run('ffmpeg', ['-y', '-i', raw, '-af', HEAVY_EQ, '-ar', '44100', '-ac', '1', outFile]);
  fs.rmSync(raw, { force: true });
}

export async function makeVoice(settings, scriptText) {
  ensureDir(OUT);
  const outFile = path.join(OUT, 'narration.wav');
  fs.rmSync(outFile, { force: true });

  const engines = { gemini: geminiTTS, gtrans: gtransTTS, openai: openaiTTS, edge: edgeTTS, piper: piperTTS };
  const errors = [];
  for (const name of settings.voice.priority) {
    try {
      info(`  TTS engine: ${name}`);
      await engines[name](settings, scriptText, outFile);
      const dur = ffprobeDuration(outFile);
      if (dur < 8) throw new Error(`voice too short: ${dur}s`);
      info(`  ${name} OK → narration.wav (${dur.toFixed(2)}s)`);
      return { file: outFile, duration: dur, engine: name };
    } catch (e) {
      info(`  ${name} failed: ${e.message}`);
      errors.push(`${name}: ${e.message}`);
      await sleep(1500);
    }
  }
  throw new Error('Sab TTS engines fail hue: ' + errors.join(' | '));
}
