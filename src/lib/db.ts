import Dexie, { type EntityTable } from 'dexie';
import type { Cycle, DailyReading, LabResult, Supplement, SupplementProtocol, SupplementLog } from './types';

const db = new Dexie('IylaDB') as Dexie & {
  cycles: EntityTable<Cycle, 'id'>;
  readings: EntityTable<DailyReading, 'id'>;
  labs: EntityTable<LabResult, 'id'>;
  supplements: EntityTable<Supplement, 'id'>;
  protocols: EntityTable<SupplementProtocol, 'id'>;
  supplementLogs: EntityTable<SupplementLog, 'id'>;
};

db.version(1).stores({
  cycles: '++id, startDate, endDate, outcome',
  readings: '++id, date, cycleId, cycleDay',
  labs: '++id, date, testName, category',
  supplements: '++id, name, protocolId, isActive, sortOrder',
  protocols: '++id, name, isActive',
  supplementLogs: '++id, date, supplementId, timing',
});

export { db };
