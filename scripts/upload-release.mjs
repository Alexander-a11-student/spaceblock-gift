import { spawnSync } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import https from 'node:https';

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
  const asset = await new Promise((resolveUpload, rejectUpload) => {
    const stream = createReadStream(file);
    const request = https.request(`${state.upload_url.replace(/\{.*$/, '')}?name=${encodeURIComponent(name)}`, {
      method: 'POST', headers: { ...headers, 'User-Agent': 'SpaceBlock-distribution', 'Content-Type': 'application/octet-stream', 'Content-Length': String(size) },
    }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => {
        try {
          const result = JSON.parse(body);
          if (response.statusCode < 200 || response.statusCode >= 300) throw new Error(`${response.statusCode}: ${result.message}`);
          resolveUpload(result);
        } catch (error) { rejectUpload(error); }
      });
      response.on('error', rejectUpload);
    });
    request.setTimeout(120000, () => request.destroy(new Error('Upload connection timed out')));
    request.on('error', error => { stream.destroy(); rejectUpload(error); });
    stream.on('error', error => { request.destroy(); rejectUpload(error); });
    stream.pipe(request);
    let sent = 0, previous = 0;
    stream.on('data', chunk => {
      sent += chunk.length;
      const progress = Math.floor(sent / size * 10) * 10;
      if (progress >= previous + 10) { previous = progress; console.log(`${name}: ${progress}%`); }
    });
  });
  console.log(`Uploaded ${asset.name}`);
}
const release = await api(`/repos/${state.repo}/releases/${state.releaseId}`, { method: 'PATCH', body: JSON.stringify({ draft: false }) });
state.release_url = release.html_url;
state.assets = release.assets.map(({ name, size, browser_download_url, digest }) => ({ name, size, browser_download_url, digest }));
await writeFile(statePath, JSON.stringify(state, null, 2));
console.log(JSON.stringify({ release_url: state.release_url, assets: state.assets }));
