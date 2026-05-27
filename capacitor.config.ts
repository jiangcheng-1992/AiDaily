import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.aicircle.app",
  appName: "AI圈",
  webDir: "public",
  server: {
    url: "https://aidaily-production.up.railway.app",
    cleartext: false,
    androidScheme: "https",
  },
  android: {
    backgroundColor: "#f8fafc",
  },
};

export default config;
