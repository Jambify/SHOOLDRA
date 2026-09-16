// components/auth/AuthCallback.tsx

import { useEffect } from "react";
import { useNavigate } from "react-router";
import { supabase } from "../../lib/supabase";
import {
  getPostLoginDestination,
  useUserStore,
} from "../../Store/useUserStore";
import { motion } from "framer-motion";

const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const { syncProfile } = useUserStore(); // Removed setEmail since it's not used

  useEffect(() => {
    const handleAuthCallback = async () => {
      // Get the session after magic link click
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        console.error("Auth callback error:", error);
        navigate("/signin");
        return;
      }

      if (session) {
        // Wait for profile to sync
        await syncProfile();

        // Check post-login status off the FRESH store state
        const state = useUserStore.getState();
        const dest = getPostLoginDestination(state);
        navigate(dest.route, { replace: true });
      } else {
        navigate("/signin", { replace: true });
      }
    };

    handleAuthCallback();
  }, [navigate, syncProfile]);

  return (
    <div className="bg-bgMain flex min-h-screen items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center"
      >
        <div className="border-brand mx-auto mb-4 h-16 w-16 animate-spin rounded-full border-4 border-t-transparent"></div>
        <h2 className="text-xl text-white">Verifying your link...</h2>
        <p className="text-textDim mt-2">Please wait while we log you in.</p>
      </motion.div>
    </div>
  );
};

export default AuthCallback;
