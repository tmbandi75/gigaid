import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { trackEvent } from "@/components/PostHogProvider";
import { HelpCircle } from "lucide-react";

export function FreeSetupCta({ variant = "inline" }: { variant?: "inline" | "banner" }) {
  if (variant === "banner") {
    return (
      <div className="bg-primary/5 border border-primary/20 rounded-md p-3 flex items-center gap-3 flex-wrap">
        <HelpCircle className="w-5 h-5 text-primary flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Need help getting started?</p>
          <p className="text-xs text-muted-foreground">Free setup in 10 minutes — we'll do it for you</p>
        </div>
        <Link href="/free-setup">
          <Button size="sm" variant="outline" data-testid="button-free-setup-cta" onClick={() => trackEvent("free_setup_cta_clicked", { variant: "banner", landing_path: window.location.pathname, trigger_surface: "banner" })}>
            Book Free Setup
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="text-center mt-4">
      <Link href="/free-setup">
        <Button variant="ghost" size="sm" className="text-muted-foreground" data-testid="button-free-setup-cta-inline" onClick={() => trackEvent("free_setup_cta_clicked", { variant: "inline", landing_path: window.location.pathname, trigger_surface: "inline" })}>
          <HelpCircle className="w-3 h-3 mr-1" />
          Need help? Free setup in 10 minutes
        </Button>
      </Link>
    </div>
  );
}
