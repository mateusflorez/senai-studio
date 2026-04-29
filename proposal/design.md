# Lumen Studio — Design Reference

Mockups em ASCII. Cada tela usa a mesma estrutura de chrome:
barra de título do Tauri (sem frame do OS) + rail lateral + área principal.

Legenda de status:  `◉` gerado e atualizado  ·  `◎` desatualizado  ·  `○` sem output

---

## 01 · Home — Grid de Disciplinas

A tela de entrada. O nome da disciplina em Clash Display 800 domina o card.
O primeiro card é "featured" — ocupa o dobro da largura (grid assimétrico).
O rail esquerdo está recolhido (44px, apenas ícones).

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│  ◈  Lumen Studio                                                     —   □   ✕   │
├───┬────────────────────────────────────────────────────────────────────────────────┤
│   │                                                                                │
│ ◈ │   DISCIPLINAS                                               + Nova disciplina │
│   │   ─────────────────────────────────────────────────────────────────────────── │
│ ▤ │                                                                                │
│   │   ┌─────────────────────────────────────────────┐  ┌──────────────────────┐  │
│ ⊞ │   │                                              │  │                      │  │
│   │   │   LÓGICA DE                                  │  │   BANCO DE           │  │
│   │   │   PROGRAMAÇÃO                                │  │   DADOS              │  │
│   │   │                                              │  │                      │  │
│   │   │   ──────────────────────────────             │  │   ──────────────     │  │
│   │   │   4 aulas  ·  2 atividades                   │  │   2 aulas · 3 atv    │  │
│   │   │   ◉ 3 gerados    ◎ 1 pendente                │  │   ○ Nenhum gerado    │  │
│   │   │                                              │  │                      │  │
│   │   └─────────────────────────────────────────────┘  └──────────────────────┘  │
│   │                                                                                │
│   │   ┌──────────────────────┐  ┌──────────────────────┐  ┌────────────────────┐ │
│   │   │                      │  │                      │  │                    │ │
│   │   │   FUNDAMENTOS        │  │   DESENVOLVIMENTO    │  │   +  Nova          │ │
│   │   │   DE DESIGN          │  │   FRONT-END          │  │      Disciplina    │ │
│   │   │                      │  │                      │  │                    │ │
│   │   │   ──────────────     │  │   ──────────────     │  │                    │ │
│   │   │   3 aulas · 1 atv    │  │   1 aula  · 0 atv    │  │                    │ │
│   │   │   ◎ 2 pendentes      │  │   ○ Nenhum gerado    │  │                    │ │
│   │   │                      │  │                      │  │                    │ │
│   │   └──────────────────────┘  └──────────────────────┘  └────────────────────┘ │
│   │                                                                                │
└───┴────────────────────────────────────────────────────────────────────────────────┘
```

**Notas de design:**
- Card do lado esquerdo: 2× a largura, cor de acento âmbar no hover (`border-left: 3px solid var(--accent)`)
- Hover em qualquer card: `translateY(-2px)` + `box-shadow` expandida
- Fundo com 2% de SVG noise — não flat
- `+ Nova Disciplina` é o mesmo tamanho de card mas com borda tracejada e ícone `+` centralizado

---

## 02 · Disciplina — Aulas e Atividades

Tela de detalhe de uma disciplina. Split horizontal 50/50.
O nome da disciplina em Clash Display 800 3rem sangra ligeiramente
além da borda do painel (intencional — grid breaking).

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│  ◈  Lumen Studio  ›  Lógica de Programação                          —   □   ✕   │
├───┬────────────────────────────────────────────────────────────────────────────────┤
│   │                                                                                │
│ ◈ │   ‹ Disciplinas                                                               │
│   │                                                                                │
│ ▤ │   LÓGICA DE PROGRAMAÇÃO                                                       │
│   │   ─────────────────────────────────────────────────────────────────────────── │
│ ⊞ │                                                                                │
│   │   ┌──────────────────────────────────────┐  ┌──────────────────────────────┐  │
│   │   │  AULAS                          + ╗  │  │  ATIVIDADES             + ╗  │  │
│   │   │  ──────────────────────────────    │  │  ──────────────────────────  │  │
│   │   │                                    │  │                              │  │
│   │   │  ◉  Aula 01                        │  │  ◉  Atividade 01            │  │
│   │   │     Intro à Programação            │  │     Lógica Básica           │  │
│   │   │     .pptx gerado e atualizado      │  │     PDF gerado e atualizado  │  │
│   │   │                                    │  │                              │  │
│   │   │  ◎  Aula 02                        │  │  ◎  Atividade 02            │  │
│   │   │     Álgebra Booleana               │  │     Expressões Lógicas      │  │
│   │   │     .pptx desatualizado            │  │     PDF pendente            │  │
│   │   │                                    │  │                              │  │
│   │   │  ○  Aula 03                        │  │                              │  │
│   │   │     Portas Lógicas                 │  │                              │  │
│   │   │     Sem slide gerado               │  │                              │  │
│   │   │                                    │  │                              │  │
│   │   │  ○  Aula 04                        │  │                              │  │
│   │   │     Simplificação de Expressões    │  │                              │  │
│   │   │     Sem slide gerado               │  │                              │  │
│   │   │                                    │  │                              │  │
│   │   │  ────────────────────────────────  │  │                              │  │
│   │   │  ↻ Gerar todos os slides           │  │                              │  │
│   │   │  ⌫ Limpar slides gerados           │  │                              │  │
│   │   └────────────────────────────────────┘  └──────────────────────────────┘  │
│   │                                                                                │
└───┴────────────────────────────────────────────────────────────────────────────────┘
```

