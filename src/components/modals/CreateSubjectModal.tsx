import { useState, type CSSProperties } from "react";
import { ModalFrame } from "../ModalFrame";

const colorOptions = [
  "#FFB938",
  "#F97316",
  "#22C55E",
  "#06B6D4",
  "#2563EB",
  "#E11D48",
];

export function CreateSubjectModal({
  onClose,
  onConfirm,
}: {
  onClose: () => void;
  onConfirm: (name: string, color: string) => Promise<void>;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [color, setColor] = useState(colorOptions[0]);
  const [creating, setCreating] = useState(false);

  function handleClose() {
    if (creating) return;
    onClose();
  }

  async function handleConfirm() {
    if (!name.trim() || creating) return;
    setCreating(true);
    try {
      await onConfirm(name.trim(), color);
    } finally {
      setCreating(false);
    }
  }

  return (
    <ModalFrame title="Nova disciplina" onClose={handleClose}>
      {step === 1 ? (
        <div className="modal-stack">
          <p className="modal-copy">
            Escolha o nome da disciplina. A pasta sera criada automaticamente no seu workspace.
          </p>
          <label className="modal-field">
            <span className="preview-label">Nome da disciplina</span>
            <input
              autoFocus
              type="text"
              className="modal-input"
              placeholder="Ex.: Desenvolvimento Mobile"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <div className="modal-actions">
            <button type="button" className="ghost-action" onClick={handleClose}>
              Cancelar
            </button>
            <button
              type="button"
              className="primary-action"
              onClick={() => setStep(2)}
              disabled={!name.trim()}
            >
              Continuar
            </button>
          </div>
        </div>
      ) : (
        <div className="modal-stack">
          <p className="modal-copy">
            Escolha a cor da disciplina. Ela sera usada no card da home.
          </p>
          <div className="color-grid" role="radiogroup" aria-label="Escolher cor da disciplina">
            {colorOptions.map((opt) => (
              <button
                key={opt}
                type="button"
                className={`color-option ${color === opt ? "is-active" : ""}`}
                style={{ backgroundColor: opt } as CSSProperties}
                onClick={() => setColor(opt)}
                aria-label={`Selecionar cor ${opt}`}
              />
            ))}
          </div>
          <div className="modal-preview">
            <span className="subject-swatch" style={{ backgroundColor: color }} aria-hidden="true" />
            <div>
              <p className="preview-label">Previa</p>
              <strong>{name.trim() || "Nova disciplina"}</strong>
            </div>
          </div>
          <div className="modal-actions">
            <button
              type="button"
              className="ghost-action"
              onClick={() => setStep(1)}
              disabled={creating}
            >
              Voltar
            </button>
            <button
              type="button"
              className="primary-action"
              onClick={() => void handleConfirm()}
              disabled={creating}
            >
              {creating ? "criando..." : "Criar disciplina"}
            </button>
          </div>
        </div>
      )}
    </ModalFrame>
  );
}
