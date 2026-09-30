// scriptgen.mjs — STEP 1 (script + 18-25 moments) + STEP 4 (caption + 3-tier hashtags)
import { loadJSON, info, CFG_DIR, fetchJson, countWords, hasDevanagari } from './util.mjs';
import path from 'node:path';

const STYLE_SUFFIX = loadJSON(path.join(CFG_DIR, 'settings.json')).images.style;

const DIRECTORS_NOTES = loadJSON(path.join(CFG_DIR, 'settings.json')).voice.directors_notes;

export function buildSystemPrompt(settings, news) {
  const h = settings.hashtags;
  const banned = settings.script.banned_openers.join(', ');
  return `तुम SQL.SSL (@sql.ssl) के लिए रोज़ की इंस्टाग्राम रील की स्क्रिप्ट लिखते हो। सख्त नियम:

आज की LIVE न्यूज़ (STEP 0 से):
- Category: ${news.calendar.category} — ${news.calendar.topic}
- Headline: ${news.headline}
- Summary: ${news.summary}

1) SCRIPT: शुद्ध हिंदी, ${settings.script.min_words}-${settings.script.max_words} शब्द (English technical terms allowed)। टोन गंभीर, सतर्क करने वाला, conversational।
2) पहली line = SCROLL-STOPPER: सीधे news के shocking fact से शुरू। शुरुआत में ये शब्द बिल्कुल नहीं: ${banned}।
3) आखिरी line में @sql.ssl Follow CTA जरूर हो।
4) अगर category B/E/A है तो "personal danger" angle डालो (आपका डेटा/पैसा भी खतरे में)।
5) MOMENTS: script को exactly ${settings.script.moments_min}-${settings.script.moments_max} moments में तोड़ो। हर moment में:
   - voiceLine: वो वाक्य (script से, exact)
   - overlay: उस moment की 5-8 शब्दों की bold Hindi key line (Devanagari में; OTP=ओटीपी, APK=एपीके, Crypto=क्रिप्टो लिखो)
   - scene: image का exact scene description (English में, specific — क्या दिखाना है, कहाँ, किस angle से)
   - avoid: क्या नहीं दिखाना (1 phrase)
   हर scene अलग हो, same composition repeat नहीं। Scene में naturally "@sql.ssl branding" ka mention karo (monitor corner, jacket emblem, code line, phone screen signature — promotional nahi, scene ka hissa ho)।
6) Har scene voice line se 100% match kare. Generic/random hacker visual nahi.
7) CAPTION: hindi me 2-4 lines — news ki ek line jhalak + awareness message + CTA (inme se ek): "${'अगर आप Hacking और Cyber Security से जुड़े ऐसे videos देखना चाहते हैं — तो अभी Follow करें @sql.ssl।'}" ya "${'इस video को अपने parents और दोस्तों को ज़रूर भेजें — ताकि वो भी safe रहें। ऐसी जानकारी रोज़ पाने के लिए @sql.ssl को Follow करें।'}"
8) HASHTAGS exactly 10: 3 large (${h.large.join(' ')}) + 4 medium (${h.medium.join(' ')}) + 3 niche (${h.niche.join(' ')})। #sqlssl zaroor.

STRICT JSON output, koi extra text nahi:
{
 "script": "पूरी हिंदी स्क्रिप्ट, शब्द अलग-अलग space से",
 "moments": [{"voiceLine":"...","overlay":"...","scene":"...","avoid":"..."}],
 "caption": "caption text (hashtag alag nahi — sirf caption para)",
 "hashtags": ["#a","#b", ...10],
 "cta_variation": 1
}`;
}

