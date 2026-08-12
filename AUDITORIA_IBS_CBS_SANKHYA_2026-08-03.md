# Auditoria somente leitura — Reforma Tributária IBS/CBS

**Ambiente:** Sankhya de produção  
**Empresa:** 1 — NORTE SUL SEMENTES  
**Data/hora da auditoria no banco:** 03/08/2026 09:09:40  
**Escopo:** consultas `SELECT` e metadados; nenhum registro foi criado, alterado, excluído, confirmado ou processado.

## 0. Metadados localizados

| Assunto | Entidade/tabela localizada | Campos principais confirmados no dicionário |
|---|---|---|
| Empresas | `TSIEMP` | `CODEMP`, `RAZAOSOCIAL`, `NOMEFANTASIA` |
| Nota Técnica NF-e/NFC-e | `TGFNFENT` | `CODEMP`, `VERSAONT`, `DTENTHOMOLOG`, `DTENTPROD`, `ATIVONT` |
| Opções das Notas Técnicas | `TDDCAM` + `TDDOPC` | `TGFNFENT.VERSAONT`; valor `13` = “Nota Técnica 2025.002 - RTC” |
| Tipos de Operação e versões | `TGFTOP` | `CODTIPOPER`, `DHALTER`, `DESCROPER`, `ATIVO`; a validade final foi derivada pela próxima `DHALTER` da mesma TOP |
| Modelo e tipo de NF-e da TOP | `TGFTOP` | `CODMODDOC`, `NFE`; dicionário: modelo `55` = “Nota Fiscal Eletrônica” e `NFE='N'` = “Normal” |
| Indicadores RTC da TOP | `TGFTOP` | `TEMIBS`, `TEMCBS`, `TEMIS`, `TEMIBSCBSMONO` |
| Regras IBS | `TLFALIQIBS` | `IDIBS`, critérios de aplicação, `CODCST`, `CODCCLASTRIB`, `PIBSUF`, `PIBSMUN`, `DTINIVIG`, `DTFIMVIG`, `ATIVO` |
| Regras CBS | `TLFALIQCBS` | `IDCBS`, critérios de aplicação, `CODCST`, `CODCCLASTRIB`, `PCBS`, `DTINIVIG`, `DTFIMVIG`, `ATIVO` |
| Regras IS | `TLFALIQIS` | `IDIS`, critérios, CST, cClassTrib, alíquota e vigência |
| Regras monofásicas | `TLFICMONO` | `IDIBSCBSMONO`, critérios, alíquotas ad rem e vigência |
| CST e cClassTrib oficiais | `TLFCSTIC`, `TLFCLASTRIBIC` | CST, indicadores IBS/CBS/monofasia, cClassTrib, documentos e vigência |
| Log do Assistente Integral | `TLFREFWIZLOG`, `TLFREFWIZLOGERR` | usuário, data/hora, quantidades IBS/CBS e erros |
| Apuração da Reforma | `TAIAPURREF` | `CODEMP`, período e status do protocolo |
| Jobs | `TSIEJO` | `ID`, descrição, ativo, última/próxima execução, status e mensagem de erro |
| Produtos e NCM | `TGFPRO`, `TLFNCM`, `TLFNBS` | ativo, NCM, status NCM, Grupo IBS/CBS e cadastro oficial ativo |
| Parceiros | `TGFPAR` | cliente, ativo, `GRUPOIBSCBS`, `NUFOP`, classificação ICMS e município |
| NF-e/XML | `TGFCAB`, `TGFNFE` | documento, status NF-e, chave, protocolo e XML |
| Valores RTC do documento | `TGFREFIMP`, `TLFDINVR`, `TGFITE` | totais IBS/CBS/IS/monofásico e detalhamento fiscal por item |

Não foi localizada uma entidade inequívoca que confirme, por empresa, as licenças/habilitações de **Apuração IBS**, **Apuração CBS**, **DeRE** ou a permissão de tela do Assistente de Exceções. Esses itens permanecem **NÃO VALIDADOS** quando não houver outra evidência abaixo.

