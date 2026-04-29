import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SiApple, SiGoogle } from 'react-icons/si';
import { Phone, Mail, Check, Loader2, Pencil } from 'lucide-react';

interface LinkedMethod {
  provider: 'apple' | 'google' | 'phone' | 'email';
  identifier?: string;
  verified?: boolean;
}

interface AccountLinkingProps {
  currentProvider: 'apple' | 'google' | 'phone' | 'email';
  linkedMethods: LinkedMethod[];
  email?: string;
  phone?: string;
  onLinkApple?: () => Promise<void>;
  onLinkGoogle?: () => Promise<void>;
  onLinkPhone?: () => Promise<void>;
  /**
   * Replace the phone number on file. When provided and a phone is already
   * linked, an "Edit" affordance is rendered next to the phone display so
   * web users can update / re-verify the number without losing it first.
   */
  onChangePhone?: () => void;
  onLinkEmail?: () => void;
}

const PROVIDER_LABELS = {
  apple: 'Apple',
  google: 'Google',
  phone: 'Phone',
  email: 'Email',
};

const PROVIDER_ICONS = {
  apple: SiApple,
  google: SiGoogle,
  phone: Phone,
  email: Mail,
};

export function AccountLinking({
  currentProvider,
  linkedMethods,
  email,
  phone,
  onLinkApple,
  onLinkGoogle,
  onLinkPhone,
  onChangePhone,
  onLinkEmail,
}: AccountLinkingProps) {
  const [isLinking, setIsLinking] = useState<string | null>(null);

  const isLinked = (provider: string) => 
    linkedMethods.some(m => m.provider === provider) || currentProvider === provider;

  const getLinkedIdentifier = (provider: string) => {
    const method = linkedMethods.find(m => m.provider === provider);
    if (method?.identifier) return method.identifier;
    if (provider === 'email' && email) return email;
    if (provider === 'phone' && phone) return phone;
    return null;
  };

  const handleLink = async (provider: string, linkFn?: () => Promise<void> | void) => {
    if (!linkFn || isLinked(provider)) return;
    
    setIsLinking(provider);
    try {
      await linkFn();
    } finally {
      setIsLinking(null);
    }
  };

  const CurrentProviderIcon = PROVIDER_ICONS[currentProvider];

  return (
    <Card data-testid="account-linking-section">
      <CardHeader>
        <CardTitle className="text-lg" data-testid="text-account-title">
          Account
        </CardTitle>
        <CardDescription data-testid="text-account-description">
          Manage your sign-in methods
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg" data-testid="current-signin-method">
          <div className="flex items-center gap-3">
            <CurrentProviderIcon className="h-5 w-5" />
            <div>
              <p className="text-sm font-medium">Signed in with {PROVIDER_LABELS[currentProvider]}</p>
              {(email || phone) && (
                <p className="text-xs text-muted-foreground">
                  {currentProvider === 'email' ? email : currentProvider === 'phone' ? phone : email || phone}
                </p>
              )}
            </div>
          </div>
          <Badge variant="secondary">Primary</Badge>
        </div>

        {email && (
          <div className="flex items-center justify-between py-2" data-testid="verified-email">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{email}</span>
            </div>
            <Badge variant="outline" className="gap-1">
              <Check className="h-3 w-3" />
              Verified
            </Badge>
          </div>
        )}

        {phone && (
          <div className="flex items-center justify-between py-2" data-testid="verified-phone">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{phone}</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1">
                <Check className="h-3 w-3" />
                Verified
              </Badge>
              {onChangePhone && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 gap-1 text-xs"
                  onClick={onChangePhone}
                  data-testid="button-change-phone"
                >
                  <Pencil className="h-3 w-3" />
                  Change
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="pt-2 border-t">
          <p className="text-sm font-medium mb-3" data-testid="text-link-title">
            Link another sign-in method
          </p>
          
          <div className="space-y-2">
            {!isLinked('apple') && onLinkApple && (
              <Button
                variant="outline"
                className="w-full justify-start gap-3"
                onClick={() => handleLink('apple', onLinkApple)}
                disabled={isLinking !== null}
                data-testid="button-link-apple"
              >
                {isLinking === 'apple' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <SiApple className="h-4 w-4" />
                )}
                Link Apple
              </Button>
            )}

            {!isLinked('google') && onLinkGoogle && (
              <Button
                variant="outline"
                className="w-full justify-start gap-3"
                onClick={() => handleLink('google', onLinkGoogle)}
                disabled={isLinking !== null}
                data-testid="button-link-google"
              >
                {isLinking === 'google' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <SiGoogle className="h-4 w-4" />
                )}
                Link Google
              </Button>
            )}

            {!isLinked('phone') && onLinkPhone && (
              <Button
                variant="outline"
                className="w-full justify-start gap-3"
                onClick={() => handleLink('phone', onLinkPhone)}
                disabled={isLinking !== null}
                data-testid="button-link-phone"
              >
                {isLinking === 'phone' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Phone className="h-4 w-4" />
                )}
                Link Phone
              </Button>
            )}

            {!isLinked('email') && onLinkEmail && (
              <Button
                variant="outline"
                className="w-full justify-start gap-3"
                onClick={() => handleLink('email', onLinkEmail)}
                disabled={isLinking !== null}
                data-testid="button-link-email"
              >
                <Mail className="h-4 w-4" />
                Link Email
              </Button>
            )}

            {isLinked('apple') && isLinked('google') && isLinked('phone') && isLinked('email') && (
              <p className="text-sm text-muted-foreground text-center py-2" data-testid="text-all-linked">
                All sign-in methods are linked.
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default AccountLinking;
