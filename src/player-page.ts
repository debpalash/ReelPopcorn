import { PROVIDER_BUNDLES } from "./generated/player-bundles.ts";
import {providerName,type MediaProvider } from "./media/source.ts";

// Stable app identity supplies the provider embeds' referrer/origin.
export const APP_ORIGIN = "https://io.github.debpalash.reelpopcorn";
export function playerPage(provider:MediaProvider,controls=false):string {
  const bundle=PROVIDER_BUNDLES[provider];
  if(!bundle)throw new Error("Unsupported media provider.");
  const script=bundle.replace(/<\/script/gi,"<\\/script");
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="strict-origin-when-cross-origin">
<style>html,body,#player{margin:0;width:100%;height:100%;overflow:hidden;background:#000}#player{display:flex;align-items:center;justify-content:center}youtube-video,vimeo-video,twitch-video,tiktok-video{display:block;width:100%;height:100%;min-width:0!important;min-height:0!important}spotify-audio{display:block;width:100%;height:352px;max-height:100%;min-height:80px}</style>
</head><body><div id="player"></div><script>window.theaterConfig=${JSON.stringify({provider,controls,origin:APP_ORIGIN})};${script}</script></body></html>`;
}
export function playerError(provider:MediaProvider,value:{code?:number;message?:string}):string {
  if(provider==="youtube") {
    if(value.code===100)return "This video is private, removed, or unavailable.";
    if(value.code===101||value.code===150)return "The owner doesn’t allow embedded playback. Open on YouTube.";
    if(value.code===153)return "YouTube couldn’t verify this app. Open on YouTube.";
  }
  return `Couldn’t play this source. Reload or open on ${providerName(provider)}.`;
}
