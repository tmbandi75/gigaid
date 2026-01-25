import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, ArrowLeft } from "lucide-react";
import { SiGoogle } from "react-icons/si";
import { signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword } from "@/lib/firebase";
import { setAuthToken } from "@/lib/authToken";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

type AuthMode = "signin" | "signup" | "forgot";

export default function Login() {
  const [, navigate] = useLocation();
  const { isAuthenticated, isLoggingOut, refetchUser } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // CRITICAL: Do NOT auto-redirect if logout is in progress
  // This prevents the race condition where isAuthenticated briefly flips true
  // during logout teardown
  if (isAuthenticated && !isLoggingOut) {
    navigate("/");
    return null;
  }

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
    
    await refetchUser();
    navigate("/");
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      const idToken = await signInWithGoogle();
      await exchangeTokenAndNavigate(idToken);
    } catch (error: any) {
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
