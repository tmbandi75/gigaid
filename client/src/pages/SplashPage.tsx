import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Zap, RefreshCw, CreditCard, Lock, Loader2, ArrowLeft } from "lucide-react";
import { SiGoogle } from "react-icons/si";
import logoImage from "@assets/image_1768959787162.png";
import { signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword, initializeRedirectResultHandler } from "@/lib/firebase";
import { setAuthToken } from "@/lib/authToken";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { isNativePlatform } from "@/lib/platform";

type AuthMode = "signin" | "signup" | "forgot";

export default function SplashPage() {
  const [, navigate] = useLocation();
  const { refetchUser } = useAuth();
  const { toast } = useToast();
  
  // SplashPage is purely presentational - no auth redirect logic here
  // All auth routing is handled in App.tsx by AuthenticatedApp

  const [isLoading, setIsLoading] = useState(false);
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [isCheckingRedirect, setIsCheckingRedirect] = useState(isNativePlatform());
  const [mode, setMode] = useState<AuthMode>("signin");
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
    setAuthToken(data.token);
    localStorage.setItem("gigaid_splash_seen", "true");
    
    await refetchUser();
    navigate("/dashboard");
  };

  useEffect(() => {
    if (!isNativePlatform() || redirectHandledRef.current) {
      setIsCheckingRedirect(false);
      return;
    }

    redirectHandledRef.current = true;

    const handleRedirectResult = async () => {
      try {
        console.log("[SplashPage] Checking for redirect result on native platform");
        const idToken = await initializeRedirectResultHandler();
        if (idToken) {
          console.log("[SplashPage] Got ID token from redirect, exchanging...");
          await exchangeTokenAndNavigate(idToken);
        }
      } catch (error: any) {
        console.error("[SplashPage] Redirect result error:", error);
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

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      const idToken = await signInWithGoogle();
      await exchangeTokenAndNavigate(idToken);
    } catch (error: any) {
      if (isNativePlatform() && error.message?.includes("Redirect initiated")) {
        console.log("[SplashPage] Redirect initiated on native platform, waiting for return");
        return;
      }
      console.error("Sign in error:", error);
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
        console.error("Password reset error:", error);
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
      console.error("Email auth error:", error);
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

  // Show loading state while checking for redirect result on native platforms
  if (isCheckingRedirect) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center"
        style={{
          background: "linear-gradient(180deg, #4A90D9 0%, #3B7DD8 50%, #2B6BC7 100%)"
        }}
        data-testid="splash-checking-redirect"
      >
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-white" />
          <p className="mt-4 text-white/80">Completing sign in...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen flex flex-col px-6 py-8 overflow-auto"
      style={{
        background: "linear-gradient(180deg, #4A90D9 0%, #3B7DD8 50%, #2B6BC7 100%)"
      }}
      data-testid="page-splash"
    >
      {/* Header with logo */}
      <div className="flex items-center justify-center gap-3 mb-6">
        <img 
          src={logoImage} 
          alt="GigAid Logo" 
          className="w-12 h-12 rounded-xl"
          data-testid="img-splash-logo"
        />
        <span className="text-3xl font-bold text-white tracking-tight">
          Gig<span className="text-white/90">Aid</span>
        </span>
      </div>

      {/* Tagline - only show when not in forgot mode */}
      {mode !== "forgot" && (
        <>
          <h1 className="text-2xl font-bold text-white text-center mb-2" data-testid="text-headline">
            Turn jobs into money.
          </h1>
          
          <p className="text-base text-white/80 text-center mb-6" data-testid="text-subheadline">
            Booking, invoicing, and follow-ups—done for you.
          </p>

          {/* Feature list - compact */}
          <div className="space-y-2 mb-6 max-w-sm mx-auto">
            <div className="flex items-center gap-2 text-white">
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                <Zap className="w-3 h-3" />
              </div>
              <span className="text-sm font-medium">Send invoices in seconds</span>
            </div>
            <div className="flex items-center gap-2 text-white">
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                <RefreshCw className="w-3 h-3" />
              </div>
              <span className="text-sm font-medium">Automatic follow-ups</span>
            </div>
            <div className="flex items-center gap-2 text-white">
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                <CreditCard className="w-3 h-3" />
              </div>
              <span className="text-sm font-medium">Get paid without chasing</span>
            </div>
          </div>
        </>
      )}

      {/* Forgot password header */}
      {mode === "forgot" && (
        <div className="text-center mb-6">
          <button
            type="button"
            onClick={() => setMode("signin")}
            className="absolute left-4 top-4 text-white/70 hover:text-white p-2"
            data-testid="button-back-to-signin"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-2xl font-bold text-white mb-2">Reset your password</h1>
          <p className="text-white/80">We'll send you a link to reset your password</p>
        </div>
      )}

      {/* Auth Form */}
      <div className="w-full max-w-sm mx-auto flex-1 flex flex-col">
        {/* Google Sign In - hide for forgot password */}
        {mode !== "forgot" && (
          <>
            <Button
              onClick={handleGoogleSignIn}
              disabled={isLoading || isEmailLoading}
              className="w-full h-12 text-base font-semibold rounded-full bg-white hover:bg-gray-100 text-gray-900 shadow-lg gap-2"
              data-testid="button-google-signin"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <SiGoogle className="h-5 w-5" />
              )}
              Continue with Google
            </Button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-white/30" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-transparent px-2 text-white/70">Or continue with email</span>
              </div>
            </div>
          </>
        )}

        {/* Email/Password Form */}
        <form onSubmit={handleEmailAuth} className="space-y-3">
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading || isEmailLoading}
            className="h-12 rounded-full bg-white/10 border-white/30 text-white placeholder:text-white/60 focus:bg-white/20"
            data-testid="input-email"
          />
          
          {mode !== "forgot" && (
            <>
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading || isEmailLoading}
                className="h-12 rounded-full bg-white/10 border-white/30 text-white placeholder:text-white/60 focus:bg-white/20"
                data-testid="input-password"
              />
              
              {mode === "signup" && (
                <Input
                  type="password"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoading || isEmailLoading}
                  className="h-12 rounded-full bg-white/10 border-white/30 text-white placeholder:text-white/60 focus:bg-white/20"
                  data-testid="input-confirm-password"
                />
              )}
            </>
          )}

          <Button
            type="submit"
            disabled={isLoading || isEmailLoading}
            className="w-full h-12 text-base font-semibold rounded-full bg-white hover:bg-gray-100 text-gray-900 shadow-lg"
            data-testid="button-email-submit"
          >
            {isEmailLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              mode === "forgot" ? "Send Reset Link" : mode === "signup" ? "Create Account" : "Sign In"
            )}
          </Button>
        </form>

        {/* Forgot password link - only show in signin mode */}
        {mode === "signin" && (
          <button
            type="button"
            onClick={() => setMode("forgot")}
            className="w-full text-center text-white/70 hover:text-white py-3 text-sm underline cursor-pointer"
            data-testid="button-forgot-password"
          >
            Forgot your password?
          </button>
        )}

        {/* Toggle between signin and signup */}
        {mode !== "forgot" && (
          <div className="text-center text-sm mt-4">
            <span className="text-white/70">
              {mode === "signup" ? "Already have an account? " : "Don't have an account? "}
            </span>
            <button
              type="button"
              onClick={() => {
                setMode(mode === "signup" ? "signin" : "signup");
                setPassword("");
                setConfirmPassword("");
              }}
              className="text-white hover:underline font-medium"
              data-testid="button-toggle-auth-mode"
            >
              {mode === "signup" ? "Sign in" : "Sign up"}
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-6 space-y-2">
        <div className="flex items-center justify-center gap-2 text-white/60 text-xs">
          <Lock className="w-3 h-3" />
          <span>Secure payments powered by <strong className="font-semibold">stripe</strong></span>
        </div>
        <div className="text-center text-xs text-white/50">
          By signing in, you agree to our Terms of Service and Privacy Policy
        </div>
      </div>
    </div>
  );
}
