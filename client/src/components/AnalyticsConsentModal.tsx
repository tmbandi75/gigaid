import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { setAnalyticsConsent } from "@/lib/consent/analyticsConsent";
import { isScreenshotMode } from "@/lib/screenshotMode";

interface AnalyticsConsentModalProps {
  onChoice: (granted: boolean) => void;
}

export function AnalyticsConsentModal({ onChoice }: AnalyticsConsentModalProps) {
  const [choosing, setChoosing] = useState(false);

  if (isScreenshotMode) return null;

  const handleContinue = () => {
    setChoosing(true);
    setAnalyticsConsent("granted");
    onChoice(true);
  };

  const handleNotNow = () => {
    setChoosing(true);
    setAnalyticsConsent("denied");
    onChoice(false);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4" data-testid="modal-analytics-consent">
      <Card className="w-full max-w-sm">
        <CardContent className="pt-6 space-y-4">
          <h3 className="text-lg font-semibold text-foreground">Privacy & Analytics</h3>

          <p className="text-sm text-muted-foreground leading-relaxed">
            We use analytics to understand how the app is used and improve features.
          </p>

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleContinue}
              disabled={choosing}
              data-testid="button-consent-allow"
            >
              Continue
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleNotNow}
              disabled={choosing}
              data-testid="button-consent-deny"
            >
              Not now
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
