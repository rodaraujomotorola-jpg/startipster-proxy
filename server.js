const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: "*",
  methods: ["GET", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());

const CACHE_TTL_MS = 12000;
const cache = new Map();

// CORRIGIDO: sem /api/v1 aqui, porque o StarTipster já envia /api/v1/... na URL.
const SOFASCORE_BASES = [
  "https://api.sofascore.com",
  "https://www.sofascore.com"
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function buildHeaders() {
  return {
    "User-Agent": "Mozilla/5.0 (Linux; Android 11; moto g 5G plus) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    "Referer": "https://www.sofascore.com/",
    "Origin": "https://www.sofascore.com",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    "Sec-Fetch-Site": "same-site",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Dest": "empty"
  };
}

function getCache(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.time > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.data;
}

function setCache(key, data) {
  cache.set(key, { time: Date.now(), data });
  if (cache.size > 200) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
}

async function tryFetch(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: buildHeaders(),
      signal: controller.signal
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (_) {
      data = { raw: text };
    }

    return {
      ok: response.ok,
      status: response.status,
      url,
      data
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function proxySofascore(path) {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const attempts = [];

  for (let round = 0; round < 2; round++) {
    for (const base of SOFASCORE_BASES) {
      const url = `${base}${cleanPath}`;
      try {
        const result = await tryFetch(url);
        attempts.push({ url, status: result.status });

        if (result.ok) {
          return result.data;
        }

        if (![403, 429, 500, 502, 503, 504].includes(result.status)) {
          throw new Error(`SofaScore HTTP ${result.status}`);
        }
      } catch (err) {
        attempts.push({ url, error: err.message });
      }

      await sleep(350);
    }
  }

  const error = new Error("Falha ao buscar dados da SofaScore");
  error.attempts = attempts;
  throw error;
}

app.get("/health", (req, res) => {
  res.json({ ok: true, status: "online", time: new Date().toISOString() });
});

app.get("/api/test", (req, res) => {
  res.json({ ok: true, message: "StarTipster proxy funcionando", time: new Date().toISOString() });
});

// Proxy universal. Exemplo:
// /api/v1/sport/football/events/live -> https://api.sofascore.com/api/v1/sport/football/events/live
app.get("/*", async (req, res) => {
  const path = req.originalUrl;
  const cached = getCache(path);

  if (cached) {
    res.setHeader("X-StarTipster-Cache", "HIT");
    return res.json(cached);
  }

  try {
    const data = await proxySofascore(path);
    setCache(path, data);
    res.setHeader("X-StarTipster-Cache", "MISS");
    res.json(data);
  } catch (err) {
    res.status(502).json({
      ok: false,
      error: "Proxy falhou ao buscar SofaScore",
      message: err.message,
      attempts: err.attempts || [],
      path
    });
  }
});

app.listen(PORT, () => {
  console.log(`StarTipster Proxy Server corrigido online na porta ${PORT}`);
});
