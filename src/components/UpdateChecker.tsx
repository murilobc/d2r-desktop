import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export default function UpdateChecker() {
  const { t } = useTranslation();
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateVersion, setUpdateVersion] = useState("");
  const [updateNotes, setUpdateNotes] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    checkForUpdate();
  }, []);

  const checkForUpdate = async () => {
    try {
      const update = await check();
      if (update) {
        setUpdateAvailable(true);
        setUpdateVersion(update.version);
        setUpdateNotes(update.body ?? "");
      }
    } catch (e) {
      // Silently fail on update check (network error, etc.)
      console.warn("Update check failed:", e);
    }
  };

  const installUpdate = async () => {
    try {
      setDownloading(true);
      setError(null);

      const update = await check();
      if (!update) return;

      let downloaded = 0;
      let contentLength = 1;

      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            contentLength = event.data.contentLength ?? 1;
            break;
          case "Progress":
            downloaded += event.data.chunkLength;
            setProgress(Math.round((downloaded / contentLength) * 100));
            break;
          case "Finished":
            setProgress(100);
            break;
        }
      });

      await relaunch();
    } catch (e) {
      setError(String(e));
      setDownloading(false);
    }
  };

  if (!updateAvailable || dismissed) return null;

  return (
    <div className="update-banner">
      <div className="update-content">
        <div className="update-info">
          <strong>{t("update.available", { version: updateVersion })}</strong>
          {updateNotes && <span className="update-notes">{updateNotes}</span>}
        </div>
        {!downloading ? (
          <div className="update-actions">
            <button className="btn btn-sm btn-primary" onClick={installUpdate}>
              {t("update.updateNow")}
            </button>
            <button className="btn btn-sm" onClick={() => setDismissed(true)}>
              {t("update.later")}
            </button>
          </div>
        ) : (
          <div className="update-progress">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <span className="progress-text">{progress}%</span>
          </div>
        )}
      </div>
      {error && <div className="update-error">{t("update.failed", { error })}</div>}
    </div>
  );
}
