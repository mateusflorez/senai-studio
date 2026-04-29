import { useEffect, useState } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export type UpdateStatus =
  | { phase: "idle" }
  | { phase: "available"; version: string; notes: string }
  | { phase: "downloading"; downloaded: number; total: number }
  | { phase: "installing" }
  | { phase: "error"; message: string };

export function useAppUpdater() {
  const [status, setStatus] = useState<UpdateStatus>({ phase: "idle" });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    check()
      .then((update) => {
        if (cancelled || !update?.available) return;
        setStatus({
          phase: "available",
          version: update.version,
          notes: update.body ?? "",
        });
      })
      .catch(() => {
        // silencioso — falha de rede não deve interromper o app
      });

    return () => { cancelled = true; };
  }, []);

  async function install() {
    const update = await check();
    if (!update?.available) return;

    try {
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          setStatus({ phase: "downloading", downloaded: 0, total: event.data.contentLength ?? 0 });
        } else if (event.event === "Progress") {
          setStatus((prev) => {
            if (prev.phase !== "downloading") return prev;
            return {
              phase: "downloading",
              downloaded: prev.downloaded + event.data.chunkLength,
              total: prev.total,
            };
          });
        } else if (event.event === "Finished") {
          setStatus({ phase: "installing" });
        }
      });

      await relaunch();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setStatus({ phase: "error", message });
    }
  }

  return { status, dismissed, dismiss: () => setDismissed(true), install };
}
