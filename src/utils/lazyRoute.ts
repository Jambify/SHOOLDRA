// src/utils/lazyRoute.ts
import { lazy, type ComponentType, type LazyExoticComponent } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComponent = ComponentType<any>;
type Loader<T extends AnyComponent> = () => Promise<{ default: T }>;

export type PreloadableLazy<T extends AnyComponent> = LazyExoticComponent<T> & {
  /** Warms the chunk without showing the pending bar. Never rejects. */
  preload: () => Promise<void>;
};

// --- tiny external store: "is a route chunk blocking a navigation?" ---
let pendingCount = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

export const subscribeRoutePending = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const getRoutePendingSnapshot = () => pendingCount > 0;

/**
 * Drop-in replacement for React.lazy.
 * - Component.preload() warms the chunk (hover / focus / idle) without
 *   showing the pending bar.
 * - If a navigation renders the page before its chunk has arrived, the
 *   global pending state turns on until the chunk resolves.
 */
export function lazyRoute<T extends AnyComponent>(
  loader: Loader<T>,
): PreloadableLazy<T> {
  let promise: Promise<{ default: T }> | null = null;
  let settled = false;

  const load = () => {
    if (!promise) {
      promise = loader().then(
        (module) => {
          settled = true;
          return module;
        },
        (error) => {
          promise = null; // allow a retry after a failed download
          throw error;
        },
      );
    }
    return promise;
  };

  const Component = lazy(() => {
    if (settled) return load();
    pendingCount += 1;
    emit();
    return load().finally(() => {
      pendingCount -= 1;
      emit();
    });
  }) as PreloadableLazy<T>;

  Component.preload = () =>
    load().then(
      () => undefined,
      () => undefined,
    );

  return Component;
}