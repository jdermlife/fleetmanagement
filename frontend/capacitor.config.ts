import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.quantech.filscore',
  appName: 'Financial Health FS',
  webDir: 'dist',
 
  server: {
    androidScheme: 'https',
  },
  android: {
    includePlugins: [
      '@capacitor/app',
      '@capacitor/keyboard',
      '@capacitor/splash-screen',
      '@capgo/capacitor-social-login',
      '@capgo/native-purchases',
    ],
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: '#b8860b',
      androidSplashResourceName: 'splash_transparent',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#b8860b',
    },
    SystemBars: {
      style: 'DARK',
      insetsHandling: 'css',
    },
    Keyboard: {
      resize: 'native',
      resizeOnFullScreen: true,
    },
    SocialLogin: {
      providers: {
        google: true,
        facebook: false,
        apple: true,
        twitter: false,
      },
      logLevel: 1,
    },
  },
};

export default config;
