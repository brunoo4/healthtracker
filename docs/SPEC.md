# garmin-dashboard — Especificação do Projeto

**Versão:** 1.0 · Julho 2026
**Autor:** Bruno Oliveira Almeida
**Status:** MVP em desenvolvimento

---

## 1. Objetivo

Construir um dashboard pessoal de saúde e treino que consome dados do Garmin Connect, armazena histórico próprio e apresenta análises que o app oficial não oferece.

O projeto tem **dois objetivos simultâneos**, e os dois importam:

**Objetivo de produto:** ter uma visão consolidada e histórica dos dados de corrida e saúde, com análises orientadas ao objetivo atual do treino.

**Objetivo de carreira:** servir como peça central de portfólio público, demonstrando competência em backend Node/TypeScript, modelagem de dados relacional, design de API e integração entre sistemas heterogêneos.

O segundo objetivo impõe restrições ao primeiro: decisões técnicas devem ser defensáveis e documentadas, mesmo quando uma solução mais simples resolveria o problema pessoal.

---

## 2. Escopo

### Dentro do escopo (MVP)

- Ingestão periódica de dados do Garmin Connect via script Python
- Persistência de métricas diárias de saúde e atividades físicas em PostgreSQL
- API REST em Node/TypeScript expondo consultas e agregações
- Dashboard React consumindo a API
- Deploy em ambiente público (Railway ou Render)

### Fora do escopo (MVP)

- Autenticação e multi-usuário — sistema de usuário único
- Edição ou escrita de dados de volta no Garmin
- Aplicativo mobile
- Notificações e alertas

### Evoluções previstas (pós-MVP)

Registradas aqui para que a arquitetura não as impeça, mas não implementadas agora:

- Domínio de treino de musculação: registro de sessões, cruzamento com dados de corrida e saúde, insights e sugestões de treino
- Autenticação multi-usuário
- Análises preditivas de performance

---

## 3. Arquitetura

```
Garmin Connect (Cloudflare)
        ↓
Script Python (ingestão agendada)
        ↓
PostgreSQL (dados brutos + normalizados)
        ↓
API Node/TypeScript (lógica de negócio + endpoints)
        ↓
Dashboard React (visualização)
```

### Decisão: por que Python na ingestão e Node na API?

A biblioteca `python-garminconnect` (0.3.0+) é a única com tratamento ativo do bloqueio Cloudflare que a Garmin implementou em março de 2026. Os equivalentes em Node não têm esse tratamento e são frágeis.

Separar ingestão de API tem três benefícios além da necessidade técnica:

1. A quebra da integração externa não derruba a API nem o dashboard
2. Os dados brutos ficam no banco independentemente de o backend estar rodando
3. A API pode ser desenvolvida e testada contra dados persistidos, sem depender do Garmin estar acessível

**Trade-off aceito:** dois runtimes na mesma aplicação aumentam a complexidade de deploy e de setup local. Aceitável porque o ganho de robustez é maior, e porque sistemas poliglotas são a norma em ambientes reais.

---

## 4. Requisitos funcionais

### RF01 — Ingestão de dados

| ID     | Requisito                                                                              |
| ------ | -------------------------------------------------------------------------------------- |
| RF01.1 | O sistema deve autenticar no Garmin Connect e obter métricas diárias de saúde          |
| RF01.2 | O sistema deve obter a lista de atividades registradas                                 |
| RF01.3 | A ingestão deve ser idempotente: reexecutar para o mesmo período não duplica registros |
| RF01.4 | A ingestão deve registrar log de execução (sucesso, falha, período processado)         |
| RF01.5 | Falha de autenticação deve ser tratada explicitamente, não silenciosamente             |

### RF02 — Consulta de métricas de saúde

| ID     | Requisito                                                           |
| ------ | ------------------------------------------------------------------- |
| RF02.1 | Retornar série de métricas diárias filtrada por intervalo de datas  |
| RF02.2 | O intervalo deve ser validado: `from` não pode ser posterior a `to` |
| RF02.3 | Ausência de dados no período retorna lista vazia, não erro          |

### RF03 — Consulta de atividades

| ID     | Requisito                                                  |
| ------ | ---------------------------------------------------------- |
| RF03.1 | Retornar atividades filtradas por intervalo de datas       |
| RF03.2 | Permitir filtro opcional por tipo de atividade             |
| RF03.3 | Ordenação padrão: mais recente primeiro                    |
| RF03.4 | Suportar paginação quando o volume exceder o limite padrão |

