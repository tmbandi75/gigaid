import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowLeft } from "lucide-react";
import { SiGoogle } from "react-icons/si";
import { signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword, initializeRedirectResultHandler, getFirebaseAuth } from "@/lib/firebase";
import { setAuthToken, clearAuthToken } from "@/lib/authToken";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { isNativePlatform } from "@/lib/platform";
import { queryClient } from "@/lib/queryClient";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";

type AuthMode = "signin" | "signup" | "forgot";

function getInitialMode(): AuthMode {
  if (typeof window === "undefined") return "signin";
  const params = new URLSearchParams(window.location.search);
  const modeParam = params.get("mode");
  if (modeParam === "signup" || modeParam === "forgot") {
    return modeParam;
  }
  return "signin";
}

function isExplicitNavigation(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.has("mode");
}

export default function Login() {
  const [, navigate] = useLocation();
  const { isAuthenticated, isLoggingOut, refetchUser } = useAuth();
  const { toast } = useToast();
  const { setTokenReady } = useFirebaseAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [isCheckingRedirect, setIsCheckingRedirect] = useState(isNativePlatform());
  const [mode, setMode] = useState<AuthMode>(getInitialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const redirectHandledRef = useRef(false);

  const exchangeTokenAndNavigate = async (idToken: string) => {
    const response = await fetch("/api/auth/web/firebase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Authentication failed");
    }

    const data = await response.json();
    const auth = getFirebaseAuth();
    const currentUid = auth?.currentUser?.uid || null;
    
    setAuthToken(data.token, currentUid || undefined);
    setTokenReady(true);
    
    await refetchUser();
    navigate("/");
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const modeParam = params.get("mode");
    if (modeParam === "signup" || modeParam === "forgot" || modeParam === "signin") {
      setMode(modeParam as AuthMode);
    }
    
    if (isExplicitNavigation()) {
      clearAuthToken();
      queryClient.setQueryData(["/api/auth/user"], null);
    }
  }, []);

  useEffect(() => {
    if (!isNativePlatform() || redirectHandledRef.current) {
      setIsCheckingRedirect(false);
      return;
    }

    redirectHandledRef.current = true;

    const handleRedirectResult = async () => {
      try {
        const idToken = await initializeRedirectResultHandler();
        if (idToken) {
          await exchangeTokenAndNavigate(idToken);
        }
      } catch (error: any) {
        toast({
          title: "Sign in failed",
          description: error.message || "Please try again",
          variant: "destructive",
        });
      } finally {
        setIsCheckingRedirect(false);
      }
    };

    handleRedirectResult();
  }, []);

  if (isAuthenticated && !isLoggingOut && !isExplicitNavigation()) {
    navigate("/");
    return null;
  }

  if (isCheckingRedirect) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#4F46E5]" data-testid="login-checking-redirect">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-white" />
          <p className="mt-4 text-white/80">Completing sign in...</p>
        </div>
      </div>
    );
  }

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      const idToken = await signInWithGoogle();
      await exchangeTokenAndNavigate(idToken);
    } catch (error: any) {
      if (isNativePlatform() && error.message?.includes("Redirect initiated")) {
        return;
      }
      toast({
        title: "Sign in failed",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast({
        title: "Missing email",
        description: "Please enter your email address",
        variant: "destructive",
      });
      return;
    }

    if (mode === "forgot") {
      setIsEmailLoading(true);
      try {
        await resetPassword(email);
        toast({
          title: "Reset email sent",
          description: "Check your inbox for a password reset link",
        });
        setMode("signin");
      } catch (error: any) {
        let message = "Please try again";
        if (error.code === "auth/user-not-found") {
          message = "No account found with this email";
        } else if (error.code === "auth/invalid-email") {
          message = "Please enter a valid email address";
        }
        toast({
          title: "Reset failed",
          description: message,
          variant: "destructive",
        });
      } finally {
        setIsEmailLoading(false);
      }
      return;
    }

    if (!password) {
      toast({
        title: "Missing password",
        description: "Please enter your password",
        variant: "destructive",
      });
      return;
    }

    if (mode === "signup" && password !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure your passwords match",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }

    setIsEmailLoading(true);
    try {
      const idToken = mode === "signup" 
        ? await signUpWithEmail(email, password)
        : await signInWithEmail(email, password);
      await exchangeTokenAndNavigate(idToken);
    } catch (error: any) {
      let message = "Please try again";
      if (error.code === "auth/email-already-in-use") {
        message = "An account with this email already exists";
      } else if (error.code === "auth/invalid-email") {
        message = "Please enter a valid email address";
      } else if (error.code === "auth/user-not-found" || error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") {
        message = "Invalid email or password";
      } else if (error.code === "auth/weak-password") {
        message = "Password is too weak";
      }
      toast({
        title: mode === "signup" ? "Sign up failed" : "Sign in failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsEmailLoading(false);
    }
  };

  const isDisabled = isLoading || isEmailLoading;

  return (
    <div className="min-h-screen relative overflow-hidden" data-testid="login-page">
      {/* Blue gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#6366F1] via-[#4F46E5] to-[#3730A3]" />
      
      {/* Decorative floating shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Top right large circle */}
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-[#818CF8]/30 rounded-full blur-sm" />
        {/* Top right small circle */}
        <div className="absolute top-16 right-10 w-20 h-20 bg-[#6366F1]/50 rounded-full" />
        {/* Middle right blob */}
        <div className="absolute top-1/4 -right-10 w-40 h-40 bg-[#4338CA]/40 rounded-full blur-md" />
        {/* Bottom left large circle */}
        <div className="absolute -bottom-16 -left-16 w-56 h-56 bg-[#818CF8]/25 rounded-full" />
        {/* Bottom center blob */}
        <div className="absolute bottom-32 left-1/4 w-24 h-24 bg-[#6366F1]/30 rounded-full blur-sm" />
        {/* Mid-left accent */}
        <div className="absolute top-1/2 -left-8 w-32 h-32 bg-[#4338CA]/30 rounded-full blur-md" />
      </div>

      {/* Content */}
      <div className="relative min-h-screen flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            {mode === "forgot" && (
              <button
                type="button"
                onClick={() => setMode("signin")}
                className="absolute left-6 top-6 text-white/80 hover:text-white transition-colors"
                data-testid="button-back-to-signin"
              >
                <ArrowLeft className="h-6 w-6" />
              </button>
            )}
            <h1 className="text-3xl font-bold text-white">
              {mode === "forgot" 
                ? "Reset Password" 
                : mode === "signup" 
                  ? "Join GigAid™" 
                  : "Welcome to GigAid™"}
            </h1>
            {mode === "forgot" && (
              <p className="text-white/70 text-sm">We'll send you a reset link</p>
            )}
          </div>

          {/* Google Sign In - not shown in forgot mode */}
          {mode !== "forgot" && (
            <>
              <Button
                onClick={handleGoogleSignIn}
                disabled={isDisabled}
                className="w-full h-12 gap-3 bg-white hover:bg-gray-50 text-gray-700 font-medium rounded-full shadow-lg"
                data-testid="button-google-signin"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <SiGoogle className="h-5 w-5" />
                )}
                Continue with Google
              </Button>

              {/* OR Divider */}
              <div className="relative flex items-center py-2">
                <div className="flex-1 border-t border-white/30" />
                <span className="px-4 text-white/60 text-sm font-medium">OR</span>
                <div className="flex-1 border-t border-white/30" />
              </div>
            </>
          )}

          {/* Email/Password Form */}
          <form onSubmit={handleEmailAuth} className="space-y-4">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isDisabled}
              className="h-12 bg-white/90 border-0 rounded-full px-5 text-gray-700 placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-white/50"
              data-testid="input-email"
            />
            
            {mode !== "forgot" && (
              <>
                <Input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isDisabled}
                  className="h-12 bg-white/90 border-0 rounded-full px-5 text-gray-700 placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-white/50"
                  data-testid="input-password"
                />
                
                {mode === "signup" && (
                  <Input
                    type="password"
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isDisabled}
                    className="h-12 bg-white/90 border-0 rounded-full px-5 text-gray-700 placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-white/50"
                    data-testid="input-confirm-password"
                  />
                )}
              </>
            )}

            <Button
              type="submit"
              disabled={isDisabled}
              className="w-full h-12 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold rounded-full shadow-lg"
              data-testid="button-email-submit"
            >
              {isEmailLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : mode === "forgot" ? (
                "Send Reset Link"
              ) : mode === "signup" ? (
                "Create Account"
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          {/* Links */}
          <div className="text-center space-y-3">
            {mode === "signin" && (
              <button
                type="button"
                onClick={() => setMode("forgot")}
                className="text-white/80 hover:text-white text-sm transition-colors"
                data-testid="button-forgot-password"
              >
                Forgot password?
              </button>
            )}
            
            {mode !== "forgot" && (
              <p className="text-white/80 text-sm">
                {mode === "signup" ? "Already have an account? " : "No account? "}
                <button
                  type="button"
                  onClick={() => {
                    setMode(mode === "signup" ? "signin" : "signup");
                    setPassword("");
                    setConfirmPassword("");
                  }}
                  className="text-white font-semibold hover:underline"
                  data-testid="button-toggle-auth-mode"
                >
                  {mode === "signup" ? "Sign in" : "Sign up"}
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
