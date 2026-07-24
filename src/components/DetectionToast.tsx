interface DetectionToastProps {
  readonly message: string;
  readonly onDismiss: () => void;
}

export default function DetectionToast({ message, onDismiss }: DetectionToastProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onDismiss();
    }
  };

  return (
    <div className="detection-toast" role="alert" aria-live="polite">
      <span className="detection-toast-message">{message}</span>
      <button
        className="detection-toast-close"
        type="button"
        tabIndex={0}
        aria-label="Dismiss notification"
        onClick={onDismiss}
        onKeyDown={handleKeyDown}
      >
        ✕
      </button>
    </div>
  );
}
