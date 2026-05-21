const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());

// Garante o uso correto da porta exigida pela nuvem
const PORT = process.env.PORT || 3000;
const CHAVE_API = process.env.API_KEY;

const URL_JOGOS = 'https://v3.football.api-sports.io/fixtures';
const HEADERS = {
    'x-rapidapi-host': 'v3.football.api-sports.io',
    'x-rapidapi-key': CHAVE_API
};

let analiseJogos = [];

// ROTA DE SEGURANÇA (Healthcheck): Diz para a Railway que o motor está perfeito
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// Cérebro de processamento estatístico simplificado e ultra-rápido
function analisarGatilhos(jogo) {
    const tempo = jogo.fixture.status.elapsed || 0;
    const golsCasa = jogo.goals.home ?? 0;
    const golsVis = jogo.goals.away ?? 0;
    
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

// Motor assíncrono isolado para não congelar o servidor
async function rodarMotorAnalise() {
    if (!CHAVE_API) {
        console.log("❌ API_KEY ausente nas variáveis de ambiente.");
        return;
    }
    try {
        console.log("📡 Buscando dados em background...");
        const resposta = await axios.get(URL_JOGOS, { 
            headers: HEADERS, 
            params: { live: 'all' },
            timeout: 8000 // Desiste se a API demorar mais de 8 segundos
        });
        
        const jogos = resposta.data.response || [];
        
        analiseJogos = jogos.map(jogo => {
            const analise = analisarGatilhos(jogo);
            return {
                id: jogo.fixture.id,
                tempo: jogo.fixture.status.elapsed || 0,
                liga: jogo.league.name || 'Outros',
                casa: jogo.teams.home.name,
                visitante: jogo.teams.away.name,
                golsCasa: jogo.goals.home ?? 0,
                golsVis: jogo.goals.away ?? 0,
                gatilho: analise.gatilhoSugerido,
                cor: analise.corBadge
            };
        });

        console.log(`📊 STAR TIPSTER 5.0: ${analiseJogos.length} jogos em análise.`);
    } catch (erro) {
        console.log("⚠️ Intervalo de rede ignorado: " + erro.message);
    }
}

// ROTA PRINCIPAL: Renderiza a tabela estilizada para você ver no celular
app.get('/', (req, res) => {
    let linhasDosJogos = '';
    
    if (analiseJogos.length === 0) {
        linhasDosJogos = `<tr><td colspan="3" style="text-align:center; padding:40px; color:#8d8d99;">📡 Sincronizando com a grade ao vivo... A tabela atualiza sozinha em instantes.</td></tr>`;
    } else {
        analiseJogos.forEach(j => {
            linhasDosJogos += `
                <tr>
                    <td style="color:#fba94c; font-weight:bold; font-family:monospace;">⏱️ ${j.tempo}'</td>
                    <td>
                        <span style="color:#8d8d99; font-size:10px; display:block;">🏆 ${j.liga}</span>
                        <strong>${j.casa}</strong> [${j.golsCasa}] x [${j.golsVis}] <strong>${j.visitante}</strong>
                    </td>
                    <td><span style="background-color:${j.cor}; color:#fff; padding:4px 8px; border-radius:4px; font-size:11px; font-weight:bold;">${j.gatilho}</span></td>
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
            body { font-family: system-ui, sans-serif; background-color: #0b0a0d; color: #e1e1e6; padding: 12px; margin: 0; }
            h1 { color: #00b37e; font-size: 18px; text-align: center; margin: 10px 0 0 0; }
            .sub { text-align: center; font-size: 11px; color: #8d8d99; margin-bottom: 15px; }
            table { width: 100%; border-collapse: collapse; background: #121214; border-radius: 6px; overflow: hidden; }
            th { background: #1a191f; color: #00b37e; font-size: 11px; text-align: left; padding: 10px; }
            td { padding: 10px; border-bottom: 1px solid #1c1b22; font-size: 12px; }
        </style>
        <script>setTimeout(() => { window.location.reload(); }, 30000);</script>
    </head>
    <body>
        <h1>🤖 STAR TIPSTER 5.0</h1>
        <div class="sub">MONITORAMENTO QUANTITATIVO ATIVO</div>
        <table>
            <thead>
                <tr>
                    <th>Tempo</th>
                    <th>Jogo / Liga</th>
                    <th>Sinal Operacional</th>
                </tr>
            </thead>
            <tbody>
                ${linhasDosJogos}
            </tbody>
        </table>
    </body>
    </html>
    `);
});

// Inicialização imediata do servidor para travar o Healthcheck com sucesso
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor rodando com sucesso na porta ${PORT}`);
    
    // Deixa o servidor se estabilizar por 4 segundos antes de buscar jogos pela primeira vez
    setTimeout(() => {
        rodarMotorAnalise();
        // Atualiza a cada 3 minutos
        setInterval(rodarMotorAnalise, 180000);
    }, 4000);
});