export function validateScript(out, settings, news) {
  const errors = [];
  const sc = settings.script;
  const words = countWords(out.script || '');
  if (words < sc.min_words || words > sc.max_words) errors.push(`word count ${words} (need ${sc.min_words}-${sc.max_words})`);

  const firstLine = (out.script || '').split(/[।.!?]/)[0] || '';
  for (const b of sc.banned_openers) {
    if (firstLine.toLowerCase().startsWith(b.toLowerCase().trim())) {
      errors.push(`banned opener "${b}" first line me hai`);
    }
  }
  if (!hasDevanagari(out.script || '')) errors.push('script me Devanagari nahi hai');

  if (!/@sql\.ssl/i.test(out.script || '')) errors.push('script me @sql.ssl CTA missing');
  if (!/follow|फॉलो|फोलो/i.test((out.script || '').slice(-160))) errors.push('end me Follow CTA missing');

  const m = out.moments || [];
  if (m.length < sc.moments_min || m.length > sc.moments_max) errors.push(`moments ${m.length} (need ${sc.moments_min}-${sc.moments_max})`);

  m.forEach((mo, i) => {
    if (!mo.voiceLine || mo.voiceLine.trim().length < 5) errors.push(`moment ${i + 1}: voiceLine empty`);
    const ow = countWords(mo.overlay || '');
    if (ow < 3 || ow > 10) errors.push(`moment ${i + 1}: overlay ${ow} words (need 3-10)`);
    if (!hasDevanagari(mo.overlay || '')) errors.push(`moment ${i + 1}: overlay Devanagari nahi`);
    if (!mo.scene || mo.scene.trim().length < 15) errors.push(`moment ${i + 1}: scene weak`);
  });

  const tags = out.hashtags || [];
  if (tags.length !== 10) errors.push(`hashtags ${tags.length} (need exactly 10)`);
  if (!tags.some((t) => t.toLowerCase() === '#sqlssl')) errors.push('#sqlssl missing in hashtags');

  if (!out.caption || out.caption.length < 40) errors.push('caption too short');
  if (!/@sql\.ssl/i.test(out.caption || '')) errors.push('caption me @sql.ssl CTA missing');

  return errors;
}

