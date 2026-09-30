// dp.mjs — Instagram DP (profile pic) resolution + bottom-left badge
// Chain: cookies (instagrapi) → Graph API → media-branch cache → repo assets
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, OUT, info, run, ensureDir, fetchBuffer, fetchJson } from './util.mjs';
import { repoSlug } from './upload.mjs';

const DP_FILE = () => path.join(OUT, 'dp.png');
const BADGE_FILE = () => path.join(OUT, 'badge.png');

function looksLikeImage(buf) {
  if (!buf || buf.length < 2000) return false;
  const png = buf[0] === 0x89 && buf[1] === 0x50;
  const jpg = buf[0] === 0xff && buf[1] === 0xd8;
  return png || jpg;
}

export async function resolveDP() {
  ensureDir(OUT);
  const dp = DP_FILE();
  fs.rmSync(dp, { force: true });

  // 1) Cookie session se direct Instagram (best quality, HD)
  if (process.env.IG_COOKIES) {
    try {
      run('python3', [path.join(ROOT, 'scripts', 'fetch_dp.py'), dp]);
      if (looksLikeImage(fs.readFileSync(dp))) {
        info('  DP: Instagram se mil gayi (cookie, HD) ✓');
        return dp;
      }
    } catch (e) {
      info(`  DP cookie path fail → fallback: ${String(e.message).slice(0, 140)}`);
    }
  }

  // 2) Graph API
  if (process.env.INSTAGRAM_ACCESS_TOKEN && process.env.IG_USER_ID) {
    try {
      const j = await fetchJson(
        `https://graph.facebook.com/v21.0/${process.env.IG_USER_ID}?fields=profile_picture_url&access_token=${process.env.INSTAGRAM_ACCESS_TOKEN}`,
      );
      if (j?.profile_picture_url) {
        const buf = await fetchBuffer(j.profile_picture_url, {}, 2);
        if (looksLikeImage(buf)) {
          fs.writeFileSync(dp, buf);
          info('  DP: Graph API se mil gayi ✓');
          return dp;
        }
      }
    } catch (e) {
      info(`  DP graph fail → fallback: ${String(e.message).slice(0, 120)}`);
    }
  }

  // 3) media branch cache (pichhli run me save ki thi)
  try {
    const url = `https://raw.githubusercontent.com/${repoSlug()}/media/dp.png`;
    const buf = await fetchBuffer(url, {}, 1);
    if (looksLikeImage(buf)) {
      fs.writeFileSync(dp, buf);
      info('  DP: media branch cache ✓');
      return dp;
    }
  } catch {
    /* 404 — pehli baar normal */
  }

  // 4) repo assets
  const local = path.join(ROOT, 'assets', 'dp.png');
  if (fs.existsSync(local) && fs.statSync(local).size > 2000) {
    fs.copyFileSync(local, dp);
    info('  DP: repo assets ✓');
    return dp;
  }

  info('  DP: kahin nahi mili — badge sirf @handle hoga (baad me cookie set karo to auto DP aayegi)');
  return null;
}

// Badge = circular DP + golden ring + golden @handle (har scene par)
export function makeBadge(settings, dpPath) {
  ensureDir(OUT);
  const font = path.join(ROOT, 'assets', 'fonts', 'NotoSansDevanagari-Bold.ttf');
  const handle = settings?.brand?.handle || '@sql.ssl';
  const out = BADGE_FILE();
  const args = [
    path.join(ROOT, 'scripts', 'make_badge.py'),
    '--out', out,
    '--font', font,
    '--handle', handle,
    '--size', String(settings?.brand?.dp_size || 150),
    '--fs', String(settings?.brand?.handle_size || 56),
  ];
  if (dpPath && fs.existsSync(dpPath)) args.push('--dp', dpPath);
  run('python3', args);
  if (!fs.existsSync(out)) throw new Error('badge PNG nahi bani');
  return out;
}
