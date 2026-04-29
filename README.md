# HeshamChina — Personal Dashboard

Your private command center. One URL, every morning, everything in one place.

## What's Inside

### Home Tab
- **Morning header** — Beijing weather (auto), Arabic quote + 成语 of the day, AI morning brief (on demand)
- **Today's Focus** — main mission + daily checklist (resets each day)
- **Revenue Pipeline** — 3 streams (Sourcing / Itinerary / Market Guides), monthly target + progress bar, stale deal alerts, per-deal conversation log
- **Active Projects** — health status, progress bars, next actions
- **Weekly Goals** — set goals, track progress with sliders
- **Streaks** — posting streak + check-in streak
- **Quick Capture** — floating button to capture ideas instantly
- **Social Snapshot** — follower chart preview

### Instagram Tab
- **Growth tracker** — daily follower log for IG + X, delta calculations, 30-day sparkline chart, growth projections
- **Content pipeline** — reels idea table with series, vibe, status, script, views tracking
- **Script generator** — AI generates full scripts in your tone (Jordanian Arabic or English)
- **Competitor analyzer** — paste any handle, get content gap analysis + 5 actionable ideas
- **Image generator** — DALL-E 3 generates images in your chosen format with logo overlay

### Projects Tab
- Your active projects with health indicators, progress sliders, next actions
- **Vercel deployments** — live view of all your deployed apps (requires VERCEL_TOKEN)

### Agents Tab
- Individual AI agents + meeting room workflows
- Task history from Supabase
- Client Agent Desk: client rows, status, discussion log, and product photo gallery

### Settings Tab
- One-click local -> Supabase migration helpers
- Environment and integration checks

---

## Setup

### 1. Install
```bash
npm install
```

### 2. Environment variables
```bash
cp .env.example .env.local
```

Edit `.env.local`:
```
OPENAI_API_KEY=sk-...           # Required for scripts, competitor analysis, image gen, morning brief
VERCEL_TOKEN=...                # Optional — for Vercel deployments view
NEXT_PUBLIC_EMAILJS_SERVICE_ID= # Optional — for weekly email report
NEXT_PUBLIC_EMAILJS_TEMPLATE_ID=
NEXT_PUBLIC_EMAILJS_PUBLIC_KEY=
NEXT_PUBLIC_REPORT_EMAIL=your@email.com
```

### 3. Run
```bash
npm run dev
```
Open http://localhost:3000

### 4. Set as browser homepage
This is the whole point. Set http://localhost:3000 (or your Vercel URL) as your browser's default homepage.

### 5. Deploy to Vercel
```bash
npx vercel
```
Add all env vars in Vercel → Project Settings → Environment Variables.

---

## Getting API Keys

| Key | Where |
|-----|-------|
| `OPENAI_API_KEY` | platform.openai.com → API keys |
| `VERCEL_TOKEN` | vercel.com → Settings → Tokens → Create token |

---

## Data Storage
The app uses a hybrid model:
- Zustand persist for fast local UX
- Supabase for cross-device sync and long-term storage
- Supabase Storage for media (thumbnails and product photos)

If Supabase is temporarily unreachable, the dashboard continues from local persisted state.

---

## File Structure
```
app/
  page.tsx                    → Main dashboard (Home, Agents, Instagram, Projects, Journal, Settings)
  layout.tsx + globals.css
  api/
    morning-brief/            → GPT-4o synthesizes all your data into a brief
    generate-script/          → Script generator in your tone
    analyze-competitor/       → Competitor content analysis
    generate-image/           → DALL-E 3 image generation
    agents/                   → Individual agent endpoints
    meeting/                  → Multi-agent meeting orchestration
    scrape/                   → Daily scraping + ingestion pipeline
    vercel-projects/          → Fetches your Vercel deployments
    weather/                  → Open-Meteo Beijing weather (no key needed)

components/dashboard/
  SocialSection.tsx           → Follower tracker + chart
  InstagramSuite.tsx          → All 5 Instagram tabs
  ProjectsHub.tsx             → Projects + Vercel deployments

lib/
  store.ts                    → Zustand state (all data)
  constants.ts                → Arabic quotes, 成语, series/vibe labels

types/index.ts                → All TypeScript types
```
