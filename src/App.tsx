import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { MarkdownEditor } from "./components/MarkdownEditor";
import "./App.css";

type SubjectSummary = {
  id: string;
  slug: string;
  displayName: string;
  color: string;
  lessonCount: number;
  activityCount: number;
  hasContext: boolean;
  hasPlan: boolean;
  updatedAtMs: number | null;
};

type SubjectDetail = {
  id: string;
  slug: string;
  displayName: string;
  color: string;
  hasContext: boolean;
  hasPlan: boolean;
  lessons: ContentItem[];
  activities: ContentItem[];
};

type ContentItem = {
  file: string;
  relativePath: string;
  title: string;
  status: "ok" | "outdated" | "none";
  updatedAtMs: number | null;
};

type EditableContentFile = {
  file: string;
  relativePath: string;
  title: string;
  content: string;
  updatedAtMs: number | null;
};

type SaveContentResult = {
  updatedAtMs: number | null;
};

type ContentFileSnapshot = {
  content: string;
  updatedAtMs: number | null;
};

type CreateTemplateSubjectResult = {
  slug: string;
};

type CreateContentItemResult = {
  relativePath: string;
};

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

const workspaceStorageKey = "senai-studio.workspace-path";

function App() {
  const [workspacePath, setWorkspacePath] = useState(() =>
    window.localStorage.getItem(workspaceStorageKey) ?? "",
  );
  const [subjects, setSubjects] = useState<SubjectSummary[]>([]);
  const [selectedSubjectSlug, setSelectedSubjectSlug] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<SubjectDetail | null>(null);
  const [selectedContentPath, setSelectedContentPath] = useState<string | null>(null);
  const [editorDocument, setEditorDocument] = useState<EditableContentFile | null>(null);
  const [editorContent, setEditorContent] = useState("");
  const [loadedEditorContent, setLoadedEditorContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editorLoading, setEditorLoading] = useState(false);
  const [changingWorkspace, setChangingWorkspace] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastSavedAtMs, setLastSavedAtMs] = useState<number | null>(null);
  const [showTechnicalBlocks, setShowTechnicalBlocks] = useState(false);
  const [externallyModified, setExternallyModified] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [creatingTemplateSubject, setCreatingTemplateSubject] = useState(false);

  const editorContentRef = useRef("");
  const saveRequestRef = useRef(0);

  useEffect(() => {
    editorContentRef.current = editorContent;
  }, [editorContent]);

  async function refreshSubjects(nextWorkspacePath: string) {
    if (!nextWorkspacePath) {
      setSubjects([]);
      setSelectedSubjectSlug(null);
      setSelectedSubject(null);
      setSelectedContentPath(null);
      setEditorDocument(null);
      setEditorContent("");
      setLoadedEditorContent("");
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);

    try {
      const nextSubjects = await invoke<SubjectSummary[]>("list_subjects", {
        workspacePath: nextWorkspacePath,
      });

      setSubjects(nextSubjects);
      setError(null);

      if (
        selectedSubjectSlug &&
        !nextSubjects.some((subject) => subject.slug === selectedSubjectSlug)
      ) {
        setSelectedSubjectSlug(null);
        setSelectedSubject(null);
        setSelectedContentPath(null);
        setEditorDocument(null);
        setEditorContent("");
        setLoadedEditorContent("");
      }
    } catch (cause) {
      setSubjects([]);
      setSelectedSubjectSlug(null);
      setSelectedSubject(null);
      setSelectedContentPath(null);
      setEditorDocument(null);
      setEditorContent("");
      setLoadedEditorContent("");
      setError(cause instanceof Error ? cause.message : "Falha ao ler disciplinas.");
    } finally {
      setLoading(false);
    }
  }

  async function refreshSubjectDetail(
    nextWorkspacePath: string,
    subjectSlug: string,
  ) {
    setDetailLoading(true);

    try {
      const detail = await invoke<SubjectDetail>("get_subject_detail", {
        workspacePath: nextWorkspacePath,
        subjectSlug,
      });

      setSelectedSubject(detail);
      setDetailError(null);
    } catch (cause) {
      setSelectedSubject(null);
      setDetailError(
        cause instanceof Error ? cause.message : "Falha ao carregar a disciplina.",
      );
    } finally {
      setDetailLoading(false);
    }
  }

  async function refreshEditorDocument(
    nextWorkspacePath: string,
    subjectSlug: string,
    relativePath: string,
  ) {
    setEditorLoading(true);

    try {
      const document = await invoke<EditableContentFile>("read_content_file", {
        workspacePath: nextWorkspacePath,
        subjectSlug,
        relativePath,
      });

      setEditorDocument(document);
      setEditorContent(document.content);
      setLoadedEditorContent(document.content);
      setLastSavedAtMs(document.updatedAtMs);
      setEditorError(null);
      setSaveState("idle");
      setExternallyModified(false);
    } catch (cause) {
      setEditorDocument(null);
      setEditorContent("");
      setLoadedEditorContent("");
      setEditorError(
        cause instanceof Error ? cause.message : "Falha ao abrir o arquivo selecionado.",
      );
    } finally {
      setEditorLoading(false);
    }
  }

  async function saveDocument(contentToSave: string) {
    if (!workspacePath || !selectedSubjectSlug || !selectedContentPath) {
      return;
    }

    const requestId = saveRequestRef.current + 1;
    saveRequestRef.current = requestId;
    setSaveState("saving");

    try {
      const result = await invoke<SaveContentResult>("save_content_file", {
        workspacePath,
        subjectSlug: selectedSubjectSlug,
        relativePath: selectedContentPath,
        content: contentToSave,
      });

      if (saveRequestRef.current !== requestId) {
        return;
      }

      setLoadedEditorContent(contentToSave);
      setLastSavedAtMs(result.updatedAtMs);
      setSaveState(editorContentRef.current === contentToSave ? "saved" : "dirty");

      await Promise.all([
        refreshSubjects(workspacePath),
        refreshSubjectDetail(workspacePath, selectedSubjectSlug),
      ]);
    } catch (cause) {
      if (saveRequestRef.current !== requestId) {
        return;
      }

      setSaveState("error");
      setEditorError(cause instanceof Error ? cause.message : "Falha ao salvar o arquivo.");
    }
  }

  useEffect(() => {
    void refreshSubjects(workspacePath);
  }, [workspacePath]);

  useEffect(() => {
    if (!workspacePath || !selectedSubjectSlug) {
      setSelectedSubject(null);
      setSelectedContentPath(null);
      setDetailLoading(false);
      setDetailError(null);
      return;
    }

    void refreshSubjectDetail(workspacePath, selectedSubjectSlug);
  }, [workspacePath, selectedSubjectSlug]);

  useEffect(() => {
    if (!selectedSubject) {
      setSelectedContentPath(null);
      return;
    }

    const availableItems = [...selectedSubject.lessons, ...selectedSubject.activities];

    if (
      selectedContentPath &&
      !availableItems.some((item) => item.relativePath === selectedContentPath)
    ) {
      setSelectedContentPath(null);
    }
  }, [selectedSubject, selectedContentPath]);

  useEffect(() => {
    if (!workspacePath || !selectedSubjectSlug || !selectedContentPath) {
      setEditorDocument(null);
      setEditorContent("");
      setLoadedEditorContent("");
      setEditorLoading(false);
      setEditorError(null);
      setSaveState("idle");
      return;
    }

    void refreshEditorDocument(workspacePath, selectedSubjectSlug, selectedContentPath);
  }, [workspacePath, selectedSubjectSlug, selectedContentPath]);

  useEffect(() => {
    if (!workspacePath || !selectedSubjectSlug || !selectedContentPath || editorLoading) {
      return;
    }

    if (editorContent === loadedEditorContent) {
      return;
    }

    setSaveState((currentState) => (currentState === "saving" ? currentState : "dirty"));

    const timeoutId = window.setTimeout(() => {
      void saveDocument(editorContent);
    }, 800);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    editorContent,
    loadedEditorContent,
    editorLoading,
    workspacePath,
    selectedSubjectSlug,
    selectedContentPath,
  ]);

  async function handleChooseWorkspace() {
    setChangingWorkspace(true);

    try {
      const selection = await open({
        directory: true,
        multiple: false,
        defaultPath: workspacePath || undefined,
        title: "Selecionar pasta do SENAI Studio",
      });

      if (typeof selection !== "string" || !selection.trim()) {
        return;
      }

      window.localStorage.setItem(workspaceStorageKey, selection);
      setWorkspacePath(selection);
      setSelectedSubjectSlug(null);
      setSelectedSubject(null);
      setSelectedContentPath(null);
      setEditorDocument(null);
      setEditorContent("");
      setLoadedEditorContent("");
      setSaveState("idle");
      setExternallyModified(false);
    } finally {
      setChangingWorkspace(false);
    }
  }

  async function handleCreateTemplateSubject() {
    if (!workspacePath || creatingTemplateSubject) {
      return;
    }

    setCreatingTemplateSubject(true);

    try {
      const result = await invoke<CreateTemplateSubjectResult>("create_template_subject", {
        workspacePath,
      });

      await refreshSubjects(workspacePath);
      setSelectedSubjectSlug(result.slug);
      setSelectedContentPath(null);
      setEditorDocument(null);
      setEditorContent("");
      setLoadedEditorContent("");
      setSaveState("idle");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Falha ao criar a disciplina modelo.",
      );
    } finally {
      setCreatingTemplateSubject(false);
    }
  }

  async function handleCreateLessonDraft() {
    if (!workspacePath || !selectedSubjectSlug) {
      return;
    }

    const result = await invoke<CreateContentItemResult>("create_lesson_draft", {
      workspacePath,
      subjectSlug: selectedSubjectSlug,
    });

    await refreshSubjectDetail(workspacePath, selectedSubjectSlug);
    setSelectedContentPath(result.relativePath);
  }

  async function handleCreateActivityDraft() {
    if (!workspacePath || !selectedSubjectSlug) {
      return;
    }

    const result = await invoke<CreateContentItemResult>("create_activity_draft", {
      workspacePath,
      subjectSlug: selectedSubjectSlug,
    });

    await refreshSubjectDetail(workspacePath, selectedSubjectSlug);
    setSelectedContentPath(result.relativePath);
  }

  const totalLessons = subjects.reduce((sum, subject) => sum + subject.lessonCount, 0);
  const totalActivities = subjects.reduce((sum, subject) => sum + subject.activityCount, 0);
  const hasWorkspace = workspacePath.trim().length > 0;
  const viewingDetail = Boolean(selectedSubjectSlug);
  const viewingEditor = Boolean(selectedContentPath);
  const selectedContentItem = selectedSubject
    ? [...selectedSubject.lessons, ...selectedSubject.activities].find(
        (item) => item.relativePath === selectedContentPath,
      ) ?? null
    : null;
  const commandActions = buildCommandActions({
    viewingDetail,
    viewingEditor,
    hasWorkspace,
    showTechnicalBlocks,
    canReloadCurrentFile: Boolean(selectedContentPath),
    onChooseWorkspace: handleChooseWorkspace,
    onGoHome: () => {
      setSelectedSubjectSlug(null);
      setSelectedContentPath(null);
      setCommandPaletteOpen(false);
    },
    onGoToFiles: () => {
      setSelectedContentPath(null);
      setCommandPaletteOpen(false);
    },
    onToggleTechnicalBlocks: () => {
      setShowTechnicalBlocks((current) => !current);
      setCommandPaletteOpen(false);
    },
    onCreateTemplateSubject: () => {
      setCommandPaletteOpen(false);
      void handleCreateTemplateSubject();
    },
    onReloadCurrentFile: () => {
      if (!workspacePath || !selectedSubjectSlug || !selectedContentPath) {
        return;
      }

      setCommandPaletteOpen(false);
      void refreshEditorDocument(workspacePath, selectedSubjectSlug, selectedContentPath);
    },
  });
  const visibleCommandActions = commandActions.filter((action) =>
    [action.label, action.keywords].join(" ").toLowerCase().includes(commandQuery.trim().toLowerCase()),
  );

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandPaletteOpen((current) => !current);
      }

      if (event.key === "Escape") {
        setCommandPaletteOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeydown);
    return () => {
      window.removeEventListener("keydown", handleKeydown);
    };
  }, []);

  useEffect(() => {
    if (!commandPaletteOpen) {
      setCommandQuery("");
    }
  }, [commandPaletteOpen]);

  useEffect(() => {
    if (!workspacePath || !selectedSubjectSlug || !selectedContentPath || !viewingEditor) {
      setExternallyModified(false);
      return;
    }

    const intervalId = window.setInterval(() => {
      void (async () => {
        try {
          const snapshot = await invoke<ContentFileSnapshot>("get_content_file_snapshot", {
            workspacePath,
            subjectSlug: selectedSubjectSlug,
            relativePath: selectedContentPath,
          });

          const diskChanged =
            snapshot.updatedAtMs !== lastSavedAtMs && snapshot.content !== loadedEditorContent;

          setExternallyModified(diskChanged);
        } catch {
          setExternallyModified(false);
        }
      })();
    }, 2000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [
    workspacePath,
    selectedSubjectSlug,
    selectedContentPath,
    viewingEditor,
    lastSavedAtMs,
    loadedEditorContent,
  ]);

  return (
    <main className="studio-shell">
      <aside className="studio-sidebar" aria-label="Navegacao principal">
        <div className="sidebar-mark">SS</div>
        <nav className="sidebar-icons">
          <button type="button" className="sidebar-icon is-active" aria-label="Disciplinas">
            <HomeIcon />
          </button>
          <button type="button" className="sidebar-icon" aria-label="Aulas">
            <BookIcon />
          </button>
          <button type="button" className="sidebar-icon" aria-label="Atividades">
            <ClipboardIcon />
          </button>
          <button type="button" className="sidebar-icon" aria-label="Configuracoes">
            <SettingsIcon />
          </button>
        </nav>
      </aside>

      <section className="studio-stage">
        <header className="stage-header">
          <p className="eyebrow">SENAI Studio</p>
          <div className="header-meta">
            <span className={`status-chip ${hasWorkspace ? "status-chip-ok" : ""}`}>
              {hasWorkspace ? "◉ pasta conectada" : "◎ selecione uma pasta"}
            </span>
            <span className="status-chip">Fase 1</span>
          </div>
        </header>

        {!viewingDetail ? (
          <>
            <section className="hero-grid">
              <div className="hero-copy">
                <p className="hero-kicker">Seu planejamento</p>
                <h1>Escolha a pasta do seu material e continue de onde parou.</h1>
                <p className="hero-body">
                  Selecione a pasta onde suas disciplinas estao organizadas. O aplicativo
                  lembra essa escolha e voce pode trocar quando quiser.
                </p>
              </div>

              <aside className="workspace-panel" aria-label="Resumo do workspace">
                <div className="workspace-heading">
                  <p className="preview-label">Fonte de dados</p>
                  <button
                    type="button"
                    className="ghost-action"
                    onClick={() => void handleChooseWorkspace()}
                    disabled={changingWorkspace}
                  >
                    {changingWorkspace
                      ? "abrindo..."
                      : hasWorkspace
                        ? "alterar caminho"
                        : "selecionar pasta"}
                  </button>
                </div>

                <p className={`workspace-path ${hasWorkspace ? "" : "is-empty"}`}>
                  {hasWorkspace ? workspacePath : "Nenhuma pasta selecionada."}
                </p>

                <div className="workspace-stats">
                  <div className="workspace-stat">
                    <span className="workspace-value">{subjects.length}</span>
                    <span className="workspace-caption">disciplinas</span>
                  </div>
                  <div className="workspace-stat">
                    <span className="workspace-value">{totalLessons}</span>
                    <span className="workspace-caption">aulas</span>
                  </div>
                  <div className="workspace-stat">
                    <span className="workspace-value">{totalActivities}</span>
                    <span className="workspace-caption">atividades</span>
                  </div>
                </div>
              </aside>
            </section>

            <section className="subjects-section" aria-labelledby="subjects-title">
              <div className="section-heading">
                <div>
                  <p className="preview-label">Disciplinas</p>
                  <h2 id="subjects-title">Escolha uma disciplina para abrir</h2>
                </div>
                <div className="section-actions">
                  <p className="section-copy">
                    Veja rapidamente suas disciplinas e entre na que deseja editar.
                  </p>
                  {hasWorkspace ? (
                    <button
                      type="button"
                      className="primary-action"
                      onClick={() => void handleCreateTemplateSubject()}
                      disabled={creatingTemplateSubject}
                    >
                      {creatingTemplateSubject ? "criando..." : "+ Disciplina"}
                    </button>
                  ) : null}
                </div>
              </div>

              {!hasWorkspace ? (
                <EmptyWorkspaceState onChooseWorkspace={handleChooseWorkspace} />
              ) : null}
              {hasWorkspace && loading ? <LoadingState /> : null}
              {hasWorkspace && error ? <ErrorState message={error} /> : null}
              {hasWorkspace && !loading && !error && subjects.length === 0 ? (
                <button
                  type="button"
                  className="template-card"
                  onClick={() => void handleCreateTemplateSubject()}
                  disabled={creatingTemplateSubject}
                >
                  <p className="subject-overline">Comecar rapido</p>
                  <h3>Gerar disciplina modelo</h3>
                  <p className="subject-metadata">
                    Cria uma disciplina completa com contexto, plano, uma aula e uma
                    atividade de exemplo para demonstrar o fluxo do Studio.
                  </p>
                  <div className="subject-card-footer">
                    <div className="subject-flags">
                      <span className="subject-flag is-ready">◉ aula modelo</span>
                      <span className="subject-flag is-ready">◉ atividade modelo</span>
                    </div>
                    <p className="subject-updated">
                      {creatingTemplateSubject ? "criando..." : "1 clique"}
                    </p>
                  </div>
                </button>
              ) : null}
              {hasWorkspace && !loading && !error ? (
                <div className="subjects-grid">
                  {subjects.map((subject) => (
                    <button
                      key={subject.id}
                      type="button"
                      className="subject-card"
                      onClick={() => {
                        setSelectedSubjectSlug(subject.slug);
                        setSelectedContentPath(null);
                        setEditorDocument(null);
                        setEditorContent("");
                        setLoadedEditorContent("");
                        setSaveState("idle");
                      }}
                    >
                      <div className="subject-card-top">
                        <span
                          className="subject-swatch"
                          style={{ backgroundColor: subject.color }}
                          aria-hidden="true"
                        />
                        <span className="status-chip">
                          <span className="subject-card-slug">{subject.slug}</span>
                        </span>
                      </div>

                      <div className="subject-card-body">
                        <p className="subject-overline">disciplina</p>
                        <h3>{subject.displayName}</h3>
                        <p className="subject-metadata">
                          {subject.lessonCount} aulas · {subject.activityCount} atividades
                        </p>
                      </div>

                      <div className="subject-card-footer">
                        <div className="subject-flags">
                          <span className={flagClassName(subject.hasContext)}>
                            {subject.hasContext ? "◉ contexto" : "○ sem contexto"}
                          </span>
                          <span className={flagClassName(subject.hasPlan)}>
                            {subject.hasPlan ? "◉ plano" : "○ sem plano"}
                          </span>
                        </div>
                        <p className="subject-updated">{formatUpdatedAt(subject.updatedAtMs)}</p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}
            </section>
          </>
        ) : viewingEditor ? (
          <section className="editor-screen" aria-labelledby="editor-title">
            <div className="editor-screen-header">
              <div className="editor-screen-copy">
                <button
                  type="button"
                  className="back-action"
                  onClick={() => setSelectedContentPath(null)}
                >
                  ← voltar para arquivos da disciplina
                </button>
                <p className="hero-kicker">Editor</p>
                <h1 id="editor-title">
                  {editorDocument?.title ?? selectedContentItem?.title ?? "Abrindo arquivo"}
                </h1>
                <p className="hero-body">
                  Edite o conteudo e o aplicativo salva automaticamente pouco depois da sua
                  ultima alteracao.
                </p>
              </div>

              <aside className="workspace-panel editor-screen-panel">
                <div className="workspace-heading">
                  <p className="preview-label">Arquivo aberto</p>
                  {selectedContentItem ? (
                    <span className="status-chip">{selectedContentItem.file}</span>
                  ) : null}
                      <button
                        type="button"
                        className="ghost-action"
                        onClick={() => setShowTechnicalBlocks((current) => !current)}
                      >
                        {showTechnicalBlocks
                          ? "ocultar blocos tecnicos"
                          : "mostrar blocos tecnicos"}
                      </button>
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
                      {statusGlyph(selectedContentItem.status)} {statusLabel(selectedContentItem.status)}
                    </span>
                  ) : null}
                </div>
              </aside>
            </div>

            {editorError ? <ErrorState message={editorError} /> : null}
            {editorLoading ? <LoadingState /> : null}
            {!editorLoading && !editorError && editorDocument ? (
                <section className="editor-panel" aria-label="Editor Markdown">
                  <div className="editor-surface">
                  <MarkdownEditor
                    key={`${editorDocument.relativePath}-${showTechnicalBlocks ? "show" : "hide"}`}
                    value={editorContent}
                    onChange={setEditorContent}
                    showTechnicalBlocks={showTechnicalBlocks}
                  />
                  </div>
                </section>
            ) : null}
          </section>
        ) : (
          <section className="subject-detail-shell" aria-labelledby="subject-detail-title">
            <div className="subject-detail-header">
              <div className="subject-detail-copy">
                <button
                  type="button"
                  className="back-action"
                  onClick={() => setSelectedSubjectSlug(null)}
                >
                  ← voltar para disciplinas
                </button>
                <p className="hero-kicker">Disciplina</p>
                <h1 id="subject-detail-title">
                  {selectedSubject?.displayName ?? humanizeSlug(selectedSubjectSlug ?? "")}
                </h1>
                <p className="hero-body">
                  Abra uma aula ou atividade para editar o Markdown com salvamento automatico.
                </p>
              </div>

              <aside className="workspace-panel subject-detail-panel">
                <div className="workspace-heading">
                  <p className="preview-label">Pasta atual</p>
                  <button
                    type="button"
                    className="ghost-action"
                    onClick={() => void handleChooseWorkspace()}
                    disabled={changingWorkspace}
                  >
                    {changingWorkspace ? "abrindo..." : "alterar caminho"}
                  </button>
                </div>
                <p className="workspace-path">{workspacePath}</p>
                {selectedSubject ? (
                  <div className="subject-detail-flags">
                    <span className="status-chip">{selectedSubject.slug}</span>
                    <span className={flagClassName(selectedSubject.hasContext)}>
                      {selectedSubject.hasContext ? "◉ contexto" : "○ sem contexto"}
                    </span>
                    <span className={flagClassName(selectedSubject.hasPlan)}>
                      {selectedSubject.hasPlan ? "◉ plano" : "○ sem plano"}
                    </span>
                  </div>
                ) : null}
              </aside>
            </div>

            {detailLoading ? <LoadingState /> : null}
            {detailError ? <ErrorState message={detailError} /> : null}
            {!detailLoading && !detailError && selectedSubject ? (
              <div className="subject-detail-grid">
                <ContentColumn
                  title="Aulas"
                  subtitle="Arquivos de aula"
                  emptyMessage="Nenhuma aula encontrada."
                  items={selectedSubject.lessons}
                  selectedPath={selectedContentPath}
                  onSelect={setSelectedContentPath}
                  actionLabel="+ Aula"
                  onAction={() => void handleCreateLessonDraft()}
                />
                <ContentColumn
                  title="Atividades"
                  subtitle="Arquivos de atividade"
                  emptyMessage="Nenhuma atividade encontrada."
                  items={selectedSubject.activities}
                  selectedPath={selectedContentPath}
                  onSelect={setSelectedContentPath}
                  actionLabel="+ Atividade"
                  onAction={() => void handleCreateActivityDraft()}
                />
              </div>
            ) : null}
          </section>
        )}
      </section>
      {commandPaletteOpen ? (
        <CommandPalette
          query={commandQuery}
          onQueryChange={setCommandQuery}
          actions={visibleCommandActions}
          onClose={() => setCommandPaletteOpen(false)}
        />
      ) : null}
    </main>
  );
}

function CommandPalette({
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

function ContentColumn({
  title,
  subtitle,
  items,
  emptyMessage,
  selectedPath,
  onSelect,
  actionLabel,
  onAction,
}: {
  title: string;
  subtitle: string;
  items: ContentItem[];
  emptyMessage: string;
  selectedPath: string | null;
  onSelect: (relativePath: string) => void;
  actionLabel: string;
  onAction: () => void;
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
            <button
              key={item.relativePath}
              type="button"
              className={`content-card content-card-button ${
                selectedPath === item.relativePath ? "is-selected" : ""
              }`}
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
          ))}
        </div>
      )}
    </section>
  );
}

