import React, { useState, useEffect } from "react";
import PageHelmet from "../components/SEO/PageHelmet";
import { useNavigate } from "react-router";
import { useUserStore } from "../Store/useUserStore";
import StepIndicator from "../components/OnBoarding/StepIndicator";
import Button from "../components/ui/Button";
import ConfirmModal from "../components/ui/ConfirmModal";
import { cn } from "../lib/utils/utils";
import LoadingScreen from "../components/ui/LoadingScreen";
import CustomSubjectSelector from "../components/Settings/CustomSubjectSelector";
import schooldraLogo from "../assets/schooldraLogo.webp"; // Import the new logo
import ValidatedInput from "../components/ui/ValidatedInput";
import {
  truncateInput,
  validateName,
  MAX_NAME_LENGTH,
  MAX_UNI_LENGTH,
} from "../lib/validation";

/* ── Updated Data with Professional Combos ── */
const SUBJECT_COMBOS = [
  {
    id: "medicine",
    label: "Medicine & Pharmacy",
    subjects: ["English", "Biology", "Chemistry", "Physics"],
    icon: "🩺",
  },
  {
    id: "engineering",
    label: "Engineering & Tech",
    subjects: ["English", "Mathematics", "Physics", "Chemistry"],
    icon: "⚙️",
  },
  {
    id: "social-sci",
    label: "Social Sciences",
    subjects: ["English", "Mathematics", "Economics", "Government"],
    icon: "📈",
  },
  {
    id: "law",
    label: "Law & Arts",
    subjects: ["English", "Literature", "Government", "CRS/IRS"],
    icon: "⚖️",
  },
  {
    id: "Commerce",
    label: "Commerce & Business",
    subjects: ["English", "Commerce", "Economics", "CRS/IRS"],
    icon: "💼",
  },
];

const TARGET_SCORES = [
  { range: "320+", label: "Elite", sub: "Top 1% nationwide", color: "#A855F7" },
  {
    range: "280–319",
    label: "Excellent",
    sub: "Competitive for all Unis",
    color: "#22C55E",
  },
  {
    range: "250–279",
    label: "Strong",
    sub: "Target for State/Federal",
    color: "#EAB308",
  },
  {
    range: "200–249",
    label: "Target",
    sub: "Standard Entry Level",
    color: "#EF4444",
  },
];

// FALLBACK UNIVERSITY LIST (Nigerian Universities)
const FALLBACK_UNIVERSITIES = [
  "University of Lagos (UNILAG)",
  "University of Ibadan (UI)",
  "Obafemi Awolowo University (OAU)",
  "Ahmadu Bello University (ABU)",
  "University of Nigeria, Nsukka (UNN)",
  "Covenant University",
  "University of Benin (UNIBEN)",
  "Federal University of Technology, Minna",
  "University of Ilorin (UNILORIN)",
  "Lagos State University (LASU)",
  "Nnamdi Azikiwe University (UNIZIK)",
  "University of Port Harcourt (UNIPORT)",
  "Bayero University Kano (BUK)",
  "University of Abuja",
  "Federal University of Technology, Akure",
  "Babcock University",
  "Pan-Atlantic University",
  "Rivers State University",
  "Kwara State University",
  "University of Calabar (UNICAL)",
];

interface UniversityResult {
  name: string;
  country: string;
}

interface FormData {
  name: string;
  university: string;
  subjectCombo: string | string[]; // Can be predefined ID or array of subject names
  targetScore: string; // We'll store as string for database compatibility
  examYear: string;
  examDate: string;
}

const TOTAL_STEPS = 3;

