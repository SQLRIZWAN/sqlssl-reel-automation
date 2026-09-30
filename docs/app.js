/* SQL.SSL Reel Bot — Control Panel (sara kaam localStorage me) */
const LS_KEY = 'sqlssl_cfg_v1';
const REPO_DEFAULT = 'SQLRIZWAN/sqlssl-reel-automation';
const RAW_BASE = () => {
  const r = cfg.repo || REPO_DEFAULT;
  return `https://raw.githubusercontent.com/${r}/main`;
};

const defaults = {
  repo: REPO_DEFAULT,
  ghToken: '',
  ig: { appId: '', appSecret: '', redirect: '', scope: 'instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement,business_management', token: '', userId: '', username: '' },
  oa: { key: '' },
  gm: { key: '' },
  pol: { token: '' },
  news: { key: '' },
  extra: {},
  schedule: { morning: '04:00', evening: '16:00' },
  promptText: '',
  activeTab: 'dash',
};

let cfg = loadCfg();

function loadCfg() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return { ...structuredClone(defaults), ...JSON.parse(raw) };
  } catch {}
  return structuredClone(defaults);
}
function saveCfg(msg) {
  localStorage.setItem(LS_KEY, JSON.stringify(cfg));
  const el = document.getElementById('saveState');
  if (el) el.textContent = '💾 saved ' + new Date().toLocaleTimeString();
  if (msg) log('syncLog', '💾 ' + msg);
}
function log(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.display = 'block';
  el.textContent += (el.textContent && el.textContent !== 'Ready.' ? '\n' : '') + msg;
  el.scrollTop = el.scrollHeight;
}
function stars(n) { return '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n); }

/* ───────────── Tabs ───────────── */
document.querySelectorAll('.tab').forEach((b) => {
  b.addEventListener('click', () => activateTab(b.dataset.tab));
});
function activateTab(name) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('active', p.id === 'panel-' + name));
  cfg.activeTab = name;
  localStorage.setItem(LS_KEY, JSON.stringify(cfg));
}

/* ───────────── Dashboard ───────────── */
function istToUtcCron(t) {
  const [h, m] = t.split(':').map(Number);
  const tot = ((h * 60 + m - 330) % 1440 + 1440) % 1440;
  return `${tot % 60} ${Math.floor(tot / 60)} * * *`;
}
function nextRunIst(cron) {
  const [m, h] = cron.split(/\s+/).map(Number);
  const now = new Date();
  const utc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), h, m, 0));
  if (utc <= now) utc.setUTCDate(utc.getUTCDate() + 1);
  const ist = new Date(utc.getTime() + 5.5 * 3600 * 1000);
  return ist.toLocaleString('hi-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + ' IST';
}
function refreshDashboard() {
  const cm = istToUtcCron(cfg.schedule.morning);
  const ce = istToUtcCron(cfg.schedule.evening);
  document.getElementById('nextMorning').textContent = nextRunIst(cm);
  document.getElementById('nextEvening').textContent = nextRunIst(ce);
  document.querySelectorAll('#panel-schedule .muted')[0];

  const ig = document.getElementById('igStatus');
  if (cfg.ig.token) { ig.textContent = '✅ ' + (cfg.ig.username || 'connected'); ig.style.color = '#2bff88'; }
  else { ig.textContent = '❌ नहीं जुड़ा'; ig.style.color = '#ff8fa3'; }

  const llm = document.getElementById('llmStatus');
  const engines = [];
  if (cfg.oa.key) engines.push('OpenAI');
  if (cfg.gm.key) engines.push('Gemini');
  llm.textContent = engines.length ? '✅ ' + engines.join(' + ') : '🟢 Free fallback (edge-tts + template)';
  llm.style.color = engines.length ? '#2bff88' : '#ffcc4d';

  const igP = document.getElementById('igPill');
  igP.textContent = cfg.ig.token ? '✅ connected' : 'not connected';
  igP.className = 'status' + (cfg.ig.token ? ' ok' : '');
  const oaP = document.getElementById('oaPill');
  if (oaP) {
    oaP.textContent = cfg.oa.key ? '✅ key saved' : 'not connected';
    oaP.className = 'status' + (cfg.oa.key ? ' ok' : '');
  }
  const gmP = document.getElementById('gmPill');
  gmP.textContent = cfg.gm.key ? '✅ फ्री key सेव है' : 'not connected';
  gmP.className = 'status' + (cfg.gm.key ? ' ok' : '');
  const igP2 = document.getElementById('igPill2');
  if (igP2) {
    igP2.textContent = cfg.ig.token ? '✅ जुड़ गया' : '⚠️ जोड़ना बाकी';
    igP2.className = 'status' + (cfg.ig.token ? ' ok' : '');
  }
  const gmH = document.getElementById('gmSavedHint');
  if (gmH) gmH.textContent = cfg.gm.key ? '✓ सेव है' : '';
  const oaH = document.getElementById('oaSavedHint');
  if (oaH) oaH.textContent = cfg.oa.key ? '✓ सेव है' : '';
}

