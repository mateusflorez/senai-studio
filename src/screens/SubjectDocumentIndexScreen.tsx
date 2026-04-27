import type { SubjectSummary } from "../types";
import { formatUpdatedAt } from "../utils";
import { LoadingState, ErrorState, EmptyWorkspaceState } from "../components/FeedbackStates";

export function SubjectDocumentIndexScreen({
  mode,
  workspacePath,
  changingWorkspace,
  subjects,
  loading,
  error,
  hasWorkspace,
  onChooseWorkspace,
  onOpenDocument,
}: {
  mode: "context" | "plan";
  workspacePath: string;
  changingWorkspace: boolean;
  subjects: SubjectSummary[];
  loading: boolean;
  error: string | null;
  hasWorkspace: boolean;
  onChooseWorkspace: () => Promise<void>;
  onOpenDocument: (subject: SubjectSummary) => void;
}) {
  const isContext = mode === "context";
  const title = isContext ? "Contextos das disciplinas" : "Planos gerais das disciplinas";
  const copy = isContext
    ? "Abra o contexto de qualquer disciplina para editar objetivos, materiais, competências e anotações."
    : "Abra o plano geral para organizar visão geral, objetivos, sequência de aulas e datas.";
  const emptyLabel = isContext ? "sem contexto" : "sem plano";
  const readyLabel = isContext ? "◉ contexto" : "◉ plano";

  return (
    <>
      <section className="hero-grid">
        <div className="hero-copy">
          <p className="hero-kicker">{isContext ? "Contextos" : "Planos"}</p>
          <h1>{title}</h1>
          <p className="hero-body">{copy}</p>
        </div>

        <aside className="workspace-panel" aria-label="Resumo do workspace">
          <div className="workspace-heading">
            <p className="preview-label">Fonte de dados</p>
            <button
              type="button"
              className="ghost-action"
              onClick={() => void onChooseWorkspace()}
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
        </aside>
      </section>

      <section className="subjects-section" aria-labelledby="document-index-title">
        <div className="section-heading">
          <div>
            <p className="preview-label">Disciplinas</p>
            <h2 id="document-index-title">{title}</h2>
          </div>
          <div className="section-actions">
            <p className="section-copy">
              Clique em uma disciplina para abrir o arquivo direto no editor.
            </p>
          </div>
        </div>

        {!hasWorkspace ? <EmptyWorkspaceState onChooseWorkspace={onChooseWorkspace} /> : null}
        {hasWorkspace && loading ? <LoadingState /> : null}
        {hasWorkspace && error ? <ErrorState message={error} /> : null}
        {hasWorkspace && !loading && !error ? (
          <div className="subjects-grid">
            {subjects.map((subject) => {
              const available = isContext ? subject.hasContext : subject.hasPlan;

              return (
                <article key={subject.id} className="subject-card">
                  <button
                    type="button"
                    className="subject-card-open"
                    onClick={() => onOpenDocument(subject)}
                    disabled={!available}
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
                        {available
                          ? `abrir ${isContext ? "contexto" : "plano geral"}`
                          : emptyLabel}
                      </p>
                    </div>
                  </button>
                  <div className="subject-card-footer">
                    <div className="subject-flags">
                      <span className={available ? "subject-flag is-ready" : "subject-flag"}>
                        {available ? readyLabel : `○ ${emptyLabel}`}
                      </span>
                    </div>
                    <div className="subject-card-footer-actions">
                      <p className="subject-updated">{formatUpdatedAt(subject.updatedAtMs)}</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </section>
    </>
  );
}
