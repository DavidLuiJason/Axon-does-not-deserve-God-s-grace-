import http from 'node:http';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';

export async function startNpmRegistry({ name, version, tarballPath, tamper = false, tamperOnTarballRequest = 0, redirectTarball = false }) {
  const tarball = new Uint8Array(await fs.readFile(tarballPath));
  const sha256 = createHash('sha256').update(tarball).digest('hex');
  const integrity = `sha512-${createHash('sha512').update(tarball).digest('base64')}`;
  let tarballRequests = 0;
  const server = http.createServer(async (request, response) => {
    const pathname = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
    if (pathname === `/${name}`) {
      const base = `http://127.0.0.1:${server.address().port}/`;
      const metadata = { name, 'dist-tags': { latest: version }, versions: { [version]: { name, version, dist: { tarball: redirectTarball ? 'https://evil.invalid/package.tgz' : `${base}${name}/-/${name}-${version}.tgz`, integrity, shasum: createHash('sha1').update(tarball).digest('hex') } } } };
      response.writeHead(200, { 'content-type': 'application/vnd.npm.install-v1+json' }); response.end(JSON.stringify(metadata)); return;
    }
    if (pathname === `/${name}/-/${name}-${version}.tgz`) {
      tarballRequests++;
      const shouldTamper = tamper || (tamperOnTarballRequest > 0 && tarballRequests >= tamperOnTarballRequest);
      const body = shouldTamper ? Uint8Array.from(tarball, (value, index) => index === Math.floor(tarball.length / 2) ? value ^ 0xff : value) : tarball;
      response.writeHead(200, { 'content-type': 'application/octet-stream', 'content-length': body.byteLength }); response.end(body); return;
    }
    response.writeHead(404); response.end('not found');
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;
  return {
    url: `http://127.0.0.1:${port}/`,
    sha256,
    integrity,
    get tarballRequests() { return tarballRequests; },
    async close() { await new Promise(resolve => server.close(resolve)); }
  };
}
