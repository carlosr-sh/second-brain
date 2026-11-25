# Infraestrutura — bindings, secrets e deploy

## 1. Bindings do Worker (`wrangler.jsonc`)

| Binding | Tipo | Recurso | Uso |
|---|---|---|---|
| `DB` | D1 | banco `second-brain` | Todos os dados relacionais |
| `FILES` | R2 | bucket `second-brain-files` | Anexos, capas, recibos, exports |
| `ASSETS` | Static Assets | `dist/client` (gerado pelo Vite) | SPA React; `not_found_handling: single-page-application` |

## 2. Variáveis e secrets

| Nome | Tipo | Onde é definido | Valor |
|---|---|---|---|
| `ENVIRONMENT` | var | `wrangler.jsonc` | `production` (em dev, `.dev.vars` sobrescreve para `development`) |
| `APP_TIMEZONE` | var | `wrangler.jsonc` | `America/Recife` |
| `OWNER_EMAIL` | **secret** | `wrangler secret put` | o único e-mail autorizado |
| `ACCESS_TEAM_DOMAIN` | **secret** | `wrangler secret put` | `<time>.cloudflareaccess.com` |
| `ACCESS_AUD` | **secret** | `wrangler secret put` | AUD tag da aplicação no Access |
| `DEV_AUTH_EMAIL` | apenas local | `.dev.vars` | e-mail usado pelo bypass local; **nunca** definir em produção |

Todos são validados com Zod no primeiro request (`src/worker/config.ts`); se algo faltar, o Worker
responde 500 em todas as rotas (fail closed) e loga **quais campos** estão inválidos (nunca os valores).

`.dev.vars` está no `.gitignore`; o modelo versionado é `.dev.vars.example`.

## 3. Primeiro deploy (passo a passo)

> Requer uma conta Cloudflare com um domínio próprio (zona) e um time Zero Trust (o plano gratuito
> do Zero Trust cobre até 50 usuários — sobra para 1).

1. **Login no Wrangler**
   ```bash
   pnpm exec wrangler login
   ```
2. **Criar o banco D1** e copiar o `database_id` retornado para `wrangler.jsonc`
   ```bash
   pnpm exec wrangler d1 create second-brain --location enam
   ```
   (Não existe região sul-americana para D1; as opções são `weur`, `eeur`, `apac`, `oc`, `wnam`, `enam`. `enam` (leste da América do Norte) é a mais próxima de Recife em rota de rede.)
3. **Criar o bucket R2** (privado por padrão — não habilite acesso público nem `r2.dev`)
   ```bash
   pnpm exec wrangler r2 bucket create second-brain-files
   ```
4. **Aplicar as migrações no banco remoto**
   ```bash
   pnpm db:migrate:remote
   ```
5. **Configurar o domínio**: em `wrangler.jsonc`, adicionar
   `"routes": [{ "pattern": "brain.seudominio.com", "custom_domain": true }]`.
6. **Criar a aplicação no Access** (Zero Trust → Access → Applications → *Self-hosted*):
   * Domínio: `brain.seudominio.com` (o hostname **inteiro**, sem path)
   * Política: *Allow* → *Include* → *Emails* → seu e-mail
   * Identity provider: One-time PIN (e-mail) ou Google/GitHub
   * Session duration: ex. 24h–1 mês (compromisso entre conveniência e risco)
   * Copiar a **Application Audience (AUD) Tag**
7. **Definir os secrets**
   ```bash
   pnpm exec wrangler secret put OWNER_EMAIL
   ```
   ```bash
   pnpm exec wrangler secret put ACCESS_TEAM_DOMAIN
   ```
   ```bash
   pnpm exec wrangler secret put ACCESS_AUD
   ```
8. **Deploy**
   ```bash
   pnpm run deploy
   ```
9. **Verificar** (ver checklist em `PHASE-1-REPORT.md` §4): aba anônima → tela do Access;
   login → app mostra seu e-mail via "Cloudflare Access"; D1 e R2 verdes.

