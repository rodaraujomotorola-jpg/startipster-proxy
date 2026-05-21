const axios = require('axios');

// Puxa a chave de forma segura da Railway
const CHAVE_API = process.env.API_KEY;

const URL = 'https://v3.football.api-sports.io/fixtures';
const HEADERS = {
    'x-rapidapi-host': 'v3.football.api-sports.io',
    'x-rapidapi-key': CHAVE_API
};

async function verificarJogosAoVivo() {
    if (!CHAVE_API) {
        console.log("❌ ERRO: A variável API_KEY não foi configurada na Railway!");
        return;
    }

    try {
        const resposta = await axios.get(URL, { headers: HEADERS, params: { live: 'all' } });
        const jogos = resposta.data.response || [];

        if (jogos.length === 0) {
            console.log("Nenhum jogo acontecendo ao vivo neste momento.");
            return;
        }

        console.log(`--- ${jogos.length} JOGOS AO VIVO ENCONTRADOS ---`);
        jogos.forEach(jogo => {
            const status = jogo.fixture.status;
            const equipes = jogo.teams;
            const gols = jogo.goals;

            // Isso vai aparecer nos logs da Railway
            console.log(`[${status.elapsed}'] ${equipes.home.name} ${gols.home} x ${gols.away} ${equipes.away.name}`);
        });

    } catch (erro) {
        console.log("Falha ao ligar à API: " + erro.message);
    }
}

// Roda a primeira vez assim que o servidor liga
verificarJogosAoVivo();

// Loop que roda a cada 5 minutos (300.000 milissegundos)
setInterval(verificarJogosAoVivo, 300000);
