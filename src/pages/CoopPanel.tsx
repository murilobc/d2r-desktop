import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { CoopSessionView, CoopItemInput } from "../types";
import { startCoopServer, stopCoopServer, joinCoopSession, leaveCoopSession, coopSplitRun, coopPause, coopEndSession, coopLogItem, getCoopState } from "../api";
import ItemSearch from "../components/ItemSearch";
import type { GameItem } from "../data/items";

export default function CoopPanel() {
  const { t } = useTranslation();
  const [state, setState] = useState<CoopSessionView | null>(null);
  const [playerName, setPlayerName] = useState(() => localStorage.getItem("d2r_coop_player_name") || "");
  const [hostIp, setHostIp] = useState("");
  const [hostPort, setHostPort] = useState("9876");
  const [sessionCode, setSessionCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showItemSearch, setShowItemSearch] = useState(false);
  const [showPerPlayer, setShowPerPlayer] = useState(false);

  // Poll state periodically
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const s = await getCoopState();
        setState(s);
      } catch {
        // ignore polling errors
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleHost = async () => {
    if (!playerName.trim()) { setError("Player name required"); return; }
    try {
      setError(null);
      localStorage.setItem("d2r_coop_player_name", playerName);
      await startCoopServer(playerName);
      const s = await getCoopState();
      setState(s);
    } catch (e) {
      setError(String(e));
    }
  };

  const handleJoin = async () => {
    if (!playerName.trim()) { setError("Player name required"); return; }
    if (!hostIp.trim()) { setError("Host IP required"); return; }
    if (!sessionCode.trim()) { setError("Session code required"); return; }
    try {
      setError(null);
      localStorage.setItem("d2r_coop_player_name", playerName);
      await joinCoopSession(hostIp, Number(hostPort) || 9876, sessionCode.toUpperCase(), playerName);
      const s = await getCoopState();
      setState(s);
    } catch (e) {
      setError(String(e));
    }
  };

  const handleStop = async () => {
    try {
      if (state?.role === "host") await stopCoopServer();
      else await leaveCoopSession();
      setState(null);
    } catch (e) {
      setError(String(e));
    }
  };

  const handleAddItem = async (gameItem: GameItem) => {
    if (!state) return;
    try {
      const item: CoopItemInput = { name: gameItem.name, item_type: gameItem.subcategory, rarity: gameItem.category };
      await coopLogItem(item, playerName);
      setShowItemSearch(false);
    } catch (e) {
      setError(String(e));
    }
  };

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Idle state — not in a co-op session
  if (!state) {
    return (
      <div className="page">
        <div className="page-header">
          <h1>{t('coop.title')}</h1>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <div className="coop-setup">
          <div className="form-group">
            <label htmlFor="coop-player-name">{t('coop.playerName')}</label>
            <input
              id="coop-player-name"
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter your name..."
            />
          </div>

          <div className="coop-actions">
            <div className="coop-host-section">
              <h3>{t('coop.host')}</h3>
              <p className="settings-description">Start a server on your machine. Share the code with friends.</p>
              <button className="btn btn-primary" onClick={handleHost} disabled={!playerName.trim()}>
                ⇌ {t('coop.host')}
              </button>
            </div>

            <div className="coop-join-section">
              <h3>{t('coop.join')}</h3>
              <p className="settings-description">Connect to a friend's session on the local network.</p>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="coop-host-ip">{t('coop.hostIp')}</label>
                  <input id="coop-host-ip" type="text" value={hostIp} onChange={(e) => setHostIp(e.target.value)} placeholder="192.168.1.x" />
                </div>
                <div className="form-group">
                  <label htmlFor="coop-port">{t('coop.port')}</label>
                  <input id="coop-port" type="text" value={hostPort} onChange={(e) => setHostPort(e.target.value)} placeholder="9876" style={{ width: "80px" }} />
                </div>
                <div className="form-group">
                  <label htmlFor="coop-code">{t('coop.sessionCode')}</label>
                  <input id="coop-code" type="text" value={sessionCode} onChange={(e) => setSessionCode(e.target.value)} placeholder="ABC123" maxLength={6} style={{ width: "100px", textTransform: "uppercase" }} />
                </div>
              </div>
              <button className="btn btn-primary" onClick={handleJoin} disabled={!playerName.trim() || !hostIp.trim() || !sessionCode.trim()}>
                → {t('coop.join')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Active session view
  const itemsPerHour = state.elapsed_secs > 0 ? (state.items.length / state.elapsed_secs) * 3600 : 0;

  // Per-player breakdown
  const playerItems = state.players.map((p) => ({
    ...p,
    items: state.items.filter((i) => i.player_name === p.name),
  }));

  return (
    <div className="page">
      <div className="page-header">
        <h1>{t('coop.title')}</h1>
        <span className="badge">{state.role === "host" ? "Hosting" : "Guest"}</span>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {/* Session Info */}
      {state.role === "host" && (
        <div className="coop-session-info">
          <span><strong>Code:</strong> {state.session_code}</span>
          <span><strong>IP:</strong> {state.host_ip}:{state.port}</span>
        </div>
      )}

      {/* Combined Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{state.run_count}</div>
          <div className="stat-label">{t('coop.runCount')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{state.items.length}</div>
          <div className="stat-label">{t('coop.items')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{formatTime(state.elapsed_secs)}</div>
          <div className="stat-label">Session Time</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{itemsPerHour.toFixed(1)}</div>
          <div className="stat-label">Items/Hour</div>
        </div>
      </div>

      {/* Connected Players */}
      <div className="coop-players">
        <h3>{t('coop.players')} ({state.players.length})</h3>
        <div className="coop-player-list">
          {state.players.map((p) => (
            <div key={p.profile_id} className={`coop-player-item ${p.status}`}>
              <span className={`coop-status-dot ${p.status}`}>●</span>
              <span className="coop-player-name">{p.name}</span>
              <span className="coop-player-items">{p.items_found} items</span>
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="tracker-controls">
        {state.role === "host" && (
          <>
            <button className="btn btn-split" onClick={() => coopSplitRun()} disabled={state.paused}>
              ⏭ {t('coop.split')}
            </button>
            <button className={`btn ${state.paused ? "btn-resume" : "btn-pause"}`} onClick={() => coopPause()}>
              {state.paused ? "▶ Resume" : `⏸ ${t('coop.pause')}`}
            </button>
            <button className="btn btn-danger" onClick={() => coopEndSession().then(() => setState(null))}>
              ⏹ {t('coop.endSession')}
            </button>
          </>
        )}
        {state.role === "guest" && (
          <>
            <button className="btn btn-sm" onClick={() => setShowItemSearch(!showItemSearch)}>
              {showItemSearch ? t('common.close') : `+ ${t('coop.logItem')}`}
            </button>
            <button className="btn btn-danger" onClick={handleStop}>
              ✕ {t('coop.leave')}
            </button>
          </>
        )}
        {state.role === "host" && (
          <button className="btn btn-sm" onClick={() => setShowItemSearch(!showItemSearch)}>
            {showItemSearch ? t('common.close') : `+ ${t('coop.logItem')}`}
          </button>
        )}
      </div>

      {showItemSearch && (
        <div className="item-form">
          <ItemSearch onSelect={handleAddItem} placeholder="Search D2R item..." />
        </div>
      )}

      {/* Item Log */}
      <div className="coop-items">
        <div className="run-items-header">
          <h3>{t('coop.items')} ({state.items.length})</h3>
          <button className="btn btn-sm" onClick={() => setShowPerPlayer(!showPerPlayer)}>
            {showPerPlayer ? t('coop.items') : t('coop.perPlayer')}
          </button>
        </div>

        {!showPerPlayer ? (
          <div className="items-list">
            {state.items.slice().reverse().map((item) => (
              <div key={item.id} className={`item-row rarity-${item.rarity.toLowerCase()}`}>
                <span className="item-name">{item.name}</span>
                <span className="item-type">{item.rarity}</span>
                <span className="coop-item-player">— {item.player_name}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="coop-per-player">
            {playerItems.map((p) => (
              <div key={p.profile_id} className="coop-player-section">
                <h4>{p.name} ({p.items.length} items)</h4>
                <div className="items-list">
                  {p.items.map((item) => (
                    <div key={item.id} className={`item-row rarity-${item.rarity.toLowerCase()}`}>
                      <span className="item-name">{item.name}</span>
                      <span className="item-type">{item.rarity}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
