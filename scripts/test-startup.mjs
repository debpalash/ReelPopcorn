import {build} from 'esbuild';
import vm from 'node:vm';
import assert from 'node:assert/strict';
// Exercise the real state module's startup path with the process API the host supplies.
for(const environment of [undefined,{}, {TMDB_READ_TOKEN:'test-session-token'}]) {
 const bundle=await build({stdin:{contents:`import {tmdbConnection} from './src/tmdb/state.ts'; globalThis.connection=tmdbConnection();`,resolveDir:process.cwd()},bundle:true,write:false,format:'iife',platform:'neutral',plugins:[{name:'host-fixture',setup(api){
  api.onResolve({filter:/^(nsh|process)$/},args=>({path:args.path,namespace:'host-fixture'}));
  api.onLoad({filter:/.*/,namespace:'host-fixture'},args=>({contents:args.path==='process'?`export default {env:${JSON.stringify(environment)??'undefined'}};`:`export const signal=initial=>{let value=initial;const read=()=>value;read.set=next=>value=next;read.update=update=>value=update(value);return read;};export const batch=fn=>fn();export const Storage={};`}));
 }}]});
 const context={};vm.runInNewContext(bundle.outputFiles[0].text,context);
 assert.equal(context.connection.mode,environment?.TMDB_READ_TOKEN?'direct':'guest');
}
console.log('Startup: guest mode survives missing process.env; optional session token still works');
