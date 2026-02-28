import { expect, test } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100";

function isMediaAsset404(url: string): boolean {
  return url.includes("/assets/") && (url.includes("/audio/") || url.includes("/video/"));
}

test("traverse all pages and key flows without runtime errors", async ({ page }) => {
  const runtimeErrors: string[] = [];
  const serverErrors: string[] = [];
  const failedRequests: string[] = [];
  const notFoundResponses: string[] = [];

  page.on("pageerror", (error) => {
    runtimeErrors.push(`[pageerror] ${error.message}`);
  });

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const location = msg.location();
      if (
        msg.text().includes("Failed to load resource: the server responded with a status of 404") &&
        isMediaAsset404(location.url || "")
      ) {
        return;
      }
      runtimeErrors.push(
        `[console] ${msg.text()} @ ${location.url || "unknown"}:${location.lineNumber ?? -1}:${location.columnNumber ?? -1}`
      );
    }
  });

  page.on("response", (response) => {
    const url = response.url();
    if (url.startsWith(BASE_URL) && response.status() >= 500) {
      serverErrors.push(`[${response.status()}] ${url}`);
    }
    if (response.status() === 404 && !isMediaAsset404(url)) {
      notFoundResponses.push(url);
    }
  });

  page.on("requestfailed", (request) => {
    const url = request.url();
    const errorText = request.failure()?.errorText ?? "unknown";
    if (errorText.includes("ERR_ABORTED")) {
      return;
    }
    if (url.startsWith(BASE_URL)) {
      failedRequests.push(`[requestfailed] ${request.method()} ${url} :: ${errorText}`);
    }
  });

  await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Odyssey" })).toBeVisible();

  await page.goto(`${BASE_URL}/version`, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "纪元档案 👑" })).toBeVisible();

  await page.goto(`${BASE_URL}/changelog`, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "更新日志" })).toBeVisible();

  await page.goto(`${BASE_URL}/memories`, { waitUntil: "networkidle" });
  await expect(page.getByPlaceholder("输入你曾使用的名字")).toBeVisible();

  const testName = `Hero${Date.now().toString().slice(-6)}`;
  await page.goto(`${BASE_URL}/new-story`, { waitUntil: "networkidle" });
  await page.getByPlaceholder("写下你的冒险名号").fill(testName);
  await page.getByRole("button", { name: "踏入旅程" }).click();
  await page.waitForURL(/\/game/, { timeout: 20_000 });

  const playContinueButton = page.getByRole("button", { name: "聆听下一句" });
  const introNextButton = page.getByRole("button", { name: "下一格" });
  const introFinishButton = page.getByRole("button", { name: "完成第一幕，进入旅程" });
  const introDeadline = Date.now() + 20_000;
  while (Date.now() < introDeadline) {
    if (await playContinueButton.isVisible().catch(() => false)) {
      break;
    }
    if (await introFinishButton.isVisible().catch(() => false)) {
      await introFinishButton.click();
      await page.waitForTimeout(160);
      continue;
    }
    if (await introNextButton.isVisible().catch(() => false)) {
      await introNextButton.click();
      await page.waitForTimeout(160);
      continue;
    }
    await page.waitForTimeout(160);
  }
  await expect(playContinueButton).toBeVisible({ timeout: 20_000 });

  await Promise.all([
    page.waitForResponse((resp) => resp.url().includes("/api/dialogue/advance")),
    page.getByRole("button", { name: "聆听下一句" }).click()
  ]);
  await Promise.all([
    page.waitForResponse((resp) => resp.url().includes("/api/daynight/current")),
    page.getByRole("button", { name: "校准昼夜" }).click()
  ]);
  await Promise.all([
    page.waitForResponse((resp) => resp.url().includes("/api/footprints/map")),
    page.getByRole("button", { name: "展开足迹" }).click()
  ]);
  await Promise.all([
    page.waitForResponse((resp) => resp.url().includes("/api/sidequest/trigger")),
    page.getByRole("button", { name: "唤起支线" }).click()
  ]);
  await Promise.all([
    page.waitForResponse((resp) => resp.url().includes("/api/chapters/enter")),
    page.getByRole("button", { name: "迈向下一幕" }).click()
  ]);

  const choiceButtons = page.locator(".choice-btn");
  if ((await choiceButtons.count()) > 0) {
    await Promise.all([
      page.waitForResponse((resp) => resp.url().includes("/api/choice/commit")),
      choiceButtons.first().click()
    ]);
  }

  await page.goto(`${BASE_URL}/memories`, { waitUntil: "networkidle" });
  await page.getByPlaceholder("输入你曾使用的名字").fill(testName);
  await page.getByRole("button", { name: "唤醒记忆" }).click();
  await page.waitForURL(/\/game/, { timeout: 20_000 });

  await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });

  expect(runtimeErrors, `runtime errors:\n${runtimeErrors.join("\n")}`).toEqual([]);
  expect(serverErrors, `server errors:\n${serverErrors.join("\n")}`).toEqual([]);
  expect(failedRequests, `failed requests:\n${failedRequests.join("\n")}`).toEqual([]);
  expect(notFoundResponses, `404 responses:\n${notFoundResponses.join("\n")}`).toEqual([]);
});
