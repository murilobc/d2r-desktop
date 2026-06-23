import { useEffect, useState } from "react";
import { register, unregisterAll } from "@tauri-apps/plugin-global-shortcut";
import { emit } from "@tauri-apps/api/event";

const DEFAULT_HOTKEYS = {
  nextRun: "F9",
  pause: "F10",
  endSession: "F11",
};

type HotkeyConfig = typeof DEFAULT_HOTKEYS;

const STORAGE_KEY = "d2r_hotkeys";

function loadHotkeys(): HotkeyConfig {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try { return JSON.parse(stored); } catch { /* ignore */ }
  }
  return DEFAULT_HOTKEYS;
}

function saveHotkeys(config: HotkeyConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export async function registerHotkeys() {
  const config = loadHotkeys();

  await unregisterAll();

  await register(config.nextRun, (event) => {
    if (event.state === "Pressed") {
      emit("overlay-action", "split");
    }
  });

  await register(config.pause, (event) => {
    if (event.state === "Pressed") {
      emit("overlay-action", "pause");
    }
  });

  await register(config.endSession, (event) => {
    if (event.state === "Pressed") {
      emit("overlay-action", "end");
    }
  });
}

export default function Settings() {
  const [hotkeys, setHotkeys] = useState<HotkeyConfig>(loadHotkeys);
  const [recording, setRecording] = useState<keyof HotkeyConfig | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    registerHotkeys();
  }, []);

  const handleRecord = (action: keyof HotkeyConfig) => {
    setRecording(action);
  };

  const handleKeyCapture = (e: React.KeyboardEvent) => {
    if (!recording) return;
    e.preventDefault();

    const key = e.key === " " ? "Space" : e.key;
    const parts: string[] = [];
    if (e.ctrlKey) parts.push("Ctrl");
    if (e.altKey) parts.push("Alt");
    if (e.shiftKey) parts.push("Shift");

    // Only add the key if it's not a modifier itself
    if (!["Control", "Alt", "Shift", "Meta"].includes(e.key)) {
      parts.push(key.length === 1 ? key.toUpperCase() : key);
    } else {
      return; // Wait for non-modifier key
    }

    const shortcut = parts.join("+");
    const newConfig = { ...hotkeys, [recording]: shortcut };
    setHotkeys(newConfig);
    saveHotkeys(newConfig);
    setRecording(null);

    // Re-register with new config
    registerHotkeys().then(() => {
      setStatus("Hotkeys updated successfully!");
      setTimeout(() => setStatus(null), 3000);
    });
  };

  const handleReset = () => {
    setHotkeys(DEFAULT_HOTKEYS);
    saveHotkeys(DEFAULT_HOTKEYS);
    registerHotkeys().then(() => {
      setStatus("Hotkeys reset to defaults.");
      setTimeout(() => setStatus(null), 3000);
    });
  };

  return (
    <div className="page" onKeyDown={handleKeyCapture} tabIndex={0}>
      <div className="page-header">
        <h1>Settings</h1>
      </div>

      <div className="settings-section">
        <h2>Global Hotkeys</h2>
        <p className="settings-description">
          These keyboard shortcuts work even when the app is not focused, allowing you to control your session while playing D2R.
        </p>

        <div className="hotkey-list">
          <div className="hotkey-row">
            <span className="hotkey-label">Next Run (Split)</span>
            <button
              className={`hotkey-btn ${recording === "nextRun" ? "recording" : ""}`}
              onClick={() => handleRecord("nextRun")}
            >
              {recording === "nextRun" ? "Press a key..." : hotkeys.nextRun}
            </button>
          </div>

          <div className="hotkey-row">
            <span className="hotkey-label">Pause / Resume</span>
            <button
              className={`hotkey-btn ${recording === "pause" ? "recording" : ""}`}
              onClick={() => handleRecord("pause")}
            >
              {recording === "pause" ? "Press a key..." : hotkeys.pause}
            </button>
          </div>

          <div className="hotkey-row">
            <span className="hotkey-label">End Session</span>
            <button
              className={`hotkey-btn ${recording === "endSession" ? "recording" : ""}`}
              onClick={() => handleRecord("endSession")}
            >
              {recording === "endSession" ? "Press a key..." : hotkeys.endSession}
            </button>
          </div>
        </div>

        <div className="hotkey-actions">
          <button className="btn btn-sm" onClick={handleReset}>
            Reset to Defaults
          </button>
        </div>

        {status && <div className="settings-status">{status}</div>}

        <div className="settings-note">
          <strong>Tip:</strong> Click a hotkey button, then press the desired key or combination (e.g., F9, Ctrl+Shift+S).
          Avoid keys used by D2R (F1-F8 are skill hotkeys).
        </div>
      </div>
    </div>
  );
}
