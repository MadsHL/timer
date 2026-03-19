# Timer

Adaptive Stream Deck+ dial timer plugin for macOS.

## Features

- Adaptive dial rotation with intuitive step changes from fine to coarse adjustment.
- Configurable `seconds per notch` intervals and configurable speed thresholds for each interval.
- Short press starts, pauses, resumes, and resets after completion.
- Long press resets immediately.
- Timestamp-based countdown engine to avoid interval drift.
- Animated encoder touch-strip feedback with status-specific visuals.
- macOS completion sound through `afplay`, with configurable repeat count.
- Property inspector settings for default minutes, long-press threshold, max duration, adaptive step tuning, and sound options.

## Requirements

- macOS 12 or newer
- Node.js 20
- Stream Deck 6.9 or newer
- Stream Deck+
- Elgato Stream Deck CLI available through the local project dependency via `npx streamdeck`

## Development

For day-to-day development, start with:

```bash
npm run watch
```

`npm run watch` rebuilds the plugin on changes and restarts `dk.dasma.timer` automatically.

Before the first watch session, do the one-time setup:

```bash
npm install
npx streamdeck dev
npm run link
```

Useful commands:

```bash
npm run build
npm run restart
npm run validate
npm run pack
```

## Packaging

Package from the repository root with:

```bash
npm run pack
```

This overwrites the existing `dk.dasma.timer.streamDeckPlugin` package when needed.

Do not run plain `streamdeck pack` from `/Users/mlund/MyProjects/timer`. The repository root is not itself an `.sdPlugin` directory, so the Elgato CLI will fail unless you target `dk.dasma.timer.sdPlugin` explicitly.

## Project Layout

```text
src/
  actions/
  timer/
dk.dasma.timer.sdPlugin/
  imgs/
  layouts/
  ui/
  manifest.json
```

- `src/actions` contains Stream Deck action registration and event wiring.
- `src/timer` contains timer state, adaptive stepping, rendering, formatting, settings, and macOS sound playback.
- `dk.dasma.timer.sdPlugin` contains manifest, property inspector, layouts, and static assets.

## Commit Hygiene

Only source files and plugin assets needed to build the timer should be committed. Generated build output, runtime logs, editor metadata, `node_modules`, and leftover sample assets are ignored through `.gitignore`.
