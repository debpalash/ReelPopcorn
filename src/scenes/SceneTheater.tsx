import { cleanup, computed, effect, Image, keymap, List, resource, Scroll, signal, untracked, Text, View, type ListRef } from "nsh";
import { Button as BaseButton, Sheet } from "nsh/base";
import {AddClip} from "./AddClip";
import {providerName} from "../media/source";
import { Player } from "../Player";
import { Button, Empty, Input, Notice, Textarea, WindowBar } from "../ui";
import { TmdbClient } from "../tmdb/api";
import { Theater as Extras } from "../tmdb/Theater";
import { formatTime, parseTime, year, titleKey, type TitleRef, type Media } from "../tmdb/model";
import { inWatchlist, localReady, tmdbConnection, toggleWatchlist } from "../tmdb/state";
import { alignTranscript, indexReference, parseSubtitles } from "./alignment";
import { clipCaptions, discoverScenes, videoMetadata, findTimingSources, isTimingSource } from "./discovery";
import { buildCut, coveredSeconds, canPlaceCandidate, isYouTubeCandidate, type Candidate, type Cut, type Placement } from "./model";
import { discoveryOptions, loadScenes, prepareDiscovery, recordSearches, mergeCandidates, removePlacement, savePlacement, saveReference, saveSourceDuration, removeCandidate, sceneBook, scenesError, scenesReady } from "./state";

