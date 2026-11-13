# ReelPopcorn design

A compact macOS movie player, inspired by IINA's quiet window chrome. The catalog
finds a title; its theater gives almost all available space to the picture.

Use the macOS system face throughout: 13 point controls and titles, 11 point
metadata, monospace timecodes. Palette tokens stay in theme.json: dark background
#18181a, raised surface #242426, text #f5f5f7, secondary #a1a1a6, action #70b5ff;
light appearance uses #f5f5f7, #ffffff, #1d1d1f, #6e6e73 and #0066cc.

The window has no separate title bar. Keep native traffic lights and their actual
system exclusion area; the compact app bar (32 points requested, the system minimum when larger) is draggable. Glass belongs only to
functional chrome. No outer padding, rounded container around the whole app,
permanent sidebar or large headings in the theater.

    [traffic lights] Back   Movie title                  Info  Clips  Immersive
    ┌────────────────────────────────────────────────────────────────────────┐
    │                                                                        │
    │                       full-width video                                 │
    │                                                                        │
    └────────────────────────────────────────────────────────────────────────┘
    Play / seek / mute                      coverage / Play matched
    0:00 ── confirmed coverage / gaps ───────────────────────────── runtime
         stacked scene intervals at their verified positions
    [thumbnail + name] [thumbnail + name] [thumbnail + name] ...

The signature is a small editing timeline beneath a large picture: overlapping
clips occupy separate lanes, proposals remain muted, and unknown positions stay
in the filmstrip. Never fabricate a position from upload date or numbered clips.
The timeline can collapse for viewing; immersive view removes app chrome except
the playback strip, with Escape to restore it. Subtitle import and detailed matching live
in a dismissible inspector, which pauses the player while editing.

Playback remains one retained YouTube player in WKWebView. Compact mode uses the
supported controls=0 parameter and a 28 point native play/seek/mute strip. The
options menu restores YouTube controls with the current position retained. Its whole
viewport fits the available area; do not crop its controls, branding, ads or
picture. Native chrome has no browser address bar. Do not describe this backend
as AVPlayer or mpv. The old standalone YouTube library and queue are removed.

Controls retain semantic accessibility labels and keyboard focus. Native window
menus, light/dark appearance and system window controls remain. Escape dismisses
the inspector before leaving the title; Option-Right advances clips.

Motion is restrained: native hover/press color changes at 120ms; immediate source
updates in the retained player. Reduced motion removes app transitions. Sheet
motion is owned by the native component. No animation covers the picture.

TMDB identity establishes which title a candidate belongs to. Timed subtitle
alignment proposes a position; reviewed matches alone enter the cut. Gaps remain
visible and overlapping coverage is counted once. Discovery searches across the title's beginning and ending, related playlists,
and dialogue in gaps. Results appear incrementally without interrupting playback.
Matching and timing-source import remain inside the inspector; only coverage,
short progress text and the compact lanes appear beside the picture. TV uses
separate episode runtimes and persisted references. A title match or numbered
upload never supplies an absolute movie timestamp.

## Multiple media providers

Use Video.js 10.4 HTML adapters inside the retained WebView, with NSH owning the
existing native interface. Bundle each provider independently at build time;
only the selected provider's script enters the WebView. No React or runtime CDN.
The native bridge standardizes media events and exposes capabilities rather than
pretending every provider supports volume, rate, captions, or seeking.

Add clip opens a small native link form attached to the current title. Imported
links remain unplaced until timing is verified. Live channels and Spotify audio
stay playable in the collection but cannot claim movie runtime coverage. Existing
YouTube discoveries and confirmed annotations remain compatible. Native play,
seek and volume controls remain compact; provider UI is available in the options
menu. Motion and immersive layout are unchanged.
