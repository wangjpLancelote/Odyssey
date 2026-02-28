import { expect, test } from "@playwright/test";

test("new player can start session", async ({ page }) => {
  const testName = `Hero${Date.now().toString().slice(-6)}`;

  await page.goto("/new-story");

  const nameInput = page.locator('input[placeholder="写下你的冒险名号"]');
  await expect(nameInput).toBeVisible();
  await nameInput.fill(testName);

  const startButton = page.getByRole("button", { name: "踏入旅程" });

  const startResponsePromise = page.waitForResponse((resp) =>
    resp.url().includes("/api/session/start")
  );

  await startButton.click();

  const startResponse = await startResponsePromise;
  const payload = await startResponse.json().catch(() => null);

  console.log("[e2e] /api/session/start status:", startResponse.status());
  console.log("[e2e] /api/session/start body:", payload);

  expect(startResponse.status(), JSON.stringify(payload)).toBe(200);
  await expect(page).toHaveURL(/\/game/);
});
