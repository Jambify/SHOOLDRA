import React, { useState, useEffect, useRef } from "react";
import {
  BookOpen,
  ClipboardCheck,
  Crown,
  Download,
  Lock,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import { useUserStore, APP_CONFIG } from "../../Store/useUserStore";
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
  [key: string]: unknown;
}

interface ProGateProps {
  /** Heading shown at the top. Pass the feature being locked, e.g. "Offline Past Questions". */
  title?: string;
  /** One or two sentences explaining what the student gets. */
  description?: string;
}

const FALLBACK_QUESTION_COUNT = 4180;
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

const ProGate: React.FC<ProGateProps> = ({
  title = "Unlock Schooldra Pro",
  description = "Practise smarter, revise faster and walk into JAMB with confidence.",
}) => {
  const { upgradeToPro, name, email } = useUserStore();
  const { CURRENCY, DISPLAY_PRICE } = APP_CONFIG.PRICING;
  const amount = parsePrice(DISPLAY_PRICE, 3000);

  const [isInitiating, setIsInitiating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [questionCount, setQuestionCount] = useState<number>(
    FALLBACK_QUESTION_COUNT,
  );

  // Flutterwave calls onclose even after a successful payment; this stops the
  // "Are you sure?" modal from appearing to people who just paid.
  const paymentCompleted = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchCount() {
      const { count, error } = await supabase
        .from("questions")
        .select("id", { count: "exact", head: true });

      if (!cancelled && !error && typeof count === "number") {
        setQuestionCount(count);
      }
      // On error the count stays at FALLBACK_QUESTION_COUNT (silent).
    }

    fetchCount();
    return () => {
      cancelled = true;
    };
  }, []);

  const formattedCount = questionCount.toLocaleString();

  const features: Feature[] = [
    {
      icon: BookOpen,
      title: `${formattedCount}+ real JAMB questions`,
      desc: "From the available question bank.",
    },
    {
      icon: Download,
      title: "Study offline",
      desc: "Download subject packs and practise without data.",
    },
    {
      icon: Sparkles,
      title: "AI Tutor",
      desc: "Clear explanations for practice questions.",
    },
    {
      icon: ClipboardCheck,
      title: "Mock exam review",
      desc: "See exactly where you dropped marks.",
    },
    {
      icon: TrendingUp,
      title: "Weak-topic tracking",
      desc: "Know what to revise next.",
    },
    {
      icon: SlidersHorizontal,
      title: "Smart filters",
      desc: "Browse by subject, year, topic and difficulty.",
    },
  ];

  const recordPayment = async (data: FlutterwaveCallbackData) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("No active session");

    const { data: currentPro, error: currentProError } = await supabase
      .from("pro_users")
      .select("expires_at")
      .eq("user_id", user.id)
      .maybeSingle();
    if (currentProError) throw currentProError;

    const now = new Date();
    const currentExpiry = currentPro?.expires_at
      ? new Date(currentPro.expires_at)
      : now;
    const renewalBase =
      currentExpiry.getTime() > now.getTime() ? currentExpiry : now;

    const { error: paymentError } = await supabase.from("pro_users").upsert(
      {
        user_id: user.id,
        email: user.email,
        payment_reference: data.tx_ref,
        amount,
        status: "active",
        plan_type: "monthly",
        expires_at: new Date(
          renewalBase.getTime() + PRO_DURATION_DAYS * 24 * 60 * 60 * 1000,
        ).toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (paymentError) throw paymentError;
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

    const onLoaded = () => {
      setIsInitiating(false);
      processPayment();
    };
    const onFailed = () => {
      setIsInitiating(false);
      setError("Failed to load payment gateway. Check your network and retry.");
    };

    const existing = document.getElementById(
      FLW_SCRIPT_ID,
    ) as HTMLScriptElement | null;
    if (existing) existing.remove(); // a previous attempt failed; retry cleanly

    const script = document.createElement("script");
    script.id = FLW_SCRIPT_ID;
    script.src = "https://checkout.flutterwave.com/v3.js";
    script.async = true;
    script.onload = onLoaded;
    script.onerror = onFailed;
    document.body.appendChild(script);
  };

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
              <span className="bg-bgCard/80 border-borderMuted inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold">
                <BookOpen className="text-brand-light h-3.5 w-3.5" />
                {formattedCount}+ questions
              </span>
              <span className="bg-bgCard/80 border-borderMuted inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold">
                <Download className="text-brand-light h-3.5 w-3.5" />
                Offline packs
              </span>
              <span className="bg-bgCard/80 border-borderMuted inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold">
                <Sparkles className="text-brand-light h-3.5 w-3.5" />
                AI Tutor
              </span>
            </div>
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
            {features.map(({ icon: Icon, title: fTitle, desc }) => (
              <div
                key={fTitle}
                className="border-borderMuted flex items-start gap-3 rounded-xl border p-3"
              >
                <span className="bg-brand/15 text-brand-light flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm leading-snug font-semibold">
                    {fTitle}
                  </p>
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