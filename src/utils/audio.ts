const STORAGE_KEY = "d2r_sound_prefs";

interface SoundPrefs {
  enabled: boolean;
  volume: number; // 0-100
}

const DEFAULT_PREFS: SoundPrefs = { enabled: true, volume: 50 };

export function getSoundPrefs(): SoundPrefs {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try { return JSON.parse(stored); } catch { /* ignore */ }
  }
  return DEFAULT_PREFS;
}

export function setSoundPrefs(prefs: SoundPrefs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

// Simple beep sounds generated via Web Audio API (no external files needed)
export function playSound(type: "milestone" | "alert" | "item" | "goal") {
  const prefs = getSoundPrefs();
  if (!prefs.enabled) return;

  const ctx = new AudioContext();
  const gain = ctx.createGain();
  gain.gain.value = prefs.volume / 100;
  gain.connect(ctx.destination);

  const osc = ctx.createOscillator();
  osc.connect(gain);

  switch (type) {
    case "milestone":
      osc.frequency.value = 880;
      osc.type = "sine";
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
      setTimeout(() => {
        const osc2 = ctx.createOscillator();
        osc2.connect(gain);
        osc2.frequency.value = 1100;
        osc2.type = "sine";
        osc2.start();
        osc2.stop(ctx.currentTime + 0.15);
      }, 150);
      break;
    case "alert":
      osc.frequency.value = 440;
      osc.type = "square";
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
      break;
    case "item":
      osc.frequency.value = 1200;
      osc.type = "sine";
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
      break;
    case "goal":
      osc.frequency.value = 660;
      osc.type = "sine";
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
      setTimeout(() => {
        const o2 = ctx.createOscillator();
        o2.connect(gain);
        o2.frequency.value = 880;
        o2.type = "sine";
        o2.start();
        o2.stop(ctx.currentTime + 0.12);
        setTimeout(() => {
          const o3 = ctx.createOscillator();
          o3.connect(gain);
          o3.frequency.value = 1100;
          o3.type = "sine";
          o3.start();
          o3.stop(ctx.currentTime + 0.2);
        }, 120);
      }, 120);
      break;
  }
}
