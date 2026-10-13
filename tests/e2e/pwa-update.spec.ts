import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve } from "node:path";

test("production updates wait for consent and retain old gameplay until reload", async ({
  page,
}) => {
  test.skip(
    !process.env.TEST_PWA_EXPORT,
    "Requires npm run build and TEST_PWA_EXPORT=1",
  );
  const metadata = JSON.parse(await readFile("out/version.json", "utf8"));
  const worker = await readFile("out/sw.js", "utf8");
  expect(worker).toContain(`imatchstick-pwa-${metadata.buildId}`);
  expect(worker).not.toContain("__BUILD_ID__");
  let updated = false;
  let offline = false;
  await page.addInitScript(() => {
    const register = navigator.serviceWorker.register.bind(
      navigator.serviceWorker,
    );
    let first = true;
    navigator.serviceWorker.register = (...args) => {
      if (first) {
        first = false;
        return Promise.reject(new Error("Transient registration failure"));
      }
      return register(...args);
    };
  });
  const server = createServer(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (offline) {
      res.writeHead(503).end();
      return;
    }
    try {
      const pathname = new URL(req.url!, "http://localhost").pathname;
      if (pathname === "/sw.js") {
        res.setHeader("Content-Type", "application/javascript");
        res.end(
          updated
            ? worker.replaceAll(metadata.buildId, `${metadata.buildId}-test`)
            : worker,
        );
        return;
      }
      const file = pathname === "/" ? "index.html" : pathname.slice(1);
      const types: Record<string, string> = {
        ".html": "text/html",
        ".js": "application/javascript",
        ".css": "text/css",
        ".svg": "image/svg+xml",
        ".json": "application/json",
      };
      res.setHeader(
        "Content-Type",
        types[extname(file)] ?? "application/octet-stream",
      );
      let body = await readFile(resolve("out", file));
      if (file === "index.html")
        body = Buffer.from(
          body
            .toString()
            .replace(
              "<body",
              `<body data-test-build="${updated ? "new" : "old"}"`,
            ),
        );
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  try {
    const address = server.address() as { port: number };
    await page.goto(`http://127.0.0.1:${address.port}/?puzzle=7-5%3D3`);
    await page.getByRole("button", { name: "更多", exact: true }).tap();
    await page
      .locator("dialog[open] summary")
      .filter({ hasText: "关于与版本" })
      .tap();
    await expect(
      page.getByText("检查失败，请确认网络后重试。", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "检查更新", exact: true }).tap();
    await expect(
      page.getByText("当前已是最新版本", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(`${metadata.buildId} · ${metadata.sha}`, { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "关闭", exact: true }).tap();
    updated = true;
    await page.evaluate(() => window.dispatchEvent(new Event("pageshow")));
    await expect(
      page.getByRole("button", { name: "新版可用，查看更新", exact: true }),
    ).toBeVisible();
    await expect(page.locator("body")).toHaveAttribute(
      "data-test-build",
      "old",
    );
    await page.getByRole("button", { name: "稍后", exact: true }).tap();
    await page.locator('[data-position="4"][data-segment="3"]').tap();
    await page.locator('[data-position="4"][data-segment="5"]').tap();
    await expect(page.locator(".equation")).toHaveAttribute(
      "aria-label",
      "7-5=2",
    );
    await page.getByRole("button", { name: "更多", exact: true }).tap();
    await page.getByRole("button", { name: "EN", exact: true }).tap();
    await page.locator("dialog[open] details[open] summary").tap();
    await expect(page.locator("dialog[open] details[open]")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Update and reload" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Update and reload" }).tap();
    await expect(page.locator("body")).toHaveAttribute(
      "data-test-build",
      "new",
    );
    await page.getByRole("button", { name: "More", exact: true }).tap();
    await page
      .locator("dialog[open] summary")
      .filter({ hasText: "About & version" })
      .tap();
    offline = true;
    await page.getByRole("button", { name: "Check for updates" }).tap();
    await expect(
      page.getByText("Check failed. Check your connection and try again.", {
        exact: true,
      }),
    ).toBeVisible();
    offline = false;
    await page.getByRole("button", { name: "Check for updates" }).tap();
    await expect(
      page.getByRole("button", { name: "Update and reload" }),
    ).toBeVisible();
  } finally {
    server.closeAllConnections();
    await new Promise<void>((done) => server.close(() => done()));
  }
});
