import { expect, open, test } from "nsh/test";
const base="https://movies-proxy.vercel.app/tmdb";
const movie={id:42,media_type:"movie",title:"Test Film",original_title:"Test Film",release_date:"2020-01-01",runtime:20,poster_path:null,overview:""};
const candidate={id:"aqz-KE-bpKQ",title:"Test Film (2020) Movie Scene",channel:"Scene uploader",duration:30,description:"",provider:"invidious",identity:"likely"};
const reference=`1\n00:10:01,000 --> 00:10:04,000\nWe need to cross the frozen river before sunrise.\n\n2\n00:10:06,000 --> 00:10:09,000\nThe old bridge has been gone for twenty years.\n\n3\n00:10:12,000 --> 00:10:15,000\nThen we shall find another way through the valley.\n\n4\n00:10:19,000 --> 00:10:22,000\nKeep the lantern steady and follow my footsteps.\n`;
const transcript=reference.replaceAll("00:10:","00:00:");
const settings={provider:"invidious",instance:"https://inv.nadeko.net"};
const stored=(withReference=false)=>JSON.stringify({version:1,settings,books:{"movie:42":{ref:{kind:"movie",id:42},candidates:[candidate],placements:{},runtime:1200,updatedAt:1,...(withReference?{reference}:{})}}});
const network={
 [`${base}/trending/*`]:{body:{results:[movie],page:1,total_pages:1}},
 [`${base}/movie/42?*`]:{body:{...movie,videos:{results:[]}}},
 "https://inv.nadeko.net/api/v1/captions/aqz-KE-bpKQ?*":(request:{url:string})=>request.url.includes("hl=en")?{body:{captions:[{languageCode:"en-US",label:"English (United States)"}]}}:request.url.includes("label=")?{body:transcript}:{status:404}
};
const options={width:1220,height:820,platform:"macos" as const,network,storage:{"pocket-scenes-v1":stored()}};

test("discovers uploader scenes without credentials and excludes trailers",async()=>{
 const app=await open("../../App.tsx",{...options,storage:{"pocket-scenes-v1":JSON.stringify({version:1,books:{},settings})},network:{...network,
  "https://inv.nadeko.net/api/v1/search*":{body:[
   {type:"video",videoId:candidate.id,title:candidate.title,author:"Uploader A",lengthSeconds:30},
   {type:"video",videoId:"ScMzIvxBSi4",title:"Test Film (2020) Trailer",author:"Uploader B",lengthSeconds:120}
  ]}
 }});
 await app.press("role:button[Open Test Film]");
 await app.waitFor(`role:button[Preview ${candidate.title}]`);
 expect(app.texts()).toContain("Uploader A");
 expect(app.shows("role:button[Preview Test Film (2020) Trailer]")).toBe(false);
 expect(app.requests().some(request=>request.url.includes("/api/v1/search")&&!request.url.includes("key="))).toBe(true);
 expect(app.texts()).toContain("0% matched");
});

test("imports a reference, aligns clip dialogue, confirms coverage and exposes gaps",async()=>{
 const app=await open("../../App.tsx",options);
 await app.press("role:button[Open Test Film]");
 await app.press("role:button[Info]");
 await app.waitFor("role:button[Subtitles…]");
 await app.press("role:button[Subtitles…]");
 await app.paste("id:subtitle-text",{text:reference});
 await app.press("role:button[Save]");
 await app.press("role:button[Transcript…]");
 await app.paste("id:subtitle-text",{text:transcript});
 await app.press("role:button[Match transcript]");
 expect(app.texts()).toContain("0% matched");
 await app.press("role:button[Confirm match]");
 expect(app.texts()).toContain("1% matched");
 await app.press("role:button[Done]");
 await app.press("role:button[Play matched]");
 expect(app.count("id:media-player")).toBe(1);
 const state=JSON.parse(app.storage()["pocket-scenes-v1"]);
 expect(state.books["movie:42"].placements[candidate.id]).toMatchObject({movieStart:601,videoStart:1,videoEnd:22,state:"confirmed"});
 await app.press("role:button[Gap 00:00:00 to 00:10:01]");
 expect(app.texts()).toContain("Missing section");
 expect(app.count("id:media-player")).toBe(0);
 const restarted=await open("../../App.tsx",{...options,storage:app.storage()});
 await restarted.press("role:button[Open Test Film]");
 await restarted.waitFor("text:1% matched");
});

