# 💉 SQL.SSL — Free Automated Instagram Reel System

> **Roz 2 reels automatically** — एक **सुबह 4:00** और एक **शाम 4:00 (IST)** — पूरा काम **सिर्फ GitHub पर**:
> GitHub Actions (schedule + video rendering) + GitHub Pages (control website) + Free APIs.
> सारे rules `SQL.SSL.2027.TXT` (Master Prompt File) के — pipeline हर step verify करके ही upload करता है।

🌐 **Live Control Panel:** `https://sqlrizwan.github.io/sqlssl-reel-automation/` (Pages enable होते ही live)

---

## ⚡ Features

| क्या | कैसे | खर्च |
|---|---|---|
| Daily 2 videos (4 AM + 4 PM IST) | GitHub Actions cron | 💸 Free (public repo) |
| Live news research (STEP 0) | Google News RSS + 30-day calendar | 💸 Free, no key |
| Hindi script + caption + hashtags | Gemini Free Tier / OpenAI / built-in template | 💸 Free |
| Voice over (Rasalgethi / deep male) | Gemini TTS → OpenAI TTS → Edge TTS fallback | 💸 Free |
| 18-25 images (1080×1920) | Pollinations.ai flux | 💸 Free, no key |
| Center Hindi text overlay | FFmpeg + Noto Devanagari font | 💸 Free |
| Ken Burns zoom/pan + BGM + final mix | FFmpeg (prompt file वाले exact rules) | 💸 Free |
| 11-point verification | Code में enforced — fail होने पर upload block | 💸 Free |
| Instagram auto upload | Graph API (Reels + optional Story) | 💸 Free |
| Control website (localStorage) | GitHub Pages — Instagram/OpenAI redirect connect | 💸 Free |
| Public video URL (upload के लिए) | `media` branch (auto force-push, sirf latest video) | 💸 Free |

---

## 🏗️ Architecture — पूरा काम GitHub पर

```
┌──────────────────────── GitHub (sab kuch yahin) ─────────────────────────┐
│                                                                          │
│  .github/workflows/reel.yml   ← cron: 22:30 UTC (=04:00 IST)            │
│                                ← cron: 10:30 UTC (=16:00 IST)           │
│         │                                                                │
│         ▼                                                                │
│  scripts/pipeline.mjs ── STEP 0  news (Google News RSS + calendar)      │
│                        ── STEP 1  script 90-120 words + 18-25 moments  │
│                        ── STEP 2  voice (Gemini Rasalgethi → fallback)  │
│                        ── STEP 3  images + CENTER Hindi overlay         │
│                        ── STEP 3B Ken Burns → video_no_audio.mp4        │
│                        ── STEP 4  caption + 3-tier hashtags             │
│                        ── STEP 5  BGM (dark cyberpunk 80-100 BPM)       │
│                        ── STEP 6  mix Voice 2.2 / BGM 0.30              │
│                        ── VERIFY  11-point checklist (fail = STOP)      │
│                        ── STEP 7  media branch → Instagram publish ✓    │
│                                                                          │
│  docs/                      ← Control website (Pages)                   │
│     ├── index.html          ← tabs: डैशबोर्ड / कनेक्शन / API / शेड्यूल │
│     ├── app.js              ← सारा data localStorage में                 │
│     └── style.css                                                           │
│                                                                          │
│  SQL.SSL.2027.TXT           ← Master prompt file (rules source)         │
│  config/settings.json       ← schedule, volumes, providers              │
│  config/calendar.json       ← 30-day content calendar                   │
│  config/apis.json           ← free API catalog (website यही दिखाती है) │
│  media branch               ← latest reel videos (public raw URL)       │
│  Actions Secrets            ← OPENAI/GEMINI/INSTAGRAM tokens            │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Setup (एक बार, ~10 मिनट)

### 1) Actions और Pages चालू करो
1. Repo खोलो → **Settings → Actions → General** → *Allow all actions* ✓
2. **Settings → Pages** → Source: **Deploy from a branch** → Branch: **`main` / `/docs`** → Save
   (या website के **GitHub सिंक → "GitHub Pages चालू करो"** बटन से एक क्लिक में)

### 2) Control website खोलो
`https://sqlrizwan.github.io/sqlssl-reel-automation/` → **🔄 GitHub सिंक** टैब → **PAT** डालो
(classic PAT में `repo` + `workflow` scope, या fine-grant में Contents/Actions/Secrets write)

