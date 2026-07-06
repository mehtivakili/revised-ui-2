import type { CapacitorConfig } from "@capacitor/cli";

const serverUrl = process.env.CAPACITOR_SERVER_URL;

const config: CapacitorConfig = {
  appId: "com.persiasystem.hamyardoorbin",
  appName: "همیار دوربین",
  webDir: "capacitor-web",
  plugins: {
    SplashScreen: {
      launchShowDuration: 3000,
      launchAutoHide: true,
      backgroundColor: "#e2f2fb",
      androidSplashResourceName: "splash_screen",
      androidScaleType: "CENTER_CROP",
      splashFullScreen: true,
      showSpinner: false
    },
    StatusBar: {
      style: "LIGHT",
      backgroundColor: "#e2f2fb"
    }
  },
  ...(serverUrl
    ? {
        server: {
          url: serverUrl,
          cleartext: serverUrl.startsWith("http://")
        }
      }
    : {})
};

export default config;
