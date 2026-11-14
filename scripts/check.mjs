import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

process.chdir(fileURLToPath(new URL('../', import.meta.url)));
for (const [command, args] of [
  [process.execPath, ['scripts/build-player.mjs']],
  ['nsh', ['check']],
  ['nsh', ['build']],
  ['nsh', ['test']],
  [process.execPath, ['scripts/test-player.mjs']],
  [process.execPath, ['scripts/test-startup.mjs']],
  [process.execPath, ['scripts/test-process.mjs']],
]) {
  const result = spawnSync(command, args, {stdio: 'inherit'});
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
