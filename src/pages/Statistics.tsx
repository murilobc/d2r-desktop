import { useEffect, useState, useMemo } from "react";
import type { Profile, Stats, DetailedRun } from "../types";
import { getStats, getDetailedRuns } from "../api";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from "recharts";

interface Props {
  profile: Profile;
}

const CHART_COLORS = [
  "#e94560", "#4ecdc4", "#ffd700", "#6060ff", "#00c400",
  "#ff8c00", "#ff69b4", "#9b59b6", "#3498db", "#2ecc71",
];

export default function Statistics({ profile }: Props) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [detailedRuns, setDetailedRuns] = useState<DetailedRun[]>([]);
  const [areaFilter, setAreaFilter] = useState<string>("All");
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    getStats(profile.id).then(setStats);
    loadDetailedRuns("All");
  }, [profile.id]);

  const loadDetailedRuns = async (area: string) => {
    const filter = area === "All" ? undefined : area;
    const data = await getDetailedRuns(profile.id, filter);
    setDetailedRuns(data);
  };

  const handleAreaChange = (area: string) => {
    setAreaFilter(area);
    loadDetailedRuns(area);
  };

  // Computed stats for filtered data
  const filteredStats = useMemo(() => {
    if (detailedRuns.length === 0) return null;

    const totalRuns = detailedRuns.length;
    const totalItems = detailedRuns.reduce((sum, dr) => sum + dr.items.length, 0);
    const durations = detailedRuns.map((dr) => dr.run.duration_secs).filter((d) => d > 0);
    const totalTime = durations.reduce((sum, d) => sum + d, 0);
    const avgTime = durations.length > 0 ? totalTime / durations.length : 0;
    const fastestTime = durations.length > 0 ? Math.min(...durations) : 0;
    const slowestTime = durations.length > 0 ? Math.max(...durations) : 0;
    const itemsPerRun = totalRuns > 0 ? totalItems / totalRuns : 0;
    const itemsPerHour = totalTime > 0 ? (totalItems / totalTime) * 3600 : 0;

    // Items by rarity
    const rarityMap: Record<string, number> = {};
    detailedRuns.forEach((dr) => {
      dr.items.forEach((item) => {
        rarityMap[item.rarity] = (rarityMap[item.rarity] || 0) + 1;
      });
    });

    // Items by name (top drops)
    const itemNameMap: Record<string, number> = {};
    detailedRuns.forEach((dr) => {
      dr.items.forEach((item) => {
        itemNameMap[item.name] = (itemNameMap[item.name] || 0) + 1;
      });
    });
    const topItems = Object.entries(itemNameMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);

    // Run duration over time (for line chart)
    const runTimeline = detailedRuns
      .filter((dr) => dr.run.duration_secs > 0)
      .reverse()
      .map((dr, idx) => ({
        run: idx + 1,
        duration: dr.run.duration_secs,
        items: dr.items.length,
      }));

    return {
      totalRuns,
      totalItems,
      totalTime,
      avgTime,
      fastestTime,
      slowestTime,
      itemsPerRun,
      itemsPerHour,
      rarityData: Object.entries(rarityMap).map(([rarity, count]) => ({ name: rarity, value: count })),
      topItems,
      runTimeline,
    };
  }, [detailedRuns]);

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const formatTimeFull = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Available areas (only those with runs)
  const availableAreas = useMemo(() => {
    if (!stats) return [];
    return stats.runs_by_area.map((a) => a.area);
  }, [stats]);

  if (!stats) return <div className="page"><p>Carregando...</p></div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Estatísticas</h1>
        <div className="stats-header-actions">
          <select
            value={areaFilter}
            onChange={(e) => handleAreaChange(e.target.value)}
            className="stats-area-filter"
          >
            <option value="All">Todas as áreas</option>
            {availableAreas.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <button
            className={`btn ${showReport ? "btn-danger" : "btn-primary"}`}
            onClick={() => setShowReport(!showReport)}
          >
            {showReport ? "Fechar Relatório" : "📊 Relatório Detalhado"}
          </button>
        </div>
      </div>

      {filteredStats && (
        <>
          {/* Summary Cards */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{filteredStats.totalRuns}</div>
              <div className="stat-label">Total de Runs</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{filteredStats.totalItems}</div>
              <div className="stat-label">Total de Itens</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{formatTime(filteredStats.totalTime)}</div>
              <div className="stat-label">Tempo Total</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{formatTime(filteredStats.avgTime)}</div>
              <div className="stat-label">Tempo Médio</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{formatTime(filteredStats.fastestTime)}</div>
              <div className="stat-label">Mais Rápida</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{filteredStats.itemsPerRun.toFixed(1)}</div>
              <div className="stat-label">Itens/Run</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{filteredStats.itemsPerHour.toFixed(1)}</div>
              <div className="stat-label">Itens/Hora</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{formatTime(filteredStats.slowestTime)}</div>
              <div className="stat-label">Mais Lenta</div>
            </div>
          </div>

          {/* Charts */}
          <div className="charts-grid">
            {/* Run Duration Over Time */}
            {filteredStats.runTimeline.length > 1 && (
              <div className="chart-card">
                <h3>Duração por Run (Eficiência)</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={filteredStats.runTimeline}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
                    <XAxis dataKey="run" stroke="#a0a0a0" fontSize={12} />
                    <YAxis stroke="#a0a0a0" fontSize={12} tickFormatter={(v) => `${Math.floor(v / 60)}m`} />
                    <Tooltip
                      contentStyle={{ background: "#16213e", border: "1px solid #2a2a4a" }}
                      labelStyle={{ color: "#eaeaea" }}
                      formatter={(value) => [formatTime(Number(value)), "Duração"]}
                      labelFormatter={(label) => `Run #${label}`}
                    />
                    <Line type="monotone" dataKey="duration" stroke="#4ecdc4" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Items per Run Over Time */}
            {filteredStats.runTimeline.length > 1 && (
              <div className="chart-card">
                <h3>Itens por Run</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={filteredStats.runTimeline}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
                    <XAxis dataKey="run" stroke="#a0a0a0" fontSize={12} />
                    <YAxis stroke="#a0a0a0" fontSize={12} />
                    <Tooltip
                      contentStyle={{ background: "#16213e", border: "1px solid #2a2a4a" }}
                      labelStyle={{ color: "#eaeaea" }}
                      labelFormatter={(label) => `Run #${label}`}
                    />
                    <Bar dataKey="items" fill="#e94560" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Rarity Distribution Pie */}
            {filteredStats.rarityData.length > 0 && (
              <div className="chart-card">
                <h3>Distribuição por Raridade</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={filteredStats.rarityData}
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {filteredStats.rarityData.map((_, idx) => (
                        <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "#16213e", border: "1px solid #2a2a4a" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Runs by Area Bar Chart */}
            {stats.runs_by_area.length > 0 && areaFilter === "All" && (
              <div className="chart-card">
                <h3>Runs por Área</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={stats.runs_by_area} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
                    <XAxis type="number" stroke="#a0a0a0" fontSize={12} />
                    <YAxis type="category" dataKey="area" stroke="#a0a0a0" fontSize={11} width={120} />
                    <Tooltip contentStyle={{ background: "#16213e", border: "1px solid #2a2a4a" }} />
                    <Bar dataKey="count" fill="#ffd700" radius={[0, 2, 2, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Top Items Table */}
          {filteredStats.topItems.length > 0 && (
            <div className="stats-section">
              <h3>Top 10 Itens Mais Encontrados</h3>
              <table className="stats-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Item</th>
                    <th>Quantidade</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStats.topItems.map(([name, count], idx) => (
                    <tr key={name}>
                      <td>{idx + 1}</td>
                      <td>{name}</td>
                      <td>{count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Detailed Report */}
          {showReport && (
            <div className="detailed-report">
              <h2>Relatório Detalhado {areaFilter !== "All" ? `— ${areaFilter}` : ""}</h2>
              <div className="report-summary">
                <p><strong>Perfil:</strong> {profile.name} ({profile.class} - {profile.mode})</p>
                <p><strong>Filtro:</strong> {areaFilter === "All" ? "Todas as áreas" : areaFilter}</p>
                <p><strong>Período:</strong> {detailedRuns.length > 0 ? `${new Date(detailedRuns[detailedRuns.length - 1].run.started_at).toLocaleDateString("pt-BR")} — ${new Date(detailedRuns[0].run.started_at).toLocaleDateString("pt-BR")}` : "N/A"}</p>
                <p><strong>Eficiência:</strong> {filteredStats.itemsPerHour.toFixed(1)} itens/hora | {filteredStats.itemsPerRun.toFixed(2)} itens/run</p>
              </div>

              <table className="report-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Data</th>
                    <th>Área</th>
                    <th>Duração</th>
                    <th>Itens</th>
                    <th>Itens Encontrados</th>
                  </tr>
                </thead>
                <tbody>
                  {detailedRuns.map((dr, idx) => (
                    <tr key={dr.run.id}>
                      <td>{idx + 1}</td>
                      <td>{new Date(dr.run.started_at).toLocaleDateString("pt-BR")} {new Date(dr.run.started_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</td>
                      <td>{dr.run.area}</td>
                      <td className="mono">{formatTimeFull(dr.run.duration_secs)}</td>
                      <td>{dr.items.length}</td>
                      <td className="report-items-cell">
                        {dr.items.length > 0
                          ? dr.items.map((item) => item.name).join(", ")
                          : <span className="text-muted">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {filteredStats && filteredStats.totalRuns === 0 && (
        <p className="empty-state">Nenhuma run completada {areaFilter !== "All" ? `em ${areaFilter}` : ""}.</p>
      )}
    </div>
  );
}
