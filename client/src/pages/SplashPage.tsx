import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { SiGoogle } from "react-icons/si";
import { signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword } from "@/lib/firebase";
import { setAuthToken } from "@/lib/authToken";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";

type AuthMode = "signin" | "signup" | "forgot";

export default function SplashPage() {
  const [, navigate] = useLocation();
  const { refetchUser } = useAuth();
  const { toast } = useToast();
  const { setTokenReady } = useFirebaseAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const exchangeTokenAndNavigate = async (idToken: string) => {
    console.log("[Login] Exchanging token with server...");
    const response = await fetch("/api/auth/web/firebase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Authentication failed");
    }

    const data = await response.json();
    console.log("[Login] Token exchange successful, setting token...");
    setAuthToken(data.token);
    
    console.log("[Login] Marking token as ready...");
    setTokenReady(true);
    
    console.log("[Login] Refetching user and navigating...");
    await refetchUser();
    navigate("/dashboard");
  };

  const handleGoogleSignIn = async () => {
    console.log("[Login] Google sign-in clicked");
    setIsLoading(true);
    setError(null);
    
    try {
      console.log("[Login] Calling signInWithGoogle...");
      const idToken = await signInWithGoogle();
      console.log("[Login] Got ID token, exchanging...");
      await exchangeTokenAndNavigate(idToken);
    } catch (err: any) {
      console.error("[Login] Google sign-in error:", err);
      setError(err.message || "Sign in failed");
      toast({
        title: "Sign in failed",
        description: err.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!email) {
      setError("Please enter your email address");
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
        setError(err.message || "Reset failed");
      } finally {
        setIsEmailLoading(false);
      }
      return;
    }

    if (!password) {
      setError("Please enter your password");
      return;
    }

    if (mode === "signup" && password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsEmailLoading(true);
    try {
      const idToken = mode === "signup" 
        ? await signUpWithEmail(email, password)
        : await signInWithEmail(email, password);
      await exchangeTokenAndNavigate(idToken);
    } catch (err: any) {
      console.error("[Login] Email auth error:", err);
      setError(err.message || "Authentication failed");
    } finally {
      setIsEmailLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">GigAid</h1>
          <p className="text-muted-foreground">
            {mode === "signin" && "Sign in to your account"}
            {mode === "signup" && "Create a new account"}
            {mode === "forgot" && "Reset your password"}
          </p>
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
            {error}
          </div>
        )}

        <Button
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          className="w-full"
          variant="outline"
          size="lg"
          data-testid="button-google-signin"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <SiGoogle className="w-4 h-4 mr-2" />
          )}
          Continue with Google
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Or</span>
          </div>
        </div>

        <form onSubmit={handleEmailAuth} className="space-y-4">
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isEmailLoading}
            data-testid="input-email"
          />
          
          {mode !== "forgot" && (
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isEmailLoading}
              data-testid="input-password"
            />
          )}

          {mode === "signup" && (
            <Input
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isEmailLoading}
              data-testid="input-confirm-password"
            />
          )}

          <Button
            type="submit"
            disabled={isEmailLoading}
            className="w-full"
            data-testid="button-email-submit"
          >
            {isEmailLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {mode === "signin" && "Sign in"}
            {mode === "signup" && "Sign up"}
            {mode === "forgot" && "Send reset email"}
          </Button>
        </form>

        <div className="text-center space-y-2 text-sm">
          {mode === "signin" && (
            <>
              <button
                type="button"
                onClick={() => setMode("forgot")}
                className="text-muted-foreground hover:underline"
                data-testid="button-forgot-password"
              >
                Forgot password?
              </button>
              <div>
                <span className="text-muted-foreground">No account? </span>
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className="text-primary hover:underline"
                  data-testid="button-switch-signup"
                >
                  Sign up
                </button>
              </div>
            </>
          )}
          
          {mode === "signup" && (
            <div>
              <span className="text-muted-foreground">Have an account? </span>
              <button
                type="button"
                onClick={() => setMode("signin")}
                className="text-primary hover:underline"
                data-testid="button-switch-signin"
              >
                Sign in
              </button>
            </div>
          )}

          {mode === "forgot" && (
            <button
              type="button"
              onClick={() => setMode("signin")}
              className="text-primary hover:underline"
              data-testid="button-back-signin"
            >
              Back to sign in
            </button>
          )}
        </div>

        <div className="text-center pt-4 border-t">
          <a
            href="/force-logout"
            className="text-xs text-muted-foreground hover:underline"
            data-testid="link-force-logout"
          >
            Clear all auth data
          </a>
        </div>
      </div>
    </div>
  );
}
