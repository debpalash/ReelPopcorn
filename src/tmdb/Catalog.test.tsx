import { expect, open, test } from "nsh/test";

const movie = { id: 42, media_type: "movie", title: "Test Film", release_date: "2020-05-01", overview: "A film.", poster_path: null, runtime: 100, imdb_id: "tt1234567" };
const video = (key: string, name: string, date: string) => ({ id: key, key, site: "YouTube", name, type: "Clip", official: true, published_at: date, iso_639_1: "en" });
const detail = { ...movie, videos: { results: [video("aqz-KE-bpKQ", "Later clip", "2022-01-01"), video("ScMzIvxBSi4", "Earlier clip", "2020-01-01")] } };
const base = "https://movies-proxy.vercel.app/tmdb";
const network = {
  [`${base}/trending/*`]: { body: { results: [movie], page: 1, total_pages: 2, total_results: 2 } },
  [`${base}/movie/42?*`]: { body: detail },
  [`${base}/find/tt1234567?*`]: { body: { movie_results: [movie], tv_results: [] } },
  [`${base}/search/*`]: { body: { results: [], page: 1, total_pages: 1, total_results: 0 } }
};
const options = { width: 1220, height: 820, platform: "macos" as const, network: { ...network, "https://inv.nadeko.net/api/v1/search*": { body: [] } }, storage: { "pocket-scenes-v1": JSON.stringify({version:1,books:{},settings:{provider:"invidious",instance:"https://inv.nadeko.net"}}) } };

test("guest catalog opens an exact title and retains one player when switching clips", async () => {
  const app = await open("../../App.tsx", options);
  await app.waitFor("role:button[Open Test Film]");
  await app.press("role:button[Open Test Film]");
  await app.press("role:button[Extras]");
  await app.waitFor("role:button[Play Earlier clip]");
  expect(app.count("id:media-player")).toBe(1);
  await app.press("role:button[Play Later clip]");
  expect(app.count("id:media-player")).toBe(1);
  expect(app.enabled("role:button[Next]")).toBe(false);
  await app.press("role:button[Back]");
  expect(app.count("id:media-player")).toBe(0);
});

test("resolves an IMDb ID via TMDB find", async () => {
  const app = await open("../../App.tsx", options);
  await app.type("id:catalog-search", "tt1234567");
  await app.submit("id:catalog-search");
  await app.waitFor("role:button[Open Test Film]");
  expect(app.requests().some((request) => request.url.includes("/find/tt1234567") && request.url.includes("external_source=imdb_id"))).toBe(true);
});

test("saves story positions and watchlist across restarts", async () => {
  const app = await open("../../App.tsx", options);
  await app.press("role:button[Open Test Film]");
  await app.press("role:button[Extras]");
  await app.waitFor("role:button[Set story position]");
  await app.press("role:button[Set story position]");
  await app.type("id:story-position", "00:12:30");
  await app.press("role:button[Save position]");
  await app.press("role:button[Watchlist]");
  await app.waitUntil(() => Boolean(app.storage()["pocket-tmdb-v1"]));
  const state = JSON.parse(app.storage()["pocket-tmdb-v1"]);
  expect(state.positions["movie:42"]["ScMzIvxBSi4"].seconds).toBe(750);
  expect(state.watchlist[0].id).toBe(42);
  const restarted = await open("../../App.tsx", { ...options, storage: app.storage() });
  await restarted.press("role:button[Watchlist]");
  await restarted.press("role:button[Open Test Film]");
  await restarted.press("role:button[Extras]");
  await restarted.waitFor("role:button[Set story position]");
  expect(restarted.texts()).toContain("00:12:30");
});

test("handles offline guest access with retry and connection options", async () => {
  const app = await open("../../App.tsx", { ...options, network: { [`${base}/*`]: { error: "offline" } } });
  await app.waitFor("role:button[Retry]");
  expect(app.texts()).toContain("Can’t reach TMDB. Try again.");
  await app.press("role:button[Connection…]");
  expect(app.texts()).toContain("Guest · Nuxt Movies public proxy");
});

