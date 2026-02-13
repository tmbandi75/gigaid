import { execFileSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

const BACKUPS_DIR = path.resolve(process.cwd(), "backups");

function log(msg: string): void {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${msg}`);
}

function validateEnv(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("ERROR: DATABASE_URL is not set. Cannot proceed with restore.");
    process.exit(1);
  }
  return url;
}

function resolveBackupFile(): string {
  const fileArg = process.argv.find((a) => a.startsWith("--file="));
  if (fileArg) {
    const filePath = fileArg.split("=")[1];
    const resolved = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
    if (!fs.existsSync(resolved)) {
      console.error(`ERROR: Backup file not found: ${resolved}`);
      process.exit(1);
    }
    return resolved;
  }

  if (!fs.existsSync(BACKUPS_DIR)) {
    console.error("ERROR: No backups directory found. Run a backup first.");
    process.exit(1);
  }

  const files = fs.readdirSync(BACKUPS_DIR)
    .filter((f) => f.startsWith("backup_") && f.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.error("ERROR: No backup files found in backups/ directory.");
    process.exit(1);
  }

  const latest = files[files.length - 1];
  log(`No --file specified. Using latest backup: ${latest}`);
  return path.join(BACKUPS_DIR, latest);
}

function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
}

async function main() {
  console.log("\n  DATABASE RESTORE");
  console.log("  " + new Date().toISOString() + "\n");

  const dbUrl = validateEnv();
  const backupFile = resolveBackupFile();
  const stats = fs.statSync(backupFile);
  const sizeKb = (stats.size / 1024).toFixed(1);

  log(`Backup file: ${path.basename(backupFile)}`);
  log(`File size:   ${sizeKb} KB`);

  if (process.env.NODE_ENV === "production") {
    console.warn("\n  *** WARNING: NODE_ENV is set to 'production' ***");
    console.warn("  *** You are about to restore a backup to the PRODUCTION database ***\n");
  }

  const skipConfirm = process.argv.includes("--yes");
  if (!skipConfirm) {
    const ok = await confirm(`\n  Restore ${path.basename(backupFile)} to the database? This will overwrite existing data. (y/N): `);
    if (!ok) {
      log("Restore cancelled by user.");
      process.exit(0);
    }
  }

  log("Starting database restore...");
  const start = Date.now();

  try {
    const sqlInput = fs.readFileSync(backupFile);
    execFileSync("psql", [dbUrl], {
      timeout: 300_000,
      input: sqlInput,
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (err: any) {
    const stderr = err.stderr?.toString() || "";
    const safe = stderr.replace(/postgresql:\/\/[^\s]+/g, "postgresql://***");
    if (safe.includes("ERROR")) {
      console.error("Restore failed with errors:");
      console.error(safe);
      process.exit(1);
    }
  }

  const durationMs = Date.now() - start;
  log(`Duration: ${(durationMs / 1000).toFixed(1)}s`);
  log("Restore complete.\n");
}

main();
