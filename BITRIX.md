# Integracao Bitrix24

Configure `BITRIX_WEBHOOK_URL` no `.env`. O webhook e usado somente pelo backend.
O botao do perfil do cliente usa `BITRIX_FUNNEL_NAME` e `BITRIX_FUNNEL_STAGE` para localizar o destino sem fixar IDs internos.
Defina `BITRIX_DEFAULT_ASSIGNED_BY_ID` para atribuir todos os cards a um usuario fixo sem consultar `user.get`. Para atribuir o responsavel pelo nome, remova essa variavel e conceda ao webhook permissao de leitura de usuarios. Como alternativa, configure `BITRIX_USER_MAP` com a relacao entre `CODUSU` Sankhya e ID do usuario Bitrix.

## Teste somente leitura

```bash
npm run test:bitrix
```

O teste consulta `profile`, funis e etapas. Ele nao cria nem altera registros.

## Exemplos controlados

```js
const bitrix = require('./api/bitrixService');

const contato = await bitrix.criarContato({
  codigo: 1234,
  nome: 'CLIENTE EXEMPLO',
  telefone: '66 996578697',
  email: 'cliente@exemplo.com'
});

const negocio = await bitrix.criarNegocio({
  contactId: contato.id || contato.contato.ID,
  fields: {
    TITLE: 'Pedido Sankhya 123456',
    CATEGORY_ID: 0,
    STAGE_ID: 'NEW'
  }
});
```

Essas operacoes de escrita so acontecem quando chamadas explicitamente. Nenhuma sincronizacao automatica foi habilitada.
