# Relatório — Fase 2: Design system e navegação

Data: 2026-11-25

## 1. Concluído e verificado

| Item | Onde | Evidência |
|---|---|---|
| Tokens de design em OKLCH, temas claro/escuro (identidade "papel e tinta" + acento teal) | `src/client/index.css` | Capturas nos dois temas; E2E de troca de tema |
| Tema sem flash, compatível com a CSP (script externo `theme-init.js`, não inline) | `public/theme-init.js` | Verificação sob CSP de produção |
| Preferências sincronizadas no servidor (tema, sidebar) com registro tipado | `src/shared/settings.ts`, `/api/settings` | 5 testes de integração; E2E de persistência após reload |
| Biblioteca de componentes no padrão shadcn/ui (Radix + Tailwind + cva) | `src/client/components/ui/` | Usada em todas as telas; `components.json` pronto para o CLI |
| Fonte Inter auto-hospedada | `@fontsource-variable/inter` | `document.fonts.check` sob CSP de produção |
| Shell: sidebar recolhível (persistida), gaveta mobile, link "pular para o conteúdo" | `src/client/layout/` | E2E desktop + mobile (Pixel 7), sem overflow horizontal |
| Registro único de módulos (23 módulos → 17 itens de menu + Configurações) | `src/client/app/navigation.ts` | Teste de unicidade de ids/rotas/atalhos |
| Command palette (⌘/Ctrl+K) com busca insensível a acentos | `features/command-palette`, `lib/search-filter.ts` | 4 testes unitários + E2E |
| Atalhos estilo Linear (`C`, `[`, `?`, `G`→tecla, ⌘/Ctrl+Enter) | `features/shortcuts/engine.ts` | 11 testes unitários + E2E |
| Captura rápida → Inbox (diálogo, inline no Início, URL detectada automaticamente) | `features/inbox` | E2E de ponta a ponta |
| Inbox: listar (abertos/processados/todos), processar, reabrir, lixeira (soft delete) | `/api/inbox`, `pages/inbox-page.tsx` | 6 testes de integração + E2E |
| Início (dashboard) com saudação/data em America/Recife e widgets reais | `pages/dashboard-page.tsx` | Teste de fuso (22:30 em Recife = dia anterior em UTC) |
| Configurações: aparência, atalhos, conta (logout do Access), sistema, auditoria | `pages/settings-page.tsx` | E2E da verificação de integridade |
| Sessão expirada do Access detectada (redirect manual → tela "entrar novamente") | `lib/api.ts`, `features/session` | Testes de componente |
| Placeholders honestos ("Fase N") para módulos futuros | `pages/module-placeholder-page.tsx` | E2E |
| Code splitting por rota (cada página é um chunk) | `app/router.tsx` | Build: páginas de 1–6 KB; inicial 189 KB gzip |

**Testes:** 84 unitários/integração (57 worker no workerd + 27 client no happy-dom) · 10 E2E (Playwright)
· `pnpm test:csp` (build de produção sob a CSP de produção).

## 2. Bugs encontrados pela verificação (e corrigidos)

| Bug | Como apareceu | Causa | Correção + teste de regressão |
|---|---|---|---|
| `[` ignorado logo após usar a paleta | Roteiro no navegador | Foco permanece no campo da paleta durante a animação de saída (~250 ms, medido) | Campo dentro de diálogo `data-state="closed"` não conta como digitação · unit + E2E |
| Buscar "escuro" selecionava "Configurações" | Roteiro no navegador | Busca *fuzzy* do cmdk casava letras soltas | Filtro determinístico (prefixo > palavra > substring, sem acentos) · 4 unit + E2E |
| Tooltip aparecia ao abrir a gaveta mobile | Revisão das capturas | Foco automático do diálogo disparava o tooltip | Tooltips só com sidebar recolhida · E2E mobile |
| **Violação de CSP em produção (`eval`)** | `pnpm test:csp` | O Zod 4 testa `new Function` para seu modo JIT | `z.config({ jitless: true })` em `src/shared/zod-setup.ts` · `test:csp` (mutação comprovada) |

Também corrigi dois testes meus que davam falsa segurança: a checagem de "zero erros no console" do E2E
(o `expect` dentro de evento não reprovava o teste; agora usa `afterEach`, comprovado com um canário) e a
primeira versão da checagem de CSP (a variável da CSP saía vazia e a página rodava sem CSP).

## 3. Não concluído / pendências

| Item | Situação |
|---|---|
| Push para o GitHub | **Bloqueado**: o Claude GitHub App não tem acesso a `carlosr-sh/second-brain` (HTTP 403). Commits estão locais |
| Deploy na Cloudflare | Continua pendente (sem credenciais nesta sessão) |
| Drag and drop, kanban, calendário, tabelas, visões salvas | Pertencem às Fases 3 e 6 (dependem dos dados de tarefas/projetos) |
| Busca de conteúdo na paleta | Fase 4 (FTS5); hoje a paleta busca módulos e ações |
| Personalização de atalhos | Não planejado; os atalhos estão centralizados para facilitar no futuro |

## 4. Decisões

* **shadcn/ui escrito à mão**: o registry (`ui.shadcn.com`) está bloqueado pela rede desta sessão. Como o
  shadcn é código copiado (não uma dependência), segui a mesma estrutura e convenções; `components.json` permite
  usar o CLI quando houver rede.
* **TanStack Query** para estado do servidor (cache, invalidação, atualização otimista com rollback).
* **React Router v8** (API conferida antes do uso: `createBrowserRouter`, `NavLink`, `Outlet`…).
* **Orçamento de performance**: JS inicial ≤ ~200 KB gzip; módulos pesados (Tiptap, Recharts) serão sempre lazy.
