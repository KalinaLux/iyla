# iyla

**All your fertility data. One clear picture.**

A local-first fertility intelligence platform by [Solairen Health](https://solairenhealth.com). Built for couples trying to conceive — she tracks, he stays informed, and everything stays on your device.

## What it does

- **Multi-signal dashboard** — Combine data from Kegg, Inito, TempDrop, and manual BBT into one fertility status view
- **Cycle intelligence** — Pattern recognition across cycles with daily insights
- **The Signal** — Themed partner notifications (Top Gun, Spec Ops, Sports, Romantic, Playful, Clinical, Silent) so he knows when timing matters
- **TWW Companion** — Daily emotional support content during the two-week wait
- **AquaAria Breathwork** — Nose-only breathing exercises with couple sessions, rewards, and streaks
- **Reconnect** — Guided Sensate Focus intimacy module designed for TTC couples
- **IVF Module** — Protocol tracking, medication logging, and cycle management
- **TTC Dictionary** — Terminology guide with themed translations for him
- **Labs & Supplements** — Track results against optimal fertility ranges with custom supplement protocols
- **Sleep Analysis** — Correlate sleep quality with fertility markers
- **Document Vault** — Store and organize fertility-related documents
- **Provider Report** — Generate shareable summaries for your doctor
- **Loss Support** — Resources and tracking for pregnancy loss recovery

## Privacy architecture

iyla uses a **local-first, zero-cloud architecture**. All data is stored in your browser's IndexedDB via [Dexie.js](https://dexie.org/). There are no user accounts, no server calls, no analytics, and no telemetry.

- Data never leaves your device
- No accounts or sign-ups required
- No server-side storage
- Export and delete your data at any time
- Open source — verify for yourself

> **Note:** Data is stored locally in your browser's IndexedDB. It is not encrypted at rest. If device-level encryption matters to you, ensure your device has full-disk encryption enabled (FileVault on Mac, device encryption on iOS/Android).

## Tech stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS 4
- **Storage:** Dexie.js (IndexedDB) — no backend required
- **Charts:** Recharts
- **Icons:** Lucide React
- **Routing:** React Router 7
- **Deployment:** Vercel (static SPA)

## Getting started

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

## Add to Home Screen (PWA)

Open the deployed URL in Safari (iOS) or Chrome (Android), tap share, and select "Add to Home Screen." The app runs in standalone mode — no browser chrome.

## Partner pairing

She generates an invite link during onboarding and texts it to him. He taps the link, picks a notification theme, and lands on his Partner Dashboard. No code to type.

## Project structure

```
src/
├── components/     # Layout, modals, charts, onboarding wizard
├── lib/            # Database, fertility engine, types, theme data
├── pages/          # All app pages (dashboard, breathwork, partner, etc.)
└── index.css       # Tailwind + custom theme
```

## Credits

Built by **Kalina Lux** & **Dominick Ferrandino**
Solairen Health — Aguadilla, Puerto Rico, 2026

Named after our children — Solairen for our son, Iyla for our daughter.

## License

All rights reserved. © 2026 Solairen Health, LLC.
