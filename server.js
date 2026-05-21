const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;
const CHAVE_API = process.env.API_KEY;

const URL_JOGOS = 'https://v3.football.api-sports.io/fixtures';
const HEADERS = {
    'x-rapidapi-host': 'v3.football.api-sports.io',
    'x-rapidapi-key': CHAVE_API
};

let analiseJogos = [];
let ultimaAtualizacao = "Aguardando...";

function analisarGatilhos(jogo) {
    // Adicionada checagem de segurança profunda para evitar quebras se os dados vierem incompletos
    if (!jogo || !jogo.fixture || !jogo.fixture.status) {
        return { gatilhoSugerido: "🛡️ Ritmo Controlado", corBadge: "#4d4d57" };
    }

    const tempo = jogo.fixture.status.elapsed || 0;
    const golsCasa = (jogo.goals && jogo.goals.home) ?? 0;
    const golsVis = (jogo.goals && jogo.goals.away) ?? 0;
    
    let gatilhoSugerido = "🛡️ Ritmo Controlado";
    let corBadge = "#4d4d57";

    if (tempo >= 75 && golsCasa === golsVis) {
        gatilhoSugerido = "🔥 Padrão Pressão: Gol Late";
        corBadge = "#f75a68";
    } else if (tempo > 15 && tempo < 70 && (golsCasa > 0 || golsVis > 0)) {
        gatilhoSugerido = "📈 Tendência: Próximo Gol";
        corBadge = "#00b37e";
    } else if (tempo > 0 && tempo <= 45) {
        gatilhoSugerido = "📐 Análise: Cantos / Pressão";
        corBadge = "#fba94c";
    }

    return { gatilhoSugerido, corBadge };
}

async function rodarMotorAnalise() {
    if (!CHAVE_API) {
        console.log("❌ API_KEY ausente nas variáveis da Railway.");
        return;
    }
    try {
        console.log("📡 Buscando grade de jogos ao vivo na API...");
        const resposta = await axios.get(URL_JOGOS, { 
            headers: HEADERS, 
            params: { live: 'all' },
            timeout: 8000 
        });
        
        const jogos = resposta.data.response || [];
        
        // Mapeia os jogos aplicando a trava de segurança contra objetos nulos
        analiseJogos = jogos.filter(j => j && j.teams && j.fixture).map(jogo => {
            const id = jogo.fixture ? jogo.fixture.id : Math.random();
            const tempo = (jogo.fixture && jogo.fixture.status) ? jogo.fixture.status.elapsed : 0;
            const liga = (jogo.league) ? jogo.league.name : 'Outros';
            const casa = (jogo.teams && jogo.teams.home) ? jogo.teams.home.name : 'Casa';
            const visitante = (jogo.teams && jogo.teams.away) ? jogo.teams.away.name : 'Visitante';
            const golsCasa = (jogo.goals) ? (jogo.goals.home ?? 0) : 0;
            const golsVis = (jogo.goals) ? (jogo.goals.away ?? 0) : 0;

            const analise = analisarGatilhos(jogo);

            return {
                id,
                tempo,
                liga,
                casa,
                visitante,
                golsCasa,
                golsVis,
                gatilho: analise.gatilhoSugerido,
                cor: analise.corBadge
            };
        });

        const agora = new Date();
        ultimaAtualizacao = agora.toLocaleTimeString('pt-BR');
        console.log(`📊 STAR TIPSTER 5.0: ${analiseJogos.length} jogos processados às ${ultimaAtualizacao}.`);
    } catch (erro) {
        console.log("⚠️ Alerta de rede controlado: " + erro.message);
    }
}

app.get('/', (req, res) => {
    let rows = '';
    
    // Se a lista estiver vazia, renderiza uma linha limpa de aviso sem quebrar o site
    if (!analiseJogos || analiseJogos.length === 0) {
        rows = `
            <tr>
                <td colspan="3" style="text-align:center; padding:40px; color:#8d8d99; font-size:14px;">
                    📡 Sincronizando com a grade mundial em tempo real...<br>
                    <span style="font-size:11px; color:#555; display:block; margin-top:5px;">Aguardando retorno de partidas ativas da API-Football.</span>
                </td>
            </tr>`;
    } else {
        analiseJogos.forEach(j => {
            rows += `
                <tr>
                    <td style="color:#fba94c; font-weight:bold; font-family:monospace;">⏱️ ${j.tempo}'</td>
                    <td>
                        <span style="color:#8d8d99; font-size:10px; display:block; margin-bottom:2px;">🏆 ${j.liga}</span>
                        <strong>${j.casa}</strong> <span style="background:#1c1b22; padding:2px 6px; border-radius:4px; margin:0 3px;">${j.golsCasa}</span> x <span style="background:#1c1b22; padding:2px 6px; border-radius:4px; margin:0 3px;">${j.golsVis}</span> <strong>${j.visitante}</strong>
                    </td>
                    <td><span style="background-color:${j.cor}; color:#fff; padding:5px 9px; border-radius:4px; font-size:11px; font-weight:bold; display:inline-block;">${j.gatilho}</span></td>
                </tr>
            `;
        });
    }

    res.send(`
    <!DOCTYPE html>
    <html lang="pt-br">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>STAR TIPSTER 5.0</title>
        <style>
            body { font-family: system-ui, -apple-system, sans-serif; background-color: #0b0a0d; color: #e1e1e6; margin: 0; padding: 12px; }
            .header { text-align: center; padding: 15px 0; border-bottom: 1px solid #1c1b22; }
            h1 { color: #00b37e; font-size: 20px; margin: 0; letter-spacing: 0.5px; }
            .status-motor { display: inline-block; background: #1a191f; color: #00b37e; font-size: 10px; padding: 4px 10px; border-radius: 20px; margin-top: 6px; font-weight: bold; border: 1px solid #29292e; }
            .update-time { font-size: 11px; color: #8d8d99; text-align: center; margin-top: 8px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; background: #121214; border-radius: 8px; overflow: hidden; border: 1px solid #1c1b22; }
            th { background: #1a191f; color: #00b37e; font-size: 12px; text-align: left; padding: 12px; border-bottom: 1px solid #29292e; }
            td { padding: 12px; border-bottom: 1px solid #1c1b22; font-size: 13px; }
        </style>
        <script>setTimeout(() => { window.location.reload(); }, 30000);</script>
    </head>
    <body>
        <div class="header">
            <h1>🤖 STAR TIPSTER 5.0 — LIVE SCOUT</h1>
            <div class="status-motor">● PROMPT ENGINE ONLINE</div>
            <div class="update-time">Última leitura estável: <strong>${ultimaAtualizacao}</strong></div>
        </div>
        <table>
            <thead>
                <tr>
                    <th>Tempo</th>
                    <th>Confronto / Liga</th>
                    <th>Gatilho Operacional</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
        </table>
    </body>
    </html>
    `);
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor escutando na porta ${PORT}`);
    setTimeout(() => {
        rodarMotorAnalise();
        setInterval(rodarMotorAnalise, 300000); // 5 minutos
    }, 2000);
});
