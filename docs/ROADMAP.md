# Roadmap de implementação

Cada fase termina com: build, testes, checagem de integridade do banco, verificação do front e do
back no navegador, e um relatório `PHASE-N-REPORT.md` com o que foi feito e o que ficou pendente.

| Fase | Escopo | Critérios de aceite | Status |
|---|---|---|---|
| **1. Infra e autenticação** | Projeto, Worker+SPA único, D1/R2, schema completo + migração 0000, Access JWT, CSRF, CSP, erros, auditoria, status do sistema, check de integridade | Testes no workerd verdes; auth/CSRF com testes de mutação; build sem script inline | ✅ local · ⏳ deploy |
| **2. Design system e navegação** | Tokens (claro/escuro), shadcn/ui, Lucide, layout com sidebar recolhível, roteamento, command palette (⌘K), atalhos, quick capture (→ Inbox), query cache (TanStack Query). *Kanban/calendário/tabelas/drag & drop/visões salvas movidos para as Fases 3 e 6, onde há dados reais para exibir* | Navegação por teclado; responsivo; temas persistidos em `settings` | ✅ local · ⏳ deploy |
| **3. PARA core** | CRUD de Áreas, Projetos, Tarefas (subtarefas, recorrência), Metas; Kanban (drag & drop), lista, tabela, calendário; Inbox → processamento; Archive/lixeira | Regras PARA respeitadas; ordenação persistida; testes de serviço | ⏳ |
| **4. Conhecimento** | Notas (Tiptap, sanitização), Recursos, Tags, Cadernos, wikilinks/backlinks, FTS5 + busca global, Bookmarks, Bookshelf, upload de arquivos (R2) | Criar/editar/buscar notas (com acentos); backlinks corretos; upload valida MIME/tamanho | ⏳ |
| **5. Gestão pessoal** | Finanças (contas, categorias, transações, transferências atômicas, relatórios Recharts), Hábitos + histórico/heatmap, Diário, CRM | Saldos exatos em centavos; testes de transferências; streaks corretas em America/Recife | ⏳ |
| **6. Produtividade** | Dashboard com widgets, filtros/visões salvas, templates, revisão semanal, lembretes de contato | Visões salvas reutilizáveis em todos os módulos | ⏳ |
| **7. PWA e offline** | vite-plugin-pwa, manifest, instalação, cache de leitura, tratamento de sessão expirada do Access | Instala no celular/desktop; leitura offline de notas abertas recentemente | ⏳ |
| **8. Segurança, backup, produção** | Export JSON/Markdown/arquivos, backup diário (Cron), script de backup local, procedimento e teste de restore, revisão de segurança, testes E2E (Playwright), deploy final | Restore testado em banco limpo; checklist de segurança; Definition of Done completa | ⏳ |
