import { useEffect, useState } from "react";
import { register, unregisterAll } from "@tauri-apps/plugin-global-shortcut";
import { emit } from "@tauri-apps/api/event";
import { getSoundPrefs, setSoundPrefs, playSound } from "../utils/audio";
import { getObsFilePath } from "../api";
import { TERROR_ZONES, loadTZPrefs, saveTZPrefs, type TerrorZonePrefs } from "../data/terror-zones";

// OBS Preferences
interface ObsPrefs {
  enabled: boolean;
  format: "text" | "json";
}

const OBS_STORAGE_KEY = "d2r_obs_prefs";

export function getObsPrefs(): ObsPrefs {
  const stored = localStorage.getItem(OBS_STORAGE_KEY);
  if (stored) {
    try { return JSON.parse(stored); } catch { /* ignore */ }
  }
  return { enabled: false, format: "text" };
}

function saveObsPrefs(prefs: ObsPrefs) {
  localStorage.setItem(OBS_STORAGE_KEY, JSON.stringify(prefs));
}

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

      <SoundSettings />
      <ObsSettings />
      <TerrorZoneSettings />
    </div>
  );
}

function SoundSettings() {
  const [prefs, setPrefs] = useState(getSoundPrefs);

  const toggleEnabled = () => {
    const updated = { ...prefs, enabled: !prefs.enabled };
    setPrefs(updated);
    setSoundPrefs(updated);
  };

  const changeVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const updated = { ...prefs, volume: parseInt(e.target.value) };
    setPrefs(updated);
    setSoundPrefs(updated);
  };

  return (
    <div className="settings-section" style={{ marginTop: "1.5rem" }}>
      <h2>Sound Notifications</h2>
      <p className="settings-description">
        Audio cues for milestones, item finds, and alerts during farming sessions.
      </p>

      <div className="hotkey-row">
        <span className="hotkey-label">Enable sounds</span>
        <button className={`hotkey-btn ${prefs.enabled ? "recording" : ""}`} onClick={toggleEnabled}>
          {prefs.enabled ? "ON" : "OFF"}
        </button>
      </div>

      <div className="hotkey-row">
        <span className="hotkey-label">Volume</span>
        <input
          type="range"
          min={0}
          max={100}
          value={prefs.volume}
          onChange={changeVolume}
          className="volume-slider"
        />
        <span className="volume-value">{prefs.volume}%</span>
      </div>

      <div className="hotkey-row">
        <span className="hotkey-label">Test sounds</span>
        <div className="sound-test-btns">
          <button className="btn btn-sm" onClick={() => playSound("item")}>Item</button>
          <button className="btn btn-sm" onClick={() => playSound("milestone")}>Milestone</button>
          <button className="btn btn-sm" onClick={() => playSound("alert")}>Alert</button>
          <button className="btn btn-sm" onClick={() => playSound("goal")}>Goal</button>
        </div>
      </div>

      <div className="settings-note">
        <strong>Triggers:</strong> Item found → beep, every 10 runs → milestone, run exceeds 2× average → alert, goal reached → celebration.
      </div>
    </div>
  );
}

function ObsSettings() {
  const [prefs, setPrefs] = useState<ObsPrefs>(getObsPrefs);
  const [filePath, setFilePath] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (prefs.enabled) {
      getObsFilePath().then(setFilePath).catch(console.error);
    }
  }, [prefs.enabled]);

  const toggleEnabled = () => {
    const updated = { ...prefs, enabled: !prefs.enabled };
    setPrefs(updated);
    saveObsPrefs(updated);
  };

  const changeFormat = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const updated = { ...prefs, format: e.target.value as "text" | "json" };
    setPrefs(updated);
    saveObsPrefs(updated);
  };

  const copyPath = () => {
    navigator.clipboard.writeText(filePath).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="settings-section" style={{ marginTop: "1.5rem" }}>
      <h2>OBS Integration</h2>
      <p className="settings-description">
        Write live session stats to a text file that OBS can read as a Text (GDI+) source for stream overlays.
      </p>

      <div className="hotkey-row">
        <span className="hotkey-label">Enable OBS mode</span>
        <button className={`hotkey-btn ${prefs.enabled ? "recording" : ""}`} onClick={toggleEnabled}>
          {prefs.enabled ? "ON" : "OFF"}
        </button>
      </div>

      <div className="hotkey-row">
        <span className="hotkey-label">Output format</span>
        <select value={prefs.format} onChange={changeFormat} className="hotkey-btn">
          <option value="text">Plain Text</option>
          <option value="json">JSON</option>
        </select>
      </div>

      {prefs.enabled && filePath && (
        <>
          <div className="hotkey-row">
            <span className="hotkey-label">File path</span>
            <span className="settings-description" style={{ flex: 1, wordBreak: "break-all" }}>
              {filePath}
            </span>
          </div>
          <div className="hotkey-row">
            <span className="hotkey-label" />
            <button className="btn btn-sm" onClick={copyPath}>
              {copied ? "Copied!" : "Copy path"}
            </button>
          </div>
        </>
      )}

      <div className="settings-note">
        <strong>Tip:</strong> In OBS, add a "Text (GDI+)" source and check "Read from file", then paste the path above.
      </div>
    </div>
  );
}

function TerrorZoneSettings() {
  const [prefs, setPrefs] = useState<TerrorZonePrefs>(loadTZPrefs);

  const toggleZone = (zoneName: string) => {
    const updated = { ...prefs };
    if (updated.preferredZones.includes(zoneName)) {
      updated.preferredZones = updated.preferredZones.filter((z) => z !== zoneName);
    } else {
      updated.preferredZones = [...updated.preferredZones, zoneName];
    }
    setPrefs(updated);
    saveTZPrefs(updated);
  };

  const toggleSound = () => {
    const updated = { ...prefs, soundNotification: !prefs.soundNotification };
    setPrefs(updated);
    saveTZPrefs(updated);
  };

  return (
    <div className="settings-section" style={{ marginTop: "1.5rem" }}>
      <h2>Terror Zones</h2>
      <p className="settings-description">
        Configure preferred Terror Zones for notifications. When a preferred zone becomes active, you can receive an audio alert.
      </p>

      <div className="hotkey-row">
        <span className="hotkey-label">Sound notification</span>
        <button className={`hotkey-btn ${prefs.soundNotification ? "recording" : ""}`} onClick={toggleSound}>
          {prefs.soundNotification ? "ON" : "OFF"}
        </button>
      </div>

      <div className="tz-prefs-list">
        <span className="hotkey-label">Preferred zones</span>
        <div className="tz-prefs-grid">
          {TERROR_ZONES.map((tz) => (
            <label key={tz.name} className="tz-pref-item">
              <input
                type="checkbox"
                checked={prefs.preferredZones.includes(tz.name)}
                onChange={() => toggleZone(tz.name)}
              />
              <span>{tz.name}</span>
              <span className="tz-pref-tier">({tz.tier})</span>
            </label>
          ))}
        </div>
      </div>

      <div className="settings-note">
        <strong>Tip:</strong> Select zones you want to farm. When one of these zones becomes the active Terror Zone, you will be notified (if sound is enabled).
      </div>
    </div>
  );
}
