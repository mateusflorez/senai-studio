import { useEffect, useRef } from "react";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { EditorState, RangeSetBuilder, StateField, Text } from "@codemirror/state";
import {
  Decoration,
  DecorationSet,
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
});

const hiddenTechnicalBlock = Decoration.replace({ block: true });

const technicalBlocksField = StateField.define<DecorationSet>({
  create(state) {
    return buildTechnicalDecorations(state.doc);
  },
  update(_value, transaction) {
    return transaction.docChanged
      ? buildTechnicalDecorations(transaction.state.doc)
      : buildTechnicalDecorations(transaction.state.doc);
  },
  provide: (field) => [
    EditorView.decorations.from(field),
    EditorView.atomicRanges.of((view) => view.state.field(field)),
  ],
});

const protectTechnicalBlocks = EditorState.transactionFilter.of((transaction) => {
  if (!transaction.docChanged) {
    return transaction;
  }

  const ranges = findTechnicalBlockRanges(transaction.startState.doc);
  let blocked = false;

  transaction.changes.iterChangedRanges((fromA, toA) => {
    if (ranges.some((range) => changeTouchesRange(fromA, toA, range))) {
      blocked = true;
    }
  });

  return blocked ? [] : transaction;
});

export function MarkdownEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (nextValue: string) => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!hostRef.current || viewRef.current) {
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
        technicalBlocksField,
        protectTechnicalBlocks,
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        oneDark,
        editorTheme,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
      ],
    });

    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

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
  }, [value]);

  return <div ref={hostRef} className="markdown-editor" />;
}

function buildTechnicalDecorations(doc: Text) {
  const builder = new RangeSetBuilder<Decoration>();

  for (const range of findTechnicalBlockRanges(doc)) {
    builder.add(range.from, range.to, hiddenTechnicalBlock);
  }

  return builder.finish();
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
        to: lineEnd(doc, closingLine.number),
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
          to: lineEnd(doc, closingLine.number),
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
          to: lineEnd(doc, closingLine.number),
        });
        lineNumber = closingLine.number + 1;
        continue;
      }
    }

    if (isTechnicalAssetLine(trimmed)) {
      ranges.push({
        from: line.from,
        to: lineEnd(doc, lineNumber),
      });
      lineNumber += 1;
      continue;
    }

    lineNumber += 1;
  }

  return ranges.filter((range) => range.from < range.to);
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

function lineEnd(doc: Text, lineNumber: number) {
  const line = doc.line(lineNumber);
  return line.number < doc.lines ? doc.line(line.number + 1).from : line.to;
}

function isTechnicalAssetLine(trimmed: string) {
  return (
    trimmed.startsWith("![") &&
    (trimmed.includes("lumen_logo") ||
      trimmed.includes("/assets/logo") ||
      trimmed.includes("\\assets\\logo") ||
      trimmed.includes("../shared/"))
  );
}

function changeTouchesRange(from: number, to: number, range: TechnicalBlockRange) {
  if (from === to) {
    return from >= range.from && from <= range.to;
  }

  return from < range.to && to > range.from;
}

type TechnicalBlockRange = {
  from: number;
  to: number;
};
