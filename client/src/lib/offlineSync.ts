import {
  getUnsyncedActions,
  getUnuploadedAssets,
  markActionSynced,
  markAssetUploaded,
  clearSyncedData,
  OfflineAction,
  OfflineAsset,
} from './offlineDb';
import { apiRequest } from './queryClient';

let isSyncing = false;
let networkStatus: 'online' | 'offline' = navigator.onLine ? 'online' : 'offline';

const listeners: Set<(status: 'online' | 'offline') => void> = new Set();

export function getNetworkStatus(): 'online' | 'offline' {
  return networkStatus;
}

export function addNetworkListener(callback: (status: 'online' | 'offline') => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function notifyListeners() {
  listeners.forEach(cb => cb(networkStatus));
}

window.addEventListener('online', () => {
  networkStatus = 'online';
  notifyListeners();
  triggerSync();
});

window.addEventListener('offline', () => {
  networkStatus = 'offline';
  notifyListeners();
});

async function uploadAsset(asset: OfflineAsset): Promise<boolean> {
  try {
    const formData = new FormData();
    formData.append('file', asset.blob, `${asset.id}.${asset.assetType === 'photo' ? 'jpg' : 'webm'}`);
    formData.append('assetId', asset.id);
    formData.append('assetType', asset.assetType);
    formData.append('linkedActionId', asset.linkedActionId);

    await fetch('/api/offline/assets', {
      method: 'POST',
      body: formData,
    });

    await markAssetUploaded(asset.id);
    return true;
  } catch {
    return false;
  }
}

async function executeAction(action: OfflineAction): Promise<boolean> {
  try {
    const endpoint = getEndpointForAction(action);
    const method = getMethodForAction(action);
    
    await apiRequest(method, endpoint, action.payload);
    await markActionSynced(action.id);
    return true;
  } catch {
    return false;
  }
}

function getEndpointForAction(action: OfflineAction): string {
  switch (action.type) {
    case 'ADD_NOTE':
      return `/api/${action.entityType}s/${action.entityId}/notes`;
    case 'UPDATE_STATUS':
      return `/api/${action.entityType}s/${action.entityId}/status`;
    case 'CREATE_DRAFT':
      return `/api/drafts`;
    case 'VOICE_NOTE':
      return `/api/${action.entityType}s/${action.entityId}/voice-notes`;
    case 'CAPTURE_PHOTO':
      return `/api/${action.entityType}s/${action.entityId}/photos`;
    default:
      return `/api/offline/actions`;
  }
}

function getMethodForAction(action: OfflineAction): 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' {
  switch (action.type) {
    case 'UPDATE_STATUS':
      return 'PATCH';
    default:
      return 'POST';
  }
}

export async function triggerSync(): Promise<{ synced: number; failed: number }> {
  if (isSyncing || networkStatus === 'offline') {
    return { synced: 0, failed: 0 };
  }

  isSyncing = true;
  let synced = 0;
  let failed = 0;

  try {
    const assets = await getUnuploadedAssets();
    for (const asset of assets) {
      const success = await uploadAsset(asset);
      if (success) synced++;
      else failed++;
    }

    const actions = await getUnsyncedActions();
    for (const action of actions) {
      const success = await executeAction(action);
      if (success) synced++;
      else failed++;
    }

    await clearSyncedData();
  } catch {
    // Silent failure - retry later
  } finally {
    isSyncing = false;
  }

  return { synced, failed };
}

export function initializeSync(): void {
  triggerSync();

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      triggerSync();
    }
  });

  setInterval(() => {
    if (networkStatus === 'online') {
      triggerSync();
    }
  }, 60000);
}
