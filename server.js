const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8080;
const API_KEY = process.env.API_KEY;

const API_URL = 'https://v3.football.api-sports.io/fixtures';

const HEADERS = {
    'x-apisports-key': API_KEY
};

let cacheJogos = [];
let ultimaAtualizacao = 'Aguardando...';
let ultimaConsulta = 0;

app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

function analisarJogo(jogo) {
    const tempo = jogo?.fixture?.status?.elapsed || 0;
    const status = jogo?.fixture?.status?.short || '';
    const golsCasa = jogo?.goals?.home ?? 0;
    const golsFora = jogo?.goals?.away ?? 0;

    if (['FT', 'AET', 'PEN'].includes(status)) {
        return null;
    }

    let prioridade = 40;
    let gatilho = '🛡️ Ritmo Controlado';
    let leitura = 'Partida sem pressão suficiente.';
    let cor = '#4d4d57';

    if (tempo >= 75 && golsCasa === golsFora) {
        prioridade = 95;
        gatilho = '🔥 Gol Late';
        leitura = 'Empate em minuto crítico. Tendência de pressão final.';
        cor = '#f75a68';
    } else if (tempo >= 18 && tempo <= 70 && golsCasa + golsFora >= 1) {
        prioridade = 82;
        gatilho = '📈 Próximo Gol';
        leitura = 'Partida aberta com placar em movimento.';
        cor = '#00b37e';
    } else if (tempo >= 1 && tempo <= 45) {
        prioridade = 66;
        gatilho = '📐 Pressão Inicial';
        leitura = 'Volume ofensivo inicial em construção.';
        cor = '#fba94c';
    }

    return { prioridade, gatilho, leitura, cor };
}

async function buscarJogosAoVivo() {
    if (!API_KEY) {
        console.log('❌ API_KEY ausente no Railway.');
        return [];
    }

    const agora = Date.now();

    if (agora - ultimaConsulta < 45000 && cacheJogos.length > 0) {
        return cacheJogos;
    }

    console.log('📡 Consultando API Sports...');

    const resposta = await axios.get(API_URL, {
        headers: HEADERS,
        params: {
            live: 'all',
            timezone: 'America/Sao_Paulo'
        },
        timeout: 10000
    });

    const jogos = resposta.data.response || [];

    const processados = jogos
        .map(jogo => {
            const analise =
