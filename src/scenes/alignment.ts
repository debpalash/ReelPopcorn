import { normalize, type Cue, type Placement } from "./model";

function timestamp(value: string): number | null {
  const m = value.match(/^(?:(\d{1,3}):)?(\d{2}):(\d{2})[.,](\d{3})$/);
  if (!m || Number(m[3]) > 59 || (m[1] && Number(m[2]) > 59)) return null;
  return Number(m[1] ?? 0)*3600 + Number(m[2])*60 + Number(m[3]) + Number(m[4])/1000;
}
export function parseSubtitles(text: string): Cue[] {
  if (text.length > 250000) throw new Error("Subtitle text is too large.");
  const cues: Cue[] = [];
  const lines = text.replace(/\r/g, "").replace(/^\uFEFF/, "").split("\n");
  for (let i=0; i<lines.length; i++) {
    const timing = lines[i].match(/^\s*(\S+)\s+-->\s+(\S+)/);
    if (!timing) continue;
    const start = timestamp(timing[1]), end = timestamp(timing[2]);
    const body: string[] = [];
    while (i+1<lines.length && lines[i+1].trim() && !lines[i+1].includes("-->")) body.push(lines[++i]);
    const content = body.join(" ").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").trim();
    if (start !== null && end !== null && end > start && content) cues.push({ start, end, text: content });
  }
  if (!cues.length) throw new Error("Paste SRT or WebVTT subtitles with timecodes.");
  // Auto-caption rolling cues often repeat their previous line. Keep the longest
  // cue at an identical start. Distant repeated dialogue must stay ambiguous.
  return cues.sort((a,b) => a.start-b.start || b.text.length-a.text.length).filter((cue,i,all) =>
    (i===0 || cue.start !== all[i-1].start) && (i===0 || cue.text !== all[i-1].text || cue.start>all[i-1].end+0.25));
}
interface Word { text: string; cue: number; time:number }
function words(cues: Cue[]): Word[] {
  const result:Word[]=[];
  let previous:Cue|undefined;
  for(let index=0;index<cues.length;index++) {
    const cue=cues[index],tokens=normalize(cue.text).split(" ").filter(Boolean);
    let overlap=0;
    if(previous&&cue.start<=previous.end+0.25) {
      // Rolling ASR repeats the trailing words of the previous window.
      for(let size=Math.min(tokens.length,result.length,60);size>=2;size--) {
        if(tokens.slice(0,size).join(" ")===result.slice(-size).map(word=>word.text).join(" ")){overlap=size;break;}
      }
    }
    for(let i=overlap;i<tokens.length;i++)result.push({text:tokens[i],cue:index,
      time:cue.start+(cue.end-cue.start)*i/Math.max(1,tokens.length)});
    previous=cue;
  }
  return result;
}
export interface ReferenceIndex { cues: Cue[]; words: Word[]; phrases: Map<string, number[]> }
const SIZE = 6;
export function indexReference(cues: Cue[]): ReferenceIndex {
  const all = words(cues), phrases = new Map<string, number[]>();
  for (let i=0; i<=all.length-SIZE; i++) {
    const phrase = all.slice(i,i+SIZE).map((word) => word.text).join(" ");
    const positions = phrases.get(phrase) ?? [];
    if (positions.length < 3) positions.push(i);
    phrases.set(phrase, positions);
  }
  return { cues, words: all, phrases };
}

/** Finds consistent dialogue offsets; never derives plot time from video titles. */
export function alignTranscript(reference: ReferenceIndex, clipCues: Cue[], videoId: string, duration: number, runtime: number): Placement | null {
  const clipWords = words(clipCues);
  const anchors: { offset: number; clipCue: number; refCue: number }[] = [];
  const seen = new Set<string>();
  for (let i=0; i<=clipWords.length-SIZE; i+=2) {
    const phrase = clipWords.slice(i,i+SIZE).map((word) => word.text).join(" ");
    const positions = reference.phrases.get(phrase);
    if (!positions || positions.length !== 1) continue; // Repeated dialogue is ambiguous.
    const refCue = reference.words[positions[0]].cue, clipCue = clipWords[i].cue;
    const pair = `${refCue}:${clipCue}`;
    if (seen.has(pair)) continue;
    seen.add(pair);
    anchors.push({ offset: reference.words[positions[0]].time-clipWords[i].time, clipCue, refCue });
  }
  anchors.sort((a,b) => a.offset-b.offset);
  let best: typeof anchors = [];
  for (let left=0, right=0; left<anchors.length; left++) {
    while (right<anchors.length && anchors[right].offset-anchors[left].offset<=2.5) right++;
    const group = anchors.slice(left,right);
    if (new Set(group.map((a) => a.clipCue)).size > new Set(best.map((a) => a.clipCue)).size) best = group;
  }
  const cueIds = [...new Set(best.map((a) => a.clipCue))];
  if (cueIds.length < 3 || new Set(best.map(anchor=>anchor.refCue)).size<3) return null;
  // Contradictory matches from edited compilations or repeated scenes stay unplaced.
  const competing = anchors.filter((a) => best.every((b) => Math.abs(a.offset-b.offset)>4));
  if (new Set(competing.map((a) => a.clipCue)).size >= Math.max(3,cueIds.length*0.6)) return null;
  const offset = best[Math.floor(best.length/2)].offset;
  const first = Math.min(...cueIds.map((i) => clipCues[i].start));
  const last = Math.max(...cueIds.map((i) => clipCues[i].end));
  if (last-first < 8 || last > duration+2) return null;
  const videoStart = Math.max(first, -offset, 0), movieStart = videoStart+offset;
  const videoEnd = Math.min(last, duration, runtime-offset);
  if (movieStart < 0 || videoEnd-videoStart < 8 || movieStart >= runtime) return null;
  return { videoId, movieStart, videoStart, videoEnd, state:"proposed", method:"transcript",
    anchors: cueIds.length, spread: best[best.length-1].offset-best[0].offset };
}
