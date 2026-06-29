import { useEffect, useState, useRef, useCallback } from "react";
import type { Profile, Item, Run, Route } from "../types";
import { AREAS } from "../types";
import { createRun, getRuns, finishRun, createItem, getItems, deleteItem, getCustomAreas, addCustomArea, writeObsStats, getRoutes, updateRunTags, updateRunArea } from "../api";
import { getObsPrefs } from "./Settings";
import type { GameItem } from "../data/items";
import { emit, listen } from "@tauri-apps/api/event";
import ItemSearch from "../components/ItemSearch";
import MFCalculator from "../components/MFCalculator";
import TierBadge from "../components/TierBadge";
import QuickTags from "../components/QuickTags";
import TerrorZoneDisplay from "../components/TerrorZoneDisplay";
import { isAreaInTerrorZone, loadCurrentTZ } from "../data/terror-zones";
import { playSound } from "../utils/audio";

interface Props {
  profile: Profile;
  isVisible?: boolean;
}

export default function RunTracker({ profile, isVisible = true }: Props) {
  // Session state
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionElapsed, setSessionElapsed] = useState(0);
  const [paused, setPaused] = useState(false);

  // Run state
  const [runElapsed, setRunElapsed] = useState(0);
  const [currentRun, setCurrentRun] = useState<Run | null>(null);
  const runElapsedRef = useRef(0);

  // Session stats
  const [sessionRunCount, setSessionRunCount] = useState(0);
  const [totalRunCount, setTotalRunCount] = useState(0);
  const [fastestTime, setFastestTime] = useState<number | null>(null);
  const [sessionRunTimes, setSessionRunTimes] = useState<number[]>([]);

  // Config
  const [area, setArea] = useState(() => {
    return localStorage.getItem(`d2r_last_area_${profile.id}`) || AREAS[0];
  });
  const [playerCount, setPlayerCount] = useState<number>(1);
  const [customAreas, setCustomAreas] = useState<string[]>([]);
  const [newAreaInput, setNewAreaInput] = useState("");

  // Session goals
  const [goalType, setGoalType] = useState<"none" | "runs" | "time">("none");
  const [goalValue, setGoalValue] = useState<number>(50);
  const goalReachedRef = useRef(false);

  // Route mode
  const [routeMode, setRouteMode] = useState(false);
  const [availableRoutes, setAvailableRoutes] = useState<Route[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [cycleCount, setCycleCount] = useState(0);
  const currentStepIndexRef = useRef(0);

  const updateArea = (newArea: string) => {
    setArea(newArea);
    localStorage.setItem(`d2r_last_area_${profile.id}`, newArea);
  };

  // Items
  const [items, setItems] = useState<Item[]>([]);
  const [showItemForm, setShowItemForm] = useState(false);

  // Streak tracking
  const [currentStreak, setCurrentStreak] = useState(0); // runs since last item

  // Tags
  const [runTags, setRunTags] = useState<string[]>([]);

  // Timers
  const sessionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const runTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load total run count
  useEffect(() => {
    getRuns(profile.id).then((data) => {
      const completed = data.filter((r) => r.status === "completed");
      setTotalRunCount(completed.length);
      if (completed.length > 0) {
        const fastest = Math.min(...completed.map((r) => r.duration_secs).filter((d) => d > 0));
        setFastestTime(fastest === Infinity ? null : fastest);
      }
    });
    getCustomAreas(profile.id).then((areas) => {
      setCustomAreas(areas.map((a) => a.name));
    });
    getRoutes(profile.id).then((routes) => {
      setAvailableRoutes(routes);
    });
  }, [profile.id]);

  // Reload routes when tab becomes visible (routes may have been created in Route Editor)
  useEffect(() => {
    if (isVisible) {
      getRoutes(profile.id).then((routes) => {
        setAvailableRoutes(routes);
      });
      getCustomAreas(profile.id).then((areas) => {
        setCustomAreas(areas.map((a) => a.name));
      });
    }
  }, [isVisible, profile.id]);

  const allAreas = [...AREAS.filter(a => a !== "Other"), ...customAreas, "Other"];

  // Session timer
  useEffect(() => {
    if (sessionActive && !paused) {
      sessionTimerRef.current = setInterval(() => {
        setSessionElapsed((prev) => prev + 1);
      }, 100); // 100ms for tenths display
    } else {
      if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
    }
    return () => {
      if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
    };
  }, [sessionActive, paused]);

  // Run timer
  useEffect(() => {
    if (currentRun && !paused) {
      runTimerRef.current = setInterval(() => {
        setRunElapsed((prev) => {
          const next = prev + 1;
          runElapsedRef.current = next;
          return next;
        });
      }, 100); // 100ms for tenths display
    } else {
      if (runTimerRef.current) clearInterval(runTimerRef.current);
    }
    return () => {
      if (runTimerRef.current) clearInterval(runTimerRef.current);
    };
  }, [currentRun, paused]);

  const loadItems = async (runId: string) => {
    const data = await getItems(runId);
    setItems(data);
  };

  // Start session
  const startSession = () => {
    setSessionActive(true);
    setSessionElapsed(0);
    setSessionRunCount(0);
    setSessionRunTimes([]);
    setPaused(false);
    goalReachedRef.current = false;

    if (routeMode && selectedRoute) {
      setCurrentStepIndex(0);
      currentStepIndexRef.current = 0;
      setCycleCount(0);
      updateArea(selectedRoute.areas[0]);
    }

    startNewRun();
  };

  // Start a new run within the session
  const startNewRun = useCallback(async () => {
    const run = await createRun({
      profile_id: profile.id,
      area,
      player_count: profile.mode === "Single Player" ? playerCount : undefined,
      route_id: routeMode && selectedRoute ? selectedRoute.id : undefined,
      route_step_index: routeMode && selectedRoute ? currentStepIndexRef.current : undefined,
    });
    setCurrentRun(run);
    setRunElapsed(0);
    runElapsedRef.current = 0;
    setItems([]);
    setRunTags([]);
  }, [profile.id, profile.mode, area, playerCount, routeMode, selectedRoute]);

  // Finish current run and start next (split)
  const splitRun = async () => {
    if (!currentRun) return;
    const durationSecs = Math.floor(runElapsedRef.current / 10); // use ref for current value
    await finishRun(currentRun.id, { duration_secs: durationSecs, tags: runTags.length > 0 ? runTags : undefined });

    const newTimes = [...sessionRunTimes, durationSecs];
    setSessionRunTimes(newTimes);
    setSessionRunCount((prev) => {
      const next = prev + 1;
      if (next % 10 === 0) playSound("milestone");
      return next;
    });
    setTotalRunCount((prev) => prev + 1);

    // Update fastest
    if (durationSecs > 0 && (fastestTime === null || durationSecs < fastestTime)) {
      setFastestTime(durationSecs);
    }

    // Route mode: advance step
    if (routeMode && selectedRoute) {
      const nextIndex = (currentStepIndexRef.current + 1) % selectedRoute.areas.length;
      if (nextIndex === 0) {
        setCycleCount((prev) => prev + 1);
      }
      setCurrentStepIndex(nextIndex);
      currentStepIndexRef.current = nextIndex;
      updateArea(selectedRoute.areas[nextIndex]);
    }

    // Start next run immediately
    startNewRun();
    setCurrentStreak((prev) => prev + 1);
  };

  // Pause/resume
  const togglePause = () => {
    setPaused((prev) => !prev);
  };

  // End session
  const endSession = async () => {
    if (currentRun) {
      const durationSecs = Math.floor(runElapsedRef.current / 10); // use ref for current value
      await finishRun(currentRun.id, { duration_secs: durationSecs, tags: runTags.length > 0 ? runTags : undefined });
      if (durationSecs > 0) {
        const newTimes = [...sessionRunTimes, durationSecs];
        setSessionRunTimes(newTimes);
        setSessionRunCount((prev) => prev + 1);
        setTotalRunCount((prev) => prev + 1);
        if (fastestTime === null || durationSecs < fastestTime) {
          setFastestTime(durationSecs);
        }
      }
    }
    setCurrentRun(null);
    setSessionActive(false);
    setPaused(false);
    setRunElapsed(0);
    setItems([]);
  };

  // Sync state to overlay window (emit on every tick for accurate display)
  useEffect(() => {
    // Check if goal just reached
    if (goalType !== "none" && !goalReachedRef.current) {
      const reached = goalType === "runs"
        ? sessionRunCount >= goalValue
        : Math.floor(sessionElapsed / 600) >= goalValue;
      if (reached) {
        goalReachedRef.current = true;
        playSound("goal");
      }
    }

    emit("overlay-state-update", {
      sessionActive,
      paused,
      sessionElapsed,
      runElapsed,
      sessionRunCount,
      totalRunCount,
      area,
    });
  }, [sessionActive, paused, sessionElapsed, runElapsed, sessionRunCount, totalRunCount, area]);

  // Listen for overlay actions
  useEffect(() => {
    const unlistenAction = listen<string>("overlay-action", (event) => {
      switch (event.payload) {
        case "split": splitRun(); break;
        case "pause": togglePause(); break;
        case "end": endSession(); break;
      }
    });
    const unlistenItem = listen<string>("overlay-add-item", (event) => {
      if (!currentRun) return;
      createItem({
        run_id: currentRun.id,
        profile_id: profile.id,
        name: event.payload,
        item_type: "Other",
        rarity: "Unique",
        notes: undefined,
      }).then(() => { if (currentRun) loadItems(currentRun.id); });
    });
    return () => {
      unlistenAction.then((fn) => fn());
      unlistenItem.then((fn) => fn());
    };
  }, [currentRun, profile.id]);

  const addItem = async (gameItem: GameItem) => {
    if (!currentRun) return;
    await createItem({
      run_id: currentRun.id,
      profile_id: profile.id,
      name: gameItem.name,
      item_type: gameItem.subcategory,
      rarity: gameItem.category,
      notes: undefined,
    });
    playSound("item");
    loadItems(currentRun.id);
    setCurrentStreak(0);
  };

  const removeItem = async (id: string) => {
    await deleteItem(id);
    if (currentRun) loadItems(currentRun.id);
  };

  // Format time with tenths: HH:MM:SS.T
  const formatTimeTenths = (tenths: number) => {
    const totalSecs = Math.floor(tenths / 10);
    const t = tenths % 10;
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${t}`;
  };

  // Format seconds to HH:MM:SS.0
  const formatSecs = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.0`;
  };

  // Format session time for OBS output (no tenths needed)
  const formatSessionTimeForObs = (tenths: number): string => {
    const totalSecs = Math.floor(tenths / 10);
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // OBS stats write interval
  useEffect(() => {
    const obsPrefs = getObsPrefs();
    if (!sessionActive || !obsPrefs.enabled) return;

    const interval = setInterval(() => {
      const prefs = getObsPrefs(); // re-read in case toggled during session
      if (!prefs.enabled) return;

      writeObsStats({
        runCount: sessionRunCount,
        sessionTime: formatSessionTimeForObs(sessionElapsed),
        currentArea: area,
        lastItems: items.slice(-3).reverse().map(i => i.name),
        format: prefs.format,
      }).catch(console.error);
    }, 1000);

    return () => clearInterval(interval);
  }, [sessionActive, sessionRunCount, area, items, sessionElapsed]);

  const averageTime = sessionRunTimes.length > 0
    ? Math.floor(sessionRunTimes.reduce((a, b) => a + b, 0) / sessionRunTimes.length)
    : null;

  const handleTagToggle = (tag: string) => {
    const newTags = runTags.includes(tag)
      ? runTags.filter((t) => t !== tag)
      : [...runTags, tag];
    setRunTags(newTags);
    if (currentRun) {
      updateRunTags(currentRun.id, newTags).catch(console.error);
    }
  };

  // Auto-tag run with "tz" when area matches active Terror Zone
  const autoTagTZ = (currentArea: string) => {
    const currentTZ = loadCurrentTZ();
    if (currentTZ && isAreaInTerrorZone(currentArea, currentTZ)) {
      if (!runTags.includes("tz")) {
        const newTags = [...runTags, "tz"];
        setRunTags(newTags);
        if (currentRun) {
          updateRunTags(currentRun.id, newTags).catch(console.error);
        }
      }
    }
  };

  // Check TZ match when area changes
  useEffect(() => {
    if (sessionActive && currentRun) {
      autoTagTZ(area);
    }
  }, [area, sessionActive, currentRun]);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Run Tracker</h1>
        <span className="badge">{profile.name} - {profile.class}</span>
      </div>

      {/* Terror Zone Display */}
      <TerrorZoneDisplay onTZChange={() => autoTagTZ(area)} />

      {!sessionActive ? (
        <div className="start-session-card">
          <h2>Start Session</h2>
          <div className="form-row">
            <div className="form-group">
              <label>Area</label>
              <select value={area} onChange={(e) => updateArea(e.target.value)}>
                {allAreas.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
              <div className="add-area-row">
                <input
                  type="text"
                  value={newAreaInput}
                  onChange={(e) => setNewAreaInput(e.target.value)}
                  placeholder="Add custom area..."
                  className="add-area-input"
                />
                <button
                  className="btn btn-sm"
                  onClick={async () => {
                    if (newAreaInput.trim()) {
                      await addCustomArea(profile.id, newAreaInput.trim());
                      setCustomAreas([...customAreas, newAreaInput.trim()]);
                      setNewAreaInput("");
                    }
                  }}
                  disabled={!newAreaInput.trim()}
                >+</button>
              </div>
            </div>
            {profile.mode === "Single Player" && (
              <div className="form-group">
                <label>Players</label>
                <select value={playerCount} onChange={(e) => setPlayerCount(Number(e.target.value))}>
                  {[1,2,3,4,5,6,7,8].map((n) => (
                    <option key={n} value={n}>/players {n}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Session Goal</label>
              <select value={goalType} onChange={(e) => setGoalType(e.target.value as "none" | "runs" | "time")}>
                <option value="none">No goal</option>
                <option value="runs">Run count</option>
                <option value="time">Time (minutes)</option>
              </select>
            </div>
            {goalType !== "none" && (
              <div className="form-group">
                <label>{goalType === "runs" ? "Target runs" : "Target minutes"}</label>
                <input
                  type="number"
                  min={1}
                  value={goalValue}
                  onChange={(e) => setGoalValue(Number.parseInt(e.target.value) || 1)}
                />
              </div>
            )}
          </div>
          {/* Route Mode */}
          <div className="form-row">
            <div className="form-group">
              <label>Route Mode</label>
              <div className="route-mode-toggle">
                <button
                  type="button"
                  className={`btn btn-sm ${routeMode ? "btn-primary" : ""}`}
                  onClick={() => {
                    if (availableRoutes.length === 0) return;
                    setRouteMode(!routeMode);
                    if (routeMode) setSelectedRoute(null);
                  }}
                  disabled={availableRoutes.length === 0}
                >
                  {routeMode ? "🗺️ On" : "Off"}
                </button>
                {availableRoutes.length === 0 && (
                  <small className="text-muted">Create routes in the Route Editor first</small>
                )}
                {availableRoutes.length > 0 && !routeMode && (
                  <small className="text-muted">{availableRoutes.length} route{availableRoutes.length > 1 ? "s" : ""} available</small>
                )}
              </div>
            </div>
            {routeMode && (
              <div className="form-group">
                <label htmlFor="route-select">Route</label>
                <select
                  id="route-select"
                  value={selectedRoute?.id || ""}
                  onChange={(e) => {
                    const route = availableRoutes.find((r) => r.id === e.target.value) || null;
                    setSelectedRoute(route);
                    if (route) updateArea(route.areas[0]);
                  }}
                >
                  <option value="">Select route...</option>
                  {availableRoutes.map((r) => (
                    <option key={r.id} value={r.id}>{r.name} ({r.areas.length} areas)</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <button className="btn btn-primary btn-lg" onClick={startSession}>
            ▶ Start Session
          </button>
          {profile.magic_find && <MFCalculator magicFind={profile.magic_find} />}
        </div>
      ) : (
        <div className="session-card">
          {/* Timer Display */}
          <div className="timer-panel">
            <div className="session-timer-row">
              <span className={`recording-dot ${paused ? "paused" : ""}`}>●</span>
              <span className="session-timer-label">Session time: {formatTimeTenths(sessionElapsed)}</span>
            </div>

            <div className="run-timer-display">
              {formatTimeTenths(runElapsed)}
            </div>

            <div className="run-count-display">
              ───── Run count: <span className="run-count-current">{sessionRunCount}</span>{" "}
              <span className="run-count-total">({totalRunCount})</span> ─────
            </div>

            <div className="time-stats">
              <span>Fastest time: {fastestTime !== null ? formatSecs(fastestTime) : "--:--:--.--"}</span>
              <span>Average time: {averageTime !== null ? formatSecs(averageTime) : "--:--:--.--"}</span>
              {goalType === "runs" && (
                <span className={sessionRunCount >= goalValue ? "goal-reached" : ""}>
                  Goal: {sessionRunCount}/{goalValue} runs {sessionRunCount >= goalValue ? "✓" : ""}
                </span>
              )}
              {goalType === "time" && (
                <span className={Math.floor(sessionElapsed / 600) >= goalValue ? "goal-reached" : ""}>
                  Goal: {Math.floor(sessionElapsed / 600)}/{goalValue} min {Math.floor(sessionElapsed / 600) >= goalValue ? "✓" : ""}
                </span>
              )}
              {currentStreak > 0 && (
                <span className="streak-display">Dry streak: {currentStreak} runs</span>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="tracker-controls">
            <button className="btn btn-split" onClick={splitRun} disabled={paused}>
              ⏭ Next Run
            </button>
            <button className={`btn ${paused ? "btn-resume" : "btn-pause"}`} onClick={togglePause}>
              {paused ? "▶ Resume" : "⏸ Pause"}
            </button>
            <button className="btn btn-danger" onClick={endSession}>
              ⏹ End Session
            </button>
          </div>

          {/* Route step indicator */}
          {routeMode && selectedRoute && (
            <div className="route-step-indicator">
              <span className="route-step-label">
                Step {currentStepIndex + 1}/{selectedRoute.areas.length}: <strong>{selectedRoute.areas[currentStepIndex]}</strong>
              </span>
              <span className="route-cycle-count">Cycle: {cycleCount}</span>
            </div>
          )}

          {/* Quick Tags */}
          <QuickTags activeTags={runTags} onToggle={handleTagToggle} />

          {/* Area display */}
          <div className="current-area-display">
            <span className="area-label">Area:</span>
            <select
              value={area}
              onChange={(e) => {
                const newArea = e.target.value;
                updateArea(newArea);
                // Also update the current run in the database so it's recorded correctly
                if (currentRun) {
                  updateRunArea(currentRun.id, newArea).catch(console.error);
                }
              }}
              className="area-select-inline"
            >
              {allAreas.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          {/* Items */}
          <div className="run-items">
            <div className="run-items-header">
              <h3>Items Found ({items.length})</h3>
              <button className="btn btn-sm" onClick={() => setShowItemForm(!showItemForm)}>
                {showItemForm ? "Close" : "+ Item"}
              </button>
            </div>

            {showItemForm && (
              <div className="item-form">
                <ItemSearch
                  onSelect={addItem}
                  placeholder="Search D2R item..."
                />
              </div>
            )}

            <div className="items-list">
              {items.map((item) => (
                <div key={item.id} className={`item-row rarity-${item.rarity.toLowerCase()}`}>
                  <span className="item-name">{item.name}</span>
                  <TierBadge itemName={item.name} category={item.rarity} />
                  <span className="item-type">{item.item_type}</span>
                  <span className="item-rarity">{item.rarity}</span>
                  <button className="btn-icon" onClick={() => removeItem(item.id)}>✕</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
