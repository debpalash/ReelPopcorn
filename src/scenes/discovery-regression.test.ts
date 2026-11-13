import {expect,test} from "nsh/test";
import {rankCandidate,type Candidate} from "./model";
import {alignTranscript,indexReference} from "./alignment";
const clip=(title:string):Candidate=>({id:"aqz-KE-bpKQ",title,channel:"Uploader",description:"",duration:120,provider:"yt-dlp",identity:"review"});

test("rejects comparisons and invented scenes even when the movie title matches",()=>{
 for(const title of ["Interstellar (2014) Scene Comparison IMAX vs Blu-ray","Interstellar (2014) AI Generated Scene","Interstellar (2014) Lego Scene","Interstellar Ending Scene IMAX Response","Interstellar ending music","Arrival (2016) Spaceship Scene - Like Interstellar (2014)"])
  expect(rankCandidate(clip(title),"Interstellar","Interstellar","2014")).toBe(null);
});

test("does not treat an ordinary short-title word as movie identity",()=>{
 expect(rankCandidate(clip("Don't Give Up - Inspirational Movie Scene"),"Up","Up","2009")).toBe(null);
 expect(rankCandidate(clip("I can't believe it! Avengers Final Scene"),"It","It","2017")).toBe(null);
});

test("aligns rolling short-caption windows to a fixed movie timeline",()=>{
 const lines=["the signal is coming from inside the house","we need to leave before the road floods","take the children and wait beside the bridge","there is no time to turn back now"];
 const reference=lines.map((text,index)=>({start:100+index*10,end:104+index*10,text}));
 const captions=lines.flatMap((text,index)=>{
  const words=text.split(" ");
  return [0,2,4,6].map((word,part)=>({start:index*10+part,end:index*10+part+2,text:words.slice(Math.max(0,word-2),word+2).join(" ")}));
 });
 const match=alignTranscript(indexReference(reference),captions,"aqz-KE-bpKQ",36,500);
 expect(Boolean(match)).toBe(true);
});

test('timing sources must match the movie release and runtime',async()=>{
 const {isTimingSource}=await import('./discovery');
 const title={kind:'movie' as const,id:42,title:'Night of the Living Dead',originalTitle:'Night of the Living Dead',date:'1968-01-01',overview:'',poster:null,backdrop:null,rating:0};
 const source={...clip('Night of the Living Dead (1968) Full Movie'),duration:5760};
 expect(isTimingSource(source,title,5760)).toBe(true);
 expect(isTimingSource({...source,title:'Night of the Living Dead (1990) Full Movie'},title,5760)).toBe(false);
 expect(isTimingSource({...source,duration:5300},title,5760)).toBe(false);
 expect(isTimingSource({...source,title:'Other Movie (1968) Full Movie'},title,5760)).toBe(false);
});

test('keeps a real emotional breakdown scene',()=>{
 expect(rankCandidate(clip("Interstellar (2014) - Cooper’s Breakdown Scene (3/10) | Movieclips"),"Interstellar","Interstellar","2014")?.identity).toBe('likely');
});
