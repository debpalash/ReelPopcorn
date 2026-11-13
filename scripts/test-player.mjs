import assert from 'node:assert/strict';
import {installBridge} from '../src/media/browser-bridge.js';
import {parseMediaSource,mediaKey} from '../src/media/source.ts';
import {playerPage,APP_ORIGIN} from '../src/player-page.ts';

// Exercise the actual native/WebView transport with media events at the adapter seam.
function harness(provider,controls=false) {
 const messages=[],created=[],calls=[];let tick;
 class Media extends EventTarget {
  paused=true;readyState=0;duration=120;currentTime=0;muted=false;volume=1;playbackRate=1;
  attributes={};actualId='';
  engine={getVideoData:()=>({video_id:this.actualId})};
  setAttribute(key,value){this.attributes[key]=value;}
  set source(value){this.loaded=value;calls.push(['load',value]);}
  get source(){return this.loaded;}
  play(){this.paused=false;calls.push(['play']);return Promise.resolve();}
  pause(){this.paused=true;calls.push(['pause']);this.dispatchEvent(new Event('pause'));}
  remove(){calls.push(['remove']);}
  emit(type){this.dispatchEvent(new Event(type));}
 }
 globalThis.window={theaterConfig:{provider,controls,origin:APP_ORIGIN},nsh:{postMessage:text=>messages.push(JSON.parse(text))},addEventListener(){}};
 globalThis.document={getElementById:()=>({appendChild:media=>calls.push(['append',media])}),createElement:tag=>{const media=new Media();media.tag=tag;created.push(media);return media;}};
 const original=globalThis.setInterval;globalThis.setInterval=callback=>{tick=callback;return 0;};
 installBridge({provider,tag:{youtube:'youtube-video',vimeo:'vimeo-video',twitch:'twitch-video',tiktok:'tiktok-video',spotify:'spotify-audio'}[provider]});
 globalThis.setInterval=original;
 return {messages,created,calls,tick:()=>tick(),send:command=>window.theater(command),load:(url,request=1,extra={})=>{const source=parseMediaSource(url);window.theater({type:'load',source,id:mediaKey(source),request,...extra});return created.at(-1);}};
}
let app=harness('youtube');
assert.equal(app.messages.at(-1).type,'ready');
let media=app.load('https://www.youtube.com/watch?v=aqz-KE-bpKQ',1,{startSeconds:20,minimumSeconds:10,endSeconds:30});
assert.equal(media.tag,'youtube-video');assert.equal(media.attributes.controls,undefined);
assert.equal(media.source.engine.youtube.origin,APP_ORIGIN);
media.actualId='aqz-KE-bpKQ';media.readyState=1;media.emit('loadedmetadata');
assert.equal(media.currentTime,20);assert.equal(app.messages.at(-1).type,'metadata');
media.paused=false;media.emit('playing');assert.equal(app.messages.at(-1).value,1);
app.send({type:'seek',seconds:2,request:1});assert.equal(media.currentTime,10);
app.send({type:'seek',seconds:80,request:1});assert.equal(media.currentTime,30);
assert.equal(app.messages.filter(message=>message.type==='state'&&message.value===0).length,1);
media.emit('ended');assert.equal(app.messages.filter(message=>message.type==='state'&&message.value===0).length,1);
app.send({type:'mute',request:1});assert.equal(media.muted,true);
app.send({type:'rate',value:1.5,request:1});assert.equal(media.playbackRate,1.5);
app.send({type:'volume',value:0.25,request:1});assert.equal(media.volume,0.25);
const before=media.currentTime;app.send({type:'seek',seconds:NaN,request:1});assert.equal(media.currentTime,before);
app.send({type:'seek',seconds:12,request:0});assert.equal(media.currentTime,before);
app.load('https://www.youtube.com/watch?v=aqz-KE-bpKQ',2,{startSeconds:20,minimumSeconds:10,endSeconds:25});
media.currentTime=25;app.tick();
assert.equal(app.messages.at(-1).value,0);assert.equal(app.messages.at(-1).request,2);
app.send({type:'toggle',request:2});assert.equal(media.currentTime,20);
app.load('https://www.youtube.com/watch?v=M7lc1UVf-VE',3);
assert.equal(app.created.length,1); // Retain YouTube's iframe between clips.
const count=app.messages.length;media.emit('ended');assert.equal(app.messages.length,count); // Late event from prior video.
media.actualId='M7lc1UVf-VE';media.currentTime=5;media.emit('loadedmetadata');app.tick();
assert.equal(app.messages.at(-1).id,'M7lc1UVf-VE');assert.equal(app.messages.at(-1).request,3);
app=harness('vimeo');media=app.load('https://vimeo.com/76979871');media.readyState=1;media.emit('loadedmetadata');
assert.equal(media.tag,'vimeo-video');const old=media;
app.load('https://vimeo.com/123456789',2);const oldCount=app.messages.length;old.emit('ended');assert.equal(app.messages.length,oldCount);
app=harness('twitch');media=app.load('https://www.twitch.tv/monstercat');
assert.deepEqual(media.source.engine.twitch.parent,[new URL(APP_ORIGIN).hostname]);
app.send({type:'seek',seconds:50,request:1});assert.equal(media.currentTime,0);
media.readyState=1;media.duration=Infinity;media.emit('loadedmetadata');assert.equal(app.messages.at(-1).type,'metadata');assert.equal(app.messages.at(-1).value.duration,0);
media.emit('offline');assert.equal(app.messages.at(-1).value,4);
app=harness('tiktok');media=app.load('https://www.tiktok.com/@user/video/7527476667770522893');app.send({type:'rate',value:2,request:1});assert.equal(media.playbackRate,1);
app=harness('spotify');media=app.load('https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC');
assert.equal(media.attributes.controls,'');app.send({type:'mute',request:1});assert.equal(media.muted,false);
for(const provider of ['youtube','vimeo','twitch','tiktok','spotify']){
 const html=playerPage(provider,false);assert.ok(html.includes(`"provider":"${provider}"`));assert.ok(!html.includes('cdn.jsdelivr.net'));assert.ok(!html.includes('react-dom'));
}
console.log('Video.js bridge: provider loading, controls, ranges, stale events and capabilities passed');
