# Supabase Setup for Partner Sync

This enables real-time sync between her dashboard and his Partner Dashboard.
Takes about 3 minutes.

## 1. Create a free Supabase project

1. Go to [supabase.com](https://supabase.com) and sign up (free tier)
2. Click **New Project**
3. Name it `iyla` (or anything)
4. Choose a region close to you (US East for Puerto Rico)
5. Set a database password (save it somewhere)
6. Click **Create new project** — wait ~2 minutes

## 2. Create the sync table

Go to **SQL Editor** in the Supabase dashboard, paste this, and click **Run**:

```sql
-- Partner sync table
create table partner_sync (
  pair_code text primary key,
  fertility_status text not null default 'low',
  cycle_day integer not null default 1,
  phase text not null default 'follicular',
  recommendation text default '',
  theme_id text default 'topgun',
  updated_at timestamptz default now()
);

-- Allow anonymous read/write (pairing code is the shared secret)
alter table partner_sync enable row level security;

create policy "Anyone can read partner status"
  on partner_sync for select
  using (true);

create policy "Anyone can insert partner status"
  on partner_sync for insert
  with check (true);

create policy "Anyone can update partner status"
  on partner_sync for update
  using (true);

-- Enable realtime for this table
alter publication supabase_realtime add table partner_sync;
```

## 3. Get your credentials

1. Go to **Settings** → **API** in the Supabase dashboard
2. Copy the **Project URL** (looks like `https://abc123.supabase.co`)
3. Copy the **anon/public key** (the long string under "Project API keys")

## 4. Add to Vercel

In your Vercel project dashboard:

1. Go to **Settings** → **Environment Variables**
2. Add these two:

| Key | Value |
|-----|-------|
| `VITE_SUPABASE_URL` | `https://your-project.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `your-anon-key-here` |

3. Click **Save**
4. **Redeploy** (go to Deployments → click the three dots → Redeploy)

## 5. For local development

Create a `.env` file in the `fertisync/` folder:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

This file is already gitignored.

## How it works

- **Her phone:** When she opens her dashboard, her fertility status (cycle day, phase, status) is pushed to Supabase. Only a summary is sent — no raw readings, no personal data.
- **His phone:** When he opens his Partner Dashboard, it pulls the latest status. If he keeps the app open, it receives realtime updates.
- **The pairing code** from onboarding is the shared key that links their data.
- **Privacy:** Only computed status is synced (e.g., "rising", "cycle day 9"). Raw hormone values, BBT, sleep data, and personal notes never leave her device.
