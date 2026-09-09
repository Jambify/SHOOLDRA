import React, { useState } from "react";
import { useNavigate, Link } from "react-router";
import { useUserStore } from "../../Store/useUserStore";
import {
  Mail,
  ArrowRight,
  ShieldCheck,
  User,
  AlertCircle,
  Key,
  RefreshCw,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../../lib/supabase";
import AuthLayout from "../../components/auth/AuthLayout";
import PageHelmet from "../../components/SEO/PageHelmet";
import { toTitleCase } from "../../lib/utils/utils";
import ValidatedInput from "../../components/ui/ValidatedInput";
import {
  truncateInput,
  MAX_NAME_LENGTH,
  MAX_EMAIL_LENGTH,
  validateName,
} from "../../lib/validation";

type Step = "form" | "otp";

// Same helper as SignIn.tsx — distinguishes "offline / request never
// reached us" from a real application error, so we never show a raw
// fetch error or a misleading "already exists" message when the real
// problem is connectivity.
const isNetworkError = (err: unknown): boolean => {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const msg =
    err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("network") ||
    msg.includes("fetch")
  );
};

const NETWORK_ERROR_MESSAGE =
  "You appear to be offline. Please check your internet connection and try again.";

const SignUp: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("form");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);

  const { setEmail: storeEmail, setName, syncProfile } = useUserStore();

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // ── Step 1: Send OTP ──────────────────────────────────
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { data: statusData, error: statusErr } = await supabase.rpc(
        "check_email_status",
        { p_email: email.trim().toLowerCase() },
      );

      if (statusErr) throw statusErr;

      if (statusData?.confirmed === true) {
        setError(
          "An account with this email already exists. Please sign in instead.",
        );
        setLoading(false);
        return;
      }

      if (statusData?.exists === true && statusData?.confirmed === false) {
        const { data: cleanupData, error: cleanupErr } = await supabase.rpc(
          "cleanup_unverified_user",
          { p_email: email.trim().toLowerCase() },
        );

        // NEW — this call's error was silently ignored before; on a
        // network failure cleanupData would be undefined and we'd fall
        // through to signInWithOtp below with a half-broken state.
        if (cleanupErr) throw cleanupErr;

        if (cleanupData?.status === "pending") {
          const formattedName = toTitleCase(fullName.trim());
          storeEmail(email);
          setName(formattedName);
          setStep("otp");
          setCooldown(30);
          setLoading(false);
          return;
        }
      }

      const formattedName = toTitleCase(fullName.trim());
      storeEmail(email);
      setName(formattedName);

      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          shouldCreateUser: true,
          data: { full_name: formattedName },
        },
      });

      if (otpErr) {
        if (otpErr.status === 429) {
          setCooldown(60);
          throw new Error("Too many requests. Please wait 60 seconds.");
        }
        throw otpErr;
      }

      setStep("otp");
      setCooldown(30);
    } catch (err) {
      setError(
        isNetworkError(err)
          ? NETWORK_ERROR_MESSAGE
          : (err as Error).message || "Failed to send code. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Verify OTP ────────────────────────────────
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { data, error: verifyErr } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: otp.trim(),
        type: "email",
      });

      if (verifyErr) {
        if (isNetworkError(verifyErr)) {
          setError(NETWORK_ERROR_MESSAGE);
        } else if (verifyErr.message.toLowerCase().includes("expired")) {
          setError('Code expired. Click "Resend" to get a new one.');
        } else if (verifyErr.message.toLowerCase().includes("invalid")) {
          setError("Invalid code. Please check and try again.");
        } else {
          console.error("[SignUp verifyOtp]", verifyErr);
          setError("Code verification failed. Please try again.");
        }
        return;
      }

      if (data?.session) {
        useUserStore.setState({
          isAuthenticated: true,
          id: data.session.user.id,
          email: data.session.user.email || email,
          name: fullName,
        });

        await syncProfile();

        const state = useUserStore.getState();
        navigate(state.onboardingComplete ? "/" : "/onboarding", {
          replace: true,
        });
      }
    } catch (err) {
      setError(
        isNetworkError(err)
          ? NETWORK_ERROR_MESSAGE
          : (err as Error).message || "Verification failed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  // ── Resend ────────────────────────────────────────────
  const handleResend = async () => {
    if (cooldown > 0) return;
    setError("");
    setLoading(true);
    try {
      await supabase.rpc("cleanup_unverified_user", {
        p_email: email.trim().toLowerCase(),
      });

      const { error: resendErr } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { shouldCreateUser: true, data: { full_name: fullName } },
      });
      if (resendErr) throw resendErr;
      setCooldown(30);
    } catch (err) {
      setError(
        isNetworkError(err)
          ? NETWORK_ERROR_MESSAGE
          : (err as Error).message || "Failed to resend. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const guestCta = (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.3 }}
    >
      <button
        onClick={() => navigate("/guest")}
        className="auth-guest-cta hover:border-brand/40 group rounded-brand-xl shadow-card flex w-full items-center justify-between border p-4 transition-all active:scale-[0.98] lg:p-5"
      >
        <div className="flex items-center gap-4 text-left">
          <div className="bg-brand/10 flex h-12 w-12 items-center justify-center rounded-2xl text-2xl shadow-inner transition-transform group-hover:scale-110">
            🎯
          </div>
          <div>
            <p className="text-brand mb-1 text-xs leading-none font-black tracking-widest uppercase">
              Just Exploring?
            </p>
            <p className="text-textMain text-sm font-bold">
              Take a free practice test
            </p>
          </div>
        </div>
        <div className="bg-brand/10 text-brand flex h-10 w-10 items-center justify-center rounded-full transition-all group-hover:translate-x-1">
          <ArrowRight size={18} />
        </div>
      </button>
    </motion.div>
  );

  // ── OTP Screen ────────────────────────────────────────
  if (step === "otp") {
    return (
      <>
        <PageHelmet
          title="Create Free Account | SCHOOLDRA"
          description="Create a free SCHOOLDRA account to save your progress and unlock full JAMB UTME exam prep."
          canonical="https://www.schooldra.com/signup"
        />
        <AuthLayout variant="otp">
          <div className="mb-8 text-center">
            <div className="bg-brand shadow-brand/40 mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl shadow-lg">
              <Key className="h-7 w-7 text-white" />
            </div>
            <h1 className="font-display text-textMain mb-2 text-3xl font-bold tracking-tight">
              Check your Email
            </h1>
            <p className="text-textDim text-sm">
              6-digit code sent to{" "}
              <span className="text-brand-light font-medium">{email}</span>
            </p>
          </div>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                key="err"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-5 overflow-hidden"
              >
                <div className="bg-danger/10 border-danger/20 rounded-brand-lg flex gap-3 border p-4">
                  <AlertCircle className="text-danger mt-0.5 h-5 w-5 shrink-0" />
                  <p className="text-danger text-sm">{error}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleVerifyOtp} className="space-y-5">
            <div>
              <label className="text-textMuted mb-2 block px-1 text-xs font-bold tracking-widest uppercase">
                Verification Code
              </label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                maxLength={6}
                value={otp}
                disabled={loading}
                onChange={(e) => {
                  setError("");
                  setOtp(e.target.value.replace(/\D/g, ""));
                }}
                placeholder="000000"
                style={{ fontSize: "16px" }}
                className={`bg-bgSurface border-borderMuted rounded-brand-lg text-textMain focus:ring-brand/40 placeholder:text-textDim/30 w-full border py-4 text-center font-mono text-2xl tracking-[0.5em] transition-all outline-none focus:border-transparent focus:ring-2 ${
                  loading ? "cursor-not-allowed opacity-50" : ""
                }`}
              />
            </div>
            <button
              type="submit"
              disabled={otp.length !== 6 || loading}
              className={`bg-brand hover:bg-brand-light rounded-brand-lg shadow-brand/20 flex w-full items-center justify-center gap-2 py-4 font-bold text-white shadow-lg transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${
                loading ? "cursor-wait" : ""
              }`}
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" /> Verifying…
                </>
              ) : (
                <>
                  Create Account <ArrowRight className="h-5 w-5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 space-y-3 text-center">
            <button
              onClick={handleResend}
              disabled={loading || cooldown > 0}
              className="text-textDim hover:text-brand-light text-sm transition-colors disabled:opacity-50"
            >
              {cooldown > 0
                ? `Resend in ${cooldown}s`
                : "Didn't receive it? Resend"}
            </button>
            <button
              onClick={() => {
                setStep("form");
                setOtp("");
                setError("");
              }}
              className="text-textMuted hover:text-textDim block w-full text-xs transition-colors"
            >
              ← Back
            </button>
          </div>
        </AuthLayout>
      </>
    );
  }

  // ── Signup Form ───────────────────────────────────────
  return (
    <>
      <PageHelmet
        title="Create Free Account | SCHOOLDRA"
        description="Create a free SCHOOLDRA account to save your progress and unlock full JAMB UTME exam prep."
        canonical="https://www.schooldra.com/signup"
      />
      <AuthLayout variant="signup" footer={guestCta}>
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              key="err"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-5 overflow-hidden"
            >
              <div className="bg-danger/10 border-danger/20 rounded-brand-lg flex items-start gap-3 border p-4">
                <AlertCircle className="text-danger mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="text-danger text-sm">{error}</p>
                  {error.includes("already exists") && (
                    <Link
                      to="/signin"
                      className="text-brand-light mt-1 block text-xs hover:underline"
                    >
                      Sign in instead →
                    </Link>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSendOtp} className="space-y-4">
          <div>
            <label className="text-textMuted mb-2 block px-1 text-xs font-bold tracking-widest uppercase">
              Full Name
            </label>
            <div className="group relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                <User className="text-textDim group-focus-within:text-brand-light h-5 w-5 transition-colors" />
              </div>
              <ValidatedInput
                value={fullName}
                onChange={(v) => setFullName(truncateInput(v, MAX_NAME_LENGTH))}
                placeholder="e.g. Adeola Okafor"
                maxLength={MAX_NAME_LENGTH}
                validate={validateName}
                className={`bg-bgSurface border-borderMuted rounded-brand-lg text-textMain focus:ring-brand/40 placeholder:text-textDim/50 w-full border py-3.5 pr-4 pl-12 transition-all outline-none focus:border-transparent focus:ring-2 ${
                  loading ? "cursor-not-allowed opacity-50" : ""
                }`}
                readOnly={loading}
              />
            </div>
          </div>
          <div>
            <label className="text-textMuted mb-2 block px-1 text-xs font-bold tracking-widest uppercase">
              Email Address
            </label>
            <div className="group relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                <Mail className="text-textDim group-focus-within:text-brand-light h-5 w-5 transition-colors" />
              </div>
              <ValidatedInput
                value={email}
                onChange={(v) => setEmail(truncateInput(v, MAX_EMAIL_LENGTH))}
                placeholder="e.g. adeola@example.com"
                maxLength={MAX_EMAIL_LENGTH}
                type="email"
                className={`bg-bgSurface border-borderMuted rounded-brand-lg text-textMain focus:ring-brand/40 placeholder:text-textDim/50 w-full border py-3.5 pr-4 pl-12 transition-all outline-none focus:border-transparent focus:ring-2 ${
                  loading ? "cursor-not-allowed opacity-50" : ""
                }`}
                readOnly={loading}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={!email || !fullName || loading || cooldown > 0}
            className={`bg-brand hover:bg-brand-light rounded-brand-lg shadow-brand/20 flex w-full items-center justify-center gap-2 py-4 font-bold text-white shadow-lg transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${
              loading ? "cursor-wait" : ""
            }`}
          >
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" /> Sending…
              </>
            ) : cooldown > 0 ? (
              `Wait ${cooldown}s`
            ) : (
              <>
                Send Code <ArrowRight className="h-5 w-5" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 space-y-5 text-center">
          <p className="text-textDim text-sm">
            Already have an account?{" "}
            <Link
              to="/signin"
              className="text-brand-light font-semibold hover:underline"
            >
              Sign In
            </Link>
          </p>
          <div className="text-textMuted border-borderMuted/50 flex items-center justify-center gap-2 border-t pt-4 text-[10px] tracking-widest uppercase">
            <ShieldCheck size={14} className="text-success" />
            Secure · No spam · 6-digit code
          </div>
        </div>
      </AuthLayout>
    </>
  );
};

export default SignUp;