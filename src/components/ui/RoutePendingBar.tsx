// src/components/ui/RoutePendingBar.tsx
import React, { useEffect, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  subscribeRoutePending,
  getRoutePendingSnapshot,
} from "../../utils/lazyRoute";

const SHOW_DELAY_MS = 120;

const RoutePendingBar: React.FC = () => {
  const pending = useSyncExternalStore(
    subscribeRoutePending,
    getRoutePendingSnapshot,
    () => false,
  );
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!pending) {
      setVisible(false);
      return;
    }
    const timer = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [pending]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          aria-hidden="true"
          className="bg-brand pointer-events-none fixed top-0 left-0 z-[60] h-0.5 shadow-[0_0_8px] shadow-[#0066FF]/60"
          initial={{ width: "0%", opacity: 1 }}
          animate={{ width: "85%" }}
          exit={{ width: "100%", opacity: 0, transition: { duration: 0.25 } }}
          transition={{ duration: 6, ease: "easeOut" }}
        />
      )}
    </AnimatePresence>
  );
};

export default RoutePendingBar;