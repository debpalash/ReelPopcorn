import { signal, Storage } from "nsh";
import { titleKey, type TitleRef } from "../tmdb/model";
import {isMediaSource,mediaKey} from "../media/source";
import { INSTANCES, type DiscoveryOptions } from "./discovery";
import {rankCandidate,type Candidate,type SceneBook,type Placement} from "./model";
import {year,type Media} from "../tmdb/model";
const books = signal<Record<string,SceneBook>>({});
const settings = signal<DiscoveryOptions>({ provider:"auto", instance:INSTANCES[0] });
const ready = signal(false), error = signal("");
let loading: Promise<void> | undefined;
export const sceneBooks = () => books();
export const sceneBook = (ref: TitleRef) => books()[titleKey(ref)];
export const discoveryOptions = () => settings();
export const scenesReady = () => ready();
export const scenesError = () => error();
const validId = (id:unknown) => typeof id==="string" && (/^[\w-]{11}$/.test(id) || /^(?:vimeo:\d{1,14}|tiktok:\d{10,25}|twitch:(?:video:\d{1,20}|channel:[a-z0-9_]{3,25})|spotify:(?:track|episode|album|playlist|show|artist):[A-Za-z0-9]{22})$/.test(id));
const validCandidate = (c:any):c is Candidate => c && validId(c.id) && typeof c.title==="string" && c.title.length<=500 && typeof c.channel==="string" && c.channel.length<=300 && typeof c.description==="string" && c.description.length<=2000 && Number.isFinite(c.duration) && c.duration>=0 && c.duration<=86400 &&
  (c.source ? isMediaSource(c.source)&&mediaKey(c.source)===c.id : /^[\w-]{11}$/.test(c.id)&&c.duration>0);
const validPlacement = (p:any):p is Placement => p && validId(p.videoId) && [p.movieStart,p.videoStart,p.videoEnd].every(Number.isFinite) && p.movieStart>=0 && p.videoStart>=0 && p.videoEnd>p.videoStart && p.videoEnd<=86400 && ["confirmed","proposed"].includes(p.state) && ["manual","transcript"].includes(p.method);
export function loadScenes() {
  if(loading) return loading;
  loading=(async()=>{
    try {
      const raw=await Storage.getItem("pocket-scenes-v1");
      if(raw) {
        const data=JSON.parse(raw);
        if(data.version!==1 || !data.books || typeof data.books!=="object") throw new Error();
        const clean: Record<string,SceneBook>={};
        for(const [key,value] of Object.entries(data.books).slice(0,10)) {
          const book=value as SceneBook;
          if(!book || !book.ref || titleKey(book.ref)!==key || !Array.isArray(book.candidates)) continue;
          clean[key]={ref:book.ref, candidates:book.candidates.filter(validCandidate).slice(0,400), placements:Object.fromEntries(Object.entries(book.placements??{}).filter(([id,p])=> validPlacement(p) && p.videoId===id)), updatedAt:Number(book.updatedAt)||0, runtime:Number.isFinite(book.runtime)&&book.runtime!>0?book.runtime:undefined,
            searches:Array.isArray(book.searches)?book.searches.filter(value=>typeof value==="string"&&value.length<=500).slice(-300):[],searchRevision:book.searchRevision,
            reference:typeof book.reference==="string" && book.reference.length<=250000 ? book.reference : undefined};
        }
        books.set(clean);
        if(["auto","yt-dlp","invidious"].includes(data.settings?.provider) && INSTANCES.includes(data.settings?.instance)) settings.set(data.settings);
      }
    } catch { error.set("Couldn’t restore scene changes."); }
    finally { ready.set(true); }
  })();
  return loading;
}
function persist() {
  void Storage.setItem("pocket-scenes-v1",JSON.stringify({version:1,books:books(),settings:settings()})).then(()=>error.set("")).catch(()=>error.set("Couldn’t save scene changes."));
}
function update(ref: TitleRef, fn:(book:SceneBook)=>SceneBook) {
  if(!ready()) return;
  const key=titleKey(ref), current=books()[key]??{ref,candidates:[],placements:{},updatedAt:0};
  const next={...books(),[key]:{...fn(current),updatedAt:Date.now()}};
  const ordered=Object.entries(next).sort((a,b)=>b[1].updatedAt-a[1].updatedAt).slice(0,10);
  books.set(Object.fromEntries(ordered.map(([id,book],index)=>[id,index<4?book:{...book,reference:undefined}])));
  persist();
}
export function mergeCandidates(ref:TitleRef, items:Candidate[]) { update(ref,(book)=>({...book,candidates:Array.from(new Map([...book.candidates,...items].filter(validCandidate).map((item)=>[item.id,item])).values()).sort((a,b)=>(book.placements[b.id]?1:0)-(book.placements[a.id]?1:0)||(b.provider==="manual"?1:0)-(a.provider==="manual"?1:0)||(b.score??0)-(a.score??0)).slice(0,400)})); }
export function saveReference(ref:TitleRef, reference:string, runtime?:number) { update(ref,(book)=>({...book,reference,runtime,searches:book.reference===reference?book.searches:[],placements:book.reference===reference?book.placements:Object.fromEntries(Object.entries(book.placements).filter(([,placement])=>placement.method==="manual"))})); }
export function savePlacement(ref:TitleRef, placement:Placement) { if(validPlacement(placement)) update(ref,(book)=>({...book,placements:{...book.placements,[placement.videoId]:placement}})); }
export function removePlacement(ref:TitleRef,id:string) { update(ref,(book)=>{const p={...book.placements};delete p[id];return {...book,placements:p};}); }
export function useDiscoveryOptions(value:DiscoveryOptions) { settings.set(value); if(ready()) persist(); }

export function saveSourceDuration(ref:TitleRef,id:string,duration:number) {
  const current=sceneBook(ref)?.candidates.find(candidate=>candidate.id===id);
  if(!current?.source||!Number.isFinite(duration)||duration<=0||duration>86400||Math.abs(current.duration-duration)<0.1)return;
  update(ref,book=>({...book,candidates:book.candidates.map(candidate=>candidate.id===id?{...candidate,duration}:candidate)}));
}

export function removeCandidate(ref:TitleRef,id:string) {
  update(ref,book=>{const placements={...book.placements};delete placements[id];return {...book,candidates:book.candidates.filter(candidate=>candidate.id!==id),placements};});
}

/** Revalidate old unplaced search results once; reviewed and imported ranges stay intact. */
export function prepareDiscovery(title:Media,aliases:string[]=[]) {
  const current=sceneBook(title);
  if(current?.searchRevision===2)return;
  update(title,book=>({...book,searchRevision:2,searches:[],candidates:book.candidates.flatMap(candidate=>{
    if(candidate.provider==="manual"||book.placements[candidate.id]?.state==="confirmed")return [candidate];
    const ranked=rankCandidate(candidate,title.title,title.originalTitle,title.kind==="movie"?year(title.date):"",aliases);
    return ranked?[ranked]:[];
  })}));
}
export function recordSearches(ref:TitleRef,queries:string[]) {
  if(!queries.length||queries.every(query=>sceneBook(ref)?.searches?.includes(query)))return;
  update(ref,book=>({...book,searches:[...new Set([...(book.searches??[]),...queries])].slice(-300)}));
}
