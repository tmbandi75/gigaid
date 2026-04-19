import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { formatFirebaseLinkError, requireFirebaseUser } from "@/lib/firebase";
import { logger } from "@/lib/logger";

type Step = "phone" | "code";

interface PhoneLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLinked: () => void;
}

/**
 * Links a phone number using @capacitor-firebase/authentication on iOS/Android only.
 * See: https://github.com/capawesome-team/capacitor-firebase/blob/main/packages/authentication/docs/setup-phone.md
 */
export function PhoneLinkDialog({ open, onOpenChange, onLinked }: PhoneLinkDialogProps) {
  const [step, setStep] = useState<Step>("phone");
  const [countryCode, setCountryCode] = useState("+92");
  const [phoneDigits, setPhoneDigits] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [smsListenerReady, setSmsListenerReady] = useState(false);

  const nativeVerificationIdRef = useRef<string | null>(null);
  const nativeListenerCleanupRef = useRef<(() => Promise<void>) | null>(null);

  const normalizeCountryCode = (value: string) => {
    const digits = value.replace(/\D/g, "");
    if (!digits) return "+";
    return `+${digits.slice(0, 4)}`;
  };

  const resetLocal = useCallback(() => {
    setStep("phone");
    setPhoneDigits("");
    setCode("");
    setError(null);
    setBusy(false);
    nativeVerificationIdRef.current = null;
  }, []);

  const teardownNativeListeners = useCallback(async () => {
    if (nativeListenerCleanupRef.current) {
      await nativeListenerCleanupRef.current();
      nativeListenerCleanupRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!open) {
      resetLocal();
      void teardownNativeListeners();
      setSmsListenerReady(false);
      return;
    }

    setSmsListenerReady(false);
    let cancelled = false;
    (async () => {
      try {
        const { FirebaseAuthentication } = await import(
          "@capacitor-firebase/authentication"
        );
        const codeSent = await FirebaseAuthentication.addListener(
          "phoneCodeSent",
          (event) => {
            if (!cancelled) {
              nativeVerificationIdRef.current = event.verificationId;
            }
          },
        );
        const verifyFailed = await FirebaseAuthentication.addListener(
          "phoneVerificationFailed",
          (event) => {
            if (!cancelled) {
              setError(formatFirebaseLinkError(event));
            }
          },
        );
        nativeListenerCleanupRef.current = async () => {
          await Promise.all([codeSent.remove(), verifyFailed.remove()]);
        };
        if (!cancelled) {
          setSmsListenerReady(true);
        }
      } catch (e) {
        logger.error("[PhoneLink] Failed to register phone listeners", e);
        setError("Could not start phone verification. Try again.");
      }
    })();

    return () => {
      cancelled = true;
      void teardownNativeListeners();
      setSmsListenerReady(false);
    };
  }, [open, resetLocal, teardownNativeListeners]);

  const fullE164 = `${countryCode}${phoneDigits.replace(/\D/g, "")}`;

  const handleSendCode = async () => {
    setError(null);
    if (phoneDigits.replace(/\D/g, "").length < 7) {
      setError("Enter a valid phone number.");
      return;
    }

    requireFirebaseUser();
    setBusy(true);

    try {
      const { FirebaseAuthentication } = await import(
        "@capacitor-firebase/authentication"
      );
      await FirebaseAuthentication.linkWithPhoneNumber({
        phoneNumber: fullE164,
      });
      setStep("code");
    } catch (e) {
      setError(formatFirebaseLinkError(e));
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyCode = async () => {
    setError(null);
    if (code.length !== 6) {
      setError("Enter the 6-digit code.");
      return;
    }

    const vid = nativeVerificationIdRef.current;
    if (!vid) {
      setError("No verification session. Send the code again.");
      return;
    }

    setBusy(true);
    try {
      const { FirebaseAuthentication } = await import(
        "@capacitor-firebase/authentication"
      );
      await FirebaseAuthentication.confirmVerificationCode({
        verificationId: vid,
        verificationCode: code,
      });

      try {
        await requireFirebaseUser().reload();
      } catch {
        /* session may already reflect the link */
      }

      onLinked();
      onOpenChange(false);
    } catch (e) {
      setError(formatFirebaseLinkError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-phone-link">
        <DialogHeader>
          <DialogTitle>Link phone number</DialogTitle>
          <DialogDescription>
            We will text a verification code to this number. Standard message rates may apply.
          </DialogDescription>
        </DialogHeader>

        {step === "phone" ? (
          <div className="space-y-4 py-2">
            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                {error}
              </div>
            )}
            <div className="flex gap-2">
              <div className="w-24 space-y-2">
                <Label htmlFor="phone-link-cc">Code</Label>
                <Input
                  id="phone-link-cc"
                  value={countryCode}
                  onChange={(e) => setCountryCode(normalizeCountryCode(e.target.value))}
                  placeholder="+1"
                  inputMode="tel"
                  autoComplete="tel-country-code"
                  data-testid="input-phone-country"
                />
              </div>
              <div className="flex-1 space-y-2">
                <Label htmlFor="phone-link-num">Phone number</Label>
                <Input
                  id="phone-link-num"
                  value={phoneDigits}
                  onChange={(e) =>
                    setPhoneDigits(e.target.value.replace(/[^\d\s\-()]/g, ""))
                  }
                  placeholder="5551234567"
                  inputMode="tel"
                  autoComplete="tel-national"
                  data-testid="input-phone-number"
                />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void handleSendCode()}
                disabled={busy || !smsListenerReady}
                data-testid="button-phone-send-code"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Send code"
                )}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                {error}
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              Enter the code sent to {fullE164}
            </p>
            <div className="space-y-2">
              <Label htmlFor="phone-link-code">Verification code</Label>
              <Input
                id="phone-link-code"
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="000000"
                inputMode="numeric"
                autoComplete="one-time-code"
                data-testid="input-phone-code"
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setStep("phone");
                  setCode("");
                  setError(null);
                }}
                disabled={busy}
              >
                Back
              </Button>
              <Button
                type="button"
                onClick={() => void handleVerifyCode()}
                disabled={busy}
                data-testid="button-phone-verify"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Verify and link"
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
