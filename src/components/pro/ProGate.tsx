import React, { useState, useRef } from "react";
import {
  CalendarPlus,
  CheckCircle2,
  ClipboardCheck,
  Crown,
  Download,
  Lock,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useUserStore, APP_CONFIG } from "../../Store/useUserStore";
import { useProStatus } from "../../hooks/useProStatus"; // adjust path if your hook lives elsewhere
import Button from "../ui/Button";
import { supabase } from "../../lib/supabase";

declare global {
  interface Window {
    FlutterwaveCheckout?: (options: Record<string, unknown>) => void;
  }
}

interface FlutterwaveCallbackData {
  status: string;
  tx_ref: string;
  transaction_id?: number | string;
  id?: number | string;
  [key: string]: unknown;
}

interface ProGateProps {
  /** Heading for the locked feature, e.g. "Offline Past Questions". */
  title?: string;
  /** One or two sentences about what the student unlocks. */
  description?: string;
  /**
   * Gate mode: pass the Pro-only content as children. Pro users see it,
   * everyone else sees the upgrade page. With no children, ProGate always
   * shows the upgrade page (e.g. a renewal screen).
   */
  children?: React.ReactNode;
}

const FLW_SCRIPT_ID = "flutterwave-checkout-script";
const PRO_DURATION_DAYS = 30;

