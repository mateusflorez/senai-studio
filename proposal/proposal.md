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
- [ ] Melhorar diagnóstico de ambiente quando dependências de geração não estiverem instaladas
- [ ] Adicionar histórico simples ou backup automático por arquivo

### Fase 7 — Exportação e distribuição
- [ ] Criar exportação completa da disciplina em `.zip` com slides, PDFs e arquivos-fonte
- [ ] Criar empacotamento de distribuição para Windows com instalador pronto para uso em outros computadores

### Fase 8 — Atualização do aplicativo
- [ ] Implementar verificação automática de atualizações no Windows
- [ ] Implementar fluxo de baixar e instalar nova versão do app automaticamente
- [ ] Definir origem de versão/publicação para updates (`git`, release hospedada ou feed próprio)
