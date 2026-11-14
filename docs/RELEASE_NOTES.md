ReelPopcorn's first downloadable desktop alpha: watch available YouTube movie
scenes and show clips together in chronological order.

| Download | Requirements |
| --- | --- |
| `ReelPopcorn-v0.1.1-macos-arm64.zip` | Apple Silicon, macOS 14+ |
| `ReelPopcorn-v0.1.1-windows-x86_64.zip` | x64 Windows 10 1809+, WebView2 Runtime; experimental |
| `ReelPopcorn-v0.1.1-linux-x86_64.tar.gz` | x86_64 Ubuntu 24.04 or compatible, GTK 4.14+, WebKitGTK 6.0; experimental |

- TMDB movie/TV discovery, title/IMDb lookup and local watchlists.
- YouTube clip discovery using a separately installed yt-dlp or Invidious.
- Subtitle timing proposals, review, visible gaps and confirmed scene playback.
- Compact theater, bottom clip dock and native controls.
- New CI builds, tests and packages all three desktop targets. Every archive
  includes licenses and installation instructions, plus a SHA-256 checksum.
- Platform-specific yt-dlp executable lookup for Windows, Linux and macOS.

Extract the whole archive. No Node.js or NSH installation is needed to run the
app. Install yt-dlp separately for local discovery. See the included `INSTALL.md`
or the [installation guide](https://github.com/debpalash/ReelPopcorn/blob/main/docs/INSTALL.md).

CI checks the headless suite, a native theater interaction and packaged startup
on each target. It does not establish live YouTube playback or complete movie
coverage. Windows and Linux are experimental. The Mac app is ad hoc signed and
not notarized; the Windows executable is unsigned. No mobile, Intel Mac or ARM
Windows/Linux build is included.

Use official clips, licensed uploads or public-domain material. Uploader rights
are not verified. Missing clips and uncertain timings remain gaps. Application
code is MIT licensed; dependency licenses and media rights remain separate.
