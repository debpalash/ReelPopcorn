import type { Media, MediaKind, Page, TitleDetail, TitleRef } from "./model";
import { normalizeClips, parseSearch, titlePath } from "./model";

export const GUEST_BASE = "https://movies-proxy.vercel.app/tmdb";
export const TMDB_BASE = "https://api.themoviedb.org/3";
export interface Connection { mode: "guest" | "direct"; token: string }
type Raw = Record<string, any>;

export function normalizeMedia(raw: Raw, kind?: MediaKind): Media | null {
  if (!raw || typeof raw !== "object") return null;
  const mediaKind = kind ?? raw.media_type;
  if (!raw || !["movie", "tv"].includes(mediaKind) || !Number.isSafeInteger(raw.id) || raw.id <= 0 || raw.adult === true) return null;
  return { kind: mediaKind, id: raw.id, title: String(raw.title ?? raw.name ?? "Untitled"),
    originalTitle: String(raw.original_title ?? raw.original_name ?? raw.title ?? raw.name ?? "Untitled"),
    date: String(raw.release_date ?? raw.first_air_date ?? raw.air_date ?? ""), overview: String(raw.overview ?? ""),
    poster: typeof raw.poster_path === "string" ? raw.poster_path : null,
    backdrop: typeof raw.backdrop_path === "string" ? raw.backdrop_path : null,
    rating: typeof raw.vote_average === "number" ? raw.vote_average : 0 };
}
export class TmdbClient {
  constructor(private connection: Connection) {}
  async get(path: string, params: Record<string, string | number> = {}, signal?: AbortSignal): Promise<Raw> {
    const url = new URL(`${this.connection.mode === "guest" ? GUEST_BASE : TMDB_BASE}/${path}`);
    url.searchParams.set("language", "en-US");
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
    const headers: Record<string, string> = { accept: "application/json" };
    if (this.connection.mode === "direct") {
      if (/^[a-f\d]{32}$/i.test(this.connection.token)) url.searchParams.set("api_key", this.connection.token);
      else headers.Authorization = `Bearer ${this.connection.token.replace(/^Bearer\s+/i, "")}`;
    }
    let response: Response;
    try { response = await fetch(url.toString(), { headers, signal }); }
    catch (error) { if (signal?.aborted) throw error; throw new Error("Can’t reach TMDB. Try again."); }
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) throw new Error(this.connection.mode === "guest" ? "Guest access is unavailable. Try again or connect your TMDB token." : "TMDB rejected this token.");
      if (response.status === 404) throw new Error("Title not found.");
      if (response.status === 429) throw new Error("Too many requests. Try again shortly.");
      throw new Error("TMDB is unavailable. Try again.");
    }
    const data = await response.json();
    if (!data || typeof data !== "object" || data.success === false) throw new Error("TMDB returned an invalid response.");
    return data;
  }
  async browse(kind: "all" | MediaKind, query: string, page: number, signal?: AbortSignal): Promise<Page> {
    const identity = parseSearch(query);
    let data: Raw;
    if (query && identity.type === "tmdb") {
      const media = normalizeMedia(await this.get(titlePath(identity.ref), {}, signal), identity.ref.kind);
      return { items: media ? [media] : [], page: 1, totalPages: 1, total: media ? 1 : 0 };
    }
    if (query && identity.type === "imdb") {
      data = await this.get(`find/${identity.id}`, { external_source: "imdb_id" }, signal);
      if (!Array.isArray(data.movie_results) || !Array.isArray(data.tv_results)) throw new Error("TMDB returned an invalid list.");
      const items = [...(data.movie_results ?? []).map((raw: Raw) => normalizeMedia(raw, "movie")), ...(data.tv_results ?? []).map((raw: Raw) => normalizeMedia(raw, "tv"))].filter(Boolean) as Media[];
      return { items, page: 1, totalPages: 1, total: items.length };
    }
    data = query ? await this.get(`search/${kind === "all" ? "multi" : kind}`, { query, page, include_adult: "false" }, signal) :
      await this.get(`trending/${kind}/week`, { page }, signal);
    if (!Array.isArray(data.results)) throw new Error("TMDB returned an invalid list.");
    const items = data.results.map((raw: Raw) => normalizeMedia(raw, kind === "all" ? undefined : kind)).filter(Boolean) as Media[];
    return { items, page: Number(data.page ?? page), totalPages: Math.min(500, Number(data.total_pages ?? 1)), total: Number(data.total_results ?? items.length) };
  }
  async detail(ref: TitleRef, signal?: AbortSignal): Promise<TitleDetail> {
    const data = await this.get(titlePath(ref), { append_to_response: "videos,external_ids,alternative_titles", include_video_language: "en,null" }, signal);
    const base = normalizeMedia(data, ref.kind);
    if (!base || data.id !== ref.id) {
      // Seasons and episodes have their own numeric IDs. Parent identity stays canonical.
      if (ref.season === undefined || !Number.isSafeInteger(data.id)) throw new Error("TMDB returned a different title.");
    }
    const normalized = base ?? normalizeMedia({ ...data, id: ref.id }, ref.kind)!;
    return { ...normalized, ...ref,
      aliases:[...new Set<string>((data.alternative_titles?.titles??data.alternative_titles?.results??[]).filter((item:Raw)=>["US","GB","CA","AU"].includes(item.iso_3166_1)).map((item:Raw)=>String(item.title??"")))].filter(Boolean).slice(0,8),
      imdbId: /^tt\d{7,10}$/.test(data.imdb_id ?? data.external_ids?.imdb_id ?? "") ? (data.imdb_id ?? data.external_ids.imdb_id) : null,
      runtime: typeof data.runtime === "number" && data.runtime > 0 ? data.runtime : null,
      genres: Array.isArray(data.genres) ? data.genres.map((g: Raw) => String(g.name)) : [],
      clips: normalizeClips(data.videos?.results, ref),
      seasons: Array.isArray(data.seasons) ? data.seasons.map((s: Raw) => ({ number: s.season_number, name: String(s.name) })).filter((s: { number: number }) => Number.isInteger(s.number)) : [],
      episodes: Array.isArray(data.episodes) ? data.episodes.map((e: Raw) => ({ number: e.episode_number, name: String(e.name), date: String(e.air_date ?? "") })).filter((e: { number: number }) => Number.isInteger(e.number)) : [] };
  }
}
