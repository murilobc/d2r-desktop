import { useEffect, useState, useCallback } from "react";
import { getScreenshotSettings, updateScreenshotSettings } from "../api";
import type { ScreenshotSettings } from "../types";

export default function ScreenshotSettingsPanel() {
  const [settings, setSettings] = useState<ScreenshotSettings>({
    monitoring_enabled: false,
    auto_detection_enabled: true,
    confidence_threshold: 80,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [thresholdInput, setThresholdInput] = useState("80");
  const [thresholdError, setThresholdError] = useState<string | null>(null);

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

  const saveSettings = useCallback(
    async (updated: ScreenshotSettings) => {
      setError(null);
      try {
        const saved = await updateScreenshotSettings(updated);
        setSettings(saved);
        setThresholdInput(String(saved.confidence_threshold));
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to save settings"
        );
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

  if (loading) {
    return (
      <div className="settings-section">
        <h2>Screenshot Detection</h2>
        <p>Loading...</p>
      </div>
    );
  }

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
