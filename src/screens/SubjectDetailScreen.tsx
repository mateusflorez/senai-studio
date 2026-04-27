import type { SubjectDetail, ContentItem } from "../types";
import { flagClassName, humanizeSlug } from "../utils";
import { LoadingState, ErrorState } from "../components/FeedbackStates";
import { ContentColumn } from "../components/ContentColumn";

export function SubjectDetailScreen({
  workspacePath,
  changingWorkspace,
  selectedSubject,
  selectedSubjectSlug,
  selectedContentPath,
  detailLoading,
  detailError,
  processingOutputPath,
  onChooseWorkspace,
  onSelectContent,
  onGoBack,
  onCreateLesson,
  onCreateActivity,
  onGenerate,
  onOpenOutput,
  onDeleteContent,
}: {
  workspacePath: string;
  changingWorkspace: boolean;
  selectedSubject: SubjectDetail | null;
  selectedSubjectSlug: string;
  selectedContentPath: string | null;
  detailLoading: boolean;
  detailError: string | null;
  processingOutputPath: string | null;
  onChooseWorkspace: () => Promise<void>;
  onSelectContent: (path: string) => void;
  onGoBack: () => void;
  onCreateLesson: () => void;
  onCreateActivity: () => void;
  onGenerate: (item: ContentItem) => void;
  onOpenOutput: (item: ContentItem) => void;
  onDeleteContent: (item: ContentItem) => void;
}) {
  return (
    <section className="subject-detail-shell" aria-labelledby="subject-detail-title">
      <div className="subject-detail-header">
        <div className="subject-detail-copy">
          <button type="button" className="back-action" onClick={onGoBack}>
            ← voltar para disciplinas
          </button>
          <p className="hero-kicker">Disciplina</p>
          <h1 id="subject-detail-title">
            {selectedSubject?.displayName ?? humanizeSlug(selectedSubjectSlug)}
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
              onClick={() => void onChooseWorkspace()}
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
            onSelect={onSelectContent}
            actionLabel="+ Aula"
            onAction={onCreateLesson}
            busyPath={processingOutputPath}
            onGenerate={onGenerate}
            onOpenOutput={onOpenOutput}
            onDelete={onDeleteContent}
          />
          <ContentColumn
            title="Atividades"
            subtitle="Arquivos de atividade"
            emptyMessage="Nenhuma atividade encontrada."
            items={selectedSubject.activities}
            selectedPath={selectedContentPath}
            onSelect={onSelectContent}
            actionLabel="+ Atividade"
            onAction={onCreateActivity}
            busyPath={processingOutputPath}
            onGenerate={onGenerate}
            onOpenOutput={onOpenOutput}
            onDelete={onDeleteContent}
          />
        </div>
      ) : null}
    </section>
  );
}
