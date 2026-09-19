/**
 * Bundles the Python solver service into a standalone binary with PyInstaller,
 * so the packaged desktop app never requires the user to install Python.
 *
 * Output: python-service/dist/timetable-solver/timetable-solver(.exe)
 * electron-builder copies that directory to <resources>/solver (see
 * electron-builder.yml), which is where SchedulerService looks for it.
 *
 * Verified requirement: PyInstaller must be installed in python-service/venv.
 *   python-service/venv/Scripts/python.exe -m pip install pyinstaller
 *
 * NOTE: ortools ships compiled extensions and data files, so --collect-all is
 * required; pandas is pulled in by ortools.sat.python.cp_model.
 */
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";

const serviceDir = path.resolve("python-service");
const venvPython =
  process.platform === "win32"
    ? path.join(serviceDir, "venv", "Scripts", "python.exe")
    : path.join(serviceDir, "venv", "bin", "python");

const python = fs.existsSync(venvPython)
  ? venvPython
  : process.platform === "win32"
    ? "python"
    : "python3";

if (!fs.existsSync(serviceDir)) {
  console.error(`❌ python-service directory not found at ${serviceDir}`);
  process.exit(1);
}

const args = [
  "-m", "PyInstaller",
  "--noconfirm",
  "--clean",
  "--onedir",
  "--name", "timetable-solver",
  "--distpath", "dist",
  "--workpath", "build",
  "--specpath", "build",
  "--collect-all", "ortools",
  "--collect-all", "pandas",
  "app.py",
];

console.log(`🔧 Bundling solver with ${python}`);
const result = spawnSync(python, args, { cwd: serviceDir, stdio: "inherit" });

if (result.error) {
  console.error("❌ Could not run PyInstaller:", result.error.message);
  console.error("   Install it first: python-service/venv/.../python -m pip install pyinstaller");
  process.exit(1);
}
if (result.status !== 0) {
  console.error(`❌ PyInstaller exited with code ${result.status}`);
  process.exit(result.status ?? 1);
}

const binary = path.join(
  serviceDir,
  "dist",
  "timetable-solver",
  process.platform === "win32" ? "timetable-solver.exe" : "timetable-solver"
);
if (!fs.existsSync(binary)) {
  console.error(`❌ Expected bundle not found at ${binary}`);
  process.exit(1);
}
console.log(`✅ Solver bundle ready: ${binary}`);
