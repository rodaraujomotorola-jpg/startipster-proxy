const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*', methods: ['GET', 'OPTIONS'], allowedHeaders: ['Content-Type', 'X-Auth-Token'] }));
app.use(express.json());

const FOOTBALL_DATA_BASE = 'https://api.football-data.org/v4';
const CACHE_TTL_MS = 15000;
const cache = new Map();

function cacheKey(path, token) {
  return `${token ? token.slice(0, 8) : 'no-token'}:${path}`;
}

function getToken(req) {
  return req.headers['x-auth-token'] || req.query.token || process.env.FOOTBALL_DATA_TOKEN || '';
}

function cleanPath(path) {
  let p = path || '';
  p = p.replace(/^\/football-data/, '');
  p = p.replace(/^\/api\/v4/, '');
  if (!p.startsWith('/')) p = '/' + p;
  return p;
}

app.get('/', (req, res) => {
  res.json({ ok: true, message: 'StarTipster FootballData proxy funcionando', endpoints: ['/health', '/football-data/matches?token=SUA_API'] });
});

app.get('/health', (req, res) => {
  res.json({ ok: true, status: 'online', time: new Date().toISOString() });
});

app.get('/football-data/*', async (req, res) => {
  const token = getToken(req);
  if (!token) {
    return res.status(401).json({ ok: false, error: 'API token ausente. Envie em ?token= ou header X-Auth-Token.' });
  }

  const path = cleanPath(req.originalUrl.split('?')[0]);
  const query = new URLSearchParams(req.query);
  query.delete('token');
  const qs = query.toString();
  const url = `${FOOTBALL_DATA_BASE}${path}${qs ? '?' + qs : ''}`;
  const key = cacheKey(url, token);

  const cached = cache.get(key);
  if (cached && Date.now() - cached.time < CACHE_TTL_MS) {
    res.setHeader('X-StarTipster-Cache', 'HIT');
    return res.status(cached.status).json(cached.data);
  }

  try {
    const upstream = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Auth-Token': token,
        'Accept': 'application/json',
        'User-Agent': 'StarTipster/3.1 FootballData Proxy'
      }
    });

    const text = await upstream.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    cache.set(key, { time: Date.now(), status: upstream.status, data });
    res.setHeader('X-StarTipster-Cache', 'MISS');
    return res.status(upstream.status).json(data);
  } catch (error) {
    return res.status(502).json({ ok: false, error: 'Falha ao acessar football-data.org', message: error.message, url });
  }
});

app.get('/matches', (req, res) => {
  req.url = '/football-data/matches' + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '');
  app._router.handle(req, res);
});

app.listen(PORT, () => {
  console.log(`StarTipster FootballData proxy online na porta ${PORT}`);
});
