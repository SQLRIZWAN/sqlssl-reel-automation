// tts.mjs — STEP 2: Gemini TTS (Rasalgethi) → OpenAI TTS → Edge TTS fallback
import fs from 'node:fs';
import path from 'node:path';
import { OUT, info, run, ffprobeDuration, ensureDir, sleep } from './util.mjs';

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
          speechConfig: { prebuiltVoiceConfig: { voiceName: v.gemini_voice } },
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
  await run('python3', [
    '-m', 'edge_tts',
    `--voice=${v.edge_voice}`,
    `--rate=${v.edge_rate}`,
    `--pitch=${v.edge_pitch}`,
    `--text=${speak}`,
    `--write-media=${mp3}`,
  ]);
  if (!fs.existsSync(mp3) || fs.statSync(mp3).size < 1000) throw new Error('edge-tts: empty output');
  run('ffmpeg', ['-y', '-i', mp3, '-ar', '44100', '-ac', '1', outFile]);
  fs.rmSync(mp3, { force: true });
}

export async function makeVoice(settings, scriptText) {
  ensureDir(OUT);
  const outFile = path.join(OUT, 'narration.wav');
  fs.rmSync(outFile, { force: true });

  const engines = { gemini: geminiTTS, openai: openaiTTS, edge: edgeTTS };
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
