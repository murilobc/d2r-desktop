import { useEffect, useState, useMemo } from "react";
import type { Profile, Run, Item } from "../types";
import { AREAS } from "../types";
import { getItems, deleteRun, deleteItem, createItem, updateRunArea, getRunsPaginated } from "../api";
import type { GameItem } from "../data/items";
import ItemSearch from "../components/ItemSearch";
import TierBadge from "../components/TierBadge";
import type { TierName } from "../data/item-values";
import { getItemTierName, TIER_NAMES, TIERS } from "../data/item-values";

interface Props {
  profile: Profile;
}

export default function History({ profile }: Props) {
  const [runs, setRuns] = useState<Run[]>([]);
  const [expandedRuns, setExpandedRuns] = useState<Set<string>>(new Set());
  const [runItems, setRunItems] = useState<Record<string, Item[]>>({});
  const [showItemSearch, setShowItemSearch] = useState<string | null>(null);
  const [editingArea, setEditingArea] = useState<string | null>(null);
  const [totalRuns, setTotalRuns] = useState(0);
  const [loading, setLoading] = useState(false);
  const [tierFilter, setTierFilter] = useState<"all" | TierName>("all");

  const PAGE_SIZE = 50;

  const loadRuns = async (append = false) => {
    setLoading(true);
    const offset = append ? runs.length : 0;
    const result = await getRunsPaginated(profile.id, offset, PAGE_SIZE);
    setTotalRuns(result.total);

    const newRuns = append ? [...runs, ...result.runs] : result.runs;
    setRuns(newRuns);

    // Load items only for the new batch and auto-expand those with items
    const batchRuns = result.runs;
    const itemResults = await Promise.all(
      batchRuns.map((run) => getItems(run.id).then((items) => ({ runId: run.id, items })))
    );

    const newItems = append ? { ...runItems } : {};
    const toExpand = append ? new Set(expandedRuns) : new Set<string>();
    for (const { runId, items } of itemResults) {
      newItems[runId] = items;
      if (items.length > 0) {
        toExpand.add(runId);
      }
    }
    setRunItems(newItems);
    setExpandedRuns(toExpand);
    setLoading(false);
  };

  useEffect(() => {
    loadRuns();
  }, [profile.id]);

  const toggleExpand = (runId: string) => {
    setExpandedRuns((prev) => {
      const next = new Set(prev);
      if (next.has(runId)) {
        next.delete(runId);
      } else {
        next.add(runId);
      }
      return next;
    });
    setShowItemSearch(null);
    setEditingArea(null);
  };

  const handleDeleteRun = async (id: string) => {
    if (confirm("Delete this run and its items?")) {
      await deleteRun(id);
      loadRuns();
    }
  };

  const handleDeleteItem = async (itemId: string, runId: string) => {
    await deleteItem(itemId);
    const items = await getItems(runId);
    setRunItems((prev) => ({ ...prev, [runId]: items }));
  };

  const handleAddItem = async (gameItem: GameItem, runId: string) => {
    await createItem({
      run_id: runId,
      profile_id: profile.id,
      name: gameItem.name,
      item_type: gameItem.subcategory,
      rarity: gameItem.category,
    });
    const items = await getItems(runId);
    setRunItems((prev) => ({ ...prev, [runId]: items }));
  };

  const handleChangeArea = async (runId: string, newArea: string) => {
    await updateRunArea(runId, newArea);
    setRuns((prev) =>
      prev.map((r) => (r.id === runId ? { ...r, area: newArea } : r))
    );
    setEditingArea(null);
  };

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Compute run number per area (chronological order), memoized
  const runNumbers = useMemo(() => {
    const numbers: Record<string, number> = {};
    const counters: Record<string, number> = {};
    const runsAsc = [...runs].reverse();
    for (const run of runsAsc) {
      counters[run.area] = (counters[run.area] || 0) + 1;
      numbers[run.id] = counters[run.area];
    }
    return numbers;
  }, [runs]);

  return (
    <div className="page">
      <div className="page-header">
        <h1>History</h1>
        <span className="badge">{profile.name} - {totalRuns} runs</span>
      </div>

      {runs.length === 0 ? (
        <p className="empty-state">No completed runs yet.</p>
      ) : (
        <div className="history-list">
          <div className="tier-filter">
            <label htmlFor="history-tier-filter">Filter by tier:</label>
            <select
              id="history-tier-filter"
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value as "all" | TierName)}
            >
              <option value="all">All tiers</option>
              {TIER_NAMES.map((t) => (
                <option key={t} value={t}>{TIERS[t].label}</option>
              ))}
            </select>
          </div>
          {runs.map((run) => (
            <div key={run.id} className="history-item">
              <div
                className="history-item-header"
                role="button"
                tabIndex={0}
                onClick={() => toggleExpand(run.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") toggleExpand(run.id); }}
              >
                <div className="history-item-info">
                  <span className="history-area">{run.area} <span className="run-number">#{runNumbers[run.id]}</span></span>
                  <span className="history-time">{formatTime(run.duration_secs)}</span>
                  {run.player_count && <span className="history-players">/p{run.player_count}</span>}
                  <span className="history-date">
                    {new Date(run.started_at).toLocaleDateString("en-US")} {new Date(run.started_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <div className="history-item-actions">
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={(e) => { e.stopPropagation(); handleDeleteRun(run.id); }}
                  >
                    Delete
                  </button>
                  <span className="expand-icon">{expandedRuns.has(run.id) ? "▼" : "▶"}</span>
                </div>
              </div>

              {expandedRuns.has(run.id) && (
                <div className="history-item-details">
                  {/* Area edit */}
                  <div className="history-edit-row">
                    <span className="edit-label">Area:</span>
                    {editingArea === run.id ? (
                      <select
                        value={run.area}
                        onChange={(e) => handleChangeArea(run.id, e.target.value)}
                        autoFocus
                        onBlur={() => setEditingArea(null)}
                      >
                        {AREAS.map((a) => (
                          <option key={a} value={a}>{a}</option>
                        ))}
                      </select>
                    ) : (
                      <span
                        className="editable-value"
                        role="button"
                        tabIndex={0}
                        onClick={() => setEditingArea(run.id)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setEditingArea(run.id); }}
                        title="Click to change"
                      >
                        {run.area} ✎
                      </span>
                    )}
                  </div>

                  {run.notes && <p className="run-notes">Notes: {run.notes}</p>}

                  {/* Items */}
                  <div className="history-items-section">
                    <div className="run-items-header">
                      <h4>Items ({runItems[run.id]?.length || 0})</h4>
                      <button
                        className="btn btn-sm"
                        onClick={() => setShowItemSearch(showItemSearch === run.id ? null : run.id)}
                      >
                        {showItemSearch === run.id ? "Close" : "+ Add Item"}
                      </button>
                    </div>

                    {showItemSearch === run.id && (
                      <div className="item-form">
                        <ItemSearch
                          onSelect={(item) => handleAddItem(item, run.id)}
                          placeholder="Search D2R item..."
                        />
                      </div>
                    )}

                    {runItems[run.id] && runItems[run.id].length > 0 ? (
                      <div className="items-list">
                        {runItems[run.id]
                          .filter((item) => tierFilter === "all" || getItemTierName(item.name, item.rarity) === tierFilter)
                          .map((item) => (
                          <div key={item.id} className={`item-row rarity-${item.rarity.toLowerCase()}`}>
                            <span className="item-name">{item.name}</span>
                            <TierBadge itemName={item.name} category={item.rarity} />
                            <span className="item-type">{item.item_type}</span>
                            <span className="item-rarity">{item.rarity}</span>
                            <button className="btn-icon" onClick={() => handleDeleteItem(item.id, run.id)}>✕</button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="empty-state-sm">No items in this run.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
          {runs.length < totalRuns && (
            <button
              className="btn btn-primary btn-lg"
              style={{ width: "100%", marginTop: "1rem" }}
              onClick={() => loadRuns(true)}
              disabled={loading}
            >
              {loading ? "Loading..." : `Load More (${runs.length}/${totalRuns})`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
