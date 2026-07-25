import { useEffect, useState, useCallback } from "react";
import { getScreenshotSettings, updateScreenshotSettings, getDefaultScreenshotFolder } from "../api";
import { open } from "@tauri-apps/plugin-dialog";
import type { ScreenshotSettings } from "../types";

export default function ScreenshotSettingsPanel() {
  const [settings, setSettings] = useState<ScreenshotSettings>({
    monitoring_enabled: false,
    auto_detection_enabled: true,
    confidence_threshold: 80,
    folder_monitoring_enabled: false,
    screenshot_folder_path: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [thresholdInput, setThresholdInput] = useState("80");
  const [thresholdError, setThresholdError] = useState<string | null>(null);
  const [folderStatus, setFolderStatus] = useState<{ exists: boolean; fileCount: number } | null>(null);
  const [folderValidationError, setFolderValidationError] = useState<string | null>(null);

  useEffect(() => {
    getScreenshotSettings()
      .then((s) => {
        setSettings(s);
        setThresholdInput(String(s.confidence_threshold));
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setLoading(false));
  }, []);

  // Resolve folder status when path changes
  useEffect(() => {
    const path = settings.screenshot_folder_path;
    if (!path) {
      setFolderStatus(null);
      setFolderValidationError(null);
      return;
    }
    // We rely on the backend to validate the folder when enabling monitoring.
    // For UI display purposes, we show the path and let the backend report errors.
    // The folderStatus will be set by auto-detect responses or backend error messages.
  }, [settings.screenshot_folder_path]);

  const saveSettings = useCallback(
    async (updated: ScreenshotSettings) => {
      setError(null);
      setFolderValidationError(null);
      try {
        const saved = await updateScreenshotSettings(updated);
        setSettings(saved);
        setThresholdInput(String(saved.confidence_threshold));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to save settings";
        // If the error is about folder path, show as validation error
        if (message.toLowerCase().includes("folder") || message.toLowerCase().includes("path") || message.toLowerCase().includes("directory")) {
          setFolderValidationError(message);
        } else {
          setError(message);
        }
      }
    },
    []
  );

  const handleMonitoringToggle = () => {
    const updated = { ...settings, monitoring_enabled: !settings.monitoring_enabled };
    setSettings(updated);
    saveSettings(updated);
  };

  const handleAutoDetectionToggle = () => {
    const updated = { ...settings, auto_detection_enabled: !settings.auto_detection_enabled };
    setSettings(updated);
    saveSettings(updated);
  };

  const handleThresholdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setThresholdInput(raw);

    const value = Number.parseInt(raw, 10);
    if (Number.isNaN(value) || value < 50 || value > 100) {
      setThresholdError("Threshold must be between 50 and 100");
      return;
    }

    setThresholdError(null);
    const updated = { ...settings, confidence_threshold: value };
    setSettings(updated);
    saveSettings(updated);
  };

  const handleFolderMonitoringToggle = () => {
    if (!settings.folder_monitoring_enabled && !settings.screenshot_folder_path) {
      setFolderValidationError("Screenshots folder not found — please set a valid path");
      return;
    }
    const updated = { ...settings, folder_monitoring_enabled: !settings.folder_monitoring_enabled };
    setSettings(updated);
    saveSettings(updated);
  };

  const handleAutoDetect = async () => {
    setFolderValidationError(null);
    try {
      const path = await getDefaultScreenshotFolder();
      if (path) {
        const updated = { ...settings, screenshot_folder_path: path };
        setSettings(updated);
        setFolderStatus({ exists: true, fileCount: 0 });
        saveSettings(updated);
      } else {
        setFolderValidationError("D2R screenshots folder not found on this system");
        setFolderStatus(null);
      }
    } catch (err) {
      setFolderValidationError(
        err instanceof Error ? err.message : "Failed to auto-detect folder"
      );
    }
  };

  const handleBrowse = async () => {
    setFolderValidationError(null);
    try {
      const selected = await open({ directory: true, title: "Select D2R Screenshots Folder" });
      if (selected) {
        const updated = { ...settings, screenshot_folder_path: selected };
        setSettings(updated);
        setFolderStatus({ exists: true, fileCount: 0 });
        saveSettings(updated);
      }
    } catch (err) {
      setFolderValidationError(
        err instanceof Error ? err.message : "Failed to open folder picker"
      );
    }
  };

  if (loading) {
    return (
      <div className="settings-section">
        <h2>Screenshot Detection</h2>
        <p>Loading...</p>
      </div>
    );
  }

  const folderPath = settings.screenshot_folder_path;

  return (
    <div className="settings-section">
      <h2>Screenshot Detection</h2>

      <div className="hotkey-row">
        <label className="hotkey-label" htmlFor="screenshot-monitoring-toggle">
          Clipboard Monitoring
        </label>
        <button
          id="screenshot-monitoring-toggle"
          className={`hotkey-btn toggle-btn ${settings.monitoring_enabled ? "recording" : ""}`}
          onClick={handleMonitoringToggle}
          aria-pressed={settings.monitoring_enabled}
        >
          {settings.monitoring_enabled ? "ON" : "OFF"}
        </button>
      </div>

      <div className="hotkey-row">
        <label className="hotkey-label" htmlFor="screenshot-auto-detection-toggle">
          Auto-Detection
        </label>
        <button
          id="screenshot-auto-detection-toggle"
          className={`hotkey-btn toggle-btn ${settings.auto_detection_enabled ? "recording" : ""}`}
          onClick={handleAutoDetectionToggle}
          aria-pressed={settings.auto_detection_enabled}
        >
          {settings.auto_detection_enabled ? "ON" : "OFF"}
        </button>
      </div>

      <div className="hotkey-row">
        <label className="hotkey-label" htmlFor="screenshot-confidence-threshold">
          Confidence Threshold
        </label>
        <input
          id="screenshot-confidence-threshold"
          type="number"
          min={50}
          max={100}
          step={1}
          value={thresholdInput}
          onChange={handleThresholdChange}
          className="hotkey-btn"
          style={{ width: "80px" }}
          aria-describedby={thresholdError ? "threshold-error" : undefined}
          aria-invalid={thresholdError ? true : undefined}
        />
        {thresholdError && (
          <span
            id="threshold-error"
            style={{ color: "var(--color-error, #e74c3c)", marginLeft: "0.5rem", fontSize: "0.85rem" }}
            role="alert"
          >
            {thresholdError}
          </span>
        )}
      </div>

      <h3 style={{ marginTop: "1.5rem", marginBottom: "0.75rem" }}>Folder Monitoring</h3>

      <div className="hotkey-row">
        <label className="hotkey-label" htmlFor="folder-monitoring-toggle">
          Folder Monitoring
        </label>
        <button
          id="folder-monitoring-toggle"
          className={`hotkey-btn toggle-btn ${settings.folder_monitoring_enabled ? "recording" : ""}`}
          onClick={handleFolderMonitoringToggle}
          aria-pressed={settings.folder_monitoring_enabled}
          aria-describedby={folderValidationError ? "folder-validation-error" : undefined}
        >
          {settings.folder_monitoring_enabled ? "ON" : "OFF"}
        </button>
      </div>

      <div className="hotkey-row">
        <label className="hotkey-label" htmlFor="folder-path-display">
          Screenshots Folder
        </label>
        <span
          id="folder-path-display"
          className="hotkey-btn"
          style={{
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontSize: "0.85rem",
            opacity: folderPath ? 1 : 0.6,
          }}
          title={folderPath || "No folder configured"}
        >
          {folderPath || "Not configured"}
        </span>
      </div>

      <div className="hotkey-row" style={{ gap: "0.5rem" }}>
        <label className="hotkey-label">Folder Actions</label>
        <button
          className="hotkey-btn"
          onClick={handleAutoDetect}
          aria-label="Auto-detect D2R screenshots folder"
        >
          Auto-detect
        </button>
        <button
          className="hotkey-btn"
          onClick={handleBrowse}
          aria-label="Browse for screenshots folder"
        >
          Browse
        </button>
      </div>

      {folderStatus && (
        <div className="hotkey-row">
          <span className="hotkey-label">Status</span>
          <span
            style={{
              fontSize: "0.85rem",
              color: folderStatus.exists ? "var(--color-success, #27ae60)" : "var(--color-error, #e74c3c)",
            }}
            aria-live="polite"
          >
            {folderStatus.exists
              ? `Folder exists (${folderStatus.fileCount} files)`
              : "Folder not found"}
          </span>
        </div>
      )}

      {folderValidationError && (
        <div
          id="folder-validation-error"
          className="hotkey-row"
          style={{ color: "var(--color-error, #e74c3c)", fontSize: "0.85rem" }}
          role="alert"
        >
          {folderValidationError}
        </div>
      )}

      {error && (
        <div
          className="settings-status"
          style={{ color: "var(--color-error, #e74c3c)" }}
          role="alert"
        >
          {error}
        </div>
      )}
    </div>
  );
}
