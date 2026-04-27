# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Repository Overview

**Lumen Studio** is a desktop authoring application for teachers to create, manage, and generate educational content — slides (`.pptx` via Marp) and activities (`.pdf`). It replaces a TUI-based predecessor while maintaining full backward compatibility with the existing file/folder structure.

Built with **Tauri 2.0** (Rust backend + native webview) and **React 19 + TypeScript**. No database — all persistence is file-based (`.md` content files and `.conf` JSON per discipline). The app operates on a user-selected workspace directory.

- **Language**: TypeScript (strict) + Rust
- **Platform**: Desktop (Windows/macOS/Linux via Tauri)
- **Status**: v0.1.0 — Phases 1 (Shell) and 2 (Editor) complete; Phase 3 (Preview + Generation) in progress
- **All UI text**: Brazilian Portuguese

---

## Quick Start

### Prerequisites

- Node.js 20+
- Rust toolchain (`rustup` + stable target)
- For `.pptx` generation: `@marp-team/marp-cli` available (resolved from workspace's `node_modules`)
- For `.pdf` generation: Google Chrome or Microsoft Edge installed

### Setup

```bash
npm install
npm run tauri dev    # starts Vite dev server + Tauri window
```

### Build (production bundle ~10 MB)

```bash
npm run tauri build
```

---

## Essential Commands

```bash
# Development (Vite HMR + Tauri hot reload)
npm run tauri dev

# TypeScript type-check only (no emit)
npx tsc --noEmit

# Production build
npm run tauri build

# Vite-only dev server (no Tauri window — browser only)
npm run dev
```

> No test runner, no linter, no formatter is configured yet. Type-checking is the only automated quality gate.

---

## Architecture and Key Concepts

### System Overview

```
┌────────────────────────────────────────┐
│  React 19 Frontend (TypeScript)        │
│  • Single App.tsx god component        │
│  • MarkdownEditor.tsx (CodeMirror 6)   │
│  • CSS Modules via App.css / styles.css│
└────────────┬───────────────────────────┘
             │ invoke() — Tauri IPC
┌────────────▼───────────────────────────┐
│  Rust Backend (src-tauri/src/lib.rs)   │
│  • File I/O (subjects, content files)  │
│  • .conf JSON parsing                  │
│  • Status computation (ok/outdated)    │
│  • Marp CLI spawning (.pptx)          │
│  • Browser headless PDF generation     │
└────────────────────────────────────────┘
             │
┌────────────▼───────────────────────────┐
│  Workspace (user-chosen directory)     │
│  subject_slug/                         │
│  ├── .conf                             │
│  ├── aulas/*.md → slides/*.pptx        │
│  └── atividades/*.md → pdfs/*.pdf      │
└────────────────────────────────────────┘
```

### 1. State Management (Frontend)

There is no Zustand, no TanStack Query, no routing library. Navigation and data are managed by ~30 `useState` hooks directly in `App.tsx`. View transitions are plain state switches (`currentView: "home" | "subject" | "editor"`).

- Workspace path: `localStorage` persistence
- Subject list, selected subject/content, editor content, save state, modals — all local React state

### 2. Tauri IPC Pattern

Every backend operation is an `invoke()` call. All parameters are camelCase strings matching Rust command names (snake_case auto-converted by Tauri's macro):

```typescript
import { invoke } from "@tauri-apps/api/core";

const subjects = await invoke<SubjectSummary[]>("list_subjects", {
  workspacePath: "/path/to/workspace",
});
```

All Tauri command errors surface as thrown strings — always wrap in try/catch.

### 3. Content Status System

Status is computed by the Rust backend by comparing `.md` file mtime vs output file mtime:

```
.md file exists
  ├── No output file → "none"    (○ gray chip)
  ├── mtime(md) > mtime(output)  → "outdated" (◎ amber chip)
  └── mtime(md) ≤ mtime(output)  → "ok"       (◉ green chip)
```

Status is returned as part of `ContentItem.status: "ok" | "outdated" | "none"`.

### 4. Content Generation Pipeline

**Lessons → `.pptx`**: Rust spawns `marp` CLI (resolved from workspace's `node_modules/.bin/marp` or `node_modules/@marp-team/marp-cli/`). Output goes to `subject/slides/`.

**Activities → `.pdf`**: Rust spawns headless Chrome/Edge with `--headless --print-to-pdf`. Browser binary is auto-detected. Output goes to `subject/atividades/pdfs/`.

### 5. Auto-Save

The editor debounces content changes by **800ms**, then calls `save_content_file`. Save state machine: `idle → dirty → saving → saved → idle` (or `error`).

External modification detection polls `get_content_file_snapshot` every **2 seconds**, comparing the disk snapshot mtime vs the last-saved timestamp.

### 6. Technical Blocks (Markdown Editor)

`MarkdownEditor.tsx` uses CodeMirror 6 with a `showTechnicalBlocks` prop. When false, it folds three block types:
- YAML frontmatter (`---...---`) — placeholder: *"configuracao do slide"*
- CSS blocks (`<style>...</style>`) — placeholder: *"css do tema"*
- HTML comments (`<!--...-->`) — placeholder: *"anotacoes do apresentador"*

---

## Project Structure

```
senai_studio/
├── index.html                  # Vite entry point
├── vite.config.ts              # Dev server port 1420, ignores src-tauri/
├── tsconfig.json               # Strict TS: noUnusedLocals, noUnusedParameters
├── package.json                # Scripts: dev, build, tauri
│
├── src/
│   ├── main.tsx                # React root, loads all @fontsource/* fonts
│   ├── styles.css              # CSS custom properties (:root tokens) + resets
│   ├── App.tsx                 # 1775-line god component — ALL app logic/views
│   ├── App.css                 # 1124-line complete UI stylesheet
│   └── components/
│       └── MarkdownEditor.tsx  # CodeMirror 6 editor (250 lines)
│
└── src-tauri/
    ├── tauri.conf.json         # App name "Lumen Studio", window 800×600, no CSP
    ├── Cargo.toml              # tauri 2, tauri-plugin-opener, serde, serde_json
    └── src/
        ├── main.rs             # Tauri entrypoint (1 line, delegates to lib)
        └── lib.rs              # 1135-line Rust backend — all commands live here
```

> No `features/` or `shared/` subdirectory structure yet. The codebase is intentionally flat for this early phase.

---

## Tauri Commands Reference

All commands are in `src-tauri/src/lib.rs` and called via `invoke()`.

| Command | Parameters | Returns | Description |
|---------|-----------|---------|-------------|
| `list_subjects` | `workspace_path` | `Vec<SubjectSummary>` | All disciplines in workspace |
| `get_subject_detail` | `workspace_path`, `subject_slug` | `SubjectDetail` | Discipline + its lessons/activities |
| `read_content_file` | `workspace_path`, `subject_slug`, `relative_path` | `EditableContentFile` | File content + metadata |
| `save_content_file` | `workspace_path`, `subject_slug`, `relative_path`, `content` | `SaveContentResult` | Write file to disk |
| `get_content_file_snapshot` | `workspace_path`, `subject_slug`, `relative_path` | `ContentFileSnapshot` | File mtime + hash for drift detection |
| `delete_subject` | `workspace_path`, `subject_slug` | `()` | Remove entire discipline folder |
| `delete_content_item` | `workspace_path`, `subject_slug`, `relative_path` | `()` | Remove a single .md file |
| `generate_content_output` | `workspace_path`, `subject_slug`, `relative_path` | `()` | Trigger Marp (lesson) or PDF (activity) generation |
| `open_content_output_folder` | `workspace_path`, `subject_slug`, `relative_path` | `()` | Open output folder in Explorer/Finder |
| `create_template_subject` | `workspace_path` | `CreateTemplateSubjectResult` | Create example discipline from template |
| `create_subject` | `workspace_path`, `name`, `color` | `CreateSubjectResult` | New empty discipline |
| `create_lesson` | `workspace_path`, `subject_slug`, `theme` | `CreateContentItemResult` | New lesson `.md` from template |
| `create_activity` | `workspace_path`, `subject_slug`, `theme` | `CreateContentItemResult` | New activity `.md` from template |

### TypeScript Types

```typescript
interface SubjectSummary {
  id: string;
  slug: string;
  display_name: string;
  color: string;          // hex string
  lesson_count: number;
  activity_count: number;
  has_context: boolean;
  has_plan: boolean;
  updated_at_ms: number;
}

interface SubjectDetail extends SubjectSummary {
  lessons: ContentItem[];
  activities: ContentItem[];
}

interface ContentItem {
  file: string;
  relative_path: string;
  title: string;
  status: "ok" | "outdated" | "none";
  updated_at_ms: number;
}

interface EditableContentFile extends ContentItem {
  content: string;
}
```

---

## Workspace Data Structure

The app operates on a directory the user selects. Expected structure:

```
workspace/
└── <subject_slug>/           # Folder name IS the slug
    ├── .conf                 # JSON: {"nome": "Display Name", "cor": "#FFB938"}
    ├── contexto.md           # Optional discipline description
    ├── plano_geral.md        # Optional overall plan
    ├── aulas/                # Lesson markdown files
    │   └── aula_01_intro.md  # Naming convention: aula_NN_slug.md
    ├── atividades/           # Activity markdown files
    │   ├── atividade_01_ex.md
    │   └── pdfs/             # Generated PDFs land here
    ├── slides/               # Generated .pptx files land here
    ├── modelos/              # Markdown templates
    └── referencias/          # Reference notes
```

**Subject discovery**: Rust scans workspace for directories containing a `.conf` file OR directories whose name matches a slug pattern. Display name falls back to slug if `.conf` has no `nome` field. Color falls back to a deterministic hash of the slug if `.conf` has no `cor` field.

**Title extraction**: Rust reads the first `# Heading` or YAML frontmatter `title:` field from `.md` files to populate `ContentItem.title`.

---

## CSS Design System

All design tokens are CSS custom properties in `src/styles.css`:

```css
/* Backgrounds */
--bg-base: #0e1117;       /* App background */
--bg-surface: #171c26;    /* Sidebar */
--bg-overlay: #1f2535;    /* Hover state */
--bg-elevated: #262d3f;   /* Modals, cards */

/* Borders */
--border: #2a3241;
--border-strong: #3a455a;

/* Text */
--text-primary: #f0ede6;  /* Warm white */
--text-secondary: #8b95a8;
--text-dim: #4a5568;

/* Accent (amber — editorial, warmth) */
--accent: #ffb938;
--accent-dim: #3d2f0a;

/* Status */
--ok: #22c55e;
--stale: #d97706;
--none: #4a5568;
--danger: #ef4444;

/* Typography */
--font-display: "Bricolage Grotesque", sans-serif;   /* 800 weight only */
--font-ui: "IBM Plex Mono", monospace;               /* 400, 600 */
--font-content: "Crimson Pro", serif;                /* 400, 600 */
```

Always reference these tokens. Never hardcode colors or fonts.

**Typography hierarchy**:
- `--font-display` / weight 800: headlines, discipline names
- `--font-ui` / monospace: all shell chrome — buttons, labels, status, tabs
- `--font-content` / serif: markdown preview content

---

## Important Patterns

### Adding a New Tauri Command

1. Define struct(s) in `lib.rs` with `#[derive(serde::Serialize)]`
2. Implement the `#[tauri::command]` function
3. Register it in the `tauri::Builder` `.invoke_handler(tauri::generate_handler![...])` call
4. Add the TypeScript `invoke()` call in `App.tsx` with proper error handling
5. No capability JSON changes needed unless using new Tauri plugin APIs

### Adding a New View/Screen

Currently views are plain state in `App.tsx`. To add a view:
1. Add a new value to the view state discriminant
2. Add the render branch in the JSX return
3. Add CSS in `App.css` using existing token variables
4. No router registration needed

### Creating Content

Lessons and activities follow auto-numbering: `aula_NN_slug.md` / `atividade_NN_slug.md`. The Rust backend handles numbering based on existing files. Pass the `theme` string (used as slug suffix) to `create_lesson` / `create_activity`.

### Error Handling

All Tauri commands return `Result<T, String>` in Rust. On the frontend, `invoke()` throws the error string on failure. Pattern:

```typescript
try {
  const result = await invoke<SubjectDetail>("get_subject_detail", { ... });
  // handle result
} catch (err) {
  console.error("command failed:", err);
  // update error state
}
```

---

## Development Workflow

### Git Conventions

- Single branch: `main`
- Commit style: `feat: description` (conventional commits, lowercase)
- One author: Mateus Flores
- No PR process currently (direct pushes to main)

### Making Changes

1. Run `npm run tauri dev` — both Vite HMR and Tauri hot-reload are active
2. Rust changes require Tauri to recompile (several seconds); frontend changes are instant via HMR
3. Run `npx tsc --noEmit` before committing to catch type errors
4. Test manually — no automated test suite exists

### Debugging

- **Frontend**: Browser DevTools inside the Tauri window (right-click → Inspect, or `Ctrl+Shift+I`)
- **Rust**: `println!()` / `eprintln!()` output appears in the terminal running `tauri dev`
- **Generation failures**: Check that Marp is installed in the workspace's `node_modules` and that Chrome/Edge is accessible

---

## Hidden Context

### App.tsx Is a God Component — Intentionally for Now

The 1775-line `App.tsx` violates the 500-line component guideline. This is a known, accepted trade-off for the current rapid-prototyping phase. When Phase 3 is complete and the feature set stabilizes, the plan is to decompose into `features/` subdirectory structure as described in the design proposal.

**Do not refactor prematurely.** Wait until Phase 3 is done.

### No TanStack Query / Zustand — Yet

The proposal describes these libraries but they are **not installed**. The current implementation uses direct React state + `useEffect` + `invoke()`. These will be introduced when the component decomposition happens.

### Font Changed from Proposal

The design proposal specified "Clash Display" as the display font. The actual implementation uses **Bricolage Grotesque** (800 weight only) — same extreme-weight grotesque aesthetic, different family. Bricolage Grotesque is available via `@fontsource`.

### Workspace Path Security

The Rust backend performs path traversal checks on all file operations. Any `relative_path` parameter that would escape the workspace is rejected. Do not construct paths using user-provided strings without going through the Tauri command layer.

### Generation Tool Discovery

`generate_content_output` for lessons looks for the Marp binary in this order:
1. `<workspace>/node_modules/.bin/marp`
2. `<workspace>/node_modules/@marp-team/marp-cli/bin/marp.js`

If neither exists, the command fails with an error. The workspace itself must have Marp installed as a dependency — it is not bundled with the app.

### Tauri App Is Not Yet Named

`identifier` in `tauri.conf.json` is `"com.bombe.lumen-studio"`. If the app is ever published to a store, confirm this matches the registered bundle ID.

### Window Size

The default window is `800×600` — intentionally narrow for current development. The actual target viewport is wider (1200px+). CSS uses `minmax` grids so layout adapts. Don't hardcode pixel widths based on the current dev window.

### Status Chip Glyphs

Status indicators use Unicode glyphs (`◉ ok`, `◎ outdated`, `○ none`) to mirror the TUI predecessor's visual language. These are rendered via CSS in `.content-status` elements, not separate icon components.

---

## Known Technical Debt

| Area | Issue | Impact |
|------|-------|--------|
| `App.tsx` | 1775-line god component, 30+ useState hooks | Hard to reason about, no isolation |
| No tests | Zero test coverage | Regressions go undetected |
| No ESLint/Prettier | No code style enforcement | Inconsistent formatting drift |
| `tauri.conf.json` | Window still 800×600 (dev size) | Final UX targets 1200px+ |
| Generation UI | Phase 3 frontend incomplete | Generate button present in Rust, not fully wired in UI |
| No TanStack Router | State-based navigation | No URL history, no deep-linking |
| 2s polling | External file modification detected by polling | Minor battery/CPU cost on editor screen |

---

## Phase Roadmap

| Phase | Status | Description |
|-------|--------|-------------|
| 1 — Shell + Nav | ✅ Complete | Workspace, subject grid, discipline screen, sidebar |
| 2 — Editor | ✅ Complete | CodeMirror editor, auto-save, command palette (Cmd+K) |
| 3 — Preview + Generation | 🔄 In Progress | Marp iframe preview, PDF A4 preview, generation UI wiring |
| 4 — Polish | ⏳ Planned | Framer Motion transitions, fuzzy search in palette, discipline settings |

---

## Debugging Guide

### "invoke is not a function" / IPC errors
Ensure you're running inside a Tauri window (`npm run tauri dev`), not a plain browser (`npm run dev`). The `@tauri-apps/api` bridge only works in the native webview context.

### Marp generation fails silently
Check that the workspace directory has `node_modules/@marp-team/marp-cli` installed. Run `npm install @marp-team/marp-cli` inside the workspace folder — the Rust backend expects it there.

### PDF generation fails
Chrome/Edge must be installed and findable by the OS. The Rust backend auto-detects common installation paths. On Linux, `google-chrome` must be in `$PATH`.

### TypeScript errors on `invoke()` return type
Always assert the return type as a generic: `invoke<YourType>(...)`. The Tauri `invoke` overloads are loose without the generic.

### Hot reload not reflecting Rust changes
Rust recompilation takes 5–30 seconds. Wait for the terminal to show the Tauri rebuild complete message before testing. If changes don't appear, do a full restart with `Ctrl+C` then `npm run tauri dev`.

### Fonts not loading
All fonts are loaded via `@fontsource` imports in `main.tsx`. If fonts are missing, run `npm install` — the fontsource packages are in `package.json` dependencies.
