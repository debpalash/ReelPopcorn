# Validation

macOS, NSH `0.4.0 (e626a8d)`, Xcode 27.1, Node 26.1.0.
The delivery target is macOS. iOS and Android have not been built.

## Discovery and timeline accuracy — November 13, 2026

- Reproduced title false positives (short ordinary words, comparisons, AI/LEGO
  recreations, and secondary title references). Regression cases now reject them
  while preserving real scenes such as Cooper's emotional breakdown.
- Actual discovery module live audit: Interstellar checked 235 result entries
  across six searches and two playlists, retaining 66 unique candidates in the
  final run. Earlier runs varied from 63–70 as YouTube results/filtering changed.
  Result counts are not a coverage or relevance-precision measurement.
  Opening/ending material and the ten Movieclips uploads were found. Reports are
  artifacts/discovery-audit/interstellar-deep.json and the baseline metadata files.
- A second live audit found 31 Night of the Living Dead (1968) scene candidates.
  Captions from full-length source SEcsfcDCoVg aligned two of six tested uploads:
  opening-scene dialogue at about 06:17, and the final posse scene at about 92:22.
  Both proposals used five distinct anchors; observed offset spreads were 1.18
  and 2.10 seconds. Four tested uploads had unavailable captions. These are
  subtitle estimates relative to that source, not frame-accurate ground truth.
  Source runtime is 5,790 seconds from video metadata; the last caption endpoint
  is earlier and is not used as the movie runtime.
- Headless end-to-end test discovers uploads in reverse order, automatically
  fetches their captions and proposes opening/middle/ending positions at 0, 600
  and 1,179 seconds in a 1,200-second synthetic title. Confirmed ranges reach
  the start/end exactly while leaving the large internal gaps visible.
  The same test passed in an isolated native AppKit app (6.8 seconds).
- Additional integration checks cover episode-specific discovery/runtime storage
  and finding/importing a matching full-runtime caption source. The latter also
  passed in native AppKit; artifacts/timing-source-macos.png shows its inspector.
  Search module
  checks cover progressive publication, fresh queries, dialogue-directed gap
  search, partial provider failure, cancellation and wrong episode exclusion.
- Dev-host probe confirmed yt-dlp process.spawn works even though process.env is
  absent. No permission or environment change was required.
- Sources are checked for matching title/release and near-identical duration;
  users must verify the cut and its zero point. Matching captions starts
  automatically, but proposals require confirmation. Missing uploads, missing
  captions, alternate edits and silent scenes prevent universal full coverage.
  Complete reconstruction of a real movie has not been validated or claimed.

## Video.js integration

- Video.js HTML adapters are pinned to 10.4.0. Each provider is bundled separately;
  only the selected provider enters the WebView. No React or runtime CDN is used.
  Bundles include dependency notices. Generated sizes are approximately 34 KB for
  YouTube, 56 KB for Vimeo, and 29–30 KB for Twitch, TikTok and Spotify.
- Add clip / Command-O imports a provider URL into the current movie collection.
  Imported links, durations and verified positions survive restart. Provider IDs
  remain separate. Removing a link also removes its placements.
- Native play/pause, source-bounded seek, mute, speed and volume follow provider
  capabilities. Spotify audio and live channels cannot count as movie coverage.
  YouTube discovery/caption alignment is covered above; other video sources can
  use manual ranges or imported transcripts.
- Native Mac checks loaded YouTube metadata, loaded a 62-second Vimeo sample, and
  imported/removed that Vimeo source through the movie's native inspector in an
  isolated validation app. Spotify reported a 29-second preview. Twitch delivered
  an offline event for the checked channel. These are provider-session checks,
  not a speed benchmark or proof of all live channels and entitlements.
- Two TikTok sample URLs did not initialize the player API in this environment.
  The adapter and URL importer are included, with TikTok's minimum logical frame
  size preserved and scaled to fit. Actual TikTok playback remains unverified;
  timeout/reload/open-source recovery stays available. No user-agent override is
  shipped. Login, region, availability and provider restrictions still apply.
- The dev-host crash reading TMDB_READ_TOKEN was reproduced with nsh run and with
  the actual state module under an absent process.env fixture. Optional access
  fixed both paths. Guest mode works without process.env; a session token still
  selects direct mode. scripts/test-startup.mjs covers both cases.
