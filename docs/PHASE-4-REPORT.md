# Relatório — Fase 4: Gestão do conhecimento

Data: 2026-11-25

## 1. Concluído e verificado

| Módulo | O que faz | Onde |
|---|---|---|
| **Notas** | Editor rico (Tiptap): títulos, listas, checklists, citações, código, destaque, links e imagens, com atalhos Markdown e salvamento automático | `/notes`, `/notes/:id` |
| **Links entre notas** | Ao digitar `[[`, busca notas no índice FTS e pode criar a nota destino na hora. O link guarda o **ID**, então renomear a nota não quebra o link | `editor/note-link.ts` |
| **Backlinks** | "Mencionada em N": recalculado a cada salvamento; ignora autorreferência, notas inexistentes e notas na lixeira | `GET /api/notes/:id/backlinks` |
| **Busca global** | `Ctrl+K` busca em notas, tarefas, projetos, áreas, metas, recursos, links e livros; ignora acentos, aceita prefixo e destaca os trechos | FTS5 · `GET /api/search` |
| **Tags** | Criar, renomear e excluir; atribuição em notas, tarefas, projetos, links e livros; filtro de notas por tag | `/tags`, `PUT /api/<coleção>/:id/tags` |
| **Cadernos** | Coleções de notas independentes do PARA | `/notebooks` |
| **Recursos** | O "R" do PARA, com notas, links e livros por tema | `/resources`, `/resources/:id` |
| **Links (bookmarks)** | Ler depois, favoritos e tags | `/bookmarks` |
| **Estante** | Livros por status, capa (upload), avaliação e notas de leitura vinculadas | `/bookshelf` |
| **Arquivos (R2)** | Upload com validação real do tipo; servidos só ao dono autenticado | `POST/GET /api/files` |
| **Inbox → nota** | Conversão atômica; a primeira linha vira o título | `POST /api/inbox/:id/convert-to-note` |
| Lixeira | Agora inclui notas, cadernos, recursos, links e livros | `/archive?tab=trash` |

**Testes:** 155 unitários e de integração (16 do validador de documento, 18 de conhecimento) · **21 E2E** (5 novos) · `pnpm test:csp` agora **monta o editor** com uma nota real.

## 2. Decisões de segurança

1. **Sem HTML armazenado nem renderizado.** A nota é o JSON do Tiptap, validado no servidor contra uma lista branca de tipos de nó e marca (`src/shared/rich-text.ts`). Atributos desconhecidos são descartados; links aceitam só `http(s)`, `mailto` e caminhos relativos; imagens, só `/api/files/<uuid>`. Testado contra `javascript:`, `data:`, `//host`, imagens externas, nós arbitrários, `__proto__` e aninhamento profundo.
2. **O texto pesquisável é derivado no servidor**, nunca recebido do cliente.
3. **Busca sem injeção**: a entrada do usuário vira termos entre aspas (`"palavra"*`), então operadores do FTS5 digitados (`AND`, `NEAR`, `:`, `*`, aspas) são tratados como texto. Os destaques usam caracteres de controle como marcadores, e o cliente os converte em `<mark>` **sem usar HTML**.
4. **Uploads**: o tipo vem dos bytes iniciais (PNG, JPEG, GIF, WebP, PDF). **SVG é recusado**, assim como o tipo e a extensão declarados. A chave no R2 é derivada do UUID, nunca do nome do arquivo. O servidor calcula o SHA-256, e o R2 o verifica. Se a gravação no banco falhar, o objeto é removido do R2. As respostas levam `CSP: sandbox`, `nosniff` e cache privado imutável; PDFs são baixados como anexo.
5. Limite de corpo por rota: 1 MiB para JSON e 15 MB só em `POST /api/files`.

## 3. Bugs encontrados pela verificação (e corrigidos)

| Bug | Como apareceu | Correção |
|---|---|---|
| Parâmetros SQL `?` anônimos misturados com `?N` (colisão com o `LIMIT`) | Revisão de código | Tudo numerado explicitamente |
| `IN` sem parênteses em subconsulta (filtros por tag e por livro) | Teste de integração | `in (subconsulta)` |
| `UNION ALL` da lixeira passou do limite de termos compostos do D1 | Teste de integração (também quebrou testes da Fase 3) | Uma consulta por tabela via `d1.batch()` (uma ida ao banco) |
| `order by deleted_at` ambíguo no join | Teste de integração | `order by 4` (posição da coluna) |
| Autosave rodando o envio **a cada render** (dependia de objeto instável) | Revisão de código | Dependência de `mutate`, que é estável |
| Paleta: "Nada encontrado" ao lado de resultados; Enter não abria nada | Roteiro no navegador | Estado vazio próprio e seleção controlada |
| **Último salvamento perdido ao fechar a aba** | Investigação de um teste instável | `fetch(..., { keepalive: true })` no autosave ao sair da página |
| Nome do arquivo usado como texto alternativo da imagem, poluindo busca e resumos | Revisão de captura | Texto alternativo vazio por padrão |
| Requisição desnecessária (e 404) para ID de nota impossível | E2E | Validação do UUID no cliente antes de consultar |

## 4. Migração de banco

`0001_search_fts.sql` (customizada): tabela virtual `search_index` (FTS5, `unicode61 remove_diacritics 2`), 24 triggers (inserção, atualização e exclusão em 8 tabelas) e carga inicial com os dados existentes. É aplicada automaticamente pelo pipeline antes do deploy do Worker.

> ⚠️ A partir desta migração, `wrangler d1 export` **não funciona** (D1 não exporta tabelas virtuais, risco R2). O backup independente da Fase 8 usa a exportação JSON própria do app. O índice é derivado e pode ser reconstruído a partir das tabelas.

## 5. Limitações conhecidas

| Item | Situação |
|---|---|
| Arquivos órfãos no R2 (imagem removida da nota) | Ficam guardados; a limpeza entra com o backup na Fase 8 |
| Edição simultânea da mesma nota em dois dispositivos | Vale o último salvamento (sem colaboração em tempo real; app de um usuário) |
| Cadernos aninhados | O schema suporta (`parent_id`); a interface é plana por enquanto |
| Título de links salvos | Não é buscado na página (evitaria requisições do servidor para URLs arbitrárias); o padrão é o domínio |
| Leitura offline | Fase 7 (PWA) |