## 1. Resumo executivo

| Status | Resultado |
|---|---|
| **OK** | Empresa 1 confirmada; Nota Técnica 2025.002 - RTC ativa; TOP principal 35 vinculada ao modelo 55/NF-e normal; regras integrais IBS e CBS encontradas com CST, cClassTrib e alíquotas esperadas. |
| **ERRO** | A TOP 35 está com `TEMIS='S'` e `TEMIBSCBSMONO='S'`, mas não existe regra de IS nem regra monofásica aplicável. O esperado era “Não”. |
| **ERRO** | Nenhuma NF-e da TOP 35 foi emitida depois da execução do Assistente em 03/08/2026; as 1.995 NF-e anteriores não contêm grupo IBS/CBS no XML. O cálculo atual não foi validado em documento real. |
| **ATENÇÃO** | As TOPs 171 e 195 também contêm “Venda de Mercadorias”, usam modelo 55, mas seus quatro indicadores RTC estão nulos. Não houve uso delas na empresa 1 desde 01/01/2026. |
| **ATENÇÃO** | As regras têm `DTINIVIG` armazenada como `01/01/2026 04:00:00`. A data civil é a esperada, mas o componente de hora deve ser confirmado quanto à interpretação de fuso/limite inicial. |
| **ATENÇÃO** | O job -22008 não foi encontrado em `TSIEJO`. |

**Conclusão objetiva: CONFIGURAÇÃO COM ERRO.**

## 2. Itens confirmados

- **OK — Empresa:** `TSIEMP.CODEMP=1`, `NOMEFANTASIA='NORTE SUL SEMENTES'`, `RAZAOSOCIAL='NORTE SUL SEMENTES LTDA'`.
- **OK — Nota Técnica:** `TGFNFENT`, empresa 1, `VERSAONT=13`, `ATIVONT='S'`; o dicionário mapeia 13 para “Nota Técnica 2025.002 - RTC”. Produção prevista em `06/10/2025`.
- **OK — Documento:** `TGFTOP.CODMODDOC=55` e `TGFTOP.NFE='N'` na TOP 35; o dicionário identifica esses valores como “Nota Fiscal Eletrônica” e “Normal”.
- **OK — IBS integral:** `TLFALIQIBS.IDIBS=6`, ativo, empresa 1, TOP 35, CST 000, cClassTrib 000001, IBS UF 0,10%, IBS município 0%.
- **OK — CBS integral:** `TLFALIQCBS.IDCBS=6`, ativo, empresa 1, TOP 35, CST 000, cClassTrib 000001, CBS 0,90%.
- **OK — Correspondência IBS/CBS:** nenhuma regra IBS ativa sem CBS, nenhuma CBS sem IBS e nenhuma divergência de CST/cClassTrib entre pares com a mesma `CHAVEUNICA`.
- **OK — Duplicidade básica:** uma regra IBS e uma CBS para empresa 1/TOP 35; seis chaves ativas e seis distintas em cada tabela no ambiente. Não há regra ativa sem empresa nem sem TOP em 2026.
- **OK — Log do Assistente:** integração 1 em 03/08/2026 08:27:32, 6 regras IBS, 6 regras CBS e 0 erros.

## 3. Itens incorretos

1. **ERRO — IS indevidamente ligado:** `TGFTOP.TEMIS='S'` nas versões da TOP 35 vigentes em 01/01/2026 e atualmente. Consulta em `TLFALIQIS` retornou zero regra ativa/aplicável para empresa 1/TOP 35/2026.
2. **ERRO — Monofásico indevidamente ligado:** `TGFTOP.TEMIBSCBSMONO='S'` nas mesmas versões. Consulta em `TLFICMONO` retornou zero regra ativa/aplicável.
3. **ERRO — Sem prova de cálculo após a configuração:** zero NF-e da TOP 35 emitida depois do log do Assistente; os XMLs anteriores não possuem IBS/CBS.
4. **ERRO cadastral:** 22 produtos ativos sem NCM e 66 produtos ativos cujo NCM não foi encontrado ativo em `TLFNCM`.

