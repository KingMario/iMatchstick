import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import vm from "node:vm";
import sharp from "sharp";
const read = (path) => readFileSync(path);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const records = JSON.parse(read("assets/icon-exports.json"));
const manifest = JSON.parse(read("public/manifest.webmanifest"));
const layout = read("app/layout.tsx").toString();
let shell;
vm.runInNewContext(read("public/sw.js") + "\nglobalThis.shell = APP_SHELL;", {
  self: { addEventListener() {} },
  set shell(value) {
    shell = value;
  },
});

test("approved master and retained Apple icon hashes", () => {
  assert.equal(hash(read("assets/icon-master.png")), records.masterSha256);
  assert.equal(
    hash(read("public/icons/apple-touch-icon.png")),
    "b1b6f8fdf668dfe4ca20beb778e755883de6a60e3ab05cc2e2a81f47108f44e2",
  );
  assert.ok(layout.includes("./icons/apple-touch-icon.png?v=b1b6f8fdf668"));
});
test("all exported PNGs are opaque squares with recorded dimensions and hashes", async () => {
  for (const [name, record] of Object.entries(records.files)) {
    const bytes = read(`public/icons/${name}`);
    assert.equal(hash(bytes), record.sha256, name);
    if (!name.endsWith(".png")) continue;
    const metadata = await sharp(bytes).metadata();
    assert.equal(metadata.width, record.size);
    assert.equal(metadata.height, record.size);
    assert.equal(metadata.hasAlpha, false, name);
  }
});
test("maskable complete artwork fits the W3C central 80% diameter circle", async () => {
  const {
    canvas,
    artwork: [left, top, right, bottom],
    safeRadius,
    background,
  } = records.maskable;
  assert.equal(safeRadius, canvas * 0.4);
  for (const x of [left, right])
    for (const y of [top, bottom])
      assert.ok(Math.hypot(x - canvas / 2, y - canvas / 2) < safeRadius);
  const { data, info } = await sharp("public/icons/icon-maskable-512.png")
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let y = 0; y < canvas; y++)
    for (let x = 0; x < canvas; x++) {
      if (x >= left && x < right && y >= top && y < bottom) continue;
      const offset = (y * canvas + x) * info.channels;
      assert.deepEqual(
        [...data.subarray(offset, offset + 3)],
        [background.r, background.g, background.b],
      );
    }
});
test("ICO contains exact 16, 32 and 48 pixel frames", async () => {
  const ico = read("public/icons/favicon.ico");
  assert.equal(ico.readUInt16LE(0), 0);
  assert.equal(ico.readUInt16LE(2), 1);
  assert.equal(ico.readUInt16LE(4), 3);
  for (const [i, size] of [16, 32, 48].entries()) {
    const p = 6 + 16 * i,
      length = ico.readUInt32LE(p + 8),
      offset = ico.readUInt32LE(p + 12);
    assert.equal(ico[p], size);
    assert.equal(ico[p + 1], size);
    assert.deepEqual(
      ico.subarray(offset, offset + length),
      read(`public/icons/favicon-${size}.png`),
    );
  }
});
test("manifest uses separate any and maskable assets with content versions", () => {
  assert.equal(manifest.icons.length, 3);
  assert.deepEqual(
    manifest.icons.map((i) => i.purpose),
    ["any", "any", "maskable"],
  );
  for (const icon of manifest.icons) {
    const url = new URL(icon.src, "https://example.test/iMatchstick/");
    const name = url.pathname.split("/").at(-1);
    assert.equal(
      url.searchParams.get("v"),
      records.files[name].sha256.slice(0, 12),
    );
    assert.equal(
      icon.sizes,
      `${records.files[name].size}x${records.files[name].size}`,
    );
    assert.ok(shell.includes("./" + icon.src));
  }
  const version = hash(read("public/manifest.webmanifest")).slice(0, 12);
  assert.ok(layout.includes(`./manifest.webmanifest?v=${version}`));
  assert.ok(shell.includes(`./manifest.webmanifest?v=${version}`));
});
test("favicon links and precache assets resolve in a subpath deployment", () => {
  for (const [name, entry] of Object.entries(records.files)) {
    const url = `./icons/${name}?v=${entry.sha256.slice(0, 12)}`;
    assert.ok(shell.includes(url), url);
    if (name.startsWith("favicon")) assert.ok(layout.includes(url), url);
  }
  for (const url of shell) {
    const path = new URL(
      url,
      "https://example.test/iMatchstick/",
    ).pathname.replace("/iMatchstick/", "");
    if (path) assert.ok(existsSync(`public/${path}`), path);
  }
});