### 3) Instagram Connect (redirect)
1. [developers.facebook.com](https://developers.facebook.com) → **My Apps → Create App → Business**
2. App में **Instagram API with Instagram Login** product add करो → App ID/Secret कॉपी करो
3. Instagram account **Professional (Creator)** हो + Facebook Page से linked हो
   (Instagram → Settings → Accounts center → professional dashboard)
4. Website **🔌 कनेक्शन** टैब → App ID + Secret + Redirect URI (auto = website URL) भरो
   → App में redirect URI भी **Valid OAuth Redirect URIs** में add करो
5. **🚀 Instagram Connect (Redirect)** → Facebook login → approve
   → token + IG user id localStorage में save ✓

> ⚠️ Meta app **Live** होने चाहिए (App Review/Mode) — Development mode में सिर्फ added users काम करेंगे।
> जल्दी test के लिए: Graph API Explorer से token बनाकर **manual paste** भी कर सकते हो।

### 4) Free keys (optional but recommended)
| Key | कहाँ से | क्या देगा |
|---|---|---|
| **GEMINI_API_KEY** | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) (फ्री) | Prompt-file वाली **Rasalgethi TTS voice** + अच्छी Hindi script |
| **OPENAI_API_KEY** | platform.openai.com (paid, optional) | Best script/voice/images |
| **POLLINATIONS_TOKEN** | [auth.pollinations.ai](https://auth.pollinations.ai) (फ्री signup) | Images की speed (15s → 5s) + watermark-free |
| **NEWSAPI_KEY** | newsapi.org (फ्री, optional) | Backup news |

**Bina kisi key के भी system चलेगा** — Edge TTS + template script + Pollinations anonymous.

### 5) Sync मारो
Website → **🔄 GitHub सिंक** → **🚀 सब सिंक करो** → settings.json + cron + secrets सब repo में लग जाएँगे।

### 6) Test run
Repo → **Actions → Reel Automation → Run workflow**
→ slot: `auto` / mode: `dry-run` (sirf news+script) या `full` / `skip-upload` → **Run**

---

## ⏰ Schedule (4 AM + 4 PM IST)

| Slot | IST | UTC (cron) |
|---|---|---|
| सुबह वाली | 04:00 | `30 22 * * *` |
| शाम वाली | 16:00 | `30 10 * * *` |

- Website के **⏰ शेड्यूल** टैब से समय बदलो → **सिंक** → workflow cron auto-update।
- 📌 Prompt file कहती है best reach **19:30-20:30 IST** — website पर एक क्लिक से वो भी लगा सकते हो।
- GitHub cron कभी-कभी 5-15 मिनट late चलता है (normal है)।

---

## 🎬 Prompt File Rules — pipeline कैसे enforce करता है

`SQL.SSL.2027.TXT` के 11-point final checklist का code version:

```
[x] Script 90-120 शब्द, पहली line बिना filler (रुकिए/सुनिए banned)
[x] आखिरी line = @sql.ssl Follow CTA
[x] 18-25 moments/images
[x] हर scene voice line से match (voiceLine/overlay/scene fields)
[x] हर image पर CENTER Hindi overlay (bottom 20%/top 10% में नहीं)
[x] Hashtags = 3 Large + 4 Medium + 3 Niche (10, #sqlssl ज़रूर)
[x] Caption में Follow CTA
[x] Ken Burns animation (plain slideshow नहीं)
[x] BGM dark cyberpunk 80-100 BPM, fade-in/out
[x] Final duration = measured voice duration (Voice 2.2 / BGM 0.30)
[x] Export 1080×1920 H.264 MP4
```

> कोई भी check fail → **upload block** + Actions run red + report `output/verify_report.txt` में।
> Voice order कभी नहीं टूटती: **पहले script → voice → duration नापो → उसी हिसाब से images/BGM**।

---

## 📁 Repo Structure

```
sqlssl-reel-automation/
├── .github/workflows/reel.yml    # 2 cron (4AM/4PM IST) + manual dispatch
├── SQL.SSL.2027.TXT              # Master prompt file (attach की हुई)
├── config/
│   ├── settings.json             # schedule, voice, images, volumes, hashtags
│   ├── calendar.json             # 30-day topic rotation + queries
│   └── apis.json                 # free API catalog (website इसी से पढ़ती है)
├── scripts/
│   ├── pipeline.mjs              # orchestrator + 11-point verify
│   ├── run.sh                    # deps + entry
│   ├── kenburns.sh               # STEP 3B (prompt file वाला exact)
│   ├── mix.sh                    # STEP 6 (Voice 2.2 / BGM 0.30)
│   └── lib/  news|scriptgen|tts|images|render|bgm|upload|util
├── docs/                         # ⭐ GitHub Pages control panel
│   ├── index.html · app.js · style.css
├── assets/                       # (optional) bgm.mp3 drop karo — auto use hoga
└── output/                       # generated video/logs (gitignored)
```

---

## 🛠️ Troubleshooting

| समस्या | हल |
|---|---|
| Actions cron chala hi nahi | Settings → Actions → **General** → Workflow permissions = *Read and write*; पहला run manual se trigger karo (cron repo me activity ke baad chalta hai) |
| `INSTAGRAM_ACCESS_TOKEN missing` | Website → कनेक्शन → Instagram connect/manual paste → **सिंक (secrets)** |
| Instagram container ERROR | Video ka public URL check karo (`media` branch), caption me forbidden content?, account professional ho |
| Pollinations 402/500 | Free anonymous limit — pipeline 15s spacing + retry karta hai; [auth.pollinations.ai](https://auth.pollinations.ai) ka free token lagao (Secrets: `POLLINATIONS_TOKEN`) |
| TTS fail | Edge TTS fallback auto chalta hai; `pip install --break-system-packages edge-tts` |
| Font boxes me dikh raha | Workflow `fonts-noto-core fonts-noto-extra` install karta hai + Noto Devanagari auto-download |
| Pages 404 | Settings → Pages → main `/docs`; ya website se "Pages चालू करो" |

---

## 🔐 Security (ज़रूर पढ़ो)

1. **जो PAT इस्तेमाल हुआ उसे setup के बाद तुरंत revoke कर दो** — GitHub → Settings → Developer settings → Tokens.
   नया token बनाओ सिर्फ `repo` + `workflow` scope (ya fine-grant Contents/Actions/Secrets write) और website में डालो।
2. Tokens सिर्फ **browser localStorage** + **GitHub encrypted Secrets** में रहते हैं — कहीं और नहीं।
3. Repo **public** रखना ज़रूरी है (free Pages + Actions minutes के लिए) — इसलिए कभी भी token/secret **file में मत लिखो**।
4. महीने में एक बार Instagram token rotate करते रहो (long-lived tokens expire होते हैं)।

---

## 📈 Daily habits (upload के बाद — prompt file STEP 7)

- अपनी **Story पर reel share** करो
- पहले **30 मिनट** में सारे comments का reply
- 2-3 बड़े cybersecurity accounts पर meaningful comment
- Algorithm को trust बनाने में **3-4 महीने** लगते हैं — daily consistency = growth 💪

---

> **@sql.ssl** · Made with ❤️ on 100% free GitHub stack · MIT License
