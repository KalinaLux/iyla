import Dexie, { type EntityTable } from 'dexie';

export interface VaultDocument {
  id?: number;
  filename: string;
  type: string;
  mimeType: string;
  size: number;
  date: string;
  provider?: string;
  tags: string[];
  notes?: string;
  blob: Blob;
  createdAt: string;
}

export const vaultDb = new Dexie('IylaVaultDB') as Dexie & {
  documents: EntityTable<VaultDocument, 'id'>;
};

vaultDb.version(1).stores({
  documents: '++id, type, date, provider',
});
