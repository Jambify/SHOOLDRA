import React from "react";
import { Navigate, useLocation } from "react-router";
import PageHelmet from "../components/SEO/PageHelmet";
import ProGate from "../components/pro/ProGate";

type RenewalLocationState = {
  fromProStatus?: boolean;
};

const RenewPro: React.FC = () => {
  const location = useLocation();
  const state = location.state as RenewalLocationState | null;

  if (!state?.fromProStatus) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <>
      <PageHelmet
        title="Renew Schooldra Pro | SCHOOLDRA"
        description="Renew your Schooldra Pro access for continued AI explanations, offline question packs, performance analytics, and mock exam review."
        canonical="https://www.schooldra.com/pro"
      />
      {/*
        No children = paywall-only mode: ProGate always shows the payment
        UI here, regardless of current Pro status — which is exactly what
        a renewal page needs (a student can top up early even while still
        Pro). ProGate's own success screen confirms the renewal; it no
        longer needs a forced page reload to reflect the new expiry.
      */}
      <ProGate
        title="Renew Schooldra Pro"
        description="Add another 30 days on top of whatever you already have left — nothing is lost."
      />
    </>
  );
};

export default RenewPro;