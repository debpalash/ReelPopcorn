import {spawn, spawnSync} from 'node:child_process';
import {resolve} from 'node:path';

const target = {darwin: 'macos', win32: 'windows', linux: 'linux'}[process.platform];
const executable = resolve('dist/native', target, target === 'macos' ? 'ReelPopcorn.app/Contents/MacOS/ReelPopcorn' : `ReelPopcorn/ReelPopcorn${target === 'windows' ? '.exe' : ''}`);
const child = spawn(executable, [], {stdio: ['ignore', 'pipe', 'pipe']});
let output = '', exited = false, failure;
child.stdout.on('data', data => {output += data;});
child.stderr.on('data', data => {output += data;});
child.on('error', error => {failure = error;});
child.on('exit', (code, signal) => {exited = true; failure = new Error(`App exited before startup check: ${code ?? signal}`);});
await new Promise(resolve => setTimeout(resolve, 6000));
try {
  if (failure) throw failure;
  if (/bundle failed|uncaught|cannot read property|error while loading shared libraries|segmentation fault|panicked at/i.test(output)) throw new Error(output);
  console.log(`Packaged ${target} app remained running for the startup check. Playback was not tested.`);
} finally {
  if (!exited && child.pid) {
    if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {stdio: 'ignore'});
    else child.kill('SIGKILL');
  }
  if (output) console.log(output.slice(-6000));
}