function updateHero(pending) {
  const t = document.getElementById('heroTitle');
  const s = document.getElementById('heroSub');
  const h = document.getElementById('hero');
  if (!t) return;
  if (pending > 0) {
    h.className = 'hero pending';
    t.textContent = `⚠️ सेटअप बाकी है — ${pending} काम (${cfg.ig.token ? 'नीचे checklist देखो' : 'पहले Instagram जोड़ो'})`;
    s.textContent = 'एक बार पूरा हो जाए तो रोज़ 2 रील अपने आप बनकर Instagram पर चली जाएँगी — ये page खोलने की भी ज़रूरत नहीं।';
  } else {
    h.className = 'hero ok';
    t.textContent = '✅ सब कुछ तैयार है — 0-click automation चालू';
    s.textContent = 'रोज़ 2 रील अपने आप बनेंगी और Instagram पर upload होंगी। इस page को अब खोलने की ज़रूरत नहीं।';
  }
}

async function loadRuns() {
  const list = document.getElementById('runsList');
  const hint = document.getElementById('runsHint');
  list.innerHTML = '<p class="muted">Loading...</p>';
  try {
    const r = await ghApi(`/repos/${cfg.repo}/actions/runs?per_page=8`);
    hint.style.display = 'none';
    const runs = r.workflow_runs || [];
    list.innerHTML = runs.map((x) => `
      <div class="run">
        <span class="st ${x.status === 'completed' ? x.conclusion : x.status}">${x.status === 'completed' ? x.conclusion : x.status}</span>
        <span>${esc(x.display_title || x.name)}</span>
        <span class="muted">${new Date(x.created_at).toLocaleString('hi-IN')}</span>
        <a href="${x.html_url}" target="_blank">खोलो →</a>
      </div>`).join('') || '<p class="muted">कोई run नहीं</p>';
  } catch (e) {
    list.innerHTML = '';
    hint.style.display = 'block';
    hint.textContent = 'Runs नहीं आईं: ' + e.message + (cfg.ghToken ? '' : ' (public repo पर बिना token भी चलनी चाहिए — rate limit हो सकता है)');
  }
}
document.getElementById('refreshRuns').addEventListener('click', loadRuns);

async function loadLatestVideo() {
  const el = document.getElementById('latestVideo');
  const vid = document.getElementById('latestVideoEl');
  try {
    const c = await ghApi(`/repos/${cfg.repo}/commits/media`);
    const fname = (c.files || []).map((f) => f.filename).find((n) => n.endsWith('.mp4')) || 'latest.mp4';
    const url = `https://raw.githubusercontent.com/${cfg.repo}/media/${fname}`;
    el.innerHTML = `<a href="${url}" target="_blank">⬇️ ${esc(fname)} डाउनलोड</a> — ${new Date(c.commit.author.date).toLocaleString('hi-IN')}`;
    if (vid) {
      vid.src = url;
      vid.classList.add('on');
    }
  } catch (e) {
    el.textContent = 'अभी कोई video नहीं बनी — पहली run के बाद यहाँ दिखेगी।';
    if (vid) { vid.removeAttribute('src'); vid.classList.remove('on'); }
  }
}

/* ───────────── Setup checklist (0-click ka status) ───────────── */
function renderChecklist() {
  const el = document.getElementById('checklist');
  if (!el) return;
  const items = [];
  items.push({ ok: !!cfg.ghToken, t: 'GitHub Token', d: cfg.ghToken ? 'सेव है' : 'Sync टैब में PAT डालो (repo+workflow scope)' });
  items.push({ ok: !!cfg.ig.token, t: 'Instagram Connect', d: cfg.ig.token ? `जुड़ा है (${cfg.ig.username || 'token सेव'})` : 'कनेक्शन टैब → Instagram Connect (website login + allow)' });
  const ai = [cfg.oa.key ? 'OpenAI' : '', cfg.gm.key ? 'Gemini' : ''].filter(Boolean);
  items.push({ ok: ai.length > 0, warn: ai.length === 0, t: 'AI Keys (script/voice/images)', d: ai.length ? ai.join(' + ') + ' सेव है' : 'कनेक्शन टैब से Gemini/OpenAI key जोड़ो (फ्री) — बिना key भी free fallback चलता है' });
  const dirty = cfg.syncedAt && (cfg.keysDirty || false);
  const synced = !!cfg.syncedAt && !dirty;
  items.push({ ok: synced, t: 'Secrets → GitHub Sync', d: synced ? `सिंक हो चुका (${new Date(cfg.syncedAt).toLocaleString('hi-IN')})` : cfg.syncedAt ? 'keys बदलीं — दोबारा "सब सिंक करो" दबाओ' : 'नीचे "सब सिंक करो" एक बार दबाओ — बस, फिर सब automatic' });
  items.push({ ok: true, warn: false, t: 'Automation (cron)', d: `चालू — हर दिन ${cfg.schedule.morning} + ${cfg.schedule.evening} IST पर 2 reel, बिना website खोले` });
  el.innerHTML = items.map((i) => `
    <div class="check ${i.ok ? 'done' : (i.warn ? 'warn' : 'todo')}">
      <span class="mark">${i.ok ? '✅' : (i.warn ? '⚠️' : '⬜')}</span>
      <b>${i.t}</b> — ${i.d}
    </div>`).join('');
  updateHero(items.filter((i) => !i.ok).length);
}

