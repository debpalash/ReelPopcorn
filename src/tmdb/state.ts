import { batch, signal, Storage } from "nsh";
import process from "process";
import type { Connection } from "./api";
import { titleKey, type Media, type Positions, type TitleRef } from "./model";

const envToken = (process.env?.TMDB_READ_TOKEN ?? "").trim();
const connection = signal<Connection>({ mode: envToken ? "direct" : "guest", token: envToken });
const positions = signal<Positions>({});
const watchlist = signal<Media[]>([]);
const ready = signal(false);
const error = signal("");
const KEY = "pocket-tmdb-v1";
let loading: Promise<void> | undefined;

export const tmdbConnection = () => connection();
export const timelinePositions = () => positions();
export const watchlistTitles = () => watchlist();
export const localReady = () => ready();
export const localError = () => error();
export const inWatchlist = (ref: TitleRef) => watchlist().some((item) => titleKey(item) === titleKey(ref));
export function useConnection(next: Connection) { connection.set({ mode: next.mode, token: next.mode === "direct" ? next.token.trim() : "" }); }

export function loadTmdbState(): Promise<void> {
  if (loading) return loading;
  loading = (async () => {
    try {
      const raw = await Storage.getItem(KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data?.version !== 1 || !Array.isArray(data.watchlist) || !data.positions || typeof data.positions !== "object") throw new Error("Invalid local library");
        const cleanPositions: Positions = {};
        for (const [key, clips] of Object.entries(data.positions).slice(0, 500)) {
          if (!/^(movie|tv):\d+(?::s\d+)?(?::e\d+)?$/.test(key) || !clips || typeof clips !== "object") continue;
          cleanPositions[key] = {};
          for (const [id, position] of Object.entries(clips).slice(0, 200)) {
            const seconds = (position as { seconds?: unknown })?.seconds;
            if (/^[\w-]{11}$/.test(id) && typeof seconds === "number" && Number.isFinite(seconds) && seconds >= 0 && seconds <= 604800) cleanPositions[key][id] = { seconds };
          }
        }
        const cleanTitles = data.watchlist.filter((item: Media) => item && ["movie", "tv"].includes(item.kind) && Number.isSafeInteger(item.id) && item.id > 0 && typeof item.title === "string" && typeof item.date === "string").slice(0, 200) as Media[];
        batch(() => { positions.set(cleanPositions); watchlist.set(Array.from(new Map(cleanTitles.map((item) => [titleKey(item), item])).values())); });
      }
    } catch { error.set("Couldn’t restore local changes."); }
    finally { ready.set(true); }
  })();
  return loading;
}
function persist() {
  void Storage.setItem(KEY, JSON.stringify({ version: 1, positions: positions(), watchlist: watchlist() }))
    .then(() => error.set(""))
    .catch(() => error.set("Couldn’t save local changes."));
}
export function setPosition(ref: TitleRef, youtubeId: string, seconds: number | null) {
  if (!ready() || !/^[\w-]{11}$/.test(youtubeId) || (seconds !== null && (!Number.isFinite(seconds) || seconds < 0 || seconds > 604800))) return;
  const key = titleKey(ref);
  const entries = { ...positions()[key] };
  if (seconds === null) delete entries[youtubeId]; else entries[youtubeId] = { seconds };
  positions.update((all) => ({ ...all, [key]: entries }));
  persist();
}
export function toggleWatchlist(title: Media) {
  if (!ready()) return;
  watchlist.update((items) => inWatchlist(title) ? items.filter((item) => titleKey(item) !== titleKey(title)) : [title, ...items].slice(0, 200));
  persist();
}