### RF04 — Agregações

| ID     | Requisito                                                                      |
| ------ | ------------------------------------------------------------------------------ |
| RF04.1 | Resumo semanal: volume total (km), número de corridas, pace médio, tempo total |
| RF04.2 | Tendência de HRV no período (média e direção)                                  |
| RF04.3 | Comparação da semana atual com a anterior                                      |

### RF05 — Sincronização manual

| ID     | Requisito                                                 |
| ------ | --------------------------------------------------------- |
| RF05.1 | Endpoint que dispara a ingestão sob demanda               |
| RF05.2 | Retornar status da execução, não bloquear indefinidamente |
| RF05.3 | Impedir execuções concorrentes da mesma sincronização     |

### RF06 — Dashboard

| ID     | Requisito                                                                      |
| ------ | ------------------------------------------------------------------------------ |
| RF06.1 | Visão de corrida: volume semanal, evolução de pace, distribuição de distâncias |
| RF06.2 | Visão de saúde: HRV, FC de repouso, sono, body battery ao longo do tempo       |
| RF06.3 | Seletor de período (7 dias, 30 dias, 90 dias)                                  |
| RF06.4 | Estados explícitos de carregamento, erro e ausência de dados                   |

---

## 5. Requisitos não funcionais

### RNF01 — Tipagem e qualidade de código

- TypeScript em modo `strict`, sem uso de `any` fora de fronteiras de integração justificadas
- Toda entrada externa (query params, body) validada em runtime antes de chegar à lógica de negócio
- Tipos de domínio derivados dos schemas de validação, não duplicados manualmente

### RNF02 — Estrutura

- Separação em camadas: rotas → controllers → services → repositório
- Lógica de negócio isolada do framework HTTP (deve ser testável sem subir servidor)
- Nenhuma query de banco escrita diretamente em handler de rota

### RNF03 — Tratamento de erro

- Erros de domínio distintos de erros de infraestrutura
- Códigos HTTP semanticamente corretos: 400 para entrada inválida, 404 para recurso inexistente, 500 apenas para falhas não previstas
- Nenhum erro deve vazar stack trace ou detalhe interno na resposta
- Toda falha registrada em log com contexto suficiente para diagnóstico

### RNF04 — Configuração e segurança

- Credenciais e strings de conexão exclusivamente via variáveis de ambiente
- Nenhum segredo versionado, em nenhum momento do histórico do repositório
- `.env.example` documentando as variáveis necessárias sem valores reais

### RNF05 — Performance

- Consultas por intervalo de datas devem usar índice — sem full scan em tabelas de série temporal
- Resposta de consulta de 90 dias abaixo de 500ms em ambiente de desenvolvimento

### RNF06 — Testabilidade

- Cobertura de teste em toda regra de negócio e em cada endpoint
- Testes independentes de dados reais do Garmin

### RNF07 — Documentação

- README explicando propósito, arquitetura, decisões técnicas e instruções de execução
- Decisões arquiteturais relevantes registradas com o raciocínio, não apenas o resultado

---

## 6. Modelo de dados (conceitual)

Definição das entidades, seus atributos, tipo lógico e obrigatoriedade. Tipo lógico não é tipo SQL: `inteiro` não decide entre `smallint` e `integer`, `decimal` não fixa precisão. A modelagem física — tipos SQL exatos, índices, constraints — é parte do trabalho de implementação.

Tipos lógicos usados: `uuid`, `date`, `inteiro`, `decimal`, `texto`, `timestamp c/ fuso`, `timestamp s/ fuso`.

### Como este modelo foi definido

O modelo foi validado contra 31 dias de dado real extraído do Garmin, e não derivado do que a API oferece. Cada campo passou por um critério de necessidade de persistência em três níveis: **núcleo** (consumido por requisito funcional explícito), **suporte** (dá contexto a um campo núcleo ou alimenta as evoluções da seção 2) e **descartado**.

Dois campos disponíveis na ingestão foram descartados:

- **`hrv_weekly_avg_ms`** — é a média móvel de 7 dias de `hrv_last_night_ms`, com desvio entre −1,43 e +0,43 ms nos 31 dias medidos. O RF04.2 já exige que a API calcule a tendência de HRV; persistir também a versão do Garmin colocaria dois números divergentes para a mesma grandeza na mesma tela.
- **`floors_climbed`** — varia de verdade no período (0 a 16), mas nenhum requisito o consome, e é ortogonal aos dois eixos do produto: não é corrida (RF06.1) nem recuperação (RF06.2).

Três campos foram mantidos contra a intuição inicial, por evidência no dado: `min_heart_rate_bpm` difere de `resting_heart_rate_bpm` em 31 dos 31 dias; `hrv_baseline_low_ms`/`hrv_baseline_high_ms` variam dia a dia (faixa móvel, não configuração fixa); e `hrv_status` não é derivável da posição do HRV na faixa — há dias com HRV dentro da faixa e status `LOW`, porque a regra é proprietária do Garmin.

### Entidade: `daily_metrics`

Uma linha por dia. Métricas agregadas de saúde.

| Atributo               | Tipo                | Descrição                                    | Obrigatório |
| ---------------------- | ------------------- | -------------------------------------------- | ----------- |
| id                     | uuid                | Identificador único                          | sim         |
| date                   | date                | Data de referência — deve ser única          | sim         |
| steps                  | inteiro             | Total de passos                              | não         |
| active_calories        | inteiro             | Calorias de atividade (kcal)                 | não         |
| resting_heart_rate_bpm | inteiro             | FC de repouso (bpm)                          | não         |
| min_heart_rate_bpm     | inteiro             | FC mínima do dia (bpm)                       | não         |
| max_heart_rate_bpm     | inteiro             | FC máxima do dia (bpm)                       | não         |
| stress_avg             | inteiro             | Nível médio de estresse (0–100)              | não         |
| stress_max             | inteiro             | Nível máximo de estresse (0–100)             | não         |
| body_battery_charged   | inteiro             | Body battery recarregada no dia              | não         |
| body_battery_drained   | inteiro             | Body battery consumida no dia                | não         |
| body_battery_max       | inteiro             | Pico de body battery no dia                  | não         |
| body_battery_min       | inteiro             | Mínimo de body battery no dia                | não         |
| hrv_last_night_ms      | inteiro             | HRV médio da noite (ms)                      | não         |
| hrv_5min_high_ms       | inteiro             | Maior média de 5 min da noite (ms)           | não         |
| hrv_status             | texto               | Status do HRV — vocabulário do Garmin        | não         |
| hrv_baseline_low_ms    | inteiro             | Limite inferior da faixa pessoal (ms)        | não         |
| hrv_baseline_high_ms   | inteiro             | Limite superior da faixa pessoal (ms)        | não         |
| sleep_duration_s       | inteiro             | Duração do sono (segundos)                   | não         |
| sleep_deep_s           | inteiro             | Tempo em sono profundo (segundos)            | não         |
| sleep_light_s          | inteiro             | Tempo em sono leve (segundos)                | não         |
| sleep_rem_s            | inteiro             | Tempo em sono REM (segundos)                 | não         |
| sleep_awake_s          | inteiro             | Tempo acordado durante a noite (segundos)    | não         |
| sleep_score            | inteiro             | Pontuação de qualidade do sono (0–100)       | não         |
| readiness_score        | inteiro             | Prontidão para treino (0–100)                | não         |
| readiness_level        | texto               | Faixa da prontidão — vocabulário do Garmin   | não         |
| recovery_time_min      | inteiro             | Tempo de recuperação recomendado (minutos)   | não         |
| created_at             | timestamp c/ fuso   | Timestamp de criação do registro             | sim         |
| updated_at             | timestamp c/ fuso   | Timestamp da última atualização              | sim         |

Campos opcionais refletem a realidade: nem toda métrica está disponível todo dia (relógio não usado durante o sono, sincronização incompleta, etc.). A modelagem deve tolerar lacunas sem perder o registro do dia.

A lacuna deve ser **explícita**: um dia sem HRV é uma linha com os campos de HRV nulos, nunca uma linha sem esses campos. A ingestão já garante isso emitindo todas as chaves em toda linha.

`sleep_deep_s + sleep_light_s + sleep_rem_s` reproduz `sleep_duration_s`, com `sleep_awake_s` fora da soma — mas com folga de arredondamento do próprio Garmin, observada entre 0 e 39 segundos. Serve como sentinela de dado corrompido, não como constraint.

