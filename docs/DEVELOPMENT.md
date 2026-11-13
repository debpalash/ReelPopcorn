# Development

ReelPopcorn is a TSX application using Native Shell 0.4.0. Current support and
validation are for macOS only. Node.js 22.18+ builds the local provider bundles
and runs the bridge/startup scripts; Node 22 is selected by `.node-version` and CI.

## Local workflow

Install NSH 0.4.0 using the framework's [installation guide](https://github.com/longbridge/nsh#quick-start).
The official installer accepts `NSH_VERSION=v0.4.0`. It installs the CLI and
matching runtimes together. The project does not vendor the framework or yt-dlp.

```sh
npm ci
make run
make check
make package
```

`make run` rebuilds the player adapters, then runs
`nsh run --target macos --window-size 1100x740`. NSH generates editor declarations
and its own configuration in ignored `.nsh/`. The runtime uses native signals,
resources and views; it is not React or React Native.

`make check` builds the adapters, typechecks, builds the app, runs the headless
NSH test suite and checks the actual player bridge and startup modules in Node.
Tests mock HTTP responses and storage. Normal tests need no accounts or live
YouTube access. Live audits below are separate.

## Connections

Guest TMDB uses `https://movies-proxy.vercel.app/tmdb`, following Nuxt Movies.
It is a public demo proxy, not an application-owned production backend. Direct
mode sends requests to `https://api.themoviedb.org/3`. Enter a TMDB read token or
API key in **Connection…**. A `TMDB_READ_TOKEN` environment value is also supported
on hosts exposing `process.env`; the dev host may omit it and starts in guest mode.
Credentials are not written to app storage or sent to the guest proxy.

Scene discovery checks `/opt/homebrew/bin/yt-dlp`, `/usr/local/bin/yt-dlp`, then
`yt-dlp` on PATH. Auto mode falls back to the bundled Invidious instance allowlist.
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

GitHub Actions uses the Apple Silicon `macos-15` runner, Node 22 and NSH 0.4.0.
The upstream NSH installer verifies the downloaded distribution checksum. CI runs
`make check`, packages the app and uploads a seven-day build artifact. Live
provider audits are not required for pull requests.

`dist/ReelPopcorn.app` is an ad hoc signed Apple Silicon bundle. Developer ID
signing, notarization, Intel/universal packaging and mobile releases are future
work. No production speed, battery or memory benchmark has been established.
