import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function TermsOfService() {
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
            <p className="text-muted-foreground" data-testid="text-last-updated">Last updated: April 22, 2026</p>

            <p>
              These Terms of Service ("Terms") govern your access to and use of the GigAid
              mobile and web application and related services (collectively, the "Service").
              By creating an account or using the Service, you agree to these Terms. If you
              do not agree, do not use the Service.
            </p>

            <h2 className="text-lg font-semibold mt-6">1. The Service</h2>
            <p>
              GigAid is a productivity app for gig workers and small service businesses. It
              helps you manage leads, jobs, clients, scheduling, invoicing, deposits, and
              follow-up messaging. Some features rely on third-party providers (for example,
              Stripe for payments and Twilio for SMS). Your use of those features is also
              subject to those providers' terms.
            </p>

            <h2 className="text-lg font-semibold mt-6">2. Eligibility and Accounts</h2>
            <p>
              You must be at least 18 years old and able to enter into a binding contract to
              use GigAid. You are responsible for maintaining the confidentiality of your
              login credentials and for all activity that occurs under your account. Notify
              us immediately if you suspect unauthorized access.
            </p>

            <h2 className="text-lg font-semibold mt-6">3. Plans and Pricing</h2>
            <p>GigAid offers the following plans:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>
                <strong>Free</strong> — $0. Includes invoicing and a limited number of jobs
                per month.
              </li>
              <li>
                <strong>Pro</strong> — Monthly subscription. Unlimited jobs, automated
                follow-ups, two-way SMS, and invoicing.
              </li>
              <li>
                <strong>Pro+</strong> — Monthly subscription. Everything in Pro plus booking
                risk protection, deposit enforcement, today's money plan, offline assets,
                priority alerts, and AI campaign suggestions.
              </li>
              <li>
                <strong>Business</strong> — Monthly subscription. Everything in Pro+ plus
                crew management, analytics, and admin controls.
              </li>
            </ul>
            <p>
              Current prices are shown in-app on the pricing screen and at checkout. We may
              update plan features or prices; changes that affect your active subscription
              will take effect at the start of your next billing period and you will receive
              advance notice through the app or email.
            </p>

            <h2 className="text-lg font-semibold mt-6">4. Subscriptions, Trials, and Auto-Renewal</h2>
            <p>
              Paid plans are billed monthly in advance and renew automatically until you
              cancel. If a free trial is offered, your paid subscription begins automatically
              when the trial ends unless you cancel before then.
            </p>
            <p>
              <strong>iOS purchases (Apple App Store).</strong> Subscriptions purchased
              through the App Store are billed by Apple and managed in your Apple ID
              settings. Auto-renewal can be turned off at any time in <em>Settings &gt; Apple
              ID &gt; Subscriptions</em> at least 24 hours before the end of the current
              period. Apple's Standard EULA for licensed applications also applies to your
              use of the iOS app.
            </p>
            <p>
              <strong>Web purchases.</strong> Subscriptions purchased on the web are billed
              by our payment processor (Stripe) and can be cancelled at any time from the
              Settings screen in the app.
            </p>

            <h2 className="text-lg font-semibold mt-6">5. Cancellation and Refunds</h2>
            <p>
              You can cancel a paid plan at any time. After cancellation, you continue to
              have access to paid features until the end of the current billing period, and
              your account then reverts to the Free plan. We do not provide pro-rated
              refunds for partial months.
            </p>
            <p>
              For purchases made through the Apple App Store, all refund requests are handled
              by Apple under its standard refund policy. For web purchases made through
              Stripe, we offer a 14-day money-back guarantee: if you contact us within 14
              days of your initial subscription charge, we will issue a full refund of that
              charge, no questions asked. After the 14-day window, web charges are
              non-refundable except where required by law.
            </p>

            <h2 className="text-lg font-semibold mt-6">6. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Use the Service for any unlawful, harmful, or fraudulent purpose</li>
              <li>
                Send spam, unsolicited marketing, or any SMS or email that violates the TCPA,
                CAN-SPAM, or other applicable laws
              </li>
              <li>Impersonate any person or misrepresent your affiliation</li>
              <li>
                Attempt to gain unauthorized access to the Service, other accounts, or
                connected systems
              </li>
              <li>Reverse engineer, scrape, or interfere with the Service</li>
              <li>Upload malicious code or content that infringes others' rights</li>
            </ul>
            <p>
              You are solely responsible for the content you send to your clients through
              GigAid and for obtaining any consent required to contact them.
            </p>

            <h2 className="text-lg font-semibold mt-6">7. Your Content and Data</h2>
            <p>
              You retain ownership of the client, job, and message data you put into GigAid.
              You grant us a limited license to host, process, and display that content
              solely to operate and improve the Service for you. Our handling of personal
              information is described in our Privacy Policy.
            </p>

            <h2 className="text-lg font-semibold mt-6">8. Intellectual Property</h2>
            <p>
              The GigAid app, brand, and all associated software, designs, and content
              (excluding your content) are owned by us or our licensors and protected by
              intellectual property laws. We grant you a personal, non-exclusive,
              non-transferable, revocable license to use the Service in accordance with
              these Terms.
            </p>

            <h2 className="text-lg font-semibold mt-6">9. Third-Party Services</h2>
            <p>
              GigAid integrates with third-party providers including Stripe (payments and
              subscription billing), Twilio (SMS delivery), and Apple (App Store billing on
              iOS). We are not responsible for the availability, accuracy, or policies of
              third-party services. Fees charged by these providers, if any, are governed by
              their own terms.
            </p>

            <h2 className="text-lg font-semibold mt-6">10. Disclaimers</h2>
            <p>
              The Service is provided "as is" and "as available" without warranties of any
              kind, whether express or implied, including warranties of merchantability,
              fitness for a particular purpose, and non-infringement. We do not warrant that
              the Service will be uninterrupted, secure, or error-free.
            </p>

            <h2 className="text-lg font-semibold mt-6">11. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, GigAid and its affiliates will not be
              liable for any indirect, incidental, special, consequential, or punitive
              damages, or any loss of profits, revenue, data, or goodwill, arising out of or
              related to your use of the Service. Our total liability for any claim arising
              out of these Terms or the Service will not exceed the greater of (a) the
              amounts you paid us in the 12 months before the claim or (b) US $50.
            </p>

            <h2 className="text-lg font-semibold mt-6">12. Termination</h2>
            <p>
              You may stop using the Service at any time. We may suspend or terminate your
              access if you breach these Terms or if we are required to do so by law. On
              termination, the sections that by their nature should survive (including
              ownership, disclaimers, limitation of liability, and dispute resolution) will
              continue to apply.
            </p>

            <h2 className="text-lg font-semibold mt-6">13. Changes to These Terms</h2>
            <p>
              We may update these Terms from time to time. When we do, we will revise the
              "Last updated" date above and, where appropriate, notify you in the app.
              Continued use of the Service after changes take effect means you accept the
              updated Terms.
            </p>

            <h2 className="text-lg font-semibold mt-6">14. Contact</h2>
            <p>
              Questions about these Terms? Reach us through the in-app Help &amp; Support
              screen or by email at <a href="mailto:support@gigaid.app">support@gigaid.app</a>.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
