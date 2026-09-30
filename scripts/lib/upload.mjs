// upload.mjs — STEP 7: media branch (public URL) + Instagram Graph API upload/publish
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ROOT, info, fetchJson, sleep, run, runBash, istDateStr } from './util.mjs';

export function repoSlug() {
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY;
  try {
    const url = run('git', ['-C', ROOT, 'remote', 'get-url', 'origin']).trim();
    const m = url.match(/github\.com[:/]([^/]+\/[^/.]+?)(?:\.git)?$/);
    if (m) return m[1];
  } catch {}
  return 'SQLRIZWAN/sqlssl-reel-automation';
}

// Video ko orphan "media" branch pe daal kar raw public URL deta hai (free hosting)
export function publishMediaBranch(videoPath, slot, dateStr) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    info('  GITHUB_TOKEN nahi hai → media branch skip (video sirf artifact)');
    return { ok: false, url: null };
  }
  const slug = repoSlug();
  const branch = process.env.MEDIA_BRANCH || 'media';
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'media-'));
  const base = `reel_${dateStr}_${slot}`;
  const fileName = `${base}.mp4`;
  const latestName = 'latest.mp4';

  try {
    run('git', ['init', '-q', '-b', 'main'], { cwd: tmp });
    run('git', ['config', 'user.email', 'reel-bot@users.noreply.github.com'], { cwd: tmp });
    run('git', ['config', 'user.name', 'sqlssl-reel-bot'], { cwd: tmp });
    fs.copyFileSync(videoPath, path.join(tmp, fileName));
    fs.copyFileSync(videoPath, path.join(tmp, latestName));
    fs.writeFileSync(path.join(tmp, 'meta.json'), JSON.stringify({ date: dateStr, slot, file: fileName, generated_at: new Date().toISOString() }, null, 2));
    run('git', ['add', '-A'], { cwd: tmp });
    run('git', ['commit', '-qm', `reel ${dateStr} ${slot}`], { cwd: tmp });
    run('git', ['push', '--force', `https://x-access-token:${token}@github.com/${slug}.git`, `main:${branch}`], { cwd: tmp });

    const url = `https://raw.githubusercontent.com/${slug}/${branch}/${fileName}`;
    const latest = `https://raw.githubusercontent.com/${slug}/${branch}/${latestName}`;
    info(`  media branch push OK → ${url}`);
    return { ok: true, url, latest };
  } catch (e) {
    info(`  media branch push failed: ${e.message}`);
    return { ok: false, url: null };
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
  }
}

export async function resolveIgUserId(token) {
  if (process.env.IG_USER_ID) return { userId: process.env.IG_USER_ID, discovered: false };
  // pages → instagram_business_account
  const me = await fetchJson('https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token&limit=10', {
    headers: { Authorization: `Bearer ${token}` },
  }, 2);
  const pages = me.data || [];
  if (!pages.length) throw new Error('Koi Facebook Page nahi mila (professional account linking check karo)');
  for (const p of pages) {
    try {
      const ig = await fetchJson(
        `https://graph.facebook.com/v21.0/${p.id}?fields=instagram_business_account{id,username}&access_token=${encodeURIComponent(p.access_token)}`,
        {}, 1
      );
      if (ig.instagram_business_account?.id) {
        return { userId: ig.instagram_business_account.id, username: ig.instagram_business_account.username, discovered: true };
      }
    } catch {}
  }
  throw new Error('Instagram professional account page se linked nahi hai');
}

async function waitForContainer(token, containerId, settings) {
  for (let i = 0; i < settings.upload.poll_tries; i++) {
    const j = await fetchJson(
      `https://graph.facebook.com/v21.0/${containerId}?fields=status_code,status&access_token=${encodeURIComponent(token)}`,
      {}, 1
    ).catch(() => null);
    if (j?.status_code === 'FINISHED') return j;
    if (j?.status_code === 'ERROR') throw new Error('Instagram container ERROR: ' + JSON.stringify(j));
    await sleep(settings.upload.poll_seconds * 1000);
  }
  throw new Error('Instagram container timeout (processing slow)');
}

export async function uploadToInstagram(settings, { videoUrl, caption, story = false }) {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!token) throw new Error('INSTAGRAM_ACCESS_TOKEN missing');
  const { userId } = await resolveIgUserId(token);
  info(`  IG user id: ${userId}`);

  // Reel container
  const container = await fetchJson(`https://graph.facebook.com/v21.0/${userId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      media_type: 'REELS',
      video_url: videoUrl,
      caption,
      share_to_feed: settings.upload.share_to_feed ? 'true' : 'false',
      access_token: token,
    }),
  }, 2);
  if (!container.id) throw new Error('Container create failed: ' + JSON.stringify(container).slice(0, 300));
  info(`  container: ${container.id} — processing...`);
  await waitForContainer(token, container.id, settings);

  const pub = await fetchJson(`https://graph.facebook.com/v21.0/${userId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ creation_id: container.id, access_token: token }),
  }, 2);
  info(`  REEL PUBLISHED ✓ id=${pub.id}`);

  let storyId = null;
  if (story) {
    try {
      const sc = await fetchJson(`https://graph.facebook.com/v21.0/${userId}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ media_type: 'STORIES', video_url: videoUrl, access_token: token }),
      }, 1);
      await waitForContainer(token, sc.id, settings);
      const sp = await fetchJson(`https://graph.facebook.com/v21.0/${userId}/media_publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ creation_id: sc.id, access_token: token }),
      }, 1);
      storyId = sp.id;
      info(`  STORY PUBLISHED ✓ id=${storyId}`);
    } catch (e) {
      info(`  story failed (non-fatal): ${e.message}`);
    }
  }

  return { reelId: pub.id, storyId, userId };
}

// Cookie-based upload (Instagram web session — user ki pasand) — instagrapi
export function uploadViaCookie(videoPath, caption) {
  const raw = (process.env.IG_COOKIES || '').trim();
  if (!raw) throw new Error('IG_COOKIES missing');
  if (!fs.existsSync(videoPath)) throw new Error('video file not found: ' + videoPath);
  const capFile = path.join(path.dirname(videoPath), 'cookie_caption.txt');
  fs.writeFileSync(capFile, caption, 'utf8');
  const out = run('python3', [path.join(ROOT, 'scripts', 'upload_ig.py'), videoPath, capFile]);
  const m = out.match(/REEL_PUBLISHED id=(\S+) code=(\S+) user=(\S+)/);
  if (!m) throw new Error('cookie upload: REEL_PUBLISHED line nahi mili: ' + out.slice(-500));
  return { reelId: m[1], code: m[2], username: m[3], via: 'cookie' };
}
