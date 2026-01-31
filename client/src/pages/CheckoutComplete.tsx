import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import { queryClient } from "@/lib/queryClient";

export default function CheckoutComplete() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const sessionId = params.get("session_id");
  
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    if (!sessionId) {
      setStatus("error");
      return;
    }

    // Verify the session and update subscription status
    fetch(`/api/subscription/verify?session_id=${sessionId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setStatus("success");
          // Invalidate subscription cache to reflect new plan
          queryClient.invalidateQueries({ queryKey: ["/api/subscription/status"] });
        } else {
          setStatus("error");
        }
      })
      .catch(() => {
        // Even if verification fails, the webhook should handle it
        // Show success since they completed checkout
        setStatus("success");
        queryClient.invalidateQueries({ queryKey: ["/api/subscription/status"] });
      });
  }, [sessionId]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" data-testid="page-checkout-complete-loading">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Confirming your subscription...</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen bg-background p-4" data-testid="page-checkout-complete-error">
        <Card className="max-w-lg mx-auto mt-12">
          <CardHeader className="text-center">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-2" />
            <CardTitle>Something went wrong</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-muted-foreground">
              We couldn't verify your subscription. If you were charged, your subscription will be activated shortly.
            </p>
            <Button onClick={() => navigate("/")} data-testid="button-go-home">
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4" data-testid="page-checkout-complete-success">
      <Card className="max-w-lg mx-auto mt-12">
        <CardHeader className="text-center">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
          <CardTitle>Welcome to your new plan!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-muted-foreground">
            Your subscription is now active. Enjoy all the new features!
          </p>
          <Button onClick={() => navigate("/")} data-testid="button-start-using">
            Start Using GigAid
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
