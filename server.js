const axios = require('axios');
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());

// Porta que a Railway vai usar para liberar o link do site
const PORT = process.env.PORT || 3000;
const CHAVE_API = process.env.API_KEY;

const URL = 'https://v3.football.api-sports.io/fixtures';
const HEADERS = {
    'x-rapidapi-host': 'v3.football.api-sports.io',
    'x-rapidapi-key': CHAVE_API
};

// Variável global para guardar os jogos na memória do servidor
let jogosArmazenados = [];

async function verificarJogosAoVivo() {
    if (!CHAVE_API) {
        console.log("❌ ERRO: API_KEY não configurada.");
        return;
    }
    try {
        const resposta = await axios.get(URL, { headers: HEADERS, params: { live: 'all' } });
        jogosArmazenados = resposta.data.response || [];
        console.log(`📡 Dados atualizados: ${jogosArmazenados.length} jogos ao vivo.`);
    } catch (erro) {
        console.log("Erro ao buscar dados: " + erro.message);
    }
}

// Roda a busca da API a cada 5 minutos
verificarJogosAoVivo();
setInterval(verificarJogosAoVivo, 300000);

// ROTA PRINCIPAL: Cria e entrega a página HTML estilizada
app.get('/', (req, res) => {
    // Monta as linhas da tabela de jogos usando os dados armazenados
    let linhasDosJogos = '';
    
    if (jogosArmazenados.length === 0) {
        linhasDosJogos = `<tr><td colspan="3" style="text-align:center; padding:20px; color:#aaa;">Nenhum jogo ao vivo no momento ou atualizando dados...</td></tr>`;
    } else {
        jogosArmazenados.forEach(jogo => {
            const tempo = jogo.fixture.status.elapsed;
            const casa = jogo.teams.home.name;
            const visitante = jogo.teams.away.name;
            const golsCasa = jogo.goals.home ?? 0;
            const golsVis = jogo.goals.away ?? 0;

            linhasDosJogos += `
                <tr>
                    <td class="tempo">⏱️ ${tempo}'</td>
                    <td class="confronto"><strong>${casa}</strong> <span class="placar">${golsCasa}</span> x <span class="placar">${golsVis}</span> <strong>${visitante}</strong></td>
                    <td class="status"><span class="badge-live">LIVE</span></td>
                </tr>
            `;
        });
    }

    // Estrutura completa do HTML com visual Escuro (Dark Mode) profissional
    const htmlCompleto = `
    <!DOCTYPE html>
    <html lang="pt-br">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>StarTipster - Live Scout</title>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #121214; color: #e1e1e6; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; }
            h1 { text-align: center; color: #00b37e; font-size: 24px; margin-bottom: 5px; }
            .sub { text-align: center; color: #8d8d99; font-size: 12px; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; background-color: #202024; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.3); }
            th { background-color: #29292e; color: #00b37e; padding: 12px; text-align: left; font-size: 14px; border-bottom: 2px solid #121214; }
            td { padding: 14px 12px; border-bottom: 1px solid #29292e; font-size: 14px; }
            .tempo { color: #fba94c; font-weight: bold; width: 20%; }
            .confronto { width: 65%; }
            .placar { background-color: #121214; padding: 2px 8px; border-radius: 4px; color: #fff; margin: 0 5px; display: inline-block; min-width: 15px; text-align: center; }
            .status { width: 15%; text-align: right; }
            .badge-live { background-color: #f75a68; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; animation: piscar 1s infinite alternate; }
            @keyframes piscar { from { opacity: 1; } to { opacity: 0.4; } }
        </style>
        <script>
            // Faz a página recarregar sozinha a cada 1 minuto na tela do usuário
            setTimeout(() => { window.location.reload(); }, 60000);
        </script>
    </head>
    <body>
        <div class="container">
            <h1>📊 StarTipster Live Scout</h1>
            <div class="sub">Atualização automática a cada 60s (Dados API de 5 em 5 min)</div>
            <table>
                <thead>
                    <tr>
                        <th>Tempo</th>
                        <th>Partida</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${linhasDosJogos}
                </tbody>
            </table>
        </div>
    </body>
    </html>
    `;

    res.send(htmlCompleto);
});

// Inicializa o servidor web
app.listen(PORT, () => {
    console.log(`🚀 Servidor HTML rodando com sucesso na porta ${PORT}`);
});
