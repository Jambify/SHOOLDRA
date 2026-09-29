
import React, { useEffect } from 'react';
import { useUserStore } from '../../Store/useUserStore';

const FrozenAccountGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isFrozen, signOut, syncProfile, isAuthenticated } = useUserStore();

  useEffect(() => {
    // Re-sync profile on mount to check for frozen status
    if (isAuthenticated) {
      syncProfile(true);
    }
  }, [isAuthenticated, syncProfile]);

  useEffect(() => {
    if (isFrozen && isAuthenticated) {
      // Sign out after showing message
      const timer = setTimeout(() => {
        signOut();
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [isFrozen, isAuthenticated, signOut]);

  if (isFrozen) {
    return (
      <div className="min-h-screen bg-bgMain flex items-center justify-center p-4">
        <div className="bg-bgCard border border-red-500/30 rounded-brand-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-textMain mb-2">Account Frozen</h2>
          <p className="text-textDim mb-6">
            Your account has been temporarily frozen. Please contact support@schooldra.com for assistance.
          </p>
          <div className="text-xs text-textDim animate-pulse">
            Signing you out in 10 seconds...
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default FrozenAccountGuard;
