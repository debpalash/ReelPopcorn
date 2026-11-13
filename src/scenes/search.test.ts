import {expect,test} from 'nsh/test';
import {searchScenes,type SearchBackend} from './search';
import type {Candidate} from './model';
const title={kind:'movie' as const,id:157336,title:'Interstellar',originalTitle:'Interstellar',date:'2014-11-05',overview:'',poster:null,backdrop:null,rating:8};
const candidate=(id:string,name:string):Candidate=>({id,title:name,channel:'Uploader',description:'',duration:120,provider:'yt-dlp',identity:'review'});
test('searches opening, middle and ending uploads, expands playlists, and publishes progressively',async()=>{
 const queries:string[]=[],published:number[]=[];
 const backend:SearchBackend={
  videos:async(query)=>{queries.push(query);return [candidate('aqz-KE-bpKQ',query.includes('opening')?'Interstellar (2014) Opening Scene':'Interstellar (2014) Movie Scene'),candidate('ScMzIvxBSi4','Interstellar (2014) Trailer')];},
  playlists:async()=>['PLvalid123'],
  playlist:async()=>[candidate('M7lc1UVf-VE','Interstellar (2014) Ending Scene (10/10)')]
 };
 const result=await searchScenes(title,backend,{onProgress:value=>published.push(value.items.length)});
 expect(queries.some(query=>query.includes('opening'))).toBe(true);
 expect(queries.some(query=>query.includes('ending'))).toBe(true);
 expect(result.items.map(item=>item.id).sort()).toEqual(['M7lc1UVf-VE','aqz-KE-bpKQ'].sort());
 expect(published.length>1).toBe(true);
 const next=await searchScenes(title,backend,{searched:result.searched});
 expect(next.searched.some(query=>result.searched.includes(query))).toBe(false);
});
test('uses unique timed dialogue in uncovered runtime sections, without inventing placements',async()=>{
 const queries:string[]=[];
 const result=await searchScenes(title,{videos:async(query)=>{queries.push(query);return [candidate('aqz-KE-bpKQ','Interstellar (2014) Movie Scene')];}},{
  runtime:600,reference:[{start:10,end:14,text:'We have to leave this planet before the morning comes'},{start:590,end:595,text:'Now we can finally return to the people we love'}],
  cuts:[{start:0,end:500,videoId:'ScMzIvxBSi4'},{start:500,end:600}]
 });
 expect(queries.some(query=>query.includes('"now we can finally return'))).toBe(true);
 expect(queries.some(query=>query.includes('"we have to leave'))).toBe(false);
 expect(result.items[0].identity).toBe('likely');
});
test('keeps partial search results and retries failed queries, but fails if every source failed',async()=>{
 let calls=0;
 const backend={videos:async()=>{if(calls++>0)throw new Error('Unavailable');return [candidate('aqz-KE-bpKQ','Interstellar Scene')];}};
 const result=await searchScenes(title,backend);
 expect(result.items.length).toBe(1);
 expect(result.searched.length).toBe(1);
 expect(result.failed>0).toBe(true);
});
test('keeps episode timelines separate even when search returns the same series title',async()=>{
 const tv={...title,kind:'tv' as const,season:2,episode:8};
 const result=await searchScenes(tv,{videos:async()=>[
  candidate('aqz-KE-bpKQ','Interstellar S02E08 Ending Scene'),
  candidate('M7lc1UVf-VE','Interstellar S01E08 Ending Scene'),
  candidate('ScMzIvxBSi4','Interstellar Ending Scene')
 ]});
 expect(result.items.map(item=>item.id)).toEqual(['aqz-KE-bpKQ']);
});
test('cancelling a search prevents late candidates from being published',async()=>{
 const controller=new AbortController();let published=0,rejected=false;
 try{await searchScenes(title,{videos:async()=>{controller.abort();return [candidate('aqz-KE-bpKQ','Interstellar Scene')];}},{onProgress:()=>published++},controller.signal);}catch{rejected=true;}
 expect(rejected).toBe(true);expect(published).toBe(0);
});
