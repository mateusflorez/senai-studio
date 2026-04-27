import type { SubjectSummary } from "../types";
import { flagClassName, formatUpdatedAt } from "../utils";
import { LoadingState, ErrorState, EmptyWorkspaceState } from "../components/FeedbackStates";

export function HomeScreen({
  workspacePath,
  changingWorkspace,
  subjects,
  loading,
  error,
  totalLessons,
  totalActivities,
  hasWorkspace,
  creatingTemplateSubject,
  onChooseWorkspace,
  onSelectSubject,
  onCreateSubject,
  onCreateTemplateSubject,
  onDeleteSubject,
}: {
  workspacePath: string;
  changingWorkspace: boolean;
  subjects: SubjectSummary[];
  loading: boolean;
  error: string | null;
  totalLessons: number;
  totalActivities: number;
  hasWorkspace: boolean;
  creatingTemplateSubject: boolean;
  onChooseWorkspace: () => Promise<void>;
  onSelectSubject: (slug: string) => void;
  onCreateSubject: () => void;
  onCreateTemplateSubject: () => void;
  onDeleteSubject: (subject: SubjectSummary) => void;
}) {
  return (
    <>
      <section className="hero-grid">
        <div className="hero-copy">
          <p className="hero-kicker">Seu planejamento</p>
          <h1>Escolha a pasta do seu material e continue de onde parou.</h1>
          <p className="hero-body">
            Selecione a pasta onde suas disciplinas estao organizadas. O
            aplicativo lembra essa escolha e voce pode trocar quando quiser.
          </p>
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
                onClick={onCreateSubject}
              >
                + Disciplina
              </button>
            ) : null}
          </div>
        </div>

        {!hasWorkspace ? (
          <EmptyWorkspaceState onChooseWorkspace={onChooseWorkspace} />
        ) : null}
        {hasWorkspace && loading ? <LoadingState /> : null}
        {hasWorkspace && error ? <ErrorState message={error} /> : null}
        {hasWorkspace && !loading && !error && subjects.length === 0 ? (
          <button
            type="button"
            className="template-card"
            onClick={onCreateTemplateSubject}
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
              <article key={subject.id} className="subject-card">
                <button
                  type="button"
                  className="subject-card-open"
                  onClick={() => onSelectSubject(subject.slug)}
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
                </button>
                <div className="subject-card-footer">
                  <div className="subject-flags">
                    <span className={flagClassName(subject.hasContext)}>
                      {subject.hasContext ? "◉ contexto" : "○ sem contexto"}
                    </span>
                    <span className={flagClassName(subject.hasPlan)}>
                      {subject.hasPlan ? "◉ plano" : "○ sem plano"}
                    </span>
                  </div>
                  <div className="subject-card-footer-actions">
                    <p className="subject-updated">
                      {formatUpdatedAt(subject.updatedAtMs)}
                    </p>
                    <button
                      type="button"
                      className="ghost-action danger-action"
                      onClick={() => onDeleteSubject(subject)}
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </>
  );
}