document.getElementById('checkRefresh').addEventListener('click', () => { renderChecklist(); loadRuns(); loadLatestVideo(); });
document.getElementById('checkSyncAll').addEventListener('click', () => {
  activateTab('sync');
  document.getElementById('syncAll').click();
});
document.getElementById('checkTestRun').addEventListener('click', async () => {
  const logEl = 'checkLog';
  log(logEl, '▶️ Test run dispatch ho raha hai...');
  try {
    await ghApi(`/repos/${cfg.repo}/actions/workflows/reel.yml/dispatches`, {
      method: 'POST',
      body: JSON.stringify({ ref: 'main', inputs: { slot: 'auto', mode: 'full' } }),
    });
    log(logEl, '✅ Dispatch OK — Actions टैब में देखो (1-2 मिनट में शुरू)');
    setTimeout(loadRuns, 5000);
  } catch (e) {
    log(logEl, '❌ ' + e.message);
  }
});

/* ───────────── GitHub API helper ───────────── */
async function ghApi(path, opts = {}) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    ...(opts.headers || {}),
  };
  if (cfg.ghToken) headers.Authorization = `Bearer ${cfg.ghToken}`;
  const res = await fetch('https://api.github.com' + path, { ...opts, headers });
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.status === 204 ? null : res.json();
}
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

