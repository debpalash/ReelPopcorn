import { expect, test } from "nsh/test";
import { formatTime, normalizeClips, parseSearch, parseTime, sortClips, titleKey } from "./model";

const source = { kind: "movie" as const, id: 42 };
const raw = (key: string, name: string, published_at: string, official = true) => ({ id: name, site: "YouTube", key, name, published_at, official, type: "Clip" });

test("keeps valid YouTube associations, deduplicates and preserves title identity", () => {
  const clips = normalizeClips([
    raw("aqz-KE-bpKQ", "Unofficial", "2020-01-01", false),
    raw("aqz-KE-bpKQ", "Official", "2020-01-01"),
    { ...raw("ScMzIvxBSi4", "Other site", "2020-01-01"), site: "Vimeo" },
    raw("invalid", "Bad ID", "2020-01-01")
  ], source);
  expect(clips.length).toBe(1);
  expect(clips[0].name).toBe("Official");
  expect(titleKey(clips[0].source)).toBe("movie:42");
  expect(titleKey({ kind: "tv", id: 42 })).toBe("tv:42");
});

test("sorts publications oldest first with undated entries last", () => {
  const clips = normalizeClips([raw("aqz-KE-bpKQ", "Later", "2024-01-01"), raw("ScMzIvxBSi4", "Earlier", "2020-01-01"), raw("M7lc1UVf-VE", "Undated", "bad")], source);
  expect(sortClips(clips, "published", {}).map((clip) => clip.name)).toEqual(["Earlier", "Later", "Undated"]);
});

test("story positions override publications without assigning unknown positions", () => {
  const clips = normalizeClips([raw("aqz-KE-bpKQ", "Early upload", "2020-01-01"), raw("ScMzIvxBSi4", "Late upload", "2024-01-01"), raw("M7lc1UVf-VE", "Unplaced", "2010-01-01")], source);
  const positions = { "movie:42": { "aqz-KE-bpKQ": { seconds: 120 }, "ScMzIvxBSi4": { seconds: 0 } }, "tv:42": { "M7lc1UVf-VE": { seconds: 10 } } };
  expect(sortClips(clips, "story", positions).map((clip) => clip.name)).toEqual(["Late upload", "Early upload", "Unplaced"]);
});

test("parses IDs and keeps movie and TV namespaces distinct", () => {
  expect(parseSearch("tt0816692")).toEqual({ type: "imdb", id: "tt0816692" });
  expect(parseSearch("movie:157336")).toEqual({ type: "tmdb", ref: { kind: "movie", id: 157336 } });
  expect(parseSearch("https://www.themoviedb.org/tv/42-title")).toEqual({ type: "tmdb", ref: { kind: "tv", id: 42 } });
  expect(parseSearch("https://evil.example/movie/42").type).toBe("text");
});

test("parses precise story timecodes and rejects invalid positions", () => {
  expect(parseTime("01:02:03")).toBe(3723);
  expect(parseTime("12:34")).toBe(754);
  expect(parseTime("00:00")).toBe(0);
  expect(parseTime("01:99")).toBe(null);
  expect(parseTime("-01:30")).toBe(null);
  expect(formatTime(3723)).toBe("01:02:03");
});
