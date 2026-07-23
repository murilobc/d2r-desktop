import { useCallback } from "react";

interface BackgroundSettingsProps {
  readonly backgroundColor: string;
  readonly backgroundOpacity: number;
  readonly onColorChange: (color: string) => void;
  readonly onOpacityChange: (opacity: number) => void;
}

export default function BackgroundSettings({
  backgroundColor,
  backgroundOpacity,
  onColorChange,
  onOpacityChange,
}: BackgroundSettingsProps) {
  const handleColorPickerChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onColorChange(e.target.value);
    },
    [onColorChange]
  );

  const handleColorTextChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      // Allow typing partial hex values, only commit valid ones
      if (/^#[0-9a-fA-F]{6}$/.test(value)) {
        onColorChange(value);
      }
    },
    [onColorChange]
  );

  const handleOpacityChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = Number.parseFloat(e.target.value);
      if (Number.isFinite(value)) {
        onOpacityChange(value);
      }
    },
    [onOpacityChange]
  );

  return (
    <div className="background-settings">
      <h3 className="background-settings-title">Background</h3>

      <div className="background-settings-field">
        <label htmlFor="bg-color-picker" className="background-settings-label">
          Color
        </label>
        <div className="background-settings-color-row">
          <input
            id="bg-color-picker"
            type="color"
            className="background-settings-color-picker"
            value={backgroundColor}
            onChange={handleColorPickerChange}
            aria-label="Background color picker"
          />
          <input
            id="bg-color-text"
            type="text"
            className="background-settings-color-text"
            value={backgroundColor}
            onChange={handleColorTextChange}
            placeholder="#000000"
            maxLength={7}
            aria-label="Background color hex value"
          />
        </div>
      </div>

      <div className="background-settings-field">
        <label htmlFor="bg-opacity-slider" className="background-settings-label">
          Opacity
        </label>
        <div className="background-settings-opacity-row">
          <input
            id="bg-opacity-slider"
            type="range"
            className="background-settings-opacity-slider"
            min="0"
            max="1"
            step="0.05"
            value={backgroundOpacity}
            onChange={handleOpacityChange}
            aria-label="Background opacity"
            aria-valuemin={0}
            aria-valuemax={1}
            aria-valuenow={backgroundOpacity}
          />
          <span className="background-settings-opacity-value">
            {Math.round(backgroundOpacity * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
}
