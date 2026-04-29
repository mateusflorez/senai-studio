import type { UpdateStatus } from "../hooks/useAppUpdater";
import styles from "./UpdateBanner.module.css";

interface Props {
  status: UpdateStatus;
  onInstall: () => void;
  onDismiss: () => void;
}

export function UpdateBanner({ status, onInstall, onDismiss }: Props) {
  if (status.phase === "idle") return null;

  if (status.phase === "available") {
    return (
      <div className={styles.banner} role="status">
        <span className={styles.label}>
          <span className={styles.dot} aria-hidden="true">◉</span>
          Nova versão disponível — <strong>{status.version}</strong>
        </span>
        <div className={styles.actions}>
          <button type="button" className={styles.btnInstall} onClick={onInstall}>
            Atualizar agora
          </button>
          <button type="button" className={styles.btnDismiss} onClick={onDismiss} aria-label="Ignorar">
            ✕
          </button>
        </div>
      </div>
    );
  }

  if (status.phase === "downloading") {
    const { downloaded, total } = status;
    const percent = total > 0 ? Math.round((downloaded / total) * 100) : null;
    return (
      <div className={styles.banner} role="status">
        <span className={styles.label}>
          <span className={`${styles.dot} ${styles.pulse}`} aria-hidden="true">◉</span>
          Baixando atualização{percent !== null ? ` — ${percent}%` : "…"}
        </span>
        {percent !== null && (
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${percent}%` }} />
          </div>
        )}
      </div>
    );
  }

  if (status.phase === "installing") {
    return (
      <div className={styles.banner} role="status">
        <span className={styles.label}>
          <span className={`${styles.dot} ${styles.pulse}`} aria-hidden="true">◉</span>
          Instalando… o app vai reiniciar em instantes
        </span>
      </div>
    );
  }

  if (status.phase === "error") {
    return (
      <div className={`${styles.banner} ${styles.bannerError}`} role="alert">
        <span className={styles.label}>
          <span className={styles.dot} aria-hidden="true">○</span>
          Falha na atualização — {status.message}
        </span>
        <button type="button" className={styles.btnDismiss} onClick={onDismiss} aria-label="Fechar">
          ✕
        </button>
      </div>
    );
  }

  return null;
}