function EmptyWorkspaceState({
  onChooseWorkspace,
}: {
  onChooseWorkspace: () => Promise<void>;
}) {
  return (
    <div className="feedback-panel" role="status">
      <p className="preview-label">Primeiro passo</p>
      <p className="feedback-title">Selecione a pasta onde seu material esta salvo.</p>
      <p className="feedback-copy">
        Pode ser uma pasta existente ou uma nova pasta para organizar seu planejamento.
        Depois disso, o aplicativo lembra essa escolha nas proximas aberturas.
      </p>
      <button type="button" className="primary-action" onClick={() => void onChooseWorkspace()}>
        Selecionar pasta
      </button>
    </div>
  );
}

function flagClassName(isReady: boolean) {
  return isReady ? "subject-flag is-ready" : "subject-flag";
}

function saveStateClassName(saveState: SaveState) {
  if (saveState === "saved") return "status-chip-ok";
  if (saveState === "saving") return "status-chip-saving";
  if (saveState === "error") return "status-chip-error";
  return "";
}

function saveStateLabel(saveState: SaveState, updatedAtMs: number | null) {
  if (saveState === "saving") return "salvando...";
  if (saveState === "saved") return `salvo ${formatClock(updatedAtMs)}`;
  if (saveState === "dirty") return "alteracoes nao salvas";
  if (saveState === "error") return "erro ao salvar";
  return updatedAtMs ? `pronto ${formatClock(updatedAtMs)}` : "pronto para editar";
}

