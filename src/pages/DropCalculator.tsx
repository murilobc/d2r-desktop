import { useState, useMemo } from "react";
import { AREA_DATA, getTC85Areas } from "../data/areas";
import type { AreaInfo } from "../data/areas";
import { DROP_TABLES, adjustForMF, adjustForPlayers } from "../data/drop-probabilities";
import type { MonsterDropTable } from "../data/drop-probabilities";

export default function DropCalculator() {
  const [tab, setTab] = useState<"areas" | "rates">("areas");
  const [selectedArea, setSelectedArea] = useState<AreaInfo | null>(null);
  const [filter, setFilter] = useState<"all" | "tc85" | "boss">("all");

  // Drop rates state
  const [selectedMonster, setSelectedMonster] = useState<MonsterDropTable | null>(null);
  const [mf, setMf] = useState(300);
  const [players, setPlayers] = useState(1);
  const [monsterFilter, setMonsterFilter] = useState<"all" | "Boss" | "Super Unique" | "Area">("all");

  const filteredMonsters = DROP_TABLES.filter((m) => {
    if (monsterFilter === "all") return true;
    return m.type === monsterFilter;
  });

  const adjustedDrops = useMemo(() => {
    if (!selectedMonster) return [];
    return selectedMonster.items.map((item) => {
      let chance = item.baseChance;
      chance = adjustForMF(chance, mf, item.rarity);
      chance = adjustForPlayers(chance, players);
      return { ...item, adjustedChance: chance };
    }).sort((a, b) => a.adjustedChance - b.adjustedChance);
  }, [selectedMonster, mf, players]);

  const filteredAreas = AREA_DATA.filter((a) => {
    if (filter === "tc85") return a.canDropAll;
    if (filter === "boss") return a.monsterTypes.includes("Super Unique Boss");
    return true;
  });

  return (
    <div className="page">
      <div className="page-header">
        <h1>Drop Calculator</h1>
        <div className="dc-tabs">
          <button className={`btn btn-sm ${tab === "areas" ? "btn-primary" : ""}`} onClick={() => setTab("areas")}>Areas</button>
          <button className={`btn btn-sm ${tab === "rates" ? "btn-primary" : ""}`} onClick={() => setTab("rates")}>Drop Rates</button>
        </div>
      </div>

      {tab === "areas" ? (
        <AreaTab
          filteredAreas={filteredAreas}
          selectedArea={selectedArea}
          setSelectedArea={setSelectedArea}
          filter={filter}
          setFilter={setFilter}
        />
      ) : (
        <DropRatesTab
          filteredMonsters={filteredMonsters}
          selectedMonster={selectedMonster}
          setSelectedMonster={setSelectedMonster}
          monsterFilter={monsterFilter}
          setMonsterFilter={setMonsterFilter}
          mf={mf}
          setMf={setMf}
          players={players}
          setPlayers={setPlayers}
          adjustedDrops={adjustedDrops}
        />
      )}
    </div>
  );
}

// ===== AREAS TAB =====
function AreaTab({ filteredAreas, selectedArea, setSelectedArea, filter, setFilter }: {
  filteredAreas: AreaInfo[];
  selectedArea: AreaInfo | null;
  setSelectedArea: (a: AreaInfo) => void;
  filter: string;
  setFilter: (f: "all" | "tc85" | "boss") => void;
}) {
  return (
    <>
      <div className="dc-filters">
        <button className={`btn btn-sm ${filter === "all" ? "btn-primary" : ""}`} onClick={() => setFilter("all")}>All</button>
        <button className={`btn btn-sm ${filter === "tc85" ? "btn-primary" : ""}`} onClick={() => setFilter("tc85")}>TC85+</button>
        <button className={`btn btn-sm ${filter === "boss" ? "btn-primary" : ""}`} onClick={() => setFilter("boss")}>Bosses</button>
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
    </>
  );
}

