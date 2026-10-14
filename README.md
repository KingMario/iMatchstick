# iMatchstick PWA

A mobile-friendly matchstick puzzle PWA by Mario Studio.

Move exactly one matchstick to turn an incorrect equation into a correct one. The game supports tap, drag-and-drop, optional voice answers, bilingual Chinese/English UI, offline caching, and GitHub Pages deployment.

## Features

- Uses an offline generated puzzle book with nine structural difficulty groups.
- Supports tap-to-select and drag-and-drop solving.
- Successful tap, drag, and voice answers share visual feedback independently of sound: the placed match pulses, the equation briefly lights up, and a checkmark remains visible. New answers animate progress; finding all answers adds a short confetti celebration. Repeated answers retain confirmation without progress or confetti, and reduced-motion mode uses static feedback.
- For a new answer, a checkmark travels from the equation to the found-answer count before that number advances. Repeated answers do not fly or increment. Undo, viewport changes, and backgrounding settle the displayed count without changing recorded answers; reduced-motion mode updates it immediately.
- On phones, Settings saves your preferred hand. The centered equation shifts left for left-hand mode and right for right-hand mode by at most one horizontal matchstick’s visible length. The cap uses a conservative 192/240 of the horizontal SVG box width; available space clamps the shift at the existing safe boundary, keeping at least a 12-pixel control gap. Character sizes, spacing, and equation width stay unchanged; desktop remains centered. Portrait rotates the same layout. Phone touch drags use a hand-neutral circular magnifier above the finger, showing the actual nearby board without reflection; legal drop targeting stays at the finger. The lens appears immediately when a movable matchstick is pressed, including the academy matchbox, without turning a stationary tap into a move. During a phone touch press, the source artwork hides while the lens carries it; release or cancellation restores an uncommitted source. It avoids viewport edges and disappears on release or cancellation. Desktop mouse dragging retains the offset preview.
- Matchsticks use sketch-style SVG artwork with irregular contours and retraced ink strokes. Shortened artwork leaves gaps between neighboring segments without shrinking the touch targets. Each new puzzle assigns random match-head directions to all segment positions, including the equals sign. Directions remain fixed at each position through selection, solutions, and undo; they do not affect the puzzle rules. The small dragging matchstick rotates unless reduced motion is enabled. Action icons use hand-drawn SVG artwork.
- Provides grouped difficulty selection from Level 0 to Level 8.
- Offers optional 60-second timer and sound effects.
- Tracks solved count, streak, skipped puzzles, and supports resetting stats.
- Supports Chinese and English UI.
- Voice answers display interim/final captions in the reserved header, rotating with the phone game. Only final transcripts can submit an answer; all recognition alternatives are checked. Each tap owns one recognition attempt, with cleanup on cancellation, errors, new puzzles, undo, timeout, overlays, backgrounding, and unmount. Silent or stalled attempts return to retry (30-second maximum), without automatically restarting the microphone. Captions disappear after four seconds and are never saved. This uses the browser’s existing speech API, which may use its provider’s online recognition service; no new transcription service or recording upload is added.
- Supports puzzle sharing through the `?puzzle=` URL parameter with answer validation.
- Fits the game into a single phone screen. Portrait uses the landscape layout rotated 90 degrees clockwise, including text, controls, and dialogs. Tap targets, drag previews, drop snapping, and progress animations use screen coordinates. Viewport changes cancel active drags without moving a matchstick. Safe-area insets keep the board and dialogs clear of screen cutouts. Desktop layout stays upright.
- Controls occupy reserved space inside the playground. In the landscape layout, level selection forms a column on the left, and action buttons form a column on the right. Action buttons are ordered New, Undo, Answers, Voice. The Settings gear sits immediately after the answer count in the top-right header, with a 40-pixel hit target. Undo is enabled after a correct answer, restores the original puzzle, and preserves found answers. Reserved space keeps controls clear of the equation. Answer progress, a short hint, and the optional countdown run along the top. Landscape phones and desktop browsers place answer progress at the top-right of the board header and the optional countdown at the left. Portrait phones rotate the entire layout, including answer progress, 90 degrees clockwise.
- The Settings overlay contains language, timer, sound, sharing, installation, version, and instructions. On phones, it also contains statistics, copyright, and the GitHub icon link. Desktop browsers show statistics on the left below the puzzle and copyright with the GitHub icon on the right; the row wraps when space is limited. Desktop equations fit the available width without overlapping the side controls. Answers open in a separate overlay without resizing the puzzle. Overlays close with the close button, Escape, or a tap on the backdrop.
- Supports PWA installation and offline cache.
- Settings includes Add to Home Screen. Supporting browsers open their native install prompt after a click; other browsers show platform-specific instructions. iPhone/iPad instructions use Safari's Share menu. Installation is never triggered automatically. Standalone launches and confirmed installation events show the installed state; ordinary browser tabs cannot reliably detect every existing installation.
- The custom installation flow suppresses the automatic mini-infobar on supporting browsers and keeps the install event for the Settings gear. Browser-managed menu installation remains subject to the browser's own availability rules.
- Android-derived PNG icons use `purpose: any`; their artwork reaches the edges and is not designed for maskable cropping.
- The original Android splash image appears while the web game initializes, with no minimum display duration. It is included in the static HTML loading fallback and offline cache; the operating system's pre-page launch screen is separate.
- The splash uses text copyright and rotates clockwise on portrait phones. Home-screen icons use the Android matchstick artwork, resampled from its 114-pixel source to 180, 192, and 512 pixels.
- Exports as a static site for GitHub Pages.