function statusLabel(status: ContentItem["status"]) {
  if (status === "ok") return "atualizado";
  if (status === "outdated") return "precisa revisar";
  return "sem output";
}

function statusGlyph(status: ContentItem["status"]) {
  if (status === "ok") return "◉";
  if (status === "outdated") return "◎";
  return "○";
}

function formatUpdatedAt(updatedAtMs: number | null) {
  if (!updatedAtMs) {
    return "sem data";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(updatedAtMs));
}

function formatClock(updatedAtMs: number | null) {
  if (!updatedAtMs) {
    return "agora";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(updatedAtMs));
}

function humanizeSlug(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function LoadingState() {
  return (
    <div className="feedback-panel" role="status">
      <p className="preview-label">carregando</p>
      <p className="feedback-title">Carregando seu material...</p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="feedback-panel is-error" role="alert">
      <p className="preview-label">erro</p>
      <p className="feedback-title">Nao foi possivel abrir esta tela.</p>
      <p className="feedback-copy">{message}</p>
    </div>
  );
}

type CommandAction = {
  id: string;
  label: string;
  hint: string;
  keywords: string;
  run: () => void;
};

function buildCommandActions({
  viewingDetail,
  viewingEditor,
  hasWorkspace,
  showTechnicalBlocks,
  canReloadCurrentFile,
  onChooseWorkspace,
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
  onCreateTemplateSubject: () => void;
  onGoHome: () => void;
  onGoToFiles: () => void;
  onToggleTechnicalBlocks: () => void;
  onReloadCurrentFile: () => void;
}) {
  const actions: CommandAction[] = [];

  if (hasWorkspace) {
    actions.push({
      id: "choose-workspace",
      label: "Alterar pasta",
      hint: "Workspace",
      keywords: "pasta workspace caminho alterar selecionar",
      run: () => {
        void onChooseWorkspace();
      },
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

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 11.5 12 5l8 6.5" />
      <path d="M6.5 10.5V19h11v-8.5" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4H19v15.5H7.5A2.5 2.5 0 0 0 5 22Z" />
      <path d="M5 6.5V19.5" />
      <path d="M8.5 8H15.5" />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 5.5h6" />
      <path d="M9.5 4h5a1.5 1.5 0 0 1 1.5 1.5v1h2v13H6v-13h2v-1A1.5 1.5 0 0 1 9.5 4Z" />
      <path d="M9 11h6" />
      <path d="M9 15h4.5" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" />
      <path d="M4.5 13.5v-3l2-0.5a6.5 6.5 0 0 1 0.8-1.9L6 6.3l2.1-2.1 1.8 1.3a6.5 6.5 0 0 1 1.9-0.8l0.5-2h3l0.5 2a6.5 6.5 0 0 1 1.9 0.8l1.8-1.3L21.6 6.3l-1.3 1.8a6.5 6.5 0 0 1 0.8 1.9l2 0.5v3l-2 0.5a6.5 6.5 0 0 1-0.8 1.9l1.3 1.8-2.1 2.1-1.8-1.3a6.5 6.5 0 0 1-1.9 0.8l-0.5 2h-3l-0.5-2a6.5 6.5 0 0 1-1.9-0.8l-1.8 1.3L6 17.7l1.3-1.8a6.5 6.5 0 0 1-0.8-1.9Z" />
    </svg>
  );
}

export default App;