- Bridge tests exercise real transport code with adapter events: provider loading,
  stale requests/events, equal-URL range changes, replay, end-once behavior, seek
  bounds, speed/volume/mute capabilities, zero-duration live metadata and offline.
- The full suite now has 48 tests plus the Node bridge and startup checks.
  Mobile builds remain deferred; this integration was exercised on macOS only.

## Compact theater update

- Named the app ReelPopcorn, removed the old standalone YouTube library/queue and
  retained the bundle identity and existing movie data.
- Hidden title bar with native traffic-light exclusion area and draggable compact
  chrome. The header requests 32 points; AppKit may use a larger system minimum.
- Full-width retained player, 28 point native playback strip, 48 point horizontal
  clip list and runtime-scaled overlap lanes. Unknown runtimes have no empty ruler.
- Immersive view removes the header and clip dock, retaining only playback controls;
  Escape or its restore button returns to the theater without replacing playback.
- Compact playback sets YouTube's supported controls=0 option and drives play/pause,
  source-bounded seeking and mute through the IFrame API. The native options menu
  restores YouTube controls and resumes at the current position. No iframe clipping
  or cross-origin DOM manipulation is used. YouTube can still show paused titles,
  related-video overlays, ads and letterboxing.
- Native live checks exercised the compact inspector and range form, collapsed the
  dock, resized to 900 × 600, and captured light/dark layouts. A separate native run
  received the playing state and progress time, and switched between native and
  YouTube controls while retaining one player. Screenshots are artifacts/compact-*.
- A native synthetic fixture exercised stacked overlapping confirmed clips and a
  separate proposal. Its times are test data, not a real movie reconstruction.
- Node bridge checks cover play/pause, mute/unmute, progress events, finite and
  source-bounded seeking, compact parameters, source ranges and stale identities.
- An exploratory yt-dlp progressive-MP4 probe found no compatible format for the
  sample video. Native AVPlayer/stream extraction is not shipped in this update.

## Scene assembly update

- New title pages discover scene uploads using native yt-dlp, with Invidious
  fallback. TMDB trailers and featurettes are now under Extras.
- A live Invidious search on yt.chocolatemoo53.com returned 19 results. Three
  other listed instances returned HTTP 403 from this environment. The working
  instance is preferred for new configurations; all requests have time limits.
- Live CLI and native Mac discovery of Interstellar returned 19 accepted candidates
  from multiple uploaders; a later run returned 15 after stricter promo filtering; no API key was used. Native process execution, parsing,
  candidate filters and the new view were exercised on this machine.
- `scripts/verify-scenes-macos.sh`: native live search passed; dark/light captures
  are `artifacts/scene-discovery*.png`. The UI shows 0% confirmed coverage without
  a timing reference, rather than fabricating a movie cut.
- End-to-end fixture tests import movie subtitles, align clip captions, review a
  proposal, confirm its range, play the assembled segment, select a gap, and restore
  confirmed data after restart. Another test fetches captions through mocked
  Invidious responses. The timecodes in these fixtures are synthetic test data.
- Model tests cover unique dialogue anchors, ambiguous repeated dialogue, unrelated
  transcripts, promotional uploads, release-year mismatch, source duration bounds,
  overlap union, source trim offsets and uncovered runtime intervals.
- The embedded-page bridge test covers start/end ranges and rejects an end before
  the start. Actual end-event chaining across real matched movie sources remains
  an interactive check.
- Local yt-dlp metadata probes returned available subtitle-track metadata for a
  Paramount clip. Caption availability varies by uploader/provider. A later live full-source caption alignment is recorded above. Complete
  reconstruction has not been validated on a real film.
- Reference text is stored only in app-local Storage, bounded to recent titles.
  Transcript-derived placements are removed when the reference changes. Proposed
  matches do not count as coverage. Provider jobs are cancellable native child
  processes with time/output limits and shell-free arguments.

## Automated

- `nsh check`: passed against the installed CLI's generated declarations.
- `nsh build`: passed, including the bundled TMDB logo and native glass property.
- `nsh test`: **48 passed**. Includes TMDB, scene alignment/assembly, provider import/persistence, capability limits, URL validation and cross-provider coverage. The removed standalone YouTube library no longer has an entry or tests.
- `node scripts/test-player.mjs`: passed. Runs the actual page script against the
  IFrame API contract, checking load/pause, invalid IDs, identity, late state events,
  errors and autoplay-blocked events.