test("matches available captions through Invidious and leaves proposal out of coverage",async()=>{
 const app=await open("../../App.tsx",{...options,storage:{"pocket-scenes-v1":stored(true)}});
 await app.press("role:button[Open Test Film]");
 await app.press("role:button[Info]");
 await app.waitFor("role:button[Match scene]");
 await app.press("role:button[Match scene]");
 await app.waitFor("role:button[Confirm match]");
 expect(app.texts()).toContain("0% matched");
 expect(app.requests().some(request=>request.url.includes("/api/v1/captions/aqz-KE-bpKQ")&&request.url.includes("label=English"))).toBe(true);
});


test("bottom timeline selects overlapping clips and collapses without replacing the player",async()=>{
 const second={...candidate,id:"ScMzIvxBSi4",title:"Test Film (2020) River Scene",channel:"Uploader B"};
 const third={...candidate,id:"M7lc1UVf-VE",title:"Test Film (2020) Valley Scene",channel:"Uploader C"};
 const state=JSON.parse(stored());
 state.books["movie:42"].candidates=[candidate,second,third];
 state.books["movie:42"].placements={
  [candidate.id]:{videoId:candidate.id,movieStart:600,videoStart:0,videoEnd:30,state:"confirmed",method:"manual"},
  [second.id]:{videoId:second.id,movieStart:615,videoStart:0,videoEnd:30,state:"confirmed",method:"manual"},
  [third.id]:{videoId:third.id,movieStart:780,videoStart:0,videoEnd:30,state:"proposed",method:"transcript"}
 };
 const app=await open("../../App.tsx",{...options,storage:{"pocket-scenes-v1":JSON.stringify(state)}});
 await app.press("role:button[Open Test Film]");
 expect(app.shows("role:button[YouTube]")).toBe(false);
 expect(app.shows("role:button[Discover]")).toBe(false);
 expect(app.texts()).toContain("3% matched");
 expect(app.count("id:scene-tracks")).toBe(1);
 await app.press(`role:button[Matched ${second.title} at 00:10:15]`);
 expect(app.count("id:media-player")).toBe(1);
 await app.press("role:button[Clips]");
 expect(app.count("id:theater-timeline")).toBe(0);
 expect(app.count("id:media-player")).toBe(1);
 await app.press("role:button[Clips]");
 expect(app.count("id:scene-tracks")).toBe(1);
 await app.press("role:button[Immersive view]");
 expect(app.count("id:theater-timeline")).toBe(0);
 expect(app.shows("role:button[Back]")).toBe(false);
 expect(app.count("id:media-player")).toBe(1);
 await app.press("role:button[Exit immersive view]");
 expect(app.count("id:theater-timeline")).toBe(1);
 await app.press("role:button[Playback options]");
 await app.chooseMenuItem("YouTube controls");
 expect(app.count("id:playback-seek")).toBe(0);
 expect(app.count("id:media-player")).toBe(1);
 await app.press("role:button[Playback options]");
 await app.chooseMenuItem("Compact controls");
 expect(app.count("id:playback-seek")).toBe(1);
 await app.press(`role:button[Proposed ${third.title} at 00:13:00]`);
 await app.press("role:button[Info]");
 expect(app.shows("role:button[Confirm match]")).toBe(true);
});

