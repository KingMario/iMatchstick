# iMatchstick PWA

A mobile-friendly matchstick puzzle PWA by Mario Studio.

Move exactly one matchstick to turn an incorrect equation into a correct one. The game supports tap, drag-and-drop, optional voice answers, bilingual Chinese/English UI, offline caching, and GitHub Pages deployment.

## Features

- Uses an offline generated puzzle book with nine structural difficulty groups.
- Supports tap-to-select and drag-and-drop solving.
- The More overlay saves your preferred drag hand. Left-hand mode places the preview below-right of the finger in phone portrait and above-right in landscape. Right-hand mode (default) uses above-right in phone portrait and above-left in landscape. Snapping and dropping use the preview position.
- Uses original matchstick image assets.
- Provides grouped difficulty selection from Level 0 to Level 8.
- Offers optional 60-second timer and sound effects.
- Tracks solved count, streak, skipped puzzles, and supports resetting stats.
- Supports Chinese and English UI.
- Supports puzzle sharing through the `?puzzle=` URL parameter with answer validation.
- Fits the game into a single phone screen. In portrait, the equation rotates 90 degrees clockwise; tap targets, drag previews, and drop snapping use the displayed positions. Landscape uses the horizontal equation layout.
- On phones, a left-side toolbar in portrait and a bottom toolbar in landscape provide direct access to level selection, new puzzles, undo, answers, and voice input. Answer progress, a short hint, and the optional countdown run vertically down the right side in portrait and along the top in landscape; the portrait equation uses the full available height.
- The More overlay contains language, timer, sound, sharing, statistics, instructions, and project links. Answers open in a separate overlay without resizing the puzzle. Overlays close with the close button, Escape, or a tap on the backdrop.
- Supports PWA installation and offline cache.
- Exports as a static site for GitHub Pages.

## Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Tests

Run unit tests with `npm test`. For browser regression tests, install Chromium with `npx playwright install chromium`, keep the dev server running, then run `npm run test:e2e`. `PLAYWRIGHT_BASE_URL` selects a different running server; `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` selects an existing Chromium executable.

Browser tests cover initial loading, repeated new-puzzle clicks, skip counting, level changes from shared URLs, and restoring solved puzzles. While a puzzle loads, puzzle controls and the countdown are paused; statistics are updated when the replacement is displayed.

After `npm run build`, run `TEST_PWA_EXPORT=1 npx playwright test tests/e2e/pwa-update.spec.ts` to exercise the exported app with a real service worker. This test runs its own temporary HTTP server and covers registration retry, foreground update checks, deferred activation, continued gameplay, bilingual update controls, explicit reload, and network failure recovery.

## Build

`npm run build` exports the site and generates one Build ID for the client, `version.json`, and service-worker cache. Development displays `dev`; local production builds use `local-<timestamp>`.

GitHub Actions uses the workflow run's creation date in Beijing time and its position among that day's runs, for example `20260914.01`. Failed or skipped runs can leave gaps. A retry retains its run identity with a suffix such as `20260914.01-r2`. More shows the Build ID and short commit SHA. CI requires read access to workflow run history; identity generation failures stop the build.

The app checks for updates on launch and when returning to the foreground. More also provides a manual check. New service workers wait until the user chooses **Update and reload**; this ends the current puzzle. **Later** dismisses the notice, while the update remains accessible in More. Builds are compared by identity, not numeric order. The worker cache version is generated automatically; no manual cache-name bump is needed.

```bash
npm run build
```

The static export is generated in `out/`.

## Puzzle Book

Puzzle pools are generated from valid equations by moving one matchstick to create candidate puzzles. Each candidate is classified by structural features such as digit count, self-move, external drop, cross-equals movement, operator changes, high-place changes, and answer count.

The generator excludes obvious large-result traps where a one-digit equation produces a candidate result of 70 or above, or a two-digit-by-two-digit equation produces a candidate result of 700 or above.

```bash
npm run generate:puzzles
```

The command writes:

- `public/puzzles/level0.txt`
- `public/puzzles/easiest.txt`
- `public/puzzles/easy.txt`
- `public/puzzles/easyPlus.txt`
- `public/puzzles/medium.txt`
- `public/puzzles/mediumPlus.txt`
- `public/puzzles/hard.txt`
- `public/puzzles/hardPlus.txt`
- `public/puzzles/expert.txt`
- `lib/generated/puzzleBook.generated.ts`
- `lib/generated/puzzleBook.report.json`

The app loads the selected difficulty pool at runtime and falls back to random generation if the pool cannot be loaded.

Each new puzzle excludes the previous puzzle's original expression, including level changes and fallback generation. Restoring the current puzzle does not affect this rule.

Difficulty groups:

| Level | Name    | Main structure                                                    |
| ----- | ------- | ----------------------------------------------------------------- |
| 0     | Level 0 | One-digit equation with a self move                               |
| 1     | Easiest | Right-side self move                                              |
| 2     | Easy    | Left-side single-digit self move                                  |
| 3     | Easy+   | Right-side external drop                                          |
| 4     | Medium  | Left-side cross-digit move                                        |
| 5     | Medium+ | Operator change                                                   |
| 6     | Hard    | Cross-equals move                                                 |
| 7     | Hard+   | Multi-digit high-place change                                     |
| 8     | Expert  | Multi-digit cross-equals, operator change, or multiple candidates |

## Deployment

The repository includes a GitHub Actions workflow for GitHub Pages deployment. Pushes to `main` build the static Next.js export and publish it to Pages.

Production URL:

https://mario.studio/iMatchstick/

## License

MIT License.

Copyright (c) Mario Studio 2026-2027
