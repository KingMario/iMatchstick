# Application icon exports

`icon-master.png` is the approved warm-beige artwork, including the spaces between the matches. It is preserved without cropping, redrawing or replacing individual matches. `icon-exports.json` records source/output SHA-256 hashes and the technical export parameters.

Run `npm ci`, then `npm run generate:icons` with pinned Sharp 0.34.5. The checked-in exports are deployed directly; ordinary builds do not regenerate artwork. After changing artwork/export settings, update the `?v=` content hash prefixes in the manifest, `app/layout.tsx` and `public/sw.js`; `npm test` rejects stale links.

- Standard PWA/desktop: opaque RGB PNGs at 192 and 512 pixels.
- Browser tabs: independent 16/32/48 Lanczos3 exports with a mild 0.3-sigma sharpening pass, plus an ICO containing these exact frames. This is a small-size raster export, not a new vector drawing.
- Android maskable: the complete approved image is centered in a 280-pixel square on a 512-pixel opaque beige canvas. Its farthest corners are 197.99 pixels from the center, within the 204.8-pixel safe radius. This intentionally conservative inset preserves every visible match even with the smallest conforming circular mask. No pre-rounded transparent corners.
- Apple: the existing approved 180-pixel touch icon and its URL are unchanged.

The [W3C maskable safe-zone definition](https://www.w3.org/TR/appmanifest/#icon-masks) guarantees a centered circle of radius 40% of the image size, rather than an 80% square. `scripts/icons.test.mjs` checks this geometry, opaque background, frame dimensions, content hashes, manifest/HTML versions and every precached file.

Existing installed shortcuts may retain OS-managed artwork until the platform updates it or the shortcut is added again. Content-versioned links avoid reusing older network/cache entries, but do not guarantee immediate replacement of installed icons. No saved game settings or data are reset. Device installation appearance still needs real-device QA.
