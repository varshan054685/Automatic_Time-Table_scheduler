import { build } from "esbuild";
import { rm } from "fs/promises";

async function buildServer() {
  await rm("dist", { recursive: true, force: true });

  console.log("🚀 Building server...");

  await build({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: [
      "pg",
      "ws",
      "express",
      "cors",
      "jsonwebtoken",
      "passport",
      "passport-local",
      "express-session"
    ],
    logLevel: "info",
  });

  console.log("✅ Server build complete");
}

buildServer().catch((err) => {
  console.error("❌ Build failed:", err);
  process.exit(1);
});