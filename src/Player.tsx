import { cleanup, computed, effect, lifecycle, openUrl, signal, untracked, Text, View, WebView, type JSX, type WebViewRef } from "nsh";
import { Menu } from "nsh/desktop";
import { Slider } from "nsh/base";
import { APP_ORIGIN, playerPage, playerError } from "./player-page";
import { videoSource, watchUrl, type Video } from "./video";
import { mediaCapabilities, providerName, sourceStart } from "./media/source";
import volumeIcon from "../assets/volume.svg";
import mutedIcon from "../assets/muted.svg";
import { Button, Notice } from "./ui";

export function Player(props:{title?:string;author?:string;video:Video|null;onNext?:()=>void;onEnded?:()=>void;hasNext?:boolean;theater?:boolean;paused?:boolean;fill?:boolean;footer?:JSX.Element;onDuration?:(id:string,duration:number)=>void}) {
  const source=computed(()=>props.video?videoSource(props.video):null);
  const provider=()=>source()?.provider??"youtube";
  const name=()=>providerName(provider());
  const sourceKey=computed(()=>props.video?JSON.stringify({id:props.video.id,source:source(),start:props.video.startSeconds??sourceStart(source()!),end:props.video.endSeconds}):null);
  const ready=signal(false),playing=signal(false),muted=signal(false),originalControls=signal(false);
  const position=signal(0),duration=signal(0),seeking=signal(false),width=signal(640);
  const caps=computed(()=>mediaCapabilities(source()??{provider:"youtube",id:"",url:"",kind:"video"}));
  const status=signal("Loading…"),error=signal("");
  const page=computed(()=>playerPage(provider(),!props.fill||originalControls()||provider()==="spotify"));
  let web:WebViewRef|undefined,request=0;
  let resume:{id:string;seconds:number}|undefined;
  let timeout:ReturnType<typeof setTimeout>|undefined;
  const clearDeadline=()=>{if(timeout!==undefined)clearTimeout(timeout);};
  const deadline=()=>{clearDeadline();timeout=setTimeout(()=>error.set(`${name()} is taking longer than expected. Reload or open the source.`),20000);};
  const send=(command:object)=>web?.injectJavaScript(`window.theater && window.theater(${JSON.stringify({...command,request})});`);
  const remember=()=>{if(props.video)resume={id:props.video.id,seconds:position()};ready.set(false);playing.set(false);};
  const reload=()=>{remember();error.set("");deadline();web?.reload();};
  const external=()=>{if(props.video)void openUrl(watchUrl({...props.video,startSeconds:Math.floor(position())})).then(result=>{if(!result.opened)error.set("Couldn’t open your browser.");}).catch(()=>error.set("Couldn’t open your browser."));};
  const minimum=()=>props.video?.startSeconds??(source()?sourceStart(source()!):0);
  const maximum=()=>Math.max(minimum()+1,Math.min(props.video?.endSeconds??Infinity,duration()||Infinity));
  const seek=(seconds:number)=>{const value=Math.max(minimum(),Math.min(maximum(),seconds));position.set(value);send({type:"seek",seconds:value});};
  const options=()=>{void Menu.popup([
    provider()!=="spotify"&&{label:originalControls()?"Compact controls":`${name()} controls`,onSelect:()=>{remember();originalControls.set(!originalControls());deadline();}},
    caps().rate&&{label:"Speed",submenu:[0.5,0.75,1,1.25,1.5,2].map(value=>({label:`${value}×`,onSelect:()=>send({type:"rate",value})}))},
    caps().volume&&{label:"Volume",submenu:[0.25,0.5,1].map(value=>({label:`${Math.round(value*100)}%`,onSelect:()=>send({type:"volume",value})}))},
    {label:`Open on ${name()}`,onSelect:external},
    {label:"Reload",onSelect:reload}
  ]);};
  effect(()=>{
    const key=sourceKey();
    if(!ready()||!key)return;
    untracked(()=>{
    const item=JSON.parse(key);
    const start=resume&&resume.id===item.id?Math.max(item.start,resume.seconds):item.start;
    resume=undefined;request++;playing.set(false);error.set("");status.set("Loading…");position.set(start);duration.set(0);seeking.set(false);
    send({type:"load",id:item.id,source:item.source,startSeconds:start,minimumSeconds:item.start,endSeconds:item.end,paused:Boolean(props.paused)});
    deadline();
    });
  });
  effect(()=>{if((lifecycle()==="background"||props.paused)&&ready())send({type:"pause"});});
  cleanup(clearDeadline);
  deadline();
  return <View class={props.fill?"flex-1 bg-player":"gap-3"} onLayout={event=>width.set(event.bounds.size.width)}>
    <WebView ref={node=>{web=node;}} testID="media-player" html={page()} baseUrl={`${APP_ORIGIN}/`} scrollable={false}
      class={props.fill?"flex-1 bg-player":"bg-player"} style={props.fill?{minHeight:200}:{height:Math.max(200,width()*9/16)}}
      onLoadStart={()=>{ready.set(false);deadline();}}
      onError={()=>{clearDeadline();error.set(`Couldn’t connect to ${name()}. Reload or open the source.`);}}
      onMessage={event=>{
        try{
          const message=JSON.parse(event.data);
          if(message.provider!==provider())return;
          if(message.type==="ready"){ready.set(true);return;}
          if(message.request!==request||message.id!==props.video?.id)return;
          if(message.type==="metadata"){clearDeadline();if(!playing()&&status()==="Loading…")status.set(caps().live?"Live":"Ready");}
          if(message.type==="metadata"||message.type==="progress"){
            if(Number.isFinite(message.value?.seconds)&&message.value.seconds>=0&&!seeking())position.set(message.value.seconds);
            if(Number.isFinite(message.value?.duration)&&message.value.duration>0){
              duration.set(message.value.duration);
              if(message.type==="metadata"){clearDeadline();props.onDuration?.(message.id,message.value.duration);}
            }
            if(typeof message.value?.muted==="boolean")muted.set(message.value.muted);
          }
          if(message.type==="error"){clearDeadline();error.set(playerError(provider(),message.value??{}));}
          if(message.type==="blocked"){clearDeadline();status.set("Press Play");playing.set(false);}
          if(message.type==="state"){
            if([0,1,2,4,5].includes(message.value))clearDeadline();
            playing.set(message.value===1);if(message.value===1)error.set("");
            status.set(message.value===1?`Playing on ${name()}`:message.value===2?"Paused":message.value===0?"Finished":message.value===4?"Offline":"Loading…");
            if(message.value===1&&(lifecycle()==="background"||props.paused))send({type:"pause"});
            if(message.value===0&&lifecycle()!=="background"){if(props.onEnded)props.onEnded();else props.onNext?.();}
          }
        }catch{/* Ignore messages outside the player protocol. */}
      }}/>
    <If when={props.fill}>
      <View class="flex-row items-center gap-1 px-2 bg-background border-t border-border" style={{height:28}} testID="native-playback-controls">
        <If when={!originalControls()}>
          <Button label={playing()?"Ⅱ":"▶"} accessibilityLabel={playing()?"Pause":"Play"} variant="ghost" disabled={!ready()||props.paused} onPress={()=>send({type:"toggle"})}/>
          <Text class="text-xs text-muted-foreground" style={{minWidth:72}}>{caps().live?"Live":duration()?`${clock(position())} / ${clock(duration())}`:"Loading…"}</Text>
          <Slider class="flex-1" testID="playback-seek" accessibilityLabel="Playback position" min={minimum()} max={Number.isFinite(maximum())?maximum():minimum()+1} value={position()} step={0}
            disabled={!ready()||!duration()||!caps().seek} trackClass="h-6 justify-center" indicatorClass="h-0.5 rounded bg-muted" rangeClass="bg-foreground rounded" thumbClass="w-2 h-2 rounded-full bg-foreground focus:ring-2 focus:ring-ring"
            onChange={event=>{seeking.set(true);position.set(Number(event.value));}} onChangeEnd={event=>{seek(Number(event.value));seeking.set(false);}}/>
          <If when={caps().mute}><Button label={muted()?"Unmute":"Mute"} icon={muted()?mutedIcon:volumeIcon} variant="ghost" disabled={!ready()} onPress={()=>send({type:"mute"})}/></If>
        </If>
        <If when={originalControls()}><View class="flex-1"/></If>
        <Button label="⋯" accessibilityLabel="Playback options" variant="ghost" onPress={options}/>
        {props.footer}
      </View>
    </If>
    <If when={!props.theater}><Text class="text-xl font-semibold text-foreground" style={{numberOfLines:2}}>{props.title??props.video?.title}</Text></If>
    <If when={!props.fill}><View class="flex-row items-center justify-between gap-3">
      <If when={!props.theater}><Text class="text-sm text-muted-foreground">{props.author??props.video?.author}</Text></If>
      <Text class="text-sm text-muted-foreground">{status()}</Text>
    </View></If>
    <If when={error()}><Notice error>{error()}</Notice></If>
    <If when={!props.fill||Boolean(error())}><View class="flex-row gap-2 flex-wrap px-2">
      <Button label={`Open on ${name()}`} onPress={external}/>
      <Button label={props.theater?"Reload":"Reload player"} variant="ghost" onPress={reload}/>
      <Button label={props.theater?"Next":"Play next"} variant="ghost" disabled={!props.hasNext} onPress={()=>props.onNext?.()}/>
    </View></If>
  </View>;
}
function clock(seconds:number){const value=Math.max(0,Math.floor(seconds));return `${Math.floor(value/60)}:${String(value%60).padStart(2,"0")}`;}
