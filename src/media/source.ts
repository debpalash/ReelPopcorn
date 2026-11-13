export type MediaProvider = "youtube" | "vimeo" | "twitch" | "tiktok" | "spotify";
export interface MediaSource {
  provider: MediaProvider;
  id: string;
  url: string;
  kind: "video" | "audio" | "live" | "collection";
}
export const providerName = (provider:MediaProvider) => ({youtube:"YouTube",vimeo:"Vimeo",twitch:"Twitch",tiktok:"TikTok",spotify:"Spotify"})[provider];
export const mediaKey = (source:MediaSource) => source.provider === "youtube" ? source.id : `${source.provider}:${source.id}`;

/** Keep imported URLs on known provider paths; never accept arbitrary embed HTML. */
export function parseMediaSource(input:string):MediaSource|null {
  const value=input.trim();
  if(/^[\w-]{11}$/.test(value))return {provider:"youtube",id:value,url:`https://www.youtube.com/watch?v=${value}`,kind:"video"};
  const spotify=value.match(/^spotify:(track|episode|album|playlist|show|artist):([A-Za-z0-9]{22})$/);
  if(spotify)return spotifySource(spotify[1],spotify[2]);
  try {
    const url=new URL(/^https?:\/\//i.test(value)?value:`https://${value}`);
    if(!["http:","https:"].includes(url.protocol)||url.username||url.password||url.port)return null;
    const host=url.hostname.toLowerCase(), path=url.pathname.split("/").filter(Boolean);
    const youtubeHosts=["youtube.com","www.youtube.com","m.youtube.com","music.youtube.com","youtube-nocookie.com","www.youtube-nocookie.com"];
    if(host==="youtu.be"||youtubeHosts.includes(host)) {
      const id=host==="youtu.be"?path[0]:url.pathname==="/watch"?url.searchParams.get("v"):["embed","shorts","live"].includes(path[0])?path[1]:null;
      if(!id||!/^[\w-]{11}$/.test(id))return null;
      const canonical=new URL(`https://www.youtube.com/watch?v=${id}`);
      const time=url.searchParams.get("t")??url.searchParams.get("start");
      if(time&&/^(?:\d+|(?:\d+h)?(?:\d+m)?(?:\d+s)?)$/.test(time))canonical.searchParams.set("t",time);
      return {provider:"youtube",id,url:canonical.toString(),kind:"video"};
    }
    if(["vimeo.com","www.vimeo.com","player.vimeo.com"].includes(host)) {
      const id=path[0]==="video"?path[1]:path[0];
      if(!/^\d{1,14}$/.test(id??""))return null;
      const canonical=new URL(`https://vimeo.com/${id}`), hash=url.searchParams.get("h")??(path[0]!=="video"?path[1]:undefined);
      if(hash){if(!/^[A-Za-z0-9]{1,128}$/.test(hash))return null;canonical.searchParams.set("h",hash);}
      return {provider:"vimeo",id,url:canonical.toString(),kind:"video"};
    }
    if(["twitch.tv","www.twitch.tv","go.twitch.tv"].includes(host)) {
      if(path[0]==="videos"&&/^\d{1,20}$/.test(path[1]??""))return {provider:"twitch",id:`video:${path[1]}`,url:`https://www.twitch.tv/videos/${path[1]}`,kind:"video"};
      if(path.length===1&&/^[A-Za-z0-9_]{3,25}$/.test(path[0])&&!["directory","downloads","settings","subscriptions","search","login","signup"].includes(path[0].toLowerCase()))return {provider:"twitch",id:`channel:${path[0].toLowerCase()}`,url:`https://www.twitch.tv/${path[0].toLowerCase()}`,kind:"live"};
    }
    if(["tiktok.com","www.tiktok.com"].includes(host)) {
      const id=path[0]?.startsWith("@")&&path[1]==="video"?path[2]:path[0]==="player"&&path[1]==="v1"?path[2]:path[0]==="share"&&path[1]==="video"?path[2]:null;
      if(id&&/^\d{10,25}$/.test(id))return {provider:"tiktok",id,url:`https://www.tiktok.com/player/v1/${id}`,kind:"video"};
    }
    if(host==="open.spotify.com") {
      const parts=path[0]?.startsWith("intl-")||path[0]==="embed"?path.slice(1):path;
      if(["track","episode","album","playlist","show","artist"].includes(parts[0])&&/^[A-Za-z0-9]{22}$/.test(parts[1]??""))return spotifySource(parts[0],parts[1]);
    }
  }catch{}
  return null;
}
function spotifySource(type:string,id:string):MediaSource {return {provider:"spotify",id:`${type}:${id}`,url:`https://open.spotify.com/${type}/${id}`,kind:["track","episode"].includes(type)?"audio":"collection"};}
export function isMediaSource(value:unknown):value is MediaSource {
  if(!value||typeof value!=="object")return false;
  const source=value as MediaSource;
  if(typeof source.url!=="string"||source.url.length>1000)return false;
  const parsed=parseMediaSource(source.url);
  return Boolean(parsed&&parsed.provider===source.provider&&parsed.id===source.id&&parsed.kind===source.kind);
}
export function mediaCapabilities(source:MediaSource) {
  return {seek:source.kind!=="live"&&source.kind!=="collection",mute:source.provider!=="spotify",volume:["youtube","vimeo","twitch"].includes(source.provider),rate:["youtube","vimeo"].includes(source.provider),timeline:source.kind==="video",live:source.kind==="live"};
}

export function sourceStart(source:MediaSource):number {
  const value=new URL(source.url).searchParams.get("t")??"0";
  if(/^\d+$/.test(value))return Math.min(Number(value),86400);
  const match=value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  return match?Math.min(Number(match[1]??0)*3600+Number(match[2]??0)*60+Number(match[3]??0),86400):0;
}
