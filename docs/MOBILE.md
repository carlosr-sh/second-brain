# Usar no celular (PWA)

O Second Brain é um **PWA** (Progressive Web App): instala direto do navegador, sem loja de aplicativos,
abre em tela cheia com ícone próprio e funciona **sem internet para leitura**.

## 1. Antes de tudo: duração da sessão do Access (uma vez, no painel)

O Cloudflare Access pede login quando a sessão expira (padrão: 24 h). No celular isso cansa rápido.

1. Painel Cloudflare → **Zero Trust** → **Access** → **Applications** → aplicação do `brain.ofulano.xyz` → **Edit**.
2. **Session Duration** → escolha **1 month** (ou o que preferir) → **Save**.

Segurança: a sessão continua presa ao seu e-mail e ao aparelho; "Sair" (Configurações) encerra na hora.

## 2. Instalar

### Android (Chrome)
1. Abra `https://brain.ofulano.xyz` e faça login.
2. Menu ⋮ → **Instalar app** (ou o aviso "Adicionar à tela inicial").
3. O ícone aparece na gaveta de apps. Toque e segure o ícone para ver os atalhos: **Captura rápida**,
   **Diário de hoje**, **Novo lançamento**.

### iPhone (Safari)
1. Abra `https://brain.ofulano.xyz` **no Safari** (outros navegadores no iOS podem não oferecer a opção).
2. **Compartilhar** (quadrado com seta) → **Adicionar à Tela de Início** → **Adicionar**.
3. Abra pelo ícone. **O app instalado tem cookies separados do Safari**: ele pede o login do Access
   **uma vez**, dentro do próprio app (código por e-mail). Depois disso a sessão fica no app.

## 3. Sem internet

| Situação | O que acontece |
|---|---|
| Abrir o app em modo avião | Abre normalmente (a "casca" do app fica no aparelho) |
| Telas abertas nos últimos 7 dias | Aparecem com os dados salvos + faixa **"Sem conexão"** |
| Tela nunca aberta neste aparelho | Mensagem "indisponível offline" (ou carregamento) |
| Editar, criar, salvar | Desativado; se tentar: **"Sem conexão — nada foi salvo"** |
| Texto digitado no exato momento em que a rede caiu | É reenviado sozinho quando a conexão volta |
| Wi-Fi sem internet / sinal fraco | Detectado pelas próprias requisições (não depende do aviso do sistema) |
| Imagens de notas, comprovantes, capas | **Não** ficam offline (arquivos não são guardados no aparelho) |

## 4. Atualizações

Depois de um deploy, aparece **"Nova versão disponível — Atualizar"**. O app só troca de versão quando você
toca em *Atualizar* (nunca no meio de uma edição).

## 5. Privacidade

Configurações → **Dados offline**:
* **Guardar dados neste aparelho** — desligue em aparelhos que não são só seus (apaga a cópia na hora).
* **Limpar dados offline** — apaga a cópia local.
* **Sair** (em Conta) também apaga a cópia antes de encerrar a sessão.

A cópia fica no IndexedDB do navegador, isolada por site. Ela é descartada a cada nova versão do app.

## 6. Se a instalação não for oferecida

Causa provável: o navegador buscou o manifest ou os ícones e o Access respondeu com a tela de login.
O app já pede o manifest **com** o cookie de login (`crossorigin="use-credentials"`). Se mesmo assim falhar,
o plano B é liberar no Access **apenas** `/manifest.webmanifest` e `/icons/*` (não contêm dados pessoais)
com uma política *Bypass*. Esse ajuste exige uma pequena mudança no Worker também — peça que eu faça junto.
