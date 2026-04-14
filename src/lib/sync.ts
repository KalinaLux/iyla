import { createClient, type SupabaseClient, type RealtimeChannel } from '@supabase/supabase-js';

// Supabase config — safe to expose (anon key has row-level security)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const PAIR_CODE_KEY = 'iyla_pair_code';

let supabase: SupabaseClient | null = null;

function getClient(): SupabaseClient | null {
  if (supabase) return supabase;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return supabase;
}

export function isSyncEnabled(): boolean {
  return !!SUPABASE_URL && !!SUPABASE_ANON_KEY;
}

// ─── Pair Code Persistence ────────────────────────────────

export function savePairCode(code: string): void {
  localStorage.setItem(PAIR_CODE_KEY, code.toUpperCase());
}

export function getPairCode(): string | null {
  return localStorage.getItem(PAIR_CODE_KEY);
}

// ─── Status Shape ─────────────────────────────────────────

export interface PartnerStatus {
  pair_code: string;
  fertility_status: string;
  cycle_day: number;
  phase: string;
  recommendation: string;
  theme_id: string;
  updated_at: string;
}

// ─── Her Side: Push Status ────────────────────────────────

export async function pushStatus(data: {
  fertilityStatus: string;
  cycleDay: number;
  phase: string;
  recommendation: string;
}): Promise<boolean> {
  const client = getClient();
  const pairCode = getPairCode();
  if (!client || !pairCode) return false;

  const themeId = localStorage.getItem('iyla_signal_theme') || 'topgun';

  const { error } = await client
    .from('partner_sync')
    .upsert({
      pair_code: pairCode,
      fertility_status: data.fertilityStatus,
      cycle_day: data.cycleDay,
      phase: data.phase,
      recommendation: data.recommendation,
      theme_id: themeId,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'pair_code' });

  if (error) {
    console.warn('[iyla sync] push failed:', error.message);
    return false;
  }
  return true;
}

// ─── His Side: Pull Status ────────────────────────────────

export async function pullStatus(): Promise<PartnerStatus | null> {
  const client = getClient();
  const pairCode = getPairCode();
  if (!client || !pairCode) return null;

  const { data, error } = await client
    .from('partner_sync')
    .select('*')
    .eq('pair_code', pairCode)
    .single();

  if (error || !data) {
    console.warn('[iyla sync] pull failed:', error?.message);
    return null;
  }
  return data as PartnerStatus;
}

// ─── His Side: Realtime Subscription ──────────────────────

let activeChannel: RealtimeChannel | null = null;

export function subscribeToStatus(
  onUpdate: (status: PartnerStatus) => void,
): (() => void) | null {
  const client = getClient();
  const pairCode = getPairCode();
  if (!client || !pairCode) return null;

  // Clean up previous subscription
  if (activeChannel) {
    client.removeChannel(activeChannel);
  }

  activeChannel = client
    .channel(`partner_sync:${pairCode}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'partner_sync',
        filter: `pair_code=eq.${pairCode}`,
      },
      (payload) => {
        if (payload.new) {
          onUpdate(payload.new as PartnerStatus);
        }
      },
    )
    .subscribe();

  return () => {
    if (activeChannel && client) {
      client.removeChannel(activeChannel);
      activeChannel = null;
    }
  };
}
