import { useEffect, useState } from "react";
import type { Profile, Stats } from "../types";
import { getStats } from "../api";

interface Props {
  profile: Profile;
}

export default function Statistics({ profile }: Props) {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    getStats(profile.id).then(setStats);
  }, [profile.id]);

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  if (!stats) return <div className="page"><p>Carregando...</p></div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Estatísticas</h1>
        <span className="badge">{profile.name}</span>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.total_runs}</div>
          <div className="stat-label">Total de Runs</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.total_items}</div>
          <div className="stat-label">Total de Itens</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{formatTime(stats.total_time_secs)}</div>
          <div className="stat-label">Tempo Total</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{formatTime(Math.round(stats.avg_run_duration_secs))}</div>
          <div className="stat-label">Duração Média</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.items_per_run.toFixed(1)}</div>
          <div className="stat-label">Itens/Run</div>
        </div>
      </div>

      <div className="stats-tables">
        {stats.items_by_rarity.length > 0 && (
          <div className="stats-section">
            <h3>Itens por Raridade</h3>
            <table className="stats-table">
              <thead>
                <tr>
                  <th>Raridade</th>
                  <th>Quantidade</th>
                  <th>%</th>
                </tr>
              </thead>
              <tbody>
                {stats.items_by_rarity.map((r) => (
                  <tr key={r.rarity} className={`rarity-${r.rarity.toLowerCase()}`}>
                    <td>{r.rarity}</td>
                    <td>{r.count}</td>
                    <td>{((r.count / stats.total_items) * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {stats.runs_by_area.length > 0 && (
          <div className="stats-section">
            <h3>Runs por Área</h3>
            <table className="stats-table">
              <thead>
                <tr>
                  <th>Área</th>
                  <th>Quantidade</th>
                  <th>%</th>
                </tr>
              </thead>
              <tbody>
                {stats.runs_by_area.map((a) => (
                  <tr key={a.area}>
                    <td>{a.area}</td>
                    <td>{a.count}</td>
                    <td>{((a.count / stats.total_runs) * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {stats.total_runs === 0 && (
        <p className="empty-state">Complete algumas runs para ver estatísticas.</p>
      )}
    </div>
  );
}
