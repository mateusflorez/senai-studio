import type { EditableContentFile, ContentItem, SaveState } from "../types";
import { saveStateClassName, saveStateLabel, statusGlyph, statusLabel } from "../utils";
import { LoadingState, ErrorState } from "../components/FeedbackStates";
import { MarkdownEditor } from "../components/MarkdownEditor";
import { MarpPreview } from "../components/MarpPreview";
import { ActivityPreview } from "../components/ActivityPreview";

export function EditorScreen({
  workspacePath,
  backLabel,
  editorDocument,
  selectedContentItem,
  editorContent,
  editorLoading,
  editorError,
  saveState,
  lastSavedAtMs,
  showMarpPreview,
  externallyModified,
  onChange,
  onGoBack,
  onToggleMarpPreview,
}: {
  workspacePath: string;
  backLabel: string;
  editorDocument: EditableContentFile | null;
  selectedContentItem: ContentItem | null;
  editorContent: string;
  editorLoading: boolean;
  editorError: string | null;
  saveState: SaveState;
  lastSavedAtMs: number | null;
  showMarpPreview: boolean;
  externallyModified: boolean;
  onChange: (content: string) => void;
  onGoBack: () => void;
  onToggleMarpPreview: () => void;
}) {
  const isLesson = Boolean(selectedContentItem?.relativePath.startsWith("aulas/"));
  const isActivity = Boolean(selectedContentItem?.relativePath.startsWith("atividades/"));
  const canPreview = isLesson || isActivity;
  const previewVisible = showMarpPreview && canPreview;

  return (
    <section className="editor-screen" aria-labelledby="editor-title">
      <div className="editor-screen-header">
        <div className="editor-screen-copy">
          <button type="button" className="back-action" onClick={onGoBack}>
            ← {backLabel}
          </button>
          <p className="hero-kicker">Editor</p>
          <h1 id="editor-title">
            {editorDocument?.title ?? selectedContentItem?.title ?? "Abrindo arquivo"}
          </h1>
          <p className="hero-body">
            Edite o conteúdo e o aplicativo salva automaticamente pouco depois
            da sua última alteração.
          </p>
        </div>

        <aside className="workspace-panel editor-screen-panel">
          <div className="workspace-heading">
            <p className="preview-label">Arquivo aberto</p>
            {selectedContentItem || editorDocument ? (
              <span className="status-chip">{selectedContentItem?.file ?? editorDocument?.file}</span>
            ) : null}
            {canPreview ? (
              <button
                type="button"
                className={`ghost-action${previewVisible ? " ghost-action--active" : ""}`}
                onClick={onToggleMarpPreview}
              >
                {previewVisible ? "ocultar prévia" : "mostrar prévia"}
              </button>
            ) : null}
          </div>
          <div className="subject-detail-flags">
            <span className={`status-chip ${saveStateClassName(saveState)}`}>
              {saveStateLabel(saveState, lastSavedAtMs)}
            </span>
            {externallyModified ? (
              <span className="status-chip status-chip-warning">
                ◎ modificado externamente
              </span>
            ) : null}
            {selectedContentItem ? (
              <span className={`content-status content-status-${selectedContentItem.status}`}>
                {statusGlyph(selectedContentItem.status)}{" "}
                {statusLabel(selectedContentItem.status)}
              </span>
            ) : null}
          </div>
        </aside>
      </div>

      {editorError ? <ErrorState message={editorError} /> : null}
      {editorLoading ? <LoadingState /> : null}
      {!editorLoading && !editorError && editorDocument ? (
        <div className={`editor-body${previewVisible ? " editor-body--split" : ""}`}>
          <section className="editor-panel" aria-label="Editor Markdown">
            <div className="editor-surface">
              <MarkdownEditor
                key={editorDocument.relativePath}
                value={editorContent}
                onChange={onChange}
              />
            </div>
          </section>
          {previewVisible ? (
            <div className="marp-preview-container">
              {isLesson ? (
                <MarpPreview workspacePath={workspacePath} content={editorContent} />
              ) : (
                <ActivityPreview workspacePath={workspacePath} content={editorContent} />
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
