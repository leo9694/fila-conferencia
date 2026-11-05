const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { ambienteSankhyaTeste, executeQuery } = require('./sankhyaApi');
const { formatarMensagem } = require('./emailFreteFormato');
const { enderecoValido, namespaceEmailFrete, obterConfiguracaoEmailFrete, enviarEmailFrete, verificarConexaoEmailFrete } = require('./emailFrete');
const {
  TAMANHO_PAGINA, LOTE_DESCOBERTA, listarNotasSemCarga, obterMarcoCargas,
  obterJanelaCargas, descobrirNotasComCarga, consultarNotasParaEnvio, consultarEmailsContatos, consultarPedidosOrigemNotas
} = require('./emailFreteAutomacaoConsulta');

const INTERVALO = 60_000;
const limiteAnexoDanfe = 8 * 1024 * 1024;
const fusoHorario = process.env.APP_TIMEZONE || 'America/Cuiaba';
const dataLocal = new Intl.DateTimeFormat('sv-SE', { timeZone: fusoHorario });
const motivoNfe = 'Aguardando autorização da NF-e.';
const variaveis = {
  nome_cliente: 'cliente',
  chave_nfe: 'chave',
  nome_transportadora: 'transportadora',
  email_transportadora: 'emailTransportadora',
  numero_pedido: 'numeroPedido'
};
const modeloPadrao = {
  assunto: 'Seu pedido saiu para entrega',
  mensagem: 'Olá, {{nome_cliente}}!\n\nSeu pedido saiu para entrega com a transportadora {{nome_transportadora}}.\n\nChave da NF-e: {{chave_nfe}}.',
  anexarDanfe: false
};
const marcador = /{{\s*([^{}]+?)\s*}}/g;

function falha(code) { return Object.assign(new Error(code), { code }); }

function dataIsoValida(valor) {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const data = new Date(valor);
  return Number.isFinite(data.getTime()) && data.toISOString().slice(0, 10) === valor;
}

function intervaloHistorico({ inicio, fim }, agora) {
  if (inicio === undefined && fim === undefined) {
    fim = dataLocal.format(agora());
    inicio = new Date(Date.parse(fim) - 86_400_000).toISOString().slice(0, 10);
  }
  if (!dataIsoValida(inicio) || !dataIsoValida(fim) || inicio > fim) throw falha('FRETE_HISTORICO_PERIODO_INVALIDO');
  return { inicio, fim };
}

function validarModelo({ assunto, mensagem, anexarDanfe = false }) {
  if (typeof assunto !== 'string' || typeof mensagem !== 'string' ||
      typeof anexarDanfe !== 'boolean' || !assunto.trim() || !mensagem.trim() ||
      assunto.length > 180 || mensagem.length > 8000 || /[\r\n]/.test(assunto)) {
    throw falha('FRETE_MODELO_INVALIDO');
  }
  for (const texto of [assunto, mensagem]) {
    const semVariaveis = texto.replace(marcador, (_, nome) => {
      if (!Object.hasOwn(variaveis, nome)) throw falha('FRETE_MODELO_VARIAVEL');
      return '';
    });
    if (/{{|}}/.test(semVariaveis)) throw falha('FRETE_MODELO_VARIAVEL');
  }
  return { assunto: assunto.trim(), mensagem: mensagem.trim(), anexarDanfe };
}

function renderizarModelo(modelo, nota) {
  const substituir = (texto, converter = String) => texto.replace(marcador, (_, nome) => converter(nota[variaveis[nome]]));
  const { text, html } = formatarMensagem(modelo.mensagem, substituir);
  return {
    subject: substituir(modelo.assunto).replace(/[\r\n]+/g, ' '),
    text,
    html: `<div>${html.replace(/\r\n?|\n/g, '<br>')}</div>`
  };
}

function primeiroEmail(...enderecos) {
  return enderecos.flatMap((valor) => String(valor ?? '').split(/[;,\r\n]/))
    .map((valor) => valor.trim()).find(enderecoValido);
}

function resumirNota(row) {
  const email = primeiroEmail(row.EMAILNFE, row.EMAIL, row.EMAILNOTIFENTREGA, row.EMAILDANFE, row.EMAILCTE, row.EMAILNFSE) || '';
  return {
    nunota: Number(row.NUNOTA), nota: Number(row.NUMNOTA) || null, empresa: Number(row.CODEMP),
    data: row.DATA_NOTA, ordem: Number(row.ORDEMCARGA) || null,
    cliente: row.CLIENTE?.trim() || '', transportadora: row.TRANSPORTADORA?.trim() || '', email
  };
}

