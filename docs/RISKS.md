# Riscos técnicos e limitações

| # | Risco / limitação | Impacto | Mitigação |
|---|---|---|---|
| R1 | **Sem credenciais Cloudflare nesta sessão de desenvolvimento** (API bloqueada pelo proxy) | Deploy real e teste ponta a ponta com o Access ainda **não** foram feitos | Tudo validado no workerd local; JWT testado com JWKS local e mesmos algoritmos. Passo a passo de deploy em `INFRASTRUCTURE.md`; checklist pós-deploy em `PHASE-1-REPORT.md` |
| R2 | `wrangler d1 export` não suporta bancos com **tabelas virtuais** (FTS5, Fase 4) | Comando oficial de dump deixa de funcionar | Backup não depende dele: export JSON próprio + Time Travel. Índice FTS é reconstruível a partir das tabelas |
| R3 | D1 limita **100 parâmetros por query** e ~100 KB por statement | Inserts em lote e `IN (...)` grandes falham | Repositórios fazem *chunking* (≤ 90 parâmetros); restore em lotes |
| R4 | D1 **não tem transações interativas** (`BEGIN…COMMIT` entre chamadas) | Operações multi-tabela poderiam ficar pela metade | Usar `db.batch([...])` (atômico) — ex.: transferências, salvar nota + links |
| R5 | Limites de CPU/memória do Worker | Export/restore de muitos dados pode estourar | Exports paginados/streaming; tarefas longas via Cron + lotes (ou Workflows) |
| R6 | Tamanho máximo do D1 (10 GB) e de linha (~2 MB) | Notas enormes ou base muito grande | Imagens/arquivos sempre no R2, nunca no banco; monitorar tamanho em `/system/status` |
| R7 | PWA offline + Access: quando a sessão expira, o Access redireciona para outra origem e `fetch` falha | App "quebra" silenciosamente offline/expirado | Detectar redirect/opaque response → estado "sessão expirada" com botão de relogin; cache offline só de leitura |
| R8 | Cache offline guarda dados pessoais no dispositivo | Exposição se o aparelho for comprometido | Cache opcional por dispositivo, botão "limpar dados offline", nunca cachear exports/arquivos sensíveis |
| R9 | CSP exige `style-src 'unsafe-inline'` (estilos inline de Tiptap/Radix) | Pequena superfície para injeção de CSS | `script-src` continua estrito; HTML do editor sanitizado; sem dados do usuário em `style` |
| R10 | Scripts injetados pela Cloudflare (Rocket Loader, Email Obfuscation, Analytics) | Bloqueados pela CSP, podem quebrar a página | Desativar no hostname (ver `INFRASTRUCTURE.md`) |
| R11 | Desnormalizações deliberadas (`content_text`, `note_links`, futura `search_index`) | Divergência se alguém gravar fora do serviço | Escrita só via serviço; job de integridade recalcula e compara |
| R12 | Ecossistema em movimento: `vitest-pool-workers` foi **renomeado** para `@cloudflare/vitest-plugin` durante este trabalho; Vite 8/Vitest 5 são recentes | Quebras em atualizações | Versões travadas no `pnpm-lock.yaml`; atualizações em PR com suíte completa |
| R13 | Banco único em uma região primária | Latência maior longe da região | `--location enam` (não há região sul-americana); D1 read replication se necessário (uso single-user é leve) |
| R14 | Dependência do Access como fronteira principal | Política mal configurada exporia o app | Validação própria do JWT + checagem do e-mail + auditoria de identidade não autorizada |
| R15 | Perda do container de desenvolvimento (efêmero) | Commits locais se perdem se a sessão acabar | Repositório `carlosr-sh/second-brain` criado; **push bloqueado até instalar o Claude GitHub App** |
| R16 | Bibliotecas que usam `eval`/`new Function` violam a CSP de produção (caso real: probe JIT do Zod 4) | Funciona em dev, quebra ou polui relatórios em produção | `z.config({ jitless: true })`; `pnpm test:csp` testa o build real sob a CSP real; obrigatório para novas dependências |
| R17 | Registry do shadcn/ui inacessível na rede desta sessão | CLI do shadcn não funciona aqui | Componentes escritos no mesmo padrão; `components.json` pronto para uso futuro |
| R18 | Posição fracionária (`REAL`) perde precisão após ~50 inserções consecutivas no mesmo ponto | Dois itens com a mesma posição (ordem instável) | Uso normal raramente chega perto; mitigação planejada: renumerar a coluna quando o intervalo ficar abaixo de 1e-9 |
| R19 | Callbacks passados em `mutate(..., {onSuccess})` do TanStack Query não disparam se o componente desmontou | Avisos e erros perdidos em silêncio (caso real na Fase 3) | Efeitos importantes ficam nos callbacks do **hook**; documentado na arquitetura |
| R20 | Chaves de cache com prefixo comum e formatos de dados diferentes | Atualizações otimistas quebram (caso real: nenhuma edição salvava) | Prefixos `["para","tasks"]` só para listas; atualização otimista defensiva; teste de regressão |
