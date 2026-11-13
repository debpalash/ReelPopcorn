#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
mkdir -p artifacts
nsh test App.tsx --target macos <<'STEPS'
await app.setViewport(1360, 900);
await app.waitFor("id:catalog-search", { timeout: 10000 });
await app.paste("id:catalog-search", { text: "movie:157336" });
await app.submit("id:catalog-search");
await app.waitFor("role:button[Open Interstellar]", { timeout: 10000 });
await app.press("role:button[Open Interstellar]");
await app.waitFor("role:button[/^Preview /]", { timeout: 18000 });
expect(app.count("id:media-player")).toBe(1);
expect(app.texts()).toContain("0% matched");
await app.wait(1500);
await app.screenshot("artifacts/scene-discovery.png");
await app.setColorScheme("light");
await app.wait(300);
await app.screenshot("artifacts/scene-discovery-light.png");
STEPS