async function resolverEmailsNotas(query, rows, incluirTransportadora = false) {
  const registros = rows.map((row) => ({
    row,
    nota: resumirNota(row),
    emailTransportadora: incluirTransportadora ? primeiroEmail(
      row.EMAIL_TRANSPORTADORA, row.EMAILNOTIFENTREGA_TRANSPORTADORA, row.EMAILCTE_TRANSPORTADORA,
      row.EMAILNFE_TRANSPORTADORA, row.EMAILDANFE_TRANSPORTADORA, row.EMAILNFSE_TRANSPORTADORA
    ) : undefined
  }));
  const codigos = [];
  for (const { row, nota, emailTransportadora } of registros) {
    if (!nota.email) codigos.push(row.CODPARC);
    if (incluirTransportadora && !emailTransportadora) codigos.push(row.CODPARCTRANSP);
  }
  const emailsContatos = new Map();
  for (const contato of await consultarEmailsContatos(query, codigos)) {
    const codigo = Number(contato.CODPARC);
    const email = primeiroEmail(contato.EMAIL);
    if (email && !emailsContatos.has(codigo)) emailsContatos.set(codigo, email);
  }
  for (const registro of registros) {
    const { row, nota } = registro;
    if (!nota.email) nota.email = emailsContatos.get(Number(row.CODPARC)) || '';
    if (incluirTransportadora && !registro.emailTransportadora) {
      registro.emailTransportadora = emailsContatos.get(Number(row.CODPARCTRANSP));
    }
  }
  return registros;
}

async function resolverNumerosPedidos(query, ids) {
  const numeros = new Map();
  for (const vinculo of await consultarPedidosOrigemNotas(query, ids)) {
    const nunota = Number(vinculo.NUNOTA);
    const pedido = Number(vinculo.NUNOTAORIG);
    if (!Number.isSafeInteger(pedido) || pedido <= 0) continue;
    if (!numeros.has(nunota)) numeros.set(nunota, new Set());
    numeros.get(nunota).add(pedido);
  }
  return numeros;
}

