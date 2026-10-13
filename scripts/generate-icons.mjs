import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

// Technical export only: retain the approved art, without repainting or cropping.
const master = "assets/icon-master.png";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const files = {};
async function save(name, pipeline) {
  const bytes = await pipeline.png().toBuffer();
  writeFileSync(`public/icons/${name}`, bytes);
  files[name] = {
    sha256: hash(bytes),
    size: (await sharp(bytes).metadata()).width,
  };
  return bytes;
}
for (const size of [192, 512]) {
  await save(
    `icon-${size}.png`,
    sharp(master).resize(size, size, { kernel: "lanczos3" }).removeAlpha(),
  );
}
const faviconFrames = [];
for (const size of [16, 32, 48]) {
  faviconFrames.push(
    await save(
      `favicon-${size}.png`,
      sharp(master)
        .resize(size, size, { kernel: "lanczos3" })
        .sharpen({ sigma: 0.3 })
        .removeAlpha(),
    ),
  );
}
// ICO directory with explicit 16/32/48 PNG frames, no implicit browser scaling.
const header = Buffer.alloc(6 + 16 * faviconFrames.length);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(faviconFrames.length, 4);
let offset = header.length;
for (const [i, bytes] of faviconFrames.entries()) {
  const size = [16, 32, 48][i];
  const p = 6 + i * 16;
  header[p] = header[p + 1] = size;
  header.writeUInt16LE(1, p + 4);
  header.writeUInt16LE(32, p + 6);
  header.writeUInt32LE(bytes.length, p + 8);
  header.writeUInt32LE(offset, p + 12);
  offset += bytes.length;
}
const ico = Buffer.concat([header, ...faviconFrames]);
writeFileSync("public/icons/favicon.ico", ico);
files["favicon.ico"] = { sha256: hash(ico), sizes: [16, 32, 48] };
// The complete approved square fits INSIDE the 40%-radius safe circle.
// 280 / sqrt(2) = 197.99 < 204.8; even its corners survive the worst mask.
// Padding is a technical export border sampled from the master background.
const background = { r: 240, g: 225, b: 200 };
const maskableArtworkSize = 280;
await save(
  "icon-maskable-512.png",
  sharp(master)
    .resize(maskableArtworkSize, maskableArtworkSize, { kernel: "lanczos3" })
    .extend({ top: 116, bottom: 116, left: 116, right: 116, background })
    .removeAlpha(),
);
writeFileSync(
  "assets/icon-exports.json",
  JSON.stringify(
    {
      masterSha256: hash(readFileSync(master)),
      renderer: `sharp ${sharp.versions.sharp}`,
      kernel: "lanczos3",
      faviconSharpenSigma: 0.3,
      maskable: {
        canvas: 512,
        artwork: [116, 116, 396, 396],
        safeRadius: 204.8,
        background,
      },
      files,
    },
    null,
    2,
  ) + "\n",
);
console.log(files);
