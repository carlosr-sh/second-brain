# Relatório — Fase 7: celular (PWA instalável + leitura offline)

Data: 2026-11-25 · Antecipada para antes da Fase 6 (decisão do usuário) · Android **e** iPhone.

## 1. Concluído e verificado

| Item | Como | Verificado por |
|---|---|---|
| Instalável | Manifest (`standalone`, ícones 192/512/maskable, atalhos), `apple-touch-icon`, metas iOS | `Page.getInstallabilityErrors` vazio (Chromium) + ícones conferidos (tipo e tamanho reais) |
| Manifest atrás do Access | `<link rel="manifest" crossorigin="use-credentials">` | Verificação do build |
| Casca offline | Service worker (Workbox via `vite-plugin-pwa`) com precache de HTML/JS/CSS/fontes/ícones | Recarga em modo avião abre o app (build de produção) |
| Dados offline | Cache do TanStack Query no **IndexedDB** (7 dias), sem pesquisa/sistema/auditoria/identidade | Nota e finanças aparecem offline após recarga |
| SW nunca toca em dados | `/api/*` sem cache no SW; denylist de navegação `/api`, `/cdn-cgi`, `/auth` | Teste conta respostas `/api` vindas do SW = 0 |
| Somente leitura offline | Editor `contenteditable=false`, escrita falha na hora com aviso claro | E2E (Pixel 7 + iPhone) |
| Wi-Fi sem internet | Falha de rede marca offline (`onlineManager`); sonda `/api/health` detecta a volta | Unitário + E2E |
| Atualização controlada | "Nova versão disponível — Atualizar" | Fluxo do plugin (`registerType: "prompt"`) |
| Re-login com SW | `/auth/login?next=` (fora do SW) passa pelo Access e volta à página | Testes de integração + proteção contra *open redirect* (mutação comprovada) |
| Privacidade | Configurações → Dados offline (ligar/desligar, tamanho, limpar); "Sair" limpa antes do logout | Build: após "Limpar", o IndexedDB não contém mais a nota |
| Áreas seguras | `env(safe-area-inset-*)` no layout e na gaveta | Sem rolagem horizontal em 9 telas (Pixel 7 e iPhone) |
| Atalho do ícone | `/?capture=1` abre a captura rápida | E2E |

**Testes:** 214 unitários/integração (+21) · 34 E2E (+8, novo projeto *iphone*) · `pnpm test:csp` agora valida o PWA no build de produção.
Bundle inicial: 124,6 KB gzip (+1,9 KB). Precache: ~2 MB, baixado uma vez em segundo plano.

## 2. Bugs encontrados pela verificação (e corrigidos)

| Bug | Como apareceu | Correção |
|---|---|---|
| **"Entrar novamente" em loop** com o SW: a recarga era respondida pelo cache e nunca chegava ao Access | Análise de projeto antes de codar | Rota `/auth/login` excluída do SW |
| **Wi-Fi sem internet** não era detectado: `navigator.onLine` continua `true`; telas viravam erro ("Nota não encontrada") | Verificação do build no Chromium | Conectividade derivada das requisições (`lib/connectivity.ts`) + sonda |
| **Última tela não ia para o offline** se o app fosse fechado < 2 s depois | Verificação do build | Gravação a cada 1 s + gravação imediata ao ir para segundo plano |
| **"Limpar dados offline" não limpava**: a gravação ao sair da página regravava a memória | Verificação do build | Escritas suspensas após limpar (também no "Sair") |
| **Dados antigos após recarregar** (saldo errado, imagem sumida): cópia restaurada < 30 s era tida como "fresca" | E2E das Fases 4 e 5 | Toda cópia restaurada é revalidada |
| **Editor nascia com a versão antiga** (só lê o conteúdo na criação) | E2E | Editor só abre após a revalidação; offline usa a cópia |
| Estado "offline" vazando entre testes (`onlineManager` é singleton) | Teste unitário | Reset por teste |

## 3. Limitações

| Item | Situação |
|---|---|
| Criar/editar offline com sincronização | Fora do escopo (decisão); offline é só leitura |
| Imagens, comprovantes, capas offline | Não guardados (privacidade e espaço) |
| Safari real (WebKit) | Não disponível neste ambiente: E2E usa viewport/UA de iPhone no Chromium; Safari fica no checklist manual |
| Notificações push | Fora do escopo |
| Sessão do Access | Duração configurada no painel (`MOBILE.md`) |

## 4. Checklist manual (aparelho real)

1. Android: Chrome → *Instalar app* → abrir pelo ícone (tela cheia).
2. iPhone: Safari → Compartilhar → *Adicionar à Tela de Início* → abrir → login do Access dentro do app.
3. Abrir algumas telas (uma nota, Finanças), ativar **modo avião**, fechar e reabrir: dados aparecem com a faixa.
4. Tentar editar: aviso "Sem conexão — nada foi salvo". Desligar o modo avião: faixa some, edição volta.
5. Configurações → *Limpar dados offline* → modo avião → a nota não aparece mais.
