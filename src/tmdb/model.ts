export type MediaKind = "movie" | "tv";
export interface TitleRef { kind: MediaKind; id: number; season?: number; episode?: number }
export interface Media extends TitleRef {
  title: string; originalTitle: string; date: string; overview: string;
  poster: string | null; backdrop: string | null; rating: number;
}
export interface Clip {
  id: string; youtubeId: string; name: string; type: string; official: boolean;
  publishedAt: string; language: string; source: TitleRef;
}
export interface TitleDetail extends Media {
  aliases?:string[]; imdbId: string | null; runtime: number | null; genres: string[]; clips: Clip[];
  seasons: { number: number; name: string }[];
  episodes: { number: number; name: string; date: string }[];
}
export interface Page { items: Media[]; page: number; totalPages: number; total: number }
export interface Position { seconds: number }
export type Positions = Record<string, Record<string, Position>>;
export type ClipOrder = "published" | "story";

export const titleKey = (ref: TitleRef) => `${ref.kind}:${ref.id}${ref.season !== undefined ? `:s${ref.season}` : ""}${ref.episode !== undefined ? `:e${ref.episode}` : ""}`;
export const titlePath = (ref: TitleRef) => `${ref.kind}/${ref.id}${ref.season !== undefined ? `/season/${ref.season}` : ""}${ref.episode !== undefined ? `/episode/${ref.episode}` : ""}`;
export const year = (date: string) => /^\d{4}/.exec(date)?.[0] ?? "";
export function imageUrl(path: string | null, size = "w342") {
  return path && /^\/[\w.\/-]+$/.test(path) ? `https://image.tmdb.org/t/p/${size}${path}` : undefined;
}
export function parseTime(text: string): number | null {
  if (!/^\d{1,3}:\d{2}(?::\d{2})?$/.test(text.trim())) return null;
  const parts = text.trim().split(":").map(Number);
  if (parts.slice(1).some((value) => value > 59)) return null;
  const seconds = parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1];
  return seconds <= 604800 ? seconds : null;
}
export function formatTime(seconds: number) {
  seconds = Math.max(0, Math.floor(seconds));
  return `${Math.floor(seconds / 3600).toString().padStart(2, "0")}:${Math.floor(seconds % 3600 / 60).toString().padStart(2, "0")}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;
}

/** Only server-attached YouTube videos belong to this exact media/scope. */
export function normalizeClips(raw: unknown, source: TitleRef): Clip[] {
  if (!Array.isArray(raw)) return [];
  const byKey = new Map<string, Clip>();
  for (const value of raw) {
    if (!value || value.site !== "YouTube" || typeof value.key !== "string" || !/^[\w-]{11}$/.test(value.key)) continue;
    const clip: Clip = {
      id: typeof value.id === "string" ? value.id : value.key,
      youtubeId: value.key, name: typeof value.name === "string" ? value.name : "Video",
      type: typeof value.type === "string" ? value.type : "Video", official: value.official === true,
      publishedAt: typeof value.published_at === "string" && Number.isFinite(Date.parse(value.published_at)) ? value.published_at : "",
      language: typeof value.iso_639_1 === "string" ? value.iso_639_1 : "", source: { ...source }
    };
    const previous = byKey.get(clip.youtubeId);
    if (!previous || (clip.official && !previous.official) || (clip.official === previous.official && clip.id < previous.id)) byKey.set(clip.youtubeId, clip);
  }
  return [...byKey.values()];
}
export function positionOf(clip: Clip, positions: Positions): Position | undefined {
  return positions[titleKey(clip.source)]?.[clip.youtubeId];
}
export function sortClips(clips: Clip[], order: ClipOrder, positions: Positions): Clip[] {
  return [...clips].sort((a, b) => {
    if (order === "story") {
      const pa = positionOf(a, positions), pb = positionOf(b, positions);
      if (Boolean(pa) !== Boolean(pb)) return pa ? -1 : 1;
      if (pa && pb) {
        const episode = (a.source.season ?? 0) - (b.source.season ?? 0) || (a.source.episode ?? 0) - (b.source.episode ?? 0);
        if (episode || pa.seconds !== pb.seconds) return episode || pa.seconds - pb.seconds;
      }
    }
    const publication = (a.publishedAt ? Date.parse(a.publishedAt) : Infinity) - (b.publishedAt ? Date.parse(b.publishedAt) : Infinity);
    return (Number.isFinite(publication) && publication !== 0 ? publication : 0) ||
      (a.publishedAt ? 0 : 1) - (b.publishedAt ? 0 : 1) ||
      a.name.localeCompare(b.name) || a.youtubeId.localeCompare(b.youtubeId);
  });
}

export type SearchIdentity = { type: "tmdb"; ref: TitleRef } | { type: "imdb"; id: string } | { type: "text"; query: string };
export function parseSearch(input: string): SearchIdentity {
  const query = input.trim();
  if (/^tt\d{7,10}$/i.test(query)) return { type: "imdb", id: query.toLowerCase() };
  const direct = query.match(/^(movie|tv)[:/](\d+)$/i) ?? query.match(/^https:\/\/(?:www\.)?themoviedb\.org\/(movie|tv)\/(\d+)(?:-[\w-]+)?\/?(?:\?.*)?$/i);
  if (direct && Number.isSafeInteger(Number(direct[2])) && Number(direct[2]) > 0) return { type: "tmdb", ref: { kind: direct[1].toLowerCase() as MediaKind, id: Number(direct[2]) } };
  return { type: "text", query };
}
