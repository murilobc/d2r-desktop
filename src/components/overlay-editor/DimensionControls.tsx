import { useCallback, useEffect, useState } from "react";
import { clampDimensions } from "../../overlay/overlay-profile-utils";

interface DimensionControlsProps {
  readonly width: number;
  readonly height: number;
  readonly onDimensionsChange: (width: number, height: number) => void;
}

export default function DimensionControls({
  width,
  height,
  onDimensionsChange,
}: DimensionControlsProps) {
  const [localWidth, setLocalWidth] = useState<string>(String(width));
  const [localHeight, setLocalHeight] = useState<string>(String(height));

  useEffect(() => {
    setLocalWidth(String(width));
  }, [width]);

  useEffect(() => {
    setLocalHeight(String(height));
  }, [height]);

  const commitWidth = useCallback(() => {
    const parsed = Number.parseInt(localWidth, 10);
    if (Number.isFinite(parsed)) {
      const clamped = clampDimensions(parsed, height);
      setLocalWidth(String(clamped.width));
      onDimensionsChange(clamped.width, height);
    } else {
      // Reset to current value on invalid input
      setLocalWidth(String(width));
    }
  }, [localWidth, width, height, onDimensionsChange]);

  const commitHeight = useCallback(() => {
    const parsed = Number.parseInt(localHeight, 10);
    if (Number.isFinite(parsed)) {
      const clamped = clampDimensions(width, parsed);
      setLocalHeight(String(clamped.height));
      onDimensionsChange(width, clamped.height);
    } else {
      // Reset to current value on invalid input
      setLocalHeight(String(height));
    }
  }, [localHeight, width, height, onDimensionsChange]);

  const handleWidthChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setLocalWidth(e.target.value);
    },
    []
  );

  const handleHeightChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setLocalHeight(e.target.value);
    },
    []
  );

  const handleWidthKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        commitWidth();
      }
    },
    [commitWidth]
  );

  const handleHeightKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        commitHeight();
      }
    },
    [commitHeight]
  );

  return (
    <div className="dimension-controls">
      <h3 className="dimension-controls-title">Dimensions</h3>

      <div className="dimension-controls-field">
        <label htmlFor="dimension-width" className="dimension-controls-label">
          Width
        </label>
        <div className="dimension-controls-input-row">
          <input
            id="dimension-width"
            type="number"
            className="dimension-controls-input"
            value={localWidth}
            onChange={handleWidthChange}
            onBlur={commitWidth}
            onKeyDown={handleWidthKeyDown}
            min={200}
            max={800}
            step={1}
            aria-label="Overlay width in pixels"
          />
          <span className="dimension-controls-hint">200–800 px</span>
        </div>
      </div>

      <div className="dimension-controls-field">
        <label htmlFor="dimension-height" className="dimension-controls-label">
          Height
        </label>
        <div className="dimension-controls-input-row">
          <input
            id="dimension-height"
            type="number"
            className="dimension-controls-input"
            value={localHeight}
            onChange={handleHeightChange}
            onBlur={commitHeight}
            onKeyDown={handleHeightKeyDown}
            min={100}
            max={600}
            step={1}
            aria-label="Overlay height in pixels"
          />
          <span className="dimension-controls-hint">100–600 px</span>
        </div>
      </div>
    </div>
  );
}
