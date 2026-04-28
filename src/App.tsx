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
  RenameContentItemResult,
  GlobalSearchResult,
  SaveState,
  DeleteTarget,
  AssetSettingsState,
} from "./types";
import { describeError } from "./utils";
import { HomeIcon, BookIcon, ClipboardIcon, SettingsIcon } from "./components/icons";
import { CommandPalette, buildCommandActions } from "./components/CommandPalette";
import { CreateSubjectModal } from "./components/modals/CreateSubjectModal";
import { CreateContentModal } from "./components/modals/CreateContentModal";
import { DeleteModal } from "./components/modals/DeleteModal";
import { PreviewModal } from "./components/modals/PreviewModal";
import { RenameContentModal } from "./components/modals/RenameContentModal";
import { HomeScreen } from "./screens/HomeScreen";
import { SubjectDetailScreen } from "./screens/SubjectDetailScreen";
import { SubjectDocumentIndexScreen } from "./screens/SubjectDocumentIndexScreen";
import { EditorScreen } from "./screens/EditorScreen";
import { SettingsScreen } from "./screens/SettingsScreen";

const workspaceStorageKey = "lumen-studio.workspace-path";

type GenerationProgressState = {
  mode: "single" | "bulk";
  current: number;
  total: number;
  currentLabel: string;
};