### Configurações da zona recomendadas
* Desativar *Rocket Loader*, *Email Obfuscation* e *Web Analytics automático* para esse hostname:
  eles injetam scripts inline que a CSP (corretamente) bloqueia.
* SSL/TLS: *Full (strict)*; *Always Use HTTPS*: on; TLS mínimo 1.2.

## 3.1 Deploy contínuo (como está em produção)

O deploy **não** é feito da máquina de desenvolvimento, e sim pelo GitHub Actions
(`.github/workflows/ci-deploy.yml`):

* Todo push ou PR roda o job `ci`: typecheck, testes, build, `test:csp` e E2E.
* Na `main`, se o `ci` passar, o job `deploy` aplica as migrações D1 pendentes e depois publica o Worker.
* Secret do repositório: `CLOUDFLARE_API_TOKEN`. Variável opcional: `CLOUDFLARE_ACCOUNT_ID`.
* As actions são fixadas por hash de commit.
* Os secrets do Worker (`OWNER_EMAIL`, `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`) ficam na Cloudflare e
  **persistem entre deploys**.

Por que não fazer o deploy pela sessão de desenvolvimento: o upload de assets do Workers usa um JWT
temporário no header `Authorization`, e o proxy de credenciais do ambiente cloud sobrescreve esse
header com o API token. Resultado: 401. Outros comandos (D1, R2, `secret put`) funcionam daqui.

Produção: `https://brain.ofulano.xyz` · Access: time `ofulano.cloudflareaccess.com` · D1 em `ENAM`.

## 4. Desenvolvimento local

```bash
pnpm install
```
```bash
cp .dev.vars.example .dev.vars
```
```bash
pnpm db:migrate:local
```
```bash
pnpm dev
```
O estado local de D1/R2 fica em `.wrangler/state` (ignorado pelo git). O banco local é indexado pelo `database_id`: se ele mudar no `wrangler.jsonc`, um banco local **novo e vazio** é criado e é preciso rodar `pnpm db:migrate:local` de novo (sintoma: `no such table` / erro 500 em dev).

## 5. Comandos

| Comando | O que faz |
|---|---|
| `pnpm dev` | Vite + Worker no workerd, com HMR |
| `pnpm build` | `tsc -b` (todos os projetos) + build da SPA e do Worker |
| `pnpm test` | Vitest: projeto `worker` (workerd) + projeto `client` (happy-dom) |
| `pnpm test:e2e` | Playwright contra o stack de dev (desktop + mobile) |
| `pnpm test:csp` | Após `pnpm build`: roda o build de produção sob a CSP de produção |
| `pnpm typecheck` | Somente checagem de tipos |
| `pnpm db:generate` | Gera nova migração SQL a partir do schema Drizzle |
| `pnpm db:migrate:local` / `:remote` | Aplica migrações pendentes |
| `pnpm cf-typegen` | Regenera tipos dos bindings após mudar `wrangler.jsonc` |
| `pnpm deploy` | Build + remove `.dev.vars` do dist + `wrangler deploy` |

## 6. Estratégia de backup (desenho; implementação na Fase 8)

Princípio: **nenhum backup mora só na própria Cloudflare**, e R2 não é backup do R2.

| Camada | Mecanismo | Frequência | Onde fica |
|---|---|---|---|
| 1 | D1 Time Travel (restauração pontual, 30 dias no plano pago) | contínuo | Cloudflare |
| 2 | Export JSON completo via API (`/api/export`), com checksum SHA-256 | diário (Cron Trigger) | R2, prefixo `backups/` |
| 3 | Script local (`scripts/backup-pull`) baixa o export JSON + espelha os objetos do R2 (S3 API / rclone) usando um *Access Service Token* de leitura | diário/semanal | **Disco do dono** (+ nuvem pessoal, ex. HD externo) |
| 4 | Export Markdown (notas/diário) | sob demanda | Download pelo navegador |

Cada execução é registrada em `backup_runs`. A restauração será testada (Fase 8) recriando um banco
D1 vazio, aplicando migrações e importando o JSON, seguida de `quick_check` + `foreign_key_check` e
comparação de contagens/checksums.
