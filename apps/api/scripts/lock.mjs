import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const apiDir = join(__dirname, "..");
const venvDir = join(apiDir, ".venv");
const isWin = process.platform === "win32";

function pythonInVenv() {
  return join(venvDir, isWin ? "Scripts/python.exe" : "bin/python");
}

function pipCompileInVenv() {
  return join(venvDir, isWin ? "Scripts/pip-compile.exe" : "bin/pip-compile");
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

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    stdio: "inherit",
    shell: isWin,
    cwd: apiDir,
    ...options,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function ensureVenv(systemPython) {
  const venvPython = pythonInVenv();

  if (existsSync(venvPython)) {
    return venvPython;
  }

  console.log("创建 Python 虚拟环境...");
  run(systemPython, ["-m", "venv", ".venv"]);
  return venvPython;
}

function ensurePipTools(venvPython) {
  const pipCompile = pipCompileInVenv();
  if (existsSync(pipCompile)) {
    return pipCompile;
  }

  console.log("安装 pip-tools...");
  run(venvPython, ["-m", "pip", "install", "pip-tools"]);
  return pipCompile;
}

function main() {
  const systemPython = findSystemPython();
  if (!systemPython) {
    console.error("错误：未找到 Python，请先安装 Python 3.12+");
    process.exit(1);
  }

  const venvPython = ensureVenv(systemPython);
  const pipCompile = ensurePipTools(venvPython);

  console.log("根据 requirements.txt 生成 requirements-lock.txt ...");
  run(pipCompile, [
    "requirements.txt",
    "-o",
    "requirements-lock.txt",
    "--strip-extras",
  ]);

  console.log("Python 依赖锁文件已更新");
}

main();
