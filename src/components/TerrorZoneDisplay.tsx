import { useState, useEffect } from "react";
import {
  TERROR_ZONES,
  loadCurrentTZ,
  saveCurrentTZ,
  getTierClass,
  type TerrorZoneInfo,
} from "../data/terror-zones";

interface Props {
  readonly onTZChange?: (tzName: string | null) => void;
}

export default function TerrorZoneDisplay({ onTZChange }: Props) {
  const [selectedTZ, setSelectedTZ] = useState<string | null>(loadCurrentTZ);
  const [lastChanged, setLastChanged] = useState<Date | null>(null);
  const [elapsedMinutes, setElapsedMinutes] = useState(0);

  useEffect(() => {
    const stored = loadCurrentTZ();
    if (stored) {
      setSelectedTZ(stored);
    }
  }, []);

  // Track time since last TZ change
  useEffect(() => {
    if (!lastChanged) return;
    const interval = setInterval(() => {
      const diff = Math.floor((Date.now() - lastChanged.getTime()) / 60000);
      setElapsedMinutes(diff);
    }, 60000);
    return () => clearInterval(interval);
  }, [lastChanged]);

  const handleTZSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value || null;
    setSelectedTZ(value);
    saveCurrentTZ(value);
    setLastChanged(value ? new Date() : null);
    setElapsedMinutes(0);
    onTZChange?.(value);
  };

  const activeTZ: TerrorZoneInfo | undefined = TERROR_ZONES.find((tz) => tz.name === selectedTZ);

  return (
    <div className="terror-zone-display">
      <div className="tz-header">
        <span className="tz-icon">⚡</span>
        <label htmlFor="tz-select" className="tz-label">Terror Zone</label>
      </div>
      <div className="tz-content">
        <select
          id="tz-select"
          value={selectedTZ || ""}
          onChange={handleTZSelect}
          className="tz-select"
        >
          <option value="">None active</option>
          {TERROR_ZONES.map((tz) => (
            <option key={tz.name} value={tz.name}>
              {tz.name} ({tz.tier})
            </option>
          ))}
        </select>
        {activeTZ && (
          <div className="tz-info">
            <span className={`tz-tier-badge ${getTierClass(activeTZ.tier)}`}>
              {activeTZ.tier}
            </span>
            <span className="tz-notes">{activeTZ.notes}</span>
            {lastChanged && elapsedMinutes > 0 && (
              <span className="tz-elapsed">{elapsedMinutes}m ago</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
