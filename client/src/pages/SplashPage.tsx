import { Button } from "@/components/ui/button";
import { Zap, RefreshCw, CreditCard, Lock } from "lucide-react";
import logoImage from "@assets/image_1768959787162.png";
import { clearAuthToken } from "@/lib/authToken";
import { firebaseSignOut } from "@/lib/firebase";
import { queryClient } from "@/lib/queryClient";

export default function SplashPage() {
  // Full auth reset and hard redirect to login page
  // Uses window.location.href to ensure complete page reload and fresh React state
  const navigateToLogin = async (mode: "signin" | "signup" | "forgot") => {
    // Step 1: Clear app JWT token
    clearAuthToken();
    
    // Step 2: Clear React Query cache to prevent stale auth state
    queryClient.setQueryData(["/api/auth/user"], null);
    queryClient.clear();
    
    // Step 3: Sign out from Firebase silently
    try {
      await firebaseSignOut();
    } catch (e) {
      // Ignore errors
    }
    
    // Step 4: Clear server session
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
    } catch (e) {
      // Ignore errors
    }
    
    // Step 5: Mark splash as seen
    localStorage.setItem("gigaid_splash_seen", "true");
    
    // Step 6: Hard redirect to force full page reload with fresh React state
    window.location.href = `/login?mode=${mode}`;
  };

  const handleLogIn = () => {
    navigateToLogin("signin");
  };

  const handleCreateAccount = () => {
    navigateToLogin("signup");
  };

  const handleForgotPassword = () => {
    navigateToLogin("forgot");
  };

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-between px-6 py-12"
      style={{
        background: "linear-gradient(180deg, #4A90D9 0%, #3B7DD8 50%, #2B6BC7 100%)"
      }}
      data-testid="page-splash"
    >
      <div className="flex-1 flex flex-col items-center justify-center max-w-md w-full">
        <div className="flex items-center gap-3 mb-10">
          <img 
            src={logoImage} 
            alt="GigAid Logo" 
            className="w-16 h-16 rounded-xl"
            data-testid="img-splash-logo"
          />
          <span className="text-4xl font-bold text-white tracking-tight">
            Gig<span className="text-white/90">Aid</span>
          </span>
        </div>

        <h1 className="text-4xl font-bold text-white text-center mb-4" data-testid="text-headline">
          Turn jobs into money.
        </h1>
        
        <p className="text-lg text-white/80 text-center mb-10" data-testid="text-subheadline">
          Booking, invoicing, and follow-ups—<br />done for you.
        </p>

        <div className="space-y-4 mb-10">
          <div className="flex items-center gap-3 text-white">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
            <span className="text-lg font-medium">Send invoices in seconds</span>
          </div>
          <div className="flex items-center gap-3 text-white">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <RefreshCw className="w-4 h-4" />
            </div>
            <span className="text-lg font-medium">Automatic follow-ups</span>
          </div>
          <div className="flex items-center gap-3 text-white">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
            <span className="text-lg font-medium">Get paid without chasing</span>
          </div>
        </div>
      </div>

      <div className="w-full max-w-md space-y-4 pb-8">
        <Button
          onClick={handleLogIn}
          className="w-full h-14 text-lg font-semibold rounded-full bg-white hover:bg-gray-100 text-gray-900 shadow-lg"
          data-testid="button-log-in"
        >
          Log in
        </Button>
        
        <Button
          onClick={handleCreateAccount}
          variant="outline"
          className="w-full h-14 text-lg font-semibold rounded-full border-2 border-white/50 bg-transparent hover:bg-white/10 text-white"
          data-testid="button-create-account"
        >
          Create an account
        </Button>

        <button
          type="button"
          onClick={handleForgotPassword}
          className="w-full text-center text-white/70 hover:text-white py-2 text-base underline cursor-pointer"
          data-testid="button-forgot-password"
        >
          Forgot your password?
        </button>
      </div>

      <div className="flex items-center gap-2 text-white/60 text-sm pb-4">
        <Lock className="w-4 h-4" />
        <span>Secure payments powered by <strong className="font-semibold">stripe</strong></span>
      </div>
    </div>
  );
}
