import { copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const apiDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const envFile = join(apiDir, ".env");
const envExample = join(apiDir, ".env.example");

if (!existsSync(envFile) && existsSync(envExample)) {
  copyFileSync(envExample, envFile);
  console.log("已创建 .env，请配置 OPENAI_API_KEY");
}
