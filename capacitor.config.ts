import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.maierhjakob.playmakeflag',
  appName: 'PlayMakeFlag',
  // Built with `npm run build:app` (relative base path instead of the GitHub Pages one)
  webDir: 'dist',
  plugins: {
    SystemBars: {
      // Light status bar icons on the dark app background
      style: 'DARK',
      initialViewportFitValueHint: 'cover',
    },
  },
};

export default config;
