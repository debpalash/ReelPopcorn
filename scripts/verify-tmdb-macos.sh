#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
mkdir -p artifacts
nsh test App.tsx --target macos <<'STEPS'
await app.setViewport(1220, 820);
await app.setColorScheme("light");
await app.waitFor("id:tmdb-catalog", { timeout: 10000 });
await app.wait(700);
await app.screenshot("artifacts/tmdb-light.png");
await app.setColorScheme("dark");
await app.wait(300);
await app.screenshot("artifacts/tmdb-dark.png");
await app.paste("id:catalog-search", { text: "movie:157336" });
await app.submit("id:catalog-search");
await app.waitFor("role:button[Open Interstellar]", { timeout: 10000 });
await app.press("role:button[Open Interstellar]");
await app.press("role:button[Extras]");
await app.waitFor("id:clip-timeline", { timeout: 10000 });
expect(app.count("id:media-player")).toBe(1);
await app.wait(1500);
await app.screenshot("artifacts/tmdb-theater.png");
await app.press("role:button[Story order]");
expect(app.count("id:media-player")).toBe(1);
await app.screenshot("artifacts/tmdb-story.png");
STEPS
