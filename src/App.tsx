import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
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
  title: string;
  status: "ok" | "outdated" | "none";
  updatedAtMs: number | null;
};

const workspaceStorageKey = "senai-studio.workspace-path";

function App() {
  const [workspacePath, setWorkspacePath] = useState(() =>
    window.localStorage.getItem(workspaceStorageKey) ?? "",
  );
  const [subjects, setSubjects] = useState<SubjectSummary[]>([]);
  const [selectedSubjectSlug, setSelectedSubjectSlug] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<SubjectDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [changingWorkspace, setChangingWorkspace] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspacePath) {
      setSubjects([]);
      setSelectedSubjectSlug(null);
      setSelectedSubject(null);
      setLoading(false);
      setError(null);
      return;
    }

    let active = true;
    setLoading(true);

    async function loadSubjects() {
      try {
        const nextSubjects = await invoke<SubjectSummary[]>("list_subjects", {
          workspacePath,
        });

        if (!active) {
          return;
        }

        setSubjects(nextSubjects);
        setError(null);

        if (
          selectedSubjectSlug &&
          !nextSubjects.some((subject) => subject.slug === selectedSubjectSlug)
        ) {
          setSelectedSubjectSlug(null);
          setSelectedSubject(null);
        }
      } catch (cause) {
        if (!active) {
          return;
        }

        setSubjects([]);
        setSelectedSubjectSlug(null);
        setSelectedSubject(null);
        setError(cause instanceof Error ? cause.message : "Falha ao ler disciplinas.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadSubjects();

    return () => {
      active = false;
    };
  }, [workspacePath, selectedSubjectSlug]);

  useEffect(() => {
    if (!workspacePath || !selectedSubjectSlug) {
      setSelectedSubject(null);
      setDetailLoading(false);
      setDetailError(null);
      return;
    }

    let active = true;
    setDetailLoading(true);

    async function loadSubjectDetail() {
      try {
        const detail = await invoke<SubjectDetail>("get_subject_detail", {
          workspacePath,
          subjectSlug: selectedSubjectSlug,
        });

        if (!active) {
          return;
        }

        setSelectedSubject(detail);
        setDetailError(null);
      } catch (cause) {
        if (!active) {
          return;
        }

        setSelectedSubject(null);
        setDetailError(
          cause instanceof Error ? cause.message : "Falha ao carregar a disciplina.",
        );
      } finally {
        if (active) {
          setDetailLoading(false);
        }
      }
    }

    void loadSubjectDetail();

    return () => {
      active = false;
    };
  }, [workspacePath, selectedSubjectSlug]);

  async function handleChooseWorkspace() {
    setChangingWorkspace(true);

    try {
      const selection = await open({
        directory: true,
        multiple: false,
        defaultPath: workspacePath || undefined,
        title: "Selecionar workspace do SENAI Studio",
      });

      if (typeof selection !== "string" || !selection.trim()) {
        return;
      }

      window.localStorage.setItem(workspaceStorageKey, selection);
      setWorkspacePath(selection);
      setSelectedSubjectSlug(null);
      setSelectedSubject(null);
    } finally {
      setChangingWorkspace(false);
    }
  }

  const totalLessons = subjects.reduce((sum, subject) => sum + subject.lessonCount, 0);
  const totalActivities = subjects.reduce((sum, subject) => sum + subject.activityCount, 0);
  const hasWorkspace = workspacePath.trim().length > 0;
  const viewingDetail = Boolean(selectedSubjectSlug);

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
              {hasWorkspace ? "◉ workspace conectado" : "◎ selecione um workspace"}
            </span>
            <span className="status-chip">Fase 1</span>
          </div>
        </header>

        {!viewingDetail ? (
          <>
            <section className="hero-grid">
              <div className="hero-copy">
                <p className="hero-kicker">Workspace didatico</p>
                <h1>Escolha onde o planejamento esta salvo e troque isso quando quiser.</h1>
                <p className="hero-body">
                  O app nao depende mais de um caminho fixo da sua maquina. Voce seleciona a
                  pasta do planejamento, o caminho fica salvo localmente e pode ser alterado
                  depois por botao.
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
                  <p className="preview-label">Home</p>
                  <h2 id="subjects-title">Grid de disciplinas</h2>
                </div>
                <p className="section-copy">
                  Cards editoriais com nome, cor, estrutura base e volume de conteudo.
                </p>
              </div>

              {!hasWorkspace ? (
                <EmptyWorkspaceState onChooseWorkspace={handleChooseWorkspace} />
              ) : null}
              {hasWorkspace && loading ? <LoadingState /> : null}
              {hasWorkspace && error ? <ErrorState message={error} /> : null}
              {hasWorkspace && !loading && !error ? (
                <div className="subjects-grid">
                  {subjects.map((subject) => (
                    <button
                      key={subject.id}
                      type="button"
                      className="subject-card"
                      onClick={() => setSelectedSubjectSlug(subject.slug)}
                    >
                      <div className="subject-card-top">
                        <span
                          className="subject-swatch"
                          style={{ backgroundColor: subject.color }}
                          aria-hidden="true"
                        />
                        <span className="status-chip">{subject.slug}</span>
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
                  Aulas e atividades da disciplina, com status derivados dos mesmos outputs do
                  TUI: `slides/*.pptx` e `atividades/pdfs/*.pdf`.
                </p>
              </div>

              <aside className="workspace-panel subject-detail-panel">
                <div className="workspace-heading">
                  <p className="preview-label">Workspace</p>
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
                  subtitle="Status de slides"
                  emptyMessage="Nenhuma aula encontrada."
                  items={selectedSubject.lessons}
                />
                <ContentColumn
                  title="Atividades"
                  subtitle="Status de PDFs"
                  emptyMessage="Nenhuma atividade encontrada."
                  items={selectedSubject.activities}
                />
              </div>
            ) : null}
          </section>
        )}
      </section>
    </main>
  );
}

function ContentColumn({
  title,
  subtitle,
  items,
  emptyMessage,
}: {
  title: string;
  subtitle: string;
  items: ContentItem[];
  emptyMessage: string;
}) {
  return (
    <section className="content-column">
      <div className="content-column-header">
        <div>
          <p className="preview-label">{subtitle}</p>
          <h2>{title}</h2>
        </div>
        <span className="status-chip">{items.length} itens</span>
      </div>

      {items.length === 0 ? (
        <div className="content-empty">{emptyMessage}</div>
      ) : (
        <div className="content-list">
          {items.map((item) => (
            <article key={item.file} className="content-card">
              <div className="content-card-top">
                <span className={`content-status content-status-${item.status}`}>
                  {statusGlyph(item.status)} {statusLabel(item.status)}
                </span>
                <span className="content-file">{item.file}</span>
              </div>
              <h3>{item.title}</h3>
              <p className="content-updated">{formatUpdatedAt(item.updatedAtMs)}</p>
            </article>
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
      <p className="preview-label">workspace</p>
      <p className="feedback-title">Selecione a pasta onde o planejamento esta salvo.</p>
      <p className="feedback-copy">
        Pode ser uma pasta nova ou uma pasta existente. Assim que voce escolher, o app
        salva esse caminho localmente e usa esse workspace nas proximas aberturas.
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

function statusLabel(status: ContentItem["status"]) {
  if (status === "ok") return "ok";
  if (status === "outdated") return "pendente";
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
      <p className="feedback-title">Lendo arquivos do workspace...</p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="feedback-panel is-error" role="alert">
      <p className="preview-label">erro</p>
      <p className="feedback-title">Nao foi possivel carregar esta tela.</p>
      <p className="feedback-copy">{message}</p>
    </div>
  );
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
