# Auditoria de ligações — 07/10/2026

## Complemento: teste local e produção

Confirmada interferência possível entre dois BFFs: cada um tinha sua própria posse local, e ambos podiam conectar mídia com o mesmo ID de atendente no gateway. A autenticação agora assina também o ID da aba; a API centraliza a posse por atendente, ambiente e aba antes de conectar áudio. O segundo ambiente recebe `CALL_SESSION_CONFLICT` e não pode substituir mídia, aceitar transferência ou encerrar a chamada do vencedor.

Foram acrescentados: rota central de claim; `src/services/callSessionStore.js`; controle das sessões outbound e de transferência; registro dos ambientes conectados na presença; roteamento do progresso ao ambiente dono; avisos de posse/encerramento aos demais ambientes; limites de requisições por ambiente/atendente; `scripts/start-local.js` e `npm run start:local`. As credenciais e configurações de produção não foram alteradas. A seção correspondente do README explica implantação e recebimento em ambos os ambientes.

Regressões adicionais simulam o mesmo número/atendente em teste e produção, protegem mídia e encerramento, verificam avisos entre sockets reais locais e preservam a conexão de produção quando teste desconecta. O gateway Go não recebeu novas alterações neste complemento. A posse central continua em memória: os dois frontends devem consumir a mesma instância da API, ou a implantação deve implementar coordenação compartilhada entre instâncias dela.

## Escopo e resultado

Revisão do frontend, das rotas de atendimento, do cliente HTTP/Socket.IO e do código local da API em `../whatsapp-api`. Foram examinados recebimento, aceite, preparação de áudio, saída, recusa, encerramento, transferência, autenticação e reconexão. As correções abaixo estão nos arquivos locais; não foram publicadas em produção.

A causa confirmada no código para os outros atendentes continuarem ouvindo o toque era o filtro SSE: `call:claimed` era enviado somente ao atendente que assumia a chamada. O navegador dos demais já tinha lógica para parar, mas não recebia esse aviso local. O aviso da API só era emitido após concluir a conexão de áudio, ampliando a demora.

## Falhas corrigidas

| Falha | Correção |
| --- | --- |
| Outros atendentes não recebiam o aviso local de aceite. | Distribuição imediata para os atendentes com acesso ao canal, preservando a restrição por número. |
| Reconexão Socket.IO reutilizava o token original, válido por 90 segundos. | Novo token em cada autenticação do socket. |
| Estado do chat geral mascarava a desconexão da telefonia. | Evento separado de conexão da telefonia. |
| Avisos perdidos podiam manter o navegador tocando. | Consulta do estado e da posse a cada cinco segundos enquanto toca e ao reconectar; consulta respeita acesso à conversa. |
| Eventos repetidos ou atrasados reiniciavam o toque ou regrediam o estado visual. | Proteção contra chamadas já assumidas/encerradas, recebimentos duplicados e progresso após atendimento ou encerramento em curso. |
| Atualização ACTIVE sem áudio local mostrava uma chamada ativa para quem não atendeu. | Fechamento do aviso e interrupção do toque. |
| Eventos com chamada aninhada usavam o ID do banco antes do identificador da Meta. | Preferência por `call.callId`. |
| Cancelamento durante operações assíncronas podia prosseguir até criar/aceitar a ligação. | Verificações de encerramento entre etapas; respostas antigas não substituem outra chamada. |
| Falha de mídia após reivindicar deixava a chamada reservada e sem áudio. | Liberação do microfone e tentativa de encerramento da chamada reivindicada; falha ao reivindicar não encerra a chamada de outro atendente. |
| Outra aba podia tentar conectar mídia de chamada já reivindicada. | Verificação da posse e do identificador do dispositivo nas rotas de mídia. |
| Dois aceites ou duas ligações do mesmo atendente podiam avançar simultaneamente. | Travas durante ativação/criação e consulta de chamadas em andamento por atendente e conversa. As travas são locais ao processo. |
| Repetição de media-ready após perda da resposta podia repetir o aceite. | Resposta idempotente quando a chamada já está ativa com o mesmo atendente. |
| Webhooks atrasados reabriam chamadas ativas/encerradas; connect repetido recriava sessão inbound. | Proteção do estado e tratamento idempotente de connect inbound. |
| Comparação de timestamps podia descartar status outbound legítimo no mesmo segundo. | Comparação com a resolução em segundos usada pelo webhook. |
| Cliente desligando durante preparação podia ser aceito ao final. | Nova verificação do estado antes do aceite e da ativação; tratamento de erro preserva estados terminais. |
| Verificação Meta podia retornar ready sem cumprir as amostras consecutivas. | Timeout retorna ready=false quando não comprovou estabilidade. |
| Encerramento só chegava ao dono ou aos disponíveis. | Eventos terminais também alcançam os demais atendentes conectados; o BFF mantém o filtro de canal. |
| Recusa podia manter a presença ocupada. | Limpeza de presença no encerramento por recusa. |
| Operações de ligação com a Meta não tinham prazo explícito. | Timeout nas ações e consultas de permissão; o BFF dá mais tempo ao media-ready, que reúne várias etapas. Não foram adicionadas repetições automáticas genéricas de chamadas POST. |
| Peers recém-criados podiam permanecer abertos após falha de SDP/ICE no gateway. | Fechamento em retornos de erro na preparação inbound e na criação de oferta Meta; fechamento do peer anterior ao substituí-lo. Alteração Go ainda requer teste no ambiente com compilador. |
| Sessões outbound provisórias abandonadas acumulavam recursos. | Expiração após cinco minutos; o descarte verifica a identidade da sessão e preserva chamadas já vinculadas e sessões que substituíram a original. Alteração Go ainda requer teste no ambiente com compilador. |

