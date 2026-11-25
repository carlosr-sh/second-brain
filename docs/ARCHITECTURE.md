# Arquitetura — Second Brain

Sistema pessoal de gestão de conhecimento (PKM), **single-user**, inspirado no método PARA
(Projects · Areas · Resources · Archive), hospedado 100% na Cloudflare.

## 1. Visão geral

```
                 ┌───────────────────────── Cloudflare edge ─────────────────────────┐
 Navegador/PWA ──►  Cloudflare Access  ──►  Worker "second-brain" (um único deploy)  │
  (HTTPS)        │  (login, 1 e-mail)   │   ┌─────────────────────────────────────┐  │
                 │  injeta JWT no header│   │ Hono pipeline                        │  │
                 │                      │   │  requestId → securityHeaders         │  │
                 │                      │   │  → appContext (config Zod, serviços) │  │
                 │                      │   │  → accessAuth (valida JWT + dono)    │  │
                 │                      │   │  → /api/*: csrf → bodyLimit → rotas  │  │
                 │                      │   │  → demais: ASSETS (SPA React)        │  │
                 │                      │   └──────┬──────────────┬────────────────┘  │
                 │                      │          │              │                   │
                 │                      │      D1 (SQLite)     R2 (arquivos)          │
                 └──────────────────────┴──────────────────────────────────────────────┘
```

* **Um único Worker** serve a API (Hono) e a SPA (Workers Static Assets).
* `run_worker_first: true` → **toda** requisição (inclusive HTML/JS/CSS) passa pelo Worker:
  o JWT do Access é validado e os headers de segurança aplicados de forma uniforme.
  Isso é *defesa em profundidade*: mesmo que uma política do Access seja desativada por engano,
  o Worker continua recusando quem não for o dono.
* `workers_dev: false` e `preview_urls: false` → não existe URL alternativa que contorne o Access.

## 2. Stack

| Camada | Tecnologia | Papel |
|---|---|---|
| Runtime | Cloudflare Workers (workerd) | Execução da API e entrega dos assets |
| API | Hono 4 | Roteamento, middlewares |
| Validação | Zod 4 | Config, query/body, contratos |
| ORM | Drizzle ORM (driver D1) | Schema tipado + queries |
| Migrações | drizzle-kit (gera SQL) + Wrangler (aplica) | Evolução de schema versionada |
| Banco | Cloudflare D1 (SQLite) | Dados relacionais + FTS5 (Fase 4) |
| Arquivos | Cloudflare R2 | Anexos, capas, recibos, exports |
| Auth | Cloudflare Access + `jose` | Login e verificação do JWT (RS256/JWKS) |
| Front | React 19 + Vite 8 + Tailwind 4 | SPA |
| UI (Fase 2) | shadcn/ui + Lucide | Design system |
| Editor (Fase 4) | Tiptap | Rich text, wikilinks |
| Gráficos (Fase 5) | Recharts | Finanças, hábitos |
| PWA (Fase 7) | vite-plugin-pwa | Instalação, leitura offline |
| Testes | Vitest 5 + `@cloudflare/vitest-plugin` | Testes rodando **dentro** do workerd com D1/R2 locais |
| Pacotes | pnpm 10 | Lista branca de scripts de instalação (`esbuild`, `workerd`) |

## 3. Estrutura de pastas

```
second-brain/
├─ src/
│  ├─ shared/              # código isomórfico (front + back): tipos de API, enums, uuid, constantes
│  ├─ worker/              # BACKEND
│  │  ├─ index.ts          # entrypoint do Worker
│  │  ├─ app.ts            # composição do pipeline Hono
│  │  ├─ config.ts         # validação Zod das variáveis/secrets (fail closed)
│  │  ├─ auth/             # verificação do JWT do Cloudflare Access
│  │  ├─ middleware/       # requestId, headers de segurança, auth, CSRF, erros
│  │  ├─ routes/           # camada HTTP: parse/validação → chama serviço → serializa
│  │  ├─ services/         # regras de negócio + container de injeção (composition root)
│  │  ├─ repositories/     # acesso a dados (Drizzle/D1/R2), sem regra de negócio
│  │  ├─ db/schema/        # schema Drizzle por domínio (para, knowledge, personal, finance, system)
│  │  └─ lib/              # utilitários (erros, metadados da requisição)
│  └─ client/              # FRONTEND (React SPA)
│     ├─ app/              # navegação (registro de módulos), rotas, providers, estado de UI
│     ├─ layout/           # shell: sidebar, topbar mobile, Page
│     ├─ components/ui/    # design system (padrão shadcn/ui)
│     ├─ features/         # por funcionalidade: api/hooks/componentes (inbox, theme, shortcuts…)
│     ├─ pages/            # telas (carregadas sob demanda)
│     └─ lib/              # api client, query client, formatação, filtro de busca
├─ migrations/             # SQL gerado pelo drizzle-kit, aplicado pelo Wrangler
├─ tests/worker/           # Vitest no workerd (API, auth, integridade do banco)
├─ tests/client/           # Vitest no happy-dom (lógica e componentes do front)
├─ e2e/                    # Playwright (fluxos reais no navegador, desktop e mobile)
├─ scripts/                # verify-prod-csp.mjs (build de produção sob a CSP de produção)
├─ docs/                   # esta documentação
├─ wrangler.jsonc          # bindings e configuração do Worker
├─ vite.config.ts          # build único: SPA + Worker
└─ vitest.config.ts
```