**Notas de design:**
- Item hover: fundo `var(--bg-overlay)` + destaque da cor da disciplina na borda esquerda
- Status chips com glifo monospace alinham em coluna — sem ícones SVG, puro tipográfico
- `◎ desatualizado` em âmbar, `◉ ok` em verde, `○` em dim — paleta funcional, não decorativa
- Ao clicar no item, transição de slide da direita para o editor (Framer Motion `AnimatePresence`)

---

## 03 · Editor — Aula (Slides Marp)

Três painéis. Outline estreito (esq) + CodeMirror (centro) + preview de slides (dir).
O preview mostra thumbnails reais dos slides em 16:9, não screenshots estáticas.

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│  ◈  Lumen Studio  ›  Lógica  ›  Aula 02 — Álgebra Booleana           —   □   ✕    │
├───┬────────────┬─────────────────────────────────┬──────────────────────────────────┤
│   │  ESTRUTURA │  EDITOR                          │  PREVIEW SLIDES             ↔  │
│ ◈ │  ────────  │  ──────────────────────────────  │  ──────────────────────────     │
│   │            │                                  │                                 │
│ ▤ │  ▾ Slides  │   1  ---                         │  ┌─────────────────────────┐   │
│   │    01      │   2  marp: true                  │  │                         │   │
│ ⊞ │    02      │   3  theme: lumen                │  │  ÁLGEBRA                │   │
│   │    03      │   4  paginate: true              │  │  BOOLEANA               │   │
│   │    04      │   5  ---                         │  │                         │   │
│   │    05      │   6                              │  │  Aula 02                │   │
│   │    06      │   7  # Álgebra Booleana          │  └─────────────────────────┘   │
│   │            │   8                              │                                 │
│   │            │   9  <!-- _class: lead -->       │  ┌─────────────────────────┐   │
│   │            │  10                              │  │  Objetivos              │   │
│   │            │  11  ---                         │  │                         │   │
│   │            │  12                              │  │  • AND · OR · NOT       │   │
│   │            │  13  ## Objetivos                │  │  • Leis de Boole        │   │
│   │            │  14                              │  │  • Simplificação        │   │
│   │            │  15  - Compreender AND, OR, NOT  │  └─────────────────────────┘   │
│   │            │  16  - Aplicar leis de Boole     │                                 │
│   │            │  17  - Simplificar expressões    │  ┌─────────────────────────┐   │
│   │            │  18                              │  │  Operação AND           │   │
│   │            │  19  ---                         │  │                         │   │
│   │            │  20                              │  │  A · B = AB             │   │
│   │            │  21  ## Operação AND             │  │                         │   │
│   │            │  22                              │  └─────────────────────────┘   │
│   │            │  23  ```                         │                                 │
│   │            │  24  A ──┐                       │    ‹  slide 2 / 6  ›           │
│   │            │  25  B ──┴── AND ── Saída        │                                 │
│   │            │  26  ```                         │                                 │
│   │            │                                  │                                 │
├───┼────────────┴──────────────────────────────────┴──────────────────────────────── │
│   │  ◉ Salvo às 14:32   Md · 124 linhas   UTF-8        ╔══════════════════════╗    │
│   │  Ctrl+S salva  ·  Ctrl+K abre palette              ║  → Gerar .pptx       ║    │
│   │                                                     ╚══════════════════════╝    │
└───┴─────────────────────────────────────────────────────────────────────────────────┘
```

**Notas de design:**
- CodeMirror com tema customizado que usa `var(--bg-base)` como fundo — não o tema Dracula nem o One Dark
- Syntax highlighting custom: frontmatter YAML em âmbar, headings `#` em branco brilhante, comentários HTML `<!--` em dim
- O cursor do CodeMirror usa `var(--accent)` âmbar — consistente com a identidade visual
- Thumbnails de slide: `aspect-ratio: 16/9`, fundo branco/tema do slide, sem borda pesada
- Rail de estrutura lista slides numerados; clicar salta o cursor do editor para aquele `---`
- Status bar em IBM Plex Mono 11px: `◉ Salvo` verde ou `◎ Modificado` âmbar

