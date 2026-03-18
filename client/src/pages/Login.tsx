import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { SiGoogle } from "react-icons/si";
import { signInWithEmail, signUpWithEmail, resetPassword, getFirebaseAuth } from "@/lib/firebase";
import { setAuthToken, clearAuthToken } from "@/lib/authToken";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { logger } from "@/lib/logger";

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
  const { setTokenReady, signInWithGoogle } = useFirebaseAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [isCheckingRedirect] = useState(false);
  const [mode, setMode] = useState<AuthMode>(getInitialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);


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
      queryClient.setQueryData(QUERY_KEYS.authUser(), null);
    }
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
      logger.error('[Auth] Email auth error:', error?.code, error?.message, error);
      let message = error?.message || "Please try again";
      if (error.code === "auth/email-already-in-use") {
        message = "An account with this email already exists. Try signing in instead.";
      } else if (error.code === "auth/invalid-email") {
        message = "Please enter a valid email address";
      } else if (error.code === "auth/user-not-found" || error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") {
        message = "Invalid email or password";
      } else if (error.code === "auth/weak-password") {
        message = "Password should be at least 6 characters";
      } else if (error.code === "auth/too-many-requests") {
        message = "Too many attempts. Please wait a moment and try again.";
      } else if (error.code === "auth/network-request-failed") {
        message = "Network error. Please check your connection and try again.";
      } else if (error.code === "auth/operation-not-allowed") {
        message = "Email/password sign-in is not enabled. Please contact support.";
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
          <div className="text-center">
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
            <h1 className="text-3xl font-bold text-white mb-1">
              {mode === "forgot" 
                ? "Reset Password" 
                : mode === "signup" 
                  ? "Join GigAid™" 
                  : "Welcome to GigAid™"}
            </h1>
            <p className="text-white/80 text-sm" data-testid="text-login-value-prop">
              Manage leads, bookings, and follow-ups in one place
            </p>
            {mode === "forgot" && (
              <p className="text-white/70 text-sm mt-2">We'll send you a reset link</p>
            )}
          </div>

          {mode === "signup" && (
            <div className="flex items-start space-x-3 bg-white/10 backdrop-blur rounded-xl p-3" data-testid="terms-agreement">
              <Checkbox
                id="termsAccepted"
                checked={termsAccepted}
                onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                className="border-white/50 data-[state=checked]:bg-white data-[state=checked]:text-[#4F46E5] mt-0.5"
                data-testid="checkbox-terms"
              />
              <label htmlFor="termsAccepted" className="text-xs text-white/80 leading-relaxed cursor-pointer">
                I have read and agree to the{' '}
                <a
                  href="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-white hover:text-white/90"
                  data-testid="link-terms"
                  onClick={(e) => e.stopPropagation()}
                >
                  Terms of Service
                </a>
                {' '}and{' '}
                <a
                  href="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-white hover:text-white/90"
                  data-testid="link-privacy"
                  onClick={(e) => e.stopPropagation()}
                >
                  Privacy Policy
                </a>
              </label>
            </div>
          )}

          {/* Google Sign In - not shown in forgot mode */}
          {mode !== "forgot" && (
            <>
              <Button
                onClick={handleGoogleSignIn}
                disabled={isDisabled || (mode === "signup" && !termsAccepted)}
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
              <div className="relative flex items-center py-1">
                <div className="flex-1 border-t border-white/20" />
                <span className="px-3 text-white/40 text-xs">OR</span>
                <div className="flex-1 border-t border-white/20" />
              </div>
            </>
          )}

          {/* Email/Password Form */}
          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div>
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isDisabled}
                className="h-12 bg-white/90 border-0 rounded-full px-5 text-gray-700 placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-white/50"
                data-testid="input-email"
              />
              {mode === "signin" && (
                <p className="text-white/50 text-xs mt-1.5 px-2">Use this if you didn't sign up with Google</p>
              )}
            </div>
            
            {mode !== "forgot" && (
              <>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isDisabled}
                    className="h-12 bg-white/90 border-0 rounded-full px-5 pr-12 text-gray-700 placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-white/50"
                    data-testid="input-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors p-1"
                    data-testid="button-toggle-password-visibility"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                
                {mode === "signup" && (
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm Password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={isDisabled}
                      className="h-12 bg-white/90 border-0 rounded-full px-5 pr-12 text-gray-700 placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-white/50"
                      data-testid="input-confirm-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors p-1"
                      data-testid="button-toggle-confirm-password-visibility"
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                )}
              </>
            )}

            <Button
              type="submit"
              disabled={isDisabled || (mode === "signup" && !termsAccepted)}
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
                className="text-white/90 hover:text-white hover:underline text-sm font-medium transition-colors"
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
