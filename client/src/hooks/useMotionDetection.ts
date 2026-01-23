import { useState, useEffect, useCallback, useRef } from 'react';
import { setMovementState, getMovementState, MovementState } from '@/lib/offlineDb';

const SPEED_THRESHOLD_MPH = 12;
const SUSTAINED_DURATION_MS = 5000; // 5 seconds for testing (was 50 seconds)
const METERS_PER_SECOND_TO_MPH = 2.237;
const SPEED_DROP_TOLERANCE = 3; // Allow brief dips below threshold

export type GpsStatus = 'inactive' | 'requesting' | 'active' | 'error' | 'denied';

interface MotionDetectionOptions {
  enabled?: boolean;
}

export function useMotionDetection(options: MotionDetectionOptions = {}) {
  const { enabled = true } = options;
  const [movementState, setLocalMovementState] = useState<MovementState>({
    isMoving: false,
    movementConfidence: 'low',
    movementStartTime: null,
  });
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>('inactive');
  const [currentSpeed, setCurrentSpeed] = useState<number | null>(null);
  
  const watchIdRef = useRef<number | null>(null);
  const speedHistoryRef = useRef<number[]>([]);
  const movementStartRef = useRef<number | null>(null);
  const belowThresholdCountRef = useRef<number>(0);

  const calculateConfidence = useCallback((speeds: number[]): 'low' | 'medium' | 'high' => {
    if (speeds.length < 3) return 'low';
    
    const recentSpeeds = speeds.slice(-10);
    const avgSpeed = recentSpeeds.reduce((a, b) => a + b, 0) / recentSpeeds.length;
    const aboveThreshold = recentSpeeds.filter(s => s > SPEED_THRESHOLD_MPH).length;
    const ratio = aboveThreshold / recentSpeeds.length;

    if (ratio >= 0.9 && avgSpeed > SPEED_THRESHOLD_MPH * 1.5) return 'high';
    if (ratio >= 0.7) return 'medium';
    return 'low';
  }, []);

  const updateState = useCallback(async (newState: Partial<MovementState>) => {
    const current = await getMovementState();
    const updated = { ...current, ...newState };
    await setMovementState(updated);
    setLocalMovementState(updated);
  }, []);

  const handlePosition = useCallback((position: GeolocationPosition) => {
    setGpsStatus('active');
    const speedMps = position.coords.speed;
    
    if (speedMps === null || speedMps < 0) {
      setCurrentSpeed(null);
      return;
    }

    const speedMph = speedMps * METERS_PER_SECOND_TO_MPH;
    setCurrentSpeed(Math.round(speedMph));
    speedHistoryRef.current.push(speedMph);
    
    if (speedHistoryRef.current.length > 20) {
      speedHistoryRef.current.shift();
    }

    const isAboveThreshold = speedMph > SPEED_THRESHOLD_MPH;
    const now = Date.now();

    if (isAboveThreshold) {
      belowThresholdCountRef.current = 0;
      
      if (!movementStartRef.current) {
        movementStartRef.current = now;
      }

      const duration = now - movementStartRef.current;
      
      if (duration >= SUSTAINED_DURATION_MS) {
        const confidence = calculateConfidence(speedHistoryRef.current);
        updateState({
          isMoving: true,
          movementConfidence: confidence,
          movementStartTime: movementStartRef.current,
        });
      }
    } else {
      belowThresholdCountRef.current++;
      
      if (belowThresholdCountRef.current >= SPEED_DROP_TOLERANCE) {
        movementStartRef.current = null;
        speedHistoryRef.current = [];
        belowThresholdCountRef.current = 0;
        
        if (movementState.isMoving) {
          updateState({
            isMoving: false,
            movementConfidence: 'low',
            movementStartTime: null,
          });
        }
      }
    }
  }, [calculateConfidence, updateState, movementState.isMoving]);

  const handleError = useCallback((error: GeolocationPositionError) => {
    if (error.code === error.PERMISSION_DENIED) {
      setGpsStatus('denied');
    } else {
      setGpsStatus('error');
    }
  }, []);

  useEffect(() => {
    if (!enabled || !('geolocation' in navigator)) {
      setGpsStatus('inactive');
      return;
    }

    getMovementState().then(setLocalMovementState);

    const startWatching = () => {
      if (watchIdRef.current === null) {
        setGpsStatus('requesting');
        watchIdRef.current = navigator.geolocation.watchPosition(
          handlePosition,
          handleError,
          {
            enableHighAccuracy: true,
            maximumAge: 5000,
            timeout: 10000,
          }
        );
      }
    };

    const stopWatching = () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
        setGpsStatus('inactive');
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        startWatching();
      } else {
        stopWatching();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    if (document.visibilityState === 'visible') {
      startWatching();
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopWatching();
    };
  }, [enabled, handlePosition, handleError]);

  return { ...movementState, gpsStatus, currentSpeed };
}
