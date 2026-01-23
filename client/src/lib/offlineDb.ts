import { openDB, DBSchema, IDBPDatabase } from 'idb';

export type OfflineActionType = 'ADD_NOTE' | 'UPDATE_STATUS' | 'CREATE_DRAFT' | 'VOICE_NOTE' | 'CAPTURE_PHOTO';
export type EntityType = 'job' | 'client';
export type AssetType = 'photo' | 'audio';

export interface OfflineAction {
  id: string;
  type: OfflineActionType;
  entityType: EntityType;
  entityId: string;
  payload: Record<string, unknown>;
  createdAt: number;
  synced: boolean;
}

export interface OfflineAsset {
  id: string;
  assetType: AssetType;
  blob: Blob;
  linkedActionId: string;
  uploaded: boolean;
}

export interface DriveModePreference {
  driveModePreference: 'unknown' | 'accepted' | 'declined';
  driveModeDeclineCount: number;
  lastPromptedAt: number | null;
}

export interface MovementState {
  isMoving: boolean;
  movementConfidence: 'low' | 'medium' | 'high';
  movementStartTime: number | null;
}

interface GigAidOfflineDB extends DBSchema {
  'offline_actions': {
    key: string;
    value: OfflineAction;
    indexes: {
      'by-created': number;
    };
  };
  'offline_assets': {
    key: string;
    value: OfflineAsset;
    indexes: {
      'by-action': string;
    };
  };
  'preferences': {
    key: string;
    value: DriveModePreference | MovementState;
  };
}

const DB_NAME = 'gigaid-offline';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<GigAidOfflineDB> | null = null;

export async function getOfflineDb(): Promise<IDBPDatabase<GigAidOfflineDB>> {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = await openDB<GigAidOfflineDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('offline_actions')) {
        const actionsStore = db.createObjectStore('offline_actions', { keyPath: 'id' });
        actionsStore.createIndex('by-created', 'createdAt');
      }

      if (!db.objectStoreNames.contains('offline_assets')) {
        const assetsStore = db.createObjectStore('offline_assets', { keyPath: 'id' });
        assetsStore.createIndex('by-action', 'linkedActionId');
      }

      if (!db.objectStoreNames.contains('preferences')) {
        db.createObjectStore('preferences', { keyPath: undefined });
      }
    },
  });

  return dbInstance;
}

export function generateId(): string {
  return crypto.randomUUID();
}

async function scheduleBackgroundSync(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  
  try {
    const registration = await navigator.serviceWorker.ready;
    if ('sync' in registration) {
      await (registration as ServiceWorkerRegistration & {
        sync: { register: (tag: string) => Promise<void> }
      }).sync.register('gigaid-sync');
    }
  } catch {
    // Background sync not supported
  }
}

export async function addOfflineAction(
  action: Omit<OfflineAction, 'id' | 'createdAt' | 'synced'>,
  explicitId?: string
): Promise<OfflineAction> {
  const db = await getOfflineDb();
  const fullAction: OfflineAction = {
    ...action,
    id: explicitId || generateId(),
    createdAt: Date.now(),
    synced: false,
  };
  await db.put('offline_actions', fullAction);
  
  scheduleBackgroundSync();
  
  return fullAction;
}

export async function addOfflineAsset(
  asset: Omit<OfflineAsset, 'id' | 'uploaded'>,
  explicitId?: string
): Promise<OfflineAsset> {
  const db = await getOfflineDb();
  const fullAsset: OfflineAsset = {
    ...asset,
    id: explicitId || generateId(),
    uploaded: false,
  };
  await db.put('offline_assets', fullAsset);
  return fullAsset;
}

export async function getUnsyncedActions(): Promise<OfflineAction[]> {
  const db = await getOfflineDb();
  const allActions = await db.getAll('offline_actions');
  return allActions
    .filter(action => !action.synced)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function getUnuploadedAssets(): Promise<OfflineAsset[]> {
  const db = await getOfflineDb();
  const allAssets = await db.getAll('offline_assets');
  return allAssets.filter(asset => !asset.uploaded);
}

export async function markActionSynced(actionId: string): Promise<void> {
  const db = await getOfflineDb();
  const action = await db.get('offline_actions', actionId);
  if (action) {
    action.synced = true;
    await db.put('offline_actions', action);
  }
}

export async function markAssetUploaded(assetId: string): Promise<void> {
  const db = await getOfflineDb();
  const asset = await db.get('offline_assets', assetId);
  if (asset) {
    asset.uploaded = true;
    await db.put('offline_assets', asset);
  }
}

export async function getAssetsByAction(actionId: string): Promise<OfflineAsset[]> {
  const db = await getOfflineDb();
  return db.getAllFromIndex('offline_assets', 'by-action', actionId);
}

export async function getDriveModePreference(): Promise<DriveModePreference> {
  const db = await getOfflineDb();
  const pref = await db.get('preferences', 'drive_mode') as DriveModePreference | undefined;
  return pref || {
    driveModePreference: 'unknown',
    driveModeDeclineCount: 0,
    lastPromptedAt: null,
  };
}

export async function setDriveModePreference(pref: Partial<DriveModePreference>): Promise<void> {
  const db = await getOfflineDb();
  const current = await getDriveModePreference();
  const updated = { ...current, ...pref };
  await db.put('preferences', updated, 'drive_mode');
}

export async function getMovementState(): Promise<MovementState> {
  const db = await getOfflineDb();
  const state = await db.get('preferences', 'movement_state') as MovementState | undefined;
  return state || {
    isMoving: false,
    movementConfidence: 'low',
    movementStartTime: null,
  };
}

export async function setMovementState(state: Partial<MovementState>): Promise<void> {
  const db = await getOfflineDb();
  const current = await getMovementState();
  const updated = { ...current, ...state };
  await db.put('preferences', updated, 'movement_state');
}

export async function getPendingActionCount(): Promise<number> {
  const actions = await getUnsyncedActions();
  return actions.length;
}

export async function getPendingAssetCount(): Promise<number> {
  const assets = await getUnuploadedAssets();
  return assets.length;
}

export async function clearSyncedData(): Promise<void> {
  const db = await getOfflineDb();
  
  const allActions = await db.getAll('offline_actions');
  const syncedActions = allActions.filter(action => action.synced);
  
  for (const action of syncedActions) {
    const assets = await getAssetsByAction(action.id);
    const allUploaded = assets.every(a => a.uploaded);
    if (allUploaded) {
      await db.delete('offline_actions', action.id);
      for (const asset of assets) {
        await db.delete('offline_assets', asset.id);
      }
    }
  }
}
