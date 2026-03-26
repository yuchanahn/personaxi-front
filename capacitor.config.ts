import type { CapacitorConfig } from "@capacitor/cli";

const externalServerUrl = process.env.CAP_SERVER_URL?.trim();

const config: CapacitorConfig = {
  appId: "com.personaxi.app",
  appName: "PXI",
  webDir: "build",
  bundledWebRuntime: false,
  plugins: {
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
