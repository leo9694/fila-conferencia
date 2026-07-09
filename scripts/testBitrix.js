require('dotenv').config();

const bitrix = require('../api/bitrixService');

async function main() {
  const perfil = await bitrix.testarConexao();
  const funisEtapas = await bitrix.consultarFunisEtapas();

  console.log('Bitrix24 conectado:', {
    conectado: true,
    usuarioId: perfil?.result?.ID || perfil?.result?.id || null
  });
  const resumoFunis = funisEtapas.map(({ funil, etapas }) => ({
    id: funil.id ?? funil.ID,
    nome: funil.name ?? funil.NAME,
    etapas: etapas.map((etapa) => ({
      id: etapa.STATUS_ID ?? etapa.id ?? etapa.ID,
      nome: etapa.NAME ?? etapa.name
    }))
  }));
  console.log('Funis e etapas:');
  console.log(JSON.stringify(resumoFunis, null, 2));
}

main().catch((error) => {
  console.error('Teste Bitrix24 falhou:', error.message);
  process.exitCode = 1;
});
