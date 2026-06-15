import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const apiDir = join(__dirname, "..");
const venvDir = join(apiDir, ".venv");
const isWin = process.platform === "win32";

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

function ensureEnvFile() {
  const envFile = join(apiDir, ".env");
  const envExample = join(apiDir, ".env.example");

  if (!existsSync(envFile) && existsSync(envExample)) {
    copyFileSync(envExample, envFile);
    console.log("已创建 .env，请配置 OPENAI_API_KEY");
  }
}

function ensureVenv(systemPython) {
  const venvPython = pythonInVenv();

  if (existsSync(venvPython)) {
    console.log("Python 虚拟环境已存在，跳过创建");
    return venvPython;
  }

  console.log("创建 Python 虚拟环境...");
  run(systemPython, ["-m", "venv", ".venv"]);
  return venvPython;
}

/**
 * 初始化 Python 环境
 * 1. 检查系统是否安装 Python 3.12+
 * 2. 创建 Python 虚拟环境
 * 3. 安装 Python 依赖
 * 4. 创建 .env 文件
 * 5. 初始化完成
 * @returns {void}
 */
function main() {
  const systemPython = findSystemPython();
  if (!systemPython) {
    console.error("错误：未找到 Python，请先安装 Python 3.12+");
    process.exit(1);
  }

  console.log(`使用 ${systemPython} 初始化 Python 环境...`);
  const venvPython = ensureVenv(systemPython);

  console.log("安装 Python 依赖（requirements-lock.txt）...");
  run(venvPython, ["-m", "pip", "install", "-r", "requirements-lock.txt"]);

  ensureEnvFile();
  console.log("Python 环境初始化完成");
}

main();
