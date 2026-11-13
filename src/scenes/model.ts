import {mediaCapabilities,type MediaSource} from "../media/source";
import type { TitleRef } from "../tmdb/model";
export interface Candidate {
  id: string; title: string; channel: string; description: string; duration: number;
  provider: "yt-dlp" | "invidious" | "manual"; identity: "likely" | "review";
  sequence?: { index: number; total: number };
  source?: MediaSource;
  score?: number;
}
export interface Cue { start: number; end: number; text: string }
export interface Placement {
  videoId: string; movieStart: number; videoStart: number; videoEnd: number;
  state: "proposed" | "confirmed"; method: "transcript" | "manual";
  anchors?: number; spread?: number;
}
export interface SceneBook {
  ref: TitleRef; candidates: Candidate[]; placements: Record<string, Placement>;
  reference?: string; runtime?: number; updatedAt: number;
  searches?: string[]; searchRevision?: number;
}
export interface Cut {
  start: number; end: number; videoId?: string; videoStart?: number; videoEnd?: number;
}
export const normalize = (text: string) => text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^\p{L}\p{N}\p{M}]+/gu, " ").trim();
export function sequenceOf(title: string) {
  const match = title.match(/\(\s*(\d{1,3})\s*\/\s*(\d{1,3})\s*\)/);
  if (!match) return undefined;
  const index = Number(match[1]), total = Number(match[2]);
  return index > 0 && index <= total && total <= 100 ? { index, total } : undefined;
}
export function rankCandidate(candidate: Candidate, title: string, originalTitle: string, year: string, extraAliases: string[] = []): Candidate | null {
  const text = normalize(candidate.title), description = normalize(candidate.description);
  if (/\b(trailers?|teasers?|reviews?|reactions?|recaps?|explained|explanations?|analysis|soundtracks?|gameplay|fan edits?|fan made|full movies?|behind the scenes|making of|interviews?|featurettes?|bloopers|deleted scenes?|comparisons?|ai generated|ai recreated|lego|parody|parodies|crossovers?|theatre response|theater response|imax response|ending music|music video|mashups?|remakes?|re creations?)\b/.test(text)) return null;
  if (!Number.isFinite(candidate.duration) || candidate.duration < 15 || candidate.duration > 1800) return null;
  const aliases = [...new Set([title, originalTitle,...extraAliases].map(normalize).filter(Boolean))];
  const exactTitle = aliases.some((alias) => ` ${text} `.includes(` ${alias} `));
  // A description can list dozens of unrelated titles. It cannot establish identity.
  if (!exactTitle) return null;
  const primary = text.split(/\b(?:like|versus|vs|inspired by|similar to)\b/)[0];
  if (!aliases.some(alias=>` ${primary} `.includes(` ${alias} `))) return null;
  const years: string[] = candidate.title.match(/\b(?:19|20)\d{2}\b/g) ?? [];
  if (year && years.length && !years.includes(year)) return null;
  // “It”, “Up”, “Us”, etc. are ordinary words; require release evidence.
  if (aliases.every(alias=>alias.length<=3) && (!year || !years.includes(year))) return null;
  const scene = /\b(scene|clip|movieclips|ending|opening)\b/.test(text) || Boolean(sequenceOf(candidate.title));
  if (!scene) return null;
  const sequence=sequenceOf(candidate.title);
  const channel=normalize(candidate.channel);
  const score=40+(years.includes(year)?15:0)+(sequence?10:0)+(/\b(scene|clip)\b/.test(text)?10:0)+
    (/movieclips|paramount|warner bros|sony pictures|universal pictures|lionsgate|disney|20th century|mgm|a24|netflix/.test(channel)?15:0)+
    (aliases.some(alias=>` ${description} `.includes(` ${alias} `))?5:0);
  return { ...candidate, identity: "likely", sequence, score };
}

export const canPlaceCandidate = (candidate:Candidate) => (!candidate.source||mediaCapabilities(candidate.source).timeline)&&candidate.duration>0;
export const isYouTubeCandidate = (candidate:Candidate) => !candidate.source||candidate.source.provider==="youtube";

/** Exact, confirmed ranges only. Overlapping uploads never double-count time. */
export function buildCut(runtime: number, placements: Placement[], candidates: Candidate[]): Cut[] {
  if (!Number.isFinite(runtime) || runtime <= 0) return [];
  const durations = new Map(candidates.filter(canPlaceCandidate).map((candidate) => [candidate.id,candidate.duration]));
  const valid = placements.map((p)=>({...p,videoEnd:Math.min(p.videoEnd,durations.get(p.videoId)??0)})).filter((p) => p.state === "confirmed" && durations.has(p.videoId) &&
    [p.movieStart, p.videoStart, p.videoEnd].every(Number.isFinite) && p.movieStart >= 0 && p.videoStart >= 0 && p.videoEnd > p.videoStart);
  const end = (p: Placement) => Math.min(runtime, p.movieStart + p.videoEnd - p.videoStart);
  const points = [...new Set([0, runtime, ...valid.flatMap((p) => [Math.min(runtime, p.movieStart), end(p)])])].sort((a,b) => a-b);
  const cuts: Cut[] = [];
  for (let i=0; i<points.length-1; i++) {
    const start = points[i], finish = points[i+1];
    if (finish <= start) continue;
    const previousId = cuts[cuts.length-1]?.videoId;
    const eligible = valid.filter((p) => p.movieStart <= start && end(p) >= finish)
      .sort((a,b) => (a.method === "manual" ? 0 : 1) - (b.method === "manual" ? 0 : 1) ||
        (b.videoEnd-b.videoStart) - (a.videoEnd-a.videoStart) ||
        (a.videoId===previousId?0:1)-(b.videoId===previousId?0:1) || a.videoId.localeCompare(b.videoId));
    const selected = eligible[0];
    const cut: Cut = selected ? { start, end: finish, videoId: selected.videoId,
      videoStart: selected.videoStart + start-selected.movieStart, videoEnd: selected.videoStart + finish-selected.movieStart } : { start, end: finish };
    const previous = cuts[cuts.length-1];
    if (previous && previous.videoId === cut.videoId && previous.end === cut.start &&
      (!cut.videoId || previous.videoEnd === cut.videoStart)) { previous.end = finish; previous.videoEnd = cut.videoEnd; }
    else cuts.push(cut);
  }
  return cuts;
}
export const coveredSeconds = (cuts: Cut[]) => cuts.reduce((sum, cut) => sum + (cut.videoId ? cut.end-cut.start : 0), 0);
