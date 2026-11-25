# Relatório — Fase 3: PARA core

Data: 2026-11-25

## 1. Concluído e verificado

### Backend
| Item | Endpoints | Testes |
|---|---|---|
| Áreas (CRUD, arquivar, lixeira, estatísticas derivadas) | `/api/areas` | integração |
| Metas (CRUD, horizonte, progresso derivado dos projetos) | `/api/goals` | integração |
| Projetos (CRUD, status com `completed_at`, cascata para tarefas) | `/api/projects` | integração |
| Tarefas (localização PARA, subtarefas, recorrência, posição, filtros) | `/api/tasks` | integração |
| Inbox → tarefa (atômico) | `POST /api/inbox/:id/convert-to-task` | integração |
| Lixeira (listar, restaurar, excluir definitivo e esvaziar, **auditados**) | `/api/trash`, `POST /api/<entidade>/:id/restore` | integração |
| Violações de constraint do banco → 400/409 com mensagem | error handler | integração |
| Motor de recorrência (subconjunto de RRULE) e aritmética de datas | `src/shared/recurrence.ts`, `dates.ts` | 20 unitários |

### Frontend
| Item | Onde |
|---|---|
| Tarefas em 6 visões: Hoje, Próximos 7 dias, Lista, **Quadro (kanban)**, **Calendário**, **Tabela** (ordenável); visão e filtros ficam na URL | `/tasks` |
| Kanban genérico, acessível (mouse, toque e **teclado**), com anúncios em PT-BR | `components/kanban-board.tsx` |
| Calendário mensal: **arrastar a tarefa para outro dia** muda o vencimento | `views/task-calendar.tsx` |
| Editor de tarefa (editar / criar / converter da Inbox), subtarefas, recorrência, arquivar, lixeira com "Desfazer" | `task-editor-dialog.tsx` |
| Projetos (quadro por status e lista por área) e página de detalhe com progresso | `/projects`, `/projects/:id` |
| Áreas (cards com estatísticas) e detalhe (projetos, tarefas e metas da área) | `/areas`, `/areas/:id` |
| Metas por horizonte, com progresso | `/goals` |
| Arquivo e Lixeira (restaurar, excluir definitivo com confirmação) | `/archive` |
| Início: widgets **Hoje** e **Projetos ativos** | `/` |
| Atalho `N` (nova tarefa) e ação na paleta | shell |

**Testes:** 121 unitários e de integração · 16 E2E (6 novos da Fase 3) · `pnpm test:csp` cobrindo as telas novas.

## 2. Regras de negócio implementadas

1. **Localização única no PARA**: uma tarefa fica num projeto **ou** numa área, ou em nenhum dos dois. Informar um lado limpa o outro automaticamente.
2. **Subtarefas** herdam o local da tarefa-pai, têm **um nível só** e seguem a pai quando ela muda de projeto.
3. **Cascata reversível**: arquivar ou excluir um projeto aplica o **mesmo carimbo de data/hora** às tarefas dele. Restaurar traz de volta exatamente as que saíram junto; as que já estavam arquivadas ou excluídas antes continuam onde estavam.
4. **Recorrência**: concluir a tarefa mantém a concluída no histórico e cria a próxima ocorrência numa única transação (`db.batch`). A regra passa para a nova tarefa, então reabrir e concluir de novo não duplica.
5. Não é possível restaurar ou desarquivar uma tarefa enquanto o projeto (ou a tarefa-pai) dela continua arquivado ou excluído: a API responde 409 com a orientação.
6. **Excluir definitivamente** só funciona para itens que já estão na lixeira, e fica registrado em `audit_logs`.

## 3. Bugs encontrados pela verificação (e corrigidos)

| Bug | Como apareceu | Gravidade | Correção · regressão |
|---|---|---|---|
| Subconsultas com coluna externa **sem nome da tabela** (`"id"` em vez de `areas.id`) | Teste de integração (erro) | **Alta**: em projetos e metas o SQL era válido e devolvia **contagens erradas em silêncio** | `sql.raw("tabela.id")` · teste de mutação comprovou que a versão silenciosa é detectada |
| Campo de subtarefa (`<form>`) aninhado no formulário do editor | Roteiro no navegador | Alta: Enter salvava e fechava o editor | Seção fora do `<form>`, botão com `form="id"` · E2E |
| Cache da tarefa única com o mesmo prefixo das listas; a atualização otimista fazia `.map` num objeto | Roteiro no navegador | **Alta: nenhuma edição de tarefa salvava** | Chave própria `["para","task",id]` e atualização defensiva · unitário + E2E |
| Aviso de recorrência perdido quando a tarefa sumia da lista | E2E | Média | Callbacks no hook (sempre disparam) · E2E |
| 404 no console ao mandar para a lixeira a partir da página de detalhe | E2E (checagem de console) | Baixa | Recarregamento exclui a consulta do item excluído · E2E |
| Toast de recorrência comparava a data com ela mesma ("Hoje" sempre) | Revisão de código | Baixa | Comparação com a data de hoje em Recife |
| Título do calendário "Novembro **De** 2026" | Revisão de captura | Cosmética | Capitalizar só a primeira letra |
| Banco local "vazio" depois de definir o `database_id` real | Ambiente de dev | — (não é bug do app) | Documentado em `INFRASTRUCTURE.md` |

## 4. Não concluído / limitações conhecidas

| Item | Situação |
|---|---|
| Filtros/visões salvas | Fase 6 (tabela `saved_views` já existe) |
| Tags em tarefas e projetos | As tabelas de junção existem; a UI de tags chega com o módulo Tags (Fase 4) |
| Rebalanceamento de posições | A posição fracionária esgota a precisão depois de ~50 inserções no **mesmo** ponto; falta renumerar a coluna quando o intervalo ficar pequeno demais (risco R18) |
| Arrastar no calendário pelo teclado | O calendário aceita mouse e toque; pelo teclado, a data se muda no editor |
| Datas relativas no recurso "Hoje" | Calculadas no fuso de Recife no cliente (Recife não tem horário de verão) |
