import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.aicircle.app",
  appName: "AI圈",
  webDir: "public",
  server: {
    url: "https://aiquan.me",
    cleartext: false,
    androidScheme: "https",
    allowNavigation: ["*"],
  },
  android: {
    backgroundColor: "#f8fafc",
  },
};

export default config;
