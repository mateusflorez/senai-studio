import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import "./App.css";

import type {
  SubjectSummary,
  SubjectDetail,
  ContentItem,
  EditableContentFile,
  SaveContentResult,
  ContentFileSnapshot,
  CreateTemplateSubjectResult,
  CreateSubjectResult,
  CreateContentItemResult,
  SaveState,
  DeleteTarget,
} from "./types";
import { describeError } from "./utils";
import { HomeIcon, BookIcon, ClipboardIcon, SettingsIcon } from "./components/icons";
import { CommandPalette, buildCommandActions } from "./components/CommandPalette";
import { CreateSubjectModal } from "./components/modals/CreateSubjectModal";
import { CreateContentModal } from "./components/modals/CreateContentModal";
import { DeleteModal } from "./components/modals/DeleteModal";
import { HomeScreen } from "./screens/HomeScreen";
import { SubjectDetailScreen } from "./screens/SubjectDetailScreen";
import { EditorScreen } from "./screens/EditorScreen";

const workspaceStorageKey = "lumen-studio.workspace-path";

function App() {
  const [workspacePath, setWorkspacePath] = useState(
    () => window.localStorage.getItem(workspaceStorageKey) ?? "",
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
  const [createSubjectOpen, setCreateSubjectOpen] = useState(false);
  const [createLessonOpen, setCreateLessonOpen] = useState(false);
  const [createActivityOpen, setCreateActivityOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [processingOutputPath, setProcessingOutputPath] = useState<string | null>(null);

  const editorContentRef = useRef("");
  const saveRequestRef = useRef(0);

  const hasWorkspace = workspacePath.trim().length > 0;
  const viewingDetail = Boolean(selectedSubjectSlug);
  const viewingEditor = Boolean(selectedContentPath);
  const totalLessons = subjects.reduce((sum, s) => sum + s.lessonCount, 0);
  const totalActivities = subjects.reduce((sum, s) => sum + s.activityCount, 0);
  const selectedContentItem = selectedSubject
    ? ([...selectedSubject.lessons, ...selectedSubject.activities].find(
        (item) => item.relativePath === selectedContentPath,
      ) ?? null)
    : null;

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
        !nextSubjects.some((s) => s.slug === selectedSubjectSlug)
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
      setError(describeError(cause, "Falha ao ler disciplinas."));
    } finally {
      setLoading(false);
    }
  }

  async function refreshSubjectDetail(nextWorkspacePath: string, subjectSlug: string) {
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
      setDetailError(describeError(cause, "Falha ao carregar a disciplina."));
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
      setEditorError(describeError(cause, "Falha ao abrir o arquivo selecionado."));
    } finally {
      setEditorLoading(false);
    }
  }

  async function saveDocument(contentToSave: string) {
    if (!workspacePath || !selectedSubjectSlug || !selectedContentPath) return;

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

      if (saveRequestRef.current !== requestId) return;

      setLoadedEditorContent(contentToSave);
      setLastSavedAtMs(result.updatedAtMs);
      setSaveState(editorContentRef.current === contentToSave ? "saved" : "dirty");

      await Promise.all([
        refreshSubjects(workspacePath),
        refreshSubjectDetail(workspacePath, selectedSubjectSlug),
      ]);
    } catch (cause) {
      if (saveRequestRef.current !== requestId) return;
      setSaveState("error");
      setEditorError(describeError(cause, "Falha ao salvar o arquivo."));
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
    if (!workspacePath || !selectedSubjectSlug || !selectedContentPath || editorLoading) return;
    if (editorContent === loadedEditorContent) return;

    setSaveState((current) => (current === "saving" ? current : "dirty"));

    const timeoutId = window.setTimeout(() => {
      void saveDocument(editorContent);
    }, 800);

    return () => { window.clearTimeout(timeoutId); };
  }, [editorContent, loadedEditorContent, editorLoading, workspacePath, selectedSubjectSlug, selectedContentPath]);

  async function handleChooseWorkspace() {
    setChangingWorkspace(true);

    try {
      const selection = await open({
        directory: true,
        multiple: false,
        defaultPath: workspacePath || undefined,
        title: "Selecionar pasta do Lumen Studio",
      });

      if (typeof selection !== "string" || !selection.trim()) return;

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
    if (!workspacePath || creatingTemplateSubject) return;

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
      setError(describeError(cause, "Falha ao criar a disciplina modelo."));
    } finally {
      setCreatingTemplateSubject(false);
    }
  }

  async function handleGenerateContent(item: ContentItem) {
    if (!workspacePath || !selectedSubjectSlug || processingOutputPath) return;

    setProcessingOutputPath(item.relativePath);

    try {
      await invoke("generate_content_output", {
        workspacePath,
        subjectSlug: selectedSubjectSlug,
        relativePath: item.relativePath,
      });

      await Promise.all([
        refreshSubjects(workspacePath),
        refreshSubjectDetail(workspacePath, selectedSubjectSlug),
      ]);
    } catch (cause) {
      setDetailError(describeError(cause, "Falha ao gerar o arquivo."));
    } finally {
      setProcessingOutputPath(null);
    }
  }

  async function handleOpenOutputFolder(item: ContentItem) {
    if (!workspacePath || !selectedSubjectSlug) return;

    try {
      await invoke("open_content_output_folder", {
        workspacePath,
        subjectSlug: selectedSubjectSlug,
        relativePath: item.relativePath,
      });
    } catch (cause) {
      setDetailError(describeError(cause, "Falha ao abrir a pasta de saida."));
    }
  }

  async function handleDeleteConfirmed() {
    if (!workspacePath || !deleteTarget || deleting) return;

    setDeleting(true);

    try {
      if (deleteTarget.kind === "subject") {
        await invoke("delete_subject", {
          workspacePath,
          subjectSlug: deleteTarget.slug,
        });

        await refreshSubjects(workspacePath);

        if (selectedSubjectSlug === deleteTarget.slug) {
          setSelectedSubjectSlug(null);
          setSelectedSubject(null);
          setSelectedContentPath(null);
          setEditorDocument(null);
          setEditorContent("");
          setLoadedEditorContent("");
          setSaveState("idle");
        }
      } else if (selectedSubjectSlug) {
        await invoke("delete_content_item", {
          workspacePath,
          subjectSlug: selectedSubjectSlug,
          relativePath: deleteTarget.relativePath,
        });

        await refreshSubjectDetail(workspacePath, selectedSubjectSlug);

        if (selectedContentPath === deleteTarget.relativePath) {
          setSelectedContentPath(null);
          setEditorDocument(null);
          setEditorContent("");
          setLoadedEditorContent("");
          setSaveState("idle");
        }
      }

      setDeleteTarget(null);
    } catch (cause) {
      const message = describeError(cause, "Falha ao excluir o item selecionado.");
      if (deleteTarget.kind === "subject") {
        setError(message);
      } else {
        setDetailError(message);
      }
    } finally {
      setDeleting(false);
    }
  }

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
    return () => { window.removeEventListener("keydown", handleKeydown); };
  }, []);

  useEffect(() => {
    if (!commandPaletteOpen) setCommandQuery("");
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
            snapshot.updatedAtMs !== lastSavedAtMs &&
            snapshot.content !== loadedEditorContent;

          setExternallyModified(diskChanged);
        } catch {
          setExternallyModified(false);
        }
      })();
    }, 2000);

    return () => { window.clearInterval(intervalId); };
  }, [workspacePath, selectedSubjectSlug, selectedContentPath, viewingEditor, lastSavedAtMs, loadedEditorContent]);

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
    onCreateSubject: () => {
      setCommandPaletteOpen(false);
      setCreateSubjectOpen(true);
    },
    onCreateTemplateSubject: () => {
      setCommandPaletteOpen(false);
      void handleCreateTemplateSubject();
    },
    onReloadCurrentFile: () => {
      if (!workspacePath || !selectedSubjectSlug || !selectedContentPath) return;
      setCommandPaletteOpen(false);
      void refreshEditorDocument(workspacePath, selectedSubjectSlug, selectedContentPath);
    },
  });

  const visibleCommandActions = commandActions.filter((action) =>
    [action.label, action.keywords]
      .join(" ")
      .toLowerCase()
      .includes(commandQuery.trim().toLowerCase()),
  );

  return (
    <main className="studio-shell">
      <aside className="studio-sidebar" aria-label="Navegacao principal">
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
          <p className="eyebrow">Lumen Studio</p>
          <div className="header-meta">
            <span className={`status-chip ${hasWorkspace ? "status-chip-ok" : ""}`}>
              {hasWorkspace ? "◉ pasta conectada" : "◎ selecione uma pasta"}
            </span>
          </div>
        </header>

        {!viewingDetail ? (
          <HomeScreen
            workspacePath={workspacePath}
            changingWorkspace={changingWorkspace}
            subjects={subjects}
            loading={loading}
            error={error}
            totalLessons={totalLessons}
            totalActivities={totalActivities}
            hasWorkspace={hasWorkspace}
            creatingTemplateSubject={creatingTemplateSubject}
            onChooseWorkspace={handleChooseWorkspace}
            onSelectSubject={(slug) => {
              setSelectedSubjectSlug(slug);
              setSelectedContentPath(null);
              setEditorDocument(null);
              setEditorContent("");
              setLoadedEditorContent("");
              setSaveState("idle");
            }}
            onCreateSubject={() => setCreateSubjectOpen(true)}
            onCreateTemplateSubject={() => void handleCreateTemplateSubject()}
            onDeleteSubject={(subject) =>
              setDeleteTarget({ kind: "subject", slug: subject.slug, name: subject.displayName })
            }
          />
        ) : viewingEditor ? (
          <EditorScreen
            editorDocument={editorDocument}
            selectedContentItem={selectedContentItem}
            editorContent={editorContent}
            editorLoading={editorLoading}
            editorError={editorError}
            saveState={saveState}
            lastSavedAtMs={lastSavedAtMs}
            showTechnicalBlocks={showTechnicalBlocks}
            externallyModified={externallyModified}
            onChange={setEditorContent}
            onGoBack={() => setSelectedContentPath(null)}
            onToggleTechnicalBlocks={() => setShowTechnicalBlocks((current) => !current)}
          />
        ) : (
          <SubjectDetailScreen
            workspacePath={workspacePath}
            changingWorkspace={changingWorkspace}
            selectedSubject={selectedSubject}
            selectedSubjectSlug={selectedSubjectSlug!}
            selectedContentPath={selectedContentPath}
            detailLoading={detailLoading}
            detailError={detailError}
            processingOutputPath={processingOutputPath}
            onChooseWorkspace={handleChooseWorkspace}
            onSelectContent={setSelectedContentPath}
            onGoBack={() => setSelectedSubjectSlug(null)}
            onCreateLesson={() => setCreateLessonOpen(true)}
            onCreateActivity={() => setCreateActivityOpen(true)}
            onGenerate={(item) => void handleGenerateContent(item)}
            onOpenOutput={(item) => void handleOpenOutputFolder(item)}
            onDeleteContent={(item) =>
              setDeleteTarget({
                kind: "content",
                relativePath: item.relativePath,
                title: item.title,
                label: item.relativePath.startsWith("aulas/") ? "aula" : "atividade",
              })
            }
          />
        )}
      </section>

      {createSubjectOpen ? (
        <CreateSubjectModal
          onClose={() => setCreateSubjectOpen(false)}
          onConfirm={async (name, color) => {
            try {
              const result = await invoke<CreateSubjectResult>("create_subject", {
                workspacePath,
                name,
                color,
              });
              await refreshSubjects(workspacePath);
              setSelectedSubjectSlug(result.slug);
              setSelectedContentPath(null);
              setEditorDocument(null);
              setEditorContent("");
              setLoadedEditorContent("");
              setSaveState("idle");
              setCreateSubjectOpen(false);
            } catch (cause) {
              setError(describeError(cause, "Falha ao criar a disciplina."));
            }
          }}
        />
      ) : null}

      {createLessonOpen && selectedSubjectSlug ? (
        <CreateContentModal
          kind="aula"
          existingItems={selectedSubject?.lessons ?? []}
          onClose={() => setCreateLessonOpen(false)}
          onConfirm={async (theme) => {
            try {
              const result = await invoke<CreateContentItemResult>("create_lesson", {
                workspacePath,
                subjectSlug: selectedSubjectSlug,
                theme,
              });
              await refreshSubjectDetail(workspacePath, selectedSubjectSlug);
              setSelectedContentPath(result.relativePath);
              setCreateLessonOpen(false);
            } catch (cause) {
              setDetailError(describeError(cause, "Falha ao criar a aula."));
            }
          }}
        />
      ) : null}

      {createActivityOpen && selectedSubjectSlug ? (
        <CreateContentModal
          kind="atividade"
          existingItems={selectedSubject?.activities ?? []}
          onClose={() => setCreateActivityOpen(false)}
          onConfirm={async (theme) => {
            try {
              const result = await invoke<CreateContentItemResult>("create_activity", {
                workspacePath,
                subjectSlug: selectedSubjectSlug,
                theme,
              });
              await refreshSubjectDetail(workspacePath, selectedSubjectSlug);
              setSelectedContentPath(result.relativePath);
              setCreateActivityOpen(false);
            } catch (cause) {
              setDetailError(describeError(cause, "Falha ao criar a atividade."));
            }
          }}
        />
      ) : null}

      {deleteTarget ? (
        <DeleteModal
          target={deleteTarget}
          deleting={deleting}
          onClose={() => { if (!deleting) setDeleteTarget(null); }}
          onConfirm={() => void handleDeleteConfirmed()}
        />
      ) : null}

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

export default App;
