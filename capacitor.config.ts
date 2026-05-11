import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.trocacopa.app",
  appName: "TrocaCopa",
  webDir: "dist-android",

  android: {
    buildOptions: {
      releaseType: "APK",
    },
  },

  server: {
    androidScheme: "https",
    cleartext: false,
  },

  plugins: {
    Browser: {
      presentationStyle: "fullscreen",
    },
  },
};

export default config;
