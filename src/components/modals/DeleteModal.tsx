import { ModalFrame } from "../ModalFrame";
import type { DeleteTarget } from "../../types";

export function DeleteModal({
  target,
  deleting,
  onClose,
  onConfirm,
}: {
  target: DeleteTarget;
  deleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <ModalFrame
      title={target.kind === "subject" ? "Excluir disciplina" : `Excluir ${target.label}`}
      onClose={onClose}
    >
      <div className="modal-stack">
        <p className="modal-copy">
          {target.kind === "subject"
            ? `Tem certeza que deseja excluir a disciplina "${target.name}"?`
            : `Tem certeza que deseja excluir ${target.label === "aula" ? "a aula" : "a atividade"} "${target.title}"?`}
        </p>
        <p className="modal-copy modal-copy-danger">
          Essa acao remove o arquivo do workspace e nao pode ser desfeita.
        </p>
        <div className="modal-actions">
          <button type="button" className="ghost-action" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="ghost-action danger-action"
            onClick={onConfirm}
            disabled={deleting}
          >
            {deleting ? "excluindo..." : "Excluir"}
          </button>
        </div>
      </div>
    </ModalFrame>
  );
}
