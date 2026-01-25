import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2, Eye, EyeOff } from 'lucide-react';
import { signInWithFirebaseIdToken } from '@/lib/auth/mobileAuth';

type EmailScreen = 'enter-email' | 'enter-password' | 'create-account';

interface EmailAuthFlowProps {
  onSuccess: (token: string) => void;
  onBack: () => void;
}

export function EmailAuthFlow({ onSuccess, onBack }: EmailAuthFlowProps) {
  const [screen, setScreen] = useState<EmailScreen>('enter-email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isNewUser, setIsNewUser] = useState(false);

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleContinueWithEmail = async () => {
    if (!validateEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const isExisting = Math.random() > 0.5;
      
      if (isExisting) {
        setIsNewUser(false);
        setScreen('enter-password');
      } else {
        setIsNewUser(true);
        setScreen('create-account');
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async () => {
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      onSuccess('mock-token-email-auth');
    } catch (err) {
      setError('Invalid password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAccount = async () => {
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      onSuccess('mock-token-email-signup');
    } catch (err) {
      setError('Could not create account. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    setError(null);
    alert('Password reset email sent to ' + email);
  };

  if (screen === 'create-account') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background" data-testid="email-create-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <Button
              variant="ghost"
              size="sm"
              className="w-fit -ml-2 mb-2"
              onClick={() => setScreen('enter-email')}
              data-testid="button-back-to-email"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <CardTitle className="text-xl" data-testid="text-create-title">
              Create your account
            </CardTitle>
            <CardDescription data-testid="text-create-description">
              {email}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md" data-testid="text-create-error">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Create a password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                  autoFocus
                  data-testid="input-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                  data-testid="button-toggle-password"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <Input
                id="confirm-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                data-testid="input-confirm-password"
              />
            </div>

            <Button
              className="w-full h-12"
              onClick={handleCreateAccount}
              disabled={isLoading || !password || !confirmPassword}
              data-testid="button-create-account"
            >
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Create account'}
            </Button>

            <p className="text-xs text-center text-muted-foreground" data-testid="text-email-helper">
              Use email if you change phones often.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (screen === 'enter-password') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background" data-testid="email-password-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <Button
              variant="ghost"
              size="sm"
              className="w-fit -ml-2 mb-2"
              onClick={() => setScreen('enter-email')}
              data-testid="button-back-to-email"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <CardTitle className="text-xl" data-testid="text-password-title">
              Enter your password
            </CardTitle>
            <CardDescription data-testid="text-password-description">
              {email}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md" data-testid="text-password-error">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                  autoFocus
                  data-testid="input-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                  data-testid="button-toggle-password"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <Button
              className="w-full h-12"
              onClick={handleSignIn}
              disabled={isLoading || !password}
              data-testid="button-sign-in"
            >
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Continue'}
            </Button>

            <Button
              variant="ghost"
              className="w-full"
              onClick={handleForgotPassword}
              data-testid="button-forgot-password"
            >
              Forgot password?
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background" data-testid="email-entry-screen">
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
          <CardTitle className="text-xl" data-testid="text-email-title">
            Continue with email
          </CardTitle>
          <CardDescription data-testid="text-email-description">
            Enter your email to sign in or create an account.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md" data-testid="text-email-error">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              data-testid="input-email"
            />
          </div>

          <Button
            className="w-full h-12"
            onClick={handleContinueWithEmail}
            disabled={isLoading || !email.trim()}
            data-testid="button-continue"
          >
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Continue'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default EmailAuthFlow;
