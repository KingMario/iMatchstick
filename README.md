# iMatchstick PWA

A mobile-friendly matchstick puzzle PWA by Mario Studio.

Move exactly one matchstick to turn an incorrect equation into a correct one. The game supports tap, drag-and-drop, optional voice answers, bilingual Chinese/English UI, offline caching, and GitHub Pages deployment.

## Features

- Generates matchstick equation puzzles with one-stick solutions.
- Supports tap-to-select and drag-and-drop solving.
- Uses original matchstick image assets.
- Provides Intro and Advanced modes.
- Offers optional 60-second timer and sound effects.
- Tracks solved count, streak, skipped puzzles, and supports resetting stats.
- Supports Chinese and English UI.
- Supports puzzle sharing through the `?puzzle=` URL parameter with answer validation.
- Shows a landscape recommendation for Advanced mode on mobile portrait screens.
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

## Deployment

The repository includes a GitHub Actions workflow for GitHub Pages deployment. Pushes to `main` build the static Next.js export and publish it to Pages.

Production URL:

https://mario.studio/iMatchstick/

## License

MIT License.

Copyright (c) Mario Studio 2026-2027
