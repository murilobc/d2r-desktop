import { useState } from "react";

const STORAGE_KEY = "show_trade_values";

export function useTradeValueSettings() {
  const [showTradeValues, setShowTradeValues] = useState<boolean>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === null) return true; // default: show trade values
    return stored === "true";
  });

  const toggle = () => {
    setShowTradeValues((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  };

  return { showTradeValues, toggle };
}
