// news.mjs — STEP 0: LIVE news research (calendar category + Google News RSS)
import { loadJSON, info, CFG_DIR, fetchText, istDateStr } from './util.mjs';
import path from 'node:path';

export function getCalendarDay(date = new Date()) {
  const cal = loadJSON(path.join(CFG_DIR, 'calendar.json'));
  const dayNum = parseInt(istDateStr(date).slice(8, 10), 10);
  const day = Math.min(dayNum, 30);
  const entry = cal.days.find((d) => d.day === day) || cal.days[0];
  return { ...entry, categories: cal.categories, queries: cal.queries, date: istDateStr(date) };
}

function decodeEntities(s) {
  return s
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/\s+/g, ' ')
    .trim();
}

function parseRss(xml) {
  const items = [];
  const re = /<item[\s>][\s\S]*?<\/item>/g;
  const blocks = xml.match(re) || [];
  for (const b of blocks) {
    const pick = (tag) => {
      const m = b.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
      return m ? decodeEntities(m[1]) : '';
    };
    const title = pick('title');
    const link = pick('link');
    const pubDate = pick('pubDate');
    const source = (() => {
      const m = b.match(/<source[^>]*>([\s\S]*?)<\/source>/);
      return m ? decodeEntities(m[1]) : '';
    })();
    const desc = decodeEntities(pick('description').replace(/<[^>]+>/g, ' '));
    if (title) items.push({ title, link, pubDate, source, description: desc });
  }
  return items;
}

function scoreItem(item, entry, now) {
  const t = Date.parse(item.pubDate);
  const ageH = isNaN(t) ? 999 : (now - t) / 3600000;
  if (ageH > 96) return -1; // 4 din se purani news nahi
  let score = 0;
  score += Math.max(0, 48 - ageH); // fresh = zyada score
  const hay = (item.title + ' ' + item.description).toLowerCase();
  const topicWords = entry.topic.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  for (const w of topicWords) if (hay.includes(w)) score += 8;
  const catWords = {
    A: ['hack', 'cyber', 'attack', 'breach', 'ransomware'],
    B: ['scam', 'fraud', 'otp', 'upi', 'fake', 'cheat', 'ठगी', 'स्कैम'],
    C: ['dark web', 'darkweb', 'leaked', 'stolen'],
    D: ['spy', 'spyware', 'stalkerware', 'pegasus', 'phone hack', 'tracking'],
    E: ['data breach', 'leak', 'password', 'exposed', 'database'],
    F: ['malware', 'ransomware', 'trojan', 'virus', 'infected'],
    G: ['phishing', 'deepfake', 'voice clon', 'social engineering', 'smishing'],
    H: ['instagram', 'facebook', 'youtube', 'account hack', 'twitter', 'telegram account'],
  }[entry.category] || [];
  for (const w of catWords) if (hay.includes(w)) score += 6;
  if (/india|indian|भारत|bengaluru|mumbai|delhi|indi/.test(hay)) score += 5;
  if (item.source) score += 1;
  return score;
}

export async function researchNews() {
  const entry = getCalendarDay();
  const settings = loadJSON(path.join(CFG_DIR, 'settings.json'));
  const ns = settings.news;
  info(`Calendar: Day ${entry.day} | Category ${entry.category} (${entry.categories[entry.category]}) | ${entry.topic}`);
  info(`Focus: ${entry.focus}`);

  const queries = (entry.queries[entry.category] || []).slice(0, 5);
  const now = Date.now();
  const all = [];

  // Google News RSS — free, no key
  for (const q of queries) {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q + ' when:3d')}&hl=${ns.language}&gl=${ns.region}&ceid=${ns.region}:${ns.language}`;
    try {
      const xml = await fetchText(url, {}, 2);
      const items = parseRss(xml);
      info(`  RSS "${q}" → ${items.length} items`);
      for (const it of items) all.push(it);
    } catch (e) {
      info(`  RSS "${q}" failed: ${e.message}`);
    }
  }

  // NewsAPI backup (agar key hai)
  if (all.length < 4 && process.env.NEWSAPI_KEY) {
    try {
      const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(queries[0] || 'cyber')}&language=${ns.language === 'hi' ? 'hi' : 'en'}&sortBy=publishedAt&pageSize=20&apiKey=${process.env.NEWSAPI_KEY}`;
      const j = await fetchText(url, {}, 2);
      const data = JSON.parse(j);
      for (const a of data.articles || []) {
        all.push({ title: a.title || '', link: a.url || '', pubDate: a.publishedAt || '', source: a.source?.name || '', description: (a.description || '') + ' ' + (a.content || '') });
      }
      info(`  NewsAPI → ${(data.articles || []).length} items`);
    } catch (e) {
      info(`  NewsAPI failed: ${e.message}`);
    }
  }

  const ranked = all
    .map((it) => ({ ...it, score: scoreItem(it, entry, now) }))
    .filter((it) => it.score > 0)
    .sort((a, b) => b.score - a.score);

  // dedupe by title
  const seen = new Set();
  const unique = ranked.filter((it) => {
    const k = it.title.toLowerCase().slice(0, 80);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  if (unique.length === 0) {
    info('  Koi fresh news nahi mili — fallback generic query chalati hoon');
    for (const q of ns.fallback_queries.slice(0, 3)) {
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q + ' when:7d')}&hl=${ns.language}&gl=${ns.region}&ceid=${ns.region}:${ns.language}`;
      try {
        const xml = await fetchText(url, {}, 2);
        for (const it of parseRss(xml)) unique.push({ ...it, score: 10 });
      } catch {}
      if (unique.length >= 5) break;
    }
  }

  const pick = unique[0] || {
    title: `${entry.topic} — ताज़ा खबर`,
    link: '',
    pubDate: new Date().toUTCString(),
    source: 'Desk Research',
    description: entry.focus,
    score: 0,
  };

  info(`NEWS PICKED: ${pick.title}`);
  info(`  source=${pick.source} | date=${pick.pubDate} | score=${pick.score ?? 0}`);

  return {
    calendar: entry,
    headline: pick.title,
    source: pick.source || 'Web',
    url: pick.link,
    published: pick.pubDate,
    summary: (pick.description || '').slice(0, 900),
    fetched_candidates: unique.length,
    date: entry.date,
  };
}