---

## 04 · Editor — Atividade (PDF)

Mesmo layout do editor de aula, mas o painel direito simula o papel A4.
Renderiza o HTML da atividade ao vivo, proporcional à página.

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│  ◈  Lumen Studio  ›  Lógica  ›  Atividade 02 — Expressões Lógicas    —   □   ✕    │
├───┬────────────┬─────────────────────────────────┬──────────────────────────────────┤
│   │  ESTRUTURA │  EDITOR                          │  PREVIEW A4                 ↔  │
│ ◈ │  ────────  │  ──────────────────────────────  │  ──────────────────────────     │
│   │            │                                  │                                 │
│ ▤ │  Atividade │   1  ---                         │  ╔═══════════════════════════╗  │
│   │  Enunciado │   2  title: Expressões Lógicas   │  ║  Lumen           [logo]   ║  │
│ ⊞ │  Questão 1 │   3  subtitle: Lógica de Prog.  │  ║  ───────────────────────  ║  │
│   │  Questão 2 │   4  ---                         │  ║                           ║  │
│   │  Questão 3 │   5                              │  ║  Expressões Lógicas       ║  │
│   │            │   6  # Expressões Lógicas        │  ║  Lógica de Programação    ║  │
│   │            │   7                              │  ║                           ║  │
│   │            │   8  ## Questão 1                │  ║  Aluno(a): ____________   ║  │
│   │            │   9                              │  ║                           ║  │
│   │            │  10  Dado o circuito abaixo,     │  ║  ───────────────────────  ║  │
│   │            │  11  determine a expressão...    │  ║                           ║  │
│   │            │  12                              │  ║  1. Dado o circuito       ║  │
│   │            │  13  ```                         │  ║     abaixo, determine...  ║  │
│   │            │  14  A ──┬── AND ──┐             │  ║                           ║  │
│   │            │  15  B ──┘         OR── Saída    │  ║     ________________      ║  │
│   │            │  16  C ─────────────┘            │  ║     ________________      ║  │
│   │            │  17  ```                         │  ║                           ║  │
│   │            │  18                              │  ║  2. Simplifique:          ║  │
│   │            │  19  ## Questão 2                │  ║     A + A'B =             ║  │
│   │            │  20                              │  ║                           ║  │
│   │            │  21  Simplifique a expressão:    │  ║     ________________      ║  │
│   │            │  22  A + A'B =                   │  ║                           ║  │
│   │            │                                  │  ╚═══════════════════════════╝  │
│   │            │                                  │                                 │
├───┼────────────┴──────────────────────────────────┴──────────────────────────────── │
│   │  ◉ Salvo às 15:07   Md · 48 linhas    UTF-8         ╔══════════════════════╗    │
│   │  Ctrl+S salva  ·  Ctrl+K abre palette               ║  → Gerar PDF         ║    │
│   │                                                      ╚══════════════════════╝    │
└───┴─────────────────────────────────────────────────────────────────────────────────┘
```

**Notas de design:**
- O "papel" A4 tem sombra `box-shadow` pronunciada sobre o fundo escuro — cria profundidade
- A proporção A4 (210×297mm) é mantida: `aspect-ratio: 210 / 297`
- O preview usa o mesmo HTML/CSS que o gerador final — zero surpresas no PDF
- O rail "ESTRUTURA" detecta headings `##` no markdown e os lista como âncoras de navegação

