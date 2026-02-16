#!/usr/bin/env node

/**
 * PII Log Scanner — CI/Build Gate
 * Scans server/ and client/ for console.log/warn/error/debug statements
 * that contain personally identifiable information (PII).
 * Supports multi-line console calls by extracting the full argument block.
 * Exits with code 1 if any violations found.
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { join, extname } from "path";

const SCAN_DIRS = ["server", "client", "src"];
const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);
const IGNORE_DIRS = new Set([
  "node_modules", "dist", "build", ".next", "coverage",
  "playwright-report", "attached_assets",
]);
const IGNORE_FILES = new Set([
  "pii-log-scan.js", "safeLogger.ts", "piiScan.test.ts",
]);

const PII_PROPERTY_PATTERNS = [
  /\.\s*(email|phone|personalPhone|clientPhone|clientEmail|phoneE164|emailNormalized|firebaseUid|uid|ssn|mobile)\b/i,
  /\$\{[^}]*(email|phone|uid|token|address|firebaseUid|personalPhone|clientPhone|clientEmail|phoneE164|emailNormalized|ssn|mobile)/i,
];

const PII_OBJECT_KEY_PATTERNS = [
  /\b(email|phone|personalPhone|clientPhone|clientEmail|phoneE164|emailNormalized|firebaseUid|uid|ssn|mobile|token|authorization|bearer)\s*[,:]/i,
];

const SAFE_PATTERNS = [
  /safeLogger\./,
  /maskPhone\(/, /maskEmail\(/, /maskUid\(/, /maskAddress\(/,
  /\/\/\s*pii-safe/i, /\/\*\s*pii-safe\s*\*\//i,
];

const SAFE_LABEL_PATTERNS = [
  /by email match|by phone match|email nudge|SMS nudge|no email|email notification|email match|phone match/i,
  /token.*ready|token.*readiness|token.*store|token.*clear|token.*set|Failed to store|Failed to clear/i,
  /geocod.*address.*to \(/i,
  /Firebase.*failed|Firebase.*init|Firebase.*match|Firebase.*provider/i,
  /No results for provided address|Request denied for address|Invalid location data for address|Unexpected status for address/i,
  /isAdmin=/i,
  /Checking admin for user/i,
  /Failed to send.*email|Failed to resend.*email|Failed to look up user email|Error processing inbound email/i,
  /send.*email.*failed|email.*send.*error/i,
  /Failed to send booking confirmation email/i,
];

const LOG_CALL_RE = /console\.(log|warn|error|debug|info)\s*\(/;

function collectFiles(dir) {
  const results = [];
  let entries;
  try { entries = readdirSync(dir); } catch { return results; }
  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry)) continue;
    const fullPath = join(dir, entry);
    let stat;
    try { stat = statSync(fullPath); } catch { continue; }
    if (stat.isDirectory()) {
      results.push(...collectFiles(fullPath));
    } else if (EXTENSIONS.has(extname(entry)) && !IGNORE_FILES.has(entry)) {
      results.push(fullPath);
    }
  }
  return results;
}

function extractCallBlock(content, startIndex) {
  let depth = 0;
  let inString = null;
  let escape = false;
  let inTemplate = 0;

  for (let i = startIndex; i < content.length; i++) {
    const ch = content[i];

    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }

    if (inString) {
      if (ch === inString && (inString !== "`" || inTemplate === 0)) {
        inString = null;
      } else if (inString === "`" && ch === "$" && content[i + 1] === "{") {
        inTemplate++;
        i++;
      } else if (inString === "`" && ch === "}" && inTemplate > 0) {
        inTemplate--;
      }
      continue;
    }

    if (ch === '"' || ch === "'" || ch === "`") { inString = ch; continue; }
    if (ch === "(") { depth++; }
    if (ch === ")") {
      depth--;
      if (depth === 0) {
        return content.slice(startIndex, i + 1);
      }
    }
  }
  return content.slice(startIndex, Math.min(startIndex + 500, content.length));
}

function getLineNumber(content, charIndex) {
  let line = 1;
  for (let i = 0; i < charIndex && i < content.length; i++) {
    if (content[i] === "\n") line++;
  }
  return line;
}

function scanFile(filePath) {
  const content = readFileSync(filePath, "utf-8");
  const violations = [];
  const re = /console\.(log|warn|error|debug|info)\s*\(/g;
  let match;

  while ((match = re.exec(content)) !== null) {
    const callStart = match.index;
    const parenStart = content.indexOf("(", callStart + match[0].length - 1);
    const block = extractCallBlock(content, parenStart);
    const fullCall = content.slice(callStart, callStart + match[0].length) + block.slice(1);

    if (SAFE_PATTERNS.some(p => p.test(fullCall))) continue;
    if (SAFE_LABEL_PATTERNS.some(p => p.test(fullCall))) continue;

    let foundPII = false;
    let keyword = "";

    for (const pattern of PII_PROPERTY_PATTERNS) {
      const m = fullCall.match(pattern);
      if (m) {
        foundPII = true;
        keyword = m[0].trim();
        break;
      }
    }

    if (!foundPII) {
      for (const pattern of PII_OBJECT_KEY_PATTERNS) {
        const m = fullCall.match(pattern);
        if (m) {
          const keyLower = m[1].toLowerCase();
          if (keyLower === "token" && /token.*ready|token.*clear/i.test(fullCall)) continue;
          if (keyLower === "email" && /email.*match|no email|email.*notif/i.test(fullCall)) continue;
          if (keyLower === "address" && /geocod/i.test(fullCall)) continue;
          if (keyLower === "firebase" && /firebase.*match|firebase.*failed|firebase.*init|firebase.*provider/i.test(fullCall)) continue;
          if (keyLower === "authorization" && /req\.headers\.authorization/i.test(fullCall)) continue;

          foundPII = true;
          keyword = m[1];
          break;
        }
      }
    }

    if (foundPII) {
      const lineNum = getLineNumber(content, callStart);
      const lineContent = content.split("\n")[lineNum - 1]?.trim() || "";
      violations.push({
        file: filePath,
        line: lineNum,
        keyword,
        content: lineContent,
      });
    }
  }

  return violations;
}

function main() {
  console.log("PII Log Scanner — scanning for PII in logging calls...\n");

  const allFiles = [];
  for (const dir of SCAN_DIRS) {
    allFiles.push(...collectFiles(dir));
  }

  console.log(`Scanning ${allFiles.length} files...\n`);

  const allViolations = [];
  for (const file of allFiles) {
    allViolations.push(...scanFile(file));
  }

  if (allViolations.length === 0) {
    console.log("PASS: No PII logging violations found.\n");
    process.exit(0);
  }

  console.log(`FAIL: Found ${allViolations.length} PII logging violation(s):\n`);
  for (const v of allViolations) {
    console.log(`  ${v.file}:${v.line}`);
    console.log(`    Keyword: ${v.keyword}`);
    console.log(`    Code:    ${v.content}\n`);
  }

  console.log("Fix: Remove PII from log statements or use safeLogger with masking.\n");
  process.exit(1);
}

main();
