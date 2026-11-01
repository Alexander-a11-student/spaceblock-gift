import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

const site = 'https://alexander-a11-student.github.io/spaceblock-gift/';
const releaseApi = 'https://api.github.com/repos/Alexander-a11-student/spaceblock-gift/releases/tags/gift-2026-11-01';
const expected = {
  'SpaceBlock-Android.apk': { size: 484242242, sha256: 'f123f29ede6aab3c883884bf7d0ec63889621591d4d1071f1c0f19e73d7e78a9' },
  'SpaceBlock-Minecraft-1.21.4.jar': { size: 7409129, sha256: '27e8d57e8a9ee18c4a8f2c6243f31adc8fcce6f28e018db20bb9f952a4e34510' },
};
const page = await fetch(site, { signal: AbortSignal.timeout(20000) });
if (!page.ok) throw new Error(`Site: HTTP ${page.status}`);
const html = await page.text();
const releaseResponse = await fetch(releaseApi, { signal: AbortSignal.timeout(20000) });
if (!releaseResponse.ok) throw new Error(`Release: HTTP ${releaseResponse.status}`);
const release = await releaseResponse.json();
const report = { site, checkedAt: new Date().toISOString(), downloads: [] };
for (const [name, check] of Object.entries(expected)) {
  const asset = release.assets.find(asset => asset.name === name);
  if (!asset || !html.includes(asset.browser_download_url)) throw new Error(`Missing asset or page link: ${name}`);
  if (asset.size !== check.size || asset.digest !== `sha256:${check.sha256}`) throw new Error(`GitHub asset mismatch: ${name}`);
  console.log(`Downloading ${name} for full SHA-256 verification`);
  const response = await fetch(asset.browser_download_url, { signal: AbortSignal.timeout(900000) });
  if (!response.ok) throw new Error(`Download: HTTP ${response.status}`);
  const hash = createHash('sha256');
  let size = 0, previous = 0;
  for await (const chunk of response.body) {
    hash.update(chunk); size += chunk.length;
    const progress = Math.floor(size / check.size * 10) * 10;
    if (progress >= previous + 10) { previous = progress; console.log(`${name}: ${progress}%`); }
  }
  const sha256 = hash.digest('hex');
  if (size !== check.size || sha256 !== check.sha256) throw new Error(`Downloaded content mismatch: ${name}`);
  report.downloads.push({ name, url: asset.browser_download_url, status: response.status, size, sha256 });
  console.log(`PASS: ${name}`);
}
await mkdir('.local', { recursive: true });
await writeFile('.local/verification.json', JSON.stringify(report, null, 2));
console.log('All downloads verified. Report: .local/verification.json');
