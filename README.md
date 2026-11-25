# Second Brain

Sistema pessoal e privado de gestão de conhecimento (PARA), rodando inteiramente na Cloudflare
(Workers + D1 + R2 + Access).

**Status:** Fases 1 (infraestrutura e autenticação) e 2 (design system e navegação) concluídas localmente — ver `docs/PHASE-1-REPORT.md` e `docs/PHASE-2-REPORT.md`.

## Início rápido

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

```bash
pnpm test
```
```bash
pnpm test:e2e
```
```bash
pnpm build && pnpm test:csp
```

## Documentação

| Documento | Conteúdo |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Arquitetura, camadas, autenticação, segurança, fuso horário |
| [docs/DATABASE.md](docs/DATABASE.md) | Schema, convenções, diagrama ER, decisões de modelagem |
| [docs/INFRASTRUCTURE.md](docs/INFRASTRUCTURE.md) | Bindings, secrets, deploy passo a passo, backup |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Fases e critérios de aceite |
| [docs/RISKS.md](docs/RISKS.md) | Riscos técnicos e mitigação |
| [docs/PHASE-1-REPORT.md](docs/PHASE-1-REPORT.md) | Fase 1: entregue, testado, pendente |
| [docs/PHASE-2-REPORT.md](docs/PHASE-2-REPORT.md) | Fase 2: entregue, bugs encontrados, pendente |
