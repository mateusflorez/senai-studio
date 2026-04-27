import { useEffect, useEffectEvent, useRef } from "react";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { codeFolding, foldEffect } from "@codemirror/language";
import { EditorState, Text } from "@codemirror/state";
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import { markdown } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";

const editorTheme = EditorView.theme({
  "&": {
    minHeight: "30rem",
    borderRadius: "1.1rem",
    overflow: "hidden",
    backgroundColor: "rgba(10, 14, 22, 0.92)",
  },
  ".cm-scroller": {
    fontFamily: "var(--font-ui)",
    lineHeight: "1.6",
  },
  ".cm-gutters": {
    borderRight: "1px solid rgba(255, 255, 255, 0.06)",
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    color: "var(--text-dim)",
    fontFamily: "var(--font-ui)",
  },
  ".cm-content": {
    minHeight: "30rem",
    padding: "1.2rem 1.25rem 2rem",
    fontFamily: "var(--font-ui)",
    fontSize: "0.95rem",
    caretColor: "var(--accent)",
  },
  ".cm-line": {
    padding: "0 0.1rem",
  },
  ".cm-activeLine": {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  ".cm-selectionBackground": {
    backgroundColor: "rgba(255, 185, 56, 0.22) !important",
  },
  ".cm-cursor": {
    borderLeftColor: "var(--accent)",
  },
  ".cm-foldPlaceholder": {
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: "999px",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    color: "var(--text-secondary)",
    padding: "0.1rem 0.5rem",
    fontFamily: "var(--font-ui)",
  },
});

export function MarkdownEditor({
  value,
  onChange,
  showTechnicalBlocks,
}: {
  value: string;
  onChange: (nextValue: string) => void;
  showTechnicalBlocks: boolean;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeEvent = useEffectEvent(onChange);

  useEffect(() => {
    if (!hostRef.current) {
      return;
    }

    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        history(),
        drawSelection(),
        highlightActiveLine(),
        markdown(),
        codeFolding({
          placeholderDOM: (_view, onclick, prepared) => {
            const placeholder = document.createElement("button");
            placeholder.type = "button";
            placeholder.className = "cm-foldPlaceholder";
            placeholder.textContent =
              typeof prepared === "string" ? prepared : "bloco tecnico oculto";
            placeholder.onclick = onclick;
            return placeholder;
          },
          preparePlaceholder: (state, range) => technicalBlockLabel(state.doc, range.from),
        }),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        oneDark,
        editorTheme,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeEvent(update.state.doc.toString());
          }
        }),
      ],
    });

    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;
    if (!showTechnicalBlocks) {
      foldTechnicalBlocks(view);
    }

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [onChangeEvent, showTechnicalBlocks, value]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }

    const currentValue = view.state.doc.toString();
    if (currentValue === value) {
      return;
    }

    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
    });
    if (!showTechnicalBlocks) {
      foldTechnicalBlocks(view);
    }
  }, [showTechnicalBlocks, value]);

  return <div ref={hostRef} className="markdown-editor" />;
}

function foldTechnicalBlocks(view: EditorView) {
  const effects = findTechnicalBlockRanges(view.state.doc).map((range) => foldEffect.of(range));

  if (effects.length > 0) {
    view.dispatch({ effects });
  }
}

function findTechnicalBlockRanges(doc: Text) {
  const ranges: TechnicalBlockRange[] = [];
  let lineNumber = 1;

  if (doc.lines > 0 && doc.line(1).text.trim() === "---") {
    const closingLine = findClosingLine(doc, 2, (line) => {
      const trimmed = line.text.trim();
      return trimmed === "---" || trimmed === "...";
    });

    if (closingLine) {
      ranges.push({
        from: doc.line(1).from,
        to: closingLine.to,
        label: "configuracao do slide",
      });
      lineNumber = closingLine.number + 1;
    }
  }

  while (lineNumber <= doc.lines) {
    const line = doc.line(lineNumber);
    const trimmed = line.text.trim();

    if (trimmed.startsWith("<style>")) {
      const closingLine = findClosingLine(doc, lineNumber, (nextLine) =>
        nextLine.text.trim().includes("</style>"),
      );

      if (closingLine) {
        ranges.push({
          from: line.from,
          to: closingLine.to,
          label: "css do tema",
        });
        lineNumber = closingLine.number + 1;
        continue;
      }
    }

    if (trimmed.startsWith("<!--")) {
      const closingLine = findClosingLine(doc, lineNumber, (nextLine) =>
        nextLine.text.trim().includes("-->"),
      );

      if (closingLine) {
        ranges.push({
          from: line.from,
          to: closingLine.to,
          label: commentBlockLabel(line.text),
        });
        lineNumber = closingLine.number + 1;
        continue;
      }
    }

    lineNumber += 1;
  }

  return ranges.filter((range) => range.from < range.to);
}

function technicalBlockLabel(doc: Text, from: number) {
  return findTechnicalBlockRanges(doc).find((range) => range.from === from)?.label ?? null;
}

function commentBlockLabel(text: string) {
  const normalized = text.toLowerCase();
  if (normalized.includes("_class:") || normalized.includes("_paginate:") || normalized.includes("_footer:")) {
    return "configuracao do slide";
  }

  return "anotacoes do apresentador";
}

function findClosingLine(
  doc: Text,
  startLineNumber: number,
  predicate: (line: { text: string }) => boolean,
) {
  for (let lineNumber = startLineNumber; lineNumber <= doc.lines; lineNumber += 1) {
    const line = doc.line(lineNumber);
    if (predicate(line)) {
      return line;
    }
  }

  return null;
}

type TechnicalBlockRange = {
  from: number;
  to: number;
  label: string;
};