- `scripts/verify-tmdb-macos.sh`: passed against live guest data in native Mac
  windows. Captured light/dark catalog and theater/story-order views. Opened
  `movie:157336`, loaded 45 videos linked to Interstellar, and retained one player
  on an ordering change.
- Additional native live run: selected the Clips filter (7 clips for that title),
  saved a temporary test position, displayed a runtime-scaled ruler, and received
  YouTube's playing state. The temporary marker tested mechanics; it is not a
  verified story mapping. Final live screenshots do not include it.
- `nsh package --target macos --out dist`: passed. `dist/ReelPopcorn.app` is about
  39 MB, Apple Silicon arm64, ad hoc signed. Signature verification passed on the
  packaged app. It is not notarized or a tested universal build.

## Content and identity

- Guest access uses Nuxt Movies' documented public proxy. Live trending and title
  endpoints returned data without a local credential.
- A direct TMDB token is tested with mocked HTTP responses and authorization-header
  checks. No real private TMDB token was available for live direct-mode validation.
- Movie/TV identity includes media type and TMDB ID. IMDb uses TMDB's find endpoint.
  Season/episode requests retain their parent scope. A mismatched root detail ID
  produces an error rather than displaying or playing another title's videos.
- Extras accept YouTube videos from the selected TMDB videos response with valid
  keys. Scene discovery validates title/year evidence; manually imported provider
  URLs are validated separately and remain unplaced. Duplicate identities collapse.
- Published order uses API dates. Story order uses explicit local positions;
  missing positions remain unplaced. Scene timecodes are not inferred from names,
  upload dates or trailer numbers. The Extras view does not infer plot positions. The scene view now supports reference-subtitle alignment as described above.
- Watchlists and positions survive restarts in tests. API credentials are absent
  from persisted state. Direct credentials are not sent to the guest proxy.

## Visual review

Native screenshots are in `artifacts/tmdb-*.png`.

| Group | Result |
| --- | --- |
| Radius | Reviewed; shared poster, row, field and toolbar radii |
| Typography | Reviewed; system face, short labels, no promotional headings; long poster names truncate |
| Spacing and alignment | Reviewed at 1000 × 640, 1220 × 820 and 1360 × 900; aligned poster and clip lanes |
| Color and surfaces | Reviewed in light/dark; semantic tokens, neutral content, native regular Liquid Glass confined to navigation |
| Glass | Native `glassEffect` with blur fallback; uniform toolbar backgrounds limit the visible refraction; arbitrary moving content and increased-contrast settings need further review |
| Hover | Shared native transition/wash implemented; a held native press frame has not been separately captured |
| Pressed / selected | Shared semantic button active/selected styling; selected clip and ordering visible in captures |
| UI layer | Shared semantic buttons, fields and glass bar; dedicated poster, clip-row and story-ruler components |
| Other states | Loading, unavailable guest API, empty clips, invalid timecodes, wrong title and local persistence paths covered by UI/tests |
| Motion | Native color/layout transitions and reduced-motion handling implemented; sorting/positioning preserve playback source; every animation frame has not been measured |
| Keyboard / accessibility | Role/name selectors and keyboard navigation covered; VoiceOver, increased text size and complete iframe keyboard interaction remain manual checks |
| Platforms | macOS only; 900 × 600 is the documented minimum window size. Catalog and theater inspected at that size; details below the frame scroll |

## Playback limits

Live title checks received YouTube ready/state events, including `Playing on
YouTube`. Native captures include YouTube's actual player controls and branding;
the video picture itself is black in these captures. They do not prove decoded
video frames or audible sound. Continuous playback, fullscreen, buffering recovery,
audio and automatic progression on an actual end event still need an interactive
Mac pass. No speed, battery, buffering or memory improvement is benchmarked.

Earlier exploratory runs included one host disconnection and one test exceeding
its 30-second timeout. The committed live script completes below that limit and
subsequent native checks passed. An attempted combined substring filter selected
zero tests; the intended test file was then run explicitly and all eight passed.
