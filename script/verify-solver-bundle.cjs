/**
 * electron-builder `beforePack` hook.
 *
 * The packaged application must ship its own solver runtime — users are never
 * asked to install Python. Failing here (before a huge bundle is produced) is
 * better than silently shipping an app whose generation always errors.
 *
 * Build the bundle with:  npm run build:solver
 */
const fs = require("fs");
const path = require("path");

module.exports = async function (context) {
  const bundleDir = path.resolve("python-service", "dist", "timetable-solver");
  const binary = path.join(
    bundleDir,
    process.platform === "win32" ? "timetable-solver.exe" : "timetable-solver"
  );

  if (!fs.existsSync(binary)) {
    throw new Error(
      [
        "Solver bundle is missing — refusing to package an app without its scheduler.",
        `Expected: ${binary}`,
        "Run `npm run build:solver` first (requires PyInstaller in python-service/venv).",
        "To build the renderer/main process only, use `npm run build` + `npm run build:electron`.",
      ].join("\n")
    );
  }

  console.log(`✅ Solver bundle present: ${binary}`);
};