---

## 05 · Command Palette (Cmd+K)

Overlay modal centralizado. Busca fuzzy em tempo real: disciplinas, aulas,
atividades e ações. Substitui toda a navegação por menu do TUI para usuários
de teclado.

```

                        ╔═══════════════════════════════════════════╗
                        ║  ⌘  Buscar em tudo...                     ║
                        ║  ─────────────────────────────────────    ║
                        ║                                            ║
                        ║  ▸ AULAS — Lógica de Programação          ║
                        ║    ◉  Aula 01 — Intro à Programação       ║
                        ║  → ◎  Aula 02 — Álgebra Booleana          ║
                        ║    ○  Aula 03 — Portas Lógicas            ║
                        ║    ○  Aula 04 — Simplificação             ║
                        ║  ─────────────────────────────────────    ║
                        ║  ▸ AÇÕES RÁPIDAS                          ║
                        ║    ↻  Gerar todos os slides               ║
                        ║    ↻  Gerar todos os PDFs                 ║
                        ║    +  Nova aula em Lógica                 ║
                        ║    +  Nova atividade em Lógica            ║
                        ║    +  Nova disciplina                     ║
                        ║  ─────────────────────────────────────    ║
                        ║  ▸ NAVEGAÇÃO                              ║
                        ║    ▤  Ir para Banco de Dados              ║
                        ║    ▤  Ir para Fundamentos de Design       ║
                        ║    ⚙  Configurações                       ║
                        ║                                            ║
                        ║  ↑↓ navegar  ↵ abrir  Esc fechar          ║
                        ╚═══════════════════════════════════════════╝

```

**Notas de design:**
- Fundo do overlay: `var(--bg-base)` com `backdrop-filter: blur(8px)` sobre o conteúdo da tela
- Input sem label, sem borda — só o cursor âmbar piscando
- Item selecionado: `→` no início + fundo `var(--bg-overlay)` + detalhe âmbar à esquerda
- Resultados agrupados por categoria com header em IBM Plex Mono uppercase dim
- Transição: scale de 0.95→1 + fade-in em 150ms

---

## 06 · Configurações de Disciplina

