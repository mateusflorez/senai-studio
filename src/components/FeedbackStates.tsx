export function LoadingState() {
  return (
    <div className="feedback-panel" role="status">
      <p className="preview-label">carregando</p>
      <p className="feedback-title">Carregando seu material...</p>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="feedback-panel is-error" role="alert">
      <p className="preview-label">erro</p>
      <p className="feedback-title">Nao foi possivel abrir esta tela.</p>
      <p className="feedback-copy">{message}</p>
    </div>
  );
}

export function EmptyWorkspaceState({
  onChooseWorkspace,
}: {
  onChooseWorkspace: () => Promise<void>;
}) {
  return (
    <div className="feedback-panel" role="status">
      <p className="preview-label">Primeiro passo</p>
      <p className="feedback-title">
        Selecione a pasta onde seu material esta salvo.
      </p>
      <p className="feedback-copy">
        Pode ser uma pasta existente ou uma nova pasta para organizar seu
        planejamento. Depois disso, o aplicativo lembra essa escolha nas
        proximas aberturas.
      </p>
      <button
        type="button"
        className="primary-action"
        onClick={() => void onChooseWorkspace()}
      >
        Selecionar pasta
      </button>
    </div>
  );
}
