import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiFetch } from "@/lib/apiFetch";
import { useApiMutation } from "@/hooks/useApiMutation";
import { getAuthToken } from "@/lib/authToken";
import { 
  Bell, 
  Crown, 
  Copy, 
  Check,
  Loader2,
  Eye,
  EyeOff,
  Download,
  FileJson,
  Share,
  ArrowLeft,
  Settings as SettingsIcon,
  Globe,
  Sparkles,
  ChevronRight,
  DollarSign,
  Shield,
  Lock,
  Zap,
  User,
  AlertCircle,
  CheckCircle,
  Pencil,
  MessageCircle,
  BarChart3,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AvailabilityEditor } from "@/components/settings/AvailabilityEditor";
import { PaymentMethodsSettings } from "@/components/PaymentMethodsSettings";
import { StripeConnectSettings } from "@/components/settings/StripeConnectSettings";
import { EmailSignatureSettings } from "@/components/settings/EmailSignatureSettings";
import { AccountLinking } from "@/components/mobile-auth/AccountLinking";
import { AutomationSettings } from "@/components/settings/AutomationSettings";
import { MessagingSettings } from "@/components/settings/MessagingSettings";
import { ChangePasswordDialog } from "@/components/settings/ChangePasswordDialog";
import { SubscriptionSettings } from "@/components/settings/SubscriptionSettings";
import { SettingsSectionAccordion } from "@/components/settings/SettingsSectionAccordion";
import { isEmailPasswordUser } from "@/lib/firebase";
import type { Referral, WeeklyAvailability } from "@shared/schema";
import { useFeatureFlag, useUpdateFeatureFlag } from "@/hooks/use-nudges";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { getAnalyticsConsent, setAnalyticsConsent } from "@/lib/consent/analyticsConsent";
import { logger } from "@/lib/logger";
import { initAnalyticsSafely, disableAnalytics, persistAnalyticsPreferences } from "@/lib/analytics/initAnalytics";
import { requestATTUserInitiated, isIOSNative, type AnalyticsProfile } from "@/lib/att/attManager";

interface ReferralData {
  referralCode: string;
  referrals: Referral[];
  totalRewards: number;
}

interface PaymentMethod {
  id: string;
  type: string;
  isEnabled: boolean;
}

interface OnboardingStatus {
  completed: boolean;
  step: number;
  state: string;
  moneyProtectionReady: boolean;
  defaultServiceType: string | null;
  defaultPrice: number | null;
  depositPolicySet: boolean;
}