test("imports a Vimeo clip into the movie, confirms a range and restores its source",async()=>{
 const app=await open("../../App.tsx",options);
 await app.press("role:button[Open Test Film]");
 await app.press("role:button[Add clip]");
 await app.paste("id:clip-url",{text:"https://vimeo.com/76979871"});
 await app.type("id:clip-name","River crossing");
 await app.type("id:clip-duration","01:00");
 await app.press("role:button[Add]");
 await app.waitFor("role:button[Preview River crossing]");
 expect(app.count("id:media-player")).toBe(1);
 await app.press("role:button[Playback options]");
 expect(app.menu()?.some(item=>item.label==="Open on Vimeo")).toBe(true);
 await app.closeMenu();
 await app.press("role:button[Info]");
 await app.press("role:button[Edit range…]");
 await app.type("id:range-movie","02:00");
 await app.press("role:button[Save]");
 await app.press("role:button[Done]");
 expect(app.texts()).toContain("5% matched");
 await app.press("role:button[Play matched]");
 expect(app.count("id:media-player")).toBe(1);
 const state=JSON.parse(app.storage()["pocket-scenes-v1"]);
 expect(state.books["movie:42"].placements["vimeo:76979871"]).toMatchObject({movieStart:120,videoStart:0,videoEnd:60,state:"confirmed"});
 const restarted=await open("../../App.tsx",{...options,storage:app.storage()});
 await restarted.press("role:button[Open Test Film]");
 await restarted.waitFor("role:button[Preview River crossing]");
 expect(restarted.texts()).toContain("5% matched");
 await restarted.press("role:button[Info]");
 await restarted.press("role:button[Remove clip]");
 await restarted.press("role:button[Done]");
 expect(restarted.texts()).toContain("0% matched");
 expect(restarted.shows("role:button[Preview River crossing]")).toBe(false);
});

test("keeps Spotify audio out of coverage and rejects unsupported source links",async()=>{
 const app=await open("../../App.tsx",options);
 await app.press("role:button[Open Test Film]");
 await app.press("role:button[Add clip]");
 await app.paste("id:clip-url",{text:"https://clips.twitch.tv/Example"});
 await app.press("role:button[Add]");
 expect(app.texts()).toContain("Twitch Clips aren’t supported. Use a video or channel URL.");
 await app.clear("id:clip-url");
 await app.paste("id:clip-url",{text:"https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC"});
 await app.type("id:clip-name","Soundtrack");
 await app.type("id:clip-duration","03:00");
 await app.press("role:button[Add]");
 await app.waitFor("role:button[Preview Soundtrack]");
 expect(app.shows("role:button[Mute]")).toBe(false);
 await app.press("role:button[Info]");
 expect(app.enabled("role:button[Edit range…]")).toBe(false);
 expect(app.enabled("role:button[Match scene]")).toBe(false);
 await app.press("role:button[Done]");
 expect(app.texts()).toContain("0% matched");
 const state=JSON.parse(app.storage()["pocket-scenes-v1"]);
 expect(state.books["movie:42"].candidates.find((item:{id:string})=>item.id.startsWith("spotify:")).source.provider).toBe("spotify");
});

test('discovers out-of-order uploads and aligns opening, middle and ending to the title runtime',async()=>{
 const ids=['M7lc1UVf-VE','ScMzIvxBSi4',candidate.id];
 const names=['Opening','Middle','Ending'];
 const starts=[0,600,1179];
 const dialogues=[
  ['a silver train waits beneath the empty morning sky','our journey begins beside the river before the sunrise','hold my hand and follow me across the bridge'],
  ['the house at the end of the road is empty','we have searched every room and found the missing letter','read it quietly before the guards return from the station'],
  ['we can see the city lights beyond the dark water','everything we left behind is waiting at the harbour','the last boat is finally taking all of us home']
 ];
 const srt=(lines:string[],start:number)=>lines.map((line,i)=>`${i+1}\n${new Date((start+i*8)*1000).toISOString().slice(11,19)},000 --> ${new Date((start+i*8+5)*1000).toISOString().slice(11,19)},000\n${line}`).join('\n\n');
 const timed=dialogues.map((lines,i)=>srt(lines,starts[i])).join('\n\n');
 const state={version:1,settings,books:{'movie:42':{ref:{kind:'movie',id:42},candidates:[],placements:{},runtime:1200,reference:timed,updatedAt:1}}};
 const app=await open('../../App.tsx',{...options,storage:{'pocket-scenes-v1':JSON.stringify(state)},network:{...network,
  'https://inv.nadeko.net/api/v1/search*':{body:[2,0,1].map(index=>({type:'video',videoId:ids[index],title:`Test Film (2020) ${names[index]} Scene`,author:'Uploader',lengthSeconds:21}))},
  ...Object.fromEntries(ids.map((id,i)=>[`https://inv.nadeko.net/api/v1/captions/${id}?*`,(request:{url:string})=>request.url.includes('hl=en')?{body:{captions:[{languageCode:'en',label:'English'}]}}:{body:srt(dialogues[i],0)}]))
 }});
 await app.press('role:button[Open Test Film]');
 await app.waitFor('role:button[Proposed Test Film (2020) Ending Scene at 00:19:39]');
 const saved=JSON.parse(app.storage()['pocket-scenes-v1']).books['movie:42'];
 expect(ids.map(id=>saved.placements[id].movieStart)).toEqual(starts);
 expect(app.texts()).toContain('0% matched');
 for(let i=0;i<ids.length;i++){
  await app.press(`role:button[Preview Test Film (2020) ${names[i]} Scene]`);
  await app.press('role:button[Info]');
  await app.press('role:button[Confirm match]');
  await app.press('role:button[Done]');
 }
 expect(app.texts()).toContain('5% matched');
 expect(app.shows('role:button[Scene 00:00:00 to 00:00:21]')).toBe(true);
 expect(app.shows('role:button[Gap 00:00:21 to 00:10:00]')).toBe(true);
 expect(app.shows('role:button[Scene 00:19:39 to 00:20:00]')).toBe(true);
 await app.press('role:button[Play matched]');
 expect(app.count('id:media-player')).toBe(1);
});

