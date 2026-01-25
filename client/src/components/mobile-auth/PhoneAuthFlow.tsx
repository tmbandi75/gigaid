import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { signInWithFirebaseIdToken } from '@/lib/auth/mobileAuth';

type PhoneScreen = 'enter-phone' | 'verify-code';

interface PhoneAuthFlowProps {
  onSuccess: (token: string) => void;
  onBack: () => void;
}

export function PhoneAuthFlow({ onSuccess, onBack }: PhoneAuthFlowProps) {
  const [screen, setScreen] = useState<PhoneScreen>('enter-phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [countryCode, setCountryCode] = useState('+1');
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendDisabled, setResendDisabled] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);

  const fullPhoneNumber = `${countryCode}${phoneNumber.replace(/\D/g, '')}`;

  const handleSendCode = async () => {
    if (!phoneNumber.trim()) {
      setError('Please enter your phone number.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      setScreen('verify-code');
      startResendCountdown();
    } catch (err) {
      setError('Failed to send code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (verificationCode.length !== 6) {
      setError('Please enter the 6-digit code.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      onSuccess('mock-token-phone-auth');
    } catch (err) {
      setError("That code didn't work. Try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = () => {
    if (resendDisabled) return;
    startResendCountdown();
  };

  const startResendCountdown = () => {
    setResendDisabled(true);
    setResendCountdown(30);
    
    const interval = setInterval(() => {
      setResendCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setResendDisabled(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleCodeChange = (value: string) => {
    const digitsOnly = value.replace(/\D/g, '').slice(0, 6);
    setVerificationCode(digitsOnly);
  };

  if (screen === 'verify-code') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background" data-testid="phone-verify-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <Button
              variant="ghost"
              size="sm"
              className="w-fit -ml-2 mb-2"
              onClick={() => setScreen('enter-phone')}
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
                onChange={(e) => handleCodeChange(e.target.value)}
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
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Verify'}
            </Button>

            <Button
              variant="ghost"
              className="w-full"
              onClick={handleResendCode}
              disabled={resendDisabled}
              data-testid="button-resend-code"
            >
              {resendDisabled ? `Resend code (${resendCountdown}s)` : 'Resend code'}
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
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                data-testid="select-country-code"
              >
                <option value="+1">+1 US</option>
                <option value="+44">+44 UK</option>
                <option value="+61">+61 AU</option>
                <option value="+33">+33 FR</option>
                <option value="+49">+49 DE</option>
                <option value="+81">+81 JP</option>
                <option value="+86">+86 CN</option>
                <option value="+91">+91 IN</option>
              </select>
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

          <Button
            className="w-full h-12"
            onClick={handleSendCode}
            disabled={isLoading || !phoneNumber.trim()}
            data-testid="button-send-code"
          >
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Send code'}
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