## 4. Alertas

- **ATENÇÃO — Hora da vigência:** `TLFALIQIBS.DTINIVIG` e `TLFALIQCBS.DTINIVIG` dos IDs 6 = `01/01/2026 04:00:00`. Com comparação por `TRUNC`, a data é 01/01/2026; com comparação de timestamp bruto, as primeiras quatro horas ficariam fora.
- **ATENÇÃO — Outras TOPs:** 171 e 195 têm descrição contendo “Venda de Mercadorias”, modelo 55 e NF-e normal, mas `TEMIBS`, `TEMCBS`, `TEMIS` e `TEMIBSCBSMONO` estão nulos. Não houve documentos dessas TOPs na empresa 1 desde 01/01/2026.
- **ATENÇÃO — Exceções:** não existe regra IBS nem CBS de exceção ativa para empresa 1; isso é aceitável somente se não houver casos legais específicos.
- **ATENÇÃO — Cadastros:** todos os 3.068 produtos ativos e todos os 4.569 clientes ativos estão sem Grupo IBS/CBS. As regras integrais atuais não usam grupo, mas futuras exceções por grupo não poderão ser selecionadas corretamente sem classificação.
- **ATENÇÃO — Finalidade:** os 4.569 clientes ativos têm `TGFPAR.NUFOP` nulo; as 879 notas da TOP 35 nos últimos 90 dias também usam `TGFCAB.NUFOP` nulo. A regra integral atual é geral (`NUFOP` nulo), portanto isso não impediu sua localização.

## 5. Itens não validados

| Status | Item | Motivo |
|---|---|---|
| **NÃO VALIDADO** | Versão exata do Sankhya | Não foi localizada por metadados/SELECT uma entidade inequívoca de versão instalada. |
| **NÃO VALIDADO** | Versão do módulo Livros Fiscais | Não foi localizada entidade inequívoca de versão do módulo. |
| **NÃO VALIDADO** | Licença/permissão da tela Assistente de Exceções | As tabelas existem, mas isso não comprova permissão de tela por usuário/empresa. |
| **NÃO VALIDADO** | Habilitação por empresa de Apuração IBS, Apuração CBS e DeRE | Não foi localizado cadastro inequívoco de habilitação. `TAIAPURREF` existe, mas possui zero registros da empresa 1. |
| **NÃO VALIDADO** | Empresas, documentos, TOPs e vigência selecionados no log do Assistente | `TLFREFWIZLOG` não possui esses campos. Eles podem ser inferidos das regras criadas, mas não confirmados pelo log. |
| **NÃO VALIDADO** | Rejeição específica da RTC | As NF-e consultadas foram aprovadas, mas nenhuma contém o grupo IBS/CBS; portanto não testaram a RTC configurada hoje. |

## 6. Regras IBS encontradas

### Regra aplicável à empresa 1/TOP principal

| Campo | Evidência |
|---|---|
| Identificador | `TLFALIQIBS.IDIBS=6` |
| Empresa | `CODEMP=1` |
| TOP/versão | `CODTIPOPER=35`; `DHALTER=09/01/2026 08:14:24` |
| CST | `CODCST='000'` |
| cClassTrib | `CODCCLASTRIB='000001'` |
| Alíquota | `PIBSUF=0,10`; `PIBSMUN=0` |
| Vigência | `DTINIVIG=01/01/2026 04:00:00`; `DTFIMVIG` nulo |
| Situação | `ATIVO='S'` |
| Critérios gerais | `CODREGTRIB=0`, `CODCNAE='0'`, `CODUF=0`, `CODCID=0`; NCM, NBS, finalidade, produto, parceiro e grupos nulos |

Resultado: **OK**, com **ATENÇÃO** para o horário 04:00 da vigência.

## 7. Regras CBS encontradas

