// Learn more: https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// expo-sqlite's web implementation loads its bundled wa-sqlite engine via
// `import ... from './wa-sqlite/wa-sqlite.wasm'`. Metro must treat .wasm as an
// asset for that import to resolve when running the app in the browser.
if (!config.resolver.assetExts.includes("wasm")) {
  config.resolver.assetExts = [...config.resolver.assetExts, "wasm"];
}

// The synchronous SQLite API (openDatabaseSync) runs in a Web Worker backed by
// SharedArrayBuffer, which browsers only enable on cross-origin-isolated pages.
// The dev server must send COOP/COEP headers for the app to work in the browser.
// (Native Android/iOS builds are unaffected — they use the native SQLite module.)
config.server = config.server ?? {};
const baseEnhanceMiddleware = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = (middleware, server) => {
  const enhanced = baseEnhanceMiddleware
    ? baseEnhanceMiddleware(middleware, server)
    : middleware;
  return (req, res, next) => {
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
    return enhanced(req, res, next);
  };
};

module.exports = withNativeWind(config, { input: "./global.css" });