Acessado via ícone ⚙ no card da disciplina ou via Command Palette.
Exibe a disciplina atual no título. Fundo com o card em `var(--bg-surface)`.

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│  ◈  Lumen Studio  ›  Configurações                                   —   □   ✕   │
├───┬────────────────────────────────────────────────────────────────────────────────┤
│   │                                                                                │
│ ◈ │   CONFIGURAÇÕES                                                               │
│   │   ─────────────────────────────────────────────────────────────────────────── │
│ ▤ │                                                                                │
│   │   Lógica de Programação                                                       │
│ ⊞ │   ┌────────────────────────────────────────────────────────────────────────┐  │
│   │   │                                                                        │  │
│   │   │   Nome de exibição                                                     │  │
│   │   │   ┌───────────────────────────────────────────────────┐               │  │
│   │   │   │ Lógica de Programação                             │               │  │
│   │   │   └───────────────────────────────────────────────────┘               │  │
│   │   │                                                                        │  │
│   │   │   Cor de identificação                                                 │  │
│   │   │   ● ● ● ● ● ● ● ● ● ● ● ● ● ●     Sem cor (padrão)                  │  │
│   │   │   (preto / cinza / branco / vinho / vermelho / roxo / magenta /        │  │
│   │   │    verde / lima / oliva / amarelo / marinho / azul / petróleo)         │  │
│   │   │                                                                        │  │
│   │   │                                                         ╔ Salvar ╗    │  │
│   │   └─────────────────────────────────────────────────────────╚═════════╝   │  │
│   │                                                                                │
│   │   Preferências gerais                                                          │
│   │   ┌────────────────────────────────────────────────────────────────────────┐  │
│   │   │                                                                        │  │
│   │   │   Tema da interface          ╔ Escuro ▾ ╗                             │  │
│   │   │                              ╚══════════╝                             │  │
│   │   │   Fonte do editor            ╔ IBM Plex Mono ▾ ╗                     │  │
│   │   │                              ╚════════════════╝                      │  │
│   │   │   Tamanho da fonte           ╔ 14 ╗  px                              │  │
│   │   │                              ╚═════╝                                  │  │
│   │   │   Preview automático         ●──  ON                                  │  │
│   │   │   Auto-save (debounce 800ms) ●──  ON                                  │  │
│   │   │                                                                        │  │
│   │   └────────────────────────────────────────────────────────────────────────┘  │
│   │                                                                                │
└───┴────────────────────────────────────────────────────────────────────────────────┘
```

**Notas de design:**
- Input de nome: sem label flutuante — o label fica acima, estilo minimalista
- Seletor de cor: círculos `●` coloridos inline, sem dropdown — clique direto
- Cor selecionada: círculo com anel `◉` branco ao redor
- Toggles: estilo pill com transição de 150ms — não checkboxes

---

## 07 · Sidebar — Estados

O rail lateral tem dois estados. Transição suave em 200ms ease-out.

```
  RECOLHIDO (44px)          EXPANDIDO (220px, hover ou pin)
  ┌───┐                      ┌─────────────────────┐
  │ ◈ │  Home                │  ◈  Home            │
  │   │                      │                     │
  │ ▤ │  Disciplinas         │  ▤  Disciplinas     │
  │   │                      │                     │
  │ ⊞ │  Grade de aulas      │  ⊞  Grade de aulas  │
  │   │                      │                     │
  │   │                      │                     │
  │   │                      │                     │
  │ ⚙ │  Configurações       │  ⚙  Configurações   │
  └───┘                      └─────────────────────┘
```

---

## 08 · Fluxo de Estado — Status dos arquivos

Como os indicadores `◉ ◎ ○` são calculados (igual ao TUI, mas visual):

```
  Arquivo .md salvo
       │
       ├─→ Output existe? ──── NÃO ──→  ○  dim       (sem output)
       │
       └─→ mtime(md) > mtime(output)? ─── SIM ──→  ◎  âmbar   (desatualizado)
                                          │
                                          NÃO ──→  ◉  verde    (ok)
```

Esse cálculo roda no backend Tauri (Rust) e o resultado chega como evento
para o React via `tauri::emit`. O frontend só renderiza o estado — sem polling.

---

## 09 · Tokens de Design — Referência Rápida

```
Espaçamento    4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96px

Tipografia
  Heading XL   Clash Display 800   3rem  / letter-spacing -0.03em
  Heading LG   Clash Display 700   2rem  / letter-spacing -0.02em
  Heading MD   Clash Display 600   1.25rem
  UI Label     IBM Plex Mono 500   0.75rem / uppercase / tracking 0.08em
  UI Body      IBM Plex Mono 400   0.875rem
  Editor Body  Crimson Pro 400     1rem / line-height 1.7
  Code Inline  IBM Plex Mono 400   0.875rem

Raios de borda
  sm   4px   (chips de status)
  md   8px   (cards internos, inputs)
  lg   12px  (cards principais)
  xl   16px  (modais)

Sombras
  sm   0 1px 3px rgba(0,0,0,.4)
  md   0 4px 12px rgba(0,0,0,.5)   (cards em hover)
  lg   0 8px 32px rgba(0,0,0,.6)   (papel A4, paleta de comandos)
```