test('requires an episode for a series and stores each episode under its own runtime',async()=>{
 const series={id:43,media_type:'tv',name:'Test Series',original_name:'Test Series',first_air_date:'2020-01-01'};
 const app=await open('../../App.tsx',{...options,storage:{'pocket-scenes-v1':JSON.stringify({version:1,settings,books:{}})},network:{...network,
  [`${base}/trending/*`]:{body:{results:[series],page:1,total_pages:1}},
  [`${base}/tv/43?*`]:{body:{...series,seasons:[{season_number:2,name:'Season 2'}]}},
  [`${base}/tv/43/season/2?*`]:{body:{id:43002,name:'Season 2',episodes:[{episode_number:8,name:'The Return',air_date:'2024-01-01'}]}},
  [`${base}/tv/43/season/2/episode/8?*`]:{body:{id:430208,name:'The Return',runtime:48,air_date:'2024-01-01'}},
  'https://inv.nadeko.net/api/v1/search*':{body:[{type:'video',videoId:candidate.id,title:'Test Series S02E08 Ending Scene',author:'Uploader',lengthSeconds:30}]}
 }});
 await app.press('role:button[Open Test Series]');
 expect(app.texts()).toContain('Choose an episode');
 expect(app.requests().some(request=>request.url.includes('/api/v1/search'))).toBe(false);
 await app.press('role:button[Choose episode]');
 await app.press('role:button[Season 2]');
 await app.press('role:button[E8 · The Return]');
 await app.waitFor('role:button[Preview Test Series S02E08 Ending Scene]');
 expect(app.texts()).toContain('00:48:00');
 expect(JSON.parse(app.storage()['pocket-scenes-v1']).books['tv:43:s2:e8'].candidates.length).toBe(1);
});

test('finds and imports captions from a matching full-runtime timing source',async()=>{
 const sourceId='M7lc1UVf-VE',sourceName='Test Film (2020) Full Movie';
 const app=await open('../../App.tsx',{...options,network:{...network,
  'https://inv.nadeko.net/api/v1/search*':{body:[{type:'video',videoId:sourceId,title:sourceName,author:'Archive',lengthSeconds:1200}]},
  [`https://inv.nadeko.net/api/v1/videos/${sourceId}`]:{body:{videoId:sourceId,title:sourceName,author:'Archive',lengthSeconds:1200}},
  [`https://inv.nadeko.net/api/v1/captions/${sourceId}?*`]:(request:{url:string})=>request.url.includes('hl=en')?{body:{captions:[{languageCode:'en',label:'English'}]}}:{body:reference}
 }});
 await app.press('role:button[Open Test Film]');
 await app.press('role:button[Info]');
 await app.press('role:button[Subtitles…]');
 await app.press('role:button[Find timing source]');
 await app.press(`role:button[Read timing source ${sourceName}]`);
 await app.waitFor('text:Check the cut and timecodes, then save.');
 expect(app.value('id:subtitle-text')).toContain('cross the frozen river');
 await app.press('role:button[Save]');
 expect(JSON.parse(app.storage()['pocket-scenes-v1']).books['movie:42'].reference).toContain('00:10:01,000');
});