## 4. Camadas e regras de dependência

```
routes  ──►  services  ──►  repositories  ──►  D1 / R2
   │            │
   └── Zod ─────┴── shared/ (tipos e enums)
```

* **Rotas** não acessam o banco: validam entrada (Zod), chamam um serviço, devolvem `{ data }`.
* **Serviços** contêm a regra de negócio (ex.: transferência = 2 lançamentos atômicos que somam zero).
* **Repositórios** só sabem ler/gravar. Trocar D1 por outro SQLite não afeta serviços.
* **`services/container.ts`** é o *composition root*: instancia repositórios e serviços por requisição.
  Em testes, partes podem ser substituídas (ex.: o resolvedor de chaves JWKS).
* O front **nunca** importa nada de `src/worker`; só de `src/shared`. Isso é garantido pelos
  `tsconfig` separados (`tsconfig.app.json` não inclui `src/worker`).

## 5. Contrato da API

* Prefixo `/api`, JSON, sucesso: `{ "data": ... }`; erro: `{ "error": { code, message, requestId, details? } }`.
* Códigos estáveis (`UNAUTHENTICATED`, `FORBIDDEN`, `CSRF_REJECTED`, `VALIDATION_FAILED`, …) definidos em
  `src/shared/api.ts`, compartilhados com o front.
* Todo response carrega `X-Request-Id` (Ray ID da Cloudflare quando existir) para correlacionar com logs.
* Erros 500 nunca expõem stack, SQL ou valores de configuração — só são logados (Workers Observability).

## 6. Autenticação (Fase 1 — implementado)

1. O Cloudflare Access protege o hostname inteiro, com política *Allow → Emails → (seu e-mail)*.
2. Após o login, o Access injeta `Cf-Access-Jwt-Assertion` em toda requisição encaminhada.
3. O middleware `accessAuth` verifica: assinatura RS256 com a JWKS do time
   (`https://<time>.cloudflareaccess.com/cdn-cgi/access/certs`, com cache e rotação de chaves),
   `iss`, `aud` (AUD tag da aplicação), `exp`/`nbf`, presença de e-mail (tokens de serviço recusados)
   e **e-mail == `OWNER_EMAIL`**.
4. Token válido de outra pessoa → 403 **e registro em `audit_logs`** (indica política do Access larga demais).
5. **Bypass de desenvolvimento**: só se `ENVIRONMENT=development` **e** host `localhost` **e** `DEV_AUTH_EMAIL`
   definido. Em produção `ENVIRONMENT=production` vem do `wrangler.jsonc` — duas travas independentes.
6. Configuração inválida → **fail closed** (500 em tudo), nunca "roda sem auth".

## 7. Proteções de segurança

| Ameaça | Mitigação |
|---|---|
| Acesso não autorizado | Access + validação própria do JWT + checagem do e-mail do dono |
| Contornar o Access | `workers_dev`/`preview_urls` desativados; Worker valida JWT em tudo |
| CSRF (cookie `CF_Authorization`) | Mutações exigem `Sec-Fetch-Site: same-origin` (ou `Origin` igual) **e** `Content-Type` JSON/multipart |
| XSS | CSP estrita (`script-src 'self'`, sem inline/eval), React escapa por padrão; HTML do Tiptap será sanitizado (Fase 4) |
| Clickjacking | `frame-ancestors 'none'` + `X-Frame-Options: DENY` |
| Downgrade | HSTS 2 anos + `upgrade-insecure-requests` |
| Payload abusivo | Limite de 1 MiB em JSON (uploads terão limite próprio, validação de MIME por *magic bytes* e tamanho) |
| Vazamento de segredos | Secrets via `wrangler secret`; `.dev.vars` no `.gitignore`; config validada sem logar valores; script de deploy remove `.dev.vars` do `dist` |
| R2 exposto | Bucket **sem** acesso público; arquivos servidos apenas via Worker autenticado; chave R2 derivada do id (nunca do nome do arquivo) |
| Auditoria | `audit_logs` append-only, sem FKs (sobrevive a exclusões) |