// Keep the charged amount tied to the displayed price (APP_CONFIG is the source).
const parsePrice = (value: unknown, fallback: number) => {
  const n = Number(String(value ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

interface Feature {
  icon: LucideIcon;
  title: string;
  desc: string;
}

const FEATURES: Feature[] = [
  {
    icon: Download,
    title: "Study offline",
    desc: "Download subject packs and practise without data.",
  },
  {
    icon: ClipboardCheck,
    title: "Full mock exam review",
    desc: "Go through every question and see where you dropped marks.",
  },
  {
    icon: Sparkles,
    title: "AI Tutor",
    desc: "Clear explanations on past questions and mock review.",
  },
  {
    icon: CalendarPlus,
    title: "Renew early, keep your days",
    desc: `Renewing adds ${PRO_DURATION_DAYS} days on top of what you have left.`,
  },
];

const ProGate: React.FC<ProGateProps> = ({
  title = "Unlock Schooldra Pro",
  description = "Practise smarter, revise faster and walk into JAMB with confidence.",
  children,
}) => {
  const { upgradeToPro, name, email } = useUserStore();
  const { isPro, isLoading, refresh } = useProStatus();
  const { CURRENCY, DISPLAY_PRICE } = APP_CONFIG.PRICING;
  const amount = parsePrice(DISPLAY_PRICE, 3000);

  const [isInitiating, setIsInitiating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isPaid, setIsPaid] = useState(false);

  // Flutterwave calls onclose even after a successful payment; this stops the
  // "Leaving so soon?" modal from appearing to people who just paid.
  const paymentCompleted = useRef(false);

  const isGateMode = children !== undefined && children !== null;

  // Server-side verification only. This function does NOT write to
  // pro_users itself anymore — it hands the transaction to the
  // verify-payment edge function, which re-checks it with Flutterwave
  // using the secret key and activates Pro with the service role. See
  // supabase/functions/verify-payment.
  const recordPayment = async (data: FlutterwaveCallbackData) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error("No active session");

    const transactionId = data.transaction_id ?? data.id;
    if (!transactionId) throw new Error("Missing transaction id from Flutterwave");

    const { data: result, error: fnError } = await supabase.functions.invoke(
      "verify-payment",
      {
        body: { transaction_id: transactionId, tx_ref: data.tx_ref },
      },
    );
    if (fnError) throw fnError;
    if (!result?.ok) {
      throw new Error(result?.error || "Payment could not be verified");
    }
  };

  const processPayment = () => {
    const flwKey = import.meta.env.VITE_FLW_PUBLIC_KEY;

    if (!flwKey) {
      setError("Payment configuration missing.");
      return;
    }
    if (!email) {
      setError("Please log in to your account before upgrading.");
      return;
    }

    paymentCompleted.current = false;

    try {
      window.FlutterwaveCheckout?.({
        public_key: flwKey,
        tx_ref: `schooldra-pro-${Date.now()}`,
        amount,
        currency: "NGN",
        payment_options: "card, banktransfer, ussd",
        customer: {
          email,
          name: name || "Schooldra Student",
        },
        customizations: {
          title: "Schooldra Pro",
          description: "Full access to all JAMB prep features",
          logo: "https://schooldra.vercel.app/Schooldra.LOGO.webp",
        },
        callback: async (data: FlutterwaveCallbackData) => {
          if (data.status !== "successful" && data.status !== "completed") {
            setError("Payment failed. Please try again.");
            return;
          }

          paymentCompleted.current = true;
          setShowCancelConfirm(false);

          try {
            await recordPayment(data);
            await upgradeToPro();
            await refresh();
            setIsPaid(true);
          } catch (err) {
            console.error("Error recording payment:", err);
            setError(
              `Payment received (ref: ${data.tx_ref}) but we couldn't activate Pro yet. Please contact support with this reference.`,
            );
          }
        },
        onclose: () => {
          if (!paymentCompleted.current) setShowCancelConfirm(true);
        },
      });
    } catch {
      setError("Could not initiate payment.");
    }
  };

  const handleUpgrade = () => {
    setError(null);

    if (window.FlutterwaveCheckout) {
      processPayment();
      return;
    }

    setIsInitiating(true);

    const existing = document.getElementById(FLW_SCRIPT_ID);
    if (existing) existing.remove(); // a previous attempt failed; retry cleanly

    const script = document.createElement("script");
    script.id = FLW_SCRIPT_ID;
    script.src = "https://checkout.flutterwave.com/v3.js";
    script.async = true;
    script.onload = () => {
      setIsInitiating(false);
      processPayment();
    };
    script.onerror = () => {
      setIsInitiating(false);
      setError("Failed to load payment gateway. Check your network and retry.");
    };
    document.body.appendChild(script);
  };

  // ---- Gate mode: single source of truth is useProStatus ----
  if (isGateMode) {
    if (isLoading) {
      return (
        <div
          aria-busy="true"
          className="mx-auto w-full max-w-md animate-pulse space-y-3 py-6 sm:max-w-2xl"
        >
          <div className="bg-bgCard rounded-brand-lg h-32" />
          <div className="bg-bgCard rounded-brand-lg h-48" />
        </div>
      );
    }
    if (isPro) return <>{children}</>;
  }

  if (isPaid) {
    return (
      <div className="animate-fadeIn mx-auto w-full max-w-md py-8 text-center">
        <div className="bg-success/15 border-success/25 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border">
          <CheckCircle2 className="text-success h-8 w-8" />
        </div>
        <h3 className="font-display mb-2 text-2xl font-bold tracking-tight">
          You're Pro now 🎉
        </h3>
        <p className="text-textMuted text-sm">
          Every Pro feature is unlocked. Go crush that JAMB prep.
        </p>
      </div>
    );
  }

  return (
    <section className="animate-fadeIn mx-auto w-full max-w-md py-4 sm:max-w-2xl sm:py-6 lg:max-w-5xl">
      <div className="grid gap-4 lg:grid-cols-5 lg:items-start lg:gap-6">
        {/* Hero */}
        <div className="border-brand/25 bg-linear-to-br from-brand/25 via-bgCard to-bgCard rounded-brand-lg relative overflow-hidden border p-5 sm:p-7 lg:col-span-3">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "radial-gradient(currentColor 1px, transparent 1px)",
              backgroundSize: "18px 18px",
            }}
          />
          <div className="relative">
            <div className="bg-brand/20 border-brand/30 text-brand-light mb-4 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold tracking-wider uppercase">
              <Crown className="h-3.5 w-3.5" />
              Schooldra Pro
            </div>

            <h3 className="font-display mb-2 text-2xl leading-tight font-black tracking-tight sm:text-3xl">
              {title}
            </h3>
            <p className="text-textMuted max-w-md text-sm sm:text-base">
              {description}
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              {["Offline packs", "Mock review", "AI Tutor"].map((chip) => (
                <span
                  key={chip}
                  className="bg-bgCard/80 border-borderMuted rounded-full border px-3 py-1.5 text-xs font-semibold"
                >
                  {chip}
                </span>
              ))}
            </div>

            <p className="text-textDim mt-4 text-xs">
              Practising past questions online stays free for everyone.
            </p>
          </div>
        </div>

        {/* Pricing / CTA */}
        <div className="bg-bgCard border-borderMuted rounded-brand-lg border p-5 sm:p-6 lg:sticky lg:top-6 lg:col-span-2 lg:row-span-2">
          <div className="text-textDim mb-3 flex items-center gap-2 text-[11px] font-medium tracking-widest uppercase">
            <Lock className="h-3.5 w-3.5" />
            Pro access · {PRO_DURATION_DAYS} days
          </div>

          <div className="flex items-baseline gap-1.5">
            <span className="font-display text-brand-light text-4xl font-black tracking-tighter sm:text-5xl">
              {CURRENCY}
              {DISPLAY_PRICE}
            </span>
            <span className="text-textDim text-sm">/ month</span>
          </div>
          <p className="text-textDim mt-1 mb-5 text-xs">
            One-time payment. No auto-renewal.
          </p>

          {error && (
            <p
              role="alert"
              className="text-danger bg-danger/10 border-danger/20 mb-4 rounded-xl border px-3 py-2 text-xs font-medium"
            >
              {error}
            </p>
          )}

          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={handleUpgrade}
            loading={isInitiating}
            icon={!isInitiating ? <Crown className="h-4 w-4" /> : undefined}
          >
            Upgrade to Pro
          </Button>

          <ul className="text-textDim mt-4 space-y-2 text-[11px]">
            <li className="flex items-center gap-2">
              <ShieldCheck className="text-success h-4 w-4 shrink-0" />
              Secure payment by Flutterwave
            </li>
            <li className="flex items-center gap-2">
              <ShieldCheck className="text-success h-4 w-4 shrink-0" />
              Pay with card, bank transfer or USSD
            </li>
          </ul>
        </div>

        {/* Features */}
        <div className="bg-bgCard border-borderMuted rounded-brand-lg border p-4 sm:p-6 lg:col-span-3">
          <p className="text-textDim mb-4 text-[11px] font-medium tracking-widest uppercase">
            What you get with Pro
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {FEATURES.map(({ icon: Icon, title: fTitle, desc }) => (
              <div
                key={fTitle}
                className="border-borderMuted flex items-start gap-3 rounded-xl border p-3"
              >
                <span className="bg-brand/15 text-brand-light flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm leading-snug font-semibold">{fTitle}</p>
                  <p className="text-textMuted mt-0.5 text-xs">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cancel confirmation modal */}
      {showCancelConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pro-cancel-title"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
        >
          <div className="bg-bgCard border-borderMuted w-full max-w-sm rounded-3xl border p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl">
            <div className="text-center">
              <div className="bg-warn/10 border-warn/20 mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border">
                <Crown className="text-warn h-6 w-6" />
              </div>
              <h3
                id="pro-cancel-title"
                className="font-display mb-2 text-xl font-bold"
              >
                Leaving so soon?
              </h3>
              <p className="text-textMuted mb-6 text-sm">
                You stopped the payment. Want to go back or try again?
              </p>
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => setShowCancelConfirm(false)}
                >
                  Go Back
                </Button>
                <Button
                  variant="primary"
                  fullWidth
                  onClick={() => {
                    setShowCancelConfirm(false);
                    handleUpgrade();
                  }}
                >
                  Try Again
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default ProGate;