function buildFallback(news, settings) {
  // Offline/template path — LLM na ho to bhi 90-120 shabd + 18-25 moments banate hain
  const topic = news.calendar.topic;
  const head = news.headline.replace(/\s*-\s*[^-]{0,60}$/, '');
  const summary = news.summary || news.calendar.focus;
  const cat = news.calendar.category;
  const danger = ['A', 'B', 'E'].includes(cat);

  const lines = [
    `आज ${news.date} की ताज़ा खबर — ${head.slice(0, 90)}।`,
    `${news.calendar.focus} — यह खबर सीधे आम लोगों से जुड़ी है।`,
    `जानकारी के मुताबिक ${summary.slice(0, 110) || 'साइबर अपराधियों ने नया तरीका अपनाया'}`,
    `हमले में सबसे ज़्यादा नुकसान उन्हीं का हुआ जो चेतावनी को नज़रअंदाज़ करते रहे।`,
    danger
      ? `सबसे बड़ा खतरा — आपका डेटा या पैसा भी इसी तरीके से निशाने पर हो सकता है।`
      : `सबसे बड़ा खतरा — ऐसे हमले आम लोगों के फोन और अकाउंट तक पहुँच रहे हैं।`,
    `अपराधी पहले भरोसा दिखाते हैं, फिर एक गलत क्लिक से पूरा नुकसान कर देते हैं।`,
    `दुनिया भर में ऐसे हमले बढ़ रहे हैं और भारत भी इससे अछूता नहीं है।`,
    `बचाव — किसी अनजान लिंक, ऐप या ओटीपी पर कभी भरोसा मत करो।`,
    `दूसरा तरीका — पासवर्ड बदलो और दो-स्तरीय सुरक्षा हमेशा चालू रखो।`,
    `अगर आप Hacking और Cyber Security के ऐसे videos देखना चाहते हैं — तो अभी Follow करें @sql.ssl।`,
  ];

  // word count fix — CTA (last line) aur hook (first line) ko kabhi mat hatao
  let guard = 0;
  while (countWords(lines.join(' ')) < settings.script.min_words && guard < 30) {
    lines.splice(lines.length - 1, 0, 'सावधान रहें और अपनों को सचेत करें।');
    guard += 1;
  }
  guard = 0;
  while (countWords(lines.join(' ')) > settings.script.max_words && guard < 200) {
    guard += 1;
    let idx = 1;
    let best = 0;
    for (let i = 1; i < lines.length - 1; i++) {
      const wl = lines[i].split(' ').length;
      if (wl > best) { best = wl; idx = i; }
    }
    if (best <= 6) {
      if (lines.length <= 9) break;
      lines.splice(idx, 1);
      continue;
    }
    const ws = lines[idx].split(' ');
    lines[idx] = ws.slice(0, ws.length - 2).join(' ').replace(/[,—-]\s*$/, '') + '।';
  }
  const script = lines.join(' ');

  // 18 moments banane ke liye final script ki lines se anchors banao
  const anchors = [];
  for (const line of lines) {
    const parts = line.split(/,|—|।/).map((s) => s.trim()).filter((s) => s.length > 8);
    if (parts.length >= 2) {
      anchors.push(parts[0] + '।');
      anchors.push(parts.slice(1).join(', ') + '।');
    } else {
      anchors.push(line);
    }
  }
  const n = Math.min(Math.max(anchors.length, settings.script.moments_min), settings.script.moments_max);

  // adjust anchors count exactly n
  while (anchors.length < n) anchors.splice(anchors.length - 1, 0, anchors[anchors.length - 2]);
  while (anchors.length > n) anchors.splice(anchors.length - 2, 1);

  const overlayBank = [
    `${head.slice(0, 40)}!`,
    'आज की ताज़ा खबर',
    'ऐसे हुआ हमला',
    'सिस्टम पर असर',
    danger ? 'आपका डेटा भी खतरे में' : 'आम लोगों पर असर',
    'अपराधी कौन है',
    'दुनिया भर में खतरा',
    'ओटीपी-लिंक से बचें',
    'पासवर्ड बदलें अभी',
    '@sql.ssl को Follow करें',
  ];

  const scenes = [
    'shocking hook visual: glowing red alert breaking through dark city night, single striking element, curious tension',
    'recognizable location shot of the affected organization or Indian city skyline at night with news headline glow',
    'exact attack method visual matching the news — fake message, fake app or fake portal on a phone screen',
    'server room chaos with breaking data lines and crash screens showing the institutional impact',
    'ordinary Indian person holding phone with worried expression and empty bank or hacked notification',
    'the attacker group visual — anonymous operator with SQL.SSL emblem on jacket in dark control room',
    'world map with red attack lines spreading globally, cyber warfare style',
    'defense tip one: exact action shown — link blocked, OTP lock or suspicious APK rejected on phone',
    'defense tip two: password change screen with two-factor lock glowing, different composition',
    'powerful closing frame with @sql.ssl identity energy and follow call to action',
  ];

  const moments = anchors.map((voiceLine, i) => ({
    voiceLine,
    overlay: overlayBank[i % overlayBank.length],
    scene: `${scenes[i % scenes.length]} — for line: ${voiceLine.slice(0, 90)}`,
    avoid: 'generic random hacker face, repeated same composition',
  }));

  const h = settings.hashtags;
  return {
    script,
    moments,
    caption: `${news.headline.slice(0, 120)}\n\n⚠️ जागरूकता ही बचाव है — इस video को अपने parents और दोस्तों को ज़रूर भेजें, ताकि वो भी safe रहें। ऐसी जानकारी रोज़ पाने के लिए @sql.ssl को Follow करें। 🔔`,
    hashtags: [...h.large, ...h.medium, ...h.niche],
    cta_variation: 2,
    _engine: 'template',
  };
}

