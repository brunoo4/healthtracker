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

Definição das entidades e seus atributos. A modelagem física — tipos SQL, índices, constraints — é parte do trabalho de implementação.

### Entidade: `daily_metrics`

Uma linha por dia. Métricas agregadas de saúde.

| Atributo           | Descrição                           | Obrigatório |
| ------------------ | ----------------------------------- | ----------- |
| id                 | Identificador único                 | sim         |
| date               | Data de referência — deve ser única | sim         |
| resting_heart_rate | FC de repouso (bpm)                 | não         |
| hrv                | Variabilidade da FC (ms)            | não         |
| body_battery_max   | Pico de body battery no dia         | não         |
| body_battery_min   | Mínimo de body battery no dia       | não         |
| stress_avg         | Nível médio de estresse             | não         |
| sleep_duration     | Duração do sono (minutos)           | não         |
| sleep_score        | Pontuação de qualidade do sono      | não         |
| steps              | Total de passos                     | não         |
| created_at         | Timestamp de criação do registro    | sim         |
| updated_at         | Timestamp da última atualização     | sim         |

Campos opcionais refletem a realidade: nem toda métrica está disponível todo dia (relógio não usado durante o sono, sincronização incompleta, etc.). A modelagem deve tolerar lacunas sem perder o registro do dia.

### Entidade: `activities`

Uma linha por atividade registrada.

| Atributo           | Descrição                                | Obrigatório |
| ------------------ | ---------------------------------------- | ----------- |
| id                 | Identificador único interno              | sim         |
| garmin_activity_id | Identificador de origem — deve ser único | sim         |
| type               | Tipo de atividade (corrida, força, etc.) | sim         |
| started_at         | Data e hora de início                    | sim         |
| duration           | Duração em segundos                      | sim         |
| distance           | Distância em metros                      | não         |
| avg_pace           | Pace médio (segundos por km)             | não         |
| avg_heart_rate     | FC média (bpm)                           | não         |
| max_heart_rate     | FC máxima (bpm)                          | não         |
| avg_cadence        | Cadência média (spm)                     | não         |
| elevation_gain     | Ganho de elevação (metros)               | não         |
| training_load      | Carga de treino atribuída pelo Garmin    | não         |
| created_at         | Timestamp de criação do registro         | sim         |

`garmin_activity_id` único é o que garante a idempotência exigida pelo RF01.3.

### Entidade: `sync_logs`

Registro de cada execução de ingestão.

| Atributo          | Descrição                           |
| ----------------- | ----------------------------------- |
| id                | Identificador único                 |
| started_at        | Início da execução                  |
| finished_at       | Fim da execução                     |
| status            | Resultado (sucesso, falha, parcial) |
| records_processed | Quantidade de registros processados |
| error_message     | Detalhe da falha, quando houver     |

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
