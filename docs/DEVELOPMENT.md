# Development

ReelPopcorn is a TSX application using Native Shell 0.4.0. Desktop targets are
macOS arm64, Windows x86_64 and Linux x86_64. Windows/Linux remain experimental;
CI startup checks do not establish live provider playback. Node.js 22.18+ builds the local provider bundles
and runs the bridge/startup scripts; Node 22 is selected by `.node-version` and CI.

## Local workflow

Install NSH 0.4.0 using the framework's [installation guide](https://github.com/longbridge/nsh#quick-start).
The official installer accepts `NSH_VERSION=v0.4.0`. It installs the CLI and
matching runtimes together. The project does not vendor the framework or yt-dlp.

```sh
npm ci
npm run dev
npm run check
npm run package
```

`npm run dev` rebuilds the player adapters, then runs NSH on the current desktop
with a 1100 × 740 window. `make run TARGET=linux` and `make run TARGET=windows`
are also available where Make is installed; Make defaults to macOS.
NSH generates editor declarations
and its own configuration in ignored `.nsh/`. The runtime uses native signals,
resources and views; it is not React or React Native.

`npm run check` builds the adapters, typechecks, builds the app, runs the headless
NSH test suite and checks the actual player bridge, startup and platform process
lookup modules in Node. It uses shell-free Node commands on every desktop.
Tests mock HTTP responses and storage. Normal tests need no accounts or live
YouTube access. Live audits below are separate.

## Connections

Guest TMDB uses `https://movies-proxy.vercel.app/tmdb`, following Nuxt Movies.
It is a public demo proxy, not an application-owned production backend. Direct
mode sends requests to `https://api.themoviedb.org/3`. Enter a TMDB read token or
API key in **Connection…**. A `TMDB_READ_TOKEN` environment value is also supported
on hosts exposing `process.env`; the dev host may omit it and starts in guest mode.
Credentials are not written to app storage or sent to the guest proxy.

Scene discovery checks `yt-dlp.exe` then `yt-dlp` on Windows. Linux checks
`yt-dlp` on PATH, `/usr/local/bin/yt-dlp`, then `/usr/bin/yt-dlp`. macOS checks
`/opt/homebrew/bin/yt-dlp`, `/usr/local/bin/yt-dlp`, then `yt-dlp` on PATH.
Auto mode falls back to the bundled Invidious instance allowlist.
Native process jobs are shell-free, cancellable and bounded by time/output limits.
No YouTube Data API key, account cookies or media downloads are required by this
implementation. Metadata/caption access can fail or be restricted by providers.

## Matching and storage

Title identity includes movie/TV kind and TMDB ID. TV timelines also include
season and episode. Search metadata is candidate evidence, not a verified
content fingerprint or timestamp. Descriptions listing another film do not
establish identity. Short titles require stronger release evidence.

Each discovery pass searches six fresh queries with two concurrent jobs and
expands up to two playlists. Alias and gap-dialogue queries extend the search;
completed queries are stored. Up to 400 candidates are retained per title,
prioritizing placed and manually imported sources. Old unplaced results are
revalidated when the discovery revision changes.

Alignment indexes unique six-word dialogue anchors. Rolling caption windows are
deduplicated; identical dialogue occurring later stays ambiguous. Proposals need
at least three distinct clip cues and three reference cues, consistent offsets
and at least eight seconds of supported range. Cue word times are estimated,
not frame-accurate. Reference/source title and near-identical runtime checks do
not prove the same cut or eliminate an introductory offset: review is required.
Silent scenes need manual timing. The matcher does not extend a short match over
an entire upload.

Only confirmed ranges enter the assembled cut. The planner unions overlaps,
trims source offsets and preserves missing intervals. Changing the reference
removes transcript-derived placements. References and annotations are stored
locally for recent titles; the reference text is bounded to recent books.
Legacy `pocket-*` storage keys are internal format identifiers, not branding.

The public app uses `io.github.debpalash.reelpopcorn` as its bundle identity.
Data from the earlier local prototype's placeholder bundle is kept in that
prototype's separate app storage; there is no automatic migration.

## Other providers

| Provider | Imported links and limits |
| --- | --- |
| YouTube | Watch, share, Shorts, live and embed links or video ID |
| Vimeo | Videos, including unlisted hashes |
| Twitch | Recorded videos and channels; Twitch Clips unsupported |
| TikTok | Full video/player links; redirect short links unsupported; playback experimental |
| Spotify | Tracks, episodes, albums, playlists, shows and artists; login/preview limits apply |

