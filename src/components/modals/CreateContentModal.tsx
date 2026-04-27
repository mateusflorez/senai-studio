import { useState } from "react";
import { ModalFrame } from "../ModalFrame";
import { nextContentNumberLabel } from "../../utils";
import type { ContentItem } from "../../types";

export function CreateContentModal({
  kind,
  existingItems,
  onClose,
  onConfirm,
}: {
  kind: "aula" | "atividade";
  existingItems: ContentItem[];
  onClose: () => void;
  onConfirm: (theme: string) => Promise<void>;
}) {
  const [theme, setTheme] = useState("");
  const [creating, setCreating] = useState(false);
  const numberLabel = nextContentNumberLabel(existingItems);
  const isLesson = kind === "aula";

  function handleClose() {
    if (creating) return;
    onClose();
  }

  async function handleConfirm() {
    if (!theme.trim() || creating) return;
    setCreating(true);
    try {
      await onConfirm(theme.trim());
    } finally {
      setCreating(false);
    }
  }

  return (
    <ModalFrame title={isLesson ? "+ Aula" : "+ Atividade"} onClose={handleClose}>
      <div className="modal-stack">
        <p className="modal-copy">
          Informe o tema {isLesson ? "da aula" : "da atividade"}. O arquivo sera criado como{" "}
          {isLesson ? "Aula" : "Atividade"} {numberLabel}.
        </p>
        <label className="modal-field">
          <span className="preview-label">Tema {isLesson ? "da aula" : "da atividade"}</span>
          <input
            autoFocus
            type="text"
            className="modal-input"
            placeholder={isLesson ? "Ex.: Introducao a APIs REST" : "Ex.: Revisao de conceitos principais"}
            value={theme}
            onChange={(event) => setTheme(event.target.value)}
          />
        </label>
        <div className="modal-preview">
          <div>
            <p className="preview-label">Titulo</p>
            <strong>
              {isLesson ? "Aula" : "Atividade"} {numberLabel} -{" "}
              {theme.trim() || (isLesson ? "Tema da aula" : "Tema da atividade")}
            </strong>
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="ghost-action" onClick={handleClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="primary-action"
            onClick={() => void handleConfirm()}
            disabled={!theme.trim() || creating}
          >
            {creating ? "criando..." : isLesson ? "Criar aula" : "Criar atividade"}
          </button>
        </div>
      </div>
    </ModalFrame>
  );
}
