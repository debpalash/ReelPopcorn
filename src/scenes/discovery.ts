import process, { type ChildProcess } from "process";
import { year, type Media } from "../tmdb/model";
import { normalize,type Candidate } from "./model";
import { searchScenes,type SearchBackend,type SearchContext } from "./search";
import { parseSubtitles } from "./alignment";

export const INSTANCES = ["https://yt.chocolatemoo53.com", "https://inv.nadeko.net", "https://invidious.nerdvpn.de", "https://invidious.tiekoetter.com"];
export type Provider = "auto" | "yt-dlp" | "invidious";
export interface DiscoveryOptions { provider: Provider; instance: string }
const COMMANDS = ["/opt/homebrew/bin/yt-dlp", "/usr/local/bin/yt-dlp", "yt-dlp"];
const aborted = () => new Error("Cancelled");

function run(command: string, args: string[], signal?: AbortSignal): Promise<any> {
  return new Promise((resolve,reject) => {
    if (signal?.aborted) { reject(aborted()); return; }
    let child: ChildProcess;
    let output = "", settled = false;
    const stop = () => { try { child?.kill(); } catch {} };
    const finish = (error?: Error, value?: unknown) => {
      if (settled) return;
      settled = true; signal?.removeEventListener("abort", cancel);
      if (error) reject(error); else resolve(value);
    };
    const cancel = () => { stop(); finish(aborted()); };
    try { child = process.spawn(command, args, { timeoutMs: 60000 }); }
    catch (error) { finish(error instanceof Error ? error : new Error(String(error))); return; }
    signal?.addEventListener("abort", cancel);
    child.on("stdout", (text) => { output += text; if (output.length > 4_000_000) { stop(); finish(new Error("Clip metadata is too large.")); } });
    child.on("exit", (result) => {
      if (result.code !== 0) { finish(new Error(result.error ?? "yt-dlp couldn’t retrieve this data.")); return; }
      try { finish(undefined, JSON.parse(output.trim())); }
      catch { finish(new Error("yt-dlp returned invalid metadata.")); }
    });
  });
}
async function ytdlp(args: string[], signal?: AbortSignal): Promise<any> {
  for (let i=0;i<COMMANDS.length;i++) {
    try { return await run(COMMANDS[i], ["--ignore-config","--no-warnings","--skip-download","--socket-timeout","12","--retries","1",...args], signal); }
    catch(error) {
      if (signal?.aborted) throw error;
      if (i<COMMANDS.length-1 && /ENOENT|not found|No such file/i.test(String(error))) continue;
      throw error;
    }
  }
  throw new Error("yt-dlp is unavailable.");
}
async function get(url: string, signal?: AbortSignal, text = false): Promise<any> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (signal?.aborted) throw aborted();
  signal?.addEventListener("abort",cancel);
  const timer = setTimeout(cancel,8000);
  try {
    const response = await fetch(url, { signal:controller.signal });
    if (!response.ok) throw new Error("Provider unavailable.");
    const body = await response.text();
    if (body.length>1_000_000) throw new Error("Provider response is too large.");
    return text ? body : JSON.parse(body);
  } finally { clearTimeout(timer); signal?.removeEventListener("abort",cancel); }
}
function fromYtdlp(raw: any): Candidate | null {
  if (!raw || !/^[\w-]{11}$/.test(raw.id)) return null;
  return { id:raw.id, title:String(raw.title ?? "Video"), channel:String(raw.channel ?? raw.uploader ?? "YouTube"),
    description:String(raw.description ?? "").slice(0,2000), duration:Number(raw.duration ?? 0), provider:"yt-dlp", identity:"review" };
}
function fromInvidious(raw: any): Candidate | null {
  if (!raw || (raw.type && raw.type!=="video") || !/^[\w-]{11}$/.test(raw.videoId)) return null;
  return { id:raw.videoId, title:String(raw.title ?? "Video"), channel:String(raw.author ?? "YouTube"),
    description:String(raw.description ?? "").slice(0,2000), duration:Number(raw.lengthSeconds ?? 0), provider:"invidious", identity:"review" };
}
function instances(options: DiscoveryOptions) { return [options.instance, ...INSTANCES.filter((value) => value !== options.instance)].filter((value) => INSTANCES.includes(value)); }
export function discoveryBackend(options:DiscoveryOptions):SearchBackend {
  let workingInstance:string|undefined;
  const remote=async(path:string,signal?:AbortSignal)=>{
    for(const instance of [...new Set([workingInstance,...instances(options)].filter(Boolean))] as string[]) {
      try{const data=await get(`${instance}/api/v1/${path}`,signal);workingInstance=instance;return data;}
      catch(error){if(signal?.aborted)throw error;}
    }
    throw new Error("Invidious is unavailable.");
  };
  const videos=async(query:string,signal?:AbortSignal)=>{
    if(options.provider!=="invidious")try {
      const data=await ytdlp(["--flat-playlist","--dump-single-json",`ytsearch30:${query}`],signal);
      return (data.entries??[]).map(fromYtdlp).filter(Boolean) as Candidate[];
    }catch(error){if(signal?.aborted||options.provider==="yt-dlp")throw error;}
    const data=await remote(`search?q=${encodeURIComponent(query)}&type=video`,signal);
    if(!Array.isArray(data))throw new Error("Invalid search result.");
    return data.map(fromInvidious).filter(Boolean) as Candidate[];
  };
  return {videos,
    playlists:async(query,signal)=>{
      if(options.provider!=="invidious")try {
        const url=`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAw%3D%3D`;
        const data=await ytdlp(["--flat-playlist","--playlist-end","4","--dump-single-json",url],signal);
        return (data.entries??[]).map((entry:any)=>entry.id).filter((id:unknown)=>typeof id==="string"&&/^[A-Za-z0-9_-]{10,100}$/.test(id));
      }catch(error){if(signal?.aborted||options.provider==="yt-dlp")throw error;}
      const data=await remote(`search?q=${encodeURIComponent(query)}&type=playlist`,signal);
      if(!Array.isArray(data))throw new Error("Invalid playlist result.");
      return data.filter((entry:any)=>entry.type==="playlist").map((entry:any)=>entry.playlistId).filter((id:unknown)=>typeof id==="string"&&/^[A-Za-z0-9_-]{10,100}$/.test(id));
    },
    playlist:async(id,signal)=>{
      if(!/^[A-Za-z0-9_-]{10,100}$/.test(id))throw new Error("Invalid playlist.");
      if(options.provider!=="invidious")try {
        const data=await ytdlp(["--flat-playlist","--playlist-end","100","--dump-single-json",`https://www.youtube.com/playlist?list=${id}`],signal);
        return (data.entries??[]).map(fromYtdlp).filter(Boolean) as Candidate[];
      }catch(error){if(signal?.aborted||options.provider==="yt-dlp")throw error;}
      const data=await remote(`playlists/${id}`,signal);
      return (data.videos??[]).map(fromInvidious).filter(Boolean) as Candidate[];
    }
  };
}
export async function discoverScenes(title:Media,options:DiscoveryOptions,signal?:AbortSignal,context:SearchContext={}) {
  return (await searchScenes(title,discoveryBackend(options),context,signal)).items;
}
export function isTimingSource(candidate:Candidate,title:Media,runtime:number,aliases:string[]=[]) {
  if(!runtime||!Number.isFinite(candidate.duration)||Math.abs(candidate.duration-runtime)>Math.max(5,runtime*0.01))return false;
  const text=normalize(candidate.title);
  if(/\b(trailer|review|recap|reaction|explained|explanation|comparison|fan edit|ai generated)\b/.test(text))return false;
  if(![title.title,title.originalTitle,...aliases].map(normalize).filter(Boolean).some(alias=>` ${text} `.includes(` ${alias} `)))return false;
  const years:string[]=candidate.title.match(/\b(?:19|20)\d{2}\b/g)??[];
  if(title.kind==="movie"&&years.length&&!years.includes(year(title.date)))return false;
  if(title.kind==="tv")return title.season!==undefined&&title.episode!==undefined&&new RegExp(`\\bS0?${title.season}\\s*E0?${title.episode}\\b`,"i").test(candidate.title);
  return true;
}
export async function findTimingSources(title:Media,runtime:number,options:DiscoveryOptions,signal?:AbortSignal,aliases:string[]=[]) {
  const scope=title.episode!==undefined?` S${String(title.season).padStart(2,"0")}E${String(title.episode).padStart(2,"0")}`:"";
  const rows=await discoveryBackend(options).videos(`"${title.title.replace(/"/g,"")}" ${title.kind==="movie"?year(title.date):""}${scope} full ${title.kind==="movie"?"movie":"episode"} subtitles`,signal);
  return [...new Map(rows.filter(row=>isTimingSource(row,title,runtime,aliases)).map(row=>[row.id,row])).values()].sort((a,b)=>Math.abs(a.duration-runtime)-Math.abs(b.duration-runtime)).slice(0,4);
}
export async function videoMetadata(id: string, options: DiscoveryOptions, signal?: AbortSignal): Promise<Candidate> {
  if (!/^[\w-]{11}$/.test(id)) throw new Error("Invalid YouTube ID.");
  if (options.provider !== "invidious") {
    try { const raw = await ytdlp(["--no-playlist","--print","%(.{id,title,duration,channel,description})j",`https://www.youtube.com/watch?v=${id}`],signal); const item=fromYtdlp(raw); if(item) return item; }
    catch(error) { if(signal?.aborted || options.provider==="yt-dlp") throw error; }
  }
  for (const instance of instances(options)) {
    try { const raw=await get(`${instance}/api/v1/videos/${id}`,signal); const item=fromInvidious(raw); if(item) return item; }
    catch(error) { if(signal?.aborted) throw error; }
  }
  throw new Error("Couldn’t read this video.");
}
export async function clipCaptions(id: string, options: DiscoveryOptions, signal?: AbortSignal) {
  if (!/^[\w-]{11}$/.test(id)) throw new Error("Invalid YouTube ID.");
  if (options.provider !== "invidious") {
    try {
      const raw = await ytdlp(["--no-playlist","--print","%(.{id,subtitles,automatic_captions})j",`https://www.youtube.com/watch?v=${id}`],signal);
      const tracks = [raw.subtitles, raw.automatic_captions].flatMap((group) => Object.entries(group ?? {}).filter(([key]) => /^en(?:-|$)/.test(key)).flatMap(([,value]) => Array.isArray(value) ? value : []));
      const track = tracks.find((track: any) => track.ext === "vtt" && typeof track.url === "string");
      if (track) {
        const url = new URL(track.url);
        if (url.protocol === "https:" && (url.hostname === "www.youtube.com" || url.hostname === "youtube.com")) return parseSubtitles(await get(url.toString(),signal,true));
      }
    } catch(error) { if(signal?.aborted) throw error; }
  }
  if (options.provider !== "yt-dlp") for (const instance of instances(options)) {
    try {
      let label:string|undefined;
      try {
        const listing=await get(`${instance}/api/v1/captions/${id}?hl=en`,signal);
        label=listing.captions?.find((track:any)=>/^en(?:-|$)/.test(track.languageCode??""))?.label;
      } catch(error) { if(signal?.aborted)throw error; }
      const query=label?`label=${encodeURIComponent(label)}`:"lang=en";
      return parseSubtitles(await get(`${instance}/api/v1/captions/${id}?${query}`,signal,true));
    }
    catch(error) { if(signal?.aborted) throw error; }
  }
  throw new Error("Captions unavailable. Paste the clip’s timed transcript to match it.");
}
