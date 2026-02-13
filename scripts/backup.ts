import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const BACKUPS_DIR = path.resolve(process.cwd(), "backups");
const MAX_BACKUPS = 7;

function log(msg: string): void {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${msg}`);
}

function validateEnv(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("ERROR: DATABASE_URL is not set. Cannot proceed with backup.");
    process.exit(1);
  }
  return url;
}

function ensureBackupsDir(): void {
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    log(`Created backups directory: ${BACKUPS_DIR}`);
  }
}

function generateFilename(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `backup_${ts}.sql`;
}

function runBackup(dbUrl: string, filePath: string): void {
  log("Starting database backup...");
  const start = Date.now();

  try {
    execSync(`pg_dump "${dbUrl}" --no-owner --no-acl -f "${filePath}"`, {
      timeout: 300_000,
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (err: any) {
    const stderr = err.stderr?.toString() || "";
    console.error("ERROR: pg_dump failed.");
    if (stderr) {
      const safe = stderr.replace(/postgresql:\/\/[^\s]+/g, "postgresql://***");
      console.error(safe);
    }
    process.exit(1);
  }

  const durationMs = Date.now() - start;
  const stats = fs.statSync(filePath);
  const sizeKb = (stats.size / 1024).toFixed(1);

  log(`Backup file: ${path.basename(filePath)}`);
  log(`Backup size: ${sizeKb} KB`);
  log(`Duration:    ${(durationMs / 1000).toFixed(1)}s`);
}

function cleanupOldBackups(): void {
  const files = fs.readdirSync(BACKUPS_DIR)
    .filter((f) => f.startsWith("backup_") && f.endsWith(".sql"))
    .sort();

  if (files.length <= MAX_BACKUPS) {
    log(`Retention: ${files.length}/${MAX_BACKUPS} backups, no cleanup needed.`);
    return;
  }

  const toDelete = files.slice(0, files.length - MAX_BACKUPS);
  for (const f of toDelete) {
    fs.unlinkSync(path.join(BACKUPS_DIR, f));
    log(`Deleted old backup: ${f}`);
  }
  log(`Retention: kept ${MAX_BACKUPS}, deleted ${toDelete.length}.`);
}

function main() {
  console.log("\n  DATABASE BACKUP");
  console.log("  " + new Date().toISOString() + "\n");

  const dbUrl = validateEnv();
  ensureBackupsDir();

  const filename = generateFilename();
  const filePath = path.join(BACKUPS_DIR, filename);

  runBackup(dbUrl, filePath);
  cleanupOldBackups();

  log("Backup complete.\n");
}

main();
