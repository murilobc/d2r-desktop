import { useState } from "react";
import { AREA_DATA, getTC85Areas } from "../data/areas";
import type { AreaInfo } from "../data/areas";

export default function DropCalculator() {
  const [selectedArea, setSelectedArea] = useState<AreaInfo | null>(null);
  const [filter, setFilter] = useState<"all" | "tc85" | "boss">("all");

  const filteredAreas = AREA_DATA.filter((a) => {
    if (filter === "tc85") return a.canDropAll;
    if (filter === "boss") return a.monsterTypes.includes("Super Unique Boss");
    return true;
  });

  return (
    <div className="page">
      <div className="page-header">
        <h1>Drop Calculator</h1>
        <div className="dc-filters">
          <button className={`btn btn-sm ${filter === "all" ? "btn-primary" : ""}`} onClick={() => setFilter("all")}>All</button>
          <button className={`btn btn-sm ${filter === "tc85" ? "btn-primary" : ""}`} onClick={() => setFilter("tc85")}>TC85+</button>
          <button className={`btn btn-sm ${filter === "boss" ? "btn-primary" : ""}`} onClick={() => setFilter("boss")}>Bosses</button>
        </div>
      </div>

      <div className="dc-layout">
        <div className="dc-area-list">
          {filteredAreas.map((area) => (
            <div
              key={area.name}
              role="button"
              tabIndex={0}
              className={`dc-area-item ${selectedArea?.name === area.name ? "selected" : ""}`}
              onClick={() => setSelectedArea(area)}
              onKeyDown={(e) => { if (e.key === "Enter") setSelectedArea(area); }}
            >
              <span className="dc-area-name">{area.name}</span>
              <span className="dc-area-meta">
                Act {area.act || "?"} • alvl {area.alvl}
                {area.canDropAll && <span className="dc-badge-tc85">TC85+</span>}
              </span>
            </div>
          ))}
        </div>

        <div className="dc-detail">
          {selectedArea ? (
            <>
              <div className="dc-detail-header">
                <h2>{selectedArea.name}</h2>
                {selectedArea.canDropAll && <span className="dc-badge-tc85 large">Can drop ALL items</span>}
              </div>

              <div className="dc-info-grid">
                <div className="dc-info-card">
                  <span className="dc-info-label">Area Level</span>
                  <span className="dc-info-value">{selectedArea.alvl}</span>
                </div>
                <div className="dc-info-card">
                  <span className="dc-info-label">Treasure Class</span>
                  <span className="dc-info-value">{selectedArea.tc}</span>
                </div>
                <div className="dc-info-card">
                  <span className="dc-info-label">Act</span>
                  <span className="dc-info-value">{selectedArea.act || "Varies"}</span>
                </div>
              </div>

              <div className="dc-section">
                <h3>Monster Types</h3>
                <div className="dc-tags">
                  {selectedArea.monsterTypes.map((m) => (
                    <span key={m} className="dc-tag">{m}</span>
                  ))}
                </div>
              </div>

              <div className="dc-section">
                <h3>Notable Drops</h3>
                <div className="dc-drops-list">
                  {selectedArea.notableDrops.map((drop) => (
                    <div key={drop} className="dc-drop-item">{drop}</div>
                  ))}
                </div>
              </div>

              <div className="dc-section dc-tips">
                <h3>Tips</h3>
                <p>{selectedArea.tips}</p>
              </div>
            </>
          ) : (
            <div className="dc-empty">
              <p>Select an area to see drop information</p>
              <p className="dc-summary">
                <strong>{getTC85Areas().length}</strong> areas can drop every item in the game (TC85+)
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