async function llmGenerate(settings, news) {
  const sys = buildSystemPrompt(settings, news);
  const priority = settings.script.llm_priority;

  for (const eng of priority) {
    try {
      if (eng === 'openai' && process.env.OPENAI_API_KEY) {
        info('  Script engine: OpenAI ' + settings.script.openai_model);
        const j = await fetchJson('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
          body: JSON.stringify({
            model: settings.script.openai_model,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: sys },
              { role: 'user', content: `Aaj ki news par poora JSON banao. Headline: ${news.headline}` },
            ],
            temperature: 0.8,
          }),
        }, 2);
        const out = JSON.parse(j.choices[0].message.content);
        return { ...out, _engine: 'openai' };
      }
      if (eng === 'gemini' && process.env.GEMINI_API_KEY) {
        info('  Script engine: Gemini ' + settings.script.gemini_model);
        const j = await fetchJson(
          `https://generativelanguage.googleapis.com/v1beta/models/${settings.script.gemini_model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: sys + `\n\nUser: Aaj ki news par poora JSON banao. Headline: ${news.headline}` }] }],
              generationConfig: { temperature: 0.85, responseMimeType: 'application/json' },
            }),
          }, 2
        );
        const text = j.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const out = JSON.parse(text);
        return { ...out, _engine: 'gemini' };
      }
    } catch (e) {
      info(`  ${eng} failed: ${e.message}`);
    }
  }
  return null;
}

export async function generateScript(settings, news) {
  let out = await llmGenerate(settings, news);
  let errors = out ? validateScript(out, settings, news) : ['no-llm'];

  if (errors.length) {
    info(`  Script validation issues: ${errors.length} → repair attempt`);
    if (out) {
      try {
        const sys = buildSystemPrompt(settings, news) +
          `\n\nPREVIOUS OUTPUT had these problems, fix ALL of them exactly: ${errors.join('; ')}\nReturn full corrected JSON only.`;
        const key = process.env.OPENAI_API_KEY;
        const gkey = process.env.GEMINI_API_KEY;
        if (key) {
          const j = await fetchJson('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
            body: JSON.stringify({
              model: settings.script.openai_model,
              response_format: { type: 'json_object' },
              messages: [
                { role: 'system', content: sys },
                { role: 'user', content: JSON.stringify(out).slice(0, 6000) },
              ],
              temperature: 0.5,
            }),
          }, 2);
          out = { ...JSON.parse(j.choices[0].message.content), _engine: 'openai-repair' };
        } else if (gkey) {
          const j = await fetchJson(
            `https://generativelanguage.googleapis.com/v1beta/models/${settings.script.gemini_model}:generateContent?key=${gkey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: sys + '\n\nPrevious output:\n' + JSON.stringify(out).slice(0, 6000) }] }],
                generationConfig: { temperature: 0.5, responseMimeType: 'application/json' },
              }),
            }, 2
          );
          out = { ...JSON.parse(j.candidates[0].content.parts[0].text), _engine: 'gemini-repair' };
        }
        errors = validateScript(out, settings, news);
      } catch (e) {
        info(`  repair failed: ${e.message}`);
        errors.push('repair-failed');
      }
    }
  }

  if (errors.length) {
    info('  Falling back to template engine (rules enforced programmatically)');
    out = buildFallback(news, settings);
    errors = validateScript(out, settings, news);
    if (errors.length) {
      // last-resort hard fix
      out.moments = out.moments.slice(0, Math.min(25, Math.max(18, out.moments.length)));
      while (out.moments.length < 18) out.moments.push(out.moments[out.moments.length - 1]);
      out.hashtags = [...settings.hashtags.large, ...settings.hashtags.medium, ...settings.hashtags.niche];
      errors = validateScript(out, settings, news);
    }
  }

  const words = countWords(out.script);
  info(`Script ready | engine=${out._engine || 'llm'} | words=${words} | moments=${out.moments.length} | hashtags=${out.hashtags.length}`);
  return { ...out, words };
}
