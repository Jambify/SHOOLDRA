import { useCallback, useRef, useState } from "react";
import { CheckCircle2, AlertTriangle, X } from "lucide-react";
import { cn } from "../lib/utils/utils";

export type ToastType = "success" | "error";

export interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

export const ToastBar: React.FC<{
  toasts: Toast[];
  remove: (id: number) => void;
}> = ({ toasts, remove }) => (
  <div className="pointer-events-none fixed right-6 bottom-6 z-50 flex flex-col gap-2">
    {toasts.map((t) => (
      <div
        key={t.id}
        className={cn(
          "rounded-brand-lg pointer-events-auto flex items-center gap-2.5 px-4 py-3 text-sm font-medium shadow-xl",
          "animate-in slide-in-from-bottom-2 duration-200",
          t.type === "success"
            ? "bg-success/10 border-success/30 text-success border"
            : "bg-danger/10 border-danger/30 text-danger border",
        )}
      >
        {t.type === "success" ? (
          <CheckCircle2 className="h-4 w-4 shrink-0" />
        ) : (
          <AlertTriangle className="h-4 w-4 shrink-0" />
        )}
        <span>{t.message}</span>
        <button
          onClick={() => remove(t.id)}
          className="ml-2 opacity-60 hover:opacity-100"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    ))}
  </div>
);

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const toast = useCallback((type: ToastType, message: string) => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(
      () => setToasts((prev) => prev.filter((t) => t.id !== id)),
      4000,
    );
  }, []);

  const removeToast = useCallback(
    (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id)),
    [],
  );

  return { toasts, toast, removeToast };
}
