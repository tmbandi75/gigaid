import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Smartphone, Mail, Phone as PhoneIcon } from 'lucide-react';
import { SiGoogle, SiApple } from 'react-icons/si';
import { checkMobileAuthStatus } from '@/lib/auth/mobileAuth';
import { logger } from "@/lib/logger";

interface MobileLoginProps {
  onFirebaseAuth: (idToken: string) => Promise<void>;
  onBack?: () => void;
  isLoading?: boolean;
  error?: string | null;
}

export function MobileLogin({ onFirebaseAuth, onBack, isLoading = false, error = null }: MobileLoginProps) {
  const [authStatus, setAuthStatus] = useState<{
    firebaseConfigured: boolean;
    supportedProviders: string[];
  } | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  useEffect(() => {
    checkMobileAuthStatus()
      .then(setAuthStatus)
      .catch((err) => logger.error(err))
      .finally(() => setStatusLoading(false));
  }, []);

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]" data-testid="mobile-login-loading">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!authStatus?.firebaseConfigured) {
    return (
      <Card className="max-w-md mx-auto" data-testid="mobile-login-not-configured">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Mobile Login
          </CardTitle>
          <CardDescription>
            Mobile authentication is not yet configured. Please use web login for now.
          </CardDescription>
        </CardHeader>
        {onBack && (
          <CardFooter>
            <Button variant="outline" onClick={onBack} data-testid="button-back-to-web-login">
              Back to Web Login
            </Button>
          </CardFooter>
        )}
      </Card>
    );
  }

  return (
    <Card className="max-w-md mx-auto" data-testid="mobile-login-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5" />
          Mobile Login
        </CardTitle>
        <CardDescription>
          Sign in with your preferred method to access GigAid on your mobile device.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md" data-testid="text-login-error">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <Button 
            variant="outline" 
            className="w-full justify-start gap-3"
            disabled={isLoading}
            data-testid="button-google-login"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <SiGoogle className="h-5 w-5" />
            )}
            Continue with Google
          </Button>

          <Button 
            variant="outline" 
            className="w-full justify-start gap-3"
            disabled={isLoading}
            data-testid="button-apple-login"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <SiApple className="h-5 w-5" />
            )}
            Continue with Apple
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>

          <Button 
            variant="outline" 
            className="w-full justify-start gap-3"
            disabled={isLoading}
            data-testid="button-email-login"
          >
            <Mail className="h-5 w-5" />
            Email
          </Button>

          <Button 
            variant="outline" 
            className="w-full justify-start gap-3"
            disabled={isLoading}
            data-testid="button-phone-login"
          >
            <PhoneIcon className="h-5 w-5" />
            Phone Number
          </Button>
        </div>

        <p className="text-xs text-center text-muted-foreground mt-4">
          Your account will be linked automatically if you've used GigAid before with the same email or phone number.
        </p>
      </CardContent>
      {onBack && (
        <CardFooter>
          <Button variant="ghost" onClick={onBack} className="w-full" data-testid="button-back-to-web-login">
            Back to Web Login
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

export default MobileLogin;
