import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { register, unregisterAll } from "@tauri-apps/plugin-global-shortcut";
import { emit } from "@tauri-apps/api/event";
import { getSoundPrefs, setSoundPrefs, playSound } from "../utils/audio";
import { getObsFilePath, getKeybindProfiles, createKeybindProfile, deleteKeybindProfile, runAutoBackup, cleanupOldBackups, vacuumDatabase } from "../api";
import { open as dialogOpen } from "@tauri-apps/plugin-dialog";
import { TERROR_ZONES, loadTZPrefs, saveTZPrefs, type TerrorZonePrefs } from "../data/terror-zones";
import type { KeybindProfile } from "../types";
import CloudSyncSettings from "../components/CloudSyncSettings";
import { SUPPORTED_LOCALES, LOCALE_STORAGE_KEY } from "../i18n";

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

// Widget Preferences
export interface WidgetPrefs {
  stats: string[];
}

const WIDGET_STORAGE_KEY = "d2r_widget_prefs";

export function getWidgetPrefs(): WidgetPrefs {
  try {
    const raw = localStorage.getItem(WIDGET_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { stats: ["sessionRunCount", "sessionTime"] };
}

export function saveWidgetPrefs(prefs: WidgetPrefs) {
  localStorage.setItem(WIDGET_STORAGE_KEY, JSON.stringify(prefs));
}

export const WIDGET_STAT_OPTIONS = [
  { key: "sessionRunCount", label: "Run Count" },
  { key: "sessionTime", label: "Session Time" },
  { key: "runTimer", label: "Run Timer" },
  { key: "area", label: "Area" },
  { key: "fastestTime", label: "Fastest Time" },
  { key: "averageTime", label: "Average Time" },
  { key: "totalRuns", label: "Total Runs" },
] as const;

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

const LOCALE_LABELS: Record<string, string> = {
  'en-US': 'English (US)',
  'pt-BR': 'Português (Brasil)',
  'es': 'Español',
};

function LanguageSettings() {
  const { i18n, t } = useTranslation();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const locale = e.target.value;
    i18n.changeLanguage(locale);
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  };

  return (
    <div className="settings-section">
      <h2>{t('settings.language.title')}</h2>
      <p className="settings-description">{t('settings.language.description')}</p>
      <div className="hotkey-row">
        <span className="hotkey-label">{t('settings.language.label')}</span>
        <select value={i18n.language} onChange={handleChange} className="hotkey-btn">
          {SUPPORTED_LOCALES.map((locale) => (
            <option key={locale} value={locale}>
              {LOCALE_LABELS[locale]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export default function Settings() {
  const { t } = useTranslation();
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
      setStatus(t('settings.hotkeys.updated'));
      setTimeout(() => setStatus(null), 3000);
    });
  };

  const handleReset = () => {
    setHotkeys(DEFAULT_HOTKEYS);
    saveHotkeys(DEFAULT_HOTKEYS);
    registerHotkeys().then(() => {
      setStatus(t('settings.hotkeys.resetDone'));
      setTimeout(() => setStatus(null), 3000);
    });
  };

  return (
    <div className="page" onKeyDown={handleKeyCapture} tabIndex={0}>
      <div className="page-header">
        <h1>{t('settings.title')}</h1>
      </div>

      <LanguageSettings />

      <div className="settings-section">
        <h2>{t('settings.hotkeys.title')}</h2>
        <p className="settings-description">
          {t('settings.hotkeys.description')}
        </p>

        <div className="hotkey-list">
          <div className="hotkey-row">
            <span className="hotkey-label">{t('settings.hotkeys.nextRun')}</span>
            <button
              className={`hotkey-btn ${recording === "nextRun" ? "recording" : ""}`}
              onClick={() => handleRecord("nextRun")}
            >
              {recording === "nextRun" ? t('settings.hotkeys.pressKey') : hotkeys.nextRun}
            </button>
          </div>

          <div className="hotkey-row">
            <span className="hotkey-label">{t('settings.hotkeys.pause')}</span>
            <button
              className={`hotkey-btn ${recording === "pause" ? "recording" : ""}`}
              onClick={() => handleRecord("pause")}
            >
              {recording === "pause" ? t('settings.hotkeys.pressKey') : hotkeys.pause}
            </button>
          </div>

          <div className="hotkey-row">
            <span className="hotkey-label">{t('settings.hotkeys.endSession')}</span>
            <button
              className={`hotkey-btn ${recording === "endSession" ? "recording" : ""}`}
              onClick={() => handleRecord("endSession")}
            >
              {recording === "endSession" ? t('settings.hotkeys.pressKey') : hotkeys.endSession}
            </button>
          </div>
        </div>

        <div className="hotkey-actions">
          <button className="btn btn-sm" onClick={handleReset}>
            {t('settings.hotkeys.resetDefaults')}
          </button>
        </div>

        {status && <div className="settings-status">{status}</div>}

        <div className="settings-note">
          <strong>{t('common.tip')}:</strong> {t('settings.hotkeys.tip')}
        </div>
      </div>

      <SoundSettings />
      <KeybindProfilesSettings />
      <BackupSettings />
      <DatabaseMaintenanceSettings />
      <ObsSettings />
      <WidgetSettings />
      <TerrorZoneSettings />
      <CloudSyncSettings />
    </div>
  );
}

function KeybindProfilesSettings() {
  const { t } = useTranslation();
  const [profiles, setProfiles] = useState<KeybindProfile[]>([]);
  const [newName, setNewName] = useState("");
  const [kbStatus, setKbStatus] = useState<string | null>(null);

  useEffect(() => {
    getKeybindProfiles().then((data) => setProfiles(data || [])).catch(console.error);
  }, []);

  const handleSaveCurrentProfile = async () => {
    if (!newName.trim()) return;
    const currentBindings = JSON.stringify(loadHotkeys());
    try {
      const profile = await createKeybindProfile({ name: newName.trim(), bindings: currentBindings });
      setProfiles([profile, ...profiles]);
      setNewName("");
      setKbStatus(t('settings.keybindProfiles.saved'));
      setTimeout(() => setKbStatus(null), 3000);
    } catch (e) {
      setKbStatus("Error: " + e);
      setTimeout(() => setKbStatus(null), 3000);
    }
  };

  const handleActivate = (profile: KeybindProfile) => {
    try {
      const bindings = JSON.parse(profile.bindings);
      saveHotkeys(bindings);
      registerHotkeys().then(() => {
        setKbStatus(t('settings.keybindProfiles.activated', { name: profile.name }));
        setTimeout(() => setKbStatus(null), 3000);
      });
    } catch {
      setKbStatus("Error: invalid bindings in profile");
      setTimeout(() => setKbStatus(null), 3000);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteKeybindProfile(id);
      setProfiles(profiles.filter(p => p.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="settings-section" style={{ marginTop: "1.5rem" }}>
      <h2>{t('settings.keybindProfiles.title')}</h2>
      <p className="settings-description">
        {t('settings.keybindProfiles.description')}
      </p>

      <div className="hotkey-row">
        <input
          type="text"
          placeholder={t('settings.keybindProfiles.profileName')}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="hotkey-btn"
          style={{ flex: 1 }}
        />
        <button className="btn btn-sm" onClick={handleSaveCurrentProfile}>
          {t('settings.keybindProfiles.saveCurrent')}
        </button>
      </div>

      {profiles.length > 0 && (
        <div className="hotkey-list" style={{ marginTop: "0.75rem" }}>
          {profiles.map((p) => (
            <div className="hotkey-row" key={p.id}>
              <span className="hotkey-label">{p.name}</span>
              <button className="btn btn-sm" onClick={() => handleActivate(p)}>
                {t('settings.keybindProfiles.activate')}
              </button>
              <button className="btn btn-sm" onClick={() => handleDelete(p.id)} style={{ marginLeft: "0.5rem" }}>
                {t('settings.keybindProfiles.delete')}
              </button>
            </div>
          ))}
        </div>
      )}

      {kbStatus && <div className="settings-status">{kbStatus}</div>}

      <div className="settings-note">
        <strong>{t('common.tip')}:</strong> {t('settings.keybindProfiles.tip')}
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function DatabaseMaintenanceSettings() {
  const { t } = useTranslation();
  const [isCompacting, setIsCompacting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleVacuum = async () => {
    setIsCompacting(true);
    setResult(null);
    setError(null);
    try {
      const res = await vacuumDatabase();
      setResult(
        `Compacted: ${formatBytes(res.size_before_bytes)} → ${formatBytes(res.size_after_bytes)}`
      );
      setTimeout(() => setResult(null), 5000);
    } catch (e) {
      setError("Compact failed: " + (e instanceof Error ? e.message : String(e)));
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsCompacting(false);
    }
  };

  return (
    <div className="settings-section" style={{ marginTop: "1.5rem" }}>
      <h2>{t('settings.database.title')}</h2>
      <p className="settings-description">
        {t('settings.database.description')}
      </p>

      <div className="hotkey-actions">
        <button className="btn btn-sm" onClick={handleVacuum} disabled={isCompacting}>
          {isCompacting ? t('settings.database.compacting') : t('settings.database.compact')}
        </button>
        {isCompacting && <span className="settings-description" style={{ marginLeft: "0.5rem" }}>⏳</span>}
      </div>

      {result && <div className="settings-status">{result}</div>}
      {error && <div className="settings-status" style={{ color: "var(--color-error, #e74c3c)" }}>{error}</div>}

      <div className="settings-note">
        <strong>{t('common.tip')}:</strong> {t('settings.database.tip')}
      </div>
    </div>
  );
}

// Backup config localStorage types
interface BackupConfig {
  folderPath: string;
  keepCount: number;
  schedule: "off" | "session_end" | "daily" | "weekly";
  lastBackup: string | null;
}

const BACKUP_CONFIG_KEY = "d2r_backup_config";

export function getBackupConfig(): BackupConfig {
  const stored = localStorage.getItem(BACKUP_CONFIG_KEY);
  if (stored) {
    try { return JSON.parse(stored); } catch { /* ignore */ }
  }
  return { folderPath: "", keepCount: 10, schedule: "off", lastBackup: null };
}

export function saveBackupConfig(config: BackupConfig) {
  localStorage.setItem(BACKUP_CONFIG_KEY, JSON.stringify(config));
}

function BackupSettings() {
  const { t } = useTranslation();
  const [config, setConfig] = useState<BackupConfig>(getBackupConfig);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);

  const handleChooseFolder = async () => {
    try {
      const selected = await dialogOpen({ directory: true, multiple: false });
      if (selected) {
        const updated = { ...config, folderPath: selected as string };
        setConfig(updated);
        saveBackupConfig(updated);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleBackupNow = async () => {
    if (!config.folderPath) {
      setBackupStatus(t('settings.backup.chooseFirst'));
      setTimeout(() => setBackupStatus(null), 3000);
      return;
    }
    try {
      const filePath = await runAutoBackup(config.folderPath);
      await cleanupOldBackups(config.folderPath, config.keepCount);
      const updated = { ...config, lastBackup: new Date().toISOString() };
      setConfig(updated);
      saveBackupConfig(updated);
      setBackupStatus(`Backup saved: ${filePath.split(/[/\\]/).pop()}`);
      setTimeout(() => setBackupStatus(null), 5000);
    } catch (e) {
      setBackupStatus("Backup failed: " + e);
      setTimeout(() => setBackupStatus(null), 5000);
    }
  };

  const handleKeepCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number.parseInt(e.target.value, 10);
    if (val >= 1 && val <= 100) {
      const updated = { ...config, keepCount: val };
      setConfig(updated);
      saveBackupConfig(updated);
    }
  };

  const handleScheduleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const updated = { ...config, schedule: e.target.value as BackupConfig["schedule"] };
    setConfig(updated);
    saveBackupConfig(updated);
  };

  return (
    <div className="settings-section" style={{ marginTop: "1.5rem" }}>
      <h2>{t('settings.backup.title')}</h2>
      <p className="settings-description">
        {t('settings.backup.description')}
      </p>

      <div className="hotkey-row">
        <span className="hotkey-label">{t('settings.backup.folder')}</span>
        <span className="settings-description" style={{ flex: 1, wordBreak: "break-all" }}>
          {config.folderPath || t('settings.backup.notSet')}
        </span>
        <button className="btn btn-sm" onClick={handleChooseFolder}>
          {t('settings.backup.chooseFolder')}
        </button>
      </div>

      <div className="hotkey-row">
        <span className="hotkey-label">{t('settings.backup.keepLast')}</span>
        <input
          type="number"
          min={1}
          max={100}
          value={config.keepCount}
          onChange={handleKeepCountChange}
          className="hotkey-btn"
          style={{ width: "4rem" }}
        />
        <span className="settings-description">{t('settings.backup.backups')}</span>
      </div>

      <div className="hotkey-row">
        <span className="hotkey-label">{t('settings.backup.schedule')}</span>
        <select value={config.schedule} onChange={handleScheduleChange} className="hotkey-btn">
          <option value="off">{t('settings.backup.scheduleOff')}</option>
          <option value="session_end">{t('settings.backup.scheduleSessionEnd')}</option>
          <option value="daily">{t('settings.backup.scheduleDaily')}</option>
          <option value="weekly">{t('settings.backup.scheduleWeekly')}</option>
        </select>
      </div>

      <div className="hotkey-row">
        <span className="hotkey-label">{t('settings.backup.lastBackup')}</span>
        <span className="settings-description">
          {config.lastBackup ? new Date(config.lastBackup).toLocaleString() : t('settings.backup.never')}
        </span>
      </div>

      <div className="hotkey-actions">
        <button className="btn btn-sm" onClick={handleBackupNow}>
          {t('settings.backup.backupNow')}
        </button>
      </div>

      {backupStatus && <div className="settings-status">{backupStatus}</div>}

      <div className="settings-note">
        <strong>{t('common.tip')}:</strong> {t('settings.backup.tip')}
      </div>
    </div>
  );
}

function SoundSettings() {
  const { t } = useTranslation();
  const [prefs, setPrefs] = useState(getSoundPrefs);

  const toggleEnabled = () => {
    const updated = { ...prefs, enabled: !prefs.enabled };
    setPrefs(updated);
    setSoundPrefs(updated);
  };

  const changeVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const updated = { ...prefs, volume: Number.parseInt(e.target.value) };
    setPrefs(updated);
    setSoundPrefs(updated);
  };

  return (
    <div className="settings-section" style={{ marginTop: "1.5rem" }}>
      <h2>{t('settings.sound.title')}</h2>
      <p className="settings-description">
        {t('settings.sound.description')}
      </p>

      <div className="hotkey-row">
        <span className="hotkey-label">{t('settings.sound.enable')}</span>
        <button className={`hotkey-btn ${prefs.enabled ? "recording" : ""}`} onClick={toggleEnabled}>
          {prefs.enabled ? t('settings.sound.on') : t('settings.sound.off')}
        </button>
      </div>

      <div className="hotkey-row">
        <span className="hotkey-label">{t('settings.sound.volume')}</span>
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
        <span className="hotkey-label">{t('settings.sound.test')}</span>
        <div className="sound-test-btns">
          <button className="btn btn-sm" onClick={() => playSound("item")}>{t('settings.sound.item')}</button>
          <button className="btn btn-sm" onClick={() => playSound("milestone")}>{t('settings.sound.milestone')}</button>
          <button className="btn btn-sm" onClick={() => playSound("alert")}>{t('settings.sound.alert')}</button>
          <button className="btn btn-sm" onClick={() => playSound("goal")}>{t('settings.sound.goal')}</button>
        </div>
      </div>

      <div className="settings-note">
        <strong>{t('settings.sound.triggers')}</strong>
      </div>
    </div>
  );
}

function ObsSettings() {
  const { t } = useTranslation();
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
      <h2>{t('settings.obs.title')}</h2>
      <p className="settings-description">
        {t('settings.obs.description')}
      </p>

      <div className="hotkey-row">
        <span className="hotkey-label">{t('settings.obs.enable')}</span>
        <button className={`hotkey-btn ${prefs.enabled ? "recording" : ""}`} onClick={toggleEnabled}>
          {prefs.enabled ? t('common.on') : t('common.off')}
        </button>
      </div>

      <div className="hotkey-row">
        <span className="hotkey-label">{t('settings.obs.format')}</span>
        <select value={prefs.format} onChange={changeFormat} className="hotkey-btn">
          <option value="text">{t('settings.obs.plainText')}</option>
          <option value="json">JSON</option>
        </select>
      </div>

      {prefs.enabled && filePath && (
        <>
          <div className="hotkey-row">
            <span className="hotkey-label">{t('settings.obs.filePath')}</span>
            <span className="settings-description" style={{ flex: 1, wordBreak: "break-all" }}>
              {filePath}
            </span>
          </div>
          <div className="hotkey-row">
            <span className="hotkey-label" />
            <button className="btn btn-sm" onClick={copyPath}>
              {copied ? t('settings.obs.copied') : t('settings.obs.copyPath')}
            </button>
          </div>
        </>
      )}

      <div className="settings-note">
        <strong>{t('common.tip')}:</strong> {t('settings.obs.tip')}
      </div>
    </div>
  );
}

function WidgetSettings() {
  const { t } = useTranslation();
  const [prefs, setPrefs] = useState<WidgetPrefs>(() => getWidgetPrefs());

  const handleToggle = (key: string) => {
    const current = prefs.stats;
    let newStats: string[];
    if (current.includes(key)) {
      // Don't allow less than 2 stats
      if (current.length <= 2) return;
      newStats = current.filter(s => s !== key);
    } else {
      // Don't allow more than 3 stats
      if (current.length >= 3) return;
      newStats = [...current, key];
    }
    const newPrefs = { stats: newStats };
    setPrefs(newPrefs);
    saveWidgetPrefs(newPrefs);
  };

  return (
    <div className="settings-section" style={{ marginTop: "1.5rem" }}>
      <h2>{t('settings.widget.title')}</h2>
      <p className="settings-description">
        {t('settings.widget.description')}
      </p>
      <div className="widget-stat-options">
        {WIDGET_STAT_OPTIONS.map(opt => (
          <label key={opt.key} className="widget-stat-option">
            <input
              type="checkbox"
              checked={prefs.stats.includes(opt.key)}
              onChange={() => handleToggle(opt.key)}
              disabled={!prefs.stats.includes(opt.key) && prefs.stats.length >= 3}
            />
            <span>{opt.label}</span>
          </label>
        ))}
      </div>
      <p className="settings-hint">
        {t('settings.widget.selected', { count: prefs.stats.length })}
      </p>
    </div>
  );
}

function TerrorZoneSettings() {
  const { t } = useTranslation();
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
      <h2>{t('settings.terrorZones.title')}</h2>
      <p className="settings-description">
        {t('settings.terrorZones.description')}
      </p>

      <div className="hotkey-row">
        <span className="hotkey-label">{t('settings.terrorZones.soundNotification')}</span>
        <button className={`hotkey-btn ${prefs.soundNotification ? "recording" : ""}`} onClick={toggleSound}>
          {prefs.soundNotification ? t('common.on') : t('common.off')}
        </button>
      </div>

      <div className="tz-prefs-list">
        <span className="hotkey-label">{t('settings.terrorZones.preferredZones')}</span>
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
        <strong>{t('common.tip')}:</strong> {t('settings.terrorZones.tip')}
      </div>
    </div>
  );
}
