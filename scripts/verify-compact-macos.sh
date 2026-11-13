#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
mkdir -p artifacts
nsh test App.tsx --target macos <<'STEPS'
await app.setViewport(1100,740);
await app.setColorScheme("dark");
await app.waitFor("id:catalog-search",{timeout:10000});
await app.wait(400);
expect(app.shows("role:button[YouTube]")).toBe(false);
await app.screenshot("artifacts/compact-catalog.png");
await app.paste("id:catalog-search",{text:"movie:157336"});
expect(app.value("id:catalog-search")?.trim()).toBe("movie:157336");
await app.submit("id:catalog-search");
await app.waitFor("role:button[Open Interstellar]",{timeout:10000});
await app.press("role:button[Open Interstellar]");
await app.waitFor("role:button[/^Preview /]",{timeout:18000});
await app.press("role:button[Clips]");
expect(app.count("id:theater-timeline")).toBe(0);
expect(app.count("id:media-player")).toBe(1);
await app.screenshot("artifacts/compact-focus.png");
await app.press("role:button[Clips]");
await app.press("role:button[Info]");
await app.waitFor("role:button[Subtitles…]");
await app.screenshot("artifacts/compact-inspector.png");
await app.press("role:button[Edit range…]");
expect(app.value("id:range-movie")).toBe("");
await app.screenshot("artifacts/compact-range.png");
await app.press("role:button[Cancel]");
await app.press("role:button[Done]");
await app.press("role:button[Immersive view]");
expect(app.count("id:theater-timeline")).toBe(0);
expect(app.shows("role:button[Back]")).toBe(false);
expect(app.count("id:media-player")).toBe(1);
await app.screenshot("artifacts/compact-immersive.png");
await app.press("role:button[Exit immersive view]");
await app.setViewport(900,600);
await app.wait(500);
await app.screenshot("artifacts/compact-900.png");
await app.setColorScheme("light");
await app.screenshot("artifacts/compact-light.png");
STEPS
