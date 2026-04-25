import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiFetch";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { queryClient } from "@/lib/queryClient";
import { useActivationState } from "@/hooks/useActivationState";
import { isActivated } from "@/lib/isActivated";
import { useToast } from "@/hooks/use-toast";
import { copyTextToClipboard } from "@/lib/clipboard";
import { shareContent } from "@/lib/share";
import { BookingLinkShare } from "@/components/booking-link/BookingLinkShare";
import { CelebrationOverlay } from "@/components/CelebrationOverlay";
import confetti from "canvas-confetti";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  DollarSign,
  Link2,
  Shield,
  FileText,
  CreditCard,
  Copy,
  Check,
  CheckCircle2,
  Share2,
  ExternalLink,
  RefreshCw,
  Wrench,
  SprayCan,
  TreePine,
  Truck,
  GraduationCap,
  ChevronRight,
  ArrowRight,
  Loader2,
} from "lucide-react";

interface ProfileData {
  paydayOnboardingStep?: number;
  paydayOnboardingCompleted?: boolean;
  depositEnabled?: boolean;
  depositValue?: number;
  stripeConnectStatus?: string;
  publicProfileSlug?: string;
}

interface BookingLinkData {
  bookingLink?: string | null;
  servicesCount?: number;
}

interface StripeStatusData {
  charges_enabled?: boolean;
  status?: string;
}

interface StripeOnboardResult {
  url?: string;
}

interface JobTemplate {
  id: string;
  name: string;
  category: string;
  price?: number;
  duration?: number;
  description?: string;
}

const CATEGORIES = [
  { key: "handyman", label: "Handyman", icon: Wrench },
  { key: "cleaning", label: "Cleaning", icon: SprayCan },
  { key: "lawn_care", label: "Lawn Care", icon: TreePine },
  { key: "moving", label: "Moving", icon: Truck },
  { key: "tutoring", label: "Tutoring", icon: GraduationCap },
];

const DEPOSIT_OPTIONS = [20, 25, 30, 50];

