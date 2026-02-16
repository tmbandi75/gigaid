process.env.NODE_ENV = "production";
process.env.VITE_APP_ENV = "production";

async function main() {
  const mod = await import("../capacitor.config.js");
  const config = mod.default;

  let exitCode = 0;

  if (config.android?.webContentsDebuggingEnabled) {
    console.error(
      "FAIL: webContentsDebuggingEnabled is true in production config"
    );
    exitCode = 1;
  } else {
    console.log(
      "PASS: webContentsDebuggingEnabled is false in production config"
    );
  }

  if (config.android?.allowMixedContent) {
    console.error("FAIL: allowMixedContent is true in production config");
    exitCode = 1;
  } else {
    console.log("PASS: allowMixedContent is false in production config");
  }

  console.log("\nEnvironment sourced from:");
  console.log("  process.env.NODE_ENV =", process.env.NODE_ENV);
  console.log("  process.env.VITE_APP_ENV =", process.env.VITE_APP_ENV);
  console.log("\nResolved android config:");
  console.log(
    "  webContentsDebuggingEnabled:",
    config.android?.webContentsDebuggingEnabled ?? false
  );
  console.log(
    "  allowMixedContent:",
    config.android?.allowMixedContent ?? false
  );

  if (exitCode === 0) {
    console.log("\nAll Capacitor production safety checks passed.");
  } else {
    console.error(
      "\nCapacitor production safety checks FAILED. Fix capacitor.config.ts before releasing."
    );
  }

  process.exit(exitCode);
}

main();
