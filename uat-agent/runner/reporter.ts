import * as fs from "fs/promises";
import { existsSync, mkdirSync } from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import type { UATReport, ScenarioResult } from "../utils/types";
import { uatLogger } from "../utils/logger";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPORTS_DIR = path.resolve(__dirname, "../reports");

export async function generateReports(report: UATReport): Promise<void> {
  if (!existsSync(REPORTS_DIR)) {
    mkdirSync(REPORTS_DIR, { recursive: true });
  }

  const jsonPath = path.join(REPORTS_DIR, "uat-results.json");
  await fs.writeFile(jsonPath, JSON.stringify(report, null, 2), "utf-8");
  uatLogger.info(`JSON report saved: ${jsonPath}`);

  const htmlPath = path.join(REPORTS_DIR, "uat-results.html");
  const html = buildHtml(report);
  await fs.writeFile(htmlPath, html, "utf-8");
  uatLogger.info(`HTML report saved: ${htmlPath}`);
}

function buildHtml(report: UATReport): string {
  const passRate = report.totalScenarios > 0 ? ((report.passed / report.totalScenarios) * 100).toFixed(1) : "0";
  const totalDuration = (report.duration / 1000).toFixed(2);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GigAid UAT Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8f9fa; color: #212529; padding: 24px; }
    .header { background: linear-gradient(135deg, #1a1a2e, #16213e); color: white; padding: 32px; border-radius: 12px; margin-bottom: 24px; }
    .header h1 { font-size: 24px; margin-bottom: 8px; }
    .header .meta { font-size: 14px; opacity: 0.8; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .stat { background: white; padding: 20px; border-radius: 8px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .stat .value { font-size: 32px; font-weight: 700; }
    .stat .label { font-size: 12px; text-transform: uppercase; color: #6c757d; margin-top: 4px; }
    .stat.pass .value { color: #28a745; }
    .stat.fail .value { color: #dc3545; }
    .stat.total .value { color: #007bff; }
    .stat.time .value { color: #6f42c1; font-size: 24px; }
    .scenario { background: white; border-radius: 8px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden; }
    .scenario-header { padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; }
    .scenario-header:hover { background: #f1f3f5; }
    .scenario-header h3 { font-size: 16px; }
    .badge { padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
    .badge.pass { background: #d4edda; color: #155724; }
    .badge.fail { background: #f8d7da; color: #721c24; }
    .badge.error { background: #fff3cd; color: #856404; }
    .scenario-body { padding: 0 20px 20px; display: none; }
    .scenario.open .scenario-body { display: block; }
    .steps-table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    .steps-table th, .steps-table td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #e9ecef; font-size: 13px; }
    .steps-table th { font-weight: 600; color: #6c757d; text-transform: uppercase; font-size: 11px; }
    .step-pass { color: #28a745; }
    .step-fail { color: #dc3545; }
    .step-skip { color: #ffc107; }
    .error-box { background: #fff5f5; border: 1px solid #f8d7da; border-radius: 6px; padding: 12px; margin-top: 12px; font-size: 13px; color: #721c24; white-space: pre-wrap; word-break: break-word; }
    .screenshot-link { color: #007bff; text-decoration: none; font-size: 13px; }
    .screenshot-link:hover { text-decoration: underline; }
    .section-title { font-size: 14px; font-weight: 600; margin-top: 16px; margin-bottom: 8px; color: #495057; }
    .console-errors { background: #2d2d2d; color: #f8f8f2; padding: 12px; border-radius: 6px; font-family: monospace; font-size: 12px; max-height: 200px; overflow-y: auto; margin-top: 8px; }
    .console-errors div { margin-bottom: 4px; }
    .footer { text-align: center; padding: 24px; color: #adb5bd; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>GigAid UAT Report</h1>
    <div class="meta">
      Run ID: ${report.runId} | ${new Date(report.startTime).toLocaleString()} | Duration: ${totalDuration}s
    </div>
  </div>

  <div class="summary">
    <div class="stat total"><div class="value">${report.totalScenarios}</div><div class="label">Total</div></div>
    <div class="stat pass"><div class="value">${report.passed}</div><div class="label">Passed</div></div>
    <div class="stat fail"><div class="value">${report.failed + report.errored}</div><div class="label">Failed</div></div>
    <div class="stat time"><div class="value">${passRate}%</div><div class="label">Pass Rate</div></div>
  </div>

  ${report.scenarios.map((s) => renderScenario(s)).join("\n")}

  <div class="footer">Generated by GigAid UAT Agent</div>

  <script>
    document.querySelectorAll('.scenario-header').forEach(h => {
      h.addEventListener('click', () => h.parentElement.classList.toggle('open'));
    });
  </script>
</body>
</html>`;
}

function renderScenario(s: ScenarioResult): string {
  const duration = (s.duration / 1000).toFixed(2);
  const stepsHtml = s.steps
    .map(
      (step, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${step.action}</td>
      <td>${escHtml(step.description)}</td>
      <td class="step-${step.status}">${step.status.toUpperCase()}</td>
      <td>${step.duration}ms</td>
      <td>${step.screenshot ? `<a class="screenshot-link" href="${step.screenshot}" target="_blank">View</a>` : ""}</td>
    </tr>`
    )
    .join("");

  const assertionsHtml = s.assertions
    .map(
      (a) => `
    <tr>
      <td>${a.type}</td>
      <td>${escHtml(a.description)}</td>
      <td class="step-${a.status}">${a.status.toUpperCase()}</td>
      <td>${a.expected || ""}</td>
      <td>${a.actual || ""}</td>
    </tr>`
    )
    .join("");

  const errorsHtml =
    s.consoleErrors.length > 0
      ? `<div class="section-title">Console Errors (${s.consoleErrors.length})</div>
         <div class="console-errors">${s.consoleErrors.map((e) => `<div>[${e.type}] ${escHtml(e.text)}</div>`).join("")}</div>`
      : "";

  const networkHtml =
    s.networkErrors.length > 0
      ? `<div class="section-title">Network Errors (${s.networkErrors.length})</div>
         <div class="console-errors">${s.networkErrors.map((e) => `<div>${e.method} ${escHtml(e.url)} → ${e.status} ${e.statusText}</div>`).join("")}</div>`
      : "";

  const failedSteps = s.steps.filter((st) => st.status === "fail");
  const errorBoxes = failedSteps
    .map((st) => (st.error ? `<div class="error-box"><strong>Step: ${escHtml(st.description)}</strong>\n${escHtml(st.error)}</div>` : ""))
    .join("");

  return `
  <div class="scenario">
    <div class="scenario-header">
      <div>
        <h3>${escHtml(s.name)}</h3>
        <span style="font-size:12px;color:#6c757d">${escHtml(s.description)} | ${s.viewport} | ${duration}s</span>
      </div>
      <span class="badge ${s.status}">${s.status.toUpperCase()}</span>
    </div>
    <div class="scenario-body">
      <div class="section-title">Steps</div>
      <table class="steps-table">
        <thead><tr><th>#</th><th>Action</th><th>Description</th><th>Status</th><th>Time</th><th></th></tr></thead>
        <tbody>${stepsHtml}</tbody>
      </table>

      ${
        s.assertions.length > 0
          ? `<div class="section-title">Assertions</div>
             <table class="steps-table">
               <thead><tr><th>Type</th><th>Description</th><th>Status</th><th>Expected</th><th>Actual</th></tr></thead>
               <tbody>${assertionsHtml}</tbody>
             </table>`
          : ""
      }

      ${errorBoxes}
      ${errorsHtml}
      ${networkHtml}
    </div>
  </div>`;
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