// ===== DROP RATES TAB =====
function DropRatesTab({ filteredMonsters, selectedMonster, setSelectedMonster, monsterFilter, setMonsterFilter, mf, setMf, players, setPlayers, adjustedDrops }: {
  filteredMonsters: MonsterDropTable[];
  selectedMonster: MonsterDropTable | null;
  setSelectedMonster: (m: MonsterDropTable) => void;
  monsterFilter: string;
  setMonsterFilter: (f: "all" | "Boss" | "Super Unique" | "Area") => void;
  mf: number;
  setMf: (v: number) => void;
  players: number;
  setPlayers: (v: number) => void;
  adjustedDrops: Array<{ item: string; rarity: string; baseChance: number; mfAffected: boolean; adjustedChance: number }>;
}) {
  return (
    <>
      <div className="dc-rates-config">
        <div className="dc-config-row">
          <div className="dc-config-item">
            <label>Magic Find:</label>
            <input type="number" min={0} max={9999} value={mf} onChange={(e) => setMf(Number(e.target.value) || 0)} />
            <span className="dc-config-suffix">%</span>
          </div>
          <div className="dc-config-item">
            <label>Players:</label>
            <select value={players} onChange={(e) => setPlayers(Number(e.target.value))}>
              {[1,2,3,4,5,6,7,8].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <div className="dc-config-item">
            <label>Type:</label>
            <select value={monsterFilter} onChange={(e) => setMonsterFilter(e.target.value as "all" | "Boss" | "Super Unique" | "Area")}>
              <option value="all">All</option>
              <option value="Boss">Bosses</option>
              <option value="Super Unique">Super Uniques</option>
              <option value="Area">Areas</option>
            </select>
          </div>
        </div>
      </div>

      <div className="dc-layout">
        <div className="dc-area-list">
          {filteredMonsters.map((m) => (
            <div
              key={m.monster}
              role="button"
              tabIndex={0}
              className={`dc-area-item ${selectedMonster?.monster === m.monster ? "selected" : ""}`}
              onClick={() => setSelectedMonster(m)}
              onKeyDown={(e) => { if (e.key === "Enter") setSelectedMonster(m); }}
            >
              <span className="dc-area-name">{m.monster}</span>
              <span className="dc-area-meta">
                {m.type} • {m.area}
              </span>
            </div>
          ))}
        </div>

        <div className="dc-detail">
          {selectedMonster ? (
            <>
              <div className="dc-detail-header">
                <h2>{selectedMonster.monster}</h2>
                <span className="dc-badge-tc85">{selectedMonster.tc}</span>
              </div>

              <div className="dc-info-grid">
                <div className="dc-info-card">
                  <span className="dc-info-label">Drop Rolls</span>
                  <span className="dc-info-value">{selectedMonster.drops}</span>
                </div>
                <div className="dc-info-card">
                  <span className="dc-info-label">Area</span>
                  <span className="dc-info-value" style={{ fontSize: "0.8rem" }}>{selectedMonster.area}</span>
                </div>
                <div className="dc-info-card">
                  <span className="dc-info-label">Quest Bonus</span>
                  <span className="dc-info-value">{selectedMonster.questBonus ? "Yes (2×)" : "No"}</span>
                </div>
              </div>

              <div className="dc-section">
                <h3>Drop Probabilities (MF: {mf}%, /players {players})</h3>
                <table className="dc-prob-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Rarity</th>
                      <th>Chance</th>
                      <th>Runs to find</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adjustedDrops.map((drop) => (
                      <tr key={drop.item}>
                        <td className={`dc-item-name rarity-${drop.rarity.toLowerCase()}`}>{drop.item}</td>
                        <td><span className="dc-tag">{drop.rarity}{!drop.mfAffected ? " (MF N/A)" : ""}</span></td>
                        <td className="dc-chance">1:{drop.adjustedChance.toLocaleString()}</td>
                        <td className="dc-runs">{Math.round(drop.adjustedChance * 0.63)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="dc-note">
                  "Runs to find" = runs needed for ~63% chance (1 - 1/e). Based on pre-calculated data from game files.
                  Actual results may vary. MF doesn't affect rune drops.
                </p>
              </div>
            </>
          ) : (
            <div className="dc-empty">
              <p>Select a monster to see drop probabilities</p>
              <p className="dc-summary">Adjust MF and /players to see how it affects your chances</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
