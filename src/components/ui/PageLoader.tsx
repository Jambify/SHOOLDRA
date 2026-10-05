// src/components/ui/PageLoader.tsx
import React, { useEffect, useState } from "react";

const SHOW_DELAY_MS = 200;

const PageLoader: React.FC = () => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShow(true), SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  // Keep the height stable during the delay so the layout doesn't jump
  if (!show) return <div className="min-h-[60vh]" aria-hidden="true" />;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8"
    >
      <span className="sr-only">Loading page</span>
      <div className="space-y-3">
        <div className="skeleton-shimmer h-10 w-2/3 max-w-md rounded-2xl" />
        <div className="skeleton-shimmer h-4 w-1/2 max-w-sm rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="skeleton-shimmer h-36 rounded-[2rem] lg:h-44"
          />
        ))}
      </div>
      <div className="skeleton-shimmer h-64 rounded-[2rem] lg:h-80" />
    </div>
  );
};

export default PageLoader;