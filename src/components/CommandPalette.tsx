export type CommandAction = {
  id: string;
  label: string;
  hint: string;
  keywords: string;
  run: () => void;
};

export function CommandPalette({
  query,
  onQueryChange,
  actions,
  onClose,
}: {
  query: string;
  onQueryChange: (nextValue: string) => void;
  actions: CommandAction[];
  onClose: () => void;
}) {
  return (
    <div className="command-palette-backdrop" onClick={onClose}>
      <section
        className="command-palette"
        aria-label="Command palette"
        onClick={(event) => event.stopPropagation()}
      >
        <input
          autoFocus
          type="text"
          className="command-palette-input"
          placeholder="Buscar acao..."
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
        <div className="command-palette-list">
          {actions.length > 0 ? (
            actions.map((action) => (
              <button
                key={action.id}
                type="button"
                className="command-palette-item"
                onClick={() => {
                  action.run();
                  onClose();
                }}
              >
                <span>{action.label}</span>
                <span className="command-palette-hint">{action.hint}</span>
              </button>
            ))
          ) : (
            <div className="command-palette-empty">Nenhuma acao encontrada.</div>
          )}
        </div>
      </section>
    </div>
  );
}

export function buildCommandActions({
  viewingDetail,
  viewingEditor,
  hasWorkspace,
  showTechnicalBlocks,
  canReloadCurrentFile,
  onChooseWorkspace,
  onCreateSubject,
  onCreateTemplateSubject,
  onGoHome,
  onGoToFiles,
  onToggleTechnicalBlocks,
  onReloadCurrentFile,
}: {
  viewingDetail: boolean;
  viewingEditor: boolean;
  hasWorkspace: boolean;
  showTechnicalBlocks: boolean;
  canReloadCurrentFile: boolean;
  onChooseWorkspace: () => Promise<void>;
  onCreateSubject: () => void;
  onCreateTemplateSubject: () => void;
  onGoHome: () => void;
  onGoToFiles: () => void;
  onToggleTechnicalBlocks: () => void;
  onReloadCurrentFile: () => void;
}): CommandAction[] {
  const actions: CommandAction[] = [];

  if (hasWorkspace) {
    actions.push({
      id: "create-subject",
      label: "Nova disciplina",
      hint: "Criacao",
      keywords: "nova disciplina criar vazia",
      run: onCreateSubject,
    });
    actions.push({
      id: "choose-workspace",
      label: "Alterar pasta",
      hint: "Workspace",
      keywords: "pasta workspace caminho alterar selecionar",
      run: () => { void onChooseWorkspace(); },
    });
    actions.push({
      id: "create-template-subject",
      label: "Nova disciplina modelo",
      hint: "Criacao",
      keywords: "nova disciplina modelo criar gerar exemplo",
      run: onCreateTemplateSubject,
    });
  }

  if (viewingDetail) {
    actions.push({
      id: "go-home",
      label: "Voltar para disciplinas",
      hint: "Navegacao",
      keywords: "home disciplinas voltar inicio",
      run: onGoHome,
    });
  }

  if (viewingEditor) {
    actions.push({
      id: "go-files",
      label: "Voltar para arquivos da disciplina",
      hint: "Navegacao",
      keywords: "arquivos disciplina voltar lista",
      run: onGoToFiles,
    });
    actions.push({
      id: "toggle-technical-blocks",
      label: showTechnicalBlocks ? "Ocultar blocos tecnicos" : "Mostrar blocos tecnicos",
      hint: "Editor",
      keywords: "blocos tecnicos css frontmatter anotacoes marp mostrar ocultar",
      run: onToggleTechnicalBlocks,
    });
  }

  if (canReloadCurrentFile) {
    actions.push({
      id: "reload-current-file",
      label: "Recarregar arquivo aberto",
      hint: "Editor",
      keywords: "recarregar arquivo atualizar modificado externo",
      run: onReloadCurrentFile,
    });
  }

  return actions;
}
