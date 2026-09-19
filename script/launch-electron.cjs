const { spawn } = require("child_process");
const electronPath = require("electron");

const args = process.argv.slice(2);
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

if (!args.includes("--smoke") && !env.ELECTRON_START_URL) {
  env.ELECTRON_START_URL = "http://localhost:5173";
}

const child = spawn(electronPath, [".", ...args], {
  stdio: "inherit",
  env,
});

child.on("close", (code) => {
  process.exit(code ?? 0);
});

child.on("error", (err) => {
  console.error("Failed to start electron:", err);
  process.exit(1);
});
