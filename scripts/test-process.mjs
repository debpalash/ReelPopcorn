import {build} from 'esbuild';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {desktopConfig} from './desktop-config.mjs';

const source = JSON.parse(readFileSync('nsh.json', 'utf8'));
assert.ok(source.capabilities.process.execute.every(command => !/[\\/:]/.test(command)), 'Source manifest must parse on Windows');
for (const [platform, expected] of [['windows', 'yt-dlp.exe'], ['linux', 'yt-dlp'], ['macos', '/opt/homebrew/bin/yt-dlp']]) {
  const config = desktopConfig(source, platform);
  if (platform === 'windows') assert.ok(config.capabilities.process.execute.every(command => !/[\\/:]/.test(command)));
  const calls = [];
  const bundled = await build({
    stdin: {contents: `export {discoveryBackend} from './src/scenes/discovery.ts';`, resolveDir: process.cwd()},
    bundle: true, write: false, format: 'cjs', platform: 'neutral',
    plugins: [{name: 'native-process', setup(api) {
      api.onResolve({filter: /nsh\.json$/}, () => ({path: 'config', namespace: 'config'}));
      api.onLoad({filter: /.*/, namespace: 'config'}, () => ({contents: JSON.stringify(config), loader: 'json'}));
      api.onResolve({filter: /^process$/}, () => ({path: 'process', namespace: 'fixture'}));
      api.onLoad({filter: /.*/, namespace: 'fixture'}, () => ({contents: 'export default globalThis.nativeProcess;'}));
    }}],
  });
  const context = {
    module: {exports: {}}, URL, AbortController, setTimeout, clearTimeout,
    nativeProcess: {platform, spawn(command, args) {
      calls.push({command, args});
      const handlers = {};
      const child = {kill() {}, on(event, handler) {handlers[event] = handler; return child;}};
      queueMicrotask(() => {
        handlers.stdout?.(JSON.stringify({entries: [{id: '60h6lpnSgck', title: 'Interstellar Scene', channel: 'Paramount Movies', duration: 494}]}));
        handlers.exit?.({code: 0});
      });
      return child;
    }},
  };
  vm.runInNewContext(bundled.outputFiles[0].text, context);
  const items = await context.module.exports.discoveryBackend({provider: 'yt-dlp', instance: ''}).videos('Interstellar clip');
  assert.equal(calls[0].command, expected, `${platform} executable lookup`);
  assert.ok(config.capabilities.process.execute.includes(expected), `${platform} executable grant`);
  assert.ok(calls[0].args.includes('--skip-download'));
  assert.equal(items[0].id, '60h6lpnSgck');
}
console.log('Discovery process: Windows, Linux and macOS executable lookup and grants pass');
