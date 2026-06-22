import { useEffect, useState } from "react";
import type { Profile, Run, Item } from "../types";
import { AREAS } from "../types";
import { getRuns, getItems, deleteRun, deleteItem, createItem, updateRunArea } from "../api";
import type { GameItem } from "../data/items";
import ItemSearch from "../components/ItemSearch";

interface Props {
  profile: Profile;
}

export default function History({ profile }: Props) {
  const [runs, setRuns] = useState<Run[]>([]);
  const [expandedRuns, setExpandedRuns] = useState<Set<string>>(new Set());
  const [runItems, setRunItems] = useState<Record<string, Item[]>>({});
  const [showItemSearch, setShowItemSearch] = useState<string | null>(null);
  const [editingArea, setEditingArea] = useState<string | null>(null);

  const loadRuns = async () => {
    const data = await getRuns(profile.id);
    const completed = data.filter((r) => r.status === "completed");
    setRuns(completed);

    // Load items for all runs and auto-expand those with items
    const itemsMap: Record<string, Item[]> = {};
    const toExpand = new Set<string>();
    for (const run of completed) {
      const items = await getItems(run.id);
      itemsMap[run.id] = items;
      if (items.length > 0) {
        toExpand.add(run.id);
      }
    }
    setRunItems(itemsMap);
    setExpandedRuns(toExpand);
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
    if (confirm("Deletar esta run e seus itens?")) {
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

  // Compute run number per area (chronological order)
  const runNumbers: Record<string, number> = {};
  const areaCounters: Record<string, number> = {};
  // runs are DESC, so reverse to count chronologically
  const runsAsc = [...runs].reverse();
  for (const run of runsAsc) {
    areaCounters[run.area] = (areaCounters[run.area] || 0) + 1;
    runNumbers[run.id] = areaCounters[run.area];
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Histórico</h1>
        <span className="badge">{profile.name} - {runs.length} runs</span>
      </div>

      {runs.length === 0 ? (
        <p className="empty-state">Nenhuma run completada ainda.</p>
      ) : (
        <div className="history-list">
          {runs.map((run) => (
            <div key={run.id} className="history-item">
              <div className="history-item-header" onClick={() => toggleExpand(run.id)}>
                <div className="history-item-info">
                  <span className="history-area">{run.area} <span className="run-number">#{runNumbers[run.id]}</span></span>
                  <span className="history-time">{formatTime(run.duration_secs)}</span>
                  <span className="history-date">
                    {new Date(run.started_at).toLocaleDateString("pt-BR")} {new Date(run.started_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <div className="history-item-actions">
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={(e) => { e.stopPropagation(); handleDeleteRun(run.id); }}
                  >
                    Deletar
                  </button>
                  <span className="expand-icon">{expandedRuns.has(run.id) ? "▼" : "▶"}</span>
                </div>
              </div>

              {expandedRuns.has(run.id) && (
                <div className="history-item-details">
                  {/* Area edit */}
                  <div className="history-edit-row">
                    <span className="edit-label">Área:</span>
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
                        onClick={() => setEditingArea(run.id)}
                        title="Clique para alterar"
                      >
                        {run.area} ✎
                      </span>
                    )}
                  </div>

                  {run.notes && <p className="run-notes">Notas: {run.notes}</p>}

                  {/* Items */}
                  <div className="history-items-section">
                    <div className="run-items-header">
                      <h4>Itens ({runItems[run.id]?.length || 0})</h4>
                      <button
                        className="btn btn-sm"
                        onClick={() => setShowItemSearch(showItemSearch === run.id ? null : run.id)}
                      >
                        {showItemSearch === run.id ? "Fechar" : "+ Adicionar Item"}
                      </button>
                    </div>

                    {showItemSearch === run.id && (
                      <div className="item-form">
                        <ItemSearch
                          onSelect={(item) => handleAddItem(item, run.id)}
                          placeholder="Buscar item do D2R..."
                        />
                      </div>
                    )}

                    {runItems[run.id] && runItems[run.id].length > 0 ? (
                      <div className="items-list">
                        {runItems[run.id].map((item) => (
                          <div key={item.id} className={`item-row rarity-${item.rarity.toLowerCase()}`}>
                            <span className="item-name">{item.name}</span>
                            <span className="item-type">{item.item_type}</span>
                            <span className="item-rarity">{item.rarity}</span>
                            <button className="btn-icon" onClick={() => handleDeleteItem(item.id, run.id)}>✕</button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="empty-state-sm">Nenhum item nesta run.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
