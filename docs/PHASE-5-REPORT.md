# Relatório — Fase 5: Gestão pessoal

Data: 2026-11-25 · Decisões do usuário: **somente BRL**; **sem importação CSV/OFX** nesta fase.

## 1. Concluído e verificado

| Módulo | O que faz | Onde |
|---|---|---|
| **Contas** | Corrente, poupança, cartão, dinheiro, investimentos; saldo **derivado** (inicial + Σ lançamentos), saldo efetivado vs. pendente; arquivar | `/finance?tab=accounts` |
| **Lançamentos** | Receita/despesa com o **sinal aplicado pelo servidor**, categoria do mesmo tipo, pessoa (CRM), comprovante (R2), status; navegação por mês e filtros | `/finance?tab=transactions` |
| **Transferências** | Duas pernas ligadas que somam zero, criadas, editadas, excluídas e restauradas **sempre juntas** (`db.batch`); pagamento de fatura do cartão | idem |
| **Categorias** | Dois níveis, receita/despesa, conjunto padrão idempotente; excluir categoria em uso → orientação para arquivar | `/finance?tab=categories` |
| **Visão geral** | Números em destaque (saldo, receitas, despesas, resultado), receitas × despesas por mês, despesas por categoria (com agrupamento na categoria-pai), evolução do saldo — todos com **"Ver tabela"** | `/finance` |
| **Hábitos + histórico** | Check-in diário (contador para metas >1), sequências diária/semanal/mensal, recorde, taxa recente, heatmap de 26 semanas | `/habits` |
| **Diário** | Um registro por dia, editor rico, humor e energia 1–5, calendário do mês, autosave, busca | `/journal/:data` |
| **Contatos (CRM)** | Perfil, interações, "último contato" derivado, cadência ("Para contatar"), aniversários (ano opcional, 29/02 tratado) | `/contacts`, `/contacts/:id` |
| Busca | Diário, contatos e lançamentos no índice FTS (migração `0002`) | `Ctrl+K` |
| Início | Widgets "Hábitos de hoje" (check-in direto) e "Mês financeiro" | `/` |
| Lixeira e auditoria | 6 novos tipos; exclusão de contas e lançamentos **auditada** | `/archive?tab=trash` |

**Testes:** 193 unitários e de integração (26 de dinheiro e sequências, 12 de gestão pessoal) · **26 E2E** (5 novos) · `pnpm test:csp` agora desenha os gráficos com dados e aponta a rota de cada violação.

## 2. Garantias financeiras (como foram provadas)

| Garantia | Prova |
|---|---|
| Centavos exatos (sem `float`) | `parseBRL` usa aritmética de strings; teste `0,1 + 0,2 = 30` centavos; saldo exato após 13 lançamentos |
| Sinal correto | O servidor aplica o sinal pelo tipo; o CHECK do banco é a segunda barreira; valor negativo ou fracionário enviado pela API → 400 |
| Transferência atômica | Teste no repositório: segunda perna com FK inválida → **nenhuma** perna gravada. **Mutação**: inserções sequenciais deixam 1 perna órfã e o teste falha |
| Relatórios corretos | Testes com valores conhecidos (resumo mensal sem transferências, agrupamento por categoria-pai, série de saldo) |

## 3. Bugs encontrados pela verificação (e corrigidos)

| Bug | Como apareceu | Correção |
|---|---|---|
| **Agrupamento por categoria-pai errado**: o alias `category_id` coincidia com uma coluna real e o `GROUP BY` do SQLite usou a coluna | Teste de integração | Alias inequívoco (`top_category_id`) + comentário |
| **CSP: violação de `eval` em todas as páginas**: o `z.config({ jitless })` rodava *depois* dos schemas, porque o bundler moveu os schemas para um chunk que executa antes | `pnpm test:csp` | Módulo `src/shared/z.ts` (configura e reexporta `z`); a ordem passa a ser **garantida pela linguagem**; teste de guarda impede importar `z` de `"zod"` (mutação comprovada) |
| Paleta passou a preferir resultados de conteúdo a módulos ("financas" abria um lançamento) | E2E das Fases 2 e 4 | Paleta orientada a dados: item estático que combina tem prioridade; senão, o primeiro resultado |
| `parseBRL` aceitava `12.345,6.7` | Teste unitário | Validação do formato completo antes de converter |
| Dia sem registro no diário respondia 404 (ruído no console) | Revisão de projeto | Estado normal → `200 null` |
| Rótulos do eixo Y quebrando em duas linhas | Revisão visual (skill de dataviz) | Unidade no título, eixo compacto |
| "1 dia seguidos" | Captura | Concordância correta |
| Limpeza de testes violando FK `RESTRICT` das subcategorias | Teste | Apaga filhas antes |

## 4. Visualização de dados (skill `dataviz`)

Formas escolhidas pela tarefa de cada dado (números em destaque para manchetes; barras agrupadas; barras horizontais
ordenadas; linha; heatmap sequencial). Paleta categórica (azul/laranja) **validada por script** contra as superfícies reais
do app nos dois temas (daltonismo ΔE ≥ 26). O laranja tem 2,88:1 no claro → legenda e **visão em tabela** obrigatórias,
implementadas. Receita/despesa **não** usam verde/vermelho (cores reservadas para status).

## 5. Fora do escopo / limitações

| Item | Situação |
|---|---|
| Importação CSV/OFX, lançamentos recorrentes, orçamentos por categoria | Fase 6 |
| Multimoeda | Fora (decisão: só BRL) |
| Links `[[nota]]` no diário | Navegam, mas não geram backlinks (sem tabela de vínculo) |
| Editar conta de uma transferência | Não permitido (exclua e recrie); valor, data, descrição, notas e status podem ser editados |
| Excluir conta com lançamentos | Bloqueado de propósito: arquive (evita transferências órfãs em outra conta) |
