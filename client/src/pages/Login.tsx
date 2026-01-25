import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { SiGoogle } from "react-icons/si";
import { signInWithGoogle } from "@/lib/firebase";
import { setAuthToken } from "@/lib/authToken";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const [, navigate] = useLocation();
  const { isAuthenticated, refetchUser } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  if (isAuthenticated) {
    navigate("/");
    return null;
  }

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      const idToken = await signInWithGoogle();
      
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-primary/10 p-4">
      <Card className="w-full max-w-md" data-testid="card-login">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Welcome to GigAid</CardTitle>
          <CardDescription>
            Sign in to manage your jobs, leads, and invoices
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full gap-2"
            size="lg"
            data-testid="button-google-signin"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <SiGoogle className="h-5 w-5" />
            )}
            Continue with Google
          </Button>
          
          <div className="text-center text-xs text-muted-foreground pt-4">
            By signing in, you agree to our Terms of Service and Privacy Policy
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
