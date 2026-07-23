const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function criarNamespace(valor) {
  return String(valor || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'padrao';
}

function carregar(filePath) {
  if (!fs.existsSync(filePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    console.error('Falha ao carregar as Guias FASE:', error);
    return {};
  }
}

function nomeSeguro(valor) {
  return path.basename(String(valor || 'guia-fase'))
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, 180) || 'guia-fase';
}

function extensaoPorMime(mimeType) {
  return {
    'application/pdf': '.pdf',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp'
  }[String(mimeType || '').toLowerCase()] || '';
}

function criarGuiaFaseStore(options = {}) {
  const namespace = criarNamespace(options.namespace);
  const baseDir = options.baseDir || path.join(process.cwd(), 'data');
  const filePath = options.filePath || path.join(baseDir, `guia-fase-${namespace}.json`);
  const arquivosDir = options.arquivosDir || path.join(baseDir, `guia-fase-${namespace}`);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.mkdirSync(arquivosDir, { recursive: true });
  const state = carregar(filePath);

  function persistir() {
    const temporario = `${filePath}.tmp`;
    fs.writeFileSync(temporario, JSON.stringify(state, null, 2), 'utf8');
    fs.renameSync(temporario, filePath);
  }

  function listar(nunota) {
    return (state[String(nunota)] || []).map(({ arquivoInterno, ...guia }) => ({ ...guia }));
  }

  function quantidade(nunota) {
    return (state[String(nunota)] || []).length;
  }

  function adicionar({ nunota, arquivos, codUsu = null }) {
    const chave = String(Number(nunota));
    const diretorioPedido = path.join(arquivosDir, chave);
    fs.mkdirSync(diretorioPedido, { recursive: true });
    const criados = [];
    const anteriores = [...(state[chave] || [])];

    try {
      for (const arquivo of arquivos || []) {
        const id = crypto.randomUUID();
        const arquivoInterno = `${id}${extensaoPorMime(arquivo.mimetype)}`;
        const destino = path.join(diretorioPedido, arquivoInterno);
        fs.writeFileSync(destino, arquivo.buffer);
        criados.push({
          id,
          nunota: Number(nunota),
          nome: nomeSeguro(arquivo.originalname),
          mimeType: arquivo.mimetype,
          tamanho: Number(arquivo.size || arquivo.buffer?.length || 0),
          enviadoEm: new Date().toISOString(),
          codUsu: codUsu === null || codUsu === undefined ? null : Number(codUsu),
          arquivoInterno
        });
      }

      state[chave] = [...anteriores, ...criados];
      persistir();
      return listar(nunota);
    } catch (error) {
      if (anteriores.length) state[chave] = anteriores;
      else delete state[chave];
      criados.forEach((guia) => {
        const destino = path.join(diretorioPedido, guia.arquivoInterno);
        if (fs.existsSync(destino)) fs.unlinkSync(destino);
      });
      throw error;
    }
  }

  function obterArquivo(nunota, id) {
    const guia = (state[String(nunota)] || []).find((item) => item.id === String(id));
    if (!guia) return null;
    const arquivoPath = path.join(arquivosDir, String(Number(nunota)), guia.arquivoInterno);
    if (!fs.existsSync(arquivoPath)) return null;
    return {
      ...guia,
      path: arquivoPath
    };
  }

  function excluir(nunota, id) {
    const chave = String(Number(nunota));
    const guias = state[chave] || [];
    const indice = guias.findIndex((item) => item.id === String(id));
    if (indice < 0) return false;
    const [removida] = guias.splice(indice, 1);
    if (guias.length === 0) delete state[chave];
    persistir();

    const arquivoPath = path.join(arquivosDir, chave, removida.arquivoInterno);
    try {
      if (fs.existsSync(arquivoPath)) fs.unlinkSync(arquivoPath);
    } catch (error) {
      console.error('A Guia FASE foi removida do pedido, mas o arquivo fisico nao pode ser apagado:', error);
    }
    return true;
  }

  return {
    filePath,
    arquivosDir,
    namespace,
    state,
    adicionar,
    excluir,
    listar,
    obterArquivo,
    quantidade
  };
}

module.exports = { criarGuiaFaseStore };
