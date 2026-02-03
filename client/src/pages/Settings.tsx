import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { getAuthToken } from "@/lib/authToken";
import { 
  Bell, 
  Link2, 
  Crown, 
  Copy, 
  Check,
  Loader2,
  Plus,
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
  Trash2,
  CreditCard,
  Calendar,
  Zap,
  User,
  AlertCircle,
  CheckCircle,
  Pencil,
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
import { AvailabilityEditor, DEFAULT_AVAILABILITY } from "@/components/settings/AvailabilityEditor";
import { PaymentMethodsSettings } from "@/components/PaymentMethodsSettings";
import { StripeConnectSettings } from "@/components/settings/StripeConnectSettings";
import { EmailSignatureSettings } from "@/components/settings/EmailSignatureSettings";
import { AccountLinking } from "@/components/mobile-auth/AccountLinking";
import { AutomationSettings } from "@/components/settings/AutomationSettings";
import { ChangePasswordDialog } from "@/components/settings/ChangePasswordDialog";
import { SubscriptionSettings } from "@/components/settings/SubscriptionSettings";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { isEmailPasswordUser } from "@/lib/firebase";
import type { Referral, WeeklyAvailability, FeatureFlag } from "@shared/schema";
import { useFeatureFlag, useUpdateFeatureFlag } from "@/hooks/use-nudges";

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
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [bookingLinkCopied, setBookingLinkCopied] = useState(false);
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState("general");

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
      console.error("Download error:", error);
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
    queryKey: ["/api/profile"],
  });

  const { data: onboardingStatus, isLoading: isOnboardingLoading } = useQuery<OnboardingStatus>({
    queryKey: ["/api/onboarding"],
  });

  const { data: subscription } = useQuery<{ plan: string; hasSubscription: boolean }>({
    queryKey: ["/api/subscription/status"],
    retry: 1,
    staleTime: 60000,
  });

  const isBusinessPlan = subscription !== undefined && subscription.plan === "business";
  const currentPlanLabel = subscription?.plan 
    ? subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1).replace("_", "+")
    : "Free";

  const isMoneyProtectionReady = onboardingStatus ? onboardingStatus.moneyProtectionReady : true;
  const needsSetup = !isOnboardingLoading && !isMoneyProtectionReady;

  const { data: paymentMethods } = useQuery<PaymentMethod[]>({
    queryKey: ["/api/payment-methods"],
  });

  const savedStripeEnabled = paymentMethods?.some(
    (method) => method.type === "stripe" && method.isEnabled
  ) ?? false;
  
  const [stripeEnabled, setStripeEnabled] = useState(false);
  
  useEffect(() => {
    setStripeEnabled(savedStripeEnabled);
  }, [savedStripeEnabled]);

  const { data: stripeStatus } = useQuery<{ connected: boolean; accountId?: string }>({
    queryKey: ["/api/stripe/connect/status"],
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

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", "/api/settings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      toast({ title: "Settings saved" });
    },
    onError: () => {
      toast({ title: "Failed to save settings", variant: "destructive" });
    },
  });

  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await apiRequest("POST", "/api/account/delete", {});
      window.location.href = "/";
    } catch (error) {
      setDeleteError("We couldn't delete your account. Please try again.");
      setIsDeleting(false);
    }
  };

  const quickSetupMutation = useMutation({
    mutationFn: async (price: number) => {
      await apiRequest("PATCH", "/api/onboarding", {
        defaultPrice: price,
        depositPolicySet: true,
        completed: true,
        state: "completed",
        step: 8
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      setShowQuickSetup(false);
      setQuickSetupPrice("");
      toast({ title: "Deposit protection enabled" });
    },
    onError: () => {
      toast({ title: "Failed to save settings", variant: "destructive" });
    },
  });

  const handleQuickSetup = () => {
    const priceInCents = Math.round(parseFloat(quickSetupPrice) * 100);
    if (isNaN(priceInCents) || priceInCents <= 0) {
      toast({ title: "Please enter a valid price", variant: "destructive" });
      return;
    }
    quickSetupMutation.mutate(priceInCents);
  };

  const handleSave = () => {
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

      <div className={`${isMobile ? 'px-4 py-4' : 'max-w-7xl mx-auto px-6 lg:px-8 py-6'}`}>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6" data-testid="tabs-settings">
            <TabsTrigger value="general" className="flex items-center gap-2" data-testid="tab-general">
              <SettingsIcon className="h-4 w-4" />
              General
            </TabsTrigger>
            <TabsTrigger value="billing" className="flex items-center gap-2" data-testid="tab-billing">
              <CreditCard className="h-4 w-4" />
              Billing
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4">
            {/* Plan Status Banner - only shown for non-Business plans */}
            {!isBusinessPlan && subscription !== undefined && (
              <Card className="border-0 shadow-sm" data-testid="card-plan-status">
                <CardContent className="py-4 px-5">
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
                </CardContent>
              </Card>
            )}

            {/* SECTION 1: Booking & Public Profile */}
        <SettingsSection
          title="Booking & Public Profile"
          subtitle="How clients find and book you"
          icon={<Globe className="h-4 w-4 text-white" />}
          iconGradient="from-emerald-500 to-teal-500"
          testId="card-public-profile"
          defaultExpanded={true}
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
                      onChange={(e) => setSettings({ ...settings, publicProfileSlug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })}
                      placeholder="your-name"
                      className="h-10"
                      data-testid="input-profile-slug"
                    />
                    <Button variant="outline" size="icon" onClick={copyBookingLink} data-testid="button-copy-booking">
                      {bookingLinkCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {window.location.origin}/book/{settings.publicProfileSlug || "your-name"}
                  </p>
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
              </>
            )}
          </div>
        </SettingsSection>

        {/* SECTION 2: Availability & Booking Rules */}
        <SettingsSection
          title="Availability & Booking Rules"
          subtitle="When clients can book and how bookings are protected"
          icon={<Calendar className="h-4 w-4 text-white" />}
          iconGradient="from-blue-500 to-indigo-500"
          testId="card-availability-rules"
          defaultExpanded={true}
        >
          <div className="space-y-4">
            {settings.publicProfileEnabled && (
              <AvailabilityEditor
                availability={settings.availability}
                slotDuration={settings.slotDuration}
                onChange={handleAvailabilityChange}
              />
            )}

            {!settings.publicProfileEnabled && (
              <p className="text-sm text-muted-foreground py-2">
                Enable your public profile above to configure availability.
              </p>
            )}

            <Separator />

            <div className="space-y-4">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <Shield className="h-4 w-4 text-blue-500" />
                Booking Protection
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
        </SettingsSection>

        {/* SECTION 3: Payments & Payouts */}
        <SettingsSection
          title="Payments & Payouts"
          subtitle="How you get paid and collect deposits"
          icon={<CreditCard className="h-4 w-4 text-white" />}
          iconGradient="from-green-500 to-emerald-500"
          testId="card-payments"
          defaultExpanded={true}
          statusBanner={stripeStatusBanner}
        >
          <div className="space-y-4">
            <PaymentMethodsSettings onStripeToggle={setStripeEnabled} />
            
            {stripeEnabled && (
              <>
                <Separator />
                <StripeConnectSettings />
              </>
            )}
          </div>
        </SettingsSection>

        {/* SECTION 4: Automations */}
        <SettingsSection
          title="Automations"
          subtitle="Messages sent automatically on your behalf"
          icon={<Zap className="h-4 w-4 text-white" />}
          iconGradient="from-orange-500 to-amber-500"
          testId="card-automations"
          defaultExpanded={true}
          collapsible={true}
        >
          <AutomationSettings />
        </SettingsSection>

        {/* SECTION 5: Preferences & Account */}
        <SettingsSection
          title="Preferences & Account"
          subtitle="App preferences and sign-in options"
          icon={<User className="h-4 w-4 text-white" />}
          iconGradient="from-violet-500 to-purple-600"
          testId="card-preferences-account"
          defaultExpanded={false}
          collapsible={true}
        >
          <div className="space-y-6">
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

            {/* Email Signature */}
            <EmailSignatureSettings />

            <Separator />

            {/* Account Linking */}
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

            {isAuthenticated && (
              <>
                <Separator />

                {/* Account & Security */}
                <div className="space-y-4">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <Lock className="h-4 w-4 text-slate-500" />
                    Account & Security
                  </h4>
                  <div className="pl-6 space-y-4">
                    {isEmailPasswordUser() && (
                      <ChangePasswordDialog />
                    )}

                    {deleteError && (
                      <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md" data-testid="text-delete-error">
                        {deleteError}
                      </div>
                    )}
                    <AlertDialog>
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
                          <AlertDialogDescription>
                            This will permanently delete your account and associated data. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleDeleteAccount}
                            disabled={isDeleting}
                            className="bg-destructive text-destructive-foreground"
                            data-testid="button-confirm-delete"
                          >
                            {isDeleting ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : null}
                            Delete account
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </>
            )}
          </div>
        </SettingsSection>

        {/* Data Export */}
        {isAuthenticated && (
          <SettingsSection
            title="Export Data"
            subtitle="Download your data"
            icon={<Download className="h-4 w-4 text-white" />}
            iconGradient="from-blue-500 to-cyan-500"
            testId="card-export"
            defaultExpanded={false}
            collapsible={true}
          >
            <div className="space-y-3">
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
          </SettingsSection>
        )}

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
          </TabsContent>

          <TabsContent value="billing" className="space-y-4">
            {isAuthenticated && <SubscriptionSettings />}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
