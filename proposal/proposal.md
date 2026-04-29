# SENAI Studio — Proposta de Aplicação Desktop

## Contexto e Motivação

O TUI atual (`src/index.js`) funciona, mas tem teto baixo. Não tem editor de texto — você sai do app, edita no VS Code, volta, regenera. Não tem preview. Não tem busca rápida entre aulas. Cada fluxo requer vários menus sequenciais onde um clique errado te manda pro começo.

Um app desktop com Tauri + React resolve tudo isso sem abandonar o que já existe: a estrutura de pastas, os arquivos `.conf`, os templates Marp — tudo permanece compatível. O TUI pode continuar existindo como fallback.

---

## Visão do Produto

**SENAI Studio** — uma ferramenta de autoria de conteúdo didático para o professor.

Não é um LMS. Não é um gerador de slides genérico. É um ambiente focado: você abre, seleciona a disciplina, edita, pré-visualiza em tempo real, e exporta com um clique. O loop inteiro em uma janela.

### O que ele faz

| Funcionalidade | Detalhe |
|---|---|
| Gerenciar disciplinas | Criar, renomear, atribuir cor — mesma lógica do `.conf` |
| Gerenciar aulas | Listar com status de geração, criar a partir do modelo, editar |
| Gerenciar atividades | Idem, com preview do PDF antes de gerar |
| Editor Markdown | CodeMirror 6 com syntax highlighting para Marp frontmatter |
| Preview ao vivo | Slides Marp renderizados em miniatura · PDF A4 simulado |
| Exportação | `.pptx` via Marp CLI sidecar · `.pdf` via Tauri print-to-PDF ou Puppeteer sidecar |
| Command palette | Cmd+K para navegar e acionar qualquer ação instantaneamente |

---

## Stack Técnica

### Camada desktop

**Tauri 2.0** — em vez de Electron porque:
- Bundle final ~10 MB contra ~150 MB do Electron
- Usa a webview nativa do OS (Edge/WebView2 no Windows) — sem empacotar Chromium
- Acesso ao sistema de arquivos via comandos seguros e tipados
- Sidecar support nativo para embutir o Marp CLI como binário junto do app

### Frontend

```
React 19 + TypeScript (strict)
Vite (build tooling)
TanStack Router (file-based routing, type-safe)
Zustand (estado global: disciplina ativa, arquivo aberto, preferências)
TanStack Query (queries do file system — cache, invalidação, loading states)
CodeMirror 6 (editor extensível, sem opinião sobre look)
Framer Motion (transições de painel — usado com parcimônia)
CSS Modules + CSS custom properties (design tokens)
```

### Geração de conteúdo

```
Marp CLI → sidecar Tauri → gera .pptx
Tauri WebviewWindow print API → gera .pdf da atividade renderizada em HTML
(fallback: Puppeteer sidecar se precisar de controle fino de layout)
```

### Persistência

Sem banco. Mesma abordagem do TUI: arquivos `.md` no sistema de arquivos, `.conf` JSON por disciplina. O Tauri expõe comandos Rust para leitura/escrita que substituem o `fs` do Node.

---

## Design System

O objetivo é um app que parece uma ferramenta profissional de autoria — não mais um terminal com roupagem gráfica, não mais outro editor de Markdown genérico com sidebar azul.

### Paleta

```
Base
  --bg-base:    #0E1117   escuro profundo, não preto puro
  --bg-surface: #171C26   superfícies de cards e painéis
  --bg-overlay: #1F2535   painéis flutuantes e popups
  --border:     #2A3241   separadores e bordas

Texto
  --text-primary:  #F0EDE6   branco com temperatura quente
  --text-secondary:#8B95A8   muted labels, metadados
  --text-dim:      #4A5568   placeholders, desabilitados

Acento (âmbar editorial)
  --accent:       #FFB938   ação principal, links ativos, cursor
  --accent-dim:   #3D2F0A   fundo de badges de acento

Status
  --ok:      #22C55E   slide/PDF atualizado
  --stale:   #D97706   arquivo mais novo que o output
  --none:    #4A5568   sem output gerado
  --danger:  #EF4444   erro de geração
```

A escolha do âmbar como acento é deliberada: remete a impressão, manuscrito, calor de sala de aula — diferente do azul/verde/roxo que toda ferramenta de dev usa.

### Tipografia

