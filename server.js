import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;
const SOFASCORE_BASES = [
  'https://www.sofascore.com/api/v1',
  'https://api.sofascore.com/api/v1'
];

const cache = new Map();
const TTL_MS = Number(process.env.CACHE_TTL_MS || 12000);
const MAX_CACHE_ITEMS = Number(process.env.MAX_CACHE_ITEMS || 500);

app.use(cors({ origin: '*' }));
app.use(express.json());

function pruneCache(){
  if(cache.size <= MAX_CACHE_ITEMS) return;
  const keys = [...cache.keys()].slice(0, cache.size - MAX_CACHE_ITEMS);
  for(const key of keys) cache.delete(key);
}

function makeHeaders(){
  return {
    'accept': 'application/json, text/plain, */*',
    'accept-language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    'cache-control': 'no-cache',
    'pragma': 'no-cache',
    'referer': 'https://www.sofascore.com/',
    'origin': 'https://www.sofascore.com',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
  };
}

app.get('/', (req, res) => {
  res.json({ ok: true, service: 'StarTipster Proxy Server 1.0', health: '/health', usage: '/api/v1/sport/football/events/live' });
});

app.get('/health', (req, res) => {
  res.json({ ok: true, cacheItems: cache.size, ttlMs: TTL_MS, time: new Date().toISOString() });
});

app.get('/api/v1/*', async (req, res) => {
  const path = req.originalUrl.replace(/^\/api\/v1/, '');
  const cacheKey = path;
  const cached = cache.get(cacheKey);

  if(cached && Date.now() - cached.time < TTL_MS){
    res.set('x-startipster-cache', 'hit');
    return res.status(cached.status).type('application/json').send(cached.body);
  }

  const errors = [];
  for(const base of SOFASCORE_BASES){
    const url = base + path;
    try{
      const upstream = await fetch(url, { headers: makeHeaders(), redirect: 'follow' });
      const text = await upstream.text();
      const contentType = upstream.headers.get('content-type') || 'application/json';

      if(upstream.ok){
        cache.set(cacheKey, { time: Date.now(), status: upstream.status, body: text });
        pruneCache();
        res.set('x-startipster-cache', 'miss');
        return res.status(upstream.status).type(contentType).send(text);
      }

      errors.push(`${url} -> HTTP ${upstream.status}`);
    }catch(err){
      errors.push(`${url} -> ${err.message}`);
    }
  }

  const fallback = cache.get(cacheKey);
  if(fallback){
    res.set('x-startipster-cache', 'stale');
    return res.status(fallback.status).type('application/json').send(fallback.body);
  }

  res.status(502).json({ ok:false, error:'SofaScore bloqueou ou não respondeu ao proxy.', details: errors.slice(0,4) });
});

app.listen(PORT, () => {
  console.log(`StarTipster Proxy Server 1.0 rodando na porta ${PORT}`);
});
