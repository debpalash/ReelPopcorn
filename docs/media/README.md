# ReelPopcorn screenshots and demo

These are native macOS app captures, resized and stripped of image metadata.
No video picture, controls or timeline coverage has been painted into a screenshot.

| File | Capture |
| --- | --- |
| [discover.png](discover.png) | TMDB catalog in the current Mac app, November 14, 2026 |
| [theater.png](theater.png) | Compact theater, clip dock and source importer, November 13, 2026; the video area shows YouTube's static preview for Paramount Movies' Interstellar clip |
| [match-review.png](match-review.png) | Cropped native inspector, November 14, 2026; an unconfirmed proposal restored from the November 13 live caption audit |
| [reelpopcorn-demo.gif](reelpopcorn-demo.gif) | Loop of catalog, title search and theater/source-import captures; an interface tour, not a continuous screen or playback recording |
| [social-preview.png](social-preview.png) | 1280 × 640 share card, composed from the catalog capture and project text |

The match-review proposal uses five dialogue anchors from the live
[Night of the Living Dead clip](https://www.youtube.com/watch?v=_d68kyNY0jI)
against timing source `SEcsfcDCoVg`. It is relative to that source's cut, has
about 1.2 seconds of offset spread, and remains **unconfirmed**. No complete
movie reconstruction or frame-accurate alignment is demonstrated. See
[validation](../VALIDATION.md#discovery-and-timeline-accuracy--november-13-2026).
The capture restores metadata and proposals; it includes no film subtitle file.

The theater preview is from
[Paramount Movies' Interstellar clip](https://www.youtube.com/watch?v=60h6lpnSgck).
TMDB supplies catalog metadata and posters; YouTube and uploaders supply video
previews, thumbnails and branding. Those materials retain their owners' rights
and are outside the application's MIT license. These images document the app;
they do not grant rights to the underlying films or artwork.

## Refresh the media

Use NSH 0.4.0's native capture tools on a Mac:

```sh
scripts/verify-compact-macos.sh
scripts/verify-scenes-macos.sh
```

Run these from the repository root. They write local captures under ignored
`artifacts/`. Live catalog and discovery results change, so inspect each capture
before replacing a public asset. Wait for artwork to load. Do not publish tokens,
personal watchlists, full subtitle files or fixture timecodes as real movie
coverage. NSH snapshots can omit decoded video frames; use a genuine static
provider preview rather than inserting film frames.

Keep screenshots at no more than 1440 pixels wide and GIFs under 2 MB. Keep all
frames on one canvas, preserve provider branding and use descriptive README alt
text. The GIF loops without requiring a hosted video service.

## GitHub social preview

The share card is ready for the repository's **Settings → Social preview → Edit →
Upload an image**. Adding this file to the README or repository does not activate
GitHub's social preview setting. GitHub's repository API and the available CLI
do not provide the upload action; it requires GitHub's settings interface.

The card follows GitHub's recommended 1280 × 640 size and is under 1 MB. See
[GitHub's social preview instructions](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/customizing-your-repositorys-social-media-preview).
