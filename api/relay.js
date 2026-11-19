// relay.js: Vercel serverless function, the Vercel copy's own relay.
// The SkyWatch relay (see planner/config.js) only answers themagicianleo.github.io, so on Vercel the planner
// calls /api/relay?url=... on its own site instead. Same site, so no CORS headers are needed.
// Only forwards to the providers the planner uses, over https.

const ALLOW = new Set(['aviationweather.gov', 'api.adsb.lol', 'api.airplanes.live']);
const CACHE_SECONDS = { 'aviationweather.gov': 300, 'api.adsb.lol': 10, 'api.airplanes.live': 10 };

export async function GET(request) {
  let target;
  try { target = new URL(new URL(request.url).searchParams.get('url')); } catch { return new Response('missing or bad url', { status: 400 }); }
  if (target.protocol !== 'https:' || !ALLOW.has(target.hostname)) return new Response('host not allowed', { status: 400 });

  let r;
  try {
    r = await fetch(target, {
      headers: { 'User-Agent': 'Apollo/1.0 (+https://github.com/Themagicianleo/apollo)', Accept: 'application/json' },
      signal: AbortSignal.timeout(12000),
    });
  } catch {
    return new Response('provider unreachable', { status: 502 });
  }
  const empty = r.status === 204 || r.status === 304;
  return new Response(empty ? null : await r.arrayBuffer(), {
    status: r.status,
    headers: {
      'Content-Type': r.headers.get('content-type') || 'application/json',
      'Cache-Control': r.ok ? `public, s-maxage=${CACHE_SECONDS[target.hostname]}` : 'no-store',
    },
  });
}
