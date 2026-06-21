import { useEffect, useState } from "react";
import type { Profile, Run, Item } from "../types";
import { getRuns, getItems, deleteRun } from "../api";

interface Props {
  profile: Profile;
}

export default function History({ profile }: Props) {
  const [runs, setRuns] = useState<Run[]>([]);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [runItems, setRunItems] = useState<Record<string, Item[]>>({});

  const loadRuns = async () => {
    const data = await getRuns(profile.id);
    setRuns(data.filter((r) => r.status === "completed"));
  };

  useEffect(() => {
    loadRuns();
  }, [profile.id]);

  const toggleExpand = async (runId: string) => {
    if (expandedRun === runId) {
      setExpandedRun(null);
      return;
    }
    setExpandedRun(runId);
    if (!runItems[runId]) {
      const items = await getItems(runId);
      setRunItems((prev) => ({ ...prev, [runId]: items }));
    }
  };

  const handleDeleteRun = async (id: string) => {
    if (confirm("Deletar esta run e seus itens?")) {
      await deleteRun(id);
      loadRuns();
    }
  };

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

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
                  <span className="history-area">{run.area}</span>
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
                  <span className="expand-icon">{expandedRun === run.id ? "▼" : "▶"}</span>
                </div>
              </div>

              {expandedRun === run.id && (
                <div className="history-item-details">
                  {run.notes && <p className="run-notes">Notas: {run.notes}</p>}
                  {runItems[run.id] && runItems[run.id].length > 0 ? (
                    <div className="items-list">
                      {runItems[run.id].map((item) => (
                        <div key={item.id} className={`item-row rarity-${item.rarity.toLowerCase()}`}>
                          <span className="item-name">{item.name}</span>
                          <span className="item-type">{item.item_type}</span>
                          <span className="item-rarity">{item.rarity}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="empty-state-sm">Nenhum item encontrado nesta run.</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
