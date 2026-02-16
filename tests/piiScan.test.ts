import { execSync } from "child_process";

describe("PII Log Scanner", () => {
  it("should find zero PII violations in logging calls", () => {
    let exitCode = 0;
    let output = "";
    try {
      output = execSync("node scripts/pii-log-scan.js", {
        encoding: "utf-8",
        timeout: 30_000,
      });
    } catch (err: any) {
      exitCode = err.status ?? 1;
      output = err.stdout || err.stderr || "";
    }

    if (exitCode !== 0) {
      console.error("PII Scanner output:\n", output);
    }

    expect(exitCode).toBe(0);
  });
});
