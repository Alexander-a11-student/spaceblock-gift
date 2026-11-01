import { spawnSync } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const statePath = resolve(root, 'scripts/release-state.json');
const state = JSON.parse(await readFile(statePath, 'utf8'));
const auth = spawnSync('git', ['-c', 'credential.interactive=never', 'credential', 'fill'], {
  input: 'protocol=https\nhost=github.com\n\n', encoding: 'utf8', windowsHide: true,
});
const token = auth.stdout.split('\n').find(line => line.startsWith('password='))?.slice(9).trim();
if (!token) throw new Error('GitHub credential unavailable');
const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
const api = async (route, options = {}) => {
  const response = await fetch(`https://api.github.com${route}`, { ...options, headers: { ...headers, ...options.headers } });
  const result = await response.json();
  if (!response.ok) throw new Error(`${response.status}: ${result.message}`);
  return result;
};
const names = ['SpaceBlock-Minecraft-1.21.4.jar', 'SHA256SUMS.txt', 'SpaceBlock-Android.apk'];
const assets = await api(`/repos/${state.repo}/releases/${state.releaseId}/assets`);
for (const name of names) {
  if (assets.some(asset => asset.name === name && asset.state === 'uploaded')) continue;
  const file = resolve(root, '..', name);
  const { size } = await stat(file);
  console.log(`Uploading ${name} (${size} bytes)`);
  const stream = createReadStream(file);
  const response = await fetch(`${state.upload_url.replace(/\{.*$/, '')}?name=${encodeURIComponent(name)}`, {
    method: 'POST', headers: { ...headers, 'Content-Type': 'application/octet-stream', 'Content-Length': String(size) }, body: stream, duplex: 'half',
  });
  const asset = await response.json();
  if (!response.ok) throw new Error(`${response.status}: ${asset.message}`);
  console.log(`Uploaded ${asset.name}`);
}
const release = await api(`/repos/${state.repo}/releases/${state.releaseId}`, { method: 'PATCH', body: JSON.stringify({ draft: false }) });
state.release_url = release.html_url;
state.assets = release.assets.map(({ name, size, browser_download_url, digest }) => ({ name, size, browser_download_url, digest }));
await writeFile(statePath, JSON.stringify(state, null, 2));
console.log(JSON.stringify({ release_url: state.release_url, assets: state.assets }));