Os sufixos `_s`, `_ms`, `_min` e `_bpm` seguem a convenção da ingestão: unidade no nome sempre que houver ambiguidade. Foi a ausência dessa convenção que produziu a divergência anterior entre `sleep_duration` em minutos aqui e em segundos no dado real.

### Entidade: `activities`

Uma linha por atividade registrada. Todos os esportes, não só corrida — musculação entra desde já para não exigir recarga histórica quando o domínio de força for implementado (seção 2).

| Atributo                  | Tipo                | Descrição                                          | Obrigatório |
| ------------------------- | ------------------- | -------------------------------------------------- | ----------- |
| id                        | uuid                | Identificador único interno                        | sim         |
| garmin_activity_id        | texto               | Identificador de origem — deve ser único           | sim         |
| activity_type             | texto               | Tipo cru do Garmin (`running`, `strength_training`) | sim         |
| sport                     | texto               | Família do esporte (`run`, `strength`, `other`)     | sim         |
| name                      | texto               | Nome dado à atividade                              | não         |
| date                      | date                | Data local da atividade                            | sim         |
| started_at                | timestamp s/ fuso   | Início no horário local                            | sim         |
| started_at_gmt            | timestamp c/ fuso   | Início em UTC — fonte da verdade para ordenação    | sim         |
| duration_s                | decimal             | Duração total (segundos)                           | sim         |
| moving_duration_s         | decimal             | Duração em movimento (segundos)                    | não         |
| distance_m                | decimal             | Distância (metros)                                 | não         |
| avg_speed_mps             | decimal             | Velocidade média (m/s)                             | não         |
| max_speed_mps             | decimal             | Velocidade máxima (m/s)                            | não         |
| avg_hr_bpm                | inteiro             | FC média (bpm)                                     | não         |
| max_hr_bpm                | inteiro             | FC máxima (bpm)                                    | não         |
| calories                  | inteiro             | Calorias gastas (kcal)                             | não         |
| elevation_gain_m          | decimal             | Ganho de elevação (metros)                         | não         |
| elevation_loss_m          | decimal             | Perda de elevação (metros)                         | não         |
| avg_cadence_spm           | decimal             | Cadência média (passos por minuto)                 | não         |
| max_cadence_spm           | decimal             | Cadência máxima (passos por minuto)                | não         |
| avg_stride_length_m       | decimal             | Comprimento médio da passada (metros)              | não         |
| training_effect_aerobic   | decimal             | Efeito aeróbico do treino (0–5)                    | não         |
| training_effect_anaerobic | decimal             | Efeito anaeróbico do treino (0–5)                  | não         |
| training_load             | decimal             | Carga de treino atribuída pelo Garmin              | não         |
| vo2max_estimated          | decimal             | VO2max estimado nesta atividade                    | não         |
| created_at                | timestamp c/ fuso   | Timestamp de criação do registro                   | sim         |

`garmin_activity_id` único é o que garante a idempotência exigida pelo RF01.3. É texto, não número: identificador externo não sofre aritmética e não deve estar sujeito a limite de inteiro.

**Decisão — dois campos de tipo.** `activity_type` guarda o valor cru do Garmin; `sport` guarda a família. Existem os dois porque esteira e rua são tipos separados na origem (`treadmill_running` e `running`): sem a família, o filtro do RF03.2 e o volume semanal do RF04.1 deixariam as corridas de esteira de fora. O detalhe (`GET /v1/activities/:id`) mostra o tipo cru; agregação e filtro usam `sport`. Tipo novo do Garmin cai em `other` em vez de quebrar a ingestão.

**Decisão — fuso horário.** `started_at_gmt` é a fonte da verdade: ordenação (RF03.3) e paginação por cursor (RF03.4) usam esse campo, porque só ele é monotônico independente de mudança de fuso. `started_at` é o horário local sem fuso, para exibir "treinei às 12h20" sem recalcular.

**Decisão — coluna `date` derivada.** Extraída do horário **local**, não do GMT: um treino às 22h no Brasil cai no dia seguinte em UTC, e o cruzamento com `daily_metrics` precisa seguir o dia vivido. É o que viabiliza a análise de musculação × recuperação prevista na seção 2. Indexada.

