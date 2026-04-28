import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { useToast } from "@/hooks/use-toast";
import { Check, CheckCircle2, Lock, Loader2, Mail, Phone, ShieldCheck } from "lucide-react";
import { SiGoogle, SiApple } from "react-icons/si";
import { getAuthToken, setAuthToken } from "@/lib/authToken";
import {
  signInWithApple,
  signInWithGoogle,
  signUpWithEmail,
} from "@/lib/firebase";
import { logger } from "@/lib/logger";

interface SecureAccountStatus {
  hasRecoverableIdentity: boolean;
  hasVerifiedPhone: boolean;
  email: string | null;
  phone: string | null;
  authProvider: string | null;
}

type Mode = "menu" | "email" | "phone";

async function authedFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init.headers as Record<string, string>) ?? {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(input, { ...init, headers });
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    if (data && typeof data.error === "string") return data.error;
  } catch {
    /* ignore */
  }
  return fallback;
}

export function SecureAccountCard() {
  const { toast } = useToast();
  const [status, setStatus] = useState<SecureAccountStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [mode, setMode] = useState<Mode>("menu");

  // Email/password sub-flow state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [oauthBusy, setOauthBusy] = useState<"google" | "apple" | null>(null);

  // Phone OTP sub-flow state
  const [phone, setPhone] = useState("");
  const [phoneStep, setPhoneStep] = useState<"enter" | "code">("enter");
  const [otpCode, setOtpCode] = useState("");
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = window.setTimeout(() => setResendCooldown((v) => v - 1), 1000);
    return () => window.clearTimeout(id);
  }, [resendCooldown]);

  const refreshStatus = async () => {
    try {
      const res = await authedFetch("/api/secure-account/status");
      if (!res.ok) {
        setStatus(null);
        return;
      }
      const data = (await res.json()) as SecureAccountStatus;
      setStatus(data);
    } catch (err) {
      logger.error("[SecureAccountCard] Failed to load status", err);
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => {
    void refreshStatus();
  }, []);

  const linkFirebaseToken = async (idToken: string): Promise<boolean> => {
    const res = await authedFetch("/api/secure-account/link-firebase", {
      method: "POST",
      body: JSON.stringify({ idToken }),
    });
    if (!res.ok) {
      const msg = await readError(res, "Could not save your account.");
      toast({ title: "Couldn't secure account", description: msg, variant: "destructive" });
      return false;
    }
    const data = (await res.json()) as { token?: string };
    if (data.token) {
      // Replace the lightweight claim JWT with the new firebase-backed
      // app JWT so subsequent requests carry the upgraded provider.
      setAuthToken(data.token);
    }
    toast({ title: "Account secured", description: "You can now sign back in anywhere." });
    await refreshStatus();
    setMode("menu");
    return true;
  };

  const handleEmailSubmit = async () => {
    if (emailBusy) return;
    if (!email.trim() || password.length < 6) {
      toast({
        title: "Check your details",
        description: "Enter an email and a password with at least 6 characters.",
        variant: "destructive",
      });
      return;
    }
    setEmailBusy(true);
    try {
      const idToken = await signUpWithEmail(email.trim(), password);
      const ok = await linkFirebaseToken(idToken);
      if (ok) {
        setEmail("");
        setPassword("");
      }
    } catch (err: any) {
      const code = err?.code as string | undefined;
      const message =
        code === "auth/email-already-in-use"
          ? "That email is already in use. Try signing in instead."
          : code === "auth/weak-password"
            ? "Use a stronger password (at least 6 characters)."
            : code === "auth/invalid-email"
              ? "That email looks invalid."
              : err?.message || "Could not create account.";
      toast({ title: "Couldn't secure account", description: message, variant: "destructive" });
    } finally {
      setEmailBusy(false);
    }
  };

  const handleOAuth = async (kind: "google" | "apple") => {
    if (oauthBusy) return;
    setOauthBusy(kind);
    try {
      const idToken = kind === "google" ? await signInWithGoogle() : await signInWithApple();
      await linkFirebaseToken(idToken);
    } catch (err: any) {
      const message = err?.message || "Sign-in was cancelled.";
      toast({ title: `Couldn't link ${kind === "google" ? "Google" : "Apple"}`, description: message, variant: "destructive" });
    } finally {
      setOauthBusy(null);
    }
  };

  const handleSendCode = async () => {
    if (phoneBusy) return;
    if (phone.replace(/\D/g, "").length < 10) {
      toast({ title: "Enter a valid phone number", variant: "destructive" });
      return;
    }
    setPhoneBusy(true);
    try {
      const res = await authedFetch("/api/secure-account/send-otp", {
        method: "POST",
        body: JSON.stringify({ phone }),
      });
      if (!res.ok) {
        if (res.status === 429) {
          const data = (await res.json().catch(() => ({}))) as { retryAfterSeconds?: number };
          if (data.retryAfterSeconds) setResendCooldown(data.retryAfterSeconds);
        }
        const msg = await readError(res, "Could not send the code.");
        toast({ title: "Couldn't send code", description: msg, variant: "destructive" });
        return;
      }
      setPhoneStep("code");
      setResendCooldown(30);
      toast({ title: "Code sent", description: "Check your texts for a 6-digit code." });
    } finally {
      setPhoneBusy(false);
    }
  };

  const handleVerifyCode = async () => {
    if (phoneBusy) return;
    if (otpCode.replace(/\D/g, "").length !== 6) {
      toast({ title: "Enter the 6-digit code", variant: "destructive" });
      return;
    }
    setPhoneBusy(true);
    try {
      const res = await authedFetch("/api/secure-account/verify-otp", {
        method: "POST",
        body: JSON.stringify({ phone, code: otpCode }),
      });
      if (!res.ok) {
        const msg = await readError(res, "Could not verify the code.");
        toast({ title: "Verification failed", description: msg, variant: "destructive" });
        return;
      }
      toast({ title: "Phone verified", description: "We can reach you on this number." });
      setPhone("");
      setOtpCode("");
      setPhoneStep("enter");
      await refreshStatus();
      setMode("menu");
    } finally {
      setPhoneBusy(false);
    }
  };

  if (statusLoading || !status) {
    return null;
  }

  // Hide entirely once both safety nets are in place.
  if (status.hasRecoverableIdentity && status.hasVerifiedPhone) {
    return (
      <div
        className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 shadow-sm"
        data-testid="card-secure-account-done"
      >
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-600" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-emerald-900">Account secured</p>
            <p className="mt-1 text-xs text-emerald-800">
              You can sign back in any time with {status.email ?? "your account"} or {status.phone ?? "your phone"}.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border border-indigo-200 bg-white p-5 shadow-sm"
      data-testid="card-secure-account"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
          <Lock className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-900" data-testid="text-secure-account-headline">
            Secure your account
          </p>
          <p className="mt-1 text-xs text-slate-600" data-testid="text-secure-account-microcopy">
            Add a way to sign back in if you change phones or clear your browser.
          </p>

          {mode === "menu" && (
            <div className="mt-4 space-y-3">
              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Add a recovery method
                </p>
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    variant={status.hasRecoverableIdentity ? "outline" : "default"}
                    className="h-11 justify-start gap-2 rounded-xl"
                    onClick={() => setMode("email")}
                    disabled={status.hasRecoverableIdentity}
                    data-testid="button-secure-add-email"
                  >
                    {status.hasRecoverableIdentity ? (
                      <Check className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Mail className="h-4 w-4" />
                    )}
                    {status.hasRecoverableIdentity
                      ? `Recovery added${status.email ? ` (${status.email})` : ""}`
                      : "Email & password"}
                  </Button>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 gap-2 rounded-xl"
                      onClick={() => void handleOAuth("google")}
                      disabled={status.hasRecoverableIdentity || oauthBusy !== null}
                      data-testid="button-secure-link-google"
                    >
                      {oauthBusy === "google" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <SiGoogle className="h-4 w-4" />
                      )}
                      Google
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 gap-2 rounded-xl"
                      onClick={() => void handleOAuth("apple")}
                      disabled={status.hasRecoverableIdentity || oauthBusy !== null}
                      data-testid="button-secure-link-apple"
                    >
                      {oauthBusy === "apple" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <SiApple className="h-4 w-4" />
                      )}
                      Apple
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Verify your phone
                </p>
                <Button
                  type="button"
                  variant={status.hasVerifiedPhone ? "outline" : "default"}
                  className="h-11 w-full justify-start gap-2 rounded-xl"
                  onClick={() => setMode("phone")}
                  disabled={status.hasVerifiedPhone}
                  data-testid="button-secure-verify-phone"
                >
                  {status.hasVerifiedPhone ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Phone className="h-4 w-4" />
                  )}
                  {status.hasVerifiedPhone
                    ? `Phone verified${status.phone ? ` (${status.phone})` : ""}`
                    : "Send me a 6-digit code"}
                </Button>
              </div>
            </div>
          )}

          {mode === "email" && (
            <div className="mt-4 space-y-3" data-testid="form-secure-email">
              <div className="space-y-1.5">
                <Label htmlFor="secure-email" className="text-xs">
                  Email
                </Label>
                <Input
                  id="secure-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  data-testid="input-secure-email"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="secure-password" className="text-xs">
                  Password
                </Label>
                <Input
                  id="secure-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  data-testid="input-secure-password"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 rounded-xl"
                  onClick={() => {
                    setMode("menu");
                    setPassword("");
                  }}
                  disabled={emailBusy}
                  data-testid="button-secure-email-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="flex-1 rounded-xl"
                  onClick={() => void handleEmailSubmit()}
                  disabled={emailBusy}
                  data-testid="button-secure-email-submit"
                >
                  {emailBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                </Button>
              </div>
            </div>
          )}

          {mode === "phone" && (
            <div className="mt-4 space-y-3" data-testid="form-secure-phone">
              {phoneStep === "enter" ? (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="secure-phone" className="text-xs">
                      Mobile number
                    </Label>
                    <PhoneInput
                      id="secure-phone"
                      value={phone}
                      onChange={setPhone}
                      data-testid="input-secure-phone"
                    />
                    <p className="text-[11px] text-slate-500">
                      We'll text a 6-digit code. Standard message rates apply.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 rounded-xl"
                      onClick={() => setMode("menu")}
                      disabled={phoneBusy}
                      data-testid="button-secure-phone-cancel"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      className="flex-1 rounded-xl"
                      onClick={() => void handleSendCode()}
                      disabled={phoneBusy}
                      data-testid="button-secure-phone-send"
                    >
                      {phoneBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send code"}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="secure-otp" className="text-xs">
                      Code sent to {phone}
                    </Label>
                    <Input
                      id="secure-otp"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="000000"
                      data-testid="input-secure-otp"
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      className="text-xs font-medium text-indigo-600 underline-offset-2 hover:underline disabled:opacity-50"
                      onClick={() => void handleSendCode()}
                      disabled={phoneBusy || resendCooldown > 0}
                      data-testid="button-secure-otp-resend"
                    >
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
                    </button>
                    <button
                      type="button"
                      className="text-xs font-medium text-slate-500 underline-offset-2 hover:underline"
                      onClick={() => {
                        setPhoneStep("enter");
                        setOtpCode("");
                      }}
                      data-testid="button-secure-otp-change-phone"
                    >
                      Change number
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 rounded-xl"
                      onClick={() => {
                        setMode("menu");
                        setOtpCode("");
                        setPhoneStep("enter");
                      }}
                      disabled={phoneBusy}
                      data-testid="button-secure-otp-cancel"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      className="flex-1 rounded-xl"
                      onClick={() => void handleVerifyCode()}
                      disabled={phoneBusy}
                      data-testid="button-secure-otp-verify"
                    >
                      {phoneBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
