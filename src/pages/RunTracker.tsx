import { useEffect, useState, useRef, useCallback } from "react";
import type { Profile } from "../types";
import { AREAS } from "../types";
import { createRun, getRuns, finishRun, createItem, getItems, deleteItem } from "../api";
import type { Item, Run } from "../types";
import type { GameItem } from "../data/items";
import ItemSearch from "../components/ItemSearch";

interface Props {
  profile: Profile;
}

export default function RunTracker({ profile }: Props) {
  // Session state
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionElapsed, setSessionElapsed] = useState(0);
  const [paused, setPaused] = useState(false);

  // Run state
  const [runElapsed, setRunElapsed] = useState(0);
  const [currentRun, setCurrentRun] = useState<Run | null>(null);

  // Session stats
  const [sessionRunCount, setSessionRunCount] = useState(0);
  const [totalRunCount, setTotalRunCount] = useState(0);
  const [fastestTime, setFastestTime] = useState<number | null>(null);
  const [sessionRunTimes, setSessionRunTimes] = useState<number[]>([]);

  // Config
  const [area, setArea] = useState(() => {
    return localStorage.getItem(`d2r_last_area_${profile.id}`) || AREAS[0];
  });

  const updateArea = (newArea: string) => {
    setArea(newArea);
    localStorage.setItem(`d2r_last_area_${profile.id}`, newArea);
  };

  // Items
  const [items, setItems] = useState<Item[]>([]);
  const [showItemForm, setShowItemForm] = useState(false);

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
  }, [profile.id]);

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
        setRunElapsed((prev) => prev + 1);
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
    startNewRun();
  };

  // Start a new run within the session
  const startNewRun = useCallback(async () => {
    const run = await createRun({ profile_id: profile.id, area });
    setCurrentRun(run);
    setRunElapsed(0);
    setItems([]);
  }, [profile.id, area]);

  // Finish current run and start next (split)
  const splitRun = async () => {
    if (!currentRun) return;
    const durationSecs = Math.floor(runElapsed / 10); // convert tenths to seconds
    await finishRun(currentRun.id, { duration_secs: durationSecs });

    const newTimes = [...sessionRunTimes, durationSecs];
    setSessionRunTimes(newTimes);
    setSessionRunCount((prev) => prev + 1);
    setTotalRunCount((prev) => prev + 1);

    // Update fastest
    if (durationSecs > 0 && (fastestTime === null || durationSecs < fastestTime)) {
      setFastestTime(durationSecs);
    }

    // Start next run immediately
    startNewRun();
  };

  // Pause/resume
  const togglePause = () => {
    setPaused((prev) => !prev);
  };

  // End session
  const endSession = async () => {
    if (currentRun) {
      const durationSecs = Math.floor(runElapsed / 10);
      await finishRun(currentRun.id, { duration_secs: durationSecs });
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
    loadItems(currentRun.id);
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

  const averageTime = sessionRunTimes.length > 0
    ? Math.floor(sessionRunTimes.reduce((a, b) => a + b, 0) / sessionRunTimes.length)
    : null;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Run Tracker</h1>
        <span className="badge">{profile.name} - {profile.class}</span>
      </div>

      {!sessionActive ? (
        <div className="start-session-card">
          <h2>Start Session</h2>
          <div className="form-row">
            <div className="form-group">
              <label>Area</label>
              <select value={area} onChange={(e) => updateArea(e.target.value)}>
                {AREAS.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
          </div>
          <button className="btn btn-primary btn-lg" onClick={startSession}>
            ▶ Start Session
          </button>
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

          {/* Area display */}
          <div className="current-area-display">
            <span className="area-label">Area:</span>
            <select
              value={area}
              onChange={(e) => updateArea(e.target.value)}
              className="area-select-inline"
            >
              {AREAS.map((a) => (
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
