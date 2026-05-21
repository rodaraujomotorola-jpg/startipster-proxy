const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: "*",
  methods: ["GET", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

const CACHE_TTL_MS = 12000;
const cache = new Map();

const SOFASCORE_BASES = [
  "https://api.sofascore.com/api/v1",
  "https://www.sofascore.com/api/v1"
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function buildHeaders() {
  return {
    "accept": "application/json, text/plain, */*",
    "accept-language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    "cache-control": "no-cache",
    "pragma": "no-cache",
    "referer": "https://www.sofascore.com/",
    "origin": "https://www.sofascore.com",
    "user-agent": "Mozilla/5.0 (Linux; Android 11; moto g 5G plus) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
    "sec-ch-ua": "\"Chromium\";v=\"124\", \"Google Chrome\";v=\"124\", \"Not-A.Brand\";v=\"99\"",
    "sec-ch-ua-mobile": "?1",
    "sec-ch-ua-platform": "\"Android\"",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site"
  };
}

function normalizePath(rawPath) {
  let path = rawPath || "/";
  if (!path.startsWith("/")) path = "/" + path;
  path = path.replace(/^\/api\/v1/, "");
  return path;
}

async function fetchSofaScore(path) {
  const errors = [];

  for (const base of SOFASCORE_BASES) {
    const url = base + path;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(url, {
          method: "GET",
          headers: buildHeaders(),
          signal: controller.signal
        });

        clearTimeout(timeout);

        const text = await response.text();

        if (!response.ok) {
          errors.push(`${url} -> HTTP ${response.status}: ${text.slice(0, 160)}`);
          if ([403, 429, 500, 502, 503, 504].includes(response.status)) {
            await sleep(500 * attempt);
            continue;
          }
          throw new Error(`HTTP ${response.status}`);
        }

        try {
          return JSON.parse(text);
        } catch {
          throw new Error("Resposta não veio em JSON");
        }
      } catch (err) {
        errors.push(`${url} -> ${err.message}`);
        await sleep(400 * attempt);
      }
    }
  }

  const error = new Error("Falha ao consultar SofaScore");
  error.details = errors.slice(-8);
  throw error;
}

app.get("/", (req, res) => {
  res.json({
    ok: true,
    name: "StarTipster Proxy Server 2.0",
    usage: "/api/v1/sport/football/events/live",
    status: "online"
  });
});

app.get("/health", (req, res) => {
  res.json({ ok: true, status: "online", time: new Date().toISOString() });
});

app.get("/api/v1/*", async (req, res) => {
  const path = normalizePath(req.path);
  const query = req.url.includes("?") ? "?" + req.url.split("?").slice(1).join("?") : "";
  const finalPath = path + query;
  const cacheKey = finalPath;
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.time < CACHE_TTL_MS) {
    res.set("x-startipster-cache", "HIT");
    return res.json(cached.data);
  }

  try {
    const data = await fetchSofaScore(finalPath);
    cache.set(cacheKey, { time: Date.now(), data });
    res.set("x-startipster-cache", "MISS");
    res.json(data);
  } catch (err) {
    res.status(502).json({
      ok: false,
      error: "Proxy não conseguiu buscar dados da SofaScore",
      message: err.message,
      details: err.details || []
    });
  }
});

app.get("*", (req, res) => {
  res.status(404).json({
    ok: false,
    error: "Endpoint não encontrado",
    example: "/api/v1/sport/football/events/live"
  });
});

app.listen(PORT, () => {
  console.log(`StarTipster Proxy Server 2.0 online on port ${PORT}`);
});
