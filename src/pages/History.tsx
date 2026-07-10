import { useEffect, useState, useMemo } from "react";
import type { Profile, Run, Item } from "../types";
import { AREAS, parseTags } from "../types";
import { getItems, deleteRun, deleteItem, createItem, updateRunArea, getRunsPaginated, getStats } from "../api";
import { PREDEFINED_TAGS } from "../components/QuickTags";
import type { GameItem } from "../data/items";
import ItemSearch from "../components/ItemSearch";
import TierBadge from "../components/TierBadge";
import type { TierName } from "../data/item-values";
import { getItemTierName, TIER_NAMES, TIERS } from "../data/item-values";
import SessionTimeline from "../components/SessionTimeline";

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
  const [areaTotals, setAreaTotals] = useState<Record<string, number>>({});
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [timelineSession, setTimelineSession] = useState<{ runs: Run[]; items: Item[] } | null>(null);

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

  // Load area totals for correct run numbering
  const loadAreaTotals = async () => {
    const stats = await getStats(profile.id);
    const totals: Record<string, number> = {};
    for (const entry of stats.runs_by_area) {
      totals[entry.area] = entry.count;
    }
    setAreaTotals(totals);
  };

  useEffect(() => {
    loadRuns();
    loadAreaTotals();
  }, [profile.id]);

  // Group consecutive runs into sessions (gap > 10 min = new session)
  const SESSION_GAP_MS = 10 * 60 * 1000;
  const sessions = useMemo(() => {
    if (runs.length === 0) return [];
    const sorted = [...runs].sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime());
    const groups: Run[][] = [[sorted[0]]];
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      const prevEnd = prev.finished_at ? new Date(prev.finished_at).getTime() : new Date(prev.started_at).getTime() + prev.duration_secs * 1000;
      const currStart = new Date(curr.started_at).getTime();
      if (currStart - prevEnd > SESSION_GAP_MS) {
        groups.push([curr]);
      } else {
        groups[groups.length - 1].push(curr);
      }
    }
    return groups;
  }, [runs]);

  // Find which session a run belongs to
  const getSessionForRun = (runId: string): Run[] | null => {
    for (const session of sessions) {
      if (session.some((r) => r.id === runId)) {
        return session;
      }
    }
    return null;
  };

  const handleShowTimeline = async (runId: string) => {
    const session = getSessionForRun(runId);
    if (!session || session.length < 2) return;
    // Load all items for runs in this session
    const allItems: Item[] = [];
    for (const run of session) {
      if (runItems[run.id]) {
        allItems.push(...runItems[run.id]);
      } else {
        const items = await getItems(run.id);
        allItems.push(...items);
      }
    }
    setTimelineSession({ runs: session, items: allItems });
  };

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

  // Compute run number per area using global totals
  // Runs are in DESC order (newest first), so the first run of each area = total for that area
  // and each subsequent run decrements
  const runNumbers = useMemo(() => {
    const numbers: Record<string, number> = {};
    const counters: Record<string, number> = {};
    for (const run of runs) {
      if (counters[run.area] === undefined) {
        counters[run.area] = areaTotals[run.area] || 0;
      }
      numbers[run.id] = counters[run.area];
      counters[run.area]--;
    }
    return numbers;
  }, [runs, areaTotals]);

  // Collect all unique tags from loaded runs
  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const run of runs) {
      for (const tag of parseTags(run.tags)) {
        tagSet.add(tag);
      }
    }
    return Array.from(tagSet).sort();
  }, [runs]);

  // Filter runs by tag
  const filteredRuns = useMemo(() => {
    if (tagFilter === "all") return runs;
    return runs.filter((run) => parseTags(run.tags).includes(tagFilter));
  }, [runs, tagFilter]);

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
            <div className="tag-filter">
              <label htmlFor="history-tag-filter">Filter by tag:</label>
              <select
                id="history-tag-filter"
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
              >
                <option value="all">All tags</option>
                {availableTags.map((tag) => {
                  const predefined = PREDEFINED_TAGS.find((t) => t.value === tag);
                  return (
                    <option key={tag} value={tag}>{predefined ? predefined.label : tag}</option>
                  );
                })}
              </select>
            </div>
          </div>
          {filteredRuns.map((run) => (
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
                  {parseTags(run.tags).length > 0 && (
                    <span className="tag-badges">
                      {parseTags(run.tags).map((tag) => {
                        const predefined = PREDEFINED_TAGS.find((t) => t.value === tag);
                        return <span key={tag} className="tag-badge">{predefined ? predefined.label : tag}</span>;
                      })}
                    </span>
                  )}
                  <span className="history-date">
                    {new Date(run.started_at).toLocaleDateString("en-US")} {new Date(run.started_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <div className="history-item-actions">
                  {getSessionForRun(run.id) && (getSessionForRun(run.id)?.length ?? 0) >= 2 && (
                    <button
                      className="btn btn-sm"
                      onClick={(e) => { e.stopPropagation(); handleShowTimeline(run.id); }}
                    >
                      📊 Timeline
                    </button>
                  )}
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

      {/* Session Timeline Modal */}
      {timelineSession && (
        <div className="timeline-modal-overlay" onClick={() => setTimelineSession(null)}>
          <div className="timeline-modal" onClick={(e) => e.stopPropagation()}>
            <div className="timeline-modal-header">
              <h3>Session Timeline ({timelineSession.runs.length} runs)</h3>
              <button className="btn btn-sm" onClick={() => setTimelineSession(null)}>✕ Close</button>
            </div>
            <SessionTimeline
              runs={timelineSession.runs}
              items={timelineSession.items}
              sessionStartTime={timelineSession.runs[0].started_at}
              sessionEndTime={
                timelineSession.runs[timelineSession.runs.length - 1].finished_at ||
                timelineSession.runs[timelineSession.runs.length - 1].started_at
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}
