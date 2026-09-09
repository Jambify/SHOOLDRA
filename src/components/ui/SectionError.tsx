import React from "react";
import { RefreshCw } from "lucide-react";

interface SectionErrorProps {
  message: string;
  onRetry?: () => void;
  isRetrying?: boolean;
  className?: string;
}

const SectionError: React.FC<SectionErrorProps> = ({
  message,
  onRetry,
  isRetrying = false,
  className = "",
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-4 rounded-4xl border border-borderMuted bg-bgCard p-10 text-center shadow-sm ${className}`}
    >
      <div className="bg-danger/10 flex h-14 w-14 items-center justify-center rounded-2xl shadow-sm">
        <svg
          className="text-danger h-7 w-7"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <div className="flex flex-col items-center gap-1">
        <h3 className="font-display text-xl font-bold text-textPrimary">
          Something went wrong
        </h3>
        <p className="text-textDim max-w-sm text-sm">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          disabled={isRetrying}
          className="bg-brand hover:bg-brand-light flex items-center gap-2 rounded-full px-8 py-3 text-sm font-bold text-white transition-all disabled:opacity-50 active:scale-95"
        >
          <RefreshCw
            size={16}
            className={isRetrying ? "animate-spin" : ""}
          />
          {isRetrying ? "Loading..." : "Try Again"}
        </button>
      )}
    </div>
  );
};

export default SectionError;
