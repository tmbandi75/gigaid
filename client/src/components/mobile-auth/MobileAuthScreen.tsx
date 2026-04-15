import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { SiApple, SiGoogle } from 'react-icons/si';
import { Phone, Mail, ArrowLeft, Loader2 } from 'lucide-react';
import { PhoneAuthFlow } from './PhoneAuthFlow';
import { EmailAuthFlow } from './EmailAuthFlow';

type AuthScreen = 'welcome' | 'phone' | 'email';

interface MobileAuthScreenProps {
  onAuthSuccess: (token: string) => void;
  onAppleSignIn?: () => Promise<string>;
  onGoogleSignIn?: () => Promise<string>;
  termsUrl?: string;
  privacyUrl?: string;
}

export function MobileAuthScreen({
  onAuthSuccess,
  onAppleSignIn,
  onGoogleSignIn,
  termsUrl = '/terms',
  privacyUrl = '/privacy',
}: MobileAuthScreenProps) {
  const [currentScreen, setCurrentScreen] = useState<AuthScreen>('welcome');
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const handleAppleSignIn = async () => {
    if (!onAppleSignIn || isLoading !== null) return;
    setIsLoading('apple');
    setError(null);
    try {
      const token = await onAppleSignIn();
      onAuthSuccess(token);
    } catch (err) {
      setError('Apple sign-in failed. Please try again.');
    } finally {
      setIsLoading(null);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!onGoogleSignIn) return;
    setIsLoading('google');
    setError(null);
    try {
      const token = await onGoogleSignIn();
      onAuthSuccess(token);
    } catch (err) {
      setError('Google sign-in failed. Please try again.');
    } finally {
      setIsLoading(null);
    }
  };

  const handlePhoneAuthSuccess = (token: string) => {
    onAuthSuccess(token);
  };

  const handleEmailAuthSuccess = (token: string) => {
    onAuthSuccess(token);
  };

  if (currentScreen === 'phone') {
    return (
      <PhoneAuthFlow
        onSuccess={handlePhoneAuthSuccess}
        onBack={() => setCurrentScreen('welcome')}
      />
    );
  }

  if (currentScreen === 'email') {
    return (
      <EmailAuthFlow
        onSuccess={handleEmailAuthSuccess}
        onBack={() => setCurrentScreen('welcome')}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background" data-testid="mobile-auth-screen">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-2xl font-bold" data-testid="text-welcome-title">
            Welcome to GigAid
          </CardTitle>
          <CardDescription className="text-base" data-testid="text-welcome-subtitle">
            Sign in in seconds. Your jobs stay synced across devices.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md" data-testid="text-auth-error">
              {error}
            </div>
          )}

          <div className="flex items-start space-x-3 pt-2 pb-1" data-testid="terms-agreement">
            <Checkbox
              id="termsAccepted"
              checked={termsAccepted}
              onCheckedChange={(checked) => setTermsAccepted(checked === true)}
              data-testid="checkbox-terms"
            />
            <label htmlFor="termsAccepted" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
              I have read and agree to the{' '}
              <a
                href={termsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground"
                data-testid="link-terms"
                onClick={(e) => e.stopPropagation()}
              >
                Terms of Service
              </a>
              {' '}and{' '}
              <a
                href={privacyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground"
                data-testid="link-privacy"
                onClick={(e) => e.stopPropagation()}
              >
                Privacy Policy
              </a>
            </label>
          </div>

          <Button
            variant="outline"
            className="w-full h-12 justify-start gap-3 text-base font-medium border-2"
            onClick={handleAppleSignIn}
            disabled={isLoading !== null || !onAppleSignIn || !termsAccepted}
            data-testid="button-apple-signin"
          >
            {isLoading === 'apple' ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <SiApple className="h-5 w-5" />
            )}
            Continue with Apple
          </Button>

          <Button
            variant="outline"
            className="w-full h-12 justify-start gap-3 text-base font-medium border-2"
            onClick={handleGoogleSignIn}
            disabled={isLoading !== null || !onGoogleSignIn || !termsAccepted}
            data-testid="button-google-signin"
          >
            {isLoading === 'google' ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <SiGoogle className="h-5 w-5" />
            )}
            Continue with Google
          </Button>

          <Button
            variant="outline"
            className="w-full h-12 justify-start gap-3 text-base font-medium"
            onClick={() => setCurrentScreen('phone')}
            disabled={isLoading !== null || !termsAccepted}
            data-testid="button-phone-signin"
          >
            <Phone className="h-5 w-5" />
            Continue with Phone
          </Button>

          <Button
            variant="outline"
            className="w-full h-12 justify-start gap-3 text-base font-medium"
            onClick={() => setCurrentScreen('email')}
            disabled={isLoading !== null || !termsAccepted}
            data-testid="button-email-signin"
          >
            <Mail className="h-5 w-5" />
            Continue with Email
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default MobileAuthScreen;
