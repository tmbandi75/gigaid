import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  addOfflineAction,
  addOfflineAsset,
  getPendingActionCount,
  getPendingAssetCount,
  OfflineActionType,
  EntityType,
  AssetType,
  generateId,
} from '@/lib/offlineDb';
import { getNetworkStatus, addNetworkListener, triggerSync } from '@/lib/offlineSync';

export function useNetworkStatus() {
  const [status, setStatus] = useState<'online' | 'offline'>(getNetworkStatus());

  useEffect(() => {
    return addNetworkListener(setStatus);
  }, []);

  return status;
}

export function usePendingSync() {
  const [pendingActions, setPendingActions] = useState(0);
  const [pendingAssets, setPendingAssets] = useState(0);

  const refresh = useCallback(async () => {
    const [actions, assets] = await Promise.all([
      getPendingActionCount(),
      getPendingAssetCount(),
    ]);
    setPendingActions(actions);
    setPendingAssets(assets);
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { pendingActions, pendingAssets, total: pendingActions + pendingAssets, refresh };
}

export function useOfflineActions() {
  const { toast } = useToast();
  const networkStatus = useNetworkStatus();

  const showSavedToast = useCallback(() => {
    if (networkStatus === 'offline') {
      toast({
        description: 'Saved — will sync when online',
        duration: 2000,
      });
    }
  }, [networkStatus, toast]);

  const saveNote = useCallback(async (
    entityType: EntityType,
    entityId: string,
    content: string
  ) => {
    await addOfflineAction({
      type: 'ADD_NOTE',
      entityType,
      entityId,
      payload: { content, timestamp: Date.now() },
    });
    showSavedToast();
    if (networkStatus === 'online') {
      triggerSync();
    }
  }, [networkStatus, showSavedToast]);

  const updateStatus = useCallback(async (
    entityType: EntityType,
    entityId: string,
    status: string
  ) => {
    await addOfflineAction({
      type: 'UPDATE_STATUS',
      entityType,
      entityId,
      payload: { status, timestamp: Date.now() },
    });
    showSavedToast();
    if (networkStatus === 'online') {
      triggerSync();
    }
  }, [networkStatus, showSavedToast]);

  const saveDraft = useCallback(async (
    entityType: EntityType,
    entityId: string,
    message: string,
    recipientId?: string
  ) => {
    await addOfflineAction({
      type: 'CREATE_DRAFT',
      entityType,
      entityId,
      payload: { message, recipientId, timestamp: Date.now() },
    });
    showSavedToast();
    if (networkStatus === 'online') {
      triggerSync();
    }
  }, [networkStatus, showSavedToast]);

  const capturePhoto = useCallback(async (
    entityType: EntityType,
    entityId: string,
    photoBlob: Blob,
    caption?: string
  ) => {
    const actionId = generateId();
    const localUri = URL.createObjectURL(photoBlob);

    await addOfflineAsset({
      assetType: 'photo',
      blob: photoBlob,
      linkedActionId: actionId,
    });

    await addOfflineAction({
      type: 'CAPTURE_PHOTO',
      entityType,
      entityId,
      payload: { caption, timestamp: Date.now() },
    }, actionId);

    showSavedToast();
    if (networkStatus === 'online') {
      triggerSync();
    }
    return localUri;
  }, [networkStatus, showSavedToast]);

  const saveVoiceNote = useCallback(async (
    entityType: EntityType,
    entityId: string,
    audioBlob: Blob,
    durationMs: number
  ) => {
    const actionId = generateId();
    const localUri = URL.createObjectURL(audioBlob);

    await addOfflineAsset({
      assetType: 'audio',
      blob: audioBlob,
      linkedActionId: actionId,
    });

    await addOfflineAction({
      type: 'VOICE_NOTE',
      entityType,
      entityId,
      payload: { durationMs, timestamp: Date.now() },
    }, actionId);

    showSavedToast();
    if (networkStatus === 'online') {
      triggerSync();
    }
    return localUri;
  }, [networkStatus, showSavedToast]);

  return {
    saveNote,
    updateStatus,
    saveDraft,
    capturePhoto,
    saveVoiceNote,
    isOffline: networkStatus === 'offline',
  };
}