## 8. Fuso horário e datas

* **Instantes** (`created_at`, `completed_at`…) → `INTEGER` em milissegundos Unix **UTC**.
* **Datas de calendário** (vencimento, dia do diário, data da transação) → `TEXT 'YYYY-MM-DD'`
  interpretadas em `America/Recife`. Uma data de vencimento não é um instante: "dia 25" não pode
  virar "dia 24 às 21h" por conversão de fuso.
* Apresentação sempre via `Intl.DateTimeFormat(..., { timeZone: "America/Recife" })`.
* Recife é UTC−3 fixo (sem horário de verão desde 2019), o que simplifica cálculos de "hoje".

## 9. Ambientes

| Ambiente | Como roda | Auth |
|---|---|---|
| `development` | `pnpm dev` (Vite + workerd local, D1/R2 em `.wrangler/state`) | bypass local |
| `test` | `pnpm test` (Vitest no workerd, D1/R2 efêmeros) | JWKS local gerada no teste |
| `production` | `pnpm deploy` → domínio próprio atrás do Access | JWT do Access obrigatório |

## 10. Frontend (Fase 2)

```
main.tsx → Providers (QueryClient → Theme → Tooltip → UiState → SessionGuard) → RouterProvider
                                                                                 └─ AppShell (sidebar, paleta, captura, atalhos)
                                                                                     └─ <Outlet/> → páginas (lazy)
```

* **Estado do servidor**: TanStack Query (chaves centralizadas em `lib/query-client.ts`); mutações com
  atualização otimista e rollback em caso de erro.
* **Preferências**: registro tipado em `src/shared/settings.ts` (Zod + default por chave), salvo no servidor e
  espelhado em `localStorage` apenas para a primeira pintura (tema e sidebar sem "piscar").
* **Navegação declarativa**: `app/navigation.ts` gera sidebar, paleta e atalhos `G`→tecla.
* **Atalhos**: `features/shortcuts/engine.ts`, lógica pura e testada; teclas simples são ignoradas
  enquanto se digita (exceto se o campo estiver num diálogo em animação de saída).
* **Sessão**: `lib/api.ts` usa `redirect: "manual"`; um redirect do Access ou 401 dispara a tela "Sua sessão expirou".
* **Code splitting**: cada página é um chunk; orçamento de JS inicial ≤ ~200 KB gzip.
* **CSP e bibliotecas**: o Zod roda em modo `jitless` (`src/shared/zod-setup.ts`), senão seu teste de `eval`
  viola a CSP. Qualquer nova dependência deve passar em `pnpm test:csp`.

### Atalhos

| Tecla | Ação |
|---|---|
| ⌘/Ctrl + K | Paleta de comandos |
| C | Captura rápida |
| [ | Recolher/expandir sidebar |
| ? | Ajuda de atalhos |
| G → H/I/P/A/R/X/T/M/B/N/L/J/F/C/S | Ir para módulo |
| ⌘/Ctrl + Enter | Salvar formulário |

## 11. PARA core (Fase 3)

Regras de negócio ficam nos **serviços** (`src/worker/services/*.service.ts`) e estão listadas em
`docs/PHASE-3-REPORT.md` §2. Pontos de arquitetura:

* **Estatísticas derivadas, nunca armazenadas**: projetos ativos por área, tarefas abertas, progresso de
  metas e de projetos vêm de subconsultas correlacionadas. Atenção: referências à tabela externa devem ser
  **qualificadas** (`sql.raw("areas.id")`); sem isso o SQLite resolve `"id"` para a tabela interna, em silêncio.
* **Operações multi-linha atômicas** com `db.batch()` (D1 não tem transações interativas): cascata projeto→tarefas,
  recorrência, Inbox→tarefa.
* **Ordenação fracionária**: `position REAL`; soltar entre A e B grava `(A+B)/2`, ou seja, uma linha por movimento.
* **Front**: TanStack Query com chaves em `features/para/queries.ts`. Listas ficam sob `["para","tasks"|"projects"|...]`
  e itens únicos sob `["para","task"|"project"|"area", id]`. Toda escrita no PARA invalida `["para"]`, porque as
  estatísticas são derivadas no servidor. Efeitos que precisam acontecer sempre (avisos, rollback) ficam nos
  callbacks do **hook**, não nos de `mutate()`.
* **Kanban genérico** (`components/kanban-board.tsx`, dnd-kit), usado por tarefas e projetos; carregado sob demanda.
