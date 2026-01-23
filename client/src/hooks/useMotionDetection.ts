import { useState, useEffect, useCallback, useRef } from 'react';
import { setMovementState, getMovementState, MovementState } from '@/lib/offlineDb';

const SPEED_THRESHOLD_MPH = 12;
const SUSTAINED_DURATION_MS = 50000;
const METERS_PER_SECOND_TO_MPH = 2.237;

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
  
  const watchIdRef = useRef<number | null>(null);
  const speedHistoryRef = useRef<number[]>([]);
  const movementStartRef = useRef<number | null>(null);

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
    const speedMps = position.coords.speed;
    
    if (speedMps === null || speedMps < 0) {
      return;
    }

    const speedMph = speedMps * METERS_PER_SECOND_TO_MPH;
    speedHistoryRef.current.push(speedMph);
    
    if (speedHistoryRef.current.length > 20) {
      speedHistoryRef.current.shift();
    }

    const isAboveThreshold = speedMph > SPEED_THRESHOLD_MPH;
    const now = Date.now();

    if (isAboveThreshold) {
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
      movementStartRef.current = null;
      speedHistoryRef.current = [];
      
      if (movementState.isMoving) {
        updateState({
          isMoving: false,
          movementConfidence: 'low',
          movementStartTime: null,
        });
      }
    }
  }, [calculateConfidence, updateState, movementState.isMoving]);

  useEffect(() => {
    if (!enabled || !('geolocation' in navigator)) {
      return;
    }

    getMovementState().then(setLocalMovementState);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (watchIdRef.current === null) {
          watchIdRef.current = navigator.geolocation.watchPosition(
            handlePosition,
            () => {
              // Silent failure
            },
            {
              enableHighAccuracy: true,
              maximumAge: 5000,
              timeout: 10000,
            }
          );
        }
      } else {
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    if (document.visibilityState === 'visible') {
      watchIdRef.current = navigator.geolocation.watchPosition(
        handlePosition,
        () => {},
        {
          enableHighAccuracy: true,
          maximumAge: 5000,
          timeout: 10000,
        }
      );
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [enabled, handlePosition]);

  return movementState;
}
