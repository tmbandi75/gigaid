import type { CapacitorConfig } from '@capacitor/cli';

const isProduction =
  process.env.NODE_ENV === 'production' ||
  process.env.VITE_APP_ENV === 'production';

const config: CapacitorConfig = {
  appId: 'com.gigaid.app',
  appName: 'Gig Aid',
  webDir: 'dist/public',
  server: {
    url: isProduction ? 'https://gig-aid--thierrymbandi.replit.app' : 'http://192.168.100.92:3000',
    androidScheme: 'https',
    iosScheme: 'https',
    cleartext: !isProduction,
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
    // Phone provider: https://github.com/capawesome-team/capacitor-firebase/blob/main/packages/authentication/docs/setup-phone.md
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ['google.com', 'apple.com', 'phone'],
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
