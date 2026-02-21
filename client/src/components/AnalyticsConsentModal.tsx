import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";
import { setAnalyticsConsent } from "@/lib/consent/analyticsConsent";
import { isScreenshotMode } from "@/lib/screenshotMode";

interface AnalyticsConsentModalProps {
  onChoice: (granted: boolean) => void;
}

export function AnalyticsConsentModal({ onChoice }: AnalyticsConsentModalProps) {
  const [choosing, setChoosing] = useState(false);

  if (isScreenshotMode) return null;

  const handleAllow = () => {
    setChoosing(true);
    setAnalyticsConsent("granted");
    onChoice(true);
  };

  const handleDeny = () => {
    setChoosing(true);
    setAnalyticsConsent("denied");
    onChoice(false);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4" data-testid="modal-analytics-consent">
      <Card className="w-full max-w-sm">
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">Analytics</h3>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed">
            Allow GigAid to use analytics to improve the app experience? We do not sell your data.
          </p>

          <div className="flex gap-3 pt-2">
            <Button
              className="flex-1"
              onClick={handleAllow}
              disabled={choosing}
              data-testid="button-consent-allow"
            >
              Allow
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleDeny}
              disabled={choosing}
              data-testid="button-consent-deny"
            >
              No Thanks
            </Button>
          </div>

          <a
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center text-xs text-muted-foreground underline underline-offset-2"
            data-testid="link-privacy-policy"
          >
            Privacy Policy
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
