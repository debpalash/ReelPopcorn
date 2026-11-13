import { parseMediaSource, type MediaSource } from "./media/source";
export interface Video {
  id: string;
  title: string;
  author: string;
  source?: MediaSource;
  startSeconds?: number;
  endSeconds?: number;
}

/** Accept only YouTube hosts and known video paths; never load arbitrary pasted HTML/URLs. */
export function parseVideoLink(input: string): { id: string; startSeconds: number } | null {
  const text = input.trim();
  if (/^[\w-]{11}$/.test(text)) return { id: text, startSeconds: 0 };
  try {
    const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    const host = url.hostname.toLowerCase();
    const parts = url.pathname.split("/").filter(Boolean);
    const id = host === "youtu.be" ? parts[0] :
      ["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "www.youtube-nocookie.com", "youtube-nocookie.com"].includes(host) ?
        url.pathname === "/watch" ? url.searchParams.get("v") :
          ["shorts", "embed", "live"].includes(parts[0]) ? parts[1] : null : null;
    if (!id || !/^[\w-]{11}$/.test(id)) return null;
    const time = url.searchParams.get("t") ?? url.searchParams.get("start") ?? url.hash.match(/^#t=(.*)$/)?.[1] ?? "0";
    const match = time.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
    const seconds = /^\d+$/.test(time) ? Number(time) : match ? Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0) : 0;
    return { id, startSeconds: Math.min(seconds, 604800) };
  } catch { return null; }
}

export function videoSource(video:Video):MediaSource {
  const source=video.source??parseMediaSource(video.id);
  if(!source)throw new Error("Unsupported source.");
  return source;
}
export function watchUrl(video: Video): string {
  const source=videoSource(video),url=new URL(source.url);
  if(video.startSeconds){
    if(source.provider==="youtube"||source.provider==="spotify")url.searchParams.set("t",String(Math.floor(video.startSeconds)));
    else if(source.provider==="vimeo")url.hash=`t=${Math.floor(video.startSeconds)}s`;
    else if(source.provider==="twitch"&&source.kind==="video")url.searchParams.set("t",`${Math.floor(video.startSeconds)}s`);
  }
  return url.toString();
}
