# Contributing

ReelPopcorn targets macOS, with experimental Windows and Linux builds.
Read the [development guide](docs/DEVELOPMENT.md)
and [interface design](docs/DESIGN.md) before making a change.

1. Fork the repository and create a branch.
2. Install the pinned tools, then run `npm ci` and `npm run dev`.
3. Make a focused change. Keep the theater compact and interface text short.
4. Run `npm run check`. Add a regression check for changes to matching, playback,
   provider URL validation or persistence.
5. Open a pull request with the problem, resulting behavior and validation.

For timeline work, a matching title or clip number does not establish a movie
timestamp. Keep proposals separate from confirmed coverage, preserve gaps, and
test overlap trimming and episode identity.

Use public, authorized test sources. Do not commit credentials, cookies, media
downloads, copied full-film subtitles or local app storage. Live provider audits
are opt-in and write to ignored `artifacts/`.

Report bugs with OS/version/CPU, `nsh --version`, reproduction steps and the provider
URL or title identity when relevant. Remove tokens and personal data from logs.
Contributions are accepted under the [MIT license](LICENSE); third-party notices
must remain intact.
