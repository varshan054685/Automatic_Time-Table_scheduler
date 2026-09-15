/**
 * Bundles the Electron main process and preload script with esbuild.
 * better-sqlite3 (native) and electron stay external.
 */
import { build } from "esbuild";
import { rm, mkdir } from "fs/promises";

async function buildElectron() {
  await rm("dist/electron", { recursive: true, force: true });
  await mkdir("dist/electron", { recursive: true });

  console.log("🚀 Building electron main...");
  await build({
    entryPoints: ["electron/main.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/electron/main.cjs",
    target: "node20",
    external: ["electron", "better-sqlite3"],
    define: { "process.env.NODE_ENV": '"production"' },
    sourcemap: false,
    logLevel: "info",
  });

  console.log("🚀 Building electron preload...");
  await build({
    entryPoints: ["electron/preload.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/electron/preload.cjs",
    target: "node20",
    external: ["electron"],
    sourcemap: false,
    logLevel: "info",
  });

  console.log("✅ Electron build complete");
}

buildElectron().catch((err) => {
  console.error("❌ Electron build failed:", err);
  process.exit(1);
});
