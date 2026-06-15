import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const files = process.argv.slice(2).filter((file) => file.endsWith(".py"));
if (files.length === 0) {
  process.exit(0);
}

const apiDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const apiFiles = files.map((file) => file.replace(/^apps\/api\//, ""));

function runRuff(args) {
  const result = spawnSync("uv", ["run", "ruff", ...args, ...apiFiles], {
    stdio: "inherit",
    shell: false,
    cwd: apiDir,
  });
  return result.status ?? 1;
}

const formatStatus = runRuff(["format"]);
if (formatStatus !== 0) {
  process.exit(formatStatus);
}

process.exit(runRuff(["check", "--fix"]));