/* ───────────── Instagram connect (redirect OAuth) ───────────── */
function fillIgFields() {
  document.getElementById('fbAppId').value = cfg.ig.appId || '1059718326900705';
  document.getElementById('fbAppSecret').value = cfg.ig.appSecret;
  document.getElementById('fbRedirect').value = cfg.ig.redirect || (location.origin + location.pathname);
  document.getElementById('fbScope').value = cfg.ig.scope;
  document.getElementById('igTokenManual').value = cfg.ig.token;
  document.getElementById('igUserManual').value = cfg.ig.userId;
  document.getElementById('oaKey').value = cfg.oa.key;
  document.getElementById('gmKey').value = cfg.gm.key;
  document.getElementById('ghToken').value = cfg.ghToken;
  document.getElementById('ghRepo').value = cfg.repo;
  document.getElementById('slotMorning').value = cfg.schedule.morning;
  document.getElementById('slotEvening').value = cfg.schedule.evening;
  updateCronPreview();
}
function igFieldsFromForm() {
  cfg.ig.appId = document.getElementById('fbAppId').value.trim() || '1059718326900705';
  cfg.ig.appSecret = document.getElementById('fbAppSecret').value.trim();
  cfg.ig.redirect = document.getElementById('fbRedirect').value.trim() || (location.origin + location.pathname);
  cfg.ig.scope = document.getElementById('fbScope').value.trim();
}
document.getElementById('igConnect').addEventListener('click', () => {
  igFieldsFromForm();
  if (!cfg.ig.appId) return log('igLog', '❌ Pehle Facebook App ID daalo (developers.facebook.com → My Apps)');
  saveCfg();
  const url = 'https://www.facebook.com/v21.0/dialog/oauth?' + new URLSearchParams({
    client_id: cfg.ig.appId,
    redirect_uri: cfg.ig.redirect,
    scope: cfg.ig.scope,
    state: 'igconnect',
  });
  log('igLog', '↪️ Redirect ho raha hai Facebook/Meta authorize page par...');
  location.href = url;
});
async function handleIgCallback() {
  const p = new URLSearchParams(location.search);
  if (p.get('state') !== 'igconnect' || !p.get('code')) return false;
  const code = p.get('code');
  history.replaceState(null, '', location.pathname);
  log('igLog', '🔄 Code mila — token exchange ho raha hai...');
  try {
    igFieldsFromForm();
    let u = 'https://graph.facebook.com/v21.0/oauth/access_token?' + new URLSearchParams({
      client_id: cfg.ig.appId, redirect_uri: cfg.ig.redirect, client_secret: cfg.ig.appSecret, code,
    });
    let r = await (await fetch(u)).json();
    if (r.error) throw new Error(r.error.message);
    const shortTok = r.access_token;
    u = 'https://graph.facebook.com/v21.0/oauth/access_token?' + new URLSearchParams({
      grant_type: 'fb_exchange_token', client_id: cfg.ig.appId, client_secret: cfg.ig.appSecret, fb_exchange_token: shortTok,
    });
    r = await (await fetch(u)).json();
    if (r.error) throw new Error(r.error.message);
    cfg.keysDirty = true;
    cfg.ig.token = r.access_token;
    log('igLog', '✅ Long-lived token mila — Instagram user dhoond rahe hain...');
    // pages → instagram business account
    const pages = await (await fetch(`https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token&access_token=${encodeURIComponent(cfg.ig.token)}`)).json();
    for (const pg of pages.data || []) {
      const j = await (await fetch(`https://graph.facebook.com/v21.0/${pg.id}?fields=instagram_business_account{id,username}&access_token=${encodeURIComponent(pg.access_token)}`)).json();
      if (j.instagram_business_account?.id) {
        cfg.ig.userId = j.instagram_business_account.id;
        cfg.ig.username = j.instagram_business_account.username || '';
        break;
      }
    }
    saveCfg();
    if (cfg.ig.userId) {
      log('igLog', `✅ INSTAGRAM CONNECTED ✓ user=${cfg.ig.username || cfg.ig.userId}`);
      log('igLog', '🔁 Apne aap: secrets sync + pehli reel upload run...');
      setTimeout(async () => {
        try {
          if (!cfg.ghToken) { log('igLog', '⚠️ Sync टैब में GitHub PAT डालो → "सब सिंक करो" — uske baad upload chalega'); return; }
          await syncAll();
          await ghApi(`/repos/${cfg.repo}/actions/workflows/reel.yml/dispatches`, {
            method: 'POST',
            body: JSON.stringify({ ref: 'main', inputs: { slot: 'auto', mode: 'full' } }),
          });
          log('igLog', '🎬 UPLOAD RUN CHALU — 10-12 min me reel Instagram par! (स्टेटस टैब में देखो)');
          setTimeout(loadRuns, 6000);
        } catch (e) { log('igLog', '❌ auto-sync fail: ' + e.message); }
      }, 900);
    } else {
      log('igLog', '⚠️ Token mila, par Instagram professional account Facebook Page se linked nahi mila.');
    }
  } catch (e) {
    log('igLog', '❌ Exchange fail: ' + e.message);
    log('igLog', '💡 Backup: address bar me ?code=... wala URL copy karke chat me paste karo — main khud exchange kar dunga. Ya Graph API Explorer se token banao.');
  }
  refreshDashboard();
  return true;
}
document.getElementById('igTest').addEventListener('click', async () => {
  const tok = document.getElementById('igTokenManual').value.trim() || cfg.ig.token;
  if (!tok) return log('igLog', '❌ Token nahi hai');
  try {
    const j = await (await fetch(`https://graph.facebook.com/v21.0/me?fields=id,username&access_token=${encodeURIComponent(tok)}`)).json();
    if (j.error) throw new Error(j.error.message);
    cfg.keysDirty = true;
    cfg.ig.token = tok;
    cfg.ig.userId = cfg.ig.userId || j.id;
    saveCfg();
    log('igLog', `✅ Token VALID — @${j.username || j.id} (localStorage me save)`);
  } catch (e) { log('igLog', '❌ ' + e.message); }
  refreshDashboard();
});
document.getElementById('igSaveManual').addEventListener('click', () => {
  cfg.keysDirty = true;
  cfg.ig.token = document.getElementById('igTokenManual').value.trim();
  cfg.ig.userId = document.getElementById('igUserManual').value.trim();
  saveCfg('Instagram token localStorage me save');
  log('igLog', '💾 Save ho gaya — "सिंक" tab se GitHub Secrets me daal do.');
  refreshDashboard();
});
document.getElementById('igDisconnect').addEventListener('click', () => {
  cfg.ig.token = ''; cfg.ig.userId = ''; cfg.ig.username = '';
  saveCfg(); log('igLog', '❌ Disconnected'); fillIgFields(); refreshDashboard();
});

