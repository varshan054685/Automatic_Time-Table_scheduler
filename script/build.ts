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
    target: "node18",

    // ✅ IMPORTANT FIX
    external: [
      "pg",
      "bcrypt",
      "bcryptjs",
      "ws",
      "express",
      "cors",
      "jsonwebtoken",
      "passport",
      "passport-local",
      "express-session",
      "connect-pg-simple",
      "memorystore"
    ],

    define: {
      "process.env.NODE_ENV": '"production"',
    },

    minify: false,
    logLevel: "info",
  });

  console.log("✅ Server build complete");
}

buildServer().catch((err) => {
  console.error("❌ Build failed:", err);
  process.exit(1);
});