**Decisão — sem `avg_pace`.** Pace é derivado de `avg_speed_mps` na leitura (`1000 / avg_speed_mps`), seguindo o princípio de armazenar unidade crua em SI e calcular valores apresentáveis na consulta. Persistir pace criaria um segundo número para a mesma grandeza, sujeito a divergir por arredondamento.

**Zero não é medição.** Atividades sem deslocamento (musculação) chegam do Garmin com `distance` e `averageSpeed` iguais a zero, enquanto os campos irmãos — velocidade máxima, cadência, passada — chegam nulos. A ingestão normaliza esses zeros para nulo, senão qualquer média de distância ou pace seria contaminada por sessões que não se aplicam.

### Entidade: `activity_splits`

Voltas de uma atividade. Uma linha por volta; presente apenas em atividades com deslocamento.

| Atributo         | Tipo    | Descrição                              | Obrigatório |
| ---------------- | ------- | -------------------------------------- | ----------- |
| id               | uuid    | Identificador único                    | sim         |
| activity_id      | uuid    | Atividade a que pertence               | sim         |
| index            | inteiro | Ordem da volta na atividade            | sim         |
| distance_m       | decimal | Distância da volta (metros)            | não         |
| duration_s       | decimal | Duração da volta (segundos)            | não         |
| avg_speed_mps    | decimal | Velocidade média da volta (m/s)        | não         |
| avg_hr_bpm       | inteiro | FC média da volta (bpm)                | não         |
| max_hr_bpm       | inteiro | FC máxima da volta (bpm)               | não         |
| elevation_gain_m | decimal | Ganho de elevação na volta (metros)    | não         |

Único em (`activity_id`, `index`). Populada pela ingestão e não exposta em endpoint no MVP: é dado histórico caro de recuperar depois, e a ingestão já paga o custo de buscá-lo.

### Entidade: `activity_hr_zones`

Tempo por zona de frequência cardíaca. Sempre cinco linhas por atividade, inclusive musculação; zona não utilizada tem tempo zero, que aqui é medição legítima.

| Atributo        | Tipo    | Descrição                                  | Obrigatório |
| --------------- | ------- | ------------------------------------------ | ----------- |
| id              | uuid    | Identificador único                        | sim         |
| activity_id     | uuid    | Atividade a que pertence                   | sim         |
| zone            | inteiro | Número da zona (1–5)                       | sim         |
| seconds_in_zone | decimal | Tempo na zona (segundos)                   | sim         |
| zone_low_bpm    | inteiro | Limite inferior da zona vigente (bpm)      | sim         |

Único em (`activity_id`, `zone`).

`zone_low_bpm` fica na linha, e não numa tabela de configuração de zonas, porque os limites **mudaram dentro do período medido** — oito valores distintos em 30 dias. É o limite vigente naquele treino, não uma constante do usuário.

### Entidade: `race_predictions`

Previsões de tempo de prova estimadas pelo Garmin. Série datada: uma linha por sincronização, para preservar a evolução em vez de sobrescrevê-la.

| Atributo               | Tipo              | Descrição                              | Obrigatório |
| ---------------------- | ----------------- | -------------------------------------- | ----------- |
| id                     | uuid              | Identificador único                    | sim         |
| date                   | date              | Data da estimativa — deve ser única    | sim         |
| race_prediction_5k_s   | inteiro           | Tempo previsto para 5 km (segundos)    | não         |
| race_prediction_10k_s  | inteiro           | Tempo previsto para 10 km (segundos)   | não         |
| race_prediction_half_s | inteiro           | Tempo previsto para meia (segundos)    | não         |
| race_prediction_full_s | inteiro           | Tempo previsto para maratona (segundos) | não         |
| created_at             | timestamp c/ fuso | Timestamp de criação do registro       | sim         |

### Entidade: `sync_logs`

Registro de cada execução de ingestão.

| Atributo          | Tipo              | Descrição                                          | Obrigatório |
| ----------------- | ----------------- | -------------------------------------------------- | ----------- |
| id                | uuid              | Identificador único                                | sim         |
| started_at        | timestamp c/ fuso | Início da execução                                 | sim         |
| finished_at       | timestamp c/ fuso | Fim da execução                                    | não         |
| status            | texto             | Estado (em andamento, sucesso, falha, parcial)     | sim         |
| period_start      | date              | Primeiro dia do período processado                 | sim         |
| period_end        | date              | Último dia do período processado                   | sim         |
| records_processed | inteiro           | Quantidade de registros processados                | sim         |
| error_message     | texto             | Detalhe da falha, quando houver                    | não         |