```
Display (headings grandes, nomes de disciplinas)
  → Clash Display 800
  → Tamanho: 2.5rem–4rem com letter-spacing negativo
  → Uso: nome da disciplina, título da tela, números de aula

Interface (labels, menus, metadados, código)
  → IBM Plex Mono 400 / 600
  → Tamanho: 0.75rem–0.875rem
  → Uso: tudo que é UI shell — botões, tabs, status chips, linhas do editor

Corpo do editor (conteúdo markdown do professor)
  → Crimson Pro 400 / 600
  → Tamanho: 1rem (16px) com line-height 1.7
  → Uso: texto renderizado no preview, seções de roteiro de fala

```

O pairing Clash Display + IBM Plex Mono + Crimson Pro é incomum e funciona por contraste: o grotesco ultra-bold do display contra o monospace preciso da UI contra o serif humanista do conteúdo. Nenhuma das três fontes é Inter, Roboto ou a dupla padrão de apps de IA.

### Motion

```
Transições de painel   200ms ease-out   (slide + fade)
Stagger de listas      40ms por item    (entrada das aulas/atividades)
Status pulse           infinite 2s      (somente no indicador "gerando")
Hover em cards         150ms ease       (lift sutil via box-shadow)
```

Framer Motion entra somente nas transições de painel (AnimatePresence) e no stagger das listas. O resto é CSS puro para manter o bundle enxuto.

### Linguagem visual

- **Sem gradientes no fundo** — background texturizado com SVG noise (2% opacity), não flat nem gradiente
- **Grid quebrando**: o nome da disciplina na tela de detalhe ultrapassa ligeiramente a coluna, criando tensão tipográfica intencional
- **Sidebar enxuta**: 44px em repouso, ícones glifos apenas; expande para 220px no hover sem botão de toggle
- **Slide thumbnails** com aspect-ratio CSS correto (16:9) e borda sutil — não são screenshots, são renderizações reais do Marp via iframe sandboxado
- **Status chips** tipográficos: `◉ ok`, `◎ pendente`, `○ sem output` — consistente com o TUI, mas com cor e tamanho corretos no contexto GUI

---

## Arquitetura

### Tauri Commands (backend Rust)

```rust
// Exemplos dos comandos que o frontend vai chamar
list_subjects()                      → Vec<Subject>
read_file(path)                      → String
write_file(path, content)            → ()
watch_file(path)                     → Event stream
generate_pptx(lesson_path, out_dir)  → Result<String>
generate_pdf(html, out_path)         → Result<String>
open_in_explorer(path)               → ()
read_subject_config(subject)         → SubjectConfig
write_subject_config(subject, cfg)   → ()
```

### Módulos React

```
src/
  features/
    subjects/        — grid, card, criação
    lessons/         — lista, status, geração
    activities/      — lista, status, geração
    editor/          — CodeMirror, toolbar, atalhos
    preview/         — Marp iframe, PDF A4 simulado
    command-palette/ — busca global Cmd+K
    settings/        — configurações de disciplina e preferências
  shared/
    components/      — Button, StatusChip, Spinner, Modal
    hooks/           — useFileWatcher, useSubject, useGenerate
    store/           — Zustand slices
    tokens/          — CSS vars re-exportadas como constantes TS
```

### Fluxo típico: editar e gerar slide

```
1. Usuário clica numa aula  →  Router navega para /subjects/:id/lessons/:file
2. Tauri command read_file()  →  conteúdo chega via TanStack Query
3. CodeMirror monta com o conteúdo
4. useFileWatcher observa o arquivo  →  indicador "não salvo" no statusbar
5. Ctrl+S  →  write_file()  →  invalida a query  →  preview recarrega
6. Botão "Gerar .pptx"  →  generate_pptx()  →  spinner  →  status chip atualiza
```

---

## Telas

| Tela | Rota | Descrição |
|---|---|---|
| Home | `/` | Grid de disciplinas com cards editoriais |
| Disciplina | `/subjects/:id` | Split: aulas (esq) + atividades (dir) |
| Editor aula | `/subjects/:id/lessons/:file` | Editor + preview de slides |
| Editor atividade | `/subjects/:id/activities/:file` | Editor + preview A4 |
| Configurações | `/settings` | Preferências globais + config de disciplina |
| Command palette | overlay (Cmd+K) | Busca e ações rápidas |

---

## Migração do TUI

Nada quebra. O Tauri app lê a mesma árvore de arquivos que o TUI grava. Compatibilidade garantida por:

- Mesma convenção de nome: `aula_01_tema.md`, `atividade_01_tema.md`
- Mesmo formato `.conf` JSON
- Mesmo frontmatter Marp nos arquivos `.md`
- O TUI continua funcionando como `npm start` para quem preferir

