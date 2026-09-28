import React, { useState } from "react";
import PageHelmet from "../components/SEO/PageHelmet";
import AppLayout from "../components/Layout/AppLayout";
import ProGate from "../components/pro/ProGate";
import { useNavigate } from "react-router";
import { Crown, CheckCircle } from "lucide-react";

const ProPage: React.FC = () => {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <AppLayout
      currentPage="pro"
      isSidebarOpen={isSidebarOpen}
      setIsSidebarOpen={setIsSidebarOpen}
    >
      <PageHelmet
        title="Pro | SCHOOLDRA"
        description="Explore Schooldra Pro membership benefits including AI explanations, full mock reviews, offline question packs, and performance analytics."
        canonical="https://www.schooldra.com/pro"
      />
      <div className="mx-auto max-w-4xl py-6">
        {/*
          No `title`/`description` props passed here — ProGate's default
          paywall copy applies. If not Pro (or still loading), ProGate
          renders its own skeleton/paywall and these children never mount.
        */}
        <ProGate>
          <div className="bg-bgCard border-borderMuted rounded-brand-xl animate-in fade-in slide-in-from-bottom-4 border p-8 text-center shadow-xl duration-500">
            <div className="bg-success/10 border-success/20 mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border">
              <Crown className="text-success h-10 w-10" />
            </div>
            <h1 className="font-display text-textMain mb-4 text-3xl font-bold">
              You're a Pro Member!
            </h1>
            <p className="text-textDim mx-auto mb-8 max-w-md leading-relaxed">
              Thank you for supporting Schooldra. You have access to AI
              explanations, detailed mock reviews, offline question packs,
              and performance analytics.
            </p>

            <div className="mx-auto mb-10 grid max-w-2xl gap-4 text-left sm:grid-cols-2">
              {[
                "AI Tutor explanations for practice questions",
                "Detailed mock exam review",
                "Downloadable question packs for offline study",
                "Performance analytics and weak-topic tracking",
                "Full access to available past questions",
                "Subject, year, topic, and difficulty filters",
              ].map((benefit) => (
                <div
                  key={benefit}
                  className="bg-bgSurface border-borderMuted flex items-center gap-3 rounded-2xl border p-4"
                >
                  <CheckCircle className="text-success h-5 w-5 shrink-0" />
                  <span className="text-textMain text-sm font-medium">
                    {benefit}
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={() => navigate("/dashboard")}
              className="bg-brand shadow-brand/20 hover:bg-brand-light rounded-full px-8 py-3 font-bold text-white shadow-lg transition-all active:scale-95"
            >
              Back to Dashboard
            </button>
          </div>
        </ProGate>
      </div>
    </AppLayout>
  );
};

export default ProPage;