Only seekable video ranges count toward a title's runtime. Audio, collections
and live streams stay outside movie coverage. Provider capabilities control
which native seek, speed, mute and volume actions appear. Provider controls remain
available; branding, ads and encoded black bars are not cropped out. Video.js
adapters handle playback, not scene discovery or movie identification.

## Structure

| Path | Responsibility |
| --- | --- |
| `App.tsx`, `nsh.json`, `theme.json` | Native window, identity, capability grants and theme |
| `src/tmdb/` | Catalog, title identity, guest/direct API, watchlists and extras |
| `src/scenes/search.ts`, `discovery.ts` | Search planning, metadata ranking and provider transports |
| `src/scenes/alignment.ts`, `model.ts` | Subtitle indexing, dialogue offsets and confirmed cut planning |
| `src/scenes/SceneTheater.tsx`, `state.ts` | Theater, review, per-title persistence and playback selection |
| `src/media/`, `src/Player.tsx` | Provider URLs, capabilities, bridge and native playback controls |
| `src/player-page.ts`, `src/generated/` | Local media pages and generated per-provider scripts |
| `scripts/build-player.mjs` | Player bundles and dependency notices |

Player bundles and `THIRD_PARTY_NOTICES.txt` are reproducible generated files
committed with the source. `npm ci` followed by `npm run build:player` regenerates
them. Keep the lockfile and license notices intact when changing dependencies.
Changing the app bundle ID also requires changing the origin in
`src/player-page.ts` and its WebView host grant in `nsh.json`.

## Live checks

```sh
node scripts/audit-discovery.mjs Interstellar 2014
THEATER_REFERENCE_ID=SEcsfcDCoVg node scripts/audit-discovery.mjs "Night of the Living Dead" 1968
scripts/verify-scenes-macos.sh
scripts/verify-tmdb-macos.sh
scripts/verify-compact-macos.sh
```

The audit bundles the actual discovery and alignment modules with a Node process
adapter and writes reports to ignored `artifacts/discovery-audit/`. The optional
reference ID identifies a source for relative timing; it is not proof of an exact
TMDB cut. Native verification scripts create real app windows and screenshots;
avoid running another dev/test session with the same bundle ID concurrently.
Do not commit full-film subtitle files, provider session URLs or private data.

## CI and packaging

The reusable `desktop-build.yml` runs on Apple Silicon `macos-15`, x64
`windows-2022` and x86_64 `ubuntu-24.04`, with Node 22 and NSH 0.4.0. Upstream
installers verify the distribution checksums. Linux installs GTK, WebKitGTK and
GStreamer libraries; native checks use Xvfb and a D-Bus session.

Every target runs the same headless checks, packages its native app, exercises a
native theater interaction and checks that the packaged executable stays running
for six seconds without a reported startup exception. This checks startup and
controls, not decoded video, audio or real provider availability. Each passing
target uploads its archive and checksum as a seven-day CI artifact. Live provider
audits are not required for pull requests.

`npm run package` writes the native app under `dist/native/<target>/` and a
versioned archive plus `.sha256` under `dist/releases/`. Each archive contains
one `ReelPopcorn/` directory with the app, licenses and installation instructions.
`make package` remains a convenience command for a bare local app under `dist/`.

To release a new alpha:

1. Update `nsh.json` version/build, `package.json` and its lockfile together.
2. Update `CHANGELOG.md`, `docs/RELEASE_NOTES.md`, download links and install examples.
3. Run `npm run check` and `npm run package`, then commit and push.
4. Tag that commit with the matching version, such as `v0.1.1`, and push the tag.

The Release workflow builds the exact tag, checks matching versions, waits for
all three targets, verifies all archive hashes, and publishes a GitHub prerelease
with `SHA256SUMS.txt`. Publication has a separate job with `contents: write`;
builds use read-only access. Existing public releases cannot be overwritten.
A failed publication leaves a draft that a manual rerun for the same tag can
finish. Change code under a new tag rather than moving an existing release tag.

Developer ID signing, notarization, Authenticode signing, Intel/universal Mac
packaging and mobile releases remain future work. No production speed, battery
or memory benchmark has been established. Runtime requirements and user setup
are in [INSTALL.md](INSTALL.md).
