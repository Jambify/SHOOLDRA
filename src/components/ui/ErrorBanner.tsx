import React from "react";
import { AlertTriangle, RefreshCw, X } from "lucide-react";

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
  isRetrying?: boolean;
  onDismiss?: () => void;
  className?: string;
}

const ErrorBanner: React.FC<ErrorBannerProps> = ({
  message,
  onRetry,
  isRetrying = false,
  onDismiss,
  className = "",
}) => {
  return (
    <div
      className={`border-warn/30 bg-warn/5 text-warn flex w-full items-center gap-3 rounded-2xl border px-4 py-3 ${className}`}
      role="alert"
    >
      <AlertTriangle size={18} className="shrink-0" />
      <p className="text-textSecondary flex-1 text-sm">{message}</p>
      <div className="flex shrink-0 items-center gap-1">
        {onRetry && (
          <button
            onClick={onRetry}
            disabled={isRetrying}
            className="text-textSecondary hover:text-textPrimary flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50"
          >
            <RefreshCw
              size={14}
              className={isRetrying ? "animate-spin" : ""}
            />
            Retry
          </button>
        )}
        {onDismiss && (
          <button
            onClick={onDismiss}
            aria-label="Dismiss error"
            className="text-textDim hover:text-textPrimary rounded-lg p-1.5 transition-colors"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
};

export default ErrorBanner;