test("direct token connection stays out of local persistence", async () => {
  const app = await open("../../App.tsx", { ...options, network: {
    ...network,
    "https://api.themoviedb.org/3/configuration?*": { body: { images: {} } },
    "https://api.themoviedb.org/3/trending/*": { body: { results: [movie], page: 1, total_pages: 1 } }
  } });
  await app.press("role:button[Connection…]");
  await app.type("id:tmdb-token", "test-session-token");
  await app.press("role:button[Connect]");
  await app.waitFor("role:button[Open Test Film]");
  const request = app.requests().find((request) => request.url.includes("/3/configuration"));
  expect(request?.headers.Authorization ?? request?.headers.authorization).toBe("Bearer test-session-token");
  expect(JSON.stringify(app.storage()).includes("test-session-token")).toBe(false);
});

test("keeps same-numbered movie and TV clip associations separate", async () => {
  const tv = { id: 42, media_type: "tv", name: "Test Series", first_air_date: "2021-01-01", seasons: [{ season_number: 1, name: "Season 1" }], videos: { results: [video("M7lc1UVf-VE", "Series clip", "2021-01-01")] } };
  const app = await open("../../App.tsx", { ...options, network: {
    ...network,
    [`${base}/trending/*`]: { body: { results: [movie, tv], page: 1, total_pages: 1 } },
    [`${base}/tv/42?*`]: { body: tv },
    [`${base}/tv/42/season/1?*`]: { body: { id: 999, name: "Season 1", episodes: [{ episode_number: 1, name: "Pilot", air_date: "2021-01-01" }], videos: { results: [] } } },
    [`${base}/tv/42/season/1/episode/1?*`]: { body: { id: 1000, name: "Pilot", runtime: 45, videos: { results: [video("ScMzIvxBSi4", "Episode clip", "2021-01-01")] } } }
  } });
  await app.press("role:button[Open Test Series]");
  await app.press("role:button[Extras]");
  await app.waitFor("role:button[Play Series clip]");
  expect(app.shows("role:button[Play Later clip]")).toBe(false);
  await app.press("role:button[Season 1]");
  await app.waitFor("role:button[E1 · Pilot]");
  await app.press("role:button[E1 · Pilot]");
  await app.waitFor("role:button[Play Episode clip]");
  expect(app.requests().some((request) => request.url.includes("/tv/42/season/1/episode/1?"))).toBe(true);
});

test("shows unplaced clips and validates, saves, and clears a story marker", async () => {
  const app = await open("../../App.tsx", options);
  await app.press("role:button[Open Test Film]");
  await app.press("role:button[Extras]");
  await app.waitFor("role:button[Story order]");
  await app.press("role:button[Story order]");
  expect(app.texts()).toContain("Unplaced videos follow positioned clips.");
  await app.press("role:button[Set story position]");
  await app.type("id:story-position", "99:99");
  await app.press("role:button[Save position]");
  expect(app.texts()).toContain("Use mm:ss or hh:mm:ss.");
  await app.clear("id:story-position");
  await app.type("id:story-position", "00:05:00");
  await app.press("role:button[Save position]");
  expect(app.count("id:story-ruler")).toBe(1);
  await app.press("role:button[Set story position]");
  await app.press("role:button[Clear]");
  expect(app.count("id:story-ruler")).toBe(0);
});

test("does not reuse a wrong title returned for a direct TMDB ID", async () => {
  const app = await open("../../App.tsx", { ...options, network: { ...network, [`${base}/movie/42?*`]: { body: { ...detail, id: 100 } } } });
  await app.press("role:button[Open Test Film]");
  await app.press("role:button[Extras]");
  await app.waitFor("role:button[Retry]");
  expect(app.texts()).toContain("TMDB returned a different title.");
  expect(app.count("id:media-player")).toBe(0);
});
