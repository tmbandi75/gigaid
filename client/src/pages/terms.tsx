import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useLocation } from 'wouter';

export default function TermsOfService() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background p-4" data-testid="terms-page">
      <div className="max-w-2xl mx-auto">
        <Button
          variant="ghost"
          size="sm"
          className="mb-4"
          onClick={() => window.history.back()}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>

        <Card>
          <CardHeader>
            <CardTitle data-testid="text-terms-title">Terms of Service</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none">
            <p className="text-muted-foreground">Last updated: January 2025</p>
            
            <h2 className="text-lg font-semibold mt-6">1. Acceptance of Terms</h2>
            <p>
              By accessing or using GigAid, you agree to be bound by these Terms of Service. 
              If you do not agree to these terms, please do not use our service.
            </p>

            <h2 className="text-lg font-semibold mt-6">2. Description of Service</h2>
            <p>
              GigAid is a productivity application designed for gig workers and contractors. 
              The service helps manage clients, jobs, leads, invoices, and scheduling.
            </p>

            <h2 className="text-lg font-semibold mt-6">3. User Accounts</h2>
            <p>
              You are responsible for maintaining the confidentiality of your account credentials. 
              You agree to accept responsibility for all activities that occur under your account.
            </p>

            <h2 className="text-lg font-semibold mt-6">4. User Conduct</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Use the service for any unlawful purpose</li>
              <li>Attempt to gain unauthorized access to any part of the service</li>
              <li>Interfere with or disrupt the service</li>
              <li>Transmit any malicious code or harmful content</li>
            </ul>

            <h2 className="text-lg font-semibold mt-6">5. Payment Terms</h2>
            <p>
              Certain features of GigAid may require payment. All fees are non-refundable 
              unless otherwise specified. We reserve the right to modify pricing with notice.
            </p>

            <h2 className="text-lg font-semibold mt-6">6. Intellectual Property</h2>
            <p>
              All content, features, and functionality of GigAid are owned by us and 
              protected by intellectual property laws.
            </p>

            <h2 className="text-lg font-semibold mt-6">7. Limitation of Liability</h2>
            <p>
              GigAid is provided "as is" without warranties of any kind. We shall not be 
              liable for any indirect, incidental, or consequential damages arising from 
              your use of the service.
            </p>

            <h2 className="text-lg font-semibold mt-6">8. Changes to Terms</h2>
            <p>
              We reserve the right to modify these terms at any time. Continued use of 
              the service after changes constitutes acceptance of the modified terms.
            </p>

            <h2 className="text-lg font-semibold mt-6">9. Contact</h2>
            <p>
              For questions about these Terms of Service, please contact us through the app.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
