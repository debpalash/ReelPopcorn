import {readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const {version} = JSON.parse(readFileSync('nsh.json', 'utf8'));
assert.equal(process.env.RELEASE_TAG, `v${version}`);
const files = ['macos-arm64.zip', 'windows-x86_64.zip', 'linux-x86_64.tar.gz'].map(suffix => `ReelPopcorn-v${version}-${suffix}`);
assert.deepEqual(readdirSync('dist/releases').sort(), files.flatMap(name => [name, `${name}.sha256`]).sort(), 'All three release archives and their checksums are required');
const lines = files.map(name => {
  const bytes = readFileSync(`dist/releases/${name}`);
  assert.ok(bytes.length > 1_000_000, `${name} is unexpectedly small`);
  assert.ok(name.endsWith('.zip') ? bytes[0] === 0x50 && bytes[1] === 0x4b : bytes[0] === 0x1f && bytes[1] === 0x8b, 'Archive format');
  const line = `${createHash('sha256').update(bytes).digest('hex')}  ${name}\n`;
  assert.equal(readFileSync(`dist/releases/${name}.sha256`, 'utf8'), line, `${name} checksum`);
  return line;
});
writeFileSync('dist/releases/SHA256SUMS.txt', lines.join(''));
console.log('All desktop release assets and SHA-256 checksums verified.');
