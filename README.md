# Second Brain

Sistema pessoal e privado de gestão de conhecimento (PARA), rodando inteiramente na Cloudflare
(Workers + D1 + R2 + Access).

**Status:** Fase 1 (infraestrutura e autenticação) concluída localmente — ver `docs/PHASE-1-REPORT.md`.

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

## Documentação

| Documento | Conteúdo |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Arquitetura, camadas, autenticação, segurança, fuso horário |
| [docs/DATABASE.md](docs/DATABASE.md) | Schema, convenções, diagrama ER, decisões de modelagem |
| [docs/INFRASTRUCTURE.md](docs/INFRASTRUCTURE.md) | Bindings, secrets, deploy passo a passo, backup |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Fases e critérios de aceite |
| [docs/RISKS.md](docs/RISKS.md) | Riscos técnicos e mitigação |
| [docs/PHASE-1-REPORT.md](docs/PHASE-1-REPORT.md) | O que foi entregue, testado e o que falta |