const Onboarding: React.FC = () => {
  console.log("🔵 Onboarding component mounted");
  const navigate = useNavigate();
  const {
    completeOnboarding,
    isLoading,
    isAuthenticated,
    onboardingComplete,
    syncProfile,
    signOut,
    name: userName,
  } = useUserStore();

  const [step, setStep] = useState(1);
  const [uniSearch, setUniSearch] = useState("");
  const [uniResults, setUniResults] = useState<string[]>([]);
  const [loadingUnis, setLoadingUnis] = useState(false);
  const [uniError, setUniError] = useState<string | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [useFallback, setUseFallback] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false); // ← Add this

  const [isCustomSubjectMode, setIsCustomSubjectMode] = useState(false);
  const [form, setForm] = useState<FormData>({
    name: userName,
    university: "",
    subjectCombo: "",
    targetScore: "", // Will store numeric value as string
    examYear: "2027",
    examDate: "Apr 27",
  });
  const [errors, setErrors] = useState<Partial<FormData>>({});

  // Debug logging
  useEffect(() => {
    console.log("🔵 Onboarding state:", {
      isAuthenticated,
      onboardingComplete,
      isLoading,
      userName,
      id: useUserStore.getState().id,
      email: useUserStore.getState().email,
    });
    setIsCheckingAuth(false);
  }, [isAuthenticated, onboardingComplete, isLoading, userName]);

  // Redirect if already onboarded
  useEffect(() => {
    if (!isCheckingAuth && onboardingComplete) {
      console.log("🔵 Already onboarded, redirecting to /welcome");
      navigate("/welcome", { replace: true });
    }
  }, [onboardingComplete, navigate, isCheckingAuth]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isCheckingAuth && !isAuthenticated && !isLoading) {
      console.log("🔵 Not authenticated, redirecting to /signin");
      navigate("/signin", { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate, isCheckingAuth]);

  // Sync profile on mount to ensure we have latest data
  useEffect(() => {
    const loadProfile = async () => {
      await syncProfile();
    };
    loadProfile();
  }, [syncProfile]);

  // Handle cancel with modal
  const handleCancel = async () => {
    setShowCancelModal(false);
    await signOut();
    navigate("/signup", { replace: true });
  };

  // Filter fallback universities based on search
  const getFilteredFallbackUniversities = (search: string) => {
    if (!search || search.length < 2) return [];
    const searchLower = search.toLowerCase();
    return FALLBACK_UNIVERSITIES.filter((uni) =>
      uni.toLowerCase().includes(searchLower),
    );
  };

  /* ── University API Search Logic with Fallback ── */
  useEffect(() => {
    if (uniSearch.length < 2) {
      setUniResults([]);
      setUniError(null);
      return;
    }

    if (useFallback) {
      const filtered = getFilteredFallbackUniversities(uniSearch);
      setUniResults(filtered);
      return;
    }

    const fetchUnis = async () => {
      setLoadingUnis(true);
      setUniError(null);

      try {
        let data = [];
        let success = false;

        try {
          const res = await fetch(
            `https://universities.hipolabs.com/search?name=${encodeURIComponent(uniSearch)}&country=Nigeria`,
            { mode: "cors" },
          );
          if (res.ok) {
            data = await res.json();
            if (data.length > 0) success = true;
          }
        } catch (err) {
          console.log("Primary API failed, trying backup...");
        }

        if (!success) {
          try {
            const backupRes = await fetch(
              `https://raw.githubusercontent.com/Hipo/university-domains-list/master/world_universities_and_domains.json`,
            );
            if (backupRes.ok) {
              const allUnis = (await backupRes.json()) as UniversityResult[];
              const nigeriaUnis = allUnis.filter(
                (u: UniversityResult) =>
                  u.country === "Nigeria" &&
                  u.name.toLowerCase().includes(uniSearch.toLowerCase()),
              );
              data = nigeriaUnis.slice(0, 20);
              if (data.length > 0) success = true;
            }
          } catch (err) {
            console.log("Backup API also failed");
          }
        }

        if (success && data.length > 0) {
          setUniResults(
            (data as UniversityResult[]).map((u: UniversityResult) => u.name),
          );
          setUseFallback(false);
        } else {
          const fallbackResults = getFilteredFallbackUniversities(uniSearch);
          if (fallbackResults.length > 0) {
            setUniResults(fallbackResults);
            setUseFallback(true);
            setUniError(
              "Using offline university list. Showing available matches.",
            );
          } else {
            setUniResults([]);
            setUniError("No universities found. Try a different search term.");
          }
        }
      } catch (err) {
        console.error("Failed to fetch universities:", err);
        const fallbackResults = getFilteredFallbackUniversities(uniSearch);
        if (fallbackResults.length > 0) {
          setUniResults(fallbackResults);
          setUseFallback(true);
          setUniError("Connected to offline university database.");
        } else {
          setUniResults([]);
          setUniError(
            "Unable to search. Please type the full university name.",
          );
        }
      } finally {
        setLoadingUnis(false);
      }
    };

    const timeoutId = setTimeout(fetchUnis, 500);
    return () => clearTimeout(timeoutId);
  }, [uniSearch, useFallback]);

  const set = (key: keyof FormData, val: string) => {
    setForm((prev) => ({ ...prev, [key]: val }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = (): boolean => {
    const e: Partial<FormData> = {};
    if (step === 1 && !form.name) e.name = "Please enter your full name";
    if (step === 1 && !form.university)
      e.university = "Please select a university";
    if (step === 2 && !form.subjectCombo)
      e.subjectCombo = "Please choose a combination";
    if (step === 3 && !form.targetScore)
      e.targetScore = "Please choose a target";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = async () => {
    if (!validate()) return;

    if (step < TOTAL_STEPS) {
      setStep((s) => s + 1);
      return;
    }

    setIsCompleting(true);
    console.log("🔵 Completing onboarding...");

    try {
      const { error } = await completeOnboarding({
        name: form.name,
        university: form.university,
        subjectCombo: form.subjectCombo,
        targetScore: form.targetScore,
        examYear: form.examYear,
        examDate: form.examDate,
      });

      if (!error) {
        setTimeout(() => {
          navigate("/welcome", { replace: true });
        }, 100);
      } else {
        console.error("Onboarding error:", error);
        setIsCompleting(false);
      }
    } catch (err) {
      console.error("Unexpected error:", err);
      setIsCompleting(false);
    }
  };

  // Show loading state
  if (isLoading || isCheckingAuth || isCompleting) {
    return (
      <LoadingScreen
        message={
          isCompleting ? "Completing your setup" : "Loading your profile"
        }
        submessage={
          isCompleting ? "This will just take a moment" : "Please wait"
        }
        estimatedTime={isCompleting ? 3 : 2}
      />
    );
  }

  return (
    <>
      <PageHelmet
        title="Set Up Your Profile | SCHOOLDRA"
        description="Complete your SCHOOLDRA profile — pick your university, subject combination, and target JAMB score to get a personalized study plan."
      >
        {/* Private, in-flow account page — keep it out of search results */}
        <meta name="robots" content="noindex, nofollow" />
      </PageHelmet>

      <div className="bg-bgMain text-textMain flex min-h-screen flex-col items-center justify-center p-4">
        {/* Brand Header */}
        <div className="mb-10 flex items-center gap-3">
          <img
            src={schooldraLogo}
            alt="Schooldra"
            className="flex h-8 w-8 items-center justify-center lg:h-10 lg:w-10"
          />
          <span className="font-display item-center text-3xl font-bold tracking-tight">
            Schooldra
          </span>
        </div>

        <div className="w-full max-w-xl">
          <StepIndicator current={step} total={TOTAL_STEPS} />

          <div className="bg-bgCard border-borderMuted relative overflow-hidden rounded-4xl border p-6 shadow-2xl md:p-10">
            {/* Subtle Glow */}
            <div className="bg-brand/5 pointer-events-none absolute top-0 right-0 -mt-32 -mr-32 h-64 w-64 rounded-full blur-[80px]" />

            {/* STEP 1: University */}
            {step === 1 && (
              <div className="relative z-10 space-y-8">
                <header>
                  <h2 className="text-textMain mb-2 text-3xl font-bold">
                    Welcome!
                  </h2>
                  <p className="text-textMuted">Let's set up your profile.</p>
                </header>

                <Field label="Full Name" error={errors.name}>
                  <div className="relative">
                    <ValidatedInput
                      value={form.name}
                      onChange={(v) =>
                        set("name", truncateInput(v, MAX_NAME_LENGTH))
                      }
                      placeholder="e.g. Adeola Okafor"
                      validate={validateName}
                      maxLength={MAX_NAME_LENGTH}
                      className={inputCls(!!errors.name)}
                    />
                  </div>
                </Field>

                <Field label="Target University" error={errors.university}>
                  <div className="relative">
                    <ValidatedInput
                      value={uniSearch}
                      onChange={(v) =>
                        setUniSearch(truncateInput(v, MAX_UNI_LENGTH))
                      }
                      placeholder="Search your school..."
                      className={inputCls(!!errors.university)}
                      autoFocus
                      maxLength={MAX_UNI_LENGTH}
                    />
                    {loadingUnis && (
                      <div className="absolute top-4 right-4">
                        <div className="border-brand/30 border-t-brand h-5 w-5 animate-spin rounded-full border-2" />
                      </div>
                    )}
                  </div>

                  <div className="custom-scrollbar max-h-48 space-y-2 overflow-y-auto pr-2">
                    {uniError && (
                      <p className="px-2 text-xs font-medium text-orange-400">
                        {uniError}
                      </p>
                    )}

                    {uniSearch.length >= 2 &&
                      uniResults.length === 0 &&
                      !loadingUnis &&
                      !useFallback && (
                        <p className="text-textDim px-2 text-xs">
                          No universities found. Try a different search or type
                          the full name.
                        </p>
                      )}

                    {uniResults.map((uni) => (
                      <button
                        key={uni}
                        onClick={() => {
                          set("university", uni);
                          setUniSearch(uni);
                        }}
                        className={cn(
                          "w-full rounded-xl border px-4 py-3 text-left text-sm transition-all",
                          form.university === uni
                            ? "bg-brand/10 border-brand text-brand-light"
                            : "bg-bgSurface border-borderMuted text-textMuted hover:bg-bgDeep hover:text-textMain",
                        )}
                      >
                        {uni}
                      </button>
                    ))}
                  </div>
                </Field>

                {uniSearch.length >= 2 &&
                  uniResults.length === 0 &&
                  !loadingUnis && (
                    <div className="mt-4 border-t border-white/10 pt-4">
                      <p className="text-textDim mb-2 text-xs">
                        Can't find your university?
                      </p>
                      <button
                        onClick={() => {
                          set("university", uniSearch);
                        }}
                        className="border-brand/50 text-brand-light hover:bg-brand/10 w-full rounded-xl border border-dashed px-4 py-3 text-left text-sm transition-all"
                      >
                        Use "{uniSearch}" as your university
                      </button>
                    </div>
                  )}

                <Field label="Exam Year">
                  <div className="grid grid-cols-2 gap-3">
                    {["2027"].map((yr) => (
                      <button
                        key={yr}
                        onClick={() => set("examYear", yr)}
                        className={cn(
                          "rounded-xl border py-3 text-sm font-bold transition-all",
                          form.examYear === yr
                            ? "bg-brand border-brand shadow-brand/20 text-white shadow-lg"
                            : "bg-bgSurface border-borderMuted text-textMuted hover:bg-bgDeep hover:text-textMain",
                        )}
                      >
                        JAMB {yr}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>
            )}

            {/* STEP 2: Subject Combo */}
            {step === 2 && (
              <div className="space-y-6">
                <header>
                  <h2 className="text-textMain mb-2 text-3xl font-bold">
                    Your Path
                  </h2>
                  <p className="text-textMuted">
                    Choose your area of study or create custom.
                  </p>
                </header>

                {/* Toggle Custom/Predefined */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setIsCustomSubjectMode(false);
                    }}
                    className={cn(
                      "rounded-xl border py-3 text-sm font-bold transition-all",
                      !isCustomSubjectMode
                        ? "bg-brand border-brand shadow-brand/20 text-white"
                        : "bg-bgSurface border-borderMuted text-textMuted",
                    )}
                  >
                    Predefined
                  </button>
                  <button
                    onClick={() => {
                      setIsCustomSubjectMode(true);
                      // Initialize custom mode with default custom subjects
                      if (!Array.isArray(form.subjectCombo)) {
                        setForm((prev) => ({
                          ...prev,
                          subjectCombo: [
                            "English",
                            "Mathematics",
                            "Physics",
                            "Chemistry",
                          ],
                        }));
                      }
                    }}
                    className={cn(
                      "rounded-xl border py-3 text-sm font-bold transition-all",
                      isCustomSubjectMode
                        ? "bg-brand border-brand shadow-brand/20 text-white"
                        : "bg-bgSurface border-borderMuted text-textMuted",
                    )}
                  >
                    Custom Combo
                  </button>
                </div>

                {/* Predefined Combos */}
                {!isCustomSubjectMode && (
                  <div className="space-y-3">
                    {SUBJECT_COMBOS.map((combo) => (
                      <button
                        key={combo.id}
                        onClick={() => set("subjectCombo", combo.id)}
                        className={cn(
                          "flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-all",
                          form.subjectCombo === combo.id
                            ? "bg-brand/10 border-brand shadow-sm"
                            : "bg-bgSurface border-borderMuted opacity-70 hover:opacity-100",
                        )}
                      >
                        <span className="text-2xl">{combo.icon}</span>
                        <div>
                          <p className="text-textMain font-bold">
                            {combo.label}
                          </p>
                          <p className="text-textDim text-xs">
                            {combo.subjects.join(" + ")}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Custom Combo Selector */}
                {isCustomSubjectMode && (
                  <div className="space-y-3">
                    <CustomSubjectSelector
                      selectedSubjects={
                        Array.isArray(form.subjectCombo)
                          ? form.subjectCombo
                          : ["English", "Mathematics", "Physics", "Chemistry"]
                      }
                      onChange={(subjects) => {
                        setForm((prev) => ({
                          ...prev,
                          subjectCombo: subjects,
                        }));
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* STEP 3: Target Score */}
            {step === 3 && (
              <div className="space-y-6">
                <header>
                  <h2 className="text-textMain mb-2 text-3xl font-bold">
                    Aim High
                  </h2>
                  <p className="text-textMuted">
                    Set a target to keep you motivated.
                  </p>
                </header>
                <div className="space-y-3">
                  {TARGET_SCORES.map((t) => (
                    <button
                      key={t.range}
                      onClick={() => set("targetScore", t.range)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-2xl border p-5 transition-all",
                        form.targetScore === t.range
                          ? "bg-brand/10 border-brand/30"
                          : "bg-bgSurface border-borderMuted",
                      )}
                    >
                      <div>
                        <p
                          className="text-xl font-black"
                          style={{ color: t.color }}
                        >
                          {t.range}
                        </p>
                        <p className="text-textMain text-xs font-bold">
                          {t.label}
                        </p>
                      </div>
                      <p className="text-textDim max-w-25 text-right text-[10px]">
                        {t.sub}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-10 flex flex-col gap-4">
              <div className="flex gap-4">
                {step > 1 && (
                  <Button
                    variant="secondary"
                    onClick={() => setStep((s) => s - 1)}
                    className="bg-bgSurface border-borderMuted"
                  >
                    Back
                  </Button>
                )}
                <Button variant="primary" fullWidth onClick={handleNext}>
                  {step === TOTAL_STEPS ? "Ready to Win" : "Next Step"}
                </Button>
              </div>

              <button
                onClick={() => setShowCancelModal(true)}
                className="text-textDim hover:text-danger py-2 text-xs transition-colors"
              >
                Cancel & Back to Sign Up
              </button>
            </div>
          </div>
        </div>

        {/* Confirm Cancel Modal */}
        <ConfirmModal
          isOpen={showCancelModal}
          onClose={() => setShowCancelModal(false)}
          onConfirm={handleCancel}
          title="Cancel Onboarding"
          message="Are you sure you want to cancel? You will be signed out and your progress will not be saved."
          confirmText="Yes, Cancel"
          cancelText="Go Back"
          type="danger"
        />
      </div>
    </>
  );
};

const Field: React.FC<{
  label?: string;
  error?: string;
  children: React.ReactNode;
}> = ({ label, error, children }) => (
  <div className="space-y-2">
    {label && (
      <label className="text-textDim ml-1 text-xs font-bold tracking-widest uppercase">
        {label}
      </label>
    )}
    {children}
    {error && <p className="text-danger ml-1 text-xs font-medium">{error}</p>}
  </div>
);

const inputCls = (hasError: boolean) =>
  cn(
    "w-full px-5 py-4 bg-bgSurface rounded-2xl border text-textMain font-medium transition-all",
    "placeholder:text-textDim/50 focus:outline-none focus:ring-2 focus:ring-brand/20",
    hasError ? "border-danger" : "border-borderMuted focus:border-brand/50",
  );

export default Onboarding;
