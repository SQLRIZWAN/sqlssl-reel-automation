// util.mjs — shared helpers (fetch, ffmpeg, logging)
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const OUT = path.join(ROOT, 'output');
export const CFG_DIR = path.join(ROOT, 'config');

export function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
  return p;
}

let stepNo = 0;
export function step(name) {
  stepNo += 1;
  const line = `[STEP ${stepNo}] ${name}`;
  console.log(`\n=== ${line} ===`);
  appendLog(line);
  return Date.now();
}

export function done(t0, extra = '') {
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`--- done in ${secs}s ${extra}`);
  appendLog(`    done in ${secs}s ${extra}`);
}

export function info(msg) {
  console.log(msg);
  appendLog(`    ${msg}`);
}

export function appendLog(line) {
  try {
    ensureDir(OUT);
    fs.appendFileSync(path.join(OUT, 'pipeline.log'), line + '\n');
  } catch {}
}

export function loadJSON(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

export function loadSettings() {
  return loadJSON(path.join(CFG_DIR, 'settings.json'));
}

export function saveJSON(p, obj) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
}

export function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { encoding: 'utf8', ...opts });
  if (res.status !== 0) {
    const err = (res.stderr || '') + (res.stdout || '');
    throw new Error(`Command failed (${cmd} ${args.join(' ')}): ${err.slice(-2000)}`);
  }
  return res.stdout || '';
}

export function runBash(script, opts = {}) {
  const res = spawnSync('bash', ['-c', script], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts });
  if (res.status !== 0) {
    throw new Error(`Bash failed: ${((res.stderr || '') + (res.stdout || '')).slice(-3000)}`);
  }
  return res.stdout || '';
}

export function ffprobeDuration(file) {
  const out = execFileSync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1', file
  ], { encoding: 'utf8' }).trim();
  return parseFloat(out);
}

export async function fetchJson(url, opts = {}, tries = 3) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { redirect: 'follow', ...opts });
      if (!res.ok) {
        const body = (await res.text().catch(() => '')).slice(0, 500);
        lastErr = new Error(`HTTP ${res.status} for ${url.slice(0, 120)}: ${body}`);
        if (res.status >= 500 || res.status === 429) {
          await sleep(1500 * (i + 1));
          continue;
        }
        throw lastErr;
      }
      return await res.json();
    } catch (e) {
      lastErr = e;
      await sleep(1200 * (i + 1));
    }
  }
  throw lastErr;
}

export async function fetchText(url, opts = {}, tries = 3) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { redirect: 'follow', ...opts });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url.slice(0, 120)}`);
      return await res.text();
    } catch (e) {
      lastErr = e;
      await sleep(1200 * (i + 1));
    }
  }
  throw lastErr;
}

export async function fetchBuffer(url, opts = {}, tries = 3) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { redirect: 'follow', ...opts });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url.slice(0, 120)}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 1024) throw new Error(`Response too small (${buf.length} bytes)`);
      return buf;
    } catch (e) {
      lastErr = e;
      await sleep(2000 * (i + 1));
    }
  }
  throw lastErr;
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function istNow() {
  // IST = UTC+5:30
  const d = new Date(Date.now() + (5.5 * 60 - new Date().getTimezoneOffset()) * 60000);
  return d;
}

export function istDateStr(d = new Date()) {
  const shifted = new Date(d.getTime() + (5.5 * 60 - d.getTimezoneOffset()) * 60000);
  return shifted.toISOString().slice(0, 10);
}

export function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function hasDevanagari(text) {
  return /[\u0900-\u097F]/.test(text);
}