## Matchstick Academy / 火柴入门学园

First-time visitors can start the six-chapter academy or go straight to puzzles. Returning visitors keep their normal game entry; the academy is always available directly in Settings. All 24 bilingual exercises can be replayed or skipped, and every chapter is open from the overview. The compact academy shows six chapter choices first, then four lessons for the selected chapter. Exercises and help use separate views so ordinary phone and desktop layouts need not stack all course content into a scrolling page. Very small viewports or enlarged text retain accessible overflow rather than clipping content. Portrait uses the same logical landscape layout rotated 90 degrees.

The curriculum separates recognition, adding/removing a stick using a matchbox, moving within one digit, transferring between independent digit cards, transferring between a digit and a sign, and finally correcting single-digit equations. These are distinct typed lesson modes; card activities are never passed to the equation engine as invented equations. Each movement exercise has an exhaustively checked one-stick solution with explicit editable-card and operation constraints. The equals sign is fixed. Outline targets are filtered by the selected source and the lesson operation; legal moves that miss the goal remain available for learning feedback. Academy and regular puzzles share slot-transfer guards, screen-orientation metadata and snap-preview resolution, with their own validation rules supplied to the common helpers. Snapped previews use the destination orientation before release, including the rotated phone layout. Academy digit and operator artwork uses explicit shared stick dimensions.

Learning has no timer or penalties. Tap a source and destination (or drag); use Hint, Undo, Reset, Replay, or the chapter overview whenever needed. Hints fade from outlines to a card cue, and a source/destination demonstration remains available. Entering the academy pauses the competitive clock and preserves the current puzzle, found answers, and statistics. Leaving resumes that challenge. Learning progress uses the separate versioned `imatchstick-academy-v1` local storage key. Invalid progress is discarded safely, known version-0 progress is migrated, and blocked storage leaves the session usable.

Academy tests include exhaustive pure move validation, storage migration/failure handling, shared-renderer contracts, component-handler tests with mocked React/DOM, lifecycle source invariants, and browser scenarios in `tests/e2e/academy.spec.ts`. The existing E2E fixture identifies those suites as returning visitors so onboarding does not obscure their original test subjects. Browser test discovery does not replace executing these tests in Chromium or verifying rotated touch interaction and native scrolling on an iPhone.

## Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Tests

Run unit tests with `npm test`. For browser regression tests, install Chromium with `npx playwright install chromium`, keep the dev server running, then run `npm run test:e2e`. `PLAYWRIGHT_BASE_URL` selects a different running server; `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` selects an existing Chromium executable.

Browser tests cover initial loading, repeated new-puzzle clicks, skip counting, level changes from shared URLs, and restoring solved puzzles. While a puzzle loads, puzzle controls and the countdown are paused; statistics are updated when the replacement is displayed.

Phone layout tests compare portrait geometry with the clockwise-rotated landscape geometry in both languages. They also cover safe areas, touch scrolling in rotated dialogs, focus order, drag cancellation on rotation, and progress animation settlement when the visible viewport changes.

Portrait dialogs scroll along their rotated content axis: swipe right for later content and left for earlier content. Vertical swipes leave the scroll position unchanged. Vertical mouse-wheel input advances through content; horizontal wheel input follows the displayed axis. Touch scrolling is owned by the browser in both orientations, including momentum and stopping on touch; the app does not cancel single-finger moves or animate scroll offsets. Gesture regression tests assert direction while dragging rather than an exact release distance, because native touch slop and inertia vary by browser. Validate slow drags, quick flicks, tap-to-stop, scroll boundaries, and rotation in Safari and the installed iPhone PWA when changing this behavior.

Settings keep language, timer, sound, and phone hand preference at the top. Hand preference uses inline, keyboard-accessible radio segments so both choices rotate with the phone dialog. How to play, Statistics, and About & version use native, initially collapsed disclosure panels; open panels stay open while closing/reopening the dialog. Sharing, installation, and version checks live in About & version. An available update and its explicit reload action remain outside collapsed panels, with the existing current-puzzle warning. The header stays fixed while the body scrolls natively.

After `npm run build`, run `TEST_PWA_EXPORT=1 npx playwright test tests/e2e/pwa-update.spec.ts` to exercise the exported app with a real service worker. This test runs its own temporary HTTP server and covers registration retry, foreground update checks, deferred activation, continued gameplay, bilingual update controls, explicit reload, and network failure recovery.

## Build

`npm run build` exports the site and generates one Build ID for the client, `version.json`, and service-worker cache. Development displays `dev`; local production builds use `local-<timestamp>`.

GitHub Actions uses the workflow run's creation date in Beijing time and its position among that day's runs, for example `20260914.01`. Failed or skipped runs can leave gaps. A retry retains its run identity with a suffix such as `20260914.01-r2`. Settings shows the Build ID and short commit SHA. CI requires read access to workflow run history; identity generation failures stop the build.

The app checks for updates on launch and when returning to the foreground. Settings also provides a manual check. New service workers wait until the user chooses **Update and reload**; this ends the current puzzle. **Later** dismisses the notice, while the update remains accessible in Settings. Builds are compared by identity, not numeric order. The worker cache version is generated automatically; no manual cache-name bump is needed.

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
