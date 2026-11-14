import {spawnSync} from 'node:child_process';
import {cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

process.chdir(fileURLToPath(new URL('../', import.meta.url)));
const target = {darwin: 'macos', win32: 'windows', linux: 'linux'}[process.platform];
if (!target || !((target === 'macos' && process.arch === 'arm64') || (target !== 'macos' && process.arch === 'x64'))) {
  throw new Error('Prebuilt releases require macOS arm64, Windows x64 or Linux x64.');
}
const config = JSON.parse(readFileSync('nsh.json', 'utf8'));
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
if (config.version !== pkg.version) throw new Error('Package and app versions differ.');
function run(command, args, options = {}) {
  const result = spawnSync(command, args, {stdio: 'inherit', ...options});
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status ?? result.signal}).`);
}
run(process.execPath, ['scripts/build-player.mjs']);
const native = resolve('dist/native', target);
run('nsh', ['package', '--target', target, '--out', native]);
const staging = mkdtempSync(join(tmpdir(), 'reelpopcorn-package-'));
try {
  const root = join(staging, 'ReelPopcorn');
  const app = join(native, target === 'macos' ? 'ReelPopcorn.app' : 'ReelPopcorn');
  if (target === 'macos') {
    mkdirSync(root);
    run('codesign', ['--verify', '--deep', '--strict', app]);
    run('ditto', [app, join(root, 'ReelPopcorn.app')]);
  } else {
    cpSync(app, root, {recursive: true});
    const info = JSON.parse(readFileSync(join(root, 'nsh/app.json'), 'utf8'));
    if (info.id !== config.id || info.version !== config.version) throw new Error('Packaged app metadata differs.');
  }
  for (const name of ['LICENSE', 'NOTICE.md', 'THIRD_PARTY_NOTICES.txt', 'licenses']) cpSync(name, join(root, name), {recursive: true});
  cpSync('docs/INSTALL.md', join(root, 'INSTALL.md'));
  const executable = target === 'macos' ? join(root, 'ReelPopcorn.app/Contents/MacOS/ReelPopcorn') : join(root, `ReelPopcorn${target === 'windows' ? '.exe' : ''}`);
  if (!existsSync(executable)) throw new Error(`Missing packaged executable: ${executable}`);
  const releases = resolve('dist/releases');
  mkdirSync(releases, {recursive: true});
  const architecture = process.arch === 'x64' ? 'x86_64' : 'arm64';
  const name = `ReelPopcorn-v${config.version}-${target}-${architecture}.${target === 'linux' ? 'tar.gz' : 'zip'}`;
  const archive = join(releases, name);
  if (existsSync(archive)) rmSync(archive);
  if (target === 'macos') run('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', root, archive]);
  else if (target === 'windows') run('7z', ['a', '-tzip', archive, 'ReelPopcorn'], {cwd: staging});
  else run('tar', ['-czf', archive, '-C', staging, 'ReelPopcorn']);
  const digest = createHash('sha256').update(readFileSync(archive)).digest('hex');
  writeFileSync(`${archive}.sha256`, `${digest}  ${name}\n`);
  console.log(`Release archive: ${archive}`);
} finally {
  rmSync(staging, {recursive: true, force: true});
}
