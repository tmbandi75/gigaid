import { useEffect, useRef, useState } from "react";
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
import { apiFetch } from "@/lib/apiFetch";
import { logger } from "@/lib/logger";

type Step = "phone" | "code";

interface WebPhoneEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Current phone on file. Pre-populates the phone input on open. */
  currentPhone?: string | null;
  /** Called after the OTP is verified and the server has saved the new phone. */
  onUpdated: (phone: string) => void;
}

interface SendOtpResponse {
  ok: boolean;
  expiresInSeconds?: number;
}

interface VerifyOtpResponse {
  ok: boolean;
  phone: string;
  phoneVerifiedAt: string;
}

interface ApiError {
  error?: string;
  code?: string;
  retryAfterSeconds?: number;
}

function parseApiError(err: unknown): ApiError {
  if (!(err instanceof Error)) return {};
  const msg = err.message ?? "";
  const idx = msg.indexOf(":");
  if (idx === -1) return {};
  const body = msg.slice(idx + 1).trim();
  try {
    return JSON.parse(body) as ApiError;
  } catch {
    return { error: body };
  }
}

function splitInitialPhone(phone?: string | null): { cc: string; rest: string } {
  if (!phone) return { cc: "+1", rest: "" };
  const trimmed = phone.trim();
  if (trimmed.startsWith("+")) {
    const digits = trimmed.slice(1).replace(/\D/g, "");
    // Best-effort split: assume a 1-3 digit country code, then the rest.
    // Defaults to "+1" / 10 trailing digits when ambiguous.
    if (digits.length > 10) {
      const ccLen = digits.length - 10;
      return {
        cc: `+${digits.slice(0, ccLen)}`,
        rest: digits.slice(ccLen),
      };
    }
    return { cc: "+1", rest: digits };
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return { cc: "+1", rest: digits.slice(1) };
  }
  return { cc: "+1", rest: digits };
}

/**
 * Browser-side phone editor that verifies the new number via a server-issued
 * SMS OTP before persisting it. Used both from the SMS confirmation banner CTA
 * and from the AccountLinking section on non-native (web) platforms, where the
 * Capacitor / Firebase phone-link flow isn't available.
 */
export function WebPhoneEditDialog({
  open,
  onOpenChange,
  currentPhone,
  onUpdated,
}: WebPhoneEditDialogProps) {
  const initial = useRef(splitInitialPhone(currentPhone));
  const [step, setStep] = useState<Step>("phone");
  const [countryCode, setCountryCode] = useState(initial.current.cc);
  const [phoneDigits, setPhoneDigits] = useState(initial.current.rest);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [submittedPhone, setSubmittedPhone] = useState<string | null>(null);

  const normalizeCountryCode = (value: string) => {
    const digits = value.replace(/\D/g, "");
    if (!digits) return "+";
    return `+${digits.slice(0, 4)}`;
  };

  const fullE164 = `${countryCode}${phoneDigits.replace(/\D/g, "")}`;

  useEffect(() => {
    if (open) {
      const next = splitInitialPhone(currentPhone);
      initial.current = next;
      setCountryCode(next.cc);
      setPhoneDigits(next.rest);
      setStep("phone");
      setCode("");
      setError(null);
      setBusy(false);
      setSubmittedPhone(null);
    }
  }, [open, currentPhone]);

  const handleSendCode = async () => {
    setError(null);
    if (phoneDigits.replace(/\D/g, "").length < 7) {
      setError("Enter a valid phone number.");
      return;
    }
    if (currentPhone && fullE164 === currentPhone.trim()) {
      setError(
        "That's the number we already have. Edit it before sending a code.",
      );
      return;
    }
    setBusy(true);
    try {
      await apiFetch<SendOtpResponse>("/api/profile/phone/send-otp", {
        method: "POST",
        body: JSON.stringify({ phone: fullE164 }),
      });
      setSubmittedPhone(fullE164);
      setStep("code");
    } catch (e) {
      logger.warn("[WebPhoneEditDialog] send-otp failed", e);
      const parsed = parseApiError(e);
      setError(
        parsed.error || "Couldn't send a verification text. Try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyCode = async () => {
    setError(null);
    if (code.length !== 6) {
      setError("Enter the 6-digit code we sent you.");
      return;
    }
    if (!submittedPhone) {
      setError("Send the code again before verifying.");
      setStep("phone");
      return;
    }
    setBusy(true);
    try {
      const res = await apiFetch<VerifyOtpResponse>(
        "/api/profile/phone/verify-otp",
        {
          method: "POST",
          body: JSON.stringify({ phone: submittedPhone, code }),
        },
      );
      onUpdated(res.phone);
      onOpenChange(false);
    } catch (e) {
      logger.warn("[WebPhoneEditDialog] verify-otp failed", e);
      const parsed = parseApiError(e);
      setError(parsed.error || "We couldn't verify that code. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    setError(null);
    setCode("");
    setStep("phone");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        data-testid="dialog-web-phone-edit"
      >
        <DialogHeader>
          <DialogTitle data-testid="text-web-phone-edit-title">
            {currentPhone ? "Change phone number" : "Add phone number"}
          </DialogTitle>
          <DialogDescription>
            We'll text a 6-digit code to confirm this number works. Standard
            message rates may apply.
          </DialogDescription>
        </DialogHeader>

        {step === "phone" ? (
          <div className="space-y-4 py-2">
            {error && (
              <div
                className="p-3 text-sm text-destructive bg-destructive/10 rounded-md"
                data-testid="text-web-phone-edit-error"
              >
                {error}
              </div>
            )}
            <div className="flex gap-2">
              <div className="w-24 space-y-2">
                <Label htmlFor="web-phone-edit-cc">Code</Label>
                <Input
                  id="web-phone-edit-cc"
                  value={countryCode}
                  onChange={(e) =>
                    setCountryCode(normalizeCountryCode(e.target.value))
                  }
                  placeholder="+1"
                  inputMode="tel"
                  autoComplete="tel-country-code"
                  data-testid="input-web-phone-country"
                />
              </div>
              <div className="flex-1 space-y-2">
                <Label htmlFor="web-phone-edit-num">Phone number</Label>
                <Input
                  id="web-phone-edit-num"
                  value={phoneDigits}
                  onChange={(e) =>
                    setPhoneDigits(e.target.value.replace(/[^\d\s\-()]/g, ""))
                  }
                  placeholder="5551234567"
                  inputMode="tel"
                  autoComplete="tel-national"
                  data-testid="input-web-phone-number"
                />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={busy}
                data-testid="button-web-phone-cancel"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void handleSendCode()}
                disabled={busy}
                data-testid="button-web-phone-send-code"
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
              <div
                className="p-3 text-sm text-destructive bg-destructive/10 rounded-md"
                data-testid="text-web-phone-edit-error"
              >
                {error}
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              Enter the code sent to{" "}
              <span data-testid="text-web-phone-edit-target">
                {submittedPhone}
              </span>
              .
            </p>
            <div className="space-y-2">
              <Label htmlFor="web-phone-edit-code">Verification code</Label>
              <Input
                id="web-phone-edit-code"
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleVerifyCode();
                  }
                }}
                placeholder="000000"
                inputMode="numeric"
                autoComplete="one-time-code"
                data-testid="input-web-phone-code"
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="ghost"
                onClick={() => void handleResend()}
                disabled={busy}
                data-testid="button-web-phone-resend"
              >
                Use a different number
              </Button>
              <Button
                type="button"
                onClick={() => void handleVerifyCode()}
                disabled={busy}
                data-testid="button-web-phone-verify"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Verify and save"
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default WebPhoneEditDialog;