| Campo | Evidência |
|---|---|
| Identificador | `TLFALIQCBS.IDCBS=6` |
| Empresa | `CODEMP=1` |
| TOP/versão | `CODTIPOPER=35`; `DHALTER=09/01/2026 08:14:24` |
| CST | `CODCST='000'` |
| cClassTrib | `CODCCLASTRIB='000001'` |
| Alíquota | `PCBS=0,90` |
| Vigência | `DTINIVIG=01/01/2026 04:00:00`; `DTFIMVIG` nulo |
| Situação | `ATIVO='S'` |
| Critérios gerais | `CODREGTRIB=0`, `CODCNAE='0'`, `CODUF=0`, `CODCID=0`; NCM, NBS, finalidade, produto, parceiro e grupos nulos |

Resultado: **OK**, com **ATENÇÃO** para o horário 04:00 da vigência.

## 8. Situação da TOP

| Status | Código | Descrição | Início da versão | Fim exclusivo | Vigência analisada | Modelo/NF-e | IBS | CBS | IS | Mono |
|---|---:|---|---|---|---|---|---|---|---|---|
| **ERRO** | 35 | VENDA DE MERCADORIAS | 11/07/2025 14:40:19 | 09/01/2026 08:14:24 | vigente em 01/01/2026 | 55 / Normal | Sim | Sim | **Sim** | **Sim** |
| **ERRO** | 35 | VENDA DE MERCADORIAS | 09/01/2026 08:14:24 | sem fim | vigente atualmente | 55 / Normal | Sim | Sim | **Sim** | **Sim** |
| **ATENÇÃO** | 171 | Venda de Mercadorias -Loja | 16/05/2022 16:23:49 | sem fim | vigente | 55 / Normal | nulo | nulo | nulo | nulo |
| **ATENÇÃO** | 195 | Venda de Mercadorias. AVARIA TRANSP. | 07/02/2024 10:12:43 | sem fim | vigente | 55 / Normal | nulo | nulo | nulo | nulo |

- Não há duas linhas com a mesma chave `CODTIPOPER+DHALTER` nos códigos auditados.
- A cadeia de versões produz apenas uma versão vigente por instante.
- As duas versões de 2026 da TOP 35 não divergem nos campos RTC/modelo: ambas têm IBS/CBS/IS/mono = Sim, modelo 55 e NF-e Normal.
- O erro é o conteúdo de IS e monofásico, não sobreposição de versão.

## 9. Situação da Nota Técnica

**OK.** Evidência: `TGFNFENT`, empresa 1, `VERSAONT=13`, `ATIVONT='S'`, homologação `07/07/2025`, produção `06/10/2025`. O próprio dicionário (`TDDOPC`) identifica o valor 13 como **Nota Técnica 2025.002 - RTC**. A TOP principal usa modelo 55, que corresponde a NF-e.

## 10. Situação dos módulos

| Status | Módulo/etapa | Evidência e classificação |
|---|---|---|
| **OK** | Alíquota Integral | Regras IBS/CBS e log do Assistente encontrados. Obrigatório para o faturamento RTC atual. |
| **NÃO VALIDADO** | Exceção de Alíquota | Estruturas `TLFALIQIBS/CBS` suportam NCM/NBS/produto/parceiro/grupos, mas há zero exceções e a permissão/habilitação da tela não foi confirmada. Condicional a casos fiscais específicos. |
| **NÃO VALIDADO** | Apuração IBS | `TAIAPURREF` existe, porém não há registro para empresa 1 nem cadastro inequívoco de habilitação. Etapa posterior ao faturamento. |
| **NÃO VALIDADO** | Apuração CBS | Mesma evidência da apuração IBS. Etapa posterior ao faturamento. |
| **NÃO VALIDADO** | DeRE | Nenhuma entidade/flag inequívoca foi localizada. Etapa posterior, não evidenciada como requisito do cálculo atual da NF-e. |

Para o faturamento atual são essenciais Nota Técnica, modelo NF-e, indicadores coerentes da TOP, regras integrais e teste em documento. Apuração e DeRE pertencem a etapas posteriores; exceção é necessária apenas quando houver regra fiscal específica.

