import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useUtmCapture } from "@/hooks/useUtmCapture";
import { getStoredUtmData } from "@/lib/utmCapture";
import { trackEvent } from "@/components/PostHogProvider";
import { CheckCircle, Calendar, Clock, ArrowRight, Sparkles, Loader2 } from "lucide-react";

const serviceCategories = [
  "Plumbing",
  "Electrical",
  "Cleaning",
  "HVAC",
  "Landscaping",
  "Handyman",
  "Painting",
  "Roofing",
  "Carpentry",
  "Other",
];

export default function FreeSetup() {
  useUtmCapture();
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    serviceCategory: "",
    city: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || (!formData.email && !formData.phone)) {
      toast({ title: "Please provide your name and either email or phone", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const utmData = getStoredUtmData();
      const params = new URLSearchParams(window.location.search);

      const body: Record<string, string | undefined> = {
        name: formData.name,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        serviceCategory: formData.serviceCategory || undefined,
        city: formData.city || undefined,
        source: "free_setup",
        referrerCode: params.get("ref") || utmData?.referrerCode || undefined,
        utmSource: utmData?.utmSource || undefined,
        utmMedium: utmData?.utmMedium || undefined,
        utmCampaign: utmData?.utmCampaign || undefined,
        utmContent: utmData?.utmContent || undefined,
        utmTerm: utmData?.utmTerm || undefined,
      };

      Object.keys(body).forEach((key) => {
        if (body[key] === undefined) delete body[key];
      });

      const res = await fetch("/api/growth/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error("Failed to submit");

      const lead = await res.json();
      setLeadId(lead.id);
      setSubmitted(true);

      trackEvent("growth_lead_created", {
        lead_id: lead.id,
        source: "free_setup",
        service_category: formData.serviceCategory,
        has_email: !!formData.email,
        has_phone: !!formData.phone,
        utm_source: utmData?.utmSource,
        utm_campaign: utmData?.utmCampaign,
        landing_path: window.location.pathname,
        trigger_surface: "free_setup_page",
        plan: null,
        referrer_user_id: null,
      });

      toast({ title: "We got your info! We'll be in touch soon." });
    } catch (err) {
      toast({ title: "Something went wrong. Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-xl font-semibold" data-testid="text-setup-success">You're all set!</h2>
            <p className="text-muted-foreground">
              We'll reach out within 24 hours to set up your free booking page. Keep an eye on your email or phone.
            </p>
            <div className="pt-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4 flex-shrink-0" />
                <span>Takes about 10 minutes</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4 flex-shrink-0" />
                <span>Start getting bookings right away</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8 md:py-16">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-3" data-testid="text-free-setup-headline">
            Free Booking Page Setup in 10 Minutes
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Get a professional booking page for your business — completely free. Start accepting bookings today.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle>Book Free Setup</CardTitle>
              <CardDescription>Tell us a little about your business and we'll get you set up</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Your Name *</Label>
                  <Input
                    id="name"
                    data-testid="input-setup-name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="John Smith"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    data-testid="input-setup-email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="john@example.com"
                  />
                </div>

                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    data-testid="input-setup-phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="(555) 123-4567"
                  />
                </div>

                <div>
                  <Label htmlFor="category">Service Category</Label>
                  <Select
                    value={formData.serviceCategory}
                    onValueChange={(value) => setFormData({ ...formData, serviceCategory: value })}
                  >
                    <SelectTrigger data-testid="select-setup-category">
                      <SelectValue placeholder="Select your trade" />
                    </SelectTrigger>
                    <SelectContent>
                      {serviceCategories.map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    data-testid="input-setup-city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="Dallas, TX"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={submitting}
                  data-testid="button-submit-setup"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      Book Free Setup
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  No credit card required. No commitment.
                </p>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">What you'll get:</h3>
            {[
              { title: "Professional Booking Page", desc: "Clients can book you online 24/7" },
              { title: "Automated Reminders", desc: "Reduce no-shows with SMS and email reminders" },
              { title: "Invoice & Payment", desc: "Send invoices and collect payments easily" },
              { title: "Lead Tracking", desc: "Never lose a potential customer again" },
              { title: "Mobile App", desc: "Manage everything from your phone" },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Sparkles className="w-3 h-3 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
