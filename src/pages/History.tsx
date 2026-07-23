import { useEffect, useState, useMemo, useCallback, memo } from "react";
import { useTranslation } from "react-i18next";
import { List } from "react-window";
import { useInfiniteLoader } from "react-window-infinite-loader";
import type { CSSProperties } from "react";
import type { Profile, Run, Item } from "../types";
import { AREAS, parseTags } from "../types";
import { getItems, deleteRun, deleteItem, createItem, updateRunArea, getRunsPaginated, getStats } from "../api";
import { syncRuneOnCreate, syncRuneOnDelete } from "../lib/rune-sync";
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

const ROW_HEIGHT = 56;
const OVERSCAN_COUNT = 10;
const PAGE_SIZE = 100;

interface HistoryRowProps {
  runs: Run[];
  runNumbers: Record<string, number>;
  runItems: Record<string, Item[]>;
  expandedRuns: Set<string>;
  sessions: Run[][];
  onToggleExpand: (runId: string) => void;
  onDeleteRun: (runId: string) => void;
  onShowTimeline: (runId: string) => void;
  onSelectRun: (runId: string) => void;
  selectedRunId: string | null;
}

const HistoryRow = memo(function HistoryRow({
  index,
  style,
  ariaAttributes,
  runs,
  runNumbers,
  sessions,
  onDeleteRun,
  onShowTimeline,
  onSelectRun,
  selectedRunId,
}: {
  index: number;
  style: CSSProperties;
  ariaAttributes: { "aria-posinset": number; "aria-setsize": number; role: "listitem" };
} & HistoryRowProps) {
  const { t } = useTranslation();
  const run = runs[index];
  if (!run) {
    return (
      <div style={style} {...ariaAttributes} className="history-item history-item-skeleton">
        <div className="skeleton-shimmer" style={{ width: "100%", height: "40px", borderRadius: "4px" }} />
      </div>
    );
  }

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const getSessionForRun = (runId: string): Run[] | null => {
    for (const session of sessions) {
      if (session.some((r) => r.id === runId)) {
        return session;
      }
    }
    return null;
  };

  const session = getSessionForRun(run.id);
  const isSelected = selectedRunId === run.id;

  return (
    <div style={style} {...ariaAttributes} className={`history-item${isSelected ? " history-item-selected" : ""}`}>
      <div
        className="history-item-header"
        role="button"
        tabIndex={0}
        onClick={() => onSelectRun(run.id)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSelectRun(run.id); }}
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
          {session && session.length >= 2 && (
            <button
              className="btn btn-sm"
              onClick={(e) => { e.stopPropagation(); onShowTimeline(run.id); }}
            >
              📊 {t('history.timeline')}
            </button>
          )}
          <button
            className="btn btn-sm btn-danger"
            onClick={(e) => { e.stopPropagation(); onDeleteRun(run.id); }}
          >
            {t('common.delete')}
          </button>
          <span className="expand-icon">{isSelected ? "▼" : "▶"}</span>
        </div>
      </div>
    </div>
  );
});

