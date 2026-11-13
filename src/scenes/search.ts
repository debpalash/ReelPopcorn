import {year,type Media} from '../tmdb/model';
import {normalize,rankCandidate,type Candidate,type Cue,type Cut} from './model';

/** Providers supply metadata; this module owns identity, breadth and gap-directed search. */
export interface SearchBackend {
  videos(query:string,signal?:AbortSignal):Promise<Candidate[]>;
  playlists?(query:string,signal?:AbortSignal):Promise<string[]>;
  playlist?(id:string,signal?:AbortSignal):Promise<Candidate[]>;
}
export interface SearchProgress {items:Candidate[];searched:string[];scanned:number;failed:number}
export interface SearchContext {
  aliases?:string[];searched?:string[];reference?:Cue[];cuts?:Cut[];runtime?:number;
  onProgress?:(progress:SearchProgress)=>void;
}
const quoted=(text:string)=>`"${text.replace(/["\r\n]/g,' ').trim()}"`;
function sameEpisode(candidate:Candidate,title:Media) {
  if(title.episode===undefined)return true;
  const text=`${candidate.title} ${candidate.description}`;
  const markers=[...text.matchAll(/\bS(\d{1,2})\s*E(\d{1,3})\b|\bseason\s*(\d{1,2})\D{0,20}episode\s*(\d{1,3})\b|\b(\d{1,2})x(\d{2,3})\b/gi)];
  return markers.length>0&&markers.every(marker=>Number(marker[1]??marker[3]??marker[5])===title.season&&Number(marker[2]??marker[4]??marker[6])===title.episode);
}
function plan(title:Media,context:SearchContext) {
  const aliases=[...new Set([title.title,title.originalTitle,...context.aliases??[]].filter(Boolean))].slice(0,4);
  const date=title.kind==='movie'?year(title.date):'';
  const scope=title.episode!==undefined?` S${String(title.season).padStart(2,'0')}E${String(title.episode).padStart(2,'0')}`:'';
  const identity=`${quoted(title.title)} ${date}${scope}`.trim();
  const gaps=(context.cuts??[{start:0,end:context.runtime??0}]).filter(cut=>!cut.videoId&&cut.end-cut.start>=8);
  const phrases=new Set<string>();
  const dialogue:string[]=[];
  // Sample each missing section across its duration, including beginning and end.
  for(const fraction of [0,1,0.25,0.5,0.75]) for(const gap of gaps) {
    const target=gap.start+(gap.end-gap.start)*fraction;
    const cues=(context.reference??[]).filter(cue=>cue.start>=gap.start&&cue.end<=gap.end&&normalize(cue.text).split(' ').length>=7);
    const cue=cues.sort((a,b)=>Math.abs(a.start-target)-Math.abs(b.start-target))[0];
    if(!cue)continue;
    const phrase=normalize(cue.text).split(' ').slice(0,11).join(' ');
    // A phrase repeated in the reference cannot distinguish its scene.
    if(phrases.has(phrase)||(context.reference??[]).filter(item=>normalize(item.text).includes(phrase)).length!==1)continue;
    phrases.add(phrase);dialogue.push(`${identity} ${quoted(phrase)}`);
  }
  const queries=[...dialogue.slice(0,3),`${identity} movie scene`,`${identity} opening scene`,`${identity} ending scene`,`${identity} movieclips`,`${identity} best scenes`,`${identity} scene 1/10`,...dialogue.slice(3)];
  for(const alias of aliases) for(const suffix of ['clip','full scene','first scene','final scene','movie clip 4K','part scene','all scenes','opening credits','closing scene'])
    queries.push(`${quoted(alias)} ${date}${scope} ${suffix}`.trim());
  return [...new Set(queries)].filter(query=>!(context.searched??[]).includes(query));
}

/** Two concurrent requests, six fresh queries and two related playlists per pass. */
export async function searchScenes(title:Media,backend:SearchBackend,context:SearchContext={},signal?:AbortSignal):Promise<SearchProgress> {
  const queries=plan(title,context).slice(0,6);
  const items=new Map<string,Candidate>(),searched:string[]=[];
  let scanned=0,failed=0,cursor=0;
  const result=():SearchProgress=>({items:[...items.values()].sort((a,b)=>(b.score??0)-(a.score??0)||a.id.localeCompare(b.id)),searched:[...searched],scanned,failed});
  const publish=(candidates:Candidate[])=>{
    if(signal?.aborted)throw new Error('Cancelled');
    scanned+=candidates.length;
    for(const candidate of candidates) {
      if(!sameEpisode(candidate,title))continue;
      const ranked=rankCandidate(candidate,title.title,title.originalTitle,title.kind==='movie'?year(title.date):'',context.aliases);
      if(ranked)items.set(ranked.id,ranked);
    }
    context.onProgress?.(result());
  };
  const worker=async()=>{
    while(cursor<queries.length&&!signal?.aborted) {
      const query=queries[cursor++];
      try {const rows=await backend.videos(query,signal);if(signal?.aborted)throw new Error('Cancelled');searched.push(query);publish(rows);}
      catch(error){if(signal?.aborted)throw error;failed++;}
    }
  };
  await Promise.all([worker(),worker()]);
  if(signal?.aborted)throw new Error('Cancelled');
  if(queries.length&&!searched.length)throw new Error('Clip search is unavailable. Check yt-dlp or change the provider.');
  if(backend.playlists&&backend.playlist&&queries.length) {
    const key=`playlist:${quoted(title.title)} ${title.episode!==undefined?`S${String(title.season).padStart(2,'0')}E${String(title.episode).padStart(2,'0')}`:year(title.date)} movie clips`;
    if(!(context.searched??[]).includes(key))try {
      const ids=await backend.playlists(key.slice(9),signal);
      let expanded=true;
      for(const id of [...new Set(ids)].slice(0,2))try {publish(await backend.playlist(id,signal));}catch(error){if(signal?.aborted)throw error;failed++;expanded=false;}
      if(expanded)searched.push(key);
    }catch(error){if(signal?.aborted)throw error;failed++;}
  }
  context.onProgress?.(result());
  return result();
}
