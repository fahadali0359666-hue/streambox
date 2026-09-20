import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.streambox.app',
  appName: 'StreamBox',
  webDir: 'dist',
  server: { androidScheme: 'https' },
};

export default config;
