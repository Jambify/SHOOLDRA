import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useUserStore } from "../Store/useUserStore";
import { supabase } from "../lib/supabase";

export type ProStatusState =
  | "active"
  | "expiring_soon"
  | "expired_natural"
  | "expired_admin_grant"
  | "revoked_early"
  | "payment_failed"
  | "inactive"
  | "none";

export type ProStatusAction =
  | "renew"
  | "contact_support"
  | "try_again"
  | null;

interface ProStatusData {
  isActive: boolean;
  status: ProStatusState;
  message: string;
  shortMessage: string;
  showAlert: boolean;
  expiresAt: Date | null;
  primaryAction: ProStatusAction;
  proRowId: string | null;
  planType: string | null;
  paymentReference: string | null;
  statusBannerDismissed: boolean;
  welcomeBannerDismissed: boolean;
}

export interface ProStatusInfo extends ProStatusData {
  /** Alias of isActive — the field name ProGate and newer gates read. */
  isPro: boolean;
  /** True until the first pro_users check for this user has resolved.
   *  Gates must show a neutral/loading state while this is true, never
   *  the paywall — otherwise Pro users flash the upgrade page on load. */
  isLoading: boolean;
  /** Re-run the pro_users check now (e.g. right after a payment activates).
   *  Resolves once the fresh result has been stored. */
  refresh: () => Promise<void>;
  dismissStatusBanner: () => Promise<void>;
  dismissWelcomeBanner: () => Promise<void>;
}

interface ProRow {
  id: string;
  status: "active" | "inactive" | "expired" | string;
  plan_type: string | null;
  payment_reference: string | null;
  expires_at: string | Date | null;
  updated_at: string | Date | null;
  created_at: string | Date | null;
  status_banner_dismissed_at: string | Date | null;
  welcome_banner_dismissed_at: string | Date | null;
}

const toDate = (v: string | Date | null): Date | null => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d;
};

const fmt = (d: Date | null): string => {
  if (!d) return "";
  try {
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return String(d);
  }
};

const MS_PER_DAY = 86_400_000;

const EMPTY_STATE: ProStatusData = {
  isActive: false,
  status: "none",
  message: "",
  shortMessage: "",
  showAlert: false,
  expiresAt: null,
  primaryAction: null,
  proRowId: null,
  planType: null,
  paymentReference: null,
  statusBannerDismissed: false,
  welcomeBannerDismissed: false,
};

// The owner account (admin_users.is_owner = true) is protected at the DB
// level by prevent_owner_pro_tamper — any UPDATE to its pro_users row is
// rejected by that trigger. Owner status is permanent and doesn't
// participate in the pro_users expiry lifecycle at all.
const OWNER_ACTIVE_STATE = (rowId: string | null): ProStatusData => ({
  isActive: true,
  status: "active",
  message: "Pro access is permanently active for this account.",
  shortMessage: "Pro Active (Owner)",
  showAlert: false,
  expiresAt: null,
  primaryAction: null,
  proRowId: rowId,
  planType: "owner",
  paymentReference: null,
  statusBannerDismissed: true,
  welcomeBannerDismissed: true,
});

/**
 * Pure-ish resolver: reads the user's newest pro_users row and turns it into
 * a ProStatusData. THROWS if the query fails, so the caller can keep the last
 * known status instead of mistaking a network error for "this user isn't Pro".
 */
