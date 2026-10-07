# Fila de Conferência

Aplicação Node.js/Express com frontend estático para os fluxos operacionais integrados ao Sankhya.

## Desenvolvimento

```bash
npm install
npm start
npm test
```

O servidor inicia em `http://localhost:3000`. Não existe etapa de build: os arquivos em `frontend/` são servidos diretamente pelo Express.

## Integração WhatsApp

A aba **Chat** usa exclusivamente a API `https://whatsapp-api.nortesulsementes.com`. O navegador acessa `/api/chat/*` com a sessão já existente; o servidor atua como BFF e adiciona a credencial privada ao encaminhar REST e Socket.IO. Nenhuma chave interna ou credencial da Meta é enviada ao bundle público.

Configure no ambiente do servidor:

```env
WHATSAPP_API_URL=https://whatsapp-api.nortesulsementes.com
WHATSAPP_INTERNAL_API_KEY=chave-interna-da-api
CALL_AGENT_AUTH_SECRET=mesmo-segredo-hmac-do-backend-whatsapp
```

Arquitetura:

- `api/whatsappApi.js`: cliente HTTP e ponte Socket.IO servidor-servidor.
- `api/chatRouter.js`: proxy autenticado, upload, mídia e eventos SSE.
- `frontend/chat.js`: estado, conversas, mensagens, anexos, áudio e templates.
- `frontend/chat-core.js`: regras puras cobertas por testes.
- `frontend/chat.css`: layout responsivo em três, duas ou uma coluna.

O histórico usa paginação REST. Atualizações em tempo real chegam pelo Socket.IO no backend e são distribuídas à sessão web por SSE. Os testes não enviam mensagens reais.

### Teste local e produção compartilhando a API

Use `npm run start:local` neste computador. Esse comando identifica a telefonia como `local` antes de carregar o `.env`, sem modificar o arquivo ou as credenciais. Em produção, `npm start` mantém o ambiente `production` por padrão; também é possível defini-lo explicitamente com `CALL_CLIENT_ENV=production`.

Na API WhatsApp, `CALL_DELIVERY_ENVS=local,production` permite receber chamadas nos dois ambientes (novo padrão quando essa variável não está definida). Se a implantação já define apenas `production`, essa configuração continua restringindo o recebimento ao ambiente de produção e deve ser ajustada para habilitar teste local.

A mesma chamada tem um único dono, escolhido pela API entre atendente, ambiente e aba autenticada. O primeiro aceite interrompe o toque nos demais; outra sessão não pode substituir o áudio, confirmar mídia, transferir ou encerrar a chamada do vencedor. Ligações de saída enviam eventos de progresso ao ambiente que as iniciou. A disponibilidade do mesmo atendente continua compartilhada para impedir que ele entre em duas chamadas ao mesmo tempo.

Publique a API atualizada antes de atualizar o sistema de atendimento: o sistema passa a usar `/api/calls/:callId/claim` para reivindicar a chamada centralmente. A posse central usa memória da API; várias instâncias da API ainda exigem coordenação compartilhada. Não é necessário separar o número nem duplicar os webhooks para executar dois ambientes de frontend.
