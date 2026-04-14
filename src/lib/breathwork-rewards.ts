import Dexie, { type EntityTable } from 'dexie';

export interface BreathworkLog {
  id?: number;
  date: string;
  sessionId: string;
  sessionName: string;
  category: string;
  durationMin: number;
  isCouples: boolean;
  pointsEarned: number;
  completedAt: string;
}

export interface BreathworkReward {
  id?: number;
  milestoneKey: string;
  rewardText: string;
  claimedAt?: string;
}

export interface Milestone {
  key: string;
  streakDays: number;
  label: string;
  emoji: string;
  description: string;
  defaultReward: string;
}

export const MILESTONES: Milestone[] = [
  { key: 'spark', streakDays: 3, label: 'Spark', emoji: '🔥', description: '3-day streak', defaultReward: 'Cook each other\'s favorite meal' },
  { key: 'flame', streakDays: 7, label: 'Flame', emoji: '🕯️', description: '7-day streak — one full week', defaultReward: 'Massage night' },
  { key: 'glow', streakDays: 14, label: 'Glow', emoji: '✨', description: '14-day streak — two weeks strong', defaultReward: 'Dinner out together' },
  { key: 'radiance', streakDays: 21, label: 'Radiance', emoji: '🌟', description: '21 days — a habit is born', defaultReward: 'Spa day' },
  { key: 'illumination', streakDays: 30, label: 'Illumination', emoji: '💫', description: '30 days — one full cycle', defaultReward: 'Weekend getaway' },
  { key: 'transcendence', streakDays: 60, label: 'Transcendence', emoji: '🌊', description: '60 days — two full cycles', defaultReward: 'Something extraordinary together' },
  { key: 'aquaarian', streakDays: 100, label: 'AquaArian', emoji: '🏛️', description: '100 days — mastery', defaultReward: 'You\'ve earned something legendary' },
];

const breathworkDb = new Dexie('IylaBreathworkDB') as Dexie & {
  logs: EntityTable<BreathworkLog, 'id'>;
  rewards: EntityTable<BreathworkReward, 'id'>;
};

breathworkDb.version(1).stores({
  logs: '++id, date, sessionId, category, isCouples',
  rewards: '++id, milestoneKey',
});

export { breathworkDb };

export function calculatePoints(durationMin: number, isCouples: boolean, currentStreak: number): number {
  const base = isCouples ? 25 : 10;
  const streakBonus = Math.min(currentStreak, 30) * 5;
  const durationBonus = Math.floor(durationMin / 5) * 2;
  return base + streakBonus + durationBonus;
}

export function calculateStreak(logs: BreathworkLog[]): number {
  if (logs.length === 0) return 0;

  const uniqueDates = [...new Set(logs.map((l) => l.date))].sort().reverse();

  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  if (uniqueDates[0] !== today && uniqueDates[0] !== yesterday) return 0;

  let streak = 1;
  for (let i = 1; i < uniqueDates.length; i++) {
    const prev = new Date(uniqueDates[i - 1]);
    const curr = new Date(uniqueDates[i]);
    const diffMs = prev.getTime() - curr.getTime();
    const diffDays = Math.round(diffMs / 86400000);
    if (diffDays === 1) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

export function getReachedMilestones(streak: number): Milestone[] {
  return MILESTONES.filter((m) => streak >= m.streakDays);
}

export function getNextMilestone(streak: number): Milestone | null {
  return MILESTONES.find((m) => streak < m.streakDays) ?? null;
}

export function getNewlyReachedMilestone(oldStreak: number, newStreak: number): Milestone | null {
  return MILESTONES.find((m) => oldStreak < m.streakDays && newStreak >= m.streakDays) ?? null;
}
