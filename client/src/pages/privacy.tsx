import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useLocation } from 'wouter';
import { useEffect } from 'react';

export default function PrivacyPolicy() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    document.title = "Privacy Policy - Gig Aid";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute("content", "Gig Aid Privacy Policy — how we collect, use, and protect your data. Includes third-party SDK disclosures, GDPR rights, CCPA/CPRA rights, and App Tracking Transparency details.");
    }
  }, []);

  return (
    <div className="min-h-screen bg-background p-4" data-testid="privacy-page">
      <div className="max-w-2xl mx-auto pb-12">
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
          <CardContent className="prose prose-sm dark:prose-invert max-w-none space-y-6">
            <p className="text-muted-foreground" data-testid="text-privacy-updated">
              Last updated: February 2026
            </p>

            <p>
              Gig Aid ("we", "us", or "our") is a productivity app for service professionals.
              This policy explains what data we collect, how we use it, who we share it with,
              and what rights you have. We write in plain English so you can make informed decisions.
            </p>

            {/* ——— 1. Data We Collect ——— */}
            <section data-testid="section-data-collected">
              <h2 className="text-lg font-semibold mt-6">1. Data We Collect</h2>

              <h3 className="text-base font-medium mt-4">Contact Information</h3>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Name, email address, and phone number (provided during sign-up or profile setup)</li>
                <li>Business name and service category</li>
                <li>Client names, emails, phone numbers, and addresses you enter for jobs</li>
              </ul>

              <h3 className="text-base font-medium mt-4">Location Data</h3>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Job site addresses you enter for routing and mapping</li>
                <li>Geocoded coordinates derived from those addresses (used for distance calculations and map display)</li>
                <li>We do not track your live GPS location in the background</li>
              </ul>

              <h3 className="text-base font-medium mt-4">Payment Information</h3>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Invoice amounts, payment status, and transaction history</li>
                <li>Stripe account identifiers for payment processing</li>
                <li>We never see or store your full card number — Stripe handles that directly</li>
              </ul>

              <h3 className="text-base font-medium mt-4">Usage Data</h3>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Feature interactions (which screens you visit, buttons you tap)</li>
                <li>Job, lead, and invoice counts and statuses</li>
                <li>Onboarding progress and subscription tier</li>
              </ul>

              <h3 className="text-base font-medium mt-4">Device Information</h3>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Device type, operating system, and app version</li>
                <li>Browser type and screen size (web users)</li>
                <li>Push notification tokens (if you enable notifications)</li>
              </ul>

              <h3 className="text-base font-medium mt-4">Analytics</h3>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Anonymized usage patterns to improve the product</li>
                <li>Error and crash reports (no personal data included)</li>
                <li>Session duration and feature adoption metrics</li>
              </ul>
            </section>

            {/* ——— 2. How We Use Your Data ——— */}
            <section data-testid="section-how-used">
              <h2 className="text-lg font-semibold mt-6">2. How We Use Your Data</h2>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Provide and operate the Gig Aid service (jobs, invoices, leads, scheduling)</li>
                <li>Process payments and send transaction-related messages</li>
                <li>Send booking confirmations, reminders, and follow-ups via SMS or email</li>
                <li>Generate AI-powered suggestions (e.g., pricing tips, next-best-action nudges)</li>
                <li>Improve the app based on aggregated, anonymized usage patterns</li>
                <li>Detect and prevent fraud, abuse, or security issues</li>
                <li>Comply with legal obligations</li>
              </ul>
            </section>

            {/* ——— 3. Third-Party Services & SDKs ——— */}
            <section data-testid="section-third-party">
              <h2 className="text-lg font-semibold mt-6">3. Third-Party Services We Use</h2>
              <p>
                We integrate with the following services. Each has its own privacy policy
                governing how it handles your data:
              </p>

              <div className="mt-4 space-y-4">
                <div>
                  <h4 className="font-medium">Firebase (Google)</h4>
                  <p className="text-sm text-muted-foreground">
                    Authentication (sign-in via phone or email). Receives your email or phone number
                    and device identifiers. <a href="https://firebase.google.com/support/privacy" className="underline" target="_blank" rel="noopener noreferrer">Firebase Privacy Policy</a>
                  </p>
                </div>

                <div>
                  <h4 className="font-medium">Stripe</h4>
                  <p className="text-sm text-muted-foreground">
                    Payment processing and payouts. Receives payment details, transaction amounts,
                    and account identifiers. We never store your card number. <a href="https://stripe.com/privacy" className="underline" target="_blank" rel="noopener noreferrer">Stripe Privacy Policy</a>
                  </p>
                </div>

                <div>
                  <h4 className="font-medium">PostHog</h4>
                  <p className="text-sm text-muted-foreground">
                    Product analytics. Receives anonymized usage events. We disable autocapture,
                    session recording, and mask all text inputs. No personal data is sent. <a href="https://posthog.com/privacy" className="underline" target="_blank" rel="noopener noreferrer">PostHog Privacy Policy</a>
                  </p>
                </div>

                <div>
                  <h4 className="font-medium">Google Maps</h4>
                  <p className="text-sm text-muted-foreground">
                    Geocoding and map display for job locations. Receives street addresses you enter. <a href="https://policies.google.com/privacy" className="underline" target="_blank" rel="noopener noreferrer">Google Privacy Policy</a>
                  </p>
                </div>

                <div>
                  <h4 className="font-medium">Twilio</h4>
                  <p className="text-sm text-muted-foreground">
                    SMS notifications (booking confirmations, reminders). Receives phone numbers
                    and message content. <a href="https://www.twilio.com/legal/privacy" className="underline" target="_blank" rel="noopener noreferrer">Twilio Privacy Policy</a>
                  </p>
                </div>

                <div>
                  <h4 className="font-medium">SendGrid (Twilio)</h4>
                  <p className="text-sm text-muted-foreground">
                    Email delivery (invoices, summaries, lead communications). Receives email addresses
                    and message content. <a href="https://www.twilio.com/legal/privacy" className="underline" target="_blank" rel="noopener noreferrer">SendGrid Privacy Policy</a>
                  </p>
                </div>

                <div id="ai-third-parties">
                  <h4 className="font-medium">OpenAI (AI features)</h4>
                  <p className="text-sm text-muted-foreground">
                    We use OpenAI&apos;s API with the <strong>gpt-4o-mini</strong> model for in-app
                    AI tools (for example pricing or scheduling suggestions, text summaries, and
                    similar assists). When you use those features, we send OpenAI the text you
                    provide and relevant business content you already store in the app (such as job
                    descriptions, lead notes, or service details). We do not send your account email,
                    phone number, or client contact fields as part of those requests unless you
                    explicitly paste them into the AI input. OpenAI processes the request under their
                    API terms; see their policy for retention and subprocessors.{" "}
                    <a href="https://openai.com/privacy" className="underline" target="_blank" rel="noopener noreferrer">OpenAI Privacy Policy</a>
                  </p>
                </div>
              </div>
            </section>

            {/* ——— 4. Data Retention ——— */}
            <section data-testid="section-retention">
              <h2 className="text-lg font-semibold mt-6">4. Data Retention</h2>
              <ul className="list-disc pl-6 mt-2 space-y-2">
                <li>
                  <strong>Account data</strong> (name, email, phone, business info): Retained while
                  your account is active. Deleted within 30 days of account deletion request.
                </li>
                <li>
                  <strong>Job, invoice, and lead data</strong>: Retained while your account is active.
                  Deleted within 30 days of account deletion, except where we need to keep records
                  for legal or tax purposes (up to 7 years for financial records).
                </li>
                <li>
                  <strong>Payment records</strong>: Transaction history is retained by Stripe
                  according to their retention policy and applicable financial regulations.
                </li>
                <li>
                  <strong>Analytics data</strong>: Anonymized usage data may be retained indefinitely
                  since it cannot be linked back to you.
                </li>
                <li>
                  <strong>Communication logs</strong>: SMS and email delivery records retained for 90 days.
                </li>
              </ul>
            </section>

            {/* ——— 5. GDPR Rights (EEA/UK Users) ——— */}
            <section data-testid="section-gdpr">
              <h2 className="text-lg font-semibold mt-6">5. Your Rights Under GDPR (EEA and UK Users)</h2>
              <p>
                If you are located in the European Economic Area or the United Kingdom, you have
                the following rights under the General Data Protection Regulation:
              </p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li><strong>Access</strong> — Request a copy of the personal data we hold about you.</li>
                <li><strong>Rectification</strong> — Ask us to correct inaccurate or incomplete data.</li>
                <li><strong>Erasure</strong> — Ask us to delete your personal data ("right to be forgotten").</li>
                <li><strong>Restriction</strong> — Ask us to limit how we use your data while we resolve a concern.</li>
                <li><strong>Portability</strong> — You can export your data from the Settings page within the app.</li>
                <li><strong>Object</strong> — Object to processing based on legitimate interests or direct marketing.</li>
                <li><strong>Withdraw consent</strong> — Where processing is based on consent, withdraw it at any time.</li>
              </ul>
              <p className="mt-2">
                <strong>Legal basis for processing:</strong> We process your data based on
                (a) contract performance (providing the service you signed up for),
                (b) legitimate interests (improving and securing the app), and
                (c) consent (analytics and marketing, which you can withdraw).
              </p>
              <p className="mt-2">
                You also have the right to lodge a complaint with your local data protection
                authority (e.g., the ICO in the UK, CNIL in France).
              </p>
              <p className="mt-2">
                To exercise any of these rights, email us at{" "}
                <a href="mailto:support@gigaid.ai" className="underline">support@gigaid.ai</a>.
                We will respond within 30 days.
              </p>
            </section>

            {/* ——— 6. CCPA/CPRA Rights (California Users) ——— */}
            <section data-testid="section-ccpa">
              <h2 className="text-lg font-semibold mt-6">6. Your Rights Under CCPA/CPRA (California Residents)</h2>
              <p>
                If you are a California resident, the California Consumer Privacy Act and California
                Privacy Rights Act give you the following rights:
              </p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>
                  <strong>Right to know</strong> — You can request the categories and specific pieces
                  of personal information we have collected about you.
                </li>
                <li>
                  <strong>Right to delete</strong> — You can request that we delete your personal
                  information, subject to certain exceptions.
                </li>
                <li>
                  <strong>Right to correct</strong> — You can request correction of inaccurate personal information.
                </li>
                <li>
                  <strong>Right to opt out of sale or sharing</strong> — We do not sell your personal
                  information. We do not share it for cross-context behavioral advertising.
                </li>
                <li>
                  <strong>Right to non-discrimination</strong> — We will not treat you differently
                  for exercising your privacy rights.
                </li>
              </ul>
              <p className="mt-2">
                To make a request, email{" "}
                <a href="mailto:support@gigaid.ai" className="underline">support@gigaid.ai</a>.
                We will verify your identity and respond within 45 days.
              </p>
            </section>

            {/* ——— 7. App Tracking Transparency (iOS) ——— */}
            <section data-testid="section-att">
              <h2 className="text-lg font-semibold mt-6">7. App Tracking Transparency (iOS Users)</h2>
              <p>
                Product analytics are <strong>off by default</strong>. On iOS, the app may show Apple&apos;s
                App Tracking Transparency (ATT) prompt on the home screen when analytics are enabled
                and iOS has not recorded a choice for this app. It asks whether the app may track
                you across other companies&apos; apps and websites for analytics.
              </p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>
                  If you allow tracking, we may use anonymized identifiers with PostHog for aggregate
                  product analytics.
                </li>
                <li>
                  If you deny tracking, we do not enable identifier-based analytics. The rest of the
                  app works the same.
                </li>
                <li>
                  You can change your preference in{" "}
                  <strong>Settings &gt; Privacy &amp; Security &gt; Tracking</strong> on your device.
                  Android does not use ATT and uses in-app analytics consent only.
                </li>
              </ul>
              <p className="mt-2">
                We do not use the IDFA (Identifier for Advertisers) for advertising.
                We do not serve ads in Gig Aid.
              </p>
            </section>

            {/* ——— 8. Opt-Out Instructions ——— */}
            <section data-testid="section-opt-out">
              <h2 className="text-lg font-semibold mt-6">8. How to Opt Out</h2>

              <h3 className="text-base font-medium mt-4">Analytics</h3>
              <p className="text-sm">
                Keep analytics off by leaving &quot;Enable usage analytics&quot; disabled in the app
                Settings, or turn it off there at any time. On iOS, if you enabled analytics and
                allowed tracking, you can also withdraw tracking permission under{" "}
                <strong>Settings &gt; Privacy &amp; Security &gt; Tracking</strong>. On the web, you
                can use a browser extension that blocks analytics scripts or contact us to disable
                analytics for your account.
              </p>

              <h3 className="text-base font-medium mt-4">SMS and Email Notifications</h3>
              <p className="text-sm">
                You can manage notification preferences in the app's Settings page. You can also
                reply STOP to any SMS we send to unsubscribe from text messages.
                For email, use the unsubscribe link included in every email.
              </p>

              <h3 className="text-base font-medium mt-4">Push Notifications</h3>
              <p className="text-sm">
                Disable push notifications in your device's system settings for the Gig Aid app.
              </p>

              <h3 className="text-base font-medium mt-4">Account Deletion</h3>
              <p className="text-sm">
                You can request full account deletion from the Settings page in the app.
                We will process your request and delete your data within 30 days, except where
                retention is required by law.
              </p>
            </section>

            {/* ——— 9. Data Security ——— */}
            <section data-testid="section-security">
              <h2 className="text-lg font-semibold mt-6">9. Data Security</h2>
              <p>
                We use encryption in transit (TLS/HTTPS) for all data exchanges.
                Passwords are hashed and never stored in plain text.
                Payment data is handled entirely by Stripe's PCI-compliant infrastructure.
                We conduct regular reviews of our logging and data handling to prevent
                accidental exposure of personal information.
              </p>
            </section>

            {/* ——— 10. Children's Privacy ——— */}
            <section data-testid="section-children">
              <h2 className="text-lg font-semibold mt-6">10. Children's Privacy</h2>
              <p>
                Gig Aid is designed for adult service professionals. We do not knowingly collect
                personal information from anyone under 16 years of age. If we learn that we have
                collected data from a child, we will delete it promptly.
              </p>
            </section>

            {/* ——— 11. Changes to This Policy ——— */}
            <section data-testid="section-changes">
              <h2 className="text-lg font-semibold mt-6">11. Changes to This Policy</h2>
              <p>
                We may update this policy from time to time. When we make significant changes,
                we will notify you through the app or by email. The "Last updated" date at the
                top of this page reflects when the policy was last revised.
              </p>
            </section>

            {/* ——— 12. Contact Us ——— */}
            <section data-testid="section-contact">
              <h2 className="text-lg font-semibold mt-6">12. Contact Us</h2>
              <p>
                If you have questions about this Privacy Policy or want to exercise any of your
                data rights, contact us at:
              </p>
              <p className="mt-2 font-medium">
                <a href="mailto:support@gigaid.ai" className="underline" data-testid="link-contact-email">
                  support@gigaid.ai
                </a>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                We aim to respond to all requests within 30 days.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
