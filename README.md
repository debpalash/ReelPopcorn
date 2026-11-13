# ReelPopcorn

**Watch movie and show clips together, free on YouTube.**

ReelPopcorn finds scenes from a title, matches their dialogue to a timed reference,
and brings confirmed clips into one movie-style timeline. A compact Mac window
keeps the picture front and center, with clips stacked along the bottom.

[![CI](https://github.com/debpalash/ReelPopcorn/actions/workflows/ci.yml/badge.svg)](https://github.com/debpalash/ReelPopcorn/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Platform: macOS](https://img.shields.io/badge/platform-macOS-black.svg)](#run)

Public alpha · macOS first. iOS and Android are planned, with no release date.

## What it does

- **Find scenes.** Search YouTube uploads and playlists by title, release, opening,
  ending and dialogue in uncovered sections. No YouTube Data API key is needed.
- **Arrange the timeline.** Match captions against the same cut's timed subtitles,
  review proposed positions, trim overlaps and play confirmed ranges in order.
- **Browse movies and shows.** TMDB catalog, title/IMDb lookup, episode-specific
  runtimes and a local watchlist.
- **Focus on the picture.** Frameless window, native controls, dark/light appearance,
  a small clip dock and immersive mode.

ReelPopcorn plays the available scenes. It does **not** guarantee a complete movie:
missing uploads, unavailable captions, alternate cuts and silent scenes leave gaps.
Clip names, numbering and upload dates never stand in for verified movie times.

## Run

Requires **macOS 14+**, **Apple Silicon**, **Node.js 22.18+**,
[Native Shell 0.4.0](https://github.com/longbridge/nsh/releases/tag/v0.4.0),
and `yt-dlp` for local discovery. Intel Macs require building NSH from source
and have not been tested with this app.

Install NSH using its [official instructions](https://github.com/longbridge/nsh#quick-start)
with `NSH_VERSION=v0.4.0`. Then:

```sh
brew install node yt-dlp
git clone https://github.com/debpalash/ReelPopcorn.git
cd ReelPopcorn
npm ci
make run
```

Guest TMDB browsing works without a personal token through the public
[Nuxt Movies proxy](https://github.com/nuxt/movies). **Connection…** accepts your
own TMDB token and lets you choose yt-dlp or an Invidious instance. Public
providers can become unavailable; no application-owned backend is required.

## Watch in order

1. Open a movie, or choose a season and episode for a show. Scenes appear as
   discovery progresses; **Find more** searches additional queries and playlists.
2. Open **Info → Subtitles…**. Paste the exact cut's SRT/WebVTT, or use **Find
   timing source** to read captions from a matching full-length YouTube source.
   Check the cut, timecodes and runtime before saving.
3. Caption matching starts automatically. Review each proposed position and
   source range, then choose **Confirm match**. Use **Edit range…** for a scene
   whose position you have verified manually.
4. Choose **Play matched**. Confirmed clips play in movie order. The timeline
   shows coverage and missing sections; overlapping uploads count once.

**＋ / ⌘O** adds a source link. Imported YouTube, Vimeo, Twitch, TikTok and Spotify
links use Video.js adapters. Automatic discovery and caption matching are
YouTube-based. Provider playback has different limits; TikTok playback remains
experimental. Audio, collections and live streams cannot count toward a movie's
runtime. See [provider details](docs/DEVELOPMENT.md#other-providers).

| Shortcut | Action |
| --- | --- |
| ⌘F | Search titles |
| ⌘1 / 2 / 3 / 4 | Discover / Movies / TV / Watchlist |
| ⌘O | Add a source |
| Option + Right | Next clip |
| ⌘⇧F | Toggle immersive mode |
| Escape | Close editor, inspector or immersive mode |
| ⌘, | Connection settings |

## Sources and rights

Use official clips, licensed uploads or public-domain material. ReelPopcorn does
not verify an uploader's rights and does not make every YouTube upload lawful to
reuse. Free software is not a license to the underlying films, clips or subtitles.

Playback uses the provider's embedded player. Video files are not downloaded,
re-encoded or hosted by ReelPopcorn. Ads, branding, availability, embedding
restrictions and account requirements remain controlled by the provider.
yt-dlp/Invidious retrieve metadata and available captions; their availability
and permitted use depend on the service. Follow
[YouTube's terms](https://www.youtube.com/static?template=terms) and
[player requirements](https://developers.google.com/youtube/terms/required-minimum-functionality).
ReelPopcorn is independent of YouTube and TMDB.

## Build and contribute

```sh
make check          # typecheck, build, 48 tests, player bridge and startup checks
make package        # dist/ReelPopcorn.app
open dist/ReelPopcorn.app
```

The local Apple Silicon bundle is ad hoc signed and **not notarized**. This alpha
is a source release, not an App Store or Developer ID signed distribution.
GitHub Actions also builds a short-lived Mac app artifact for each passing run.

Built with [Native Shell](https://github.com/longbridge/nsh), TypeScript/TSX and
[Video.js HTML](https://videojs.org/). Browsing, timelines and controls are native;
one retained WKWebView supplies provider playback. Node is a development tool,
not a packaged-app requirement.

See [development](docs/DEVELOPMENT.md), [design](docs/DESIGN.md),
[validation](docs/VALIDATION.md), [changelog](CHANGELOG.md) and
[contributing](CONTRIBUTING.md). Bugs and ideas belong in
[Issues](https://github.com/debpalash/ReelPopcorn/issues).

Watchlists, subtitle references and annotations stay in app-local storage.
TMDB tokens are held for the session. There is no application analytics; metadata,
artwork and playback requests contact their respective providers.

## License and credits

[MIT](LICENSE) for original application code. Dependency licenses and media rights
are separate; see [credits](NOTICE.md) and
[third-party notices](THIRD_PARTY_NOTICES.txt).

Inspired by [Nuxt Movies](https://github.com/nuxt/movies),
[Reiverr](https://github.com/aleksilassila/reiverr) and
[SuggestArr](https://github.com/giuseppe99barchetta/SuggestArr).

This product uses the TMDB API but is not endorsed or certified by TMDB.
