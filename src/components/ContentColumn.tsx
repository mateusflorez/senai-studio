import { useEffect, useState } from "react";
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
  generationBusy,
  onGenerate,
  onOpenOutput,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onRename,
  onDelete,
  onPreview,
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
  generationBusy: boolean;
  onGenerate: (item: ContentItem) => void;
  onOpenOutput: (item: ContentItem) => void;
  onMoveUp: (item: ContentItem) => void;
  onMoveDown: (item: ContentItem) => void;
  onDuplicate: (item: ContentItem) => void;
  onRename: (item: ContentItem) => void;
  onDelete: (item: ContentItem) => void;
  onPreview: (item: ContentItem) => void;
}) {
  const [openMenuPath, setOpenMenuPath] = useState<string | null>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.closest("[data-content-menu]")) return;
      setOpenMenuPath(null);
    }

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, []);

  function handleMenuAction(action: () => void) {
    setOpenMenuPath(null);
    action();
  }

  return (
    <section className="content-column">
      <div className="content-column-header">
        <div>
          <p className="preview-label">{subtitle}</p>
          <h2>{title}</h2>
        </div>
        <div className="content-column-actions">
          <span className="status-chip">{items.length} itens</span>
          <button type="button" className="ghost-action" onClick={onAction} disabled={generationBusy}>
            {actionLabel}
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="content-empty">{emptyMessage}</div>
      ) : (
        <div className="content-list">
          {items.map((item, index) => (
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
                    onClick={() => handleMenuAction(() => onPreview(item))}
                  >
                    Preview
                  </button>
                  <button
                    type="button"
                    className="ghost-action"
                    onClick={() => handleMenuAction(() => onGenerate(item))}
                    disabled={generationBusy}
                  >
                    {busyPath === item.relativePath ? "gerando..." : "Gerar"}
                  </button>
                  {item.status !== "none" ? (
                    <button
                      type="button"
                      className="ghost-action"
                      onClick={() => handleMenuAction(() => onOpenOutput(item))}
                      disabled={generationBusy}
                    >
                      Abrir
                    </button>
                  ) : null}
                  <div className="content-card-menu" data-content-menu>
                    <button
                      type="button"
                      className={`ghost-action content-card-menu-trigger${openMenuPath === item.relativePath ? " ghost-action--active" : ""}`}
                      onClick={() =>
                        setOpenMenuPath((current) =>
                          current === item.relativePath ? null : item.relativePath,
                        )
                      }
                      disabled={generationBusy}
                    >
                      Mais
                    </button>
                    {openMenuPath === item.relativePath ? (
                      <div className="content-card-menu-popover">
                        <button
                          type="button"
                          className="content-card-menu-item"
                          onClick={() => handleMenuAction(() => onMoveUp(item))}
                          disabled={index === 0}
                        >
                          Mover para cima
                        </button>
                        <button
                          type="button"
                          className="content-card-menu-item"
                          onClick={() => handleMenuAction(() => onMoveDown(item))}
                          disabled={index === items.length - 1}
                        >
                          Mover para baixo
                        </button>
                        <button
                          type="button"
                          className="content-card-menu-item"
                          onClick={() => handleMenuAction(() => onDuplicate(item))}
                        >
                          Duplicar
                        </button>
                        <button
                          type="button"
                          className="content-card-menu-item"
                          onClick={() => handleMenuAction(() => onRename(item))}
                        >
                          Renomear
                        </button>
                        <button
                          type="button"
                          className="content-card-menu-item is-danger"
                          onClick={() => handleMenuAction(() => onDelete(item))}
                        >
                          Excluir
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
