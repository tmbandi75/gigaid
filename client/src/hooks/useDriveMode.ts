import { useState, useEffect, useCallback } from 'react';
import { 
  getDriveModePreference, 
  setDriveModePreference, 
  DriveModePreference 
} from '@/lib/offlineDb';
import { useMotionDetection, GpsStatus } from './useMotionDetection';

export function useDriveMode() {
  const [isDriveMode, setIsDriveMode] = useState(false);
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [preference, setPreference] = useState<DriveModePreference>({
    driveModePreference: 'unknown',
    driveModeDeclineCount: 0,
    lastPromptedAt: null,
  });

  const motionData = useMotionDetection({ enabled: !isDriveMode });
  const { isMoving, movementConfidence, movementStartTime, gpsStatus, currentSpeed } = motionData;

  useEffect(() => {
    getDriveModePreference().then(setPreference);
  }, []);

  useEffect(() => {
    const shouldShow = 
      isMoving &&
      (movementConfidence === 'medium' || movementConfidence === 'high') &&
      preference.driveModePreference === 'unknown' &&
      !isDriveMode;

    if (shouldShow && !showSuggestion) {
      setShowSuggestion(true);
    }
  }, [isMoving, movementConfidence, preference.driveModePreference, isDriveMode, showSuggestion]);

  const acceptDriveMode = useCallback(async () => {
    await setDriveModePreference({
      driveModePreference: 'accepted',
      lastPromptedAt: Date.now(),
    });
    setPreference(prev => ({ ...prev, driveModePreference: 'accepted' }));
    setShowSuggestion(false);
    setIsDriveMode(true);
  }, []);

  const declineDriveMode = useCallback(async () => {
    const newCount = preference.driveModeDeclineCount + 1;
    const newPref = newCount >= 2 ? 'declined' : 'unknown';
    
    await setDriveModePreference({
      driveModePreference: newPref,
      driveModeDeclineCount: newCount,
      lastPromptedAt: Date.now(),
    });
    
    setPreference(prev => ({
      ...prev,
      driveModePreference: newPref,
      driveModeDeclineCount: newCount,
    }));
    setShowSuggestion(false);
  }, [preference.driveModeDeclineCount]);

  const enterDriveMode = useCallback(() => {
    setIsDriveMode(true);
  }, []);

  const exitDriveMode = useCallback(() => {
    setIsDriveMode(false);
  }, []);

  const dismissSuggestion = useCallback(() => {
    setShowSuggestion(false);
  }, []);

  return {
    isDriveMode,
    showSuggestion,
    preference,
    movementState: { isMoving, movementConfidence, movementStartTime },
    gpsStatus,
    currentSpeed,
    acceptDriveMode,
    declineDriveMode,
    enterDriveMode,
    exitDriveMode,
    dismissSuggestion,
  };
}