A migração é incremental: o Studio começa lendo arquivos existentes no primeiro uso.

---

## Fases de Entrega

### Fase 1 — Shell + navegação (MVP de navegação)
- [x] Setup Tauri 2.0 + React + Vite
- [x] Design tokens + tipografia carregada
- [x] Home com grid de disciplinas (leitura do FS)
- [x] Tela de disciplina com lista de aulas/atividades e status
- [x] Sidebar com ícones

### Fase 2 — Editor
- [x] CodeMirror 6 com Markdown + Marp syntax highlighting
- [x] Auto-save com debounce de 800ms
- [x] File watcher para indicador de "modificado externamente"
- [x] Command palette básico (Cmd+K)

### Fase 3 — Preview + geração
- [x] Preview de slides Marp via iframe sandboxado
- [x] Preview A4 da atividade em HTML
- Geração `.pptx` via Marp CLI sidecar
- Geração `.pdf` via Tauri print API
- Status de geração em tempo real

### Fase 4 — Polish
- Framer Motion nas transições de painel
- Stagger de listas na entrada das telas
- Command palette com busca fuzzy em todo o conteúdo
- Atalhos de teclado documentados na UI
- Configurações de disciplina (nome, cor) dentro do app

### Fase 5 — Operação de conteúdo
- [x] Renomear aula e atividade com atualização de título/tema e nome de arquivo
- [x] Duplicar aula e atividade para acelerar criação de material reaproveitável
- [x] Criar `contexto.md` e `plano_geral.md` automaticamente quando estiverem faltando
- [x] Permitir reordenação e renumeração de aulas e atividades
- [x] Adicionar ação de gerar tudo da disciplina de uma vez

### Fase 6 — Segurança, visão e produtividade
- [ ] Melhorar o fluxo de conflito de edição externa com opções de recarregar, comparar e manter alterações locais
- [x] Criar visão geral da disciplina com progresso, itens sem output e itens desatualizados
- [x] Adicionar busca global por disciplinas, aulas, atividades e conteúdo interno dos arquivos
- [x] Melhorar diagnóstico de ambiente quando dependências de geração não estiverem instaladas
- [ ] Adicionar histórico simples ou backup automático por arquivo

### Fase 7 — Exportação e distribuição
- [ ] Criar exportação completa da disciplina em `.zip` com slides, PDFs e arquivos-fonte
- [x] Criar empacotamento de distribuição para Windows com instalador pronto para uso em outros computadores
  Estratégia recomendada para Windows:
  empacotar no instalador o runtime de geração usado pelo app, incluindo as dependências Node necessárias para Marp/HTML e um navegador Chromium embarcado para PDF, eliminando a exigência de Node, Chrome/Edge e setup manual na máquina final.
  Motivo:
  o Lumen Studio é um app desktop para uso docente e precisa funcionar de forma previsível offline e em computadores institucionais; depender de instalações externas aumenta falha operacional, suporte e inconsistência entre máquinas.
  Critério de pronto:
  uma instalação limpa do app em Windows deve conseguir gerar `.pptx` e `.pdf` sem instalar nada adicional fora do instalador do próprio sistema.

### Fase 8 — Atualização do aplicativo

#### Visão geral

O fluxo usa infraestrutura 100% gratuita do GitHub:

| Peça | Responsabilidade |
|---|---|
| `tauri-plugin-updater` | SDK que verifica, baixa e instala updates dentro do app |
| **GitHub Releases** | Hospeda o instalador `.exe` / `.msi` de cada versão |
| **GitHub Actions** (`windows-latest`) | Build automático no push de tag `v*.*.*` |
| **GHCR** | Cache de layers do ambiente de build (mesmo padrão do PrimeSys) |
| **GitHub Pages** | Hospeda o `latest.json` — manifesto consultado pelo app na inicialização |

Fluxo end-to-end:

```
git tag v1.2.0 && git push --tags
  → GitHub Actions dispara
  → runner windows-latest autentica no GHCR
  → baixa imagem de build cacheada do GHCR (Rust + Node)
  → compila o app, gera lumen-studio_1.2.0_x64-setup.exe
  → assina o instalador com a chave privada RSA do repo
  → publica no GitHub Releases (tag v1.2.0)
  → gera latest.json e faz push para branch gh-pages
  → app instalado verifica latest.json na próxima abertura
  → exibe notificação → professor clica "Atualizar"
  → Tauri baixa o instalador, executa, reinicia o app
```