function criarAutomacaoEmailFrete({
  query = executeQuery, enviar = enviarEmailFrete, verificar = verificarConexaoEmailFrete,
  obterConta = obterConfiguracaoEmailFrete, obterDanfe,
  diretorio = path.join(process.cwd(), 'data', `email-frete-automacao-${namespaceEmailFrete()}`),
  agora = Date.now
} = {}) {
  const arquivo = path.join(diretorio, 'estado.json');
  let executando = false;
  let alterandoAtivacao = false;
  let timer;
  let parando = false;
  let emEnvio = null;

  function ler() {
    try {
      return JSON.parse(fs.readFileSync(arquivo, 'utf8'));
    } catch (erro) {
      if (erro.code !== 'ENOENT') throw erro;
      return { ativa: false, modelo: modeloPadrao, notas: {} };
    }
  }

  function atualizar(mutacao) {
    const estado = ler();
    mutacao(estado);
    fs.mkdirSync(diretorio, { recursive: true, mode: 0o700 });
    const temporario = path.join(diretorio, `${randomUUID()}.json`);
    try {
      fs.writeFileSync(temporario, JSON.stringify(estado), { mode: 0o600, flag: 'wx', flush: true });
      fs.renameSync(temporario, arquivo);
    } finally {
      fs.rmSync(temporario, { force: true });
    }
    return estado;
  }

  function configuracao() {
    const { ativa, modelo } = ler();
    return { ativa, modelo, variaveis: Object.keys(variaveis) };
  }

  function salvarModelo(dados) {
    const modelo = validarModelo(dados);
    atualizar((estado) => { estado.modelo = modelo; });
    return modelo;
  }

  async function ativar(ativa) {
    if (typeof ativa !== 'boolean') throw falha('FRETE_AUTOMACAO_INVALIDA');
    if (alterandoAtivacao) throw falha('FRETE_AUTOMACAO_OCUPADA');
    if (ler().ativa === ativa) return configuracao();
    alterandoAtivacao = true;
    try {
      if (ativa) await verificar();
      const marco = ativa && !ler().marco ? await obterMarcoCargas(query) : null;
      atualizar((estado) => {
        if (marco) Object.assign(estado, marco, { desde: marco.marco, cursor: null });
        estado.ativa = ativa;
      });
      return configuracao();
    } finally {
      alterandoAtivacao = false;
    }
  }

  async function listar({ pagina: paginaRaw, visao, inicio: dataInicial, fim: dataFinal }) {
    const pagina = Number(paginaRaw || 1);
    if (!Number.isSafeInteger(pagina) || pagina < 1 || pagina > 100000 ||
        !['aguardando', 'historico'].includes(visao)) throw falha('FRETE_AUTOMACAO_INVALIDA');
    const inicio = (pagina - 1) * TAMANHO_PAGINA;
    if (visao === 'aguardando') {
      const itens = (await resolverEmailsNotas(query, await listarNotasSemCarga(query, pagina))).map(({ nota }) => nota);
      return { itens: itens.slice(0, TAMANHO_PAGINA), pagina, temMais: itens.length > TAMANHO_PAGINA };
    }
    const intervalo = intervaloHistorico({ inicio: dataInicial, fim: dataFinal }, agora);
    const itens = Object.values(ler().notas).filter(({ detectadaEm }) => {
      const data = dataLocal.format(new Date(detectadaEm));
      return data >= intervalo.inicio && data <= intervalo.fim;
    }).sort((a, b) => b.detectadaEm.localeCompare(a.detectadaEm) || b.nunota - a.nunota)
        .slice(inicio, inicio + TAMANHO_PAGINA + 1).map(({ messageId, reverEm, ...nota }) => nota.status === 'enviando' && nota.nunota !== emEnvio
          ? { ...nota, status: 'revisar', motivo: 'O resultado do envio não pôde ser confirmado.' }
          : nota);
    return { itens: itens.slice(0, TAMANHO_PAGINA), pagina, temMais: itens.length > TAMANHO_PAGINA, intervalo, fusoHorario };
  }

  async function descobrir(estado) {
    const janela = await obterJanelaCargas(query);
    if (janela.ATE < estado.desde) return;
    const rows = await descobrirNotasComCarga(query, { ...estado, ate: janela.ATE });
    const ultima = rows.at(-1);
    const novos = await resolverEmailsNotas(query, rows.filter((row) => !estado.notas[row.NUNOTA]));
    atualizar((atual) => {
      for (const { nota } of novos) {
        if (atual.notas[nota.nunota]) continue;
        atual.notas[nota.nunota] = {
          ...nota, detectadaEm: new Date(agora()).toISOString(), status: 'pendente', reverEm: 0
        };
      }
      if (rows.length === LOTE_DESCOBERTA) atual.cursor = { data: ultima.EVENTO, nunota: ultima.NUNOTA };
      else {
        atual.desde = janela.SOBREPOSICAO > atual.marco ? janela.SOBREPOSICAO : atual.marco;
        atual.cursor = null;
      }
    });
  }

  function reservar(nunota, messageId) {
    try {
      fs.writeFileSync(path.join(diretorio, `envio-${nunota}.json`), JSON.stringify({ messageId }),
        { flag: 'wx', mode: 0o600, flush: true });
      return true;
    } catch (erro) {
      if (erro.code === 'EEXIST') return false;
      throw erro;
    }
  }

  function registrar(nunota, dados) {
    atualizar((estado) => Object.assign(estado.notas[nunota], dados));
  }

  async function prepararAnexo(nota) {
    const pdf = await obterDanfe(nota.nunota);
    if (!Buffer.isBuffer(pdf) || !pdf.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw falha('FRETE_DANFE_INDISPONIVEL');
    if (pdf.length > limiteAnexoDanfe) throw falha('FRETE_DANFE_TAMANHO');
    return { filename: `DANFE-${nota.nota || nota.nunota}.pdf`, content: pdf, contentType: 'application/pdf' };
  }

  async function enviarNota(nota, dadosModelo, modelo, remetente, anexo) {
    const messageId = `<frete-${nota.nunota}-${randomUUID()}@${remetente.split('@').at(-1)}>`;
    if (!reservar(nota.nunota, messageId)) {
      atualizar((estado) => {
        const registro = estado.notas[nota.nunota];
        if (registro?.status === 'pendente') {
          Object.assign(registro, { status: 'revisar', motivo: 'Já existe um registro de tentativa para esta nota.' });
        }
      });
      return;
    }
    emEnvio = nota.nunota;
    try {
      registrar(nota.nunota, { ...nota, destinatario: nota.email, status: 'enviando', messageId, motivo: '' });
      const resultado = await enviar({
        to: nota.email, ...renderizarModelo(modelo, { ...nota, ...dadosModelo }), messageId,
        ...(anexo && { attachments: [anexo] })
      }).catch((erro) => {
        const recusado = ['EAUTH', 'ENOAUTH', 'EENVELOPE'].includes(erro.code) || (erro.responseCode >= 400 && erro.responseCode < 600);
        registrar(nota.nunota, {
          status: recusado ? 'falha' : 'revisar',
          motivo: recusado ? 'O servidor SMTP recusou o envio.' : 'O resultado do envio não pôde ser confirmado.'
        });
        return null;
      });
      if (!resultado) return;
      registrar(nota.nunota, resultado.accepted?.length ? {
        status: 'enviado', enviadoEm: new Date(agora()).toISOString(), danfeAnexado: Boolean(anexo)
      } : { status: 'falha', motivo: 'O servidor SMTP não aceitou o destinatário.' });
    } finally {
      emEnvio = null;
    }
  }

  async function executar() {
    if (executando || parando) return;
    executando = true;
    try {
      const estado = ler();
      if (!estado.marco) return;
      await descobrir(estado);
      if (!ler().ativa) return;
      const conta = await obterConta();
      if (!conta.configurado || !enderecoValido(conta.user)) return;
      const ambienteTeste = ambienteSankhyaTeste();
      const pendentes = Object.values(ler().notas).filter((n) => n.status === 'pendente' &&
        (n.reverEm <= agora() || (ambienteTeste && n.motivo === motivoNfe)))
        .sort((a, b) => a.reverEm - b.reverEm || a.nunota - b.nunota).slice(0, 50);
      const rows = await consultarNotasParaEnvio(query, estado.cargas, pendentes.map((n) => n.nunota), ambienteTeste);
      const registros = await resolverEmailsNotas(query, rows, true);
      const atuais = new Map(registros.map((registro) => [registro.nota.nunota, registro]));
      let pedidosOrigem;
      let tentativas = 0;
      for (const anterior of pendentes) {
        const atual = ler();
        if (!atual.ativa || parando || tentativas >= 5) break;
        if (atual.notas[anterior.nunota]?.status !== 'pendente') continue;
        const registro = atuais.get(anterior.nunota);
        const row = registro?.row;
        const nota = registro?.nota ?? anterior;
        const chaveValida = /^\d{44}$/.test(row?.CHAVENFE || '');
        const motivo = !row ? 'Nota sem vínculo ativo com a carga.'
          : !ambienteTeste && !chaveValida ? motivoNfe
            : !nota.email ? 'Cliente sem e-mail válido no cadastro ou nos contatos ativos.'
              : !nota.cliente || !nota.transportadora ? 'Cliente ou transportadora sem nome no cadastro.' : '';
        if (motivo) {
          registrar(nota.nunota, { ...nota, motivo, reverEm: agora() + 10 * INTERVALO });
          continue;
        }
        tentativas += 1;
        if (!pedidosOrigem && /{{\s*numero_pedido\s*}}/.test(`${atual.modelo.assunto}\n${atual.modelo.mensagem}`)) {
          pedidosOrigem = await resolverNumerosPedidos(query, rows.map((item) => item.NUNOTA));
          if (!ler().ativa || parando) break;
        }
        let anexo;
        if (atual.modelo.anexarDanfe === true && chaveValida && (!ambienteTeste || row.STATUSNFE === 'A')) {
          try {
            anexo = await prepararAnexo(nota);
          } catch (erro) {
            if (!ambienteTeste) {
              registrar(nota.nunota, {
                ...nota, motivo: erro.code === 'FRETE_DANFE_TAMANHO'
                  ? 'DANFE acima do limite de 8 MB.'
                  : 'Aguardando o PDF do DANFE no Sankhya.',
                reverEm: agora() + 10 * INTERVALO
              });
              continue;
            }
          }
          if (!ler().ativa || parando) break;
        }
        await enviarNota(nota, {
          chave: chaveValida ? row.CHAVENFE : 'não disponível',
          emailTransportadora: registro.emailTransportadora || 'não disponível',
          numeroPedido: [...(pedidosOrigem?.get(nota.nunota) || [])].join(' / ') || 'não disponível'
        }, atual.modelo, conta.user, anexo);
      }
    } finally {
      executando = false;
    }
  }

  function iniciar() {
    if (timer) return;
    parando = false;
    timer = setInterval(() => {
      executar().catch((erro) => console.error('Falha na automação de Email frete:', erro.code || erro.name));
    }, INTERVALO);
    timer.unref();
  }

  function parar() {
    parando = true;
    clearInterval(timer);
    timer = null;
  }

  return { configuracao, salvarModelo, ativar, listar, executar, iniciar, parar };
}

module.exports = { criarAutomacaoEmailFrete };
