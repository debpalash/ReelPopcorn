// Opt-in live audit: node scripts/audit-discovery.mjs [title] [year]
// Exercises the app's actual discovery/caption code using Node's child-process adapter.
import {build} from 'esbuild';
import {writeFile,mkdir} from 'node:fs/promises';
const root=process.cwd();
const built=await build({stdin:{contents:`export {discoverScenes,clipCaptions,videoMetadata} from './src/scenes/discovery';export {alignTranscript,indexReference} from './src/scenes/alignment';`,resolveDir:root},bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'native-process',setup(b){
 b.onResolve({filter:/^process$/},()=>({path:'process',namespace:'native-process'}));
 b.onLoad({filter:/.*/,namespace:'native-process'},()=>({contents:`import {spawn} from 'node:child_process';export default {spawn(command,args,options){const child=spawn(command,args,{timeout:options.timeoutMs});return {kill(){child.kill()},on(event,fn){if(event==='exit'){child.on('close',code=>fn({code}));child.on('error',error=>fn({code:1,error:error.message}));}else child[event].on('data',data=>fn(String(data)));return this;}}}};`}));
}}]});
const {discoverScenes,clipCaptions,videoMetadata,alignTranscript,indexReference}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
const title={kind:'movie',id:0,title:process.argv[2]??'Interstellar',originalTitle:process.argv[2]??'Interstellar',date:(process.argv[3]??'2014')+'-01-01',overview:'',poster:null,backdrop:null,rating:0};
const options={provider:'yt-dlp',instance:'https://inv.nadeko.net'};
let last;
const items=await discoverScenes(title,options,undefined,{onProgress:value=>{last=value;console.log(`${value.searched.length} queries · ${value.scanned} uploads · ${value.items.length} candidates`);}});
const report={title:title.title,year:title.date.slice(0,4),checkedAt:new Date().toISOString(),...last,items};
await mkdir('artifacts/discovery-audit',{recursive:true});
await writeFile(`artifacts/discovery-audit/${title.title.toLowerCase().replace(/[^a-z0-9]+/g,'-')}-deep.json`,JSON.stringify(report,null,2));
console.log(items.slice(0,10).map(item=>item.title).join('\n'));
// Reference ID is an explicit same-cut source; no runtime or offset is guessed.
if(process.env.THEATER_REFERENCE_ID){
 const captions=await clipCaptions(process.env.THEATER_REFERENCE_ID,options);
 const runtime=(await videoMetadata(process.env.THEATER_REFERENCE_ID,options)).duration;
 const reference=indexReference(captions),matches=[];
 for(const item of items.slice(0,6))try {
  const cues=await clipCaptions(item.id,options);
  const match=alignTranscript(reference,cues,item.id,item.duration,runtime);
  matches.push({id:item.id,title:item.title,match});console.log('Timing',item.id,match??'unplaced');
 }catch(error){matches.push({id:item.id,error:error.message});console.log('Captions',item.id,error.message);}
 await writeFile('artifacts/discovery-audit/live-alignment.json',JSON.stringify({referenceId:process.env.THEATER_REFERENCE_ID,runtime,matches},null,2));
}
