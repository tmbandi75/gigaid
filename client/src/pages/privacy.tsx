import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useLocation } from 'wouter';

export default function PrivacyPolicy() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background p-4" data-testid="privacy-page">
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
            <CardTitle data-testid="text-privacy-title">Privacy Policy</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none">
            <p className="text-muted-foreground">Last updated: January 2025</p>
            
            <h2 className="text-lg font-semibold mt-6">1. Information We Collect</h2>
            <p>We collect information you provide directly to us, including:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Account information (name, email, phone number)</li>
              <li>Business information (business name, service category)</li>
              <li>Job and client data you enter into the app</li>
              <li>Payment information processed through our payment provider</li>
            </ul>

            <h2 className="text-lg font-semibold mt-6">2. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Provide, maintain, and improve our services</li>
              <li>Process transactions and send related information</li>
              <li>Send you technical notices and support messages</li>
              <li>Respond to your comments and questions</li>
            </ul>

            <h2 className="text-lg font-semibold mt-6">3. Information Sharing</h2>
            <p>
              We do not sell your personal information. We may share your information with:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Service providers who assist in operating our service</li>
              <li>Professional advisors as required by law</li>
              <li>Law enforcement when required by applicable law</li>
            </ul>

            <h2 className="text-lg font-semibold mt-6">4. Data Security</h2>
            <p>
              We implement appropriate technical and organizational measures to protect 
              your personal information against unauthorized access, alteration, disclosure, 
              or destruction.
            </p>

            <h2 className="text-lg font-semibold mt-6">5. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Access your personal information</li>
              <li>Correct inaccurate information</li>
              <li>Request deletion of your information</li>
              <li>Export your data</li>
            </ul>

            <h2 className="text-lg font-semibold mt-6">6. SMS and Communications</h2>
            <p>
              When you use phone number authentication, standard message and data rates 
              may apply. We only send verification codes and do not use your phone number 
              for marketing purposes without your consent.
            </p>

            <h2 className="text-lg font-semibold mt-6">7. Cookies and Tracking</h2>
            <p>
              We use cookies and similar technologies to maintain your session and 
              improve your experience. You can control cookie settings in your browser.
            </p>

            <h2 className="text-lg font-semibold mt-6">8. Children's Privacy</h2>
            <p>
              GigAid is not intended for children under 13. We do not knowingly collect 
              personal information from children under 13.
            </p>

            <h2 className="text-lg font-semibold mt-6">9. Changes to This Policy</h2>
            <p>
              We may update this privacy policy from time to time. We will notify you 
              of any changes by posting the new policy on this page.
            </p>

            <h2 className="text-lg font-semibold mt-6">10. Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy, please contact us through 
              the app.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