## 11. Situação dos jobs

| Status | Job | Ativo | Última execução | Status | Erro | Próxima execução |
|---|---|---|---|---|---|---|
| **OK** | -22005 — Agendador Update Tabelas Reforma | Sim | 01/08/2026 02:20:00 | `W` — Aguardando | nenhum; 0 falhas | 16/08/2026 02:20:00 |
| **ATENÇÃO** | -22008 — Agendador Análise DFe – Exceção de Alíquotas | não encontrado | — | — | — | — |

Fonte: `TSIEJO`. Nenhum job foi executado por esta auditoria.

## 12. Exceções de NCM/NBS

- **ATENÇÃO — IBS:** 0 regras ativas de exceção para empresa 1/global em 2026.
- **ATENÇÃO — CBS:** 0 regras ativas de exceção para empresa 1/global em 2026.
- **OK — IS aplicável à TOP 35:** 0 regras; porém a TOP está incorretamente com IS ligado.
- **OK — Monofásico aplicável à TOP 35:** 0 regras; porém a TOP está incorretamente com monofásico ligado.
- Como nenhuma exceção foi encontrada, NCM/NBS, CST, cClassTrib, redução, empresa, TOP, finalidade, parceiro/grupo, UF/município e vigência de exceções não possuem valores a listar.
- A existência das tabelas confirma suporte estrutural, mas a disponibilidade/permissão do Assistente de Exceções permanece **NÃO VALIDADA**. O job esperado -22008 não foi encontrado.

## 13. Problemas em produtos e parceiros

### Produtos ativos

| Status | Medida | Resultado | Evidência |
|---|---|---:|---|
| **OK** | Total ativo | 3.068 | `TGFPRO.ATIVO='S'` |
| **ERRO** | Sem NCM/NCM vazio | 22 | `TGFPRO.NCM` nulo/vazio |
| **OK** | NCM com quantidade de dígitos diferente de 8 | 0 | dígitos de `TGFPRO.NCM` após retirar formatação |
| **ERRO** | NCM não encontrado ativo no cadastro oficial | 66 | comparação de `TGFPRO.NCM` com `TLFNCM.CODNCM`; todos os 26.125 NCM de `TLFNCM` estão ativos |
| **ATENÇÃO** | `STATUSNCM` diferente de “S” | 3.068 | `TGFPRO.STATUSNCM`; o campo não reflete os 2.980 produtos que casaram com NCM oficial ativo |
| **ATENÇÃO** | Sem Grupo IBS/CBS | 3.068 | `TGFPRO.GRUPOIBSCBS` nulo |
| **OK** | Mesmo código com NCM divergente na tabela corrente | 0 | agrupamento por `TGFPRO.CODPROD` |

Exemplos de códigos de produtos com NCM não localizado em `TLFNCM`: 2600/99999999, 2601/99999999, 2602/27100049, 3062/34022000, 3796/85395000, 3847/94003100, 4192/94013090 e 4196/85414021. Nenhum benefício fiscal foi inferido pela descrição do produto.

Principais NCMs nas vendas da empresa 1 nos últimos 90 dias:

| NCM | NF-e/notas | Produtos | Quantidade |
|---|---:|---:|---:|
| 12099100 | 824 | 268 | 278.934 |
| 31052000 | 261 | 39 | 6.998 |
| 31010000 | 252 | 32 | 5.591 |
| 12093000 | 178 | 18 | 4.940 |
| 38089119 | 174 | 17 | 2.498 |
| 38085910 | 152 | 40 | 2.178 |
| 39249000 | 131 | 197 | 2.998 |
| 84244100 | 113 | 4 | 1.759 |
| 09092100 | 85 | 4 | 2.966 |
| 38089996 | 81 | 9 | 1.400 |

### Clientes ativos