function App() {
  const [activeSection, setActiveSection] = useState<"home" | "context" | "plan" | "settings">("home");
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
  const [showMarpPreview, setShowMarpPreview] = useState(false);
  const [externallyModified, setExternallyModified] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GlobalSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [creatingTemplateSubject, setCreatingTemplateSubject] = useState(false);
  const [createSubjectOpen, setCreateSubjectOpen] = useState(false);
  const [editSubjectOpen, setEditSubjectOpen] = useState(false);
  const [createLessonOpen, setCreateLessonOpen] = useState(false);
  const [createActivityOpen, setCreateActivityOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [renameTarget, setRenameTarget] = useState<ContentItem | null>(null);
  const [previewItem, setPreviewItem] = useState<ContentItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [processingOutputPath, setProcessingOutputPath] = useState<string | null>(null);
  const [generationProgress, setGenerationProgress] = useState<GenerationProgressState | null>(null);
  const [assetSettings, setAssetSettings] = useState<AssetSettingsState | null>(null);
  const [assetSettingsLoading, setAssetSettingsLoading] = useState(false);
  const [assetSettingsError, setAssetSettingsError] = useState<string | null>(null);
  const [assetSettingsBusy, setAssetSettingsBusy] = useState(false);

  const editorContentRef = useRef("");
  const saveRequestRef = useRef(0);

  const hasWorkspace = workspacePath.trim().length > 0;
  const viewingDetail = activeSection === "home" && Boolean(selectedSubjectSlug) && !selectedContentPath;
  const viewingEditor = Boolean(selectedContentPath);
  const showingSettings = activeSection === "settings";
  const showingContextIndex = activeSection === "context" && !viewingEditor;
  const showingPlanIndex = activeSection === "plan" && !viewingEditor;
  const canPreviewCurrentFile =
    Boolean(selectedContentPath?.startsWith("aulas/")) ||
    Boolean(selectedContentPath?.startsWith("atividades/"));
  const totalLessons = subjects.reduce((sum, s) => sum + s.lessonCount, 0);
  const totalActivities = subjects.reduce((sum, s) => sum + s.activityCount, 0);
  const selectedContentItem = selectedSubject
    ? ([...selectedSubject.lessons, ...selectedSubject.activities].find(
        (item) => item.relativePath === selectedContentPath,
      ) ?? null)
    : null;
  const generationBusy = generationProgress !== null;
  const generatingAll = generationProgress?.mode === "bulk";
  const generationPercent =
    generationProgress?.mode === "bulk" && generationProgress.total > 0
      ? Math.round((generationProgress.current / generationProgress.total) * 100)
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

  async function refreshAssetSettings() {
    setAssetSettingsLoading(true);

    try {
      const nextSettings = await invoke<AssetSettingsState>("get_asset_settings");
      setAssetSettings(nextSettings);
      setAssetSettingsError(null);
    } catch (cause) {
      setAssetSettings(null);
      setAssetSettingsError(describeError(cause, "Falha ao ler as configurações visuais."));
    } finally {
      setAssetSettingsLoading(false);
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
    void refreshAssetSettings();
  }, []);

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
      if (activeSection === "home") {
        setSelectedContentPath(null);
      }
      return;
    }

    const availableItems = [...selectedSubject.lessons, ...selectedSubject.activities];
    const isStaticSubjectDocument =
      selectedContentPath === "contexto.md" || selectedContentPath === "plano_geral.md";

    if (
      !isStaticSubjectDocument &&
      selectedContentPath &&
      !availableItems.some((item) => item.relativePath === selectedContentPath)
    ) {
      setSelectedContentPath(null);
    }
  }, [activeSection, selectedSubject, selectedContentPath]);

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
      setActiveSection("home");
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

  async function handleSelectAsset(kind: "logo" | "background") {
    setAssetSettingsBusy(true);

    try {
      const selection = await open({
        multiple: false,
        directory: false,
        title: kind === "logo" ? "Selecionar logo do sistema" : "Selecionar background do sistema",
        filters: [{
          name: "Imagens",
          extensions: ["png", "jpg", "jpeg", "webp", "svg"],
        }],
      });

      if (typeof selection !== "string" || !selection.trim()) return;

      const nextSettings = await invoke<AssetSettingsState>("set_asset_file", {
        assetKind: kind,
        sourcePath: selection,
      });
      setAssetSettings(nextSettings);
      setAssetSettingsError(null);
    } catch (cause) {
      setAssetSettingsError(describeError(cause, "Falha ao salvar o arquivo selecionado."));
    } finally {
      setAssetSettingsBusy(false);
    }
  }

  async function handleClearAsset(kind: "logo" | "background") {
    setAssetSettingsBusy(true);

    try {
      const nextSettings = await invoke<AssetSettingsState>("clear_asset_file", {
        assetKind: kind,
      });
      setAssetSettings(nextSettings);
      setAssetSettingsError(null);
    } catch (cause) {
      setAssetSettingsError(describeError(cause, "Falha ao limpar o arquivo selecionado."));
    } finally {
      setAssetSettingsBusy(false);
    }
  }

  async function handleSelectTheme(themeId: string) {
    setAssetSettingsBusy(true);

    try {
      const nextSettings = await invoke<AssetSettingsState>("set_color_theme", {
        themeId,
      });
      setAssetSettings(nextSettings);
      setAssetSettingsError(null);
    } catch (cause) {
      setAssetSettingsError(describeError(cause, "Falha ao atualizar a cor do sistema."));
    } finally {
      setAssetSettingsBusy(false);
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
    if (!workspacePath || !selectedSubjectSlug || generationBusy) return;

    setProcessingOutputPath(item.relativePath);
    setGenerationProgress({
      mode: "single",
      current: 1,
      total: 1,
      currentLabel: item.title,
    });

    try {
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 0);
      });
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
      setGenerationProgress(null);
    }
  }

  async function handleGenerateAllContent() {
    if (!workspacePath || !selectedSubjectSlug || !selectedSubject || generationBusy) return;

    const items = [...selectedSubject.lessons, ...selectedSubject.activities];
    if (items.length === 0) return;

    try {
      for (const [index, item] of items.entries()) {
        setProcessingOutputPath(item.relativePath);
        setGenerationProgress({
          mode: "bulk",
          current: index + 1,
          total: items.length,
          currentLabel: item.title,
        });

        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, 0);
        });

        await invoke("generate_content_output", {
          workspacePath,
          subjectSlug: selectedSubjectSlug,
          relativePath: item.relativePath,
        });
      }
    } catch (cause) {
      setDetailError(describeError(cause, "Falha ao gerar os arquivos da disciplina."));
    } finally {
      await Promise.all([
        refreshSubjects(workspacePath),
        refreshSubjectDetail(workspacePath, selectedSubjectSlug),
      ]);
      setProcessingOutputPath(null);
      setGenerationProgress(null);
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
      setDetailError(describeError(cause, "Falha ao abrir a pasta de saída."));
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

  async function handleRenameContent(theme: string) {
    if (!workspacePath || !selectedSubjectSlug || !renameTarget) return;

    try {
      const result = await invoke<RenameContentItemResult>("rename_content_item", {
        workspacePath,
        subjectSlug: selectedSubjectSlug,
        relativePath: renameTarget.relativePath,
        theme,
      });

      await Promise.all([
        refreshSubjects(workspacePath),
        refreshSubjectDetail(workspacePath, selectedSubjectSlug),
      ]);

      setSelectedContentPath(result.relativePath);
      setRenameTarget(null);
    } catch (cause) {
      setDetailError(describeError(cause, "Falha ao renomear o arquivo selecionado."));
      throw cause;
    }
  }

  async function handleDuplicateContent(item: ContentItem) {
    if (!workspacePath || !selectedSubjectSlug) return;

    try {
      const result = await invoke<CreateContentItemResult>("duplicate_content_item", {
        workspacePath,
        subjectSlug: selectedSubjectSlug,
        relativePath: item.relativePath,
      });

      await Promise.all([
        refreshSubjects(workspacePath),
        refreshSubjectDetail(workspacePath, selectedSubjectSlug),
      ]);

      setSelectedContentPath(result.relativePath);
    } catch (cause) {
      setDetailError(describeError(cause, "Falha ao duplicar o arquivo selecionado."));
    }
  }

  async function handleReorderContent(item: ContentItem, direction: "up" | "down") {
    if (!workspacePath || !selectedSubjectSlug) return;

    try {
      const result = await invoke<CreateContentItemResult>("reorder_content_item", {
        workspacePath,
        subjectSlug: selectedSubjectSlug,
        relativePath: item.relativePath,
        direction,
      });

      await Promise.all([
        refreshSubjects(workspacePath),
        refreshSubjectDetail(workspacePath, selectedSubjectSlug),
      ]);

      setSelectedContentPath(result.relativePath);
    } catch (cause) {
      setDetailError(describeError(cause, "Falha ao reordenar o arquivo selecionado."));
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
    if (!commandPaletteOpen || !workspacePath) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    const trimmedQuery = commandQuery.trim();
    if (trimmedQuery.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    let cancelled = false;
    setSearchLoading(true);

    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          const results = await invoke<GlobalSearchResult[]>("search_workspace_content", {
            workspacePath,
            query: trimmedQuery,
          });

          if (!cancelled) {
            setSearchResults(results);
          }
        } catch {
          if (!cancelled) {
            setSearchResults([]);
          }
        } finally {
          if (!cancelled) {
            setSearchLoading(false);
          }
        }
      })();
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [commandPaletteOpen, commandQuery, workspacePath]);

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
    showMarpPreview,
    canPreviewCurrentFile,
    canReloadCurrentFile: Boolean(selectedContentPath),
    onChooseWorkspace: handleChooseWorkspace,
    onOpenSettings: () => {
      setSelectedContentPath(null);
      setSelectedSubjectSlug(null);
      setActiveSection("settings");
      setCommandPaletteOpen(false);
    },
    onGoHome: () => {
      setActiveSection("home");
      setSelectedSubjectSlug(null);
      setSelectedContentPath(null);
      setCommandPaletteOpen(false);
    },
    onGoToFiles: () => {
      setSelectedContentPath(null);
      setCommandPaletteOpen(false);
    },
    onToggleMarpPreview: () => {
      setShowMarpPreview((current) => !current);
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

  function openSearchResult(result: GlobalSearchResult) {
    setActiveSection("home");
    setSelectedSubjectSlug(result.subjectSlug);
    setSelectedContentPath(result.relativePath);
    setEditorDocument(null);
    setEditorContent("");
    setLoadedEditorContent("");
    setSaveState("idle");
    setExternallyModified(false);
    setCommandPaletteOpen(false);
  }

  const searchActions = searchResults.map((result) => ({
    id: `search-${result.kind}-${result.subjectSlug}-${result.relativePath ?? "subject"}`,
    label: result.title,
    hint:
      result.kind === "subject"
        ? "Disciplina"
        : `${result.kind === "lesson"
            ? "Aula"
            : result.kind === "activity"
              ? "Atividade"
              : result.kind === "context"
                ? "Contexto"
                : "Plano"} · ${result.subjectDisplayName}`,
    keywords: `${result.title} ${result.subjectDisplayName} ${result.snippet}`,
    description: result.snippet,
    run: () => openSearchResult(result),
  }));

  const filteredCommandActions = commandActions.filter((action) =>
    [action.label, action.keywords]
      .join(" ")
      .toLowerCase()
      .includes(commandQuery.trim().toLowerCase()),
  );
  const visibleCommandActions =
    commandQuery.trim().length >= 2
      ? [
          ...(searchLoading
            ? [{
                id: "search-loading",
                label: "Buscando no workspace...",
                hint: "Busca",
                keywords: "",
                description: "Disciplinas, aulas, atividades e conteúdo interno.",
                disabled: true,
                run: () => {},
              }]
            : searchActions),
          ...filteredCommandActions,
        ]
      : filteredCommandActions;

  const editorBackLabel =
    activeSection === "context"
      ? "voltar para contextos"
      : activeSection === "plan"
        ? "voltar para planos"
        : "voltar para arquivos da disciplina";

  function openSection(section: "home" | "context" | "plan" | "settings") {
    setActiveSection(section);
    if (section !== "home") {
      setSelectedSubjectSlug(null);
      setSelectedSubject(null);
    }
    setSelectedContentPath(null);
    setEditorDocument(null);
    setEditorContent("");
    setLoadedEditorContent("");
    setSaveState("idle");
    setExternallyModified(false);
  }

  function openDirectDocument(subject: SubjectSummary, relativePath: "contexto.md" | "plano_geral.md") {
    setSelectedSubjectSlug(subject.slug);
    setSelectedContentPath(relativePath);
    setEditorDocument(null);
    setEditorContent("");
    setLoadedEditorContent("");
    setSaveState("idle");
    setExternallyModified(false);
  }

  return (
    <main className="studio-shell">
      <aside className="studio-sidebar" aria-label="Navegação principal">
        <nav className="sidebar-icons">
          <button
            type="button"
            className={`sidebar-icon${activeSection === "home" ? " is-active" : ""}`}
            aria-label="Disciplinas"
            onClick={() => {
              setActiveSection("home");
              setSelectedSubjectSlug(null);
              setSelectedSubject(null);
              setSelectedContentPath(null);
              setEditorDocument(null);
              setEditorContent("");
              setLoadedEditorContent("");
              setSaveState("idle");
              setExternallyModified(false);
              setShowMarpPreview(false);
            }}
          >
            <HomeIcon />
          </button>
          <button
            type="button"
            className={`sidebar-icon${activeSection === "context" ? " is-active" : ""}`}
            aria-label="Contextos"
            onClick={() => openSection("context")}
          >
            <BookIcon />
          </button>
          <button
            type="button"
            className={`sidebar-icon${activeSection === "plan" ? " is-active" : ""}`}
            aria-label="Planos"
            onClick={() => openSection("plan")}
          >
            <ClipboardIcon />
          </button>
          <button
            type="button"
            className={`sidebar-icon${showingSettings ? " is-active" : ""}`}
            aria-label="Configurações"
            onClick={() => openSection("settings")}
          >
            <SettingsIcon />
          </button>
        </nav>
      </aside>

      <section className="studio-stage">
        <header className="stage-header">
          <p className="eyebrow">Lumen Studio</p>
          <div className="header-meta">
            <button
              type="button"
              className="status-chip status-chip-action"
              onClick={() => setCommandPaletteOpen(true)}
            >
              buscar no workspace <kbd className="shortcut-kbd">Ctrl+K</kbd>
            </button>
            <span className={`status-chip ${hasWorkspace ? "status-chip-ok" : ""}`}>
              {hasWorkspace ? "◉ pasta conectada" : "◎ selecione uma pasta"}
            </span>
          </div>
        </header>

        {showingSettings ? (
          <SettingsScreen
            assetSettings={assetSettings}
            loading={assetSettingsLoading}
            error={assetSettingsError}
            busy={assetSettingsBusy}
            onSelectLogo={() => void handleSelectAsset("logo")}
            onSelectBackground={() => void handleSelectAsset("background")}
            onClearLogo={() => void handleClearAsset("logo")}
            onClearBackground={() => void handleClearAsset("background")}
            onSelectTheme={(themeId) => void handleSelectTheme(themeId)}
          />
        ) : viewingEditor ? (
          <EditorScreen
            workspacePath={workspacePath}
            backLabel={editorBackLabel}
            editorDocument={editorDocument}
            selectedContentItem={selectedContentItem}
            editorContent={editorContent}
            editorLoading={editorLoading}
            editorError={editorError}
            saveState={saveState}
            lastSavedAtMs={lastSavedAtMs}
            showMarpPreview={showMarpPreview}
            externallyModified={externallyModified}
            onChange={setEditorContent}
            onGoBack={() => {
              setSelectedContentPath(null);
              if (activeSection !== "home") {
                setSelectedSubjectSlug(null);
                setSelectedSubject(null);
              }
            }}
            onToggleMarpPreview={() => setShowMarpPreview((current) => !current)}
          />
        ) : showingContextIndex ? (
          <SubjectDocumentIndexScreen
            mode="context"
            workspacePath={workspacePath}
            changingWorkspace={changingWorkspace}
            subjects={subjects}
            loading={loading}
            error={error}
            hasWorkspace={hasWorkspace}
            onChooseWorkspace={handleChooseWorkspace}
            onOpenDocument={(subject) => openDirectDocument(subject, "contexto.md")}
          />
        ) : showingPlanIndex ? (
          <SubjectDocumentIndexScreen
            mode="plan"
            workspacePath={workspacePath}
            changingWorkspace={changingWorkspace}
            subjects={subjects}
            loading={loading}
            error={error}
            hasWorkspace={hasWorkspace}
            onChooseWorkspace={handleChooseWorkspace}
            onOpenDocument={(subject) => openDirectDocument(subject, "plano_geral.md")}
          />
        ) : !viewingDetail ? (
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
              setActiveSection("home");
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
        ) : (
          <SubjectDetailScreen
            selectedSubject={selectedSubject}
            selectedSubjectSlug={selectedSubjectSlug!}
            selectedContentPath={selectedContentPath}
            detailLoading={detailLoading}
            detailError={detailError}
            processingOutputPath={processingOutputPath}
            generationBusy={generationBusy}
            generatingAll={generatingAll}
            onEditSubject={() => setEditSubjectOpen(true)}
            onGenerateAll={() => void handleGenerateAllContent()}
            onSelectContent={setSelectedContentPath}
            onGoBack={() => setSelectedSubjectSlug(null)}
            onCreateLesson={() => setCreateLessonOpen(true)}
            onCreateActivity={() => setCreateActivityOpen(true)}
            onGenerate={(item) => void handleGenerateContent(item)}
            onOpenOutput={(item) => void handleOpenOutputFolder(item)}
            onMoveContentUp={(item) => void handleReorderContent(item, "up")}
            onMoveContentDown={(item) => void handleReorderContent(item, "down")}
            onDuplicateContent={(item) => void handleDuplicateContent(item)}
            onRenameContent={setRenameTarget}
            onDeleteContent={(item) =>
              setDeleteTarget({
                kind: "content",
                relativePath: item.relativePath,
                title: item.title,
                label: item.relativePath.startsWith("aulas/") ? "aula" : "atividade",
              })
            }
            onPreviewContent={(item) => setPreviewItem(item)}
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
              setActiveSection("home");
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
              setActiveSection("home");
              await refreshSubjectDetail(workspacePath, selectedSubjectSlug);
              setSelectedContentPath(result.relativePath);
              setCreateLessonOpen(false);
            } catch (cause) {
              setDetailError(describeError(cause, "Falha ao criar a aula."));
            }
          }}
        />
      ) : null}

      {editSubjectOpen && selectedSubjectSlug && selectedSubject ? (
        <CreateSubjectModal
          title="Configurar disciplina"
          submitLabel="Salvar disciplina"
          initialName={selectedSubject.displayName}
          initialColor={selectedSubject.color}
          onClose={() => setEditSubjectOpen(false)}
          onConfirm={async (name, color) => {
            try {
              await invoke("update_subject", {
                workspacePath,
                subjectSlug: selectedSubjectSlug,
                name,
                color,
              });
              await Promise.all([
                refreshSubjects(workspacePath),
                refreshSubjectDetail(workspacePath, selectedSubjectSlug),
              ]);
              setEditSubjectOpen(false);
            } catch (cause) {
              setDetailError(describeError(cause, "Falha ao atualizar a disciplina."));
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
              setActiveSection("home");
              await refreshSubjectDetail(workspacePath, selectedSubjectSlug);
              setSelectedContentPath(result.relativePath);
              setCreateActivityOpen(false);
            } catch (cause) {
              setDetailError(describeError(cause, "Falha ao criar a atividade."));
            }
          }}
        />
      ) : null}

      {renameTarget ? (
        <RenameContentModal
          item={renameTarget}
          onClose={() => setRenameTarget(null)}
          onConfirm={handleRenameContent}
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

      {previewItem && selectedSubjectSlug ? (
        <PreviewModal
          workspacePath={workspacePath}
          subjectSlug={selectedSubjectSlug}
          item={previewItem}
          onClose={() => setPreviewItem(null)}
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

      {generationProgress ? (
        <div className="modal-backdrop">
          <section
            className="modal-card generation-progress-card"
            aria-label={generationProgress.mode === "bulk" ? "Gerando disciplina" : "Gerando arquivo"}
          >
            <div className="modal-header">
              <div>
                <p className="preview-label">
                  {generationProgress.mode === "bulk" ? "Geração da disciplina" : "Geração do arquivo"}
                </p>
                <h2>
                  {generationProgress.mode === "bulk"
                    ? `${generationProgress.current} de ${generationProgress.total}`
                    : "Gerando"}
                </h2>
              </div>
            </div>
            <div className="modal-stack">
              <p className="modal-copy">
                {generationProgress.mode === "bulk"
                  ? `Processando ${generationProgress.current} de ${generationProgress.total}: ${generationProgress.currentLabel}`
                  : `Processando ${generationProgress.currentLabel}`}
              </p>
              <div className="generation-progress-track" aria-hidden="true">
                <div
                  className={`generation-progress-bar${generationProgress.mode === "single" ? " is-indeterminate" : ""}`}
                  style={
                    generationProgress.mode === "bulk" && generationPercent !== null
                      ? { width: `${generationPercent}%` }
                      : undefined
                  }
                />
              </div>
              <div className="generation-progress-meta">
                <span className="status-chip status-chip-saving">
                  {generationProgress.mode === "bulk"
                    ? `${generationPercent ?? 0}% concluído`
                    : "gerando arquivo..."}
                </span>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

export default App;