export default function Settings() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [bookingLinkCopied, setBookingLinkCopied] = useState(false);
  const { isAuthenticated } = useAuth();
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);
  const [attBlocked, setAttBlocked] = useState(false);

  const profileQuery = useQuery<any>({ queryKey: ["/api/profile"] });
  useEffect(() => {
    if (profileQuery.data) {
      setAnalyticsEnabled(profileQuery.data.analyticsEnabled ?? false);
      const status = profileQuery.data.attStatus;
      if (isIOSNative() && (status === "denied" || status === "restricted")) {
        setAttBlocked(true);
      }
    }
  }, [profileQuery.data]);

  const handleAnalyticsToggle = async (checked: boolean) => {
    if (!profileQuery.data) {
      toast({ title: "Loading", description: "Please wait while your profile loads." });
      return;
    }

    setAnalyticsEnabled(checked);
    const currentProfile = profileQuery.data;

    if (!checked) {
      setAnalyticsConsent("denied");
      disableAnalytics();
      await persistAnalyticsPreferences({
        analyticsEnabled: false,
        attStatus: currentProfile.attStatus ?? "unknown",
        attPromptedAt: currentProfile.attPromptedAt ?? null,
        analyticsDisabledReason: "user_disabled",
      });
      return;
    }

    setAnalyticsConsent("granted");

    if (isIOSNative()) {
      const currentAttStatus = currentProfile.attStatus ?? "unknown";

      if (currentAttStatus === "denied" || currentAttStatus === "restricted") {
        setAttBlocked(true);
        setAnalyticsEnabled(false);
        setAnalyticsConsent("denied");
        toast({
          title: "Tracking disabled in iOS Settings",
          description: "To enable analytics, allow tracking in Settings > Privacy & Security > Tracking.",
        });
        await persistAnalyticsPreferences({
          analyticsEnabled: false,
          attStatus: currentAttStatus,
          attPromptedAt: currentProfile.attPromptedAt ?? null,
          analyticsDisabledReason: currentAttStatus === "denied" ? "att_denied" : "restricted",
        });
        return;
      }

      if (currentAttStatus === "unknown" || currentAttStatus === "not_determined") {
        const profileForATT: AnalyticsProfile = {
          analyticsEnabled: true,
          attStatus: currentAttStatus,
          attPromptedAt: currentProfile.attPromptedAt ?? null,
          analyticsDisabledReason: currentProfile.analyticsDisabledReason ?? null,
        };
        const result = await requestATTUserInitiated(profileForATT);
        const now = new Date().toISOString();

        if (result === "authorized") {
          const updatedProfile: AnalyticsProfile = {
            analyticsEnabled: true,
            attStatus: "authorized",
            attPromptedAt: now,
            analyticsDisabledReason: null,
          };
          await persistAnalyticsPreferences(updatedProfile);
          await initAnalyticsSafely(updatedProfile);
          return;
        }

        const reason = result === "denied" ? "att_denied" : result === "restricted" ? "restricted" : "not_supported";
        setAnalyticsEnabled(false);
        setAnalyticsConsent("denied");
        setAttBlocked(result === "denied" || result === "restricted");
        await persistAnalyticsPreferences({
          analyticsEnabled: false,
          attStatus: result === "unavailable" ? "unavailable" : result,
          attPromptedAt: now,
          analyticsDisabledReason: reason,
        });
        toast({
          title: "Analytics not enabled",
          description: "Tracking permission was not granted. Analytics will remain off.",
        });
        return;
      }

      if (currentAttStatus === "authorized") {
        const updatedProfile: AnalyticsProfile = {
          analyticsEnabled: true,
          attStatus: "authorized",
          attPromptedAt: currentProfile.attPromptedAt ?? null,
          analyticsDisabledReason: null,
        };
        await persistAnalyticsPreferences(updatedProfile);
        await initAnalyticsSafely(updatedProfile);
        return;
      }
    }

    const updatedProfile: AnalyticsProfile = {
      analyticsEnabled: true,
      attStatus: currentProfile.attStatus ?? "unavailable",
      attPromptedAt: currentProfile.attPromptedAt ?? null,
      analyticsDisabledReason: null,
    };
    await persistAnalyticsPreferences(updatedProfile);
    await initAnalyticsSafely(updatedProfile);
  };

  const handleAuthenticatedDownload = async (url: string, filename: string) => {
    try {
      const token = getAuthToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      const response = await fetch(url, {
        credentials: "include",
        headers,
      });
      
      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`);
      }
      
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
      
      toast({ title: "Download started", description: `${filename} is downloading` });
    } catch (error: any) {
      logger.error("Download error:", error);
      toast({ 
        title: "Download failed", 
        description: error.message || "Could not download file",
        variant: "destructive"
      });
    }
  };
  
  const { data: aiNudgesFlag } = useFeatureFlag("ai_micro_nudges");
  const updateFeatureFlag = useUpdateFeatureFlag();

  const { data: profile } = useQuery<any>({
    queryKey: QUERY_KEYS.profile(),
  });

  const { data: onboardingStatus, isLoading: isOnboardingLoading } = useQuery<OnboardingStatus>({
    queryKey: QUERY_KEYS.onboarding(),
  });

  const { data: subscription, isLoading: isSubscriptionLoading, isError: isSubscriptionError } = useQuery<{ plan: string; hasSubscription: boolean }>({
    queryKey: QUERY_KEYS.subscriptionStatus(),
    retry: 1,
    staleTime: 60000,
  });

  // Derive plan display from subscription - handle loading/error explicitly
  const getPlanLabel = (): string => {
    if (isSubscriptionLoading) return "Loading...";
    if (isSubscriptionError || !subscription) return "Unable to load";
    const plan = subscription.plan;
    if (!plan || plan === "free") return "Free";
    return plan.charAt(0).toUpperCase() + plan.slice(1).replace("_", "+");
  };
  
  const isBusinessPlan = subscription !== undefined && subscription.plan === "business";
  const currentPlanLabel = getPlanLabel();

  const isMoneyProtectionReady = onboardingStatus ? onboardingStatus.moneyProtectionReady : true;
  const needsSetup = !isOnboardingLoading && !isMoneyProtectionReady;

  const { data: paymentMethods } = useQuery<PaymentMethod[]>({
    queryKey: QUERY_KEYS.paymentMethods(),
  });

  const savedStripeEnabled = paymentMethods?.some(
    (method) => method.type === "stripe" && method.isEnabled
  ) ?? false;
  
  const [stripeEnabled, setStripeEnabled] = useState(false);
  
  useEffect(() => {
    setStripeEnabled(savedStripeEnabled);
  }, [savedStripeEnabled]);

  const { data: stripeStatus } = useQuery<{ connected: boolean; accountId?: string }>({
    queryKey: QUERY_KEYS.stripeConnectStatus(),
    enabled: stripeEnabled,
  });

  const [settings, setSettings] = useState({
    publicProfileEnabled: false,
    publicProfileSlug: "",
    notifyBySms: true,
    notifyByEmail: true,
    availability: null as WeeklyAvailability | null,
    slotDuration: 60,
    showReviewsOnBooking: true,
    publicEstimationEnabled: true,
    noShowProtectionEnabled: true,
    noShowProtectionDepositPercent: 25,
  });
  const [showQuickSetup, setShowQuickSetup] = useState(false);
  const [quickSetupPrice, setQuickSetupPrice] = useState("");
  const [slugError, setSlugError] = useState<string | null>(null);
  const [slugChecking, setSlugChecking] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const originalSlug = profile?.publicProfileSlug || "";

  useEffect(() => {
    if (profile) {
      let parsedAvailability = null;
      try {
        if (profile.availability) {
          parsedAvailability = typeof profile.availability === 'string' 
            ? JSON.parse(profile.availability) 
            : profile.availability;
        }
      } catch (e) {
        parsedAvailability = null;
      }
      setSettings({
        publicProfileEnabled: profile.publicProfileEnabled || false,
        publicProfileSlug: profile.publicProfileSlug || "",
        notifyBySms: profile.notifyBySms !== false,
        notifyByEmail: profile.notifyByEmail !== false,
        availability: parsedAvailability,
        slotDuration: profile.slotDuration || 60,
        showReviewsOnBooking: profile.showReviewsOnBooking !== false,
        publicEstimationEnabled: profile.publicEstimationEnabled !== false,
        noShowProtectionEnabled: profile.noShowProtectionEnabled !== false,
        noShowProtectionDepositPercent: profile.noShowProtectionDepositPercent ?? 25,
      });
    }
  }, [profile]);

  const RESERVED_SLUGS = new Set([
    "admin", "api", "login", "signup", "register", "settings", "profile",
    "dashboard", "help", "support", "about", "terms", "privacy", "contact",
    "pricing", "billing", "account", "app", "book", "booking", "onboarding",
    "downloads", "home", "test", "demo", "status", "health",
  ]);

  const handleSlugChange = (value: string) => {
    const cleaned = value.toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/--+/g, "-").replace(/^-|-$/g, "");
    setSettings({ ...settings, publicProfileSlug: cleaned });
    setSlugAvailable(null);

    if (!cleaned || cleaned.length < 3) {
      setSlugError(cleaned ? "URL must be at least 3 characters" : null);
      return;
    }
    if (cleaned.length > 48) {
      setSlugError("URL must be 48 characters or less");
      return;
    }
    if (RESERVED_SLUGS.has(cleaned)) {
      setSlugError("This URL is reserved. Please choose a different one.");
      return;
    }
    setSlugError(null);

    if (cleaned === originalSlug) {
      setSlugAvailable(null);
      return;
    }
    setSlugChecking(true);
  };

  useEffect(() => {
    const slug = settings.publicProfileSlug;
    if (!slug || slug.length < 3 || slug === originalSlug || slugError) {
      setSlugChecking(false);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await apiFetch(`/api/slug/check/${slug}`);
        const data = typeof res === 'string' ? JSON.parse(res) : res;
        if (data.available) {
          setSlugAvailable(true);
          setSlugError(null);
        } else {
          setSlugAvailable(false);
          setSlugError(data.reason || "This URL is not available");
        }
      } catch {
        setSlugAvailable(null);
      }
      setSlugChecking(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [settings.publicProfileSlug, originalSlug, slugError]);

  const updateMutation = useApiMutation(
    (data: any) => apiFetch("/api/settings", { method: "PATCH", body: JSON.stringify(data) }),
    [QUERY_KEYS.profile()],
    {
      onSuccess: () => {
        toast({ title: "Settings saved" });
      },
      onError: () => {
        toast({ title: "Failed to save settings", variant: "destructive" });
      },
    }
  );

  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE") return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await apiFetch("/api/account", { method: "DELETE" });
      window.location.href = "/";
    } catch (error) {
      setDeleteError("We couldn't delete your account. Please try again.");
      setIsDeleting(false);
    }
  };

  const resetDeleteDialog = () => {
    setDeleteConfirmText("");
    setDeleteError(null);
    setIsDeleting(false);
    setShowDeleteDialog(false);
  };

  const quickSetupMutation = useApiMutation(
    async (price: number) => {
      await apiFetch("/api/onboarding", { method: "PATCH", body: JSON.stringify({
        defaultPrice: price,
        depositPolicySet: true,
        completed: true,
        state: "completed",
        step: 8
      }) });
    },
    [QUERY_KEYS.onboarding(), QUERY_KEYS.profile()],
    {
      onSuccess: () => {
        setShowQuickSetup(false);
        setQuickSetupPrice("");
        toast({ title: "Deposit protection enabled" });
      },
      onError: () => {
        toast({ title: "Failed to save settings", variant: "destructive" });
      },
    }
  );

  const handleQuickSetup = () => {
    const priceInCents = Math.round(parseFloat(quickSetupPrice) * 100);
    if (isNaN(priceInCents) || priceInCents <= 0) {
      toast({ title: "Please enter a valid price", variant: "destructive" });
      return;
    }
    quickSetupMutation.mutate(priceInCents);
  };

  const handleSave = () => {
    if (slugError) {
      toast({ title: "Please fix the booking URL before saving", variant: "destructive" });
      return;
    }
    const dataToSave = {
      publicProfileEnabled: settings.publicProfileEnabled,
      publicProfileSlug: settings.publicProfileSlug,
      notifyBySms: settings.notifyBySms,
      notifyByEmail: settings.notifyByEmail,
      availability: settings.availability ? JSON.stringify(settings.availability) : null,
      slotDuration: settings.slotDuration,
      showReviewsOnBooking: settings.showReviewsOnBooking,
      publicEstimationEnabled: settings.publicEstimationEnabled,
      noShowProtectionEnabled: settings.noShowProtectionEnabled,
      noShowProtectionDepositPercent: settings.noShowProtectionDepositPercent,
    };
    updateMutation.mutate(dataToSave);
  };
  
  const handleAvailabilityChange = (availability: WeeklyAvailability, slotDuration: number) => {
    setSettings({ ...settings, availability, slotDuration });
  };

  const copyBookingLink = () => {
    const link = `${window.location.origin}/book/${settings.publicProfileSlug}`;
    navigator.clipboard.writeText(link);
    setBookingLinkCopied(true);
    setTimeout(() => setBookingLinkCopied(false), 2000);
    toast({ title: "Booking link copied!" });
  };

  const renderMobileHeader = () => (
    <div className="relative overflow-hidden bg-gradient-to-br from-slate-600 via-slate-700 to-slate-800 text-white px-4 pt-6 pb-8">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 -left-10 w-32 h-32 bg-slate-400/10 rounded-full blur-2xl" />
      </div>
      <div className="relative">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/more")}
          className="mb-4 -ml-2 text-white/80"
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center">
            <SettingsIcon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Settings</h1>
            <p className="text-slate-300/80">Configure your app preferences</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderDesktopHeader = () => (
    <div className="border-b bg-background sticky top-0 z-[999]">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-5 flex items-center gap-4">
        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-slate-500/10 to-gray-500/10 flex items-center justify-center">
          <SettingsIcon className="h-6 w-6 text-slate-700 dark:text-slate-300" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground">App preferences</p>
        </div>
      </div>
    </div>
  );

  const stripeStatusBanner = (
    <div className={`flex items-center gap-2 p-3 rounded-lg ${
      stripeEnabled && stripeStatus?.connected 
        ? 'bg-green-500/10 border border-green-500/20' 
        : 'bg-amber-500/10 border border-amber-500/20'
    }`}>
      {stripeEnabled && stripeStatus?.connected ? (
        <>
          <CheckCircle className="h-4 w-4 text-green-600" />
          <span className="text-sm text-green-700 dark:text-green-400">Stripe connected - You can accept card payments</span>
        </>
      ) : (
        <>
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <span className="text-sm text-amber-700 dark:text-amber-400">Enable Stripe to accept card payments and deposits</span>
        </>
      )}
    </div>
  );

  return (
    <div className={`min-h-screen bg-background ${isMobile ? 'pb-24' : 'pb-12'}`} data-testid="page-settings">
      {isMobile ? renderMobileHeader() : renderDesktopHeader()}

      <div className={`${isMobile ? 'px-4 py-4' : 'max-w-7xl mx-auto px-6 lg:px-8 py-6'} space-y-4`}>

        {/* SECTION 1: Get Paid (always expanded by default) */}
        <SettingsSectionAccordion
          id="get-paid"
          title="Get Paid"
          subtitle="Everything required to collect money from clients"
          icon={<DollarSign className="h-4 w-4 text-white" />}
          iconGradient="from-green-500 to-emerald-500"
          defaultOpen={true}
          className="border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/30 dark:bg-emerald-950/10"
          headerExtra={
            stripeEnabled && stripeStatus?.connected ? (
              <Badge variant="secondary" className="text-xs bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                Connected
              </Badge>
            ) : null
          }
        >
          <div className="space-y-6">
            {stripeStatusBanner}

            <PaymentMethodsSettings onStripeToggle={setStripeEnabled} />

            {stripeEnabled && (
              <>
                <Separator />
                <StripeConnectSettings />
              </>
            )}

            <Separator />

            <div className="space-y-4">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <Shield className="h-4 w-4 text-blue-500" />
                Deposit Protection
              </h4>
              
              {needsSetup ? (
                <div className="p-4 rounded-xl border-dashed border-2 border-primary/30 bg-primary/5">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Lock className="h-5 w-5 text-primary" />
                    </div>
                    <div className="space-y-2 flex-1">
                      <p className="font-medium text-foreground">Set a default price to enable booking protection</p>
                      <p className="text-sm text-muted-foreground">
                        Complete your pricing setup to automatically protect against no-shows.
                      </p>
                      {showQuickSetup ? (
                        <div className="mt-3 space-y-3">
                          <div>
                            <Label htmlFor="quick-setup-price" className="text-sm">Your typical job price</Label>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="relative flex-1">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                  id="quick-setup-price"
                                  type="number"
                                  placeholder="150"
                                  value={quickSetupPrice}
                                  onChange={(e) => setQuickSetupPrice(e.target.value)}
                                  className="pl-9"
                                  data-testid="input-quick-setup-price"
                                />
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              This enables automatic 30% deposit protection for bookings
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={handleQuickSetup}
                              disabled={quickSetupMutation.isPending}
                              data-testid="button-save-quick-setup"
                            >
                              {quickSetupMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              ) : null}
                              Enable Protection
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setShowQuickSetup(false)}
                              data-testid="button-cancel-quick-setup"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          className="mt-2"
                          onClick={() => setShowQuickSetup(true)}
                          data-testid="button-setup-deposit"
                        >
                          Quick setup (30 sec)
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">Protect me from no-shows</p>
                      <p className="text-xs text-muted-foreground">Automatically require deposits for higher-risk bookings</p>
                    </div>
                    <Switch
                      checked={settings.noShowProtectionEnabled}
                      onCheckedChange={(checked) => setSettings({ ...settings, noShowProtectionEnabled: checked })}
                      data-testid="switch-no-show-protection"
                    />
                  </div>
                  
                  {settings.noShowProtectionEnabled && (
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div>
                        <p className="font-medium text-sm">Default deposit amount</p>
                        <p className="text-xs text-muted-foreground">Percentage collected upfront for bookings</p>
                      </div>
                      <Select
                        value={String(settings.noShowProtectionDepositPercent)}
                        onValueChange={(value) => setSettings({ ...settings, noShowProtectionDepositPercent: Number(value) })}
                      >
                        <SelectTrigger className="w-24" data-testid="select-deposit-percent">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">0%</SelectItem>
                          <SelectItem value="10">10%</SelectItem>
                          <SelectItem value="25">25%</SelectItem>
                          <SelectItem value="50">50%</SelectItem>
                          <SelectItem value="75">75%</SelectItem>
                          <SelectItem value="100">100%</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </SettingsSectionAccordion>

        {/* SECTION 2: Get Booked */}
        <SettingsSectionAccordion
          id="get-booked"
          title="Get Booked"
          subtitle="How clients find and book you"
          icon={<Globe className="h-4 w-4 text-white" />}
          iconGradient="from-blue-500 to-indigo-500"
          defaultOpen={false}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Enable Public Profile</p>
                <p className="text-xs text-muted-foreground">Let clients find and book you</p>
              </div>
              <Switch
                checked={settings.publicProfileEnabled}
                onCheckedChange={(checked) => setSettings({ ...settings, publicProfileEnabled: checked })}
                data-testid="switch-public-profile"
              />
            </div>

            {settings.publicProfileEnabled && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label className="text-sm">Your Booking URL</Label>
                  <div className="flex gap-2">
                    <Input
                      value={settings.publicProfileSlug}
                      onChange={(e) => handleSlugChange(e.target.value)}
                      placeholder="your-name"
                      data-testid="input-profile-slug"
                    />
                    <Button variant="outline" size="icon" onClick={copyBookingLink} data-testid="button-copy-booking">
                      {bookingLinkCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground">
                      {window.location.origin}/book/{settings.publicProfileSlug || "your-name"}
                    </p>
                    {slugChecking && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                    {slugAvailable === true && !slugChecking && (
                      <span className="text-xs text-green-600 flex items-center gap-1">
                        <Check className="h-3 w-3" /> Available
                      </span>
                    )}
                  </div>
                  {slugError && (
                    <p className="text-xs text-destructive">{slugError}</p>
                  )}
                </div>

                {needsSetup && (
                  <div className="p-4 rounded-xl border-dashed border-2 border-amber-500/30 bg-amber-500/5">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                        <Lock className="h-5 w-5 text-amber-600" />
                      </div>
                      <div className="space-y-2">
                        <p className="font-medium text-foreground">Complete setup to enable deposits</p>
                        <p className="text-sm text-muted-foreground">
                          Your booking link works, but deposits won't be collected until you complete setup.
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2"
                          onClick={() => navigate("/onboarding")}
                          data-testid="button-setup-booking"
                        >
                          Quick setup (30 sec)
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-sm">Your Services</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate("/profile?edit=true")}
                      data-testid="button-edit-services"
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1.5" />
                      Edit in Profile
                    </Button>
                  </div>
                  {profile?.services && profile.services.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {profile.services.map((service: string) => (
                        <Badge key={service} variant="secondary">
                          {service}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No services added yet. Edit your profile to add services.</p>
                  )}
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {settings.showReviewsOnBooking ? <Eye className="h-4 w-4 text-muted-foreground" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                    <div>
                      <p className="font-medium text-sm">Show Reviews</p>
                      <p className="text-xs text-muted-foreground">Display ratings on booking page</p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.showReviewsOnBooking}
                    onCheckedChange={(checked) => setSettings({ ...settings, showReviewsOnBooking: checked })}
                    data-testid="switch-show-reviews"
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">Public Price Estimates</p>
                      <p className="text-xs text-muted-foreground">Allow customers to get AI estimates on booking page</p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.publicEstimationEnabled}
                    onCheckedChange={(checked) => setSettings({ ...settings, publicEstimationEnabled: checked })}
                    data-testid="switch-public-estimation"
                  />
                </div>

                <Separator />

                {settings.publicProfileEnabled && (
                  <AvailabilityEditor
                    availability={settings.availability}
                    slotDuration={settings.slotDuration}
                    onChange={handleAvailabilityChange}
                  />
                )}
              </>
            )}

            {!settings.publicProfileEnabled && (
              <p className="text-sm text-muted-foreground py-2">
                Enable your public profile above to configure availability.
              </p>
            )}
          </div>
        </SettingsSectionAccordion>

        {/* SECTION 3: Automate */}
        <SettingsSectionAccordion
          id="automate"
          title="Automate"
          subtitle="Let GigAid follow up for you"
          icon={<Zap className="h-4 w-4 text-white" />}
          iconGradient="from-orange-500 to-amber-500"
          defaultOpen={false}
        >
          <div className="space-y-6">
            <AutomationSettings />
            <Separator />
            <div>
              <h4 className="font-medium text-sm flex items-center gap-2 mb-4">
                <MessageCircle className="h-4 w-4 text-blue-500" />
                Messaging
              </h4>
              <MessagingSettings />
            </div>
          </div>
        </SettingsSectionAccordion>

        {/* SECTION 4: Account */}
        <SettingsSectionAccordion
          id="account"
          title="Account"
          subtitle="Your account and app preferences"
          icon={<User className="h-4 w-4 text-white" />}
          iconGradient="from-violet-500 to-purple-600"
          defaultOpen={false}
        >
          <div className="space-y-6">
            {/* Plan */}
            {!isBusinessPlan && subscription !== undefined && (
              <>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center shrink-0">
                      <Crown className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Current Plan: {currentPlanLabel}</p>
                      <p className="text-sm text-muted-foreground">Unlock advanced automations, booking protection, and AI tools</p>
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => navigate("/pricing")}
                    data-testid="button-upgrade-plan"
                  >
                    Upgrade
                  </Button>
                </div>
                <Separator />
              </>
            )}

            <SubscriptionSettings />

            <Separator />

            {/* Notifications */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <Bell className="h-4 w-4 text-amber-500" />
                Notifications
              </h4>
              <div className="space-y-4 pl-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">SMS Notifications</p>
                    <p className="text-xs text-muted-foreground">Receive updates via text message</p>
                  </div>
                  <Switch
                    checked={settings.notifyBySms}
                    onCheckedChange={(checked) => setSettings({ ...settings, notifyBySms: checked })}
                    data-testid="switch-notify-sms"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Email Notifications</p>
                    <p className="text-xs text-muted-foreground">Receive updates via email</p>
                  </div>
                  <Switch
                    checked={settings.notifyByEmail}
                    onCheckedChange={(checked) => setSettings({ ...settings, notifyByEmail: checked })}
                    data-testid="switch-notify-email"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* AI Suggestions */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-500" />
                AI Suggestions
              </h4>
              <div className="pl-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Smart Action Nudges</p>
                    <p className="text-xs text-muted-foreground">Get AI-powered suggestions for leads and invoices</p>
                  </div>
                  <Switch
                    checked={aiNudgesFlag?.enabled ?? true}
                    onCheckedChange={(checked) => {
                      updateFeatureFlag.mutate({ key: "ai_micro_nudges", enabled: checked });
                    }}
                    disabled={updateFeatureFlag.isPending}
                    data-testid="switch-ai-nudges"
                  />
                </div>
              </div>
            </div>

            <Separator />

            <EmailSignatureSettings />

            <Separator />

            <AccountLinking
              currentProvider={profile?.authProvider || 'email'}
              linkedMethods={[
                ...(profile?.firebaseUid ? [{ provider: 'google' as const, verified: true }] : []),
              ]}
              email={profile?.email}
              phone={profile?.phone}
              onLinkApple={async () => {
                toast({ title: "Apple linking", description: "Apple Sign In linking is available in the mobile app" });
              }}
              onLinkGoogle={async () => {
                toast({ title: "Google linking", description: "Google Sign In linking is available in the mobile app" });
              }}
              onLinkPhone={() => {
                toast({ title: "Phone linking", description: "Phone verification linking is available in the mobile app" });
              }}
              onLinkEmail={() => {
                toast({ title: "Email linking", description: "Email linking is available in the mobile app" });
              }}
            />

            <Separator />

            <div className="space-y-4">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-indigo-500" />
                Analytics
              </h4>
              <div className="pl-6 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-sm">Enable usage analytics</p>
                    <p className="text-xs text-muted-foreground">We use anonymous usage data to improve reliability and features. You can change this anytime.</p>
                  </div>
                  <Switch
                    checked={analyticsEnabled}
                    onCheckedChange={handleAnalyticsToggle}
                    data-testid="switch-analytics"
                  />
                </div>
                {attBlocked && (
                  <div className="p-3 text-xs text-muted-foreground bg-muted rounded-md" data-testid="text-att-blocked">
                    <p>Tracking is disabled in your iOS settings. To enable analytics, allow tracking in <strong>Settings &gt; Privacy &amp; Security &gt; Tracking</strong>.</p>
                  </div>
                )}
              </div>
            </div>

            {isAuthenticated && (
              <>
                <Separator />

                <div className="space-y-4">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <Lock className="h-4 w-4 text-slate-500" />
                    Account & Security
                  </h4>
                  <div className="pl-6 space-y-4">
                    {isEmailPasswordUser() && (
                      <ChangePasswordDialog />
                    )}

                    <p className="text-xs text-muted-foreground">
                      Reviewer: Settings &rarr; Account &amp; Security &rarr; Delete Account
                    </p>

                    {deleteError && (
                      <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md" data-testid="text-delete-error">
                        {deleteError}
                      </div>
                    )}
                    <AlertDialog open={showDeleteDialog} onOpenChange={(open) => { if (!open) resetDeleteDialog(); else setShowDeleteDialog(true); }}>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="destructive" 
                          className="w-full"
                          data-testid="button-delete-account"
                        >
                          Delete account
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent data-testid="dialog-delete-account">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                          <AlertDialogDescription asChild>
                            <div className="space-y-3">
                              <p>This action is <strong>permanent</strong> and cannot be undone. All of the following will be deleted:</p>
                              <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                                <li>Your profile and personal information</li>
                                <li>All jobs, leads, and clients</li>
                                <li>Invoices and payment records</li>
                                <li>Booking requests and reviews</li>
                                <li>Voice notes and photos</li>
                                <li>Crew memberships and messages</li>
                                <li>Stripe payment connections</li>
                                <li>All analytics and tracking data</li>
                                <li>Referrals, templates, and automation rules</li>
                              </ul>
                              <p className="text-sm">Type <strong>DELETE</strong> below to confirm:</p>
                              <Input
                                data-testid="input-delete-confirm"
                                placeholder="Type DELETE to confirm"
                                value={deleteConfirmText}
                                onChange={(e) => setDeleteConfirmText(e.target.value)}
                                autoComplete="off"
                                disabled={isDeleting}
                              />
                              {deleteError && (
                                <p className="text-sm text-destructive">{deleteError}</p>
                              )}
                            </div>
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel data-testid="button-cancel-delete" disabled={isDeleting}>Cancel</AlertDialogCancel>
                          <Button
                            variant="destructive"
                            onClick={handleDeleteAccount}
                            disabled={isDeleting || deleteConfirmText !== "DELETE"}
                            data-testid="button-confirm-delete"
                          >
                            {isDeleting ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : null}
                            Permanently delete account
                          </Button>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>

                <Separator />

                {/* Data Export */}
                <div className="space-y-3">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <Download className="h-4 w-4 text-blue-500" />
                    Export Data
                  </h4>
                  <button 
                    onClick={() => handleAuthenticatedDownload("/api/export/json", `gigaid-export-${new Date().toISOString().split('T')[0]}.json`)}
                    className="block w-full text-left"
                    data-testid="button-download-json"
                  >
                    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg hover-elevate cursor-pointer">
                      <FileJson className="h-5 w-5 text-blue-500" />
                      <div className="flex-1">
                        <p className="font-medium text-sm">Download JSON</p>
                        <p className="text-xs text-muted-foreground">Complete data export</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </button>
                  <button 
                    onClick={() => handleAuthenticatedDownload("/api/export/dot", `gigaid-graph-${new Date().toISOString().split('T')[0]}.dot`)}
                    className="block w-full text-left"
                    data-testid="button-download-dot"
                  >
                    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg hover-elevate cursor-pointer">
                      <Share className="h-5 w-5 text-purple-500" />
                      <div className="flex-1">
                        <p className="font-medium text-sm">Download DOT Graph</p>
                        <p className="text-xs text-muted-foreground">Data relationships (GraphViz)</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>
        </SettingsSectionAccordion>

        {/* Save Button */}
        <Button 
          onClick={handleSave} 
          className="w-full" 
          size="lg"
          disabled={updateMutation.isPending}
          data-testid="button-save-settings"
        >
          {updateMutation.isPending ? (
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
          ) : null}
          Save Settings
        </Button>
      </div>
    </div>
  );
}
