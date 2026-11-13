import { signal, Text, View } from "nsh";
import { Button, Input, Notice } from "../ui";
import { mediaKey, parseMediaSource, providerName } from "../media/source";
import { parseTime } from "../tmdb/model";
import type { Candidate } from "./model";

export function AddClip(props:{onAdd:(candidate:Candidate)=>void;onCancel:()=>void}) {
  const link=signal(""),name=signal(""),duration=signal(""),error=signal("");
  const add=()=>{
    const source=parseMediaSource(link());
    if(!source){error.set(/clips\.twitch\.tv|twitch\.tv\/[^/]+\/clip\//i.test(link())?"Twitch Clips aren’t supported. Use a video or channel URL.":"Use a YouTube, Vimeo, Twitch, TikTok or Spotify link.");return;}
    const seconds=duration().trim()?parseTime(duration()):0;
    if(seconds===null||seconds>86400){error.set("Use mm:ss or hh:mm:ss for the duration.");return;}
    props.onAdd({id:mediaKey(source),title:name().trim().slice(0,500)||`${providerName(source.provider)} · ${source.id}`,channel:providerName(source.provider),description:"",duration:seconds,provider:"manual",identity:"review",source});
  };
  return <View class="gap-3">
    <Input testID="clip-url" label="Clip URL" placeholder="YouTube, Vimeo, Twitch, TikTok, Spotify" value={link()} onChange={value=>{link.set(value);error.set("");}} onSubmit={add}/>
    <Input testID="clip-name" label="Clip name" placeholder="Name (optional)" value={name()} onChange={value=>name.set(value)}/>
    <Input testID="clip-duration" label="Clip duration" placeholder="Duration (optional) · mm:ss" value={duration()} onChange={value=>duration.set(value)}/>
    <Text class="text-xs text-muted-foreground">Unplaced until matched.</Text>
    <If when={error()}><Notice error>{error()}</Notice></If>
    <View class="flex-row gap-2"><Button label="Add" onPress={add}/><Button label="Cancel" variant="ghost" onPress={props.onCancel}/></View>
  </View>;
}