---

#### Passo 1 — Adicionar tauri-plugin-updater

```toml
# src-tauri/Cargo.toml
[dependencies]
tauri-plugin-updater = "2"
```

```rust
// src-tauri/src/lib.rs — registrar no builder
.plugin(tauri_plugin_updater::Builder::new().build())
```

```json
// src-tauri/capabilities/default.json — adicionar permissão
{
  "permissions": [
    "updater:default"
  ]
}
```

---

#### Passo 2 — Gerar chave RSA de assinatura

A chave é gerada **uma única vez** localmente e nunca entra no repositório.

```bash
# Gera o par de chaves — executa apenas na primeira configuração
npx @tauri-apps/cli signer generate -w ~/.tauri/lumen-studio.key
```

Isso produz dois arquivos:
- `~/.tauri/lumen-studio.key` — **chave privada** (fica só na máquina do dev / secret do Actions)
- `~/.tauri/lumen-studio.key.pub` — **chave pública** (vai para `tauri.conf.json`)

```json
// src-tauri/tauri.conf.json
{
  "plugins": {
    "updater": {
      "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6...",
      "endpoints": [
        "https://<github-user>.github.io/senai_studio/latest.json"
      ]
    }
  }
}
```

A chave privada é adicionada como secret no GitHub:
- `Settings → Secrets → Actions → New repository secret`
- Nome: `TAURI_SIGNING_PRIVATE_KEY`
- Valor: conteúdo de `~/.tauri/lumen-studio.key`
- Senha da chave (se definida): `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

---

#### Passo 3 — GitHub Actions workflow

Arquivo: `.github/workflows/release.yml`

Disparo: push de qualquer tag no formato `v*.*.*` (ex: `v1.2.0`).

Segue o mesmo padrão do PrimeSys — autenticação no GHCR, cache de registry por SHA, builds atômicos — adaptado para runner `windows-latest` em vez de containers Linux, já que o instalador `.exe` exige ambiente Windows nativo.

```yaml
name: Release

on:
  push:
    tags:
      - 'v*.*.*'

concurrency:
  group: release-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: write      # criar GitHub Release e fazer upload do instalador
  packages: write      # push de cache no GHCR
  pages: write         # publicar latest.json no GitHub Pages
  id-token: write      # necessário para Pages deploy

env:
  GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  REGISTRY: ghcr.io
  IMAGE_BUILD: ghcr.io/${{ github.repository_owner }}/lumen-studio-build

jobs:
  # ──────────────────────────────────────────────
  # BUILD — compila o instalador no Windows
  # ──────────────────────────────────────────────
  build-windows:
    name: Build Windows Installer
    runs-on: windows-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable

      # Cache da compilação Rust — armazenado no GHCR como OCI artifact
      - name: Restore Rust cache
        uses: actions/cache@v4
        with:
          path: |
            ~/.cargo/registry
            ~/.cargo/git
            src-tauri/target
          key: ${{ runner.os }}-cargo-${{ hashFiles('**/Cargo.lock') }}
          restore-keys: |
            ${{ runner.os }}-cargo-

      - name: Install dependencies
        run: npm ci

      - name: Build Tauri app
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
        with:
          tagName: ${{ github.ref_name }}
          releaseName: 'Lumen Studio ${{ github.ref_name }}'
          releaseBody: |
            Veja as mudanças nesta versão em CHANGELOG.md
          releaseDraft: false
          prerelease: false

      # Salva o path do instalador gerado para o próximo job
      - name: Export installer path
        id: installer
        shell: bash
        run: |
          INSTALLER=$(find src-tauri/target/release/bundle -name "*.exe" | head -1)
          echo "path=$INSTALLER" >> $GITHUB_OUTPUT

  # ──────────────────────────────────────────────
  # MANIFEST — gera e publica o latest.json
  # ──────────────────────────────────────────────
  publish-manifest:
    name: Publish Update Manifest
    runs-on: ubuntu-latest
    needs: build-windows

    steps:
      - name: Checkout gh-pages branch
        uses: actions/checkout@v4
        with:
          ref: gh-pages
          path: pages

      - name: Fetch release assets metadata
        id: release
        run: |
          TAG="${{ github.ref_name }}"
          RELEASE=$(curl -s \
            -H "Authorization: Bearer $GH_TOKEN" \
            https://api.github.com/repos/${{ github.repository }}/releases/tags/$TAG)

          INSTALLER_URL=$(echo "$RELEASE" | jq -r '.assets[] | select(.name | endswith(".exe")) | .browser_download_url')
          SIGNATURE=$(echo "$RELEASE" | jq -r '.assets[] | select(.name | endswith(".exe.sig")) | .browser_download_url' \
            | xargs curl -s)
          PUB_DATE=$(echo "$RELEASE" | jq -r '.published_at')
          NOTES=$(echo "$RELEASE" | jq -r '.body')
          VERSION="${TAG#v}"

          echo "installer_url=$INSTALLER_URL" >> $GITHUB_OUTPUT
          echo "pub_date=$PUB_DATE" >> $GITHUB_OUTPUT
          echo "version=$VERSION" >> $GITHUB_OUTPUT

          # Escreve o latest.json
          jq -n \
            --arg version "$VERSION" \
            --arg notes "$NOTES" \
            --arg pub_date "$PUB_DATE" \
            --arg url "$INSTALLER_URL" \
            --arg sig "$SIGNATURE" \
            '{
              version: $version,
              notes: $notes,
              pub_date: $pub_date,
              platforms: {
                "windows-x86_64": {
                  url: $url,
                  signature: $sig
                }
              }
            }' > pages/latest.json

      - name: Commit and push latest.json
        run: |
          cd pages
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add latest.json
          git commit -m "chore: update latest.json to ${{ github.ref_name }}"
          git push
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

