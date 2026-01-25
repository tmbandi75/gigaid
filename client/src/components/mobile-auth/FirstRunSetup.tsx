import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

interface FirstRunSetupProps {
  onComplete: (data: FirstRunData) => void;
  onSkip: () => void;
}

interface FirstRunData {
  businessName?: string;
  serviceCategory?: string;
  zipCode?: string;
}

const SERVICE_CATEGORIES = [
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'hvac', label: 'HVAC' },
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'landscaping', label: 'Landscaping' },
  { value: 'handyman', label: 'Handyman' },
  { value: 'painting', label: 'Painting' },
  { value: 'roofing', label: 'Roofing' },
  { value: 'moving', label: 'Moving' },
  { value: 'other', label: 'Other' },
];

export function FirstRunSetup({ onComplete, onSkip }: FirstRunSetupProps) {
  const [businessName, setBusinessName] = useState('');
  const [serviceCategory, setServiceCategory] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleFinishSetup = async () => {
    setIsLoading(true);
    
    try {
      await onComplete({
        businessName: businessName.trim() || undefined,
        serviceCategory: serviceCategory || undefined,
        zipCode: zipCode.trim() || undefined,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background" data-testid="first-run-setup-screen">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-xl" data-testid="text-setup-title">
            Finish setting up GigAid
          </CardTitle>
          <CardDescription data-testid="text-setup-description">
            Help us personalize your experience. All fields are optional.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="business-name">Business name</Label>
            <Input
              id="business-name"
              type="text"
              placeholder="Your business name"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              data-testid="input-business-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="service-category">Primary service category</Label>
            <Select value={serviceCategory} onValueChange={setServiceCategory}>
              <SelectTrigger data-testid="select-service-category">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {SERVICE_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="zip-code">ZIP code</Label>
            <Input
              id="zip-code"
              type="text"
              placeholder="12345"
              value={zipCode}
              onChange={(e) => setZipCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
              maxLength={5}
              inputMode="numeric"
              data-testid="input-zip-code"
            />
          </div>

          <div className="pt-2 space-y-2">
            <Button
              className="w-full h-12"
              onClick={handleFinishSetup}
              disabled={isLoading}
              data-testid="button-finish-setup"
            >
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Finish setup'}
            </Button>

            <Button
              variant="ghost"
              className="w-full"
              onClick={onSkip}
              disabled={isLoading}
              data-testid="button-skip-setup"
            >
              Skip for now
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default FirstRunSetup;
