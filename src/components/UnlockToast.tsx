import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { AchievementUnlock } from "../types";

interface Props {
  readonly toast: AchievementUnlock;
  readonly onDismiss: () => void;
}

export default function UnlockToast({ toast, onDismiss }: Props) {
  const { t } = useTranslation();

  // Play milestone sound on mount
  useEffect(() => {
    new Audio("/milestone.mp3").play().catch(() => {});
  }, []);

  // Escape key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onDismiss();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onDismiss]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      onDismiss();
    }
  };

  return (
    <div
      className="unlock-toast"
      role="alert"
      aria-live="polite"
      onClick={onDismiss}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <span className="unlock-toast-icon">{toast.definition.icon}</span>
      <span className="unlock-toast-name">
        {t(`achievements.names.${toast.definition.name_key}`)}
      </span>
    </div>
  );
}
