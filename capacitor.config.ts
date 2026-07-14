import type { CapacitorConfig } from "@capacitor/cli";

const serverUrl = process.env.CAPACITOR_SERVER_URL || "https://hamyardoorbin.ir";

const config: CapacitorConfig = {
  appId: "com.persiasystem.hamyardoorbin",
  appName: "همیار دوربین",
  webDir: "capacitor-web",
  plugins: {
    SplashScreen: {
      launchShowDuration: 500,
      launchAutoHide: true,
      backgroundColor: "#00143d",
      androidSplashResourceName: "splash_screen",
      androidScaleType: "FIT_CENTER",
      splashFullScreen: true,
      splashImmersive: true,
      showSpinner: false
    },
    StatusBar: {
      style: "LIGHT",
      backgroundColor: "#00143d",
      overlaysWebView: false
    }
  },
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith("http://")
  }
};

export default config;
