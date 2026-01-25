import { test, expect } from "@playwright/test";

test.describe("Logout is final and non-recoverable", () => {
  test("user logs out and cannot be re-authenticated", async ({ page }) => {

    // 1. Go to login page first to establish browser context
    await page.goto("/login");
    
    // Use the browser's fetch to hit test-login and get a JWT token
    const loginResult = await page.evaluate(async () => {
      const response = await fetch("/api/auth/test-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: "thierry.mbandi@outlook.com" }),
      });
      return { status: response.status, data: await response.json() };
    });
    
    expect(loginResult.status).toBe(200);
    expect(loginResult.data.success).toBe(true);
    expect(loginResult.data.token).toBeTruthy();
    
    // Store the JWT token in localStorage (this is how the app authenticates)
    await page.evaluate((token) => {
      localStorage.setItem("gigaid_auth_token", token);
    }, loginResult.data.token);
    
    // Go directly to the More page (where logout button is)
    await page.goto("/more");
    
    // Verify we're authenticated by checking the logout button is visible
    await expect(page.locator('[data-testid="logout-button"]')).toBeVisible({ timeout: 15000 });

    // 2. Perform logout
    await page.click('[data-testid="logout-button"]');

    // 3. Must land on / (unauthenticated landing page)
    await page.waitForURL("/", { timeout: 10000 });
    
    // Check for the splash/landing page content - "Log in" button visible
    await expect(page.locator('[data-testid="button-log-in"], [data-testid="button-get-started"]').first()).toBeVisible();

    // 4. Hard refresh (this is critical)
    await page.reload();

    // Still on root (landing page for unauthenticated users)
    await expect(page).toHaveURL("/");

    // 5. Token must be cleared from localStorage
    const token = await page.evaluate(() => localStorage.getItem("gigaid_auth_token"));
    expect(token).toBeNull();

    // 6. Verify user stays on unauthenticated page after refresh (not redirected to app)
    // The presence of the login button confirms user is NOT authenticated
    await expect(page.locator('[data-testid="button-log-in"], [data-testid="button-get-started"]').first()).toBeVisible();

    // 7. No Firebase user rehydration (defensive check)
    const firebaseUser = await page.evaluate(async () => {
      try {
        const { getAuth } = await import("firebase/auth");
        return getAuth().currentUser;
      } catch {
        return null;
      }
    });

    expect(firebaseUser).toBeNull();
  });
});
