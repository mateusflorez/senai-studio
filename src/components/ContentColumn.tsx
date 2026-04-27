import type { ContentItem } from "../types";
import { statusGlyph, statusLabel, formatUpdatedAt } from "../utils";

export function ContentColumn({
  title,
  subtitle,
  items,
  emptyMessage,
  selectedPath,
  onSelect,
  actionLabel,
  onAction,
  busyPath,
  onGenerate,
  onOpenOutput,
  onDelete,
}: {
  title: string;
  subtitle: string;
  items: ContentItem[];
  emptyMessage: string;
  selectedPath: string | null;
  onSelect: (relativePath: string) => void;
  actionLabel: string;
  onAction: () => void;
  busyPath: string | null;
  onGenerate: (item: ContentItem) => void;
  onOpenOutput: (item: ContentItem) => void;
  onDelete: (item: ContentItem) => void;
}) {
  return (
    <section className="content-column">
      <div className="content-column-header">
        <div>
          <p className="preview-label">{subtitle}</p>
          <h2>{title}</h2>
        </div>
        <div className="content-column-actions">
          <span className="status-chip">{items.length} itens</span>
          <button type="button" className="ghost-action" onClick={onAction}>
            {actionLabel}
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="content-empty">{emptyMessage}</div>
      ) : (
        <div className="content-list">
          {items.map((item) => (
            <article
              key={item.relativePath}
              className={`content-card ${selectedPath === item.relativePath ? "is-selected" : ""}`}
            >
              <button
                type="button"
                className="content-card-button"
                onClick={() => onSelect(item.relativePath)}
              >
                <div className="content-card-top">
                  <span className={`content-status content-status-${item.status}`}>
                    {statusGlyph(item.status)} {statusLabel(item.status)}
                  </span>
                  <span className="content-file">{item.file}</span>
                </div>
                <h3>{item.title}</h3>
                <p className="content-updated">{formatUpdatedAt(item.updatedAtMs)}</p>
              </button>
              <div className="content-card-footer">
                <div className="content-card-footer-actions">
                  <button
                    type="button"
                    className="ghost-action"
                    onClick={() => onGenerate(item)}
                    disabled={busyPath === item.relativePath}
                  >
                    {busyPath === item.relativePath ? "gerando..." : "Gerar"}
                  </button>
                  {item.status !== "none" ? (
                    <button
                      type="button"
                      className="ghost-action"
                      onClick={() => onOpenOutput(item)}
                    >
                      Abrir
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="ghost-action danger-action content-delete-button"
                    onClick={() => onDelete(item)}
                  >
                    Excluir
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
