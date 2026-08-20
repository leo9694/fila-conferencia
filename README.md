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
```

Arquitetura:

- `api/whatsappApi.js`: cliente HTTP e ponte Socket.IO servidor-servidor.
- `api/chatRouter.js`: proxy autenticado, upload, mídia e eventos SSE.
- `frontend/chat.js`: estado, conversas, mensagens, anexos, áudio e templates.
- `frontend/chat-core.js`: regras puras cobertas por testes.
- `frontend/chat.css`: layout responsivo em três, duas ou uma coluna.

O histórico usa paginação REST. Atualizações em tempo real chegam pelo Socket.IO no backend e são distribuídas à sessão web por SSE. Os testes não enviam mensagens reais.
