import { test, expect } from "@playwright/test";

test.describe("Logout is final and non-recoverable", () => {
  test("user logs out and cannot be re-authenticated", async ({ page }) => {

    // 1. Login (use real login flow or helper)
    await page.goto("/login");

    await page.fill('input[name="email"]', "test.user@gigaid.dev");
    await page.fill('input[name="password"]', "Password123!");
    await page.click('button[type="submit"]');

    // Ensure we are authenticated
    await page.waitForURL("/");
    await expect(page.locator("text=Today's Game Plan")).toBeVisible();

    // 2. Navigate to More page and perform logout
    await page.goto("/more");
    await page.click('[data-testid="logout-button"]');

    // 3. Must land on /login
    await page.waitForURL("/login", { timeout: 5000 });
    await expect(page.locator("text=Sign in")).toBeVisible();

    // 4. Hard refresh (this is critical)
    await page.reload();

    // Still on login
    await expect(page).toHaveURL("/login");

    // 5. Server auth must be invalid
    const authResponse = await page.request.get("/api/auth/user", {
      headers: {
        Cookie: await page.context().cookies().then(cookies => 
          cookies.map(c => `${c.name}=${c.value}`).join('; ')
        )
      }
    });

    expect(authResponse.status()).toBe(401);

    // 6. No Firebase user rehydration (defensive check)
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
