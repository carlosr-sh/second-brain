# Relatório — Fase 1: Infraestrutura e autenticação

Data: 2026-11-25

## 1. Concluído e verificado

| Item | Evidência |
|---|---|
| Projeto TypeScript estrito (3 tsconfigs isolados: app / worker / ferramentas) | `pnpm typecheck` → 0 erros |
| Build único SPA + Worker (Vite 8 + `@cloudflare/vite-plugin`) | `pnpm build` ok; bundles sem valores de `.dev.vars` |
| Schema completo (32 tabelas) + migração `0000_initial_schema.sql` | Aplicada em D1 local (85 statements); `quick_check = ok`; `foreign_key_check` vazio; FKs ativas |
| Regras de integridade no banco (FK, CHECK de enum/data/sinal, únicos, índice parcial, cascatas, RESTRICT) | 12 testes em `schema-integrity.test.ts` |
| Validação do JWT do Cloudflare Access (RS256, iss, aud, exp, e-mail, tipo) | 10 testes unitários, incl. alg=none, HS256 (confusão de algoritmo), chave desconhecida, token de serviço |
| Autorização do único dono + auditoria de identidade não autorizada | Testes de integração 401/403 + linha em `audit_logs` |
| Bypass de dev com trava dupla (ENVIRONMENT + localhost) | Teste cobre as 3 combinações |
| Fail closed com configuração inválida, sem vazar valores | Teste de integração |
| CSRF (Sec-Fetch-Site / Origin + Content-Type) | 6 testes |
| CSP + headers de segurança em todas as respostas, inclusive erros e assets | 2 testes + verificação manual com curl |
| Limite de corpo (413), validação Zod (400), 404 JSON | Testes de integração |
| Endpoints: `GET /api/health`, `GET /api/me`, `GET /api/system/status`, `POST /api/system/integrity-check`, `GET /api/audit-logs` | Testes + navegador |
| Camadas rota → serviço → repositório, com composition root | `src/worker/services/container.ts` |
| SPA mínima: identidade, saúde do D1/R2, botão de verificação de integridade, temas claro/escuro, horário em America/Recife | Playwright (Chromium): sem erros de console/CSP, fallback SPA em rota profunda; capturas `phase1-light.png` / `phase1-dark.png` |

**Testes: 46/46 passando** (`pnpm test`, executando dentro do workerd).
**Teste de mutação:** desativar a checagem do e-mail do dono → 1 teste falha; desativar a checagem de
origem do CSRF → 3 testes falham. Ou seja, os testes realmente protegem essas regras.

## 2. Não concluído (e por quê)

| Item | Motivo | Próximo passo |
|---|---|---|
| Deploy na Cloudflare | ✅ Feito em 2026-11-25 via GitHub Actions | — |
| Teste ponta a ponta com o Access real | Depende do deploy | Checklist §4 abaixo |
| CI (GitHub Actions) | Ainda não há repositório remoto | Criar quando o repositório existir |

## 3. Decisões tomadas durante a fase

* **pnpm** em vez de npm: o npm 10.9 quebrou (`Cannot read properties of null (reading 'edgesOut')`) com as
  peer deps opcionais do plugin React; o pnpm também permite lista branca de scripts de instalação.
* **`@cloudflare/vitest-plugin`** em vez de `@cloudflare/vitest-pool-workers` (renomeado e descontinuado).
* **`run_worker_first: true`**: toda requisição passa pelo Worker (auth + headers uniformes).
* **FTS5 adiado para a migração da Fase 4** (desenho em `DATABASE.md` §5), junto com a busca.

## 4. Checklist pós-deploy (a executar)

- [x] Sem login → 302 para `ofulano.cloudflareaccess.com` em todas as rotas, inclusive API e assets (verificado em 2026-11-25).
- [x] Header `Cf-Access-Jwt-Assertion` forjado → continua 302 (o Access barra antes do Worker).
- [x] Antes dos secrets do Access → 500 em tudo, com CSP/HSTS presentes (fail closed verificado em produção).
- [x] `workers_dev: false` e `preview_urls: false` no deploy (sem URL alternativa).
- [ ] Após login: a página mostra seu e-mail "via Cloudflare Access", ambiente `production`.
- [ ] D1 e R2 verdes; migração `0000_initial_schema.sql` listada.
- [ ] "Verificar integridade do banco" → "Integridade OK".
- [x] Headers em produção: CSP com `script-src 'self'`, HSTS, `X-Frame-Options: DENY`, `nosniff`.
- [ ] Login com outro e-mail é barrado pelo Access (e, se passar, o Worker responde 403 e audita).