const fetchProStatus = async (userId: string): Promise<ProStatusData> => {
  const { data: proRow, error } = await supabase
    .from("pro_users")
    .select(
      "id, status, plan_type, payment_reference, expires_at, updated_at, created_at, status_banner_dismissed_at, welcome_banner_dismissed_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  if (!proRow) return EMPTY_STATE;

  const row = proRow as ProRow;
  const rowId = row.id;
  const now = new Date();
  const expiresAt = toDate(row.expires_at);
  const updatedAt = toDate(row.updated_at);
  const planType = (row.plan_type ?? "").toLowerCase();
  const paymentRef = row.payment_reference ?? "";
  const isAdminGrant =
    paymentRef.startsWith("admin-grant-") || planType === "admin_grant";
  const paidPlan =
    planType === "monthly" ||
    planType === "yearly" ||
    planType === "lifetime" ||
    planType === "quarterly" ||
    planType === "annual";
  const statusBannerDismissed = !!row.status_banner_dismissed_at;
  const welcomeBannerDismissed = !!row.welcome_banner_dismissed_at;

  // Every branch shares the same row-derived fields; only these differ.
  const build = (
    fields: Pick<
      ProStatusData,
      | "isActive"
      | "status"
      | "message"
      | "shortMessage"
      | "showAlert"
      | "primaryAction"
    >,
  ): ProStatusData => ({
    ...fields,
    expiresAt,
    proRowId: rowId,
    planType: row.plan_type,
    paymentReference: row.payment_reference,
    statusBannerDismissed,
    welcomeBannerDismissed,
  });

  if (row.status === "active") {
    if (expiresAt && expiresAt.getTime() > now.getTime()) {
      const msLeft = expiresAt.getTime() - now.getTime();
      const daysLeft = Math.ceil(msLeft / MS_PER_DAY);
      const expiringSoon = daysLeft <= 3;
      const shortMsg = expiringSoon
        ? `Pro expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`
        : "Pro Active";
      const msg = expiringSoon
        ? `Your Schooldra Pro access expires in ${daysLeft} day${
            daysLeft === 1 ? "" : "s"
          } (${fmt(expiresAt)}). Renew now to keep access.`
        : `Pro access is active until ${fmt(expiresAt)}.`;
      return build({
        isActive: true,
        status: expiringSoon ? "expiring_soon" : "active",
        message: msg,
        shortMessage: shortMsg,
        showAlert: expiringSoon,
        primaryAction: expiringSoon ? "renew" : null,
      });
    }

    // Self-correct the row's status from 'active' to 'expired' once
    // its expires_at has passed. enforce_pro_users_self_update_columns
    // explicitly allows this one transition for the row's own user.
    // We do NOT write profiles.is_pro here — that column is now
    // protected against browser writes (protect_profile_is_pro
    // trigger) and would be silently ignored. Pro status for gating
    // is read from this hook's own computed isPro, never from
    // profiles.is_pro, so nothing depends on that write anymore.
    // The nightly/hourly reconcile job is the backstop for anyone who
    // never reopens the app before their reminder is due.
    try {
      await supabase
        .from("pro_users")
        .update({ status: "expired" })
        .eq("id", rowId);
    } catch (err) {
      console.error("[useProStatus] stale status sync failed:", err);
    }
  }

  const treatedAsExpired =
    row.status === "expired" ||
    (row.status === "active" &&
      !!expiresAt &&
      expiresAt.getTime() <= now.getTime());

  if (treatedAsExpired && expiresAt && updatedAt) {
    const hoursDiff =
      Math.abs(updatedAt.getTime() - expiresAt.getTime()) / 3_600_000;

    if (hoursDiff <= 24) {
      if (isAdminGrant) {
        return build({
          isActive: false,
          status: "expired_admin_grant",
          message: `Your Pro access (granted by admin) ended on ${fmt(
            expiresAt,
          )}. Contact support if you need it renewed.`,
          shortMessage: "Pro ended (admin grant)",
          showAlert: true,
          primaryAction: "contact_support",
        });
      }
      return build({
        isActive: false,
        status: "expired_natural",
        message: `Your Schooldra Pro subscription expired on ${fmt(
          expiresAt,
        )}. Renew to keep access to unlimited mock exams, AI explanations, and performance tracking.`,
        shortMessage: "Pro expired",
        showAlert: true,
        primaryAction: "renew",
      });
    }

    return build({
      isActive: false,
      status: "revoked_early",
      message: `Your Schooldra Pro access was ended early on ${fmt(
        updatedAt,
      )}. Contact support@schooldra.com for details.`,
      shortMessage: "Pro access ended early",
      showAlert: true,
      primaryAction: "contact_support",
    });
  }

  if (treatedAsExpired) {
    return build({
      isActive: false,
      status: isAdminGrant ? "expired_admin_grant" : "expired_natural",
      message: isAdminGrant
        ? "Your admin-granted Pro access is no longer active. Contact support if you need it renewed."
        : "Your Schooldra Pro subscription is no longer active. Renew to keep access.",
      shortMessage: "Pro ended",
      showAlert: true,
      primaryAction: isAdminGrant ? "contact_support" : "renew",
    });
  }

  if (row.status === "inactive") {
    // paidPlan + not-yet-active reads as a payment that never
    // confirmed. This no longer checks storeIsPro (which could be
    // stale) — a paid plan sitting at 'inactive' is enough on its own.
    const looksLikeFailedPayment = !isAdminGrant && paidPlan;

    if (looksLikeFailedPayment) {
      return build({
        isActive: false,
        status: "payment_failed",
        message:
          "Your Pro payment could not be confirmed. Please try again or contact support.",
        shortMessage: "Payment unconfirmed",
        showAlert: true,
        primaryAction: "try_again",
      });
    }
    return build({
      isActive: false,
      status: "inactive",
      message:
        "Your Schooldra Pro is currently inactive. Contact support@schooldra.com.",
      shortMessage: "Pro inactive",
      showAlert: true,
      primaryAction: "contact_support",
    });
  }

  return build({
    isActive: false,
    status: "none",
    message: "",
    shortMessage: "",
    showAlert: false,
    primaryAction: null,
  });
};

// ── Shared store ───────────────────────────────────────────────────────
//
// useProStatus is called from AppLayout (which remounts on every page
// navigation), ProGate and others. Each instance used to run its own
// pro_users query on mount and start from an empty state, so every
// navigation re-queried and the Pro banners popped in late and shifted the
// page. All instances now share one result:
//   - fresh (< STALE_MS): reused as-is, no request
//   - stale: shown immediately, refreshed in the background (no loading flash)
//   - concurrent callers share a single in-flight request

const STALE_MS = 60_000;

interface ProStore {
  userId: string | null;
  data: ProStatusData;
  /** 0 = no successful fetch yet for this user */
  fetchedAt: number;
  isLoading: boolean;
}

const INITIAL_STORE: ProStore = {
  userId: null,
  data: EMPTY_STATE,
  fetchedAt: 0,
  isLoading: true,
};

let store: ProStore = INITIAL_STORE;
const listeners = new Set<() => void>();
let inflight: { userId: string; promise: Promise<void> } | null = null;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const getSnapshot = () => store;

const setStore = (patch: Partial<ProStore>) => {
  store = { ...store, ...patch };
  listeners.forEach((listener) => listener());
};

const patchProData = (patch: Partial<ProStatusData>) => {
  setStore({ data: { ...store.data, ...patch } });
};

const resetProStatusStore = () => {
  inflight = null;
  if (store !== INITIAL_STORE) {
    store = INITIAL_STORE;
    listeners.forEach((listener) => listener());
  }
};

const isFresh = (userId: string): boolean => {
  if (store.userId !== userId || store.fetchedAt === 0) return false;
  if (Date.now() - store.fetchedAt >= STALE_MS) return false;
  // A cached "active" result must not outlive its own expiry date.
  const { isActive, expiresAt } = store.data;
  if (isActive && expiresAt && expiresAt.getTime() <= Date.now()) return false;
  return true;
};

const loadProStatus = (userId: string, force = false): Promise<void> => {
  if (!force && isFresh(userId)) return Promise.resolve();

  // runLoad never rejects: failures are handled inside.
  const runLoad = async (): Promise<void> => {
    if (store.userId !== userId) {
      // Different user than whatever is cached: drop the old data right away.
      setStore({
        userId,
        data: EMPTY_STATE,
        fetchedAt: 0,
        isLoading: true,
      });
    } else if (force || store.fetchedAt === 0) {
      setStore({ isLoading: true });
    }
    // else: background revalidation of stale data, keep isLoading false.

    try {
      const data = await fetchProStatus(userId);
      if (store.userId !== userId) return; // user changed while waiting
      setStore({ data, fetchedAt: Date.now(), isLoading: false });
    } catch (err) {
      console.error("[useProStatus] pro_users check failed:", err);
      if (store.userId !== userId) return;
      // Keep whatever we already knew and do NOT mark it fresh, so the next
      // mount retries. (A network error is not "this user isn't Pro".)
      setStore({ isLoading: false });
    }
  };

  const start = (): Promise<void> => {
    const promise: Promise<void> = runLoad().finally(() => {
      if (inflight?.promise === promise) inflight = null;
    });
    inflight = { userId, promise };
    return promise;
  };

  if (inflight && inflight.userId === userId) {
    // Join the running request; a forced refresh runs again right after it
    // (the running one may have started before whatever prompted the refresh).
    return force ? inflight.promise.then(start) : inflight.promise;
  }
  return start();
};

export const useProStatus = (): ProStatusInfo => {
  const userId = useUserStore((s) => s.id);
  const isOwner = useUserStore((s) => s.isOwner);

  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    if (!userId) {
      resetProStatusStore();
      return;
    }
    // Owner bypass — skip the pro_users fetch entirely. Nothing here should
    // ever attempt to modify the owner's pro_users row; the DB trigger
    // would reject it, and the account isn't subject to expiry at all.
    if (isOwner) return;

    void loadProStatus(userId);
  }, [userId, isOwner]);

  let data: ProStatusData;
  let isLoading: boolean;

  if (!userId) {
    data = EMPTY_STATE;
    isLoading = false;
  } else if (isOwner) {
    data = OWNER_ACTIVE_STATE(null);
    isLoading = false;
  } else if (snapshot.userId === userId) {
    data = snapshot.data;
    isLoading = snapshot.isLoading;
  } else {
    // Store still belongs to nobody / another user; the effect above is
    // about to start the first check for this user.
    data = EMPTY_STATE;
    isLoading = true;
  }

  const refresh = useCallback(async () => {
    if (!userId || isOwner) return;
    await loadProStatus(userId, true);
  }, [userId, isOwner]);

  // Dismiss writes remain no-ops for the owner (proRowId is null in
  // OWNER_ACTIVE_STATE, and dismissed flags are already hardcoded true).
  const dismissStatusBanner = async () => {
    const rowId = data.proRowId;
    if (!rowId || isOwner) return;
    patchProData({ statusBannerDismissed: true });
    try {
      const { error } = await supabase
        .from("pro_users")
        .update({ status_banner_dismissed_at: new Date().toISOString() })
        .eq("id", rowId);
      if (error) {
        console.error(
          "[useProStatus] Failed to persist status banner dismissal:",
          error,
        );
      }
    } catch (err) {
      console.error(
        "[useProStatus] Failed to persist status banner dismissal:",
        err,
      );
    }
  };

  const dismissWelcomeBanner = async () => {
    const rowId = data.proRowId;
    if (!rowId || isOwner) return;
    patchProData({ welcomeBannerDismissed: true });
    try {
      const { error } = await supabase
        .from("pro_users")
        .update({ welcome_banner_dismissed_at: new Date().toISOString() })
        .eq("id", rowId);
      if (error) {
        console.error(
          "[useProStatus] Failed to persist welcome banner dismissal:",
          error,
        );
      }
    } catch (err) {
      console.error(
        "[useProStatus] Failed to persist welcome banner dismissal:",
        err,
      );
    }
  };

  return {
    ...data,
    isPro: data.isActive,
    isLoading,
    refresh,
    dismissStatusBanner,
    dismissWelcomeBanner,
  };
};