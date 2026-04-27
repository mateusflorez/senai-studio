import { useEffect, useEffectEvent, useRef } from "react";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { EditorState, RangeSetBuilder } from "@codemirror/state";
import {
  Decoration,
  drawSelection,
  EditorView,
  highlightActiveLine,
  keymap,
  lineNumbers,
} from "@codemirror/view";
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
  ".cm-marp-delimiter-line": {
    color: "#f6c177",
    fontFamily: "var(--font-ui)",
  },
  ".cm-marp-frontmatter-line": {
    color: "#9ccfd8",
  },
  ".cm-marp-key": {
    color: "#f6c177",
    fontFamily: "var(--font-ui)",
  },
  ".cm-marp-directive": {
    color: "#c4a7e7",
    fontFamily: "var(--font-ui)",
  },
});

const marpDecorations = EditorView.decorations.compute(["doc"], (state) => {
  const builder = new RangeSetBuilder<Decoration>();
  let inFrontmatter = false;

  for (let lineNumber = 1; lineNumber <= state.doc.lines; lineNumber += 1) {
    const line = state.doc.line(lineNumber);
    const text = line.text;
    const trimmed = text.trim();

    if (lineNumber === 1 && trimmed === "---") {
      inFrontmatter = true;
      if (line.from < line.to) {
        builder.add(line.from, line.to, Decoration.mark({ class: "cm-marp-delimiter-line" }));
      }
      continue;
    }

    if (inFrontmatter) {
      if (trimmed === "---" || trimmed === "...") {
        if (line.from < line.to) {
          builder.add(line.from, line.to, Decoration.mark({ class: "cm-marp-delimiter-line" }));
        }
        inFrontmatter = false;
        continue;
      }

      if (line.from < line.to) {
        builder.add(line.from, line.to, Decoration.mark({ class: "cm-marp-frontmatter-line" }));
      }

      const keyMatch = text.match(/^(\s*)([A-Za-z_][\w-]*)(\s*:)/);
      if (keyMatch) {
        const keyStart = line.from + keyMatch[1].length;
        const keyEnd = keyStart + keyMatch[2].length;
        builder.add(keyStart, keyEnd, Decoration.mark({ class: "cm-marp-key" }));
      }

      continue;
    }

    const directiveMatch = text.match(/<!--\s*([^>]*:[^>]*)\s*-->/);
    if (directiveMatch && directiveMatch.index !== undefined) {
      const directiveStart =
        line.from + directiveMatch.index + directiveMatch[0].indexOf(directiveMatch[1]);
      const directiveEnd = directiveStart + directiveMatch[1].length;
      builder.add(directiveStart, directiveEnd, Decoration.mark({ class: "cm-marp-directive" }));
    }
  }

  return builder.finish();
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
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        oneDark,
        editorTheme,
        marpDecorations,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeEvent(update.state.doc.toString());
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
  }, [onChangeEvent]);

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