export function SceneTheater(props:{title:Media;onBack:()=>void;onConnection:()=>void}) {
  const extras=signal(false),picker=signal(false);
  const scope=signal<TitleRef>({kind:props.title.kind,id:props.title.id});
  const browsing=signal<TitleRef>({kind:props.title.kind,id:props.title.id});
  const scopedDetail=resource(()=>picker()?{ref:browsing(),connection:tmdbConnection()}:null,async(value,{signal:abort})=>new TmdbClient(value.connection).detail(value.ref,abort));
  return <>
    <If when={extras()} else={<Each of={[scope()]} key={titleKey}>{value=><Scenes title={{...props.title,...value()}} onBack={props.onBack} onConnection={props.onConnection} onExtras={()=>extras.set(true)} onScope={()=>picker.set(true)}/>}</Each>}>
      <Extras title={props.title} onBack={()=>extras.set(false)} />
    </If>
    <Sheet open={picker()} onOpenChange={event=>picker.set(event.open)} side="right" popupClass="bg-background border-l border-border" popupStyle={{width:300}} backdropClass="bg-black/30">
      <View class="flex-1 p-4 gap-3"><View class="flex-row items-center"><Text class="flex-1 text-sm font-semibold text-foreground">Episode</Text><Button label="Done" variant="ghost" onPress={()=>picker.set(false)}/></View>
        <If when={browsing().season!==undefined}><Button label="Seasons" variant="ghost" onPress={()=>browsing.set({kind:"tv",id:props.title.id})}/></If>
        <If when={scopedDetail.loading()}><Notice>Loading…</Notice></If>
        <If when={scopedDetail.error()}><Notice error>{String(scopedDetail.error())}</Notice></If>
        <Scroll class="flex-1"><View class="gap-1">
          <Each of={scopedDetail()?.seasons??[]} key={item=>item.number}>{item=><Button label={item().name} variant="ghost" onPress={()=>browsing.set({kind:"tv",id:props.title.id,season:item().number})}/>}</Each>
          <Each of={scopedDetail()?.episodes??[]} key={item=>item.number}>{item=><Button label={`E${item().number} · ${item().name}`} variant="ghost" onPress={()=>{scope.set({...browsing(),episode:item().number});picker.set(false);}}/>}</Each>
        </View></Scroll>
      </View>
    </Sheet>
  </>;
}
function Scenes(props:{title:Media;onBack:()=>void;onConnection:()=>void;onExtras:()=>void;onScope:()=>void}) {
  void loadScenes();
  const ref:TitleRef={kind:props.title.kind,id:props.title.id,season:props.title.season,episode:props.title.episode};
  const detail=resource(()=>tmdbConnection(), async(connection,{signal:abort})=>new TmdbClient(connection).detail(ref,abort));
  const book=()=>sceneBook(ref);
  const candidates=()=>[...(book()?.candidates??[])].sort((a,b)=>{const pa=book()?.placements[a.id],pb=book()?.placements[b.id];if(pa&&pb)return pa.movieStart-pb.movieStart;if(pa||pb)return pa?-1:1;if(a.channel===b.channel&&a.sequence&&b.sequence)return a.sequence.index-b.sequence.index;return (b.score??0)-(a.score??0);});
  const placements=()=>book()?.placements??{};
  const runtime=()=>book()?.runtime??(detail()?.runtime??0)*60;
  const searchVersion=signal(0), selected=signal("");
  const assembled=signal(false), cutStart=signal(0);
  const editor=signal<"reference"|"transcript"|"range"|"link"|null>(null);
  const text=signal(""), runtimeDraft=signal(""), movieDraft=signal(""), inDraft=signal(""), outDraft=signal("");
  const timingSources=signal<Candidate[]>([]),referenceRead=signal(false);
  const notice=signal(""), progress=signal(""), searchProgress=signal(""), referenceUrl=signal("");
  const attempted=signal<Record<string,string>>({});
  let controller:AbortController|undefined;
  let rail:ListRef|undefined;
  const inspector=signal(false), clipsVisible=signal(true), immersive=signal(false);
  const openEditor=(mode:"reference"|"transcript"|"range"|"link")=>{editor.set(mode);inspector.set(true);};
  cleanup(()=>controller?.abort());
  const discovery=resource(()=>scenesReady()&&detail()&&(props.title.kind==="movie"||props.title.episode!==undefined)?{options:discoveryOptions(),variant:searchVersion(),aliases:detail()?.aliases??[]}:null,async(source,{signal:abort})=>{
    prepareDiscovery(props.title,source.aliases);
    if(source.variant===0 && candidates().length && book()?.searches?.length)return candidates();
    let cues;
    try{if(book()?.reference)cues=parseSubtitles(book()!.reference!);}catch{}
    searchProgress.set("Searching…");
    try {
      const items=await discoverScenes(props.title,source.options,abort,{
        aliases:source.aliases,searched:book()?.searches,reference:cues,runtime:runtime(),
        cuts:buildCut(runtime(),Object.values(placements()),candidates()),
        onProgress:value=>{if(!abort.aborted){
          if(!selected()&&value.items[0])selected.set(value.items[0].id);
          mergeCandidates(ref,value.items);recordSearches(ref,value.searched);
          searchProgress.set(`${value.scanned} checked · ${value.items.length} scenes`);
        }}
      });
      if(!abort.aborted&&book()?.reference)void matchBatch();
      return items;
    }finally{if(!abort.aborted)searchProgress.set("");}
  });
  const cuts=computed(()=>buildCut(runtime(),Object.values(placements()),candidates()));
  const coverage=()=>coveredSeconds(cuts());
  const active=()=>candidates().find((item)=>item.id===selected())??candidates()[0];
  const placement=()=>active()?placements()[active()!.id]:undefined;
  const railPosition=computed(()=>`${clipsVisible()&&!immersive()}:${candidates().findIndex(item=>item.id===active()?.id)}`);
  effect(()=>{const [visible,index]=railPosition().split(":");if(visible==="true"&&Number(index)>=0)rail?.scrollToIndex({index:Number(index),viewPosition:0.5,animated:false});});
  const cut=()=>cuts().find((item)=>item.start===cutStart());
  const playable=()=>cuts().filter((item)=>item.videoId);
  const video=computed(()=>{
    if(assembled()) {
      const range=cut();if(!range?.videoId) return null;
      const item=candidates().find((candidate)=>candidate.id===range.videoId);
      return {id:range.videoId,title:item?.title??"Scene",author:item?.channel??"YouTube",source:item?.source,startSeconds:range.videoStart,endSeconds:range.videoEnd};
    }
    const item=active();return item?{id:item.id,title:item.title,author:item.channel,source:item.source}:null;
  });
  const choose=(candidate:Candidate)=>{editor.set(null);assembled.set(false);selected.set(candidate.id);notice.set("");};
  const pickCut=(range:Cut)=>{assembled.set(true);cutStart.set(range.start);editor.set(null);if(range.videoId)selected.set(range.videoId);};
  const next=()=>{
    if(assembled()) {const following=playable().find((range)=>range.start>cutStart());if(following)pickCut(following);}
    else {const index=candidates().findIndex((item)=>item.id===active()?.id);if(candidates()[index+1])choose(candidates()[index+1]);}
  };
  const hasNext=()=>assembled()?playable().some((range)=>range.start>cutStart()):candidates().findIndex((item)=>item.id===active()?.id)<candidates().length-1;
  const reference=()=>{
    if(!book()?.reference) throw new Error("Add the movie’s timed subtitles first.");
    if(!runtime())throw new Error("Set the movie runtime first.");
    return indexReference(parseSubtitles(book()!.reference!));
  };
  const propose=(candidate:Candidate, transcript:string)=>{
    const match=alignTranscript(reference(),parseSubtitles(transcript),candidate.id,candidate.duration,runtime());
    if(!match)throw new Error("No consistent dialogue match.");
    savePlacement(ref,match);editor.set(null);
  };
  const matchBatch=async(single?:Candidate)=>{
    if(progress())return;
    selected.set(active()?.id??"");
    let index:ReturnType<typeof reference>;
    try{index=reference();}catch(error){notice.set((error as Error).message);return;}
    const current=new AbortController();controller=current;const abort=current.signal;
    const batch=single?[single]:candidates().filter((item)=>isYouTubeCandidate(item)&&canPlaceCandidate(item)&&!placements()[item.id]&&!attempted()[item.id]);
    if(!batch.length){notice.set("No untried clips. Find more scenes or retry a clip.");return;}
    notice.set("");progress.set(`Matching 0 of ${batch.length}`);
    let cursor=0,done=0;
    const worker=async()=>{
      while(cursor<batch.length&&!abort.aborted) {
        const candidate=batch[cursor++];
        try {
          const captions=await clipCaptions(candidate.id,discoveryOptions(),abort);
          if(abort.aborted)break;
          const result=alignTranscript(index,captions,candidate.id,candidate.duration,runtime());
          if(result)savePlacement(ref,result);
          attempted.update((all)=>({...all,[candidate.id]:result?"Match found":"No match"}));
        }catch(error){if(!abort.aborted)attempted.update((all)=>({...all,[candidate.id]:"Captions unavailable"}));}
        if(!abort.aborted)progress.set(`Matching ${++done} of ${batch.length}`);
      }
    };
    try{await Promise.all([worker(),worker()]);}
    finally{
      if(controller===current){progress.set("");
        if(!abort.aborted&&candidates().some(item=>isYouTubeCandidate(item)&&canPlaceCandidate(item)&&!placements()[item.id]&&!attempted()[item.id]))void matchBatch();
      }
    }
  };
  const timedReference=computed(()=>book()?.reference??"");
  effect(()=>{const value=timedReference();if(value)untracked(()=>{attempted.set({});void matchBatch();});});
  const findReference=async()=>{
    if(progress())return;
    const expected=parseTime(runtimeDraft());if(!expected){notice.set("Set the runtime first.");return;}
    const current=new AbortController();controller=current;progress.set("Finding timing sources…");notice.set("");timingSources.set([]);
    try {
      const sources=await findTimingSources(props.title,expected,discoveryOptions(),current.signal,detail()?.aliases);
      if(!current.signal.aborted){timingSources.set(sources);if(!sources.length)notice.set("No matching timing source. Add this cut’s timed subtitles.");}
    }catch(error){if(!current.signal.aborted)notice.set((error as Error).message);}
    finally{if(controller===current)progress.set("");}
  };
  const loadReference=async()=>{
    if(progress())return;
    referenceRead.set(false);
    const url=referenceUrl().trim();
    const id=/^[\w-]{11}$/.test(url)?url:/(?:youtu\.be\/|[?&]v=)([\w-]{11})(?:[?&#]|$)/.exec(url)?.[1];
    if(!id){notice.set("Enter a YouTube video URL or ID.");return;}
    const current=new AbortController();controller=current;progress.set("Reading subtitles…");notice.set("");
    try {
      const metadata=await videoMetadata(id,discoveryOptions(),current.signal);
      const expected=parseTime(runtimeDraft());
      if(!expected||!isTimingSource(metadata,props.title,expected,detail()?.aliases))throw new Error("Source title, release or duration differs from this cut.");
      const cues=await clipCaptions(id,discoveryOptions(),current.signal);
      if(current.signal.aborted)return;
      text.set(cues.map((cue,i)=>`${i+1}\n${subtitleTime(cue.start)} --> ${subtitleTime(cue.end)}\n${cue.text}`).join("\n\n"));
      referenceRead.set(true);
    }catch(error){if(!current.signal.aborted)notice.set((error as Error).message);}
    finally{if(controller===current)progress.set("");}
  };
  const saveEditor=()=>{
    try {
      if(editor()==="reference") {
        const cues=parseSubtitles(text()), value=parseTime(runtimeDraft());
        if(!value)throw new Error("Enter the runtime as hh:mm:ss.");
        if(cues[cues.length-1].end>value+2)throw new Error("Subtitles exceed this runtime. Check the movie cut.");
        controller?.abort();progress.set("");saveReference(ref,text(),value);editor.set(null);attempted.set({});
      }else if(editor()==="transcript" && active())propose(active()!,text());
      else if(editor()==="range" && active()) {
        const movieStart=parseTime(movieDraft()),videoStart=parseTime(inDraft()),videoEnd=parseTime(outDraft());
        if(movieStart===null||videoStart===null||videoEnd===null||videoEnd<=videoStart)throw new Error("Enter a valid movie position and clip range.");
        if(!runtime()||movieStart+videoEnd-videoStart>runtime()||videoEnd>active()!.duration)throw new Error("The range exceeds the movie or clip runtime.");
        savePlacement(ref,{videoId:active()!.id,movieStart,videoStart,videoEnd,state:"confirmed",method:"manual"});editor.set(null);
      }
    }catch(error){notice.set((error as Error).message);}
  };
  const editRange=()=>{const p=placement();movieDraft.set(p?formatTime(p.movieStart):"");inDraft.set(formatTime(p?.videoStart??0));outDraft.set(formatTime(p?.videoEnd??Math.floor(active()?.duration??0)));openEditor("range");notice.set("");};
  keymap.bind("Escape",()=>{if(editor())editor.set(null);else if(inspector())inspector.set(false);else if(immersive())immersive.set(false);else props.onBack();});
  keymap.bind("alt+right",next);
  keymap.bind("mod+o",()=>{openEditor("link");notice.set("");});
  keymap.bind("mod+shift+f",()=>immersive.set(!immersive()));

  return <View class="flex-1 bg-background">
    <If when={!immersive()}><WindowBar>
      <Button label="‹" accessibilityLabel="Back" variant="ghost" onPress={props.onBack}/>
      <Text class="text-sm font-semibold text-foreground" style={{numberOfLines:1,maxWidth:400}}>{props.title.title}</Text>
      <Text class="text-xs text-muted-foreground">{year(props.title.date)}{runtime()?` · ${Math.round(runtime()/60)} min`:""}</Text>
      <View class="flex-1"/>
      <If when={props.title.kind==="tv"}><Button label={props.title.episode!==undefined?`S${props.title.season} · E${props.title.episode}`:"Episode…"} accessibilityLabel="Choose episode" variant="ghost" onPress={props.onScope}/></If>
      <Button label="＋" accessibilityLabel="Add clip" variant="ghost" onPress={()=>{openEditor("link");notice.set("");}}/>
      <Button label="Info" variant="ghost" selected={inspector()} onPress={()=>inspector.set(!inspector())}/>
      <Button label="Extras" variant="ghost" onPress={props.onExtras}/>
      <Button label="Clips" variant="ghost" selected={clipsVisible()} onPress={()=>clipsVisible.set(!clipsVisible())}/>
      <Button label="⤢" accessibilityLabel="Immersive view" variant="ghost" onPress={()=>immersive.set(true)}/>
    </WindowBar></If>
    <View class="flex-1 bg-player" testID="theater-picture">
      <If when={video()} else={<View class="flex-1 justify-center items-center"><Empty title={assembled()?"Missing section":props.title.kind==="tv"&&props.title.episode===undefined?"Choose an episode":discovery.loading()?"Finding clips…":"No scenes yet"} detail={assembled()?"No confirmed clip covers this section.":""}/><ClipActions count={candidates().length} percent={runtime()?Math.floor(coverage()/runtime()*100):undefined} canPlay={Boolean(playable().length)} onPlay={()=>pickCut(playable()[0])} hasNext={hasNext()} onNext={next} onRestore={immersive()?()=>immersive.set(false):undefined}/></View>}>
        <Player theater fill video={video()} hasNext={hasNext()} onNext={next} onEnded={next} paused={editor()!==null} onDuration={(id,duration)=>saveSourceDuration(ref,id,duration)} footer={<ClipActions count={candidates().length} percent={runtime()?Math.floor(coverage()/runtime()*100):undefined} canPlay={Boolean(playable().length)} onPlay={()=>pickCut(playable()[0])} hasNext={hasNext()} onNext={next} onRestore={immersive()?()=>immersive.set(false):undefined}/>}/>
      </If>
    </View>
    <If when={discovery.error()}><View class="flex-row items-center gap-2 px-3 py-1"><Notice error>{String((discovery.error() as Error).message??discovery.error())}</Notice><Button label="Connection…" onPress={props.onConnection}/><Button label="Retry" onPress={discovery.refetch}/></View></If>
    <If when={(notice()&&!inspector())||scenesError()}><View class="px-3 py-1"><Notice error>{scenesError()||notice()}</Notice></View></If>
    <If when={detail.error()}><View class="px-3 py-1"><Notice error>{String(detail.error())}</Notice></View></If>
    <If when={clipsVisible()&&!immersive()}>
      <View class="px-2 gap-0" testID="theater-timeline">
        <If when={runtime()>0}><RuntimeMap cuts={cuts()} runtime={runtime()} selectedStart={assembled()?cutStart():-1} onPick={pickCut}/></If>
        <ClipTracks candidates={candidates()} placements={Object.values(placements())} runtime={runtime()} selected={active()?.id??""} onSelect={choose}/>
        <If when={runtime()>0}><View class="flex-row items-center">
          <Text class="text-xs text-muted-foreground">00:00</Text><View class="flex-1"/>
          <If when={discovery.loading()}><Text class="text-xs text-muted-foreground">{searchProgress()||"Finding clips…"}</Text></If>
          <Text class="text-xs text-muted-foreground">{runtime()?formatTime(runtime()):""}</Text>
        </View></If>
        <List ref={node=>{rail=node;}} horizontal each={candidates()} keyExtractor={item=>item.id} estimatedItemSize={192} style={{height:48}} testID="scene-candidates">
          {item=><CandidateCard movieTitle={props.title.title} candidate={item()} placement={placements()[item().id]} selected={active()?.id===item().id} onSelect={()=>choose(item())}/>}
        </List>
      </View>
    </If>
    <Sheet open={inspector()} onOpenChange={event=>{inspector.set(event.open);if(!event.open)editor.set(null);}} side="right"
      popupClass="bg-background border-l border-border" popupStyle={{width:340}} backdropClass="bg-black/30">
      <View class="flex-1 p-4 gap-3">
        <View class="flex-row items-center"><Text class="flex-1 text-sm font-semibold text-foreground">{editor()==="reference"?"Movie subtitles":editor()==="transcript"?"Clip transcript":editor()==="range"?"Scene range":editor()==="link"?"Add clip":"Clip info"}</Text><Button label="Done" variant="ghost" onPress={()=>{inspector.set(false);editor.set(null);}}/></View>
        <Scroll class="flex-1"><View class="gap-3">
          <If when={editor()} else={<>
            <Text class="text-sm font-semibold text-foreground" style={{numberOfLines:3}}>{active()?.title??props.title.title}</Text>
            <Text class="text-xs text-muted-foreground">{active()?.channel}{active()?.source?.kind==="live"?" · Live":active()&&active()!.duration>0?` · ${formatTime(Math.floor(active()!.duration))}`:""}</Text>
            <If when={placement()} else={<Notice>{active()?attempted()[active()!.id]??"Unplaced":""}</Notice>}>{p=><View class="gap-2">
              <Text class="text-sm text-foreground">{p().state==="confirmed"?"Confirmed":"Review match"} · {formatTime(Math.floor(p().movieStart))}–{formatTime(Math.floor(p().movieStart+p().videoEnd-p().videoStart))}</Text>
              <If when={p().anchors}><Text class="text-xs text-muted-foreground">{p().anchors} dialogue anchors{p().spread?` · ${p().spread!.toFixed(1)}s spread`:""}</Text></If>
              <If when={p().state==="proposed"}><Button label="Confirm match" onPress={()=>savePlacement(ref,{...p(),state:"confirmed"})}/></If>
              <Button label="Remove match" variant="ghost" onPress={()=>removePlacement(ref,p().videoId)}/>
            </View>}</If>
            <View class="flex-row gap-1 flex-wrap">
              <Button label="Match scene" disabled={!active()||!isYouTubeCandidate(active()!)||!canPlaceCandidate(active()!)||!book()?.reference||Boolean(progress())} onPress={()=>{if(active())void matchBatch(active());}}/>
              <Button label="Transcript…" variant="ghost" disabled={!book()?.reference||!active()||!canPlaceCandidate(active()!)} onPress={()=>{text.set("");openEditor("transcript");notice.set("");}}/>
              <Button label="Edit range…" variant="ghost" disabled={!active()||!canPlaceCandidate(active()!)} onPress={editRange}/>
            </View>
            <If when={active()?.provider==="manual"}><Button label="Remove clip" variant="ghost" onPress={()=>{const id=active()?.id;if(id){assembled.set(false);selected.set("");removeCandidate(ref,id);}}}/></If>
            <View class="border-t border-border pt-3 gap-2">
              <Text class="text-xs text-muted-foreground">{runtime()?`${formatTime(Math.floor(coverage()))} / ${formatTime(runtime())} matched`:"Runtime unavailable"}</Text>
              <Button label="Subtitles…" onPress={()=>{referenceUrl.set("");timingSources.set([]);referenceRead.set(false);text.set(book()?.reference??"");runtimeDraft.set(formatTime(runtime()));openEditor("reference");notice.set("");}}/>
              <Button label={progress()?"Stop":"Match clips"} disabled={!book()?.reference} onPress={()=>{if(progress()){controller?.abort();progress.set("");}else void matchBatch();}}/>
              <If when={progress()}><Notice>{progress()}</Notice></If>
              <If when={discovery.loading()}><Notice>{searchProgress()||"Searching…"}</Notice></If>
              <If when={!book()?.reference}><Notice>Timed subtitles are needed to place scenes.</Notice></If>
              <Button label="Find more" variant="ghost" disabled={discovery.loading()} onPress={()=>{selected.set(active()?.id??"");searchVersion.update(value=>value+1);}}/>
              <Button label={inWatchlist(props.title)?"In watchlist":"Watchlist"} variant="ghost" selected={inWatchlist(props.title)} disabled={!localReady()} onPress={()=>toggleWatchlist(props.title)}/>
            </View>
          </>}>
            <If when={editor()==="link"} else={<>
            <If when={editor()==="reference"}><View class="gap-1"><Button label="Find timing source" disabled={Boolean(progress())} onPress={()=>void findReference()}/><Each of={timingSources()} key={item=>item.id}>{item=><Button label={`${item().title} · ${formatTime(item().duration)}`} accessibilityLabel={`Read timing source ${item().title}`} variant="ghost" onPress={()=>{referenceUrl.set(item().id);void loadReference();}}/>}</Each><If when={progress()}><Notice>{progress()}</Notice></If><Input testID="reference-url" label="YouTube timing source" value={referenceUrl()} onChange={value=>referenceUrl.set(value)} placeholder="YouTube timing source (optional)"/><Button label="Read subtitles" disabled={!referenceUrl().trim()||Boolean(progress())} onPress={()=>void loadReference()}/><Text class="text-xs text-muted-foreground">Runtime</Text><Input testID="movie-runtime" label="Movie runtime" value={runtimeDraft()} onChange={value=>runtimeDraft.set(value)} placeholder="hh:mm:ss"/><If when={referenceRead()}><Notice>Check the cut and timecodes, then save.</Notice></If></View></If>
            <If when={editor()!=="range"} else={<View class="gap-2">
              <RangeField label="Movie position" id="range-movie" value={movieDraft()} onChange={value=>movieDraft.set(value)}/>
              <RangeField label="Clip in" id="range-in" value={inDraft()} onChange={value=>inDraft.set(value)}/>
              <RangeField label="Clip out" id="range-out" value={outDraft()} onChange={value=>outDraft.set(value)}/>
            </View>}><Textarea testID="subtitle-text" label={editor()==="reference"?"Movie subtitles":"Clip transcript"} value={text()} onChange={value=>text.set(value)} placeholder="SRT or WebVTT"/></If>
            <View class="flex-row gap-2"><Button label={editor()==="transcript"?"Match transcript":"Save"} onPress={saveEditor}/><Button label="Cancel" variant="ghost" onPress={()=>editor.set(null)}/></View></>}><AddClip onCancel={()=>editor.set(null)} onAdd={candidate=>{const existing=candidates().find(item=>item.id===candidate.id);if(!existing)mergeCandidates(ref,[candidate]);choose(existing??candidate);editor.set(null);inspector.set(false);}}/></If>
          </If>
          <If when={notice()}><Notice error>{notice()}</Notice></If>
        </View></Scroll>
      </View>
    </Sheet>
  </View>;
}
function RangeField(props:{label:string;id:string;value:string;onChange:(value:string)=>void}) {
  return <View class="gap-1"><Text class="text-xs text-muted-foreground">{props.label}</Text><Input testID={props.id} label={props.label} value={props.value} onChange={props.onChange} placeholder="hh:mm:ss"/></View>;
}
function CandidateCard(props:{movieTitle:string;candidate:Candidate;placement?:Placement;selected:boolean;onSelect:()=>void}) {
  return <BaseButton accessibilityLabel={`Preview ${props.candidate.title}`} selected={props.selected} onPress={props.onSelect}
    style={{width:188,height:44}} class={`flex-row gap-2 items-center mr-1 px-1 rounded hover:bg-muted active:bg-accent focus-visible:ring-2 focus-visible:ring-ring ${props.selected?"bg-accent":""}`}>
    <If when={isYouTubeCandidate(props.candidate)} else={<View class="w-16 h-9 items-center justify-center rounded bg-muted"><Text class="text-xs text-muted-foreground">{props.candidate.source?providerName(props.candidate.source.provider):"Clip"}</Text></View>}><Image src={`https://i.ytimg.com/vi/${props.candidate.id}/mqdefault.jpg`} accessibilityLabel={props.candidate.title} class="w-16 h-9 object-cover rounded bg-muted"/></If>
    <View class="flex-1 gap-0">
      <Text class="text-xs font-medium text-foreground" style={{numberOfLines:2,fontSize:11}}>{clipLabel(props.candidate.title,props.movieTitle)}</Text>
      <Text class="text-xs text-muted-foreground" style={{numberOfLines:1,fontSize:10}}>{props.placement?`${props.placement.state==="confirmed"?"Matched":"Review"} · ${formatTime(Math.floor(props.placement.movieStart))}`:props.candidate.channel}</Text>
    </View>
  </BaseButton>;
}
function RuntimeMap(props:{cuts:Cut[];runtime:number;selectedStart:number;onPick:(cut:Cut)=>void}) {
  const width=signal(700);
  return <View testID="runtime-map" class="h-1 rounded bg-muted overflow-hidden" onLayout={e=>width.set(e.bounds.size.width)}>
    <Each of={props.cuts} key={range=>`${range.start}:${range.end}:${range.videoId??"gap"}`}>
      {range=><BaseButton accessibilityLabel={`${range().videoId?"Scene":"Gap"} ${formatTime(Math.floor(range().start))} to ${formatTime(Math.floor(range().end))}`}
        onPress={()=>props.onPick(range())} class={`absolute top-0 bottom-0 hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring ${range().videoId?"bg-primary":"bg-muted"}`}
        selected={props.selectedStart===range().start} style={{left:props.runtime?width()*range().start/props.runtime:0,width:props.runtime?Math.max(1,width()*(range().end-range().start)/props.runtime):0}}/>}
    </Each>
  </View>;
}
/** Overlapping source clips get separate lanes; no coordinates for unplaced clips. */
function ClipTracks(props:{candidates:Candidate[];placements:Placement[];runtime:number;selected:string;onSelect:(candidate:Candidate)=>void}) {
  const width=signal(700);
  const tracks=computed(()=>{
    const ends:number[]=[];
    return [...props.placements].sort((a,b)=>a.movieStart-b.movieStart).flatMap(placement=>{
      const candidate=props.candidates.find(item=>item.id===placement.videoId);
      if(!candidate||!props.runtime)return [];
      let lane=ends.findIndex(end=>end<=placement.movieStart);if(lane<0)lane=ends.length;
      const end=Math.min(props.runtime,placement.movieStart+placement.videoEnd-placement.videoStart);ends[lane]=end;
      return [{candidate,placement,lane,end}];
    });
  });
  const height=()=>Math.max(0,...tracks().map(item=>(item.lane+1)*16));
  return <If when={tracks().length}><Scroll style={{height:Math.min(32,height())}} testID="scene-tracks">
    <View style={{height:height()}} onLayout={event=>width.set(event.bounds.size.width)}>
      <Each of={tracks()} key={item=>item.candidate.id}>{item=><BaseButton accessibilityLabel={`${item().placement.state==="confirmed"?"Matched":"Proposed"} ${item().candidate.title} at ${formatTime(Math.floor(item().placement.movieStart))}`}
        onPress={()=>props.onSelect(item().candidate)} selected={props.selected===item().candidate.id}
        class={`absolute rounded-sm hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring ${item().placement.state==="confirmed"?"bg-primary":"bg-muted-foreground/40"}`}
        style={{top:item().lane*16,height:12,left:width()*item().placement.movieStart/props.runtime,width:Math.max(2,width()*(item().end-item().placement.movieStart)/props.runtime),opacity:props.selected===item().candidate.id?1:0.65}}/>
      }</Each>
    </View>
  </Scroll></If>;
}

function clipLabel(name:string,title:string):string {
  const escaped=title.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  return name.replace(new RegExp(escaped,"gi"),"")
    .replace(/\(?\b(?:19|20)\d{2}\b\)?/g,"")
    .replace(/\bmovie\s+clips?\b/gi,"").replace(/\(\s*\)/g,"")
    .replace(/^[\s|:–—-]+|[\s|:–—-]+$/g,"").replace(/\s{2,}/g," ").trim()||name;
}

function ClipActions(props:{count:number;percent?:number;canPlay:boolean;onPlay:()=>void;hasNext:boolean;onNext:()=>void;onRestore?:()=>void}) {
  return <View class="flex-row items-center gap-1">
    <Text class="text-xs text-muted-foreground">{props.count} clips</Text>
    <If when={props.percent!==undefined}><Text class="text-xs text-muted-foreground">{props.percent}% matched</Text></If>
    <Button label="▶ matched" accessibilityLabel="Play matched" variant="ghost" disabled={!props.canPlay} onPress={props.onPlay}/>
    <Button label="›" accessibilityLabel="Next clip" variant="ghost" disabled={!props.hasNext} onPress={props.onNext}/>
    <If when={props.onRestore}><Button label="⤡" accessibilityLabel="Exit immersive view" variant="ghost" onPress={()=>props.onRestore?.()}/></If>
  </View>;
}

function subtitleTime(seconds:number) {
  const ms=Math.round(Math.max(0,seconds)*1000);
  return `${formatTime(Math.floor(ms/1000))},${String(ms%1000).padStart(3,"0")}`;
}
