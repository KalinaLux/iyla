// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

export interface CoupleScoreSharedFactor {
  label: string;
  score: number;                        // 0-100
  note?: string;
}

export interface CoupleScore {
  total: number;                        // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  herContribution: number;              // 0-100
  hisContribution: number;              // 0-100 (0 when his data unavailable)
  sharedFactors: CoupleScoreSharedFactor[];
  narrative: string;
  teamworkBonus: number;                // 0-10
  computedAt: string;
}

export interface CoupleScoreInput {
  iylaTotal: number;                            // her total
  iylaDomains: Array<{ id: string; score: number }>;
  dadTotal: number | null;                      // null if his data unavailable
  dadDomains: Array<{ id: string; score: number }> | null;
  fertileWindowIntercourseCount: number;        // # of times this cycle
  fertileWindowDayCount: number;                // # of fertile days so far
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

function clamp(v: number, lo = 0, hi = 100): number {
  if (!Number.isFinite(v)) return lo;
  return Math.min(hi, Math.max(lo, v));
}

function gradeFromTotal(total: number): CoupleScore['grade'] {
  if (total >= 90) return 'A';
  if (total >= 80) return 'B';
  if (total >= 70) return 'C';
  if (total >= 60) return 'D';
  return 'F';
}

/**
 * Domain synonyms from each side that map onto a shared theme.
 * We average matching domain scores (when available) to express "we".
 */
const SHARED_THEMES: Array<{
  label: string;
  herIds: string[];
  hisIds: string[];
}> = [
  { label: 'Lifestyle together', herIds: ['lifestyle'], hisIds: ['lifestyle'] },
  { label: 'Sleep rhythm', herIds: ['lifestyle'], hisIds: ['sleep'] },
  { label: 'Supplement consistency', herIds: ['lifestyle', 'labs'], hisIds: ['supplements', 'consistency'] },
];

function collectSharedFactors(
  iylaDomains: CoupleScoreInput['iylaDomains'],
  dadDomains: CoupleScoreInput['dadDomains'],
): CoupleScoreSharedFactor[] {
  if (!dadDomains) return [];
  const herById = new Map(iylaDomains.map((d) => [d.id, d.score]));
  const hisById = new Map(dadDomains.map((d) => [d.id, d.score]));

  const factors: CoupleScoreSharedFactor[] = [];
  for (const theme of SHARED_THEMES) {
    const herScores = theme.herIds.map((id) => herById.get(id)).filter((v): v is number => v != null);
    const hisScores = theme.hisIds.map((id) => hisById.get(id)).filter((v): v is number => v != null);
    if (herScores.length === 0 && hisScores.length === 0) continue;
    const allScores = [...herScores, ...hisScores];
    const avg = allScores.reduce((a, b) => a + b, 0) / allScores.length;
    factors.push({ label: theme.label, score: Math.round(avg) });
  }
  return factors;
}

function buildNarrative(
  total: number,
  herContribution: number,
  hisContribution: number,
  teamworkBonus: number,
  bothAvailable: boolean,
): string {
  if (!bothAvailable) {
    if (total >= 80) return "You're driving strong fertility signals — his data will round out the picture when you're ready.";
    if (total >= 65) return "You're doing thoughtful work here. Looping your partner in will give you a fuller view.";
    return "You're the one tracking right now — that still counts for a lot. Inviting your partner will unlock the team view.";
  }

  const close = Math.abs(herContribution - hisContribution) <= 8;
  const bonusPhrase = teamworkBonus >= 7
    ? " You're nailing your fertile-window timing — that's real teamwork."
    : teamworkBonus >= 3
      ? ' Good fertile-window coverage this cycle.'
      : '';

  if (total >= 85) return `You two are in sync and showing up for this together.${bonusPhrase}`;
  if (total >= 70) {
    if (close) return `You're moving as a team — both of your efforts are pulling in the same direction.${bonusPhrase}`;
    if (herContribution > hisContribution) return `You're carrying momentum — a little more from his side will lift you further.${bonusPhrase}`;
    return `He's showing up strong — your data will round out the team picture.${bonusPhrase}`;
  }
  if (total >= 55) return `There's room for both of you to grow here — small, shared habits compound fast.${bonusPhrase}`;
  return `This is the early chapter. Every log and every conversation is progress you're making together.${bonusPhrase}`;
}

// ─────────────────────────────────────────────────────────────────────────
// Public
// ─────────────────────────────────────────────────────────────────────────

/**
 * Combine her iyla score + his Dad score into a single couple-level metric.
 *
 * If his data is unavailable, the couple score falls back to her total and
 * his contribution is reported as 0. A small "teamwork bonus" rewards
 * intercourse coverage of the fertile window (capped at +10).
 */
export function computeCoupleScore(input: CoupleScoreInput): CoupleScore {
  const {
    iylaTotal,
    iylaDomains,
    dadTotal,
    dadDomains,
    fertileWindowIntercourseCount,
    fertileWindowDayCount,
  } = input;

  const herContribution = clamp(Math.round(iylaTotal));
  const hisContribution = dadTotal != null ? clamp(Math.round(dadTotal)) : 0;
  const bothAvailable = dadTotal != null;

  const teamworkBonus =
    fertileWindowDayCount > 0
      ? clamp(Math.round((fertileWindowIntercourseCount / fertileWindowDayCount) * 10), 0, 10)
      : 0;

  let base: number;
  if (bothAvailable) {
    base = herContribution * 0.55 + hisContribution * 0.45;
  } else {
    base = herContribution;
  }
  const total = clamp(Math.round(base + teamworkBonus));

  const sharedFactors = collectSharedFactors(iylaDomains, dadDomains);

  return {
    total,
    grade: gradeFromTotal(total),
    herContribution,
    hisContribution,
    sharedFactors,
    narrative: buildNarrative(total, herContribution, hisContribution, teamworkBonus, bothAvailable),
    teamworkBonus,
    computedAt: new Date().toISOString(),
  };
}
