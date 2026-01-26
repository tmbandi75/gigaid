import { Capacitor } from '@capacitor/core';

/**
 * Check if the app is running as a native mobile app (iOS/Android via Capacitor)
 */
export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Get the current platform: 'ios', 'android', or 'web'
 */
export function getPlatform(): 'ios' | 'android' | 'web' {
  return Capacitor.getPlatform() as 'ios' | 'android' | 'web';
}

/**
 * Check if running on Android
 */
export function isAndroid(): boolean {
  return Capacitor.getPlatform() === 'android';
}

/**
 * Check if running on iOS
 */
export function isIOS(): boolean {
  return Capacitor.getPlatform() === 'ios';
}

/**
 * Check if running on web
 */
export function isWeb(): boolean {
  return Capacitor.getPlatform() === 'web';
}
