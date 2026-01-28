import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, ArrowLeft } from "lucide-react";
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

// Check if user explicitly navigated to login (from splash page buttons)
function isExplicitNavigation(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  // If mode param exists, user explicitly clicked a button
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
    console.log("[Login] Token exchange successful, setting token...");
    
    // Get the current Firebase user's UID to bind token readiness to this user
    const auth = getFirebaseAuth();
    const currentUid = auth?.currentUser?.uid || null;
    console.log("[Login] Current Firebase UID:", currentUid);
    
    setAuthToken(data.token, currentUid || undefined);
    
    console.log("[Login] Marking token as ready...");
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
    
    // If explicitly navigating to login, clear any stale auth cache
    // This ensures the login form is shown and prevents redirect loops
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
        console.log("[Login] Checking for redirect result on native platform");
        const idToken = await initializeRedirectResultHandler();
        if (idToken) {
          console.log("[Login] Got ID token from redirect, exchanging...");
          await exchangeTokenAndNavigate(idToken);
        }
      } catch (error: any) {
        console.error("[Login] Redirect result error:", error);
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

  // CRITICAL: Do NOT auto-redirect if:
  // 1. Logout is in progress (race condition prevention)
  // 2. User explicitly navigated here (clicked Login/Create Account/Forgot Password)
  // The explicit check allows users to re-authenticate with different credentials
  if (isAuthenticated && !isLoggingOut && !isExplicitNavigation()) {
    navigate("/");
    return null;
  }

  // Show loading state while checking for redirect result on native platforms
  if (isCheckingRedirect) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" data-testid="login-checking-redirect">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-muted-foreground">Completing sign in...</p>
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
      // On native platforms, signInWithRedirect throws an error because it navigates away
      // This is expected behavior - the redirect result will be handled when the app returns
      if (isNativePlatform() && error.message?.includes("Redirect initiated")) {
        console.log("[Login] Redirect initiated on native platform, waiting for return");
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

  const getHeaderText = () => {
    switch (mode) {
      case "signup":
        return { title: "Create an account", description: "Get started with GigAid" };
      case "forgot":
        return { title: "Reset your password", description: "We'll send you a link to reset your password" };
      default:
        return { title: "Welcome to GigAid", description: "Sign in to manage your jobs, leads, and invoices" };
    }
  };

  const headerText = getHeaderText();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-primary/10 p-4">
      <Card className="w-full max-w-md" data-testid="card-login">
        <CardHeader className="text-center">
          {mode === "forgot" && (
            <button
              type="button"
              onClick={() => setMode("signin")}
              className="absolute left-4 top-4 text-muted-foreground hover:text-foreground"
              data-testid="button-back-to-signin"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <CardTitle className="text-2xl font-bold">{headerText.title}</CardTitle>
          <CardDescription>{headerText.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {mode !== "forgot" && (
            <>
              <Button
                onClick={handleGoogleSignIn}
                disabled={isLoading || isEmailLoading}
                className="w-full gap-2"
                size="lg"
                variant="outline"
                data-testid="button-google-signin"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <SiGoogle className="h-5 w-5" />
                )}
                Continue with Google
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or continue with email</span>
                </div>
              </div>
            </>
          )}

          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading || isEmailLoading}
                data-testid="input-email"
              />
            </div>
            {mode !== "forgot" && (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    {mode === "signin" && (
                      <button
                        type="button"
                        onClick={() => setMode("forgot")}
                        className="text-xs text-primary hover:underline"
                        data-testid="button-forgot-password"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading || isEmailLoading}
                    data-testid="input-password"
                  />
                </div>
                {mode === "signup" && (
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="Confirm your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={isLoading || isEmailLoading}
                      data-testid="input-confirm-password"
                    />
                  </div>
                )}
              </>
            )}
            <Button
              type="submit"
              disabled={isLoading || isEmailLoading}
              className="w-full gap-2"
              size="lg"
              data-testid="button-email-submit"
            >
              {isEmailLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Mail className="h-5 w-5" />
              )}
              {mode === "forgot" ? "Send Reset Link" : mode === "signup" ? "Create Account" : "Sign In"}
            </Button>
          </form>

          {mode !== "forgot" && (
            <div className="text-center text-sm">
              <span className="text-muted-foreground">
                {mode === "signup" ? "Already have an account? " : "Don't have an account? "}
              </span>
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "signup" ? "signin" : "signup");
                  setPassword("");
                  setConfirmPassword("");
                }}
                className="text-primary hover:underline font-medium"
                data-testid="button-toggle-auth-mode"
              >
                {mode === "signup" ? "Sign in" : "Sign up"}
              </button>
            </div>
          )}
          
          <div className="text-center text-xs text-muted-foreground pt-2">
            By signing in, you agree to our Terms of Service and Privacy Policy
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
