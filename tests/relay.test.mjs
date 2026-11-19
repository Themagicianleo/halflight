// The Vercel relay (api/relay.js): allow-list, empty answers, and provider failures. fetch is replaced, no network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GET } from '../api/relay.js';

const call = (url) => GET(new Request('https://halflight.vercel.app/api/relay?url=' + encodeURIComponent(url)));

test('refuses hosts that are not on the allow-list, and plain http', async () => {
  assert.equal((await call('https://example.com/')).status, 400);
  assert.equal((await call('http://aviationweather.gov/api/data/metar?ids=WSSS')).status, 400);
  assert.equal((await GET(new Request('https://x.vercel.app/api/relay'))).status, 400);
});

test('forwards allowed providers with a User-Agent and passes the answer through', async () => {
  let seen;
  globalThis.fetch = async (u, opts) => { seen = { u: String(u), ua: opts.headers['User-Agent'] }; return new Response('[{"icaoId":"WSSS"}]', { status: 200, headers: { 'content-type': 'application/json' } }); };
  const r = await call('https://aviationweather.gov/api/data/metar?ids=WSSS&format=json');
  assert.equal(r.status, 200);
  assert.equal(seen.u, 'https://aviationweather.gov/api/data/metar?ids=WSSS&format=json');
  assert.match(seen.ua, /Halflight/);
  assert.deepEqual(await r.json(), [{ icaoId: 'WSSS' }]);
  assert.match(r.headers.get('cache-control'), /s-maxage=300/);
});

test('passes "no METAR" (204) through with an empty body', async () => {
  globalThis.fetch = async () => new Response(null, { status: 204 });
  const r = await call('https://aviationweather.gov/api/data/metar?ids=XXXX&format=json');
  assert.equal(r.status, 204);
});

test('reports an unreachable provider as 502', async () => {
  globalThis.fetch = async () => { throw new Error('down'); };
  assert.equal((await call('https://api.adsb.lol/v2/point/1.35/103.99/25')).status, 502);
});