export default function History({ profile }: Props) {
  const { t } = useTranslation();
  const [runs, setRuns] = useState<Run[]>([]);
  const [runItems, setRunItems] = useState<Record<string, Item[]>>({});
  const [showItemSearch, setShowItemSearch] = useState<string | null>(null);
  const [editingArea, setEditingArea] = useState<string | null>(null);
  const [totalRuns, setTotalRuns] = useState(0);
  const [tierFilter, setTierFilter] = useState<"all" | TierName>("all");
  const [areaTotals, setAreaTotals] = useState<Record<string, number>>({});
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [timelineSession, setTimelineSession] = useState<{ runs: Run[]; items: Item[] } | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const isRowLoaded = useCallback((index: number) => index < runs.length, [runs.length]);

  const loadMoreRows = useCallback(async (startIndex: number, stopIndex: number) => {
    const result = await getRunsPaginated(profile.id, startIndex, stopIndex - startIndex + 1);
    setTotalRuns(result.total);

    setRuns((prev) => {
      const newRuns = [...prev];
      result.runs.forEach((run, i) => {
        newRuns[startIndex + i] = run;
      });
      return newRuns;
    });

    // Load items for the batch
    const itemResults = await Promise.all(
      result.runs.map((run) => getItems(run.id).then((items) => ({ runId: run.id, items })))
    );

    setRunItems((prev) => {
      const updated = { ...prev };
      for (const { runId, items } of itemResults) {
        updated[runId] = items;
      }
      return updated;
    });
  }, [profile.id]);

  const onRowsRendered = useInfiniteLoader({
    isRowLoaded,
    loadMoreRows,
    minimumBatchSize: PAGE_SIZE,
    rowCount: totalRuns || 1,
    threshold: 15,
  });

  // Initial load
  useEffect(() => {
    const loadInitial = async () => {
      const result = await getRunsPaginated(profile.id, 0, PAGE_SIZE);
      setTotalRuns(result.total);
      setRuns(result.runs);

      const itemResults = await Promise.all(
        result.runs.map((run) => getItems(run.id).then((items) => ({ runId: run.id, items })))
      );

      const newItems: Record<string, Item[]> = {};
      for (const { runId, items } of itemResults) {
        newItems[runId] = items;
      }
      setRunItems(newItems);

      // Auto-select first run with items
      const firstWithItems = itemResults.find(({ items }) => items.length > 0);
      if (firstWithItems) {
        setSelectedRunId(firstWithItems.runId);
      }
    };

    loadInitial();
    loadAreaTotals();
  }, [profile.id]);

  // Load area totals for correct run numbering
  const loadAreaTotals = async () => {
    const stats = await getStats(profile.id);
    const totals: Record<string, number> = {};
    for (const entry of stats.runs_by_area) {
      totals[entry.area] = entry.count;
    }
    setAreaTotals(totals);
  };

  // Group consecutive runs into sessions (gap > 10 min = new session)
  const SESSION_GAP_MS = 10 * 60 * 1000;
  const sessions = useMemo(() => {
    if (runs.length === 0) return [];
    const sorted = [...runs].filter(Boolean).sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime());
    if (sorted.length === 0) return [];
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

  const handleShowTimeline = useCallback(async (runId: string) => {
    let session: Run[] | null = null;
    for (const s of sessions) {
      if (s.some((r) => r.id === runId)) {
        session = s;
        break;
      }
    }
    if (!session || session.length < 2) return;
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
  }, [sessions, runItems]);

  const handleSelectRun = useCallback((runId: string) => {
    setSelectedRunId((prev) => prev === runId ? null : runId);
    setShowItemSearch(null);
    setEditingArea(null);
  }, []);

  const handleDeleteRun = useCallback(async (id: string) => {
    if (confirm(t('history.deleteConfirm'))) {
      await deleteRun(id);
      // Reload
      const result = await getRunsPaginated(profile.id, 0, runs.length);
      setTotalRuns(result.total);
      setRuns(result.runs);
      if (selectedRunId === id) setSelectedRunId(null);
    }
  }, [profile.id, runs.length, selectedRunId]);

  const handleDeleteItem = async (itemId: string, runId: string) => {
    // Look up item details before deletion for rune auto-sync
    const itemList = runItems[runId] || [];
    const item = itemList.find((i) => i.id === itemId);
    await deleteItem(itemId);
    if (item) {
      syncRuneOnDelete(profile.id, item.name, item.item_type, item.rarity).catch(console.warn);
    }
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
    // Auto-sync rune inventory when a rune is logged
    syncRuneOnCreate(profile.id, gameItem.name, gameItem.subcategory, gameItem.category).catch(console.warn);
    const items = await getItems(runId);
    setRunItems((prev) => ({ ...prev, [runId]: items }));
  };

  const handleChangeArea = async (runId: string, newArea: string) => {
    await updateRunArea(runId, newArea);
    setRuns((prev) =>
      prev.map((r) => (r && r.id === runId ? { ...r, area: newArea } : r))
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
  const runNumbers = useMemo(() => {
    const numbers: Record<string, number> = {};
    const counters: Record<string, number> = {};
    for (const run of runs) {
      if (!run) continue;
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
      if (!run) continue;
      for (const tag of parseTags(run.tags)) {
        tagSet.add(tag);
      }
    }
    return Array.from(tagSet).sort();
  }, [runs]);

  // Filter runs by tag - for virtualized list we filter the indices
  const filteredRuns = useMemo(() => {
    if (tagFilter === "all") return runs;
    return runs.filter((run) => run && parseTags(run.tags).includes(tagFilter));
  }, [runs, tagFilter]);

  // Compute filtered run numbers (when tag filter is active, renumber within filtered set)
  const filteredRunNumbers = useMemo(() => {
    if (tagFilter === "all") return runNumbers;
    const numbers: Record<string, number> = {};
    const counters: Record<string, number> = {};
    for (const run of filteredRuns) {
      if (!run) continue;
      if (counters[run.area] === undefined) {
        counters[run.area] = areaTotals[run.area] || 0;
      }
      numbers[run.id] = counters[run.area];
      counters[run.area]--;
    }
    return numbers;
  }, [filteredRuns, tagFilter, runNumbers, areaTotals]);

  // The selected run's detail
  const selectedRun = selectedRunId ? runs.find((r) => r && r.id === selectedRunId) : null;

  const rowProps: HistoryRowProps = useMemo(() => ({
    runs: filteredRuns,
    runNumbers: filteredRunNumbers,
    runItems,
    expandedRuns: new Set<string>(),
    sessions,
    onToggleExpand: handleSelectRun,
    onDeleteRun: handleDeleteRun,
    onShowTimeline: handleShowTimeline,
    onSelectRun: handleSelectRun,
    selectedRunId,
  }), [filteredRuns, filteredRunNumbers, runItems, sessions, handleSelectRun, handleDeleteRun, handleShowTimeline, selectedRunId]);

  const listItemCount = tagFilter === "all" ? (totalRuns || filteredRuns.length) : filteredRuns.length;

  return (
    <div className="page">
      <div className="page-header">
        <h1>{t('history.title')}</h1>
        <span className="badge">{profile.name} - {totalRuns} {t('profiles.totalRuns')}</span>
      </div>

      {runs.length === 0 && totalRuns === 0 ? (
        <p className="empty-state">{t('history.noRuns')}</p>
      ) : (
        <div className="history-list history-virtual-layout">
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

          <div className="history-virtual-container">
            <div className="history-virtual-list">
              <List
                rowComponent={HistoryRow as unknown as (props: { ariaAttributes: { "aria-posinset": number; "aria-setsize": number; role: "listitem" }; index: number; style: CSSProperties } & HistoryRowProps) => React.ReactElement | null}
                rowCount={listItemCount}
                rowHeight={ROW_HEIGHT}
                rowProps={rowProps}
                overscanCount={OVERSCAN_COUNT}
                onRowsRendered={tagFilter === "all" ? onRowsRendered : undefined}
                style={{ height: "100%", width: "100%" }}
              />
            </div>

            {/* Detail panel for selected run */}
            {selectedRun && (
              <div className="history-detail-panel">
                <div className="history-item-details">
                  <div className="detail-panel-header">
                    <h3>{selectedRun.area} #{runNumbers[selectedRun.id]} — {formatTime(selectedRun.duration_secs)}</h3>
                    <button className="btn btn-sm" onClick={() => setSelectedRunId(null)}>✕ Close</button>
                  </div>

                  {/* Area edit */}
                  <div className="history-edit-row">
                    <span className="edit-label">{t('history.area')}:</span>
                    {editingArea === selectedRun.id ? (
                      <select
                        value={selectedRun.area}
                        onChange={(e) => handleChangeArea(selectedRun.id, e.target.value)}
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
                        onClick={() => setEditingArea(selectedRun.id)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setEditingArea(selectedRun.id); }}
                        title="Click to change"
                      >
                        {selectedRun.area} ✎
                      </span>
                    )}
                  </div>

                  {selectedRun.notes && <p className="run-notes">Notes: {selectedRun.notes}</p>}

                  {/* Items */}
                  <div className="history-items-section">
                    <div className="run-items-header">
                      <h4>{t('history.items')} ({runItems[selectedRun.id]?.length || 0})</h4>
                      <button
                        className="btn btn-sm"
                        onClick={() => setShowItemSearch(showItemSearch === selectedRun.id ? null : selectedRun.id)}
                      >
                        {showItemSearch === selectedRun.id ? t('common.close') : "+ Add Item"}
                      </button>
                    </div>

                    {showItemSearch === selectedRun.id && (
                      <div className="item-form">
                        <ItemSearch
                          onSelect={(item) => handleAddItem(item, selectedRun.id)}
                          placeholder="Search D2R item..."
                        />
                      </div>
                    )}

                    {runItems[selectedRun.id] && runItems[selectedRun.id].length > 0 ? (
                      <div className="items-list">
                        {runItems[selectedRun.id]
                          .filter((item) => tierFilter === "all" || getItemTierName(item.name, item.rarity) === tierFilter)
                          .map((item) => (
                          <div key={item.id} className={`item-row rarity-${item.rarity.toLowerCase()}`}>
                            <span className="item-name">{item.name}</span>
                            <TierBadge itemName={item.name} category={item.rarity} />
                            <span className="item-type">{item.item_type}</span>
                            <span className="item-rarity">{item.rarity}</span>
                            <button className="btn-icon" onClick={() => handleDeleteItem(item.id, selectedRun.id)}>✕</button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="empty-state-sm">No items in this run.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
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
