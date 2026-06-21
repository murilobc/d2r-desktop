import { useEffect, useState, useRef } from "react";
import type { Profile, Run, CreateItemInput } from "../types";
import { AREAS, ITEM_TYPES, RARITIES } from "../types";
import { createRun, getRuns, finishRun, createItem, getItems, deleteItem } from "../api";
import type { Item } from "../types";

interface Props {
  profile: Profile;
}

export default function RunTracker({ profile }: Props) {
  const [runs, setRuns] = useState<Run[]>([]);
  const [activeRun, setActiveRun] = useState<Run | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [area, setArea] = useState(AREAS[0]);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [showItemForm, setShowItemForm] = useState(false);
  const [itemForm, setItemForm] = useState<Omit<CreateItemInput, "run_id" | "profile_id">>({
    name: "",
    item_type: ITEM_TYPES[0],
    rarity: RARITIES[0],
  });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadRuns = async () => {
    const data = await getRuns(profile.id);
    setRuns(data.filter((r) => r.status === "completed").slice(0, 5));
    const inProgress = data.find((r) => r.status === "in_progress");
    if (inProgress) {
      setActiveRun(inProgress);
      const startTime = new Date(inProgress.started_at).getTime();
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }
  };

  const loadItems = async (runId: string) => {
    const data = await getItems(runId);
    setItems(data);
  };

  useEffect(() => {
    loadRuns();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [profile.id]);

  useEffect(() => {
    if (activeRun) {
      loadItems(activeRun.id);
      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeRun?.id]);

  const startRun = async () => {
    const run = await createRun({ profile_id: profile.id, area, notes: notes || undefined });
    setActiveRun(run);
    setElapsed(0);
    setItems([]);
    setNotes("");
  };

  const stopRun = async () => {
    if (!activeRun) return;
    await finishRun(activeRun.id, { duration_secs: elapsed, notes: notes || undefined });
    setActiveRun(null);
    setElapsed(0);
    loadRuns();
  };

  const addItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRun) return;
    await createItem({
      run_id: activeRun.id,
      profile_id: profile.id,
      name: itemForm.name,
      item_type: itemForm.item_type,
      rarity: itemForm.rarity,
      notes: itemForm.notes,
    });
    setItemForm({ name: "", item_type: ITEM_TYPES[0], rarity: RARITIES[0] });
    setShowItemForm(false);
    loadItems(activeRun.id);
  };

  const removeItem = async (id: string) => {
    await deleteItem(id);
    if (activeRun) loadItems(activeRun.id);
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
        <h1>Run Tracker</h1>
        <span className="badge">{profile.name} - {profile.class}</span>
      </div>

      {!activeRun ? (
        <div className="start-run-card">
          <h2>Iniciar Nova Run</h2>
          <div className="form-row">
            <div className="form-group">
              <label>Área</label>
              <select value={area} onChange={(e) => setArea(e.target.value)}>
                {AREAS.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Notas</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Opcional"
              />
            </div>
          </div>
          <button className="btn btn-primary btn-lg" onClick={startRun}>
            ▶ Iniciar Run
          </button>
        </div>
      ) : (
        <div className="active-run-card">
          <div className="run-timer">
            <span className="timer-display">{formatTime(elapsed)}</span>
            <span className="run-area">{activeRun.area}</span>
          </div>

          <div className="run-items">
            <div className="run-items-header">
              <h3>Itens Encontrados ({items.length})</h3>
              <button className="btn btn-sm" onClick={() => setShowItemForm(!showItemForm)}>
                + Item
              </button>
            </div>

            {showItemForm && (
              <form className="item-form" onSubmit={addItem}>
                <input
                  type="text"
                  placeholder="Nome do item"
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  required
                />
                <select
                  value={itemForm.item_type}
                  onChange={(e) => setItemForm({ ...itemForm, item_type: e.target.value })}
                >
                  {ITEM_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <select
                  value={itemForm.rarity}
                  onChange={(e) => setItemForm({ ...itemForm, rarity: e.target.value })}
                >
                  {RARITIES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <button type="submit" className="btn btn-sm btn-primary">Adicionar</button>
              </form>
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

          <button className="btn btn-danger btn-lg" onClick={stopRun}>
            ⏹ Finalizar Run
          </button>
        </div>
      )}

      {runs.length > 0 && (
        <div className="recent-runs">
          <h3>Últimas Runs</h3>
          <table className="runs-table">
            <thead>
              <tr>
                <th>Área</th>
                <th>Duração</th>
                <th>Data</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id}>
                  <td>{run.area}</td>
                  <td>{formatTime(run.duration_secs)}</td>
                  <td>{new Date(run.started_at).toLocaleDateString("pt-BR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