`finished_at` é opcional de propósito: execução em andamento não tem fim, e é exatamente esse estado — linha com status de execução e `finished_at` nulo — que o RF05.3 usa para barrar sincronizações concorrentes.

`period_start` e `period_end` atendem ao RF01.4, que exige registrar o período processado, não apenas o resultado.

---

## 7. Contrato da API

Prefixo de versão: `/v1`

### `GET /health`

Verificação de disponibilidade. Retorna status do serviço e da conexão com o banco.

### `GET /v1/metrics/daily`

Série de métricas diárias.

**Query params:** `from` (data, obrigatório), `to` (data, obrigatório)

**Regras:**

- Formato de data: `YYYY-MM-DD`
- `from` deve ser menor ou igual a `to`
- Intervalo máximo: 365 dias
- Entrada inválida retorna 400 com descrição do problema

### `GET /v1/activities`

Lista de atividades.

**Query params:** `from` (data, opcional), `to` (data, opcional), `type` (string, opcional), `limit` (número, opcional, padrão 50), `cursor` (string, opcional)

**Regras:**

- Ordenação por `started_at` decrescente
- `limit` máximo: 100
- Resposta inclui cursor para próxima página quando houver mais resultados

### `GET /v1/activities/:id`

Detalhe de uma atividade. Retorna 404 quando o identificador não existe.

### `GET /v1/summary/week`

Agregações da semana.

**Query params:** `week_start` (data, opcional — padrão: semana corrente)

**Retorna:** volume total, número de atividades, pace médio, tempo total, tendência de HRV, comparação com a semana anterior.

### `POST /v1/sync/trigger`

Dispara a ingestão.

**Body:** `from` (data, opcional), `to` (data, opcional)

**Regras:**

- Retorna 202 quando a execução é iniciada
- Retorna 409 quando já há uma sincronização em andamento

### Formato de resposta

Toda resposta bem-sucedida segue um envelope consistente contendo os dados e, quando aplicável, metadados de paginação.

Toda resposta de erro segue um formato único contendo código de erro identificável, mensagem legível e, quando aplicável, detalhamento por campo.

---

## 8. Critérios de aceite do MVP

O MVP está pronto quando todos os itens abaixo forem verdadeiros:

- [ ] Script de ingestão autentica no Garmin e popula o banco sem duplicar registros
- [ ] Todos os endpoints do contrato implementados, tipados e validados
- [ ] Erros retornam código HTTP correto e mensagem sem vazamento de detalhe interno
- [ ] Testes cobrindo cada endpoint e cada regra de negócio
- [ ] Dashboard exibe as visões de corrida e saúde com seletor de período
- [ ] Aplicação rodando em ambiente público acessível
- [ ] README com propósito, arquitetura, decisões técnicas e instruções de execução
- [ ] Nenhum segredo no repositório, em nenhum ponto do histórico
- [ ] Histórico de commits legível, com mensagens descritivas

---

## 9. Riscos conhecidos

| Risco                                                   | Impacto                                      | Mitigação                                                                                     |
| ------------------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Garmin altera novamente a proteção Cloudflare           | Ingestão para de funcionar                   | Dados persistidos localmente mantêm API e dashboard operacionais                              |
| Uso de API não oficial                                  | Sem garantia de estabilidade ou continuidade | Projeto é de uso pessoal; camada de ingestão isolada e substituível                           |
| Escopo crescer para outros domínios antes do MVP fechar | Projeto não termina                          | Evoluções registradas na seção 2, mas bloqueadas até os critérios de aceite estarem completos |
| Volume de dados históricos grande na primeira carga     | Ingestão lenta ou com timeout                | Processar por lotes com intervalo definido                                                    |

---

## 10. Convenções

- **Idioma do código:** inglês (nomes, comentários, mensagens de commit)
- **Idioma da documentação:** português, exceto o README público
- **Commits:** formato convencional — `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`
- **Branches:** trabalho direto na `main` é aceitável em projeto individual, desde que os commits sejam atômicos e descritivos
  a
