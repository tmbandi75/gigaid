import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

/**
 * Uses the native Capacitor Geolocation plugin on iOS/Android to trigger
 * the proper OS-level permission popup. Falls back to the browser
 * navigator.geolocation API when running on web.
 */

const isNative = Capacitor.isNativePlatform();

export interface GeoPosition {
  latitude: number;
  longitude: number;
  speed: number | null;
  accuracy: number;
}

export interface GeoOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}

/**
 * Requests location permissions on native platforms before fetching position.
 * This is what triggers the OS permission dialog on first use.
 */
async function ensurePermissions(): Promise<void> {
  if (!isNative) return;

  const status = await Geolocation.checkPermissions();
  if (status.location === 'prompt' || status.location === 'prompt-with-rationale') {
    await Geolocation.requestPermissions();
  }
}

/**
 * One-shot position fetch. On native platforms the Capacitor plugin handles
 * the OS permission dialog; on web it delegates to navigator.geolocation.
 */
export async function getCurrentPosition(options: GeoOptions = {}): Promise<GeoPosition> {
  await ensurePermissions();

  if (isNative) {
    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: options.enableHighAccuracy ?? true,
      timeout: options.timeout ?? 10000,
      maximumAge: options.maximumAge,
    });
    return {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      speed: pos.coords.speed,
      accuracy: pos.coords.accuracy,
    };
  }

  // Web fallback
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          speed: pos.coords.speed,
          accuracy: pos.coords.accuracy,
        }),
      (err) => reject(err),
      {
        enableHighAccuracy: options.enableHighAccuracy ?? true,
        timeout: options.timeout ?? 10000,
        maximumAge: options.maximumAge,
      },
    );
  });
}

/**
 * Continuous position watching. Returns a cleanup function to stop watching.
 * On native the Capacitor plugin provides a string-based watch ID;
 * on web it uses navigator.geolocation.watchPosition.
 */
export function watchPosition(
  onPosition: (pos: GeoPosition) => void,
  onError: (err: { code: number; message: string }) => void,
  options: GeoOptions = {},
): () => void {
  if (isNative) {
    let watchId: string | null = null;

    (async () => {
      try {
        await ensurePermissions();
        watchId = await Geolocation.watchPosition(
          {
            enableHighAccuracy: options.enableHighAccuracy ?? true,
            timeout: options.timeout ?? 10000,
            maximumAge: options.maximumAge,
          },
          (pos, err) => {
            if (err) {
              onError({ code: 1, message: err.message });
              return;
            }
            if (pos) {
              onPosition({
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                speed: pos.coords.speed,
                accuracy: pos.coords.accuracy,
              });
            }
          },
        );
      } catch (e: any) {
        onError({ code: 1, message: e?.message || 'Failed to watch position' });
      }
    })();

    return () => {
      if (watchId !== null) {
        Geolocation.clearWatch({ id: watchId });
      }
    };
  }

  // Web fallback
  if (!navigator.geolocation) {
    onError({ code: 2, message: 'Geolocation not supported' });
    return () => {};
  }

  const id = navigator.geolocation.watchPosition(
    (pos) =>
      onPosition({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        speed: pos.coords.speed,
        accuracy: pos.coords.accuracy,
      }),
    (err) => onError({ code: err.code, message: err.message }),
    {
      enableHighAccuracy: options.enableHighAccuracy ?? true,
      timeout: options.timeout ?? 10000,
      maximumAge: options.maximumAge,
    },
  );

  return () => navigator.geolocation.clearWatch(id);
}
