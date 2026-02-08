import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Briefcase, Calendar, DollarSign, MessageSquare, Users, Zap } from "lucide-react";
import { useUtmCapture } from "@/hooks/useUtmCapture";

export default function LandingPage() {
  useUtmCapture();
  const features = [
    {
      icon: Calendar,
      title: "Job Scheduling",
      description: "Manage your jobs and appointments in one place"
    },
    {
      icon: DollarSign,
      title: "Invoicing",
      description: "Create and send professional invoices in seconds"
    },
    {
      icon: Users,
      title: "Lead Management",
      description: "Track leads and convert them to paying customers"
    },
    {
      icon: MessageSquare,
      title: "Client Communication",
      description: "Stay connected with automated follow-ups"
    },
    {
      icon: Briefcase,
      title: "Crew Management",
      description: "Coordinate with your team effortlessly"
    },
    {
      icon: Zap,
      title: "AI-Powered Insights",
      description: "Get smart recommendations to grow your business"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2" data-testid="link-logo">
            <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
              <Briefcase className="h-5 w-5 text-foreground" />
            </div>
            <span className="font-bold text-xl">GigAid</span>
          </div>
          <Button asChild data-testid="button-login-header">
            <a href="/login">Sign In</a>
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-24 pb-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6" data-testid="text-hero-title">
            Run Your Service Business Like a Pro
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto" data-testid="text-hero-subtitle">
            The all-in-one app for plumbers, electricians, cleaners, and service professionals. 
            Schedule jobs, send invoices, and get paid faster.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild data-testid="button-get-started">
              <a href="/login">Get Started Free</a>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-4" data-testid="text-free-plan-note">
            Free forever plan available. No credit card required.
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-12" data-testid="text-features-title">
            Everything You Need to Succeed
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <Card key={feature.title} className="border-0 shadow-sm hover-elevate" data-testid={`card-feature-${index}`}>
                <CardContent className="pt-6">
                  <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-foreground" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2" data-testid={`text-feature-title-${index}`}>{feature.title}</h3>
                  <p className="text-muted-foreground" data-testid={`text-feature-desc-${index}`}>{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4" data-testid="text-cta-title">
            Ready to Grow Your Business?
          </h2>
          <p className="text-muted-foreground mb-8" data-testid="text-cta-subtitle">
            Join thousands of service professionals who use GigAid to manage their business.
          </p>
          <Button size="lg" asChild data-testid="button-cta-signup">
            <a href="/login">Start Free Today</a>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-4">
        <div className="max-w-6xl mx-auto text-center text-sm text-muted-foreground">
          <p data-testid="text-footer">GigAid - Your partner in service business success</p>
        </div>
      </footer>
    </div>
  );
}
