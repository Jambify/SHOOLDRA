import { useCallback, useEffect, useRef, useState } from "react";
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
  /** Re-run the pro_users check now (e.g. right after a payment activates). */
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

export const useProStatus = (): ProStatusInfo => {
  const userId = useUserStore((s) => s.id);
  const isOwner = useUserStore((s) => s.isOwner);

  const [info, setInfo] = useState<ProStatusData>(EMPTY_STATE);
  const [isLoading, setIsLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  const hasSyncedRef = useRef(false);
  const proRowIdRef = useRef<string | null>(null);
  proRowIdRef.current = info.proRowId;

  useEffect(() => {
    let cancelled = false;

    if (!userId) {
      hasSyncedRef.current = false;
      setInfo(EMPTY_STATE);
      setIsLoading(false);
      return;
    }

    // Owner bypass — skip the pro_users fetch entirely. Nothing here should
    // ever attempt to modify the owner's pro_users row; the DB trigger
    // would reject it, and the account isn't subject to expiry at all.
    if (isOwner) {
      hasSyncedRef.current = false;
      setInfo(OWNER_ACTIVE_STATE(proRowIdRef.current));
      setIsLoading(false);
      return;
    }

    const check = async () => {
      setIsLoading(true);

      const { data: proRow } = await supabase
        .from("pro_users")
        .select(
          "id, status, plan_type, payment_reference, expires_at, updated_at, created_at, status_banner_dismissed_at, welcome_banner_dismissed_at",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;

      if (!proRow) {
        hasSyncedRef.current = false;
        setInfo(EMPTY_STATE);
        setIsLoading(false);
        return;
      }

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

      if (row.status === "active") {
        if (expiresAt && expiresAt.getTime() > now.getTime()) {
          const msLeft = expiresAt.getTime() - now.getTime();
          const daysLeft = Math.ceil(msLeft / MS_PER_DAY);
          const expiringSoon = daysLeft <= 3;
          const shortMsg = expiringSoon
            ? `Pro expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`
            : "Pro Active";
          const msg = expiringSoon
            ? `Your Schooldra Pro access expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"
            } (${fmt(expiresAt)}). Renew now to keep access.`
            : `Pro access is active until ${fmt(expiresAt)}.`;
          setInfo({
            isActive: true,
            status: expiringSoon ? "expiring_soon" : "active",
            message: msg,
            shortMessage: shortMsg,
            showAlert: expiringSoon,
            expiresAt,
            primaryAction: expiringSoon ? "renew" : null,
            proRowId: rowId,
            planType: row.plan_type,
            paymentReference: row.payment_reference,
            statusBannerDismissed,
            welcomeBannerDismissed,
          });
          setIsLoading(false);
          return;
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
        if (cancelled) return;
      }

      const treatedAsExpired =
        row.status === "expired" ||
        (row.status === "active" && !!expiresAt && expiresAt.getTime() <= now.getTime());

      if (treatedAsExpired && expiresAt && updatedAt) {
        const hoursDiff = Math.abs(updatedAt.getTime() - expiresAt.getTime()) / 3_600_000;

        if (hoursDiff <= 24) {
          if (isAdminGrant) {
            setInfo({
              isActive: false,
              status: "expired_admin_grant",
              message: `Your Pro access (granted by admin) ended on ${fmt(
                expiresAt,
              )}. Contact support if you need it renewed.`,
              shortMessage: "Pro ended (admin grant)",
              showAlert: true,
              expiresAt,
              primaryAction: "contact_support",
              proRowId: rowId,
              planType: row.plan_type,
              paymentReference: row.payment_reference,
              statusBannerDismissed,
              welcomeBannerDismissed,
            });
          } else {
            setInfo({
              isActive: false,
              status: "expired_natural",
              message: `Your Schooldra Pro subscription expired on ${fmt(
                expiresAt,
              )}. Renew to keep access to unlimited mock exams, AI explanations, and performance tracking.`,
              shortMessage: "Pro expired",
              showAlert: true,
              expiresAt,
              primaryAction: "renew",
              proRowId: rowId,
              planType: row.plan_type,
              paymentReference: row.payment_reference,
              statusBannerDismissed,
              welcomeBannerDismissed,
            });
          }
          setIsLoading(false);
          return;
        }

        setInfo({
          isActive: false,
          status: "revoked_early",
          message: `Your Schooldra Pro access was ended early on ${fmt(
            updatedAt,
          )}. Contact support@schooldra.com for details.`,
          shortMessage: "Pro access ended early",
          showAlert: true,
          expiresAt,
          primaryAction: "contact_support",
          proRowId: rowId,
          planType: row.plan_type,
          paymentReference: row.payment_reference,
          statusBannerDismissed,
          welcomeBannerDismissed,
        });
        setIsLoading(false);
        return;
      }

      if (treatedAsExpired) {
        setInfo({
          isActive: false,
          status: isAdminGrant ? "expired_admin_grant" : "expired_natural",
          message: isAdminGrant
            ? "Your admin-granted Pro access is no longer active. Contact support if you need it renewed."
            : "Your Schooldra Pro subscription is no longer active. Renew to keep access.",
          shortMessage: "Pro ended",
          showAlert: true,
          expiresAt,
          primaryAction: isAdminGrant ? "contact_support" : "renew",
          proRowId: rowId,
          planType: row.plan_type,
          paymentReference: row.payment_reference,
          statusBannerDismissed,
          welcomeBannerDismissed,
        });
        setIsLoading(false);
        return;
      }

      if (row.status === "inactive") {
        // paidPlan + not-yet-active reads as a payment that never
        // confirmed. This no longer checks storeIsPro (which could be
        // stale) — a paid plan sitting at 'inactive' is enough on its own.
        const looksLikeFailedPayment = !isAdminGrant && paidPlan;

        if (looksLikeFailedPayment) {
          setInfo({
            isActive: false,
            status: "payment_failed",
            message:
              "Your Pro payment could not be confirmed. Please try again or contact support.",
            shortMessage: "Payment unconfirmed",
            showAlert: true,
            expiresAt,
            primaryAction: "try_again",
            proRowId: rowId,
            planType: row.plan_type,
            paymentReference: row.payment_reference,
            statusBannerDismissed,
            welcomeBannerDismissed,
          });
        } else {
          setInfo({
            isActive: false,
            status: "inactive",
            message:
              "Your Schooldra Pro is currently inactive. Contact support@schooldra.com.",
            shortMessage: "Pro inactive",
            showAlert: true,
            expiresAt,
            primaryAction: "contact_support",
            proRowId: rowId,
            planType: row.plan_type,
            paymentReference: row.payment_reference,
            statusBannerDismissed,
            welcomeBannerDismissed,
          });
        }
        setIsLoading(false);
        return;
      }

      setInfo({
        isActive: false,
        status: "none",
        message: "",
        shortMessage: "",
        showAlert: false,
        expiresAt,
        primaryAction: null,
        proRowId: rowId,
        planType: row.plan_type,
        paymentReference: row.payment_reference,
        statusBannerDismissed,
        welcomeBannerDismissed,
      });
      setIsLoading(false);
    };

    check();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, isOwner, reloadKey]);

  const refresh = useCallback(async () => {
    setReloadKey((k) => k + 1);
  }, []);

  // Dismiss writes remain no-ops for the owner (proRowId is null in
  // OWNER_ACTIVE_STATE, and dismissed flags are already hardcoded true).
  const dismissStatusBanner = async () => {
    const rowId = info.proRowId;
    if (!rowId || isOwner) return;
    setInfo((prev) => ({ ...prev, statusBannerDismissed: true }));
    try {
      const { error } = await supabase
        .from("pro_users")
        .update({ status_banner_dismissed_at: new Date().toISOString() })
        .eq("id", rowId);
      if (error) {
        console.error("[useProStatus] Failed to persist status banner dismissal:", error);
      }
    } catch (err) {
      console.error("[useProStatus] Failed to persist status banner dismissal:", err);
    }
  };

  const dismissWelcomeBanner = async () => {
    const rowId = info.proRowId;
    if (!rowId || isOwner) return;
    setInfo((prev) => ({ ...prev, welcomeBannerDismissed: true }));
    try {
      const { error } = await supabase
        .from("pro_users")
        .update({ welcome_banner_dismissed_at: new Date().toISOString() })
        .eq("id", rowId);
      if (error) {
        console.error("[useProStatus] Failed to persist welcome banner dismissal:", error);
      }
    } catch (err) {
      console.error("[useProStatus] Failed to persist welcome banner dismissal:", err);
    }
  };

  return {
    ...info,
    isPro: info.isActive,
    isLoading,
    refresh,
    dismissStatusBanner,
    dismissWelcomeBanner,
  };
};