## Arquivos alterados

Neste projeto: `api/chatRouter.js`, `api/whatsappApi.js`, `frontend/whatsapp-call.js`, `frontend/whatsapp-call-core.js`, `test/chatRouter.test.js`, `test/whatsappApi.test.js`, `test/whatsappCallCore.test.js` e o novo `test/whatsappCallController.test.js`.

Na API: `src/services/call.service.js`, `src/services/callMediaGateway.service.js`, `src/services/whatsapp.service.js`, `src/repositories/call.repository.js`, `test/callBackend.test.js`, `test/callMediaGateway.test.js`, `test/helpers/fakePrisma.js`, `test/multiChannel.test.js`, `media-gateway/main.go` e `media-gateway/main_test.go`. O teste de canal agora encerra a chamada recebida antes de iniciar outra na mesma conversa, conforme a proteção contra duplicidade.

Alterações preexistentes em outros arquivos foram preservadas. Nenhuma credencial ou dado operacional foi alterado.

## Validação

- Testes direcionados executados antes e depois das correções.
- Todos os arquivos `test/*.test.js`: **369 aprovados neste projeto e 123 aprovados na API**, sem falhas ou testes ignorados.
- Cenários incluem disputa entre atendentes/dispositivos, recuperação de aviso perdido, eventos fora de ordem, cancelamento durante preparação, falha de gateway, mídia Meta não pronta, duplicidade outbound e transferências.
- `git diff --check` nos dois projetos: sem erros de whitespace.

## Limites e riscos adicionais identificados

Os testes usam serviços simulados. Não comprovam a frequência dos erros em produção nem o áudio entre navegador, gateway e Meta. Não foram consultados logs de produção, alteradas configurações ou realizadas chamadas reais. Foram adicionados dois testes Go para descarte de sessões abandonadas e preservação de sessões vinculadas/substitutas, mas não foram executados: Go não está disponível neste computador. Antes de publicar o gateway, executar `go test ./...` na pasta `whatsapp-api/media-gateway` e recompilar o serviço.

Posse, presença e travas de concorrência usam memória do processo. Uma implantação com vários processos/servidores exige coordenação compartilhada; reiniciar os serviços durante uma ligação perde parte desse estado. A revisão não verificou se produção usa múltiplas instâncias.

## Validação após publicação

Publicar as alterações dos dois projetos e atualizar as páginas dos atendentes. Validar uma chamada recebida com dois atendentes: ao primeiro assumir, o segundo deve parar imediatamente pelo evento; a consulta periódica serve de recuperação se esse aviso se perder. Repetir com duas abas do mesmo atendente.

Validar áudio nos dois sentidos, saída autorizada, recusa, encerramento pelo cliente, transferência concluída/recusada e reconexão após mais de 90 segundos. Se persistirem erros, correlacionar o mesmo callId nos logs do BFF, API e gateway, incluindo etapa, status HTTP, ICE, estado do peer e idade do último RTP, sem registrar tokens ou SDP completo.
