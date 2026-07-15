import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { open as dialogOpen } from "@tauri-apps/plugin-dialog";
import { saveSyncToken, deleteSyncToken, getSyncToken } from "../api";
import { syncEngine } from "../services/cloud-sync";
import { SYNC_CONFIG_KEY } from "../services/cloud-sync.types";
import type { SyncConfig } from "../services/cloud-sync.types";

type Backend = SyncConfig["backend"];

function loadSyncConfig(): SyncConfig {
  try {
    const raw = localStorage.getItem(SYNC_CONFIG_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {
    backend: "off",
    gistId: null,
    localFolderPath: null,
    autoSyncOnClose: false,
    lastSyncTimestamp: null,
  };
}

function saveSyncConfig(config: SyncConfig): void {
  localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify(config));
}

export default function CloudSyncSettings() {
  const { t } = useTranslation();
  const [config, setConfig] = useState<SyncConfig>(loadSyncConfig);
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [testStatus, setTestStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ newBackend: Backend } | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);

  // Load token from keychain on mount if GitHub backend
  useEffect(() => {
    if (config.backend === "github_gist") {
      getSyncToken("github_token").then((t) => {
        if (t) setToken(t);
      }).catch(console.error);
    }
  }, [config.backend]);

  const applyBackendChange = useCallback((newBackend: Backend) => {
    const updated: SyncConfig = {
      ...config,
      backend: newBackend,
      // Clear backend-specific fields when switching
      ...(newBackend === "off" ? { gistId: null, localFolderPath: null } : {}),
      ...(newBackend === "github_gist" ? { localFolderPath: null } : {}),
      ...(newBackend === "local_folder" ? { gistId: null } : {}),
    };
    setConfig(updated);
    saveSyncConfig(updated);
    setTestStatus(null);
    setTokenError(null);

    // Clean up token if switching away from GitHub
    if (newBackend !== "github_gist" && config.backend === "github_gist") {
      deleteSyncToken("github_token").catch(console.error);
      setToken("");
    }
  }, [config]);

  const handleBackendChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newBackend = e.target.value as Backend;
    if (newBackend === config.backend) return;

    // Show confirmation dialog when switching from a configured backend
    if (config.backend !== "off") {
      setConfirmDialog({ newBackend });
    } else {
      applyBackendChange(newBackend);
    }
  };

  const handleConfirmSwitch = () => {
    if (confirmDialog) {
      applyBackendChange(confirmDialog.newBackend);
      setConfirmDialog(null);
    }
  };

  const handleCancelSwitch = () => {
    setConfirmDialog(null);
  };

  const handleTokenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setToken(e.target.value);
    setTokenError(null);
  };

  const handleTokenSave = async () => {
    if (!token.trim()) {
      setTokenError(t("cloudSync.tokenRequired"));
      return;
    }
    try {
      await saveSyncToken("github_token", token.trim());
      setTokenError(null);
    } catch (err) {
      setTokenError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleGistIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const updated = { ...config, gistId: e.target.value || null };
    setConfig(updated);
    saveSyncConfig(updated);
  };

  const handleFolderPick = async () => {
    try {
      const selected = await dialogOpen({ directory: true, multiple: false });
      if (selected) {
        const updated = { ...config, localFolderPath: selected as string };
        setConfig(updated);
        saveSyncConfig(updated);
      }
    } catch (err) {
      console.error("Folder picker error:", err);
    }
  };

  const handleTestConnection = async () => {
    // Validate token for GitHub before testing
    if (config.backend === "github_gist" && !token.trim()) {
      setTokenError(t("cloudSync.tokenRequired"));
      return;
    }

    // Save token first so testConnection can use it
    if (config.backend === "github_gist") {
      try {
        await saveSyncToken("github_token", token.trim());
      } catch (err) {
        setTestStatus({ type: "error", message: err instanceof Error ? err.message : String(err) });
        return;
      }
    }

    setTesting(true);
    setTestStatus(null);

    try {
      const result = await syncEngine.testConnection();
      if (result.success) {
        setTestStatus({ type: "success", message: t("cloudSync.connectionSuccess") });
        setTimeout(() => setTestStatus(null), 5000);
      } else {
        setTestStatus({ type: "error", message: result.error ?? t("cloudSync.connectionFailed") });
      }
    } catch (err) {
      setTestStatus({ type: "error", message: err instanceof Error ? err.message : String(err) });
    } finally {
      setTesting(false);
    }
  };

  const handleAutoSyncToggle = () => {
    const updated = { ...config, autoSyncOnClose: !config.autoSyncOnClose };
    setConfig(updated);
    saveSyncConfig(updated);
  };

  return (
    <div className="settings-section" style={{ marginTop: "1.5rem" }}>
      <h2>{t("cloudSync.title")}</h2>
      <p className="settings-description">
        {t("cloudSync.description")}
      </p>

      {/* Backend selector */}
      <div className="hotkey-row">
        <span className="hotkey-label">{t("cloudSync.backend")}</span>
        <select
          value={config.backend}
          onChange={handleBackendChange}
          className="hotkey-btn"
        >
          <option value="off">{t("cloudSync.backendOff")}</option>
          <option value="github_gist">{t("cloudSync.backendGithub")}</option>
          <option value="local_folder">{t("cloudSync.backendLocal")}</option>
        </select>
      </div>

      {/* GitHub Gist settings */}
      {config.backend === "github_gist" && (
        <>
          <div className="hotkey-row">
            <span className="hotkey-label">{t("cloudSync.githubToken")}</span>
            <div style={{ display: "flex", flex: 1, gap: "0.5rem", alignItems: "center" }}>
              <input
                type={showToken ? "text" : "password"}
                value={token}
                onChange={handleTokenChange}
                placeholder="ghp_..."
                className="hotkey-btn"
                style={{ flex: 1 }}
                aria-label={t("cloudSync.githubToken")}
              />
              <button
                className="btn btn-sm"
                onClick={() => setShowToken(!showToken)}
                aria-label={showToken ? t("cloudSync.hideToken") : t("cloudSync.showToken")}
              >
                {showToken ? t("cloudSync.hideToken") : t("cloudSync.showToken")}
              </button>
              <button className="btn btn-sm" onClick={handleTokenSave}>
                {t("cloudSync.save")}
              </button>
            </div>
          </div>
          {tokenError && (
            <div className="settings-status" style={{ color: "var(--color-error, #e74c3c)" }}>
              {tokenError}
            </div>
          )}

          <div className="hotkey-row">
            <span className="hotkey-label">{t("cloudSync.gistId")}</span>
            <input
              type="text"
              value={config.gistId ?? ""}
              onChange={handleGistIdChange}
              placeholder={t("cloudSync.gistIdPlaceholder")}
              className="hotkey-btn"
              style={{ flex: 1 }}
              aria-label={t("cloudSync.gistId")}
            />
          </div>
        </>
      )}

      {/* Local Folder settings */}
      {config.backend === "local_folder" && (
        <div className="hotkey-row">
          <span className="hotkey-label">{t("cloudSync.syncFolder")}</span>
          <span className="settings-description" style={{ flex: 1, wordBreak: "break-all" }}>
            {config.localFolderPath || t("cloudSync.notSet")}
          </span>
          <button className="btn btn-sm" onClick={handleFolderPick}>
            {t("cloudSync.chooseFolder")}
          </button>
        </div>
      )}

      {/* Test Connection */}
      {config.backend !== "off" && (
        <div className="hotkey-row">
          <span className="hotkey-label" />
          <button
            className="btn btn-sm"
            onClick={handleTestConnection}
            disabled={testing}
          >
            {testing ? t("cloudSync.testing") : t("cloudSync.testConnection")}
          </button>
        </div>
      )}

      {testStatus && (
        <div
          className="settings-status"
          style={{
            color: testStatus.type === "success"
              ? "var(--color-success, #27ae60)"
              : "var(--color-error, #e74c3c)",
          }}
        >
          {testStatus.message}
        </div>
      )}

      {/* Auto-sync on close toggle */}
      <div className="hotkey-row">
        <span className="hotkey-label">{t("cloudSync.autoSyncOnClose")}</span>
        <button
          className={`hotkey-btn ${config.autoSyncOnClose ? "recording" : ""}`}
          onClick={handleAutoSyncToggle}
        >
          {config.autoSyncOnClose ? t("common.on") : t("common.off")}
        </button>
      </div>

      <div className="settings-note">
        <strong>{t("common.tip")}:</strong> {t("cloudSync.tip")}
      </div>

      {/* Confirmation dialog */}
      {confirmDialog && (
        <div className="confirm-dialog-overlay" style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
        }}>
          <div className="confirm-dialog" style={{
            background: "var(--bg-secondary, #1e1e2e)",
            border: "1px solid var(--border-color, #333)",
            borderRadius: "8px",
            padding: "1.5rem",
            maxWidth: "400px",
            width: "90%",
          }}>
            <h3 style={{ marginTop: 0 }}>{t("cloudSync.switchBackendTitle")}</h3>
            <p>
              {t("cloudSync.switchBackendMessage")}
            </p>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button className="btn btn-sm" onClick={handleCancelSwitch}>
                {t("cloudSync.cancel")}
              </button>
              <button className="btn btn-sm" onClick={handleConfirmSwitch}>
                {t("cloudSync.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
