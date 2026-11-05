#!/usr/bin/env node
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  const distPath = resolve(__dirname, "../dist/index.js");
  if (existsSync(distPath)) {
    const mod = await import(pathToFileURL(distPath).href);
    await mod.runCli(process.argv);
  } else {
    try {
      const srcPath = resolve(__dirname, "../src/index.js");
      const mod = await import(pathToFileURL(srcPath).href);
      await mod.runCli(process.argv);
    } catch {
      console.error("Error: Please run 'npm run build' before executing payroll-cli.");
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error("CLI Execution Error:", err.message || err);
  process.exit(1);
});
