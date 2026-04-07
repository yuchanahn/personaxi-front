import type { CapacitorConfig } from "@capacitor/cli";
import { getBranding } from "./src/lib/branding/config";

const externalServerUrl = process.env.CAP_SERVER_URL?.trim();

const config: CapacitorConfig = {
  appId: "com.personaxi.app",
  appName: getBranding().publicBrandName,
  webDir: "build",
  bundledWebRuntime: false,
  plugins: {
    App: {
      disableBackButtonHandler: true,
    },
    Keyboard: {
      resizeOnFullScreen: true,
    },
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 250,
      showSpinner: false,
      backgroundColor: "#f5f6fb",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
    },
    StatusBar: {
      style: "DARK",
    },
    SocialLogin: {
      providers: {
        google: true,
        facebook: false,
        apple: false,
        twitter: false,
      },
      logLevel: 1,
    },
  },
  ...(externalServerUrl
    ? {
        server: {
          url: externalServerUrl,
          cleartext: externalServerUrl.startsWith("http://"),
        },
      }
    : {}),
};

export default config;
