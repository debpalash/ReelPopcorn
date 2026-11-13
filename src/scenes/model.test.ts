import { expect, test } from "nsh/test";
import { buildCut, coveredSeconds, rankCandidate, sequenceOf, type Candidate, type Placement } from "./model";
import { alignTranscript, indexReference, parseSubtitles } from "./alignment";
const candidate=(id:string,title="Interstellar (2014) Movie Scene"):Candidate=>({id,title,channel:"Uploader",description:"",duration:120,provider:"manual",identity:"review"});
const range=(videoId:string,movieStart:number,videoStart:number,videoEnd:number):Placement=>({videoId,movieStart,videoStart,videoEnd,state:"confirmed",method:"manual"});

test("rejects promotional uploads and different releases while keeping scene candidates",()=>{
 expect(rankCandidate(candidate("aqz-KE-bpKQ"),"Interstellar","Interstellar","2014")?.identity).toBe("likely");
 for(const title of ["Interstellar (2014) Official Trailer","Interstellar reaction scene","Interstellar (2020) Movie Scene","Another Movie scene"])
  expect(rankCandidate(candidate("aqz-KE-bpKQ",title),"Interstellar","Interstellar","2014")).toBe(null);
 expect(sequenceOf("Interstellar (3/10) Movie CLIP")).toEqual({index:3,total:10});
});

test("unions overlaps, inserts runtime gaps and trims source offsets",()=>{
 const candidates=[candidate("aqz-KE-bpKQ"),candidate("ScMzIvxBSi4")];
 const cut=buildCut(300,[range("aqz-KE-bpKQ",30,10,110),range("ScMzIvxBSi4",100,0,100)],candidates);
 expect(coveredSeconds(cut)).toBe(170);
 expect(cut[0]).toEqual({start:0,end:30});
 expect(cut[1]).toMatchObject({start:30,end:130,videoId:"aqz-KE-bpKQ",videoStart:10,videoEnd:110});
 expect(cut[2]).toMatchObject({start:130,end:200,videoId:"ScMzIvxBSi4",videoStart:30,videoEnd:100});
 expect(cut[3]).toMatchObject({start:200,end:300});
});

test("proposed and missing-video ranges cannot claim coverage",()=>{
 const cut=buildCut(300,[{...range("aqz-KE-bpKQ",0,0,100),state:"proposed"},range("ScMzIvxBSi4",150,0,100)],[candidate("aqz-KE-bpKQ")]);
 expect(coveredSeconds(cut)).toBe(0);
 expect(cut).toEqual([{start:0,end:300}]);
});

const srt=`1\n00:10:01,000 --> 00:10:04,000\nWe need to cross the frozen river before sunrise.\n\n2\n00:10:06,000 --> 00:10:09,000\nThe old bridge has been gone for twenty years.\n\n3\n00:10:12,000 --> 00:10:15,000\nThen we shall find another way through the valley.\n\n4\n00:10:19,000 --> 00:10:22,000\nKeep the lantern steady and follow my footsteps.\n`;
const clip=srt.replaceAll("00:10:","00:00:");

test("aligns timed clip dialogue to movie subtitles and proposes a bounded source range",()=>{
 const reference=indexReference(parseSubtitles(srt));
 const match=alignTranscript(reference,parseSubtitles(clip),"aqz-KE-bpKQ",30,1000);
 expect(match).toMatchObject({movieStart:601,videoStart:1,videoEnd:22,state:"proposed",method:"transcript",anchors:4});
});

test("rejects unrelated and ambiguous repeated dialogue",()=>{
 const reference=indexReference(parseSubtitles(srt));
 const other=parseSubtitles(clip.replace(/We need[^\n]*|The old[^\n]*|Then we[^\n]*|Keep the[^\n]*/g,"These words belong to a completely unrelated television programme."));
 expect(alignTranscript(reference,other,"aqz-KE-bpKQ",30,1000)).toBe(null);
 const twice=[...parseSubtitles(srt),...parseSubtitles(srt).map(cue=>({...cue,start:cue.start+100,end:cue.end+100}))];
 expect(alignTranscript(indexReference(twice),parseSubtitles(clip),"aqz-KE-bpKQ",30,1000)).toBe(null);
});

test("reads WebVTT timing and rejects untimed text",()=>{
 expect(parseSubtitles("WEBVTT\n\n00:01.000 --> 00:03.000\nA short cue.")[0]).toMatchObject({start:1,end:3});
 expect(()=>parseSubtitles("No timecodes here")).toThrow("timecodes");
});

test("coverage cannot extend beyond the actual source clip duration",()=>{
 const cut=buildCut(1000,[range("aqz-KE-bpKQ",100,10,900)],[candidate("aqz-KE-bpKQ")]);
 expect(coveredSeconds(cut)).toBe(110);
 expect(cut.find(item=>item.videoId)?.videoEnd).toBe(120);
});

test("assembles video ranges across providers while excluding audio and live streams",()=>{
 const vimeo:Candidate={...candidate("vimeo:76979871"),source:{provider:"vimeo",id:"76979871",url:"https://vimeo.com/76979871",kind:"video"}};
 const audio:Candidate={...candidate("spotify:track:4uLU6hMCjMI75M1A2tKUQC"),source:{provider:"spotify",id:"track:4uLU6hMCjMI75M1A2tKUQC",url:"https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC",kind:"audio"}};
 const live:Candidate={...candidate("twitch:channel:monstercat"),source:{provider:"twitch",id:"channel:monstercat",url:"https://www.twitch.tv/monstercat",kind:"live"}};
 const cut=buildCut(300,[range("aqz-KE-bpKQ",0,0,60),range(vimeo.id,60,0,60),range(audio.id,120,0,60),range(live.id,180,0,60)],[candidate("aqz-KE-bpKQ"),vimeo,audio,live]);
 expect(coveredSeconds(cut)).toBe(120);
 expect(cut[1]).toMatchObject({videoId:vimeo.id,start:60,end:120});
 expect(cut[2]).toEqual({start:120,end:300});
});
