import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const apiDir = join(root, "apps", "api");
const venvDir = join(apiDir, ".venv");
const isWin = process.platform === "win32";
const args = process.argv.slice(2);

function pythonInVenv() {
  return join(venvDir, isWin ? "Scripts/python.exe" : "bin/python");
}

function findSystemPython() {
  for (const cmd of ["python", "python3"]) {
    const result = spawnSync(cmd, ["--version"], { shell: isWin, stdio: "pipe" });
    if (result.status === 0) {
      return cmd;
    }
  }
  return null;
}

function resolvePython() {
  const venvPython = pythonInVenv();
  if (existsSync(venvPython)) {
    return venvPython;
  }

  const systemPython = findSystemPython();
  if (systemPython) {
    console.warn("警告：未找到 apps/api/.venv，使用系统 Python。建议先执行 pnpm setup");
    return systemPython;
  }

  console.error("错误：未找到 Python 环境，请先执行 pnpm setup");
  process.exit(1);
}

const python = resolvePython();
const result = spawnSync(python, args, {
  stdio: "inherit",
  shell: false,
  cwd: apiDir,
});

process.exit(result.status ?? 1);
