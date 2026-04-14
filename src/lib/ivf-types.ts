export type IVFProtocol = 'antagonist' | 'long-lupron' | 'mini-ivf' | 'natural' | 'fet';

export type IVFCycleStatus =
  | 'stimming'
  | 'triggered'
  | 'retrieved'
  | 'fertilization'
  | 'transfer'
  | 'beta'
  | 'complete';

export type PGTResult = 'normal' | 'abnormal' | 'mosaic' | 'no-result';

export interface IVFCycle {
  id: string;
  startDate: string;
  protocol: IVFProtocol;
  status: IVFCycleStatus;
  notes?: string;
}

export interface StimMedication {
  name: string;
  dose: number;
  unit: string;
  time: string;
}

export interface StimDay {
  id: string;
  ivfCycleId: string;
  dayNumber: number;
  date: string;
  medications: StimMedication[];
  estradiol?: number;
  liningThickness?: number;
  follicleCounts: {
    left: number[];
    right: number[];
  };
  notes?: string;
}

export interface EggRetrievalOutcome {
  id: string;
  ivfCycleId: string;
  date: string;
  eggsRetrieved: number;
  mature: number;
  fertilized: number;
  blastocysts: number;
  pgtNormal: number;
  pgtAbnormal: number;
  pgtNoResult: number;
  notes?: string;
}

export interface EmbryoGrade {
  id: string;
  ivfCycleId: string;
  embryoNumber: number;
  day: 3 | 5 | 6;
  grade: string;
  pgtResult: PGTResult;
  frozen: boolean;
  transferred: boolean;
  notes?: string;
}

export interface BetaHCG {
  id: string;
  ivfCycleId: string;
  date: string;
  value: number;
  dpt: number;
}

export interface LiningCheck {
  date: string;
  thickness: number;
}

export interface FETMedication {
  name: string;
  dose: number;
  unit: string;
  time: string;
}

export interface FETProtocol {
  id: string;
  ivfCycleId: string;
  medications: FETMedication[];
  liningChecks: LiningCheck[];
  transferDate?: string;
}

export const COMMON_IVF_MEDICATIONS = [
  'Gonal-F',
  'Menopur',
  'Cetrotide',
  'Ganirelix',
  'Lupron',
  'Ovidrel',
  'Pregnyl',
  'Progesterone in Oil',
  'Estrace',
  'Endometrin',
  'Letrozole',
  'Omnitrope',
  'Dexamethasone',
] as const;

export const IVF_PROTOCOL_LABELS: Record<IVFProtocol, string> = {
  antagonist: 'Antagonist',
  'long-lupron': 'Long Lupron',
  'mini-ivf': 'Mini IVF',
  natural: 'Natural Cycle',
  fet: 'Frozen Embryo Transfer',
};

export const IVF_STATUS_LABELS: Record<IVFCycleStatus, string> = {
  stimming: 'Stimming',
  triggered: 'Triggered',
  retrieved: 'Retrieved',
  fertilization: 'Fertilization Report',
  transfer: 'Transfer',
  beta: 'Beta hCG',
  complete: 'Complete',
};

export function calculateDoublingTime(
  beta1Value: number,
  beta1Date: string,
  beta2Value: number,
  beta2Date: string,
): number | null {
  if (beta1Value <= 0 || beta2Value <= 0) return null;

  const date1 = new Date(beta1Date).getTime();
  const date2 = new Date(beta2Date).getTime();
  const hoursDiff = Math.abs(date2 - date1) / (1000 * 60 * 60);

  if (hoursDiff === 0) return null;

  const doublingTime = (hoursDiff * Math.log(2)) / Math.log(beta2Value / beta1Value);
  return Math.round(doublingTime * 10) / 10;
}