/* ───────────── OpenAI connect (redirect) ───────────── */
document.getElementById('oaConnect').addEventListener('click', () => {
  sessionStorage.setItem('oa_return', '1');
  log('oaLog', '↪️ OpenAI API Keys page redirect — key banao, copy karo, wapas is page par aake paste karo.');
  window.open('https://platform.openai.com/api-keys', '_blank');
});
window.addEventListener('pageshow', () => {
  if (sessionStorage.getItem('oa_return')) {
    sessionStorage.removeItem('oa_return');
    log('oaLog', '👋 Wapas swagat hai! Upar API key field me key paste karo aur "key टेस्ट करो" dabao.');
    const el = document.getElementById('oaKey');
    if (el) { el.focus(); el.select && el.select(); }
  }
});
document.getElementById('oaKey').addEventListener('change', (e) => {
  cfg.oa.key = e.target.value.trim(); cfg.keysDirty = true; saveCfg('OpenAI key save'); refreshDashboard(); renderChecklist();
});
document.getElementById('oaTest').addEventListener('click', async () => {
  const k = document.getElementById('oaKey').value.trim() || cfg.oa.key;
  if (!k) return log('oaLog', '❌ Key nahi hai');
  try {
    const r = await fetch('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${k}` } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    cfg.oa.key = k; saveCfg(); refreshDashboard();
    log('oaLog', '✅ OpenAI key VALID ✓ (save ho gaya)');
  } catch (e) { log('oaLog', '❌ ' + e.message); }
});
document.getElementById('oaDisconnect').addEventListener('click', () => { cfg.oa.key = ''; saveCfg(); fillIgFields(); refreshDashboard(); log('oaLog', '❌ Disconnected'); });

/* ───────────── Gemini connect ───────────── */
document.getElementById('gmRedirect').addEventListener('click', () => {
  log('gmLog', '↪️ AI Studio redirect — free key banao (Create API key), copy karo aur paste karo.');
  window.open('https://aistudio.google.com/apikey', '_blank');
  const el = document.getElementById('gmKey');
  setTimeout(() => el && el.focus(), 400);
});
document.getElementById('gmKey').addEventListener('change', (e) => { cfg.gm.key = e.target.value.trim(); cfg.keysDirty = true; saveCfg('Gemini key save'); refreshDashboard(); renderChecklist(); });
document.getElementById('gmTest').addEventListener('click', async () => {
  const k = document.getElementById('gmKey').value.trim() || cfg.gm.key;
  if (!k) return log('gmLog', '❌ Key nahi hai');
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=1&key=${encodeURIComponent(k)}`);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    cfg.gm.key = k; saveCfg(); refreshDashboard();
    log('gmLog', '✅ Gemini key VALID ✓ — Rasalgethi TTS + script dono chalenge (free tier)');
  } catch (e) { log('gmLog', '❌ ' + e.message); }
});
document.getElementById('gmDisconnect').addEventListener('click', () => { cfg.gm.key = ''; saveCfg(); fillIgFields(); refreshDashboard(); log('gmLog', '❌ Disconnected'); });

/* ───────────── Free APIs table ───────────── */
const API_FALLBACK = [
  { id: 'github-actions', name: 'GitHub Actions', purpose: 'Daily 2 baar pipeline khud chalata hai', category: 'Automation', importance: 5, free_tier: 'Public repo pe unlimited free', key_required: false, key_env: '', docs: 'https://docs.github.com/en/actions', status: 'inbuilt' },
  { id: 'github-pages', name: 'GitHub Pages', purpose: 'Ye control website live karna', category: 'Hosting', importance: 5, free_tier: '100GB bandwidth/month free', key_required: false, key_env: '', docs: 'https://pages.github.com', status: 'inbuilt' },
  { id: 'instagram-graph', name: 'Instagram Graph API', purpose: 'Reel auto upload/publish', category: 'Upload', importance: 5, free_tier: '100% free', key_required: true, key_env: 'INSTAGRAM_ACCESS_TOKEN', docs: 'https://developers.facebook.com/docs/instagram-api', status: 'required' },
  { id: 'google-news-rss', name: 'Google News RSS (STEP 0)', purpose: 'Aaj ki LIVE cyber news — bina key', category: 'News', importance: 5, free_tier: '100% free, no key', key_required: false, key_env: '', docs: 'https://news.google.com/rss', status: 'inbuilt' },
  { id: 'pollinations', name: 'Pollinations.ai (STEP 3)', purpose: '18-25 anime images 1080x1920', category: 'Images', importance: 5, free_tier: 'Free — 1 req/15s (token se 1/5s)', key_required: false, key_env: 'POLLINATIONS_TOKEN', docs: 'https://image.pollinations.ai', status: 'inbuilt' },
  { id: 'edge-tts', name: 'Edge TTS (STEP 2 fallback)', purpose: 'Hindi male voice (MadhurNeural)', category: 'Voice', importance: 4, free_tier: '100% free, no key', key_required: false, key_env: '', docs: 'https://pypi.org/project/edge-tts/', status: 'inbuilt' },
  { id: 'gemini-tts', name: 'Gemini TTS — Rasalgethi (STEP 2)', purpose: 'Prompt-file fixed voice + Director Notes', category: 'Voice', importance: 5, free_tier: 'AI Studio free tier', key_required: true, key_env: 'GEMINI_API_KEY', docs: 'https://aistudio.google.com/apikey', status: 'optional' },
  { id: 'gemini-llm', name: 'Gemini LLM (STEP 1 + 4)', purpose: 'Script, moments, caption, hashtags', category: 'Script', importance: 5, free_tier: 'Free tier (daily limit)', key_required: true, key_env: 'GEMINI_API_KEY', docs: 'https://aistudio.google.com/apikey', status: 'optional' },
  { id: 'openai', name: 'OpenAI API', purpose: 'Best quality script/voice/images', category: 'Script/Voice/Images', importance: 5, free_tier: 'Paid API — optional', key_required: true, key_env: 'OPENAI_API_KEY', docs: 'https://platform.openai.com/api-keys', status: 'optional' },
  { id: 'ffmpeg', name: 'FFmpeg', purpose: 'Ken Burns, overlay, mix, final MP4', category: 'Video Engine', importance: 5, free_tier: '100% free (Actions me built-in)', key_required: false, key_env: '', docs: 'https://ffmpeg.org', status: 'inbuilt' },
  { id: 'newsapi', name: 'NewsAPI.org', purpose: 'Backup news source', category: 'News', importance: 2, free_tier: '100 req/day free', key_required: true, key_env: 'NEWSAPI_KEY', docs: 'https://newsapi.org', status: 'optional' },
];
function secretFor(env) {
  if (env === 'OPENAI_API_KEY') return cfg.oa.key;
  if (env === 'GEMINI_API_KEY') return cfg.gm.key;
  if (env === 'INSTAGRAM_ACCESS_TOKEN') return cfg.ig.token;
  if (env === 'IG_USER_ID') return cfg.ig.userId;
  if (env === 'POLLINATIONS_TOKEN') return cfg.pol.token;
  if (env === 'NEWSAPI_KEY') return cfg.news.key;
  return cfg.extra[env] || '';
}
function setSecretFor(env, v) {
  if (env === 'OPENAI_API_KEY') cfg.oa.key = v;
  else if (env === 'GEMINI_API_KEY') cfg.gm.key = v;
  else if (env === 'INSTAGRAM_ACCESS_TOKEN') cfg.ig.token = v;
  else if (env === 'IG_USER_ID') cfg.ig.userId = v;
  else if (env === 'POLLINATIONS_TOKEN') cfg.pol.token = v;
  else if (env === 'NEWSAPI_KEY') cfg.news.key = v;
  else cfg.extra[env] = v;
}
async function renderApis() {
  let apis = API_FALLBACK;
  try {
    const r = await fetch(`${RAW_BASE()}/config/apis.json?nocache=${Date.now()}`);
    if (r.ok) apis = (await r.json()).apis;
  } catch {}
  const host = document.getElementById('apiTable');
  host.innerHTML = `<table><thead><tr>
    <th>API</th><th>क्या करती है</th><th>कितनी ज़रूरी</th><th>Free Tier</th><th>स्थिति</th><th>Key / Token</th></tr></thead><tbody>
    ${apis.map((a) => `<tr>
      <td><b>${esc(a.name)}</b><br><span class="muted">${esc(a.category)}</span><br><a class="muted" href="${a.docs}" target="_blank">docs →</a></td>
      <td>${esc(a.purpose)}</td>
      <td class="stars" title="${a.importance}/5">${stars(a.importance)}</td>
      <td class="muted">${esc(a.free_tier)}</td>
      <td><span class="tag ${a.key_required ? 'need' : 'free'}">${a.key_required ? 'key चाहिए' : 'बिना key'}</span>
          <span class="tag ${a.status === 'optional' ? 'opt' : ''}">${a.status}</span></td>
      <td>${a.key_env ? `<input data-env="${a.key_env}" placeholder="${a.key_env}" value="${esc(secretFor(a.key_env))}"><button class="btn" data-saveenv="${a.key_env}">💾</button>` : '<span class="muted">—</span>'}</td>
    </tr>`).join('')}
  </tbody></table>`;

  host.querySelectorAll('[data-saveenv]').forEach((b) => {
    b.addEventListener('click', () => {
      const env = b.dataset.saveenv;
      const inp = host.querySelector(`input[data-env="${env}"]`);
      setSecretFor(env, inp.value.trim());
      saveCfg(env + ' save ho gaya (localStorage)');
      b.textContent = '✓';
      setTimeout(() => (b.textContent = '💾'), 1200);
      refreshDashboard();
    });
  });
}

/* ───────────── Schedule ───────────── */
function updateCronPreview() {
  const m = document.getElementById('slotMorning').value || '04:00';
  const e = document.getElementById('slotEvening').value || '16:00';
  document.getElementById('cronMorning').textContent = istToUtcCron(m);
  document.getElementById('cronEvening').textContent = istToUtcCron(e);
  document.getElementById('cronMorningNote').textContent = '= ' + m + ' IST';
  document.getElementById('cronEveningNote').textContent = '= ' + e + ' IST';
}
document.getElementById('slotMorning').addEventListener('input', updateCronPreview);
document.getElementById('slotEvening').addEventListener('input', updateCronPreview);
document.getElementById('saveSchedule').addEventListener('click', () => {
  cfg.schedule.morning = document.getElementById('slotMorning').value || '04:00';
  cfg.schedule.evening = document.getElementById('slotEvening').value || '16:00';
  saveCfg('शेड्यूल save: ' + cfg.schedule.morning + ' + ' + cfg.schedule.evening + ' IST');
  updateCronPreview(); refreshDashboard();
});
document.getElementById('applyBestTime').addEventListener('click', () => {
  document.getElementById('slotMorning').value = '07:30';
  document.getElementById('slotEvening').value = '19:30';
  updateCronPreview();
  log('syncLog', '✨ Best time loaded (07:30 + 19:30 IST) — "शेड्यूल सेव करो" dabao, phir सिंक.');
});

/* ───────────── Prompt file ───────────── */
document.getElementById('loadPrompt').addEventListener('click', async () => {
  try {
    const r = await fetch(`${RAW_BASE()}/SQL.SSL.2027.TXT?nocache=${Date.now()}`);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const t = await r.text();
    document.getElementById('promptText').value = t;
    cfg.promptText = t; saveCfg('प्रॉम्प्ट फाइल load + save');
  } catch (e) { alert('Load fail: ' + e.message); }
});
document.getElementById('savePrompt').addEventListener('click', () => {
  cfg.promptText = document.getElementById('promptText').value;
  saveCfg('प्रॉम्प्ट localStorage me save');
});
document.getElementById('dlPrompt').addEventListener('click', () => {
  const blob = new Blob([document.getElementById('promptText').value], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'SQL.SSL.2027.TXT';
  a.click();
});

/* ───────────── GitHub Sync ───────────── */
document.getElementById('ghToken').addEventListener('change', (e) => { cfg.ghToken = e.target.value.trim(); saveCfg('GitHub token save'); loadRuns(); });
document.getElementById('ghRepo').addEventListener('change', (e) => { cfg.repo = e.target.value.trim() || REPO_DEFAULT; saveCfg('repo save'); });

async function ghRaw(path) {
  if (!cfg.ghToken) throw new Error('GitHub token nahi hai — Sync tab me dalo');
  const res = await fetch('https://api.github.com' + path, {
    headers: { Authorization: `Bearer ${cfg.ghToken}`, Accept: 'application/vnd.github.raw+json' },
  });
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.text();
}
async function getRepoFile(path) {
  return ghRaw(`/repos/${cfg.repo}/contents/${path}`);
}
async function putRepoFile(path, content, message) {
  let sha;
  try {
    const meta = await ghApi(`/repos/${cfg.repo}/contents/${path}`);
    sha = meta.sha;
  } catch {}
  await ghApi(`/repos/${cfg.repo}/contents/${path}`, {
    method: 'PUT',
    body: JSON.stringify({
      message,
      content: btoa(unescape(encodeURIComponent(content))),
      branch: 'main',
      ...(sha ? { sha } : {}),
    }),
  });
}

async function syncSettingsJson() {
  log('syncLog', '📄 config/settings.json push ho raha hai...');
  const txt = await getRepoFile('config/settings.json');
  const s = JSON.parse(txt);
  s.schedule = s.schedule || {};
  s.schedule.morning_ist = cfg.schedule.morning;
  s.schedule.evening_ist = cfg.schedule.evening;
  s.schedule.cron_morning_utc = istToUtcCron(cfg.schedule.morning);
  s.schedule.cron_evening_utc = istToUtcCron(cfg.schedule.evening);
  await putRepoFile('config/settings.json', JSON.stringify(s, null, 2), 'chore: schedule update from control panel');
  log('syncLog', '✅ settings.json updated ✓');
}

async function syncWorkflowCron() {
  log('syncLog', '⏰ .github/workflows/reel.yml cron update...');
  const yml = await getRepoFile('.github/workflows/reel.yml');
  const cm = istToUtcCron(cfg.schedule.morning);
  const ce = istToUtcCron(cfg.schedule.evening);
  const crons = yml.match(/^\s*-\s*cron:.*$/gm) || [];
  if (crons.length < 2) throw new Error('workflow me 2 cron lines nahi mili');
  let n = 0;
  const fixed = yml.replace(/^\s*-\s*cron:\s*'[^']*'/gm, () => `    - cron: '${n++ === 0 ? cm : ce}'`);
  await putRepoFile('.github/workflows/reel.yml', fixed, `chore: schedule ${cfg.schedule.morning}/${cfg.schedule.evening} IST`);
  log('syncLog', `✅ cron updated: ${cm} + ${ce} UTC (= ${cfg.schedule.morning} + ${cfg.schedule.evening} IST)`);
}

async function setRepoSecret(name, value) {
  if (!value) return;
  if (typeof sodium === 'undefined') throw new Error('libsodium CDN load nahi hua (net check karo)');
  await sodium.ready;
  const pk = await ghApi(`/repos/${cfg.repo}/actions/secrets/public_key`);
  const pub = sodium.from_base64(pk.key, sodium.base64_variants.ORIGINAL);
  const enc = sodium.crypto_box_seal(new TextEncoder().encode(value), pub);
  await ghApi(`/repos/${cfg.repo}/actions/secrets/${name}`, {
    method: 'PUT',
    body: JSON.stringify({ encrypted_value: sodium.to_base64(enc, sodium.base64_variants.ORIGINAL), key_id: pk.key_id }),
  });
  log('syncLog', `🔐 secret ${name} set ✓`);
}

async function syncSecrets() {
  const envs = ['INSTAGRAM_ACCESS_TOKEN', 'IG_USER_ID', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'POLLINATIONS_TOKEN', 'NEWSAPI_KEY'];
  let any = false;
  for (const env of envs) {
    const v = secretFor(env);
    if (v) { await setRepoSecret(env, v); any = true; }
    else log('syncLog', `   (skip ${env} — khali hai)`);
  }
  if (any) {
    cfg.syncedAt = new Date().toISOString();
    cfg.keysDirty = false;
    saveCfg();
    renderChecklist();
  }
}

async function enablePagesNow() {
  log('syncLog', '🌐 GitHub Pages enable ho raha hai (source: main, /docs)...');
  try {
    await ghApi(`/repos/${cfg.repo}/pages`, { method: 'POST', body: JSON.stringify({ source: { branch: 'main', path: '/docs' } }) });
    log('syncLog', '✅ Pages ENABLED ✓ — 1-2 min me live hoga');
  } catch (e) {
    if (/409|already/i.test(e.message)) log('syncLog', 'ℹ️ Pages pehle se enabled hai ✓');
    else log('syncLog', '❌ ' + e.message + ' → manual: repo → Settings → Pages → Source: main /docs');
  }
}

async function syncAll() {
  cfg.ghToken = document.getElementById('ghToken').value.trim();
  cfg.repo = document.getElementById('ghRepo').value.trim() || REPO_DEFAULT;
  saveCfg();
  log('syncLog', `\n🚀 SYNC START — ${cfg.repo}`);
  try {
    await syncSettingsJson();
    await syncWorkflowCron();
    await syncSecrets();
    await enablePagesNow();
    cfg.syncedAt = cfg.syncedAt || new Date().toISOString();
    cfg.keysDirty = false;
    saveCfg();
    renderChecklist();
    log('syncLog', '🏁 SAB SYNC COMPLETE ✓ — Actions har 4 AM + 4 PM IST (aapke set time) pe chalega');
  } catch (e) {
    log('syncLog', '❌ SYNC FAIL: ' + e.message);
  }
}
document.getElementById('syncAll').addEventListener('click', syncAll);
document.getElementById('syncSettings').addEventListener('click', () => syncSettingsJson().catch((e) => log('syncLog', '❌ ' + e.message)));
document.getElementById('syncCron').addEventListener('click', () => syncWorkflowCron().catch((e) => log('syncLog', '❌ ' + e.message)));
document.getElementById('syncSecrets').addEventListener('click', () => syncSecrets().catch((e) => log('syncLog', '❌ ' + e.message)));
document.getElementById('enablePages').addEventListener('click', () => enablePagesNow().catch((e) => log('syncLog', '❌ ' + e.message)));
document.getElementById('clearAll').addEventListener('click', () => {
  if (confirm('Sab kuch localStorage se delete karein?')) {
    localStorage.removeItem(LS_KEY);
    location.reload();
  }
});

/* ───────────── Init ───────────── */
(async function init() {
  fillIgFields();
  refreshDashboard();
  renderChecklist();
  // purane tab names (apis/schedule/prompt) → adv
  const legacy = { apis: 'adv', schedule: 'adv', prompt: 'adv' };
  const startTab = legacy[cfg.activeTab] || cfg.activeTab || 'dash';
  activateTab(startTab);
  await handleIgCallback();
  refreshDashboard();
  if (cfg.promptText) document.getElementById('promptText').value = cfg.promptText;
  else document.getElementById('promptText').value = '# SQL.SSL.2027.TXT — "Repo से लोड करो" button dabao...';
  loadRuns();
  loadLatestVideo();
  setInterval(refreshDashboard, 60000);
  setInterval(() => { loadRuns(); renderChecklist(); }, 90000);
  setInterval(loadLatestVideo, 300000);
})();
