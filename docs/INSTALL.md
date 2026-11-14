# Install ReelPopcorn

Download the archive for your computer from
[GitHub Releases](https://github.com/debpalash/ReelPopcorn/releases).
The desktop alpha includes macOS arm64, Windows x86_64 and Linux x86_64 builds.
Windows and Linux are experimental: CI checks native startup and theater controls;
live provider playback still needs testing on those systems. iOS and Android are
not included. Intel Macs and Windows/Linux ARM builds are not included.

## macOS

Requires an Apple Silicon Mac running macOS 14 or later. Extract the ZIP and move
`ReelPopcorn.app` to Applications. The bundle is ad hoc signed, not Developer ID
signed or notarized. macOS may block the first launch; after verifying the source
and checksum, use the app-specific **Open Anyway** option in Privacy & Security.
Do not disable Gatekeeper globally.

## Windows

Requires x64 Windows 10 version 1809 or later and the
[Microsoft Edge WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/).
Extract the entire ZIP and run `ReelPopcorn.exe`. Keep the adjacent `nsh` folder;
the executable alone is not the app. This portable alpha has no installer and
is not Authenticode signed. Windows may show an unknown-publisher warning.

## Linux

Requires x86_64 Linux with glibc 2.39+, GTK 4.14+ and WebKitGTK 6.0 (Ubuntu 24.04
or a compatible newer distribution). Install the runtime libraries on Ubuntu:

```sh
sudo apt-get install libgtk-4-1 libwebkitgtk-6.0-4 \
  gstreamer1.0-plugins-good gstreamer1.0-plugins-bad gstreamer1.0-libav
tar -xzf ReelPopcorn-v0.1.1-linux-x86_64.tar.gz
./ReelPopcorn/ReelPopcorn
```

Keep the extracted directory together. This is a native GTK archive, not an
AppImage, Flatpak or Debian package. GStreamer codecs and the source provider
determine which media formats are available.

## Scene discovery

Install [yt-dlp](https://github.com/yt-dlp/yt-dlp#installation) and make it available
on PATH (`yt-dlp.exe` on Windows). Restart ReelPopcorn after installation.
macOS also checks Homebrew's standard paths; Linux checks `/usr/local/bin` and
`/usr/bin`. Auto mode falls back to the configured Invidious instances.
No YouTube Data API key is required. Node.js and NSH are not needed to run a
downloaded desktop app. yt-dlp is a separate dependency, not included in archives.

## Verify a download

Each archive has a matching `.sha256` file; `SHA256SUMS.txt` contains every
platform's digest. Download both from the same release.

macOS:

```sh
shasum -a 256 -c ReelPopcorn-v0.1.1-macos-arm64.zip.sha256
```

Linux:

```sh
sha256sum -c ReelPopcorn-v0.1.1-linux-x86_64.tar.gz.sha256
```

Windows PowerShell: compare the result with the downloaded checksum file.

```powershell
Get-FileHash .\ReelPopcorn-v0.1.1-windows-x86_64.zip -Algorithm SHA256
Get-Content .\ReelPopcorn-v0.1.1-windows-x86_64.zip.sha256
```

Checksums detect changed or corrupted archives; they do not replace platform
code signing. The MIT application license, dependency notices and this guide
are included in each archive. Provider media rights are separate.
