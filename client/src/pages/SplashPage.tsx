import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowLeft, Phone } from "lucide-react";
import { SiGoogle, SiApple } from "react-icons/si";
import { PhoneAuthFlow } from "@/components/mobile-auth/PhoneAuthFlow";
import { signInWithEmail, signUpWithEmail, resetPassword, getFirebaseAuth } from "@/lib/firebase";
import {
  cleanupAfterDeletedAccountExchange,
  isAccountDeletedExchangePayload,
  shouldShowDeletedAccountToast,
} from "@/lib/firebaseAuthExchange";
import { setAuthToken } from "@/lib/authToken";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { logger } from "@/lib/logger";

type AuthMode = "signin" | "signup" | "forgot";

export default function SplashPage() {
  const [, navigate] = useLocation();
  const { refetchUser } = useAuth();
  const { toast } = useToast();
  const { setTokenReady, signInWithGoogle, signInWithApple } = useFirebaseAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [showPhoneAuth, setShowPhoneAuth] = useState(false);
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const exchangeTokenAndNavigate = async (idToken: string) => {
    const response = await fetch("/api/auth/web/firebase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });

    let body: unknown = null;
    try {
      const text = await response.text();
      if (text) body = JSON.parse(text) as unknown;
    } catch {
      body = null;
    }

    if (response.status === 403 && isAccountDeletedExchangePayload(body)) {
      await cleanupAfterDeletedAccountExchange();
      setTokenReady(false);
      if (shouldShowDeletedAccountToast()) {
        const msg =
          body &&
          typeof body === "object" &&
          "error" in body &&
          typeof (body as { error: unknown }).error === "string"
            ? (body as { error: string }).error
            : "This account was deleted and cannot be used to sign in.";
        toast({
          title: "Account closed",
          description: msg,
          variant: "destructive",
        });
      }
      return;
    }

    if (!response.ok) {
      const errMsg =
        body &&
        typeof body === "object" &&
        "error" in body &&
        typeof (body as { error: unknown }).error === "string"
          ? (body as { error: string }).error
          : "Authentication failed";
      throw new Error(errMsg);
    }

    const data = body as { token?: string };
    if (!data?.token || typeof data.token !== "string") {
      throw new Error("Authentication failed");
    }
    const auth = getFirebaseAuth();
    const currentUid = auth?.currentUser?.uid || null;
    
    setAuthToken(data.token, currentUid || undefined);
    setTokenReady(true);
    
    await refetchUser();
    navigate("/dashboard");
  };

  const handleAppleSignIn = async () => {
    if (isAppleLoading) return;
    setIsAppleLoading(true);
    try {
      const idToken = await signInWithApple();
      await exchangeTokenAndNavigate(idToken);
    } catch (err: any) {
      toast({
        title: "Sign in failed",
        description: err.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAppleLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    
    try {
      const timeoutMs = 60000;
      const idTokenPromise = signInWithGoogle();
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Google sign-in timed out. Please try again.")), timeoutMs)
      );
      const idToken = await Promise.race([idTokenPromise, timeoutPromise]);
      await exchangeTokenAndNavigate(idToken);
    } catch (err: any) {
      const description = err.message || "Something went wrong. Please try again.";
      toast({
        title: "Sign in failed",
        description,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhoneSignIn = () => {
    setShowPhoneAuth(true);
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
      } catch (err: any) {
        let message = "Please try again";
        if (err.code === "auth/user-not-found") {
          message = "No account found with this email";
        } else if (err.code === "auth/invalid-email") {
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
    } catch (err: any) {
      logger.error('[Auth] Email auth error:', err?.code, err?.message, err);
      let message = err?.message || "Please try again";
      if (err.code === "auth/email-already-in-use") {
        message = "An account with this email already exists. Try signing in instead.";
      } else if (err.code === "auth/invalid-email") {
        message = "Please enter a valid email address";
      } else if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        message = "Invalid email or password";
      } else if (err.code === "auth/weak-password") {
        message = "Password should be at least 6 characters";
      } else if (err.code === "auth/too-many-requests") {
        message = "Too many attempts. Please wait a moment and try again.";
      } else if (err.code === "auth/network-request-failed") {
        message = "Network error. Please check your connection and try again.";
      } else if (err.code === "auth/operation-not-allowed") {
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

  const isDisabled = isLoading || isAppleLoading || isEmailLoading;

  if (showPhoneAuth) {
    return (
      <PhoneAuthFlow
        onBack={() => setShowPhoneAuth(false)}
        onFirebaseIdToken={exchangeTokenAndNavigate}
      />
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden" data-testid="splash-page">
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

          {/* Social Sign In - not shown in forgot mode */}
          {mode !== "forgot" && (
            <>
              <Button
                onClick={handleAppleSignIn}
                disabled={isDisabled}
                variant="outline"
                className="w-full h-12 gap-3 rounded-full border-2 border-white/55 bg-white/10 text-white font-semibold shadow-md hover:bg-white/20"
                data-testid="button-apple-signin"
              >
                {isAppleLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <SiApple className="h-5 w-5" />
                )}
                Continue with Apple
              </Button>

              <Button
                onClick={handleGoogleSignIn}
                disabled={isDisabled}
                variant="outline"
                className="w-full h-12 gap-3 rounded-full border-2 border-white/55 bg-white/10 text-white font-semibold shadow-md hover:bg-white/20"
                data-testid="button-google-signin"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <SiGoogle className="h-5 w-5" />
                )}
                Continue with Google
              </Button>

              <Button
                onClick={handlePhoneSignIn}
                disabled={isDisabled}
                variant="outline"
                className="w-full h-12 gap-3 rounded-full border-2 border-white/55 bg-white/10 text-white font-semibold shadow-md hover:bg-white/20"
                data-testid="button-phone-signin"
              >
                <Phone className="h-5 w-5" />
                Continue with Phone
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