function StepWelcome({ onNext }: { onNext: () => void }) {
  const bullets = [
    { icon: CreditCard, text: "Connect Stripe for instant payments" },
    { icon: Link2, text: "Create your personal booking link" },
    { icon: Shield, text: "Set up deposit protection" },
    { icon: FileText, text: "Load ready-made job templates" },
  ];

  return (
    <div className="flex flex-col items-center text-center px-6 py-8">
      <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
        <DollarSign className="h-8 w-8 text-primary" />
      </div>
      <h2 className="text-2xl font-bold text-foreground mb-2" data-testid="text-welcome-title">
        Get Paid Today
      </h2>
      <p className="text-muted-foreground mb-8" data-testid="text-welcome-subtitle">
        Let's get you set up to receive your first payment in minutes
      </p>
      <div className="w-full space-y-3 mb-8">
        {bullets.map((b, i) => (
          <div
            key={i}
            className="flex items-center gap-3 text-left p-3 rounded-lg bg-muted/50"
            data-testid={`text-welcome-bullet-${i}`}
          >
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <b.icon className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm font-medium text-foreground">{b.text}</span>
          </div>
        ))}
      </div>
      <Button className="w-full" onClick={onNext} data-testid="button-lets-go">
        Let's Go
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}

function StepConnectStripe({
  onNext,
  onSkip,
}: {
  onNext: () => void;
  onSkip: () => void;
}) {
  const { toast } = useToast();
  const [checking, setChecking] = useState(false);

  const onboardMutation = useMutation({
    mutationFn: () =>
      apiFetch<StripeOnboardResult>("/api/stripe/connect/onboard", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    onSuccess: (data) => {
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    },
    onError: (err: Error) => {
      toast({ title: "Connection failed", description: err.message, variant: "destructive" });
    },
  });

  const checkStatus = async () => {
    setChecking(true);
    try {
      const status = await apiFetch<StripeStatusData>("/api/stripe/connect/status");
      if (status?.charges_enabled) {
        toast({ title: "Stripe connected successfully" });
        onNext();
      } else {
        toast({ title: "Not connected yet", description: "Complete the Stripe setup in the opened tab, then check again." });
      }
    } catch {
      toast({ title: "Could not check status", variant: "destructive" });
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="flex flex-col px-6 py-8">
      <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
        <CreditCard className="h-7 w-7 text-primary" />
      </div>
      <h2 className="text-xl font-bold text-foreground mb-1" data-testid="text-stripe-title">
        Connect Your Payment Account
      </h2>
      <p className="text-muted-foreground text-sm mb-6" data-testid="text-stripe-subtitle">
        Connect Stripe to accept card payments and deposits from clients
      </p>

      <div className="space-y-3">
        <Button
          className="w-full"
          onClick={() => onboardMutation.mutate()}
          disabled={onboardMutation.isPending}
          data-testid="button-connect-stripe"
        >
          {onboardMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <ExternalLink className="mr-2 h-4 w-4" />
          )}
          Connect Stripe
        </Button>

        <Button
          variant="outline"
          className="w-full"
          onClick={checkStatus}
          disabled={checking}
          data-testid="button-check-stripe-status"
        >
          {checking ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Check Connection Status
        </Button>

        <Button
          variant="ghost"
          className="w-full text-muted-foreground"
          onClick={onSkip}
          data-testid="button-skip-stripe"
        >
          Skip for now
        </Button>
      </div>
    </div>
  );
}

function BookingLinkFallback({ url }: { url: string }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const copiedOk = await copyTextToClipboard(url);
    if (copiedOk) {
      setCopied(true);
      toast({ title: "Link copied" });
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast({ title: "Couldn't copy", variant: "destructive" });
    }
  };

  const handleShare = async () => {
    const { shared } = await shareContent({
      title: "Book with me",
      text: "Book a job with me using this link",
      url,
      dialogTitle: "Share booking link",
    });
    if (!shared) {
      await handleCopy();
    }
  };

  return (
    <Card className="border shadow-sm" data-testid="card-booking-link-fallback">
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Link2 className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground">Your Booking Link</p>
            <p className="text-sm text-muted-foreground mt-1 truncate">{url}</p>
            <div className="flex gap-2 mt-3 flex-wrap">
              <Button size="sm" variant="default" onClick={handleCopy} data-testid="button-copy-booking-link">
                {copied ? <><Check className="h-4 w-4 mr-1" />Copied</> : <><Copy className="h-4 w-4 mr-1" />Copy Link</>}
              </Button>
              <Button size="sm" variant="outline" onClick={handleShare} data-testid="button-share-booking-link">
                <Share2 className="h-4 w-4 mr-1" />Share
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Most first jobs come from sharing this link by text.
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}

function StepBookingLink({ onNext }: { onNext: () => void }) {
  const { data: linkData, isLoading } = useQuery<BookingLinkData>({
    queryKey: QUERY_KEYS.bookingLink(),
  });

  const bookingLink = linkData?.bookingLink || "";
  const hasLink = !!bookingLink;
  const hasServices = (linkData?.servicesCount || 0) > 0;

  return (
    <div className="flex flex-col px-6 py-8">
      <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
        <Link2 className="h-7 w-7 text-primary" />
      </div>
      <h2 className="text-xl font-bold text-foreground mb-1" data-testid="text-booking-title">
        Your Booking Link
      </h2>
      <p className="text-muted-foreground text-sm mb-6" data-testid="text-booking-subtitle">
        Share this link with clients so they can book and pay you directly
      </p>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : hasLink ? (
        <div className="space-y-4">
          {hasServices ? (
            <BookingLinkShare variant="primary" context="bookings" />
          ) : (
            <BookingLinkFallback url={bookingLink} />
          )}
          <Button className="w-full" onClick={onNext} data-testid="button-booking-next">
            Next
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground" data-testid="text-booking-pending">
            Your booking link will be ready once your profile setup is complete.
          </p>
          <Button className="w-full" onClick={onNext} data-testid="button-booking-next">
            Next
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

function StepDeposits({ onNext }: { onNext: () => void }) {
  const { toast } = useToast();
  const { data: profile } = useQuery<ProfileData>({
    queryKey: QUERY_KEYS.profile(),
  });

  const [enabled, setEnabled] = useState(profile?.depositEnabled ?? false);
  const [selectedValue, setSelectedValue] = useState(profile?.depositValue ?? 25);

  useEffect(() => {
    if (profile) {
      setEnabled(profile.depositEnabled ?? false);
      setSelectedValue(profile.depositValue ?? 25);
    }
  }, [profile]);

  const updateMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch("/api/profile", {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.profile() });
    },
    onError: (err: Error) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  const handleToggle = (checked: boolean) => {
    setEnabled(checked);
    updateMutation.mutate({ depositEnabled: checked });
  };

  const handleSelectPercent = (val: number) => {
    setSelectedValue(val);
    updateMutation.mutate({ depositValue: val });
  };

  return (
    <div className="flex flex-col px-6 py-8">
      <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
        <Shield className="h-7 w-7 text-primary" />
      </div>
      <h2 className="text-xl font-bold text-foreground mb-1" data-testid="text-deposit-title">
        Protect Your Time
      </h2>
      <p className="text-muted-foreground text-sm mb-6" data-testid="text-deposit-subtitle">
        Require a deposit when clients book to reduce no-shows
      </p>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">Enable deposits</span>
          <Switch
            checked={enabled}
            onCheckedChange={handleToggle}
            aria-label="Toggle Enable deposits"
            data-testid="switch-deposit-enabled"
          />
        </div>

        {enabled && (
          <div className="space-y-2">
            <span className="text-sm text-muted-foreground">Deposit percentage</span>
            <div className="grid grid-cols-4 gap-2">
              {DEPOSIT_OPTIONS.map((val) => (
                <Button
                  key={val}
                  variant={selectedValue === val ? "default" : "outline"}
                  className="w-full"
                  onClick={() => handleSelectPercent(val)}
                  data-testid={`button-deposit-${val}`}
                >
                  {val}%
                </Button>
              ))}
            </div>
          </div>
        )}

        <Button className="w-full" onClick={onNext} data-testid="button-deposit-next">
          Next
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function StepTemplates({ onNext }: { onNext: () => void }) {
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTemplates, setSelectedTemplates] = useState<Set<string>>(new Set());

  const { data: templates, isLoading } = useQuery<JobTemplate[]>({
    queryKey: ["/api/job-templates"],
  });

  const filtered = (templates || []).filter(
    (t) => t.category?.toLowerCase().replace(/\s+/g, "_") === selectedCategory
  );

  const toggleTemplate = (id: string) => {
    setSelectedTemplates((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="flex flex-col px-6 py-8">
      <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
        <FileText className="h-7 w-7 text-primary" />
      </div>
      <h2 className="text-xl font-bold text-foreground mb-1" data-testid="text-templates-title">
        Ready-Made Job Templates
      </h2>
      <p className="text-muted-foreground text-sm mb-6" data-testid="text-templates-subtitle">
        Pick your trade to get pre-built job templates with pricing and policies
      </p>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !selectedCategory ? (
        <div className="space-y-3 mb-6">
          {CATEGORIES.map((cat) => (
            <Card
              key={cat.key}
              className="p-4 flex items-center gap-3 cursor-pointer hover-elevate"
              onClick={() => setSelectedCategory(cat.key)}
              data-testid={`card-category-${cat.key}`}
            >
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <cat.icon className="h-5 w-5 text-primary" />
              </div>
              <span className="text-sm font-medium text-foreground flex-1">{cat.label}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-3 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedCategory(null)}
            data-testid="button-back-categories"
          >
            Back to categories
          </Button>
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center" data-testid="text-no-templates">
              No templates available for this category
            </p>
          )}
          {filtered.map((tpl) => (
            <Card
              key={tpl.id}
              className="p-4 flex items-center gap-3 cursor-pointer hover-elevate"
              onClick={() => toggleTemplate(tpl.id)}
              data-testid={`card-template-${tpl.id}`}
            >
              <Checkbox
                checked={selectedTemplates.has(tpl.id)}
                onCheckedChange={() => toggleTemplate(tpl.id)}
                data-testid={`checkbox-template-${tpl.id}`}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{tpl.name}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {tpl.price != null && <span>${(tpl.price / 100).toFixed(0)}</span>}
                  {tpl.duration != null && <span>{tpl.duration} min</span>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Button className="w-full" onClick={onNext} data-testid="button-templates-next">
        {selectedTemplates.size > 0
          ? `Add ${selectedTemplates.size} template${selectedTemplates.size > 1 ? "s" : ""} & Continue`
          : "Next"}
        <ChevronRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}

function StepDone({
  onFinish,
  stripeConnected,
  bookingUrl,
  depositEnabled,
  templatesAdded,
}: {
  onFinish: () => void;
  stripeConnected: boolean;
  bookingUrl: string;
  depositEnabled: boolean;
  templatesAdded: number;
}) {
  const [showCelebration, setShowCelebration] = useState(false);

  useEffect(() => {
    setShowCelebration(true);

    const timer = setTimeout(() => {
      const duration = 3000;
      const end = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ec4899"],
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ec4899"],
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };

      frame();

      setTimeout(() => {
        confetti({
          particleCount: 150,
          spread: 100,
          origin: { y: 0.6 },
          colors: ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ec4899"],
        });
      }, 500);
    }, 200);

    return () => clearTimeout(timer);
  }, []);

  const summaryItems = [
    {
      label: "Stripe Payments",
      done: stripeConnected,
      text: stripeConnected ? "Connected" : "Not connected",
    },
    {
      label: "Booking Link",
      done: !!bookingUrl,
      text: bookingUrl ? "Ready" : "Not set up",
    },
    {
      label: "Deposit Protection",
      done: depositEnabled,
      text: depositEnabled ? "Enabled" : "Not enabled",
    },
    {
      label: "Job Templates",
      done: templatesAdded > 0,
      text: templatesAdded > 0 ? `${templatesAdded} added` : "None added",
    },
  ];

  return (
    <>
      <div className="flex flex-col items-center text-center px-6 py-8 pb-36 animate-in fade-in zoom-in-95 duration-500">
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 mb-6">
          <CheckCircle2 className="w-12 h-12 text-emerald-500" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight mb-2" data-testid="text-done-title">
          You're all set!
        </h1>
        <p className="text-lg text-muted-foreground max-w-sm mx-auto mb-6" data-testid="text-done-subtitle">
          GigAid is ready to help you get paid faster and protect your time.
        </p>

        <div className="w-full space-y-3 mb-8">
          {summaryItems.map((item, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
              data-testid={`text-summary-${i}`}
            >
              {item.done ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
              ) : (
                <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30 shrink-0" />
              )}
              <span className="text-sm font-medium text-foreground flex-1 text-left">
                {item.label}
              </span>
              <span className="text-xs text-muted-foreground">{item.text}</span>
            </div>
          ))}
        </div>

        <Button
          size="lg"
          className="w-full"
          onClick={onFinish}
          data-testid="button-go-dashboard"
        >
          Go to Dashboard
          <ArrowRight className="w-5 h-5 ml-2" />
        </Button>
      </div>

      <CelebrationOverlay
        isVisible={showCelebration}
        message="GigAid is ready to help you get paid faster and protect your time."
        type="onboarding_complete"
        onDismiss={() => setShowCelebration(false)}
      />
    </>
  );
}

export default function PaydayOnboarding() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [initialized, setInitialized] = useState(false);
  const [stripeConnected, setStripeConnected] = useState(false);
  const [templatesAdded, setTemplatesAdded] = useState(0);

  const { state: activationState, loading: activationLoading } = useActivationState();

  const { data: profile } = useQuery<ProfileData>({
    queryKey: QUERY_KEYS.profile(),
  });

  const { data: linkData } = useQuery<BookingLinkData>({
    queryKey: QUERY_KEYS.bookingLink(),
  });

  const shouldRedirectAway = !activationLoading && activationState &&
    (isActivated(activationState) || activationState.paydayOnboardingCompleted);

  useEffect(() => {
    if (shouldRedirectAway) {
      navigate("/dashboard");
    }
  }, [shouldRedirectAway, navigate]);

  useEffect(() => {
    if (profile && !initialized) {
      const params = new URLSearchParams(window.location.search);
      const startStep = params.get("startStep");
      const savedStep = profile.paydayOnboardingStep || 0;
      const skipStep = startStep ? Math.max(0, Math.min(parseInt(startStep, 10) || 0, 5)) : null;
      setCurrentStep(skipStep != null && skipStep > savedStep ? skipStep : savedStep);
      setStripeConnected(profile.stripeConnectStatus === "active");
      setInitialized(true);
      if (startStep) {
        window.history.replaceState({}, "", window.location.pathname);
      }
    }
  }, [profile, initialized]);

  const saveStepMutation = useMutation({
    mutationFn: (step: number) =>
      apiFetch("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({ paydayOnboardingStep: step }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.profile() });
    },
  });

  const finishMutation = useMutation({
    mutationFn: () =>
      apiFetch("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({
          paydayOnboardingCompleted: true,
          paydayOnboardingStep: 5,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.profile() });
      queryClient.invalidateQueries({ queryKey: ["/api/user/activation-state"] });
      navigate("/dashboard");
    },
    onError: (err: Error) => {
      toast({ title: "Could not complete setup", description: err.message, variant: "destructive" });
    },
  });

  if (activationLoading || shouldRedirectAway) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const advanceTo = (step: number) => {
    saveStepMutation.mutate(step);
    setCurrentStep(step);
  };

  const totalSteps = 6;
  const progressPercent = ((currentStep + 1) / totalSteps) * 100;
  const bookingUrl = linkData?.bookingLink || "";

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <StepWelcome onNext={() => advanceTo(1)} />;
      case 1:
        return (
          <StepConnectStripe
            onNext={() => {
              setStripeConnected(true);
              advanceTo(2);
            }}
            onSkip={() => advanceTo(2)}
          />
        );
      case 2:
        return <StepBookingLink onNext={() => advanceTo(3)} />;
      case 3:
        return <StepDeposits onNext={() => advanceTo(4)} />;
      case 4:
        return (
          <StepTemplates
            onNext={() => advanceTo(5)}
          />
        );
      case 5:
        return (
          <StepDone
            onFinish={() => finishMutation.mutate()}
            stripeConnected={stripeConnected}
            bookingUrl={bookingUrl}
            depositEnabled={profile?.depositEnabled ?? false}
            templatesAdded={templatesAdded}
          />
        );
      default:
        return <StepWelcome onNext={() => advanceTo(1)} />;
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden" data-testid="page-payday-onboarding">
      <div className="absolute inset-0 bg-gradient-to-br from-[#6366F1] via-[#4F46E5] to-[#3730A3]" />

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-[#818CF8]/30 rounded-full blur-sm" />
        <div className="absolute top-16 right-10 w-20 h-20 bg-[#6366F1]/50 rounded-full" />
        <div className="absolute top-1/4 -right-10 w-40 h-40 bg-[#4338CA]/40 rounded-full blur-md" />
        <div className="absolute -bottom-16 -left-16 w-56 h-56 bg-[#818CF8]/25 rounded-full" />
        <div className="absolute bottom-32 left-1/4 w-24 h-24 bg-[#6366F1]/30 rounded-full blur-sm" />
        <div className="absolute top-1/2 -left-8 w-32 h-32 bg-[#4338CA]/30 rounded-full blur-md" />
      </div>

      <div className="relative min-h-screen flex flex-col">
        <div className="px-4 pt-6 pb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-white/80 text-sm font-medium" data-testid="text-step-indicator">
              Step {currentStep + 1} of {totalSteps}
            </span>
          </div>
          <Progress
            value={progressPercent}
            className="h-2 bg-white/20"
            data-testid="progress-bar"
          />
        </div>

        <div className="flex-1 px-4 pb-6">
          <div
            className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm rounded-2xl shadow-2xl shadow-black/20 overflow-hidden transition-all duration-300 ease-out"
            style={{
              animation: "stepIn 0.3s ease-out",
            }}
            key={currentStep}
          >
            {renderStep()}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes stepIn {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