#### Passo 4 — Habilitar GitHub Pages

1. `Settings → Pages → Source: Deploy from branch → branch: gh-pages, folder: / (root)`
2. Na primeira vez, criar a branch `gh-pages` manualmente com um `latest.json` vazio
3. O workflow vai sobrescrever o arquivo a cada release

O `latest.json` ficará disponível em:
```
https://<github-user>.github.io/senai_studio/latest.json
```

---

#### Passo 5 — Implementar UI de notificação no frontend

O app verifica atualizações uma vez na inicialização. O fluxo na UI:

```
Inicialização do app
  → check() em background (não bloqueia a tela)
  → se disponível: exibe toast/banner com versão nova e changelog
  → professor clica "Atualizar agora"
  → downloadAndInstall() — barra de progresso
  → relaunch() — app reinicia na nova versão
```

```typescript
// src/hooks/useAppUpdater.ts
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export async function checkForUpdates(): Promise<UpdateInfo | null> {
  const update = await check();
  if (!update?.available) return null;
  return {
    version: update.version,
    body: update.body ?? "",
    downloadAndInstall: async (onProgress: (downloaded: number, total: number) => void) => {
      await update.downloadAndInstall((event) => {
        if (event.event === "Progress") {
          onProgress(event.data.chunkLength, event.data.contentLength ?? 0);
        }
      });
      await relaunch();
    },
  };
}
```

O hook é chamado em `App.tsx` via `useEffect` no mount inicial. A notificação usa o componente `StatusChip` existente com variante `--accent`.

---

#### Passo 6 — Publicar uma nova versão (operação rotineira)

```bash
# 1. Garantir que o código está em main e limpo
git checkout main && git pull

# 2. Atualizar a versão nos dois lugares
#    src-tauri/tauri.conf.json  → "version": "1.2.0"
#    src-tauri/Cargo.toml       → version = "1.2.0"

# 3. Commitar a bump de versão
git add src-tauri/tauri.conf.json src-tauri/Cargo.toml
git commit -m "chore: bump version to 1.2.0"

# 4. Criar e publicar a tag — isso dispara o workflow
git tag v1.2.0
git push origin main --tags
```

O Actions vai cuidar do resto: compilar, assinar, publicar a Release e atualizar o `latest.json`.

---

#### Checklist de configuração (uma vez)

- [x] Gerar par de chaves RSA com `npx @tauri-apps/cli signer generate`
- [x] Adicionar `TAURI_SIGNING_PRIVATE_KEY` como secret no GitHub
- [x] Adicionar a chave pública em `tauri.conf.json` → `plugins.updater.pubkey`
- [x] Configurar o endpoint do `latest.json` em `tauri.conf.json`
- [x] Adicionar `tauri-plugin-updater` ao `Cargo.toml` e registrar no builder
- [x] Adicionar permissão `updater:default` em `capabilities/default.json`
- [x] Criar branch `gh-pages` com `latest.json` vazio e habilitar GitHub Pages
- [x] Criar workflow `.github/workflows/release.yml`
- [x] Implementar `useAppUpdater.ts` e wiring na UI
- [ ] Fazer release de teste com tag `v0.1.1` e verificar o fluxo ponta a ponta