| Status | Medida | Resultado | Evidência |
|---|---|---:|---|
| **OK** | Total | 4.569 | `TGFPAR.ATIVO='S' AND CLIENTE='S'` |
| **ATENÇÃO** | Sem Grupo IBS/CBS | 4.569 | `TGFPAR.GRUPOIBSCBS` nulo |
| **ATENÇÃO** | Sem finalidade padrão | 4.569 | `TGFPAR.NUFOP` nulo |
| **ATENÇÃO** | Sem classificação ICMS | 133 | `TGFPAR.CLASSIFICMS` nulo |
| **ERRO** | Sem município | 1 | `TGFPAR.CODCID` nulo/zero |

Não foram expostos nomes nem documentos pessoais de clientes. Como a regra integral encontrada não usa parceiro, grupo, finalidade, UF ou município específicos, os campos nulos não impedem essa regra geral, mas são risco para exceções futuras.

## 14. Validação em NF-e/XML

### Documento mais recente localizado

| Campo | Evidência |
|---|---|
| Nota | `TGFCAB.NUMNOTA=82287`, `NUNOTA=3879517`, emissão/negociação 31/07/2026 |
| TOP | 35 — VENDA DE MERCADORIAS |
| Situação | `STATUSNOTA='L'`; `STATUSNFE='A'` = Aprovada |
| Protocolo/XML | protocolo presente; registro em `TGFNFE`; chave mascarada `***99359570` |
| Grupo IBS/CBS no XML | ausente (`DBMS_LOB.INSTR(TGFNFE.XML,'IBSCBS')=0`) |
| cClassTrib/alíquotas no XML | ausentes |
| Totais RTC | `TGFREFIMP` existe, mas `VBCIBSCBS`, `VIBS`, `VCBS`, `VIS`, `VIBSMONO` e `VCBSMONO` = 0 |
| Detalhes de item RTC | zero registro em `TLFDINVR` para a nota |
| Rejeição | nenhuma; NF-e aprovada, porém sem RTC |

### Cobertura desde 01/01/2026

- 1.995 NF-e confirmadas da empresa 1/TOP 35 com chave e XML.
- 0 XML com a cadeia `IBSCBS`.
- 0 documento com base/valor IBS ou CBS não zero em `TGFREFIMP`.
- 0 NF-e emitida depois do Assistente de 03/08/2026 08:27:32.

Resultado: **ERRO — o cálculo ainda não foi validado em documento real após a configuração atual.** CST, cClassTrib, base, alíquotas e valores não puderam ser comprovados no XML.

## 15. Próximas ações recomendadas

1. Corrigir, por procedimento autorizado fora desta auditoria, a versão atual da TOP 35 para **Tem IS = Não** e **Tem IBS/CBS Monofásico = Não**, salvo documentação fiscal específica que justifique o contrário.
2. Confirmar o significado do horário `04:00:00` em `DTINIVIG` e assegurar que a regra representa o início local de 01/01/2026.
3. Emitir em ambiente/controladoria apropriada uma NF-e de teste da empresa 1/TOP 35 após 03/08/2026 e conferir XML, CST 000, cClassTrib 000001, base, IBS 0,10% e CBS 0,90%. Não usar notas anteriores como prova da configuração atual.
4. Verificar a ausência do job -22008 e a licença/permissão do Assistente de Exceções antes de depender de análise automática de DFe.
5. Revisar os 22 produtos sem NCM e os 66 NCM não encontrados no cadastro oficial; priorizar os códigos usados em vendas recentes.
6. Definir política de Grupo IBS/CBS e finalidade para produtos/clientes antes de cadastrar exceções por grupo/finalidade.
7. Corrigir o cliente ativo sem município e revisar os 133 sem classificação ICMS.
8. Validar com administração/licenciamento as habilitações posteriores de Apuração IBS, Apuração CBS e DeRE.

---

**Conclusão final: CONFIGURAÇÃO COM ERRO.** A base integral IBS/CBS e a Nota Técnica estão cadastradas, mas a TOP principal possui IS e monofásico ligados sem regra, e ainda não existe NF-e posterior à configuração que comprove o cálculo e o XML da RTC.
