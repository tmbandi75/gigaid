import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2 } from "lucide-react";
import {
  PhoneAuthProvider,
  RecaptchaVerifier,
  signInWithCredential,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from "firebase/auth";
import { firebaseInitError, formatFirebaseLinkError, getFirebaseAuth } from "@/lib/firebase";
import { isNativePlatform } from "@/lib/platform";
import { logger } from "@/lib/logger";

type PhoneScreen = "enter-phone" | "verify-code";

interface PhoneAuthFlowProps {
  onBack: () => void;
  onFirebaseIdToken: (idToken: string) => Promise<void>;
}

export function PhoneAuthFlow({ onBack, onFirebaseIdToken }: PhoneAuthFlowProps) {
  const [screen, setScreen] = useState<PhoneScreen>("enter-phone");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [countryCode, setCountryCode] = useState("+1");
  const [verificationCode, setVerificationCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendDisabled, setResendDisabled] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [nativeSmsListenerReady, setNativeSmsListenerReady] = useState(() => !isNativePlatform());

  const recaptchaContainerRef = useRef<HTMLDivElement>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const nativeVerificationIdRef = useRef<string | null>(null);
  const nativeListenerCleanupRef = useRef<(() => Promise<void>) | null>(null);
  const resendTimerRef = useRef<number | null>(null);
  // Blocks a second Verify tap before React re-renders; reusing the same SMS session triggers auth/code-expired.
  const verifyInFlightRef = useRef(false);

  const normalizeCountryCode = (value: string) => {
    const digits = value.replace(/\D/g, "");
    if (!digits) return "+";
    return `+${digits.slice(0, 4)}`;
  };

  const fullPhoneNumber = `${countryCode}${phoneNumber.replace(/\D/g, "")}`;

  const clearWebRecaptcha = useCallback(() => {
    try {
      recaptchaVerifierRef.current?.clear();
    } catch {
      // verifier may already be cleared
    }
    recaptchaVerifierRef.current = null;
    confirmationRef.current = null;
  }, []);

  const teardownNativeListeners = useCallback(async () => {
    if (nativeListenerCleanupRef.current) {
      await nativeListenerCleanupRef.current();
      nativeListenerCleanupRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isNativePlatform()) return;
    setNativeSmsListenerReady(false);
    let cancelled = false;
    (async () => {
      try {
        const { FirebaseAuthentication } = await import("@capacitor-firebase/authentication");
        const codeSent = await FirebaseAuthentication.addListener("phoneCodeSent", (event) => {
          if (!cancelled) nativeVerificationIdRef.current = event.verificationId;
        });
        const verifyFailed = await FirebaseAuthentication.addListener("phoneVerificationFailed", (event) => {
          if (!cancelled) setError(formatFirebaseLinkError(event));
        });
        nativeListenerCleanupRef.current = async () => {
          await Promise.all([codeSent.remove(), verifyFailed.remove()]);
        };
        if (!cancelled) setNativeSmsListenerReady(true);
      } catch (e) {
        logger.error("[PhoneAuthFlow] Failed to register native phone listeners", e);
        setError("Could not start phone verification. Try again.");
      }
    })();

    return () => {
      cancelled = true;
      void teardownNativeListeners();
      setNativeSmsListenerReady(false);
    };
  }, [teardownNativeListeners]);

  useEffect(() => {
    return () => {
      clearWebRecaptcha();
      void teardownNativeListeners();
      if (resendTimerRef.current !== null) {
        window.clearInterval(resendTimerRef.current);
        resendTimerRef.current = null;
      }
    };
  }, [clearWebRecaptcha, teardownNativeListeners]);

  const startResendCountdown = () => {
    if (resendTimerRef.current !== null) {
      window.clearInterval(resendTimerRef.current);
      resendTimerRef.current = null;
    }
    setResendDisabled(true);
    setResendCountdown(30);
    resendTimerRef.current = window.setInterval(() => {
      setResendCountdown((prev) => {
        if (prev <= 1) {
          if (resendTimerRef.current !== null) {
            window.clearInterval(resendTimerRef.current);
            resendTimerRef.current = null;
          }
          setResendDisabled(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const sendSmsCode = async () => {
    if (phoneNumber.replace(/\D/g, "").length < 7) {
      setError("Please enter your phone number.");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      if (isNativePlatform()) {
        const { FirebaseAuthentication } = await import("@capacitor-firebase/authentication");
        await FirebaseAuthentication.signInWithPhoneNumber({ phoneNumber: fullPhoneNumber });
      } else {
        const auth = getFirebaseAuth();
        if (!auth || firebaseInitError) {
          throw new Error(firebaseInitError || "Firebase auth is not initialized.");
        }
        if (!recaptchaContainerRef.current) {
          throw new Error("Verification UI is not ready. Try again.");
        }
        if (!recaptchaVerifierRef.current) {
          recaptchaVerifierRef.current = new RecaptchaVerifier(auth, recaptchaContainerRef.current, {
            size: "invisible",
          });
        }
        confirmationRef.current = await signInWithPhoneNumber(
          auth,
          fullPhoneNumber,
          recaptchaVerifierRef.current,
        );
      }
      setScreen("verify-code");
      startResendCountdown();
    } catch (e) {
      setError(formatFirebaseLinkError(e));
      clearWebRecaptcha();
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (verificationCode.length !== 6) {
      setError("Please enter the 6-digit code.");
      return;
    }
    if (verifyInFlightRef.current) {
      return;
    }
    verifyInFlightRef.current = true;
    setIsLoading(true);
    setError(null);
    try {
      if (isNativePlatform()) {
        const vid = nativeVerificationIdRef.current;
        if (!vid) {
          throw new Error("No verification session. Send the code again.");
        }
        // Native plugin only receives SMS; sign-in must complete in the JS SDK so onAuthStateChanged
        // and app JWT pairing match (see capacitor-firebase docs / firebase-js-sdk.md).
        const auth = getFirebaseAuth();
        if (!auth || firebaseInitError) {
          throw new Error(firebaseInitError || "Firebase auth is not initialized.");
        }
        const credential = PhoneAuthProvider.credential(vid, verificationCode);
        const userCredential = await signInWithCredential(auth, credential);
        nativeVerificationIdRef.current = null;
        const idToken = await userCredential.user.getIdToken();
        await onFirebaseIdToken(idToken);
      } else {
        const confirmation = confirmationRef.current;
        if (!confirmation) {
          throw new Error("Verification session expired. Send the code again.");
        }
        const result = await confirmation.confirm(verificationCode);
        const idToken = await result.user.getIdToken();
        await onFirebaseIdToken(idToken);
      }
    } catch (e) {
      setError(formatFirebaseLinkError(e));
    } finally {
      verifyInFlightRef.current = false;
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendDisabled || isLoading) return;
    await sendSmsCode();
  };

  if (screen === "verify-code") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background" data-testid="phone-verify-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <Button
              variant="ghost"
              size="sm"
              className="w-fit -ml-2 mb-2"
              onClick={() => setScreen("enter-phone")}
              data-testid="button-change-number"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Change number
            </Button>
            <CardTitle className="text-xl" data-testid="text-verify-title">
              Enter the code
            </CardTitle>
            <CardDescription data-testid="text-verify-description">
              We sent a 6-digit code to {fullPhoneNumber}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md" data-testid="text-verify-error">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="code">Verification code</Label>
              <Input
                id="code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="000000"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="text-center text-2xl tracking-widest h-14"
                maxLength={6}
                autoFocus
                data-testid="input-verification-code"
              />
            </div>

            <Button
              className="w-full h-12"
              onClick={handleVerifyCode}
              disabled={isLoading || verificationCode.length !== 6}
              data-testid="button-verify"
            >
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Verify"}
            </Button>

            <Button
              variant="ghost"
              className="w-full"
              onClick={() => void handleResendCode()}
              disabled={resendDisabled || isLoading}
              data-testid="button-resend-code"
            >
              {resendDisabled ? `Resend code (${resendCountdown}s)` : "Resend code"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background" data-testid="phone-entry-screen">
      <Card className="w-full max-w-md">
        <CardHeader>
          <Button
            variant="ghost"
            size="sm"
            className="w-fit -ml-2 mb-2"
            onClick={onBack}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <CardTitle className="text-xl" data-testid="text-phone-title">
            What's your phone number?
          </CardTitle>
          <CardDescription data-testid="text-phone-description">
            We'll text you a one-time code. No spam.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md" data-testid="text-phone-error">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="phone">Phone number</Label>
            <div className="flex gap-2">
              <Input
                value={countryCode}
                onChange={(e) => setCountryCode(normalizeCountryCode(e.target.value))}
                placeholder="+1"
                inputMode="tel"
                autoComplete="tel-country-code"
                className="w-24"
                data-testid="input-country-code"
              />
              <Input
                id="phone"
                type="tel"
                inputMode="numeric"
                placeholder="(555) 123-4567"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="flex-1"
                autoFocus
                data-testid="input-phone-number"
              />
            </div>
          </div>

          {!isNativePlatform() && (
            <div ref={recaptchaContainerRef} className="sr-only" aria-hidden />
          )}

          <Button
            className="w-full h-12"
            onClick={() => void sendSmsCode()}
            disabled={isLoading || !phoneNumber.trim() || (isNativePlatform() && !nativeSmsListenerReady)}
            data-testid="button-send-code"
          >
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Send code"}
          </Button>

          <p className="text-xs text-center text-muted-foreground" data-testid="text-sms-disclosure">
            Message and data rates may apply.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default PhoneAuthFlow;