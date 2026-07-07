# iMatchstick PWA

A mobile-friendly matchstick puzzle PWA by Mario Studio.

Move exactly one matchstick to turn an incorrect equation into a correct one. The game supports tap, drag-and-drop, optional voice answers, bilingual Chinese/English UI, offline caching, and GitHub Pages deployment.

## Features

- Uses an offline generated puzzle book with nine structural difficulty groups.
- Supports tap-to-select and drag-and-drop solving.
- Uses original matchstick image assets.
- Provides grouped difficulty selection from Level 0 to Level 8.
- Offers optional 60-second timer and sound effects.
- Tracks solved count, streak, skipped puzzles, and supports resetting stats.
- Supports Chinese and English UI.
- Supports puzzle sharing through the `?puzzle=` URL parameter with answer validation.
- Shows a landscape recommendation for higher difficulty groups on mobile portrait screens.
- Supports PWA installation and offline cache.
- Exports as a static site for GitHub Pages.

## Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Build

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
