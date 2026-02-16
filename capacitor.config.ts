import type { CapacitorConfig } from '@capacitor/cli';

const isProduction =
  process.env.NODE_ENV === 'production' ||
  process.env.VITE_APP_ENV === 'production';

const config: CapacitorConfig = {
  appId: 'com.gigaid.app',
  appName: 'Gig Aid',
  webDir: 'dist/public',
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#ffffff',
      showSpinner: false,
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#ffffff',
    },
  },
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    backgroundColor: '#1565C0',
  },
  android: {
    allowMixedContent: !isProduction,
    captureInput: true,
    webContentsDebuggingEnabled: !isProduction,
    backgroundColor: '#1565C0',
  },
};

export default config;
