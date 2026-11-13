import {parseMediaSource,mediaKey,mediaCapabilities} from './source.ts';

/** Runs only inside WKWebView. The native app talks to this small transport. */
export function installBridge({provider,tag}) {
  const config=window.theaterConfig||{};
  const root=document.getElementById('player');
  let media=null, session=null, removeListeners=()=>{}, lastProgress=0, pendingPause=false;
  const fit=()=>{
    if(provider!=="tiktok"||!media||!root.getBoundingClientRect)return;
    const bounds=root.getBoundingClientRect(),scale=Math.min(bounds.width/325,bounds.height/578);
    if(scale>0){media.style.width="325px";media.style.height="578px";media.style.flexShrink="0";media.style.transform=`scale(${scale})`;}
  };
  const observer=typeof ResizeObserver!=="undefined"?new ResizeObserver(fit):null;
  observer?.observe(root);window.addEventListener("resize",fit);
  const report=(type,value,current=session)=>{
    window.nsh?.postMessage(JSON.stringify({type,value,provider,id:current?.id,request:current?.request}));
  };
  const matches=current=>{
    if(!current||session!==current||!media)return false;
    if(provider==='youtube'){
      const actual=media.engine?.getVideoData?.()?.video_id;
      if(actual&&actual!==current.source.id)return false;
    }
    return true;
  };
  const read=()=>({seconds:Number.isFinite(media?.currentTime)?media.currentTime:0,duration:Number.isFinite(media?.duration)?media.duration:0,muted:Boolean(media?.muted)});
  const fail=(error,current=session)=>{
    if(!current||current!==session)return;
    const code=error?.data?.youtubeErrorCode;
    report('error',{code:typeof code==='number'?code:undefined,message:String(error?.message||'Playback unavailable.').slice(0,500)},current);
  };
  const play=current=>{
    if(!matches(current))return;
    pendingPause=false;
    try{Promise.resolve(media.play()).catch(error=>{
      if(session!==current)return;
      if(error?.name==='NotAllowedError')report('blocked',true,current);else fail(error,current);
    });}catch(error){fail(error,current);}
  };
  const pause=()=>{pendingPause=true;try{media?.pause();}catch{}};
  const finish=current=>{
    if(!matches(current)||current.finished)return;
    current.finished=true;pause();report('state',0,current);
  };
  const metadata=current=>{
    if(!matches(current))return;
    if(!current.started&&media.readyState>=1){
      current.started=true;
      if(current.start>0&&current.caps.seek)try{media.currentTime=current.start;}catch{}
    }
    if(!current.started)return;
    const info=read();
    if(!current.hasMetadata||info.duration!==current.duration){current.hasMetadata=true;current.duration=info.duration;report('metadata',info,current);}
    if(pendingPause||current.paused)pause();
  };
  const progress=(current,force=false)=>{
    if(!matches(current)||!current.started)return;
    const info=read();
    if(current.end!==undefined&&info.seconds>=current.end){finish(current);return;}
    if(force||Date.now()-lastProgress>=250){lastProgress=Date.now();report('progress',info,current);}
  };
  const listen=current=>{
    const handlers={
      loadedmetadata:()=>metadata(current),durationchange:()=>metadata(current),loadcomplete:()=>metadata(current),
      playing:()=>{if(!matches(current)||current.finished)return;metadata(current);if(pendingPause||current.paused){pause();return;}report('state',1,current);},
      pause:()=>{if(matches(current)&&!current.finished)report('state',2,current);},
      waiting:()=>{if(matches(current))report('state',3,current);},
      ended:()=>finish(current),
      offline:()=>{if(matches(current))report("state",4,current);},
      online:()=>{if(matches(current))report("state",3,current);},
      timeupdate:()=>{metadata(current);progress(current);},
      volumechange:()=>progress(current,true),
      error:()=>{if(matches(current))fail(media.error,current);}
    };
    const target=media;
    for(const [type,handler]of Object.entries(handlers))target.addEventListener(type,handler);
    removeListeners=()=>{for(const [type,handler]of Object.entries(handlers))target.removeEventListener(type,handler);};
  };
  const load=command=>{
    const source=parseMediaSource(command.source?.url||'');
    if(!source||source.provider!==provider||command.id!==mediaKey(source)||!Number.isSafeInteger(command.request)||command.request<1)return;
    const caps=mediaCapabilities(source);
    const minimum=Number.isFinite(command.minimumSeconds)?Math.max(0,command.minimumSeconds):0;
    const start=Number.isFinite(command.startSeconds)?Math.max(minimum,command.startSeconds):minimum;
    const end=caps.timeline&&Number.isFinite(command.endSeconds)&&command.endSeconds>start?command.endSeconds:undefined;
    const previous=session;
    removeListeners();
    // YouTube can replace its source through its API without rebuilding the iframe.
    // Other providers get a fresh adapter so old asynchronous events cannot own a new clip.
    if(media&&(provider!=='youtube'||previous?.controls!==Boolean(config.controls))){
      try{media.pause();}catch{}
      media.remove();media=null;
    }
    const fresh=!media;
    if(fresh){
      media=document.createElement(tag);
      media.id='media';
      media.setAttribute('playsinline','');media.setAttribute('preload','metadata');
      media.setAttribute('referrerpolicy','strict-origin-when-cross-origin');
      if(config.controls||provider==='spotify')media.setAttribute('controls','');
    }
    media.autoplay=!command.paused;
    session={id:command.id,request:command.request,source,caps,minimum,start,end,paused:Boolean(command.paused),controls:Boolean(config.controls),finished:false,started:false,duration:0,hasMetadata:false};
    pendingPause=session.paused;lastProgress=0;
    listen(session);
    let url=source.url;
    if(provider==='youtube'){
      const link=new URL(url);link.searchParams.set('t',String(start));url=link.toString();
      media.source={src:url,engine:{youtube:{origin:config.origin,iv_load_policy:3,rel:0}}};
    }else if(provider==='twitch')media.source={src:url,engine:{twitch:{parent:[new URL(config.origin).hostname]}}};
    else media.source={src:url};
    if(fresh)root.appendChild(media);
    fit();
    report('capabilities',caps);report('state',3);
    // Equal URLs intentionally skip an adapter reload; a new range still needs to arm.
    metadata(session);
    if(!session.paused)play(session);
  };
  window.theater=command=>{
    if(!command||typeof command!=='object')return;
    if(command.type==='load'){load(command);return;}
    const current=session;
    if(!current||command.request!==current.request)return;
    if(command.type==='pause'){current.paused=true;pause();}
    else if(command.type==='toggle'){
      if(media.paused||current.finished){if(current.finished&&current.caps.seek)media.currentTime=current.start;current.paused=false;current.finished=false;play(current);}
      else{current.paused=true;pause();}
    }else if(command.type==='mute'&&current.caps.mute){try{media.muted=!media.muted;}catch(error){fail(error,current);}}
    else if(command.type==='seek'&&current.caps.seek&&Number.isFinite(command.seconds)){
      const max=current.end??(Number.isFinite(media.duration)&&media.duration>0?media.duration:Infinity);
      try{current.finished=false;media.currentTime=Math.max(current.minimum,Math.min(max,command.seconds));progress(current,true);}catch(error){fail(error,current);}
    }else if(command.type==='rate'&&current.caps.rate&&[0.5,0.75,1,1.25,1.5,2].includes(command.value)){
      try{media.playbackRate=command.value;}catch(error){fail(error,current);}
    }else if(command.type==='volume'&&current.caps.volume&&Number.isFinite(command.value)){
      try{media.volume=Math.max(0,Math.min(1,command.value));}catch(error){fail(error,current);}
    }
  };
  const timer=setInterval(()=>progress(session),100);
  window.addEventListener('pagehide',()=>{clearInterval(timer);observer?.disconnect();pause();removeListeners();});
  report('ready',true);
}
