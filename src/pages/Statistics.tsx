import { useEffect, useState, useMemo } from "react";
import type { Profile, Stats, DetailedRun } from "../types";
import { getStats, getDetailedRuns } from "../api";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from "recharts";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

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

  const exportPDF = () => {
    if (!filteredStats || filteredStats.totalRuns === 0) {
      alert("No data to export. Complete some runs first.");
      return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Title
    doc.setFontSize(18);
    doc.text("D2R Tracker - Statistics Report", pageWidth / 2, 15, { align: "center" });

    // Profile info
    doc.setFontSize(10);
    doc.text(`Profile: ${profile.name} (${profile.class} - ${profile.mode})`, 14, 25);
    doc.text(`Filter: ${areaFilter === "All" ? "All areas" : areaFilter}`, 14, 30);
    const dateStr = new Date().toLocaleDateString("en-US") + " " + new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    doc.text(`Generated at: ${dateStr}`, 14, 35);

    if (detailedRuns.length > 0) {
      const firstDate = new Date(detailedRuns[detailedRuns.length - 1].run.started_at).toLocaleDateString("en-US");
      const lastDate = new Date(detailedRuns[0].run.started_at).toLocaleDateString("en-US");
      doc.text(`Period: ${firstDate} — ${lastDate}`, 14, 40);
    }

    // Summary stats
    doc.setFontSize(12);
    doc.text("Summary", 14, 50);
    doc.setFontSize(9);

    const summaryData = [
      ["Total Runs", String(filteredStats.totalRuns)],
      ["Total Items", String(filteredStats.totalItems)],
      ["Total Time", formatTime(filteredStats.totalTime)],
      ["Average Time", formatTime(filteredStats.avgTime)],
      ["Fastest Run", formatTime(filteredStats.fastestTime)],
      ["Slowest Run", formatTime(filteredStats.slowestTime)],
      ["Items/Run", filteredStats.itemsPerRun.toFixed(2)],
      ["Items/Hour", filteredStats.itemsPerHour.toFixed(1)],
    ];

    autoTable(doc, {
      startY: 53,
      head: [["Metric", "Value"]],
      body: summaryData,
      theme: "grid",
      headStyles: { fillColor: [233, 69, 96] },
      styles: { fontSize: 9 },
      margin: { left: 14 },
    });

    // Helper to get last table Y position
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const getLastY = () => (doc as any).lastAutoTable?.finalY ?? doc.internal.pageSize.getHeight() - 50;

    // Items by rarity
    if (filteredStats.rarityData.length > 0) {
      const rarityY = getLastY();
      doc.setFontSize(12);
      doc.text("Items by Rarity", 14, rarityY + 10);

      autoTable(doc, {
        startY: rarityY + 13,
        head: [["Rarity", "Count", "%"]],
        body: filteredStats.rarityData.map((r) => [
          r.name,
          String(r.value),
          `${((r.value / filteredStats.totalItems) * 100).toFixed(1)}%`,
        ]),
        theme: "grid",
        headStyles: { fillColor: [78, 205, 196] },
        styles: { fontSize: 9 },
        margin: { left: 14 },
      });
    }

    // Top items
    if (filteredStats.topItems.length > 0) {
      const topY = getLastY();
      doc.setFontSize(12);
      doc.text("Top Most Found Items", 14, topY + 10);

      autoTable(doc, {
        startY: topY + 13,
        head: [["#", "Item", "Count"]],
        body: filteredStats.topItems.map(([name, count], idx) => [
          String(idx + 1),
          name,
          String(count),
        ]),
        theme: "grid",
        headStyles: { fillColor: [255, 215, 0], textColor: [0, 0, 0] },
        styles: { fontSize: 9 },
        margin: { left: 14 },
      });
    }

    // Detailed runs table (new page)
    if (detailedRuns.length > 0) {
      doc.addPage();
      doc.setFontSize(12);
      doc.text("Detailed Report by Run", 14, 15);

      autoTable(doc, {
        startY: 20,
        head: [["#", "Date", "Area", "Duration", "Items", "Items Found"]],
        body: detailedRuns.map((dr, idx) => [
          String(idx + 1),
          new Date(dr.run.started_at).toLocaleDateString("en-US"),
          dr.run.area,
          formatTimeFull(dr.run.duration_secs),
          String(dr.items.length),
          dr.items.map((i) => i.name).join(", ") || "—",
        ]),
        theme: "grid",
        headStyles: { fillColor: [233, 69, 96] },
        styles: { fontSize: 7, cellWidth: "wrap" },
        columnStyles: {
          0: { cellWidth: 10 },
          1: { cellWidth: 22 },
          2: { cellWidth: 30 },
          3: { cellWidth: 20 },
          4: { cellWidth: 12 },
          5: { cellWidth: "auto" },
        },
        margin: { left: 14 },
      });
    }

    // Save
    const filename = `d2r_report_${profile.name}_${areaFilter === "All" ? "all" : areaFilter}_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(filename);
  };

  if (!stats) return <div className="page"><p>Loading...</p></div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Statistics</h1>
        <div className="stats-header-actions">
          <select
            value={areaFilter}
            onChange={(e) => handleAreaChange(e.target.value)}
            className="stats-area-filter"
          >
            <option value="All">All areas</option>
            {availableAreas.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <button
            className={`btn ${showReport ? "btn-danger" : "btn-primary"}`}
            onClick={() => setShowReport(!showReport)}
          >
            {showReport ? "Close Report" : "📊 Detailed Report"}
          </button>
          <button className="btn btn-export" onClick={exportPDF}>
            📄 Export PDF
          </button>
        </div>
      </div>

      {filteredStats && (
        <>
          {/* Summary Cards */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{filteredStats.totalRuns}</div>
              <div className="stat-label">Total Runs</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{filteredStats.totalItems}</div>
              <div className="stat-label">Total Items</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{formatTime(filteredStats.totalTime)}</div>
              <div className="stat-label">Total Time</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{formatTime(filteredStats.avgTime)}</div>
              <div className="stat-label">Average Time</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{formatTime(filteredStats.fastestTime)}</div>
              <div className="stat-label">Fastest</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{filteredStats.itemsPerRun.toFixed(1)}</div>
              <div className="stat-label">Items/Run</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{filteredStats.itemsPerHour.toFixed(1)}</div>
              <div className="stat-label">Items/Hour</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{formatTime(filteredStats.slowestTime)}</div>
              <div className="stat-label">Slowest</div>
            </div>
          </div>

          {/* Charts */}
          <div className="charts-grid">
            {/* Run Duration Over Time */}
            {filteredStats.runTimeline.length > 1 && (
              <div className="chart-card">
                <h3>Duration per Run (Efficiency)</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={filteredStats.runTimeline}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
                    <XAxis dataKey="run" stroke="#a0a0a0" fontSize={12} />
                    <YAxis stroke="#a0a0a0" fontSize={12} tickFormatter={(v) => `${Math.floor(v / 60)}m`} />
                    <Tooltip
                      contentStyle={{ background: "#16213e", border: "1px solid #2a2a4a" }}
                      labelStyle={{ color: "#eaeaea" }}
                      formatter={(value) => [formatTime(Number(value)), "Duration"]}
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
                <h3>Items per Run</h3>
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
                <h3>Rarity Distribution</h3>
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
                <h3>Runs by Area</h3>
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
              <h3>Top 10 Most Found Items</h3>
              <table className="stats-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Item</th>
                    <th>Count</th>
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
              <h2>Detailed Report {areaFilter !== "All" ? `— ${areaFilter}` : ""}</h2>
              <div className="report-summary">
                <p><strong>Profile:</strong> {profile.name} ({profile.class} - {profile.mode})</p>
                <p><strong>Filter:</strong> {areaFilter === "All" ? "All areas" : areaFilter}</p>
                <p><strong>Period:</strong> {detailedRuns.length > 0 ? `${new Date(detailedRuns[detailedRuns.length - 1].run.started_at).toLocaleDateString("en-US")} — ${new Date(detailedRuns[0].run.started_at).toLocaleDateString("en-US")}` : "N/A"}</p>
                <p><strong>Efficiency:</strong> {filteredStats.itemsPerHour.toFixed(1)} items/hour | {filteredStats.itemsPerRun.toFixed(2)} items/run</p>
              </div>

              <table className="report-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Date</th>
                    <th>Area</th>
                    <th>Duration</th>
                    <th>Items</th>
                    <th>Items Found</th>
                  </tr>
                </thead>
                <tbody>
                  {detailedRuns.map((dr, idx) => (
                    <tr key={dr.run.id}>
                      <td>{idx + 1}</td>
                      <td>{new Date(dr.run.started_at).toLocaleDateString("en-US")} {new Date(dr.run.started_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</td>
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
        <p className="empty-state">No completed runs {areaFilter !== "All" ? `in ${areaFilter}` : ""}.</p>
      )}
    </div>
  );
}
