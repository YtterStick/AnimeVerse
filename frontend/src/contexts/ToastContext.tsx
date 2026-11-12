import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { Check, AlertCircle, Info, X } from "lucide-react";

type ToastVariant = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = "info") => {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      setToasts((prev) => [...prev.slice(-2), { id, message, variant }]);
      window.setTimeout(() => {
        dismiss(id);
      }, 3200);
    },
    [dismiss]
  );

  const success = useCallback((message: string) => showToast(message, "success"), [showToast]);
  const error = useCallback((message: string) => showToast(message, "error"), [showToast]);
  const info = useCallback((message: string) => showToast(message, "info"), [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, success, error, info }}>
      {children}
      {toasts.length > 0 && (
        <div
          aria-live="polite"
          className="fixed bottom-5 right-5 z-[60] flex flex-col gap-2 max-w-[calc(100vw-2.5rem)] sm:max-w-sm pointer-events-none"
        >
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border backdrop-blur-xl shadow-2xl text-xs font-semibold animate-in slide-in-from-bottom-3 fade-in duration-150 ${
                toast.variant === "error"
                  ? "bg-red-950/90 border-red-500/40 text-red-100"
                  : toast.variant === "success"
                    ? "bg-card/95 border-primary/40 text-white"
                    : "bg-card/95 border-border/70 text-foreground"
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                  toast.variant === "error"
                    ? "bg-red-500/20 text-red-400"
                    : toast.variant === "success"
                      ? "bg-primary/20 text-primary"
                      : "bg-secondary text-muted-foreground"
                }`}
              >
                {toast.variant === "error" ? (
                  <AlertCircle className="w-3.5 h-3.5" />
                ) : toast.variant === "success" ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Info className="w-3.5 h-3.5" />
                )}
              </span>
              <span className="flex-1 leading-snug">{toast.message}</span>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="Dismiss notification"
                className="p-0.5 text-muted-foreground hover:text-white transition-colors shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}

