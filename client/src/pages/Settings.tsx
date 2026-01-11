import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
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
} from "lucide-react";
import { AvailabilityEditor, DEFAULT_AVAILABILITY } from "@/components/settings/AvailabilityEditor";
import { PaymentMethodsSettings } from "@/components/PaymentMethodsSettings";
import { StripeConnectSettings } from "@/components/settings/StripeConnectSettings";
import type { Referral, WeeklyAvailability } from "@shared/schema";

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

export default function Settings() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [bookingLinkCopied, setBookingLinkCopied] = useState(false);

  const { data: profile } = useQuery<any>({
    queryKey: ["/api/profile"],
  });

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

  const [settings, setSettings] = useState({
    publicProfileEnabled: false,
    publicProfileSlug: "",
    notifyBySms: true,
    notifyByEmail: true,
    services: [] as string[],
    availability: null as WeeklyAvailability | null,
    slotDuration: 60,
    showReviewsOnBooking: true,
  });
  const [customServiceInput, setCustomServiceInput] = useState("");

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
        services: profile.services || [],
        availability: parsedAvailability,
        slotDuration: profile.slotDuration || 60,
        showReviewsOnBooking: profile.showReviewsOnBooking !== false,
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

  const handleSave = () => {
    const dataToSave = {
      publicProfileEnabled: settings.publicProfileEnabled,
      publicProfileSlug: settings.publicProfileSlug,
      notifyBySms: settings.notifyBySms,
      notifyByEmail: settings.notifyByEmail,
      services: settings.services,
      availability: settings.availability ? JSON.stringify(settings.availability) : null,
      slotDuration: settings.slotDuration,
      showReviewsOnBooking: settings.showReviewsOnBooking,
    };
    updateMutation.mutate(dataToSave);
  };
  
  const handleAddCustomService = () => {
    const trimmed = customServiceInput.trim().toLowerCase();
    if (trimmed && !settings.services.includes(trimmed)) {
      setSettings({ ...settings, services: [...settings.services, trimmed] });
      setCustomServiceInput("");
    }
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

  const addService = (service: string) => {
    if (service && !settings.services.includes(service)) {
      setSettings({ ...settings, services: [...settings.services, service] });
    }
  };

  const removeService = (service: string) => {
    setSettings({ ...settings, services: settings.services.filter(s => s !== service) });
  };

  return (
    <div className="min-h-screen bg-background pb-24" data-testid="page-settings">
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
            className="mb-4 -ml-2 text-white/80 hover:text-white hover:bg-white/10"
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

      <div className="px-4 py-4 space-y-4">
        <Card className="border-0 shadow-md" data-testid="card-notifications">
          <CardContent className="p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                <Bell className="h-4 w-4 text-white" />
              </div>
              Notifications
            </h3>
            <div className="space-y-4">
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
              <Separator />
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
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md" data-testid="card-public-profile">
          <CardContent className="p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                <Globe className="h-4 w-4 text-white" />
              </div>
              Public Profile & Booking
            </h3>
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

                  <div className="space-y-3">
                    <Label className="text-sm">Your Services</Label>
                    {settings.services.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {settings.services.map((service) => (
                          <Badge 
                            key={service} 
                            variant="secondary" 
                            className="cursor-pointer hover:bg-destructive/10 hover:text-destructive" 
                            onClick={() => removeService(service)}
                          >
                            {service} &times;
                          </Badge>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {["plumbing", "electrical", "cleaning", "handyman", "landscaping"].map((s) => (
                        !settings.services.includes(s) && (
                          <Badge
                            key={s}
                            variant="outline"
                            className="cursor-pointer"
                            onClick={() => addService(s)}
                            data-testid={`badge-add-${s}`}
                          >
                            + {s}
                          </Badge>
                        )
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={customServiceInput}
                        onChange={(e) => setCustomServiceInput(e.target.value)}
                        placeholder="Add custom service..."
                        className="h-10"
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCustomService())}
                        data-testid="input-custom-service"
                      />
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="icon"
                        onClick={handleAddCustomService}
                        data-testid="button-add-custom-service"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
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
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {settings.publicProfileEnabled && (
          <AvailabilityEditor
            availability={settings.availability}
            slotDuration={settings.slotDuration}
            onChange={handleAvailabilityChange}
          />
        )}

        <PaymentMethodsSettings onStripeToggle={setStripeEnabled} />

        {stripeEnabled && <StripeConnectSettings />}

        <Card className="border-0 shadow-md" data-testid="card-export">
          <CardContent className="p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                <Download className="h-4 w-4 text-white" />
              </div>
              Export Data
            </h3>
            <div className="space-y-3">
              <a href="/api/export/json" download className="block">
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg hover-elevate cursor-pointer">
                  <FileJson className="h-5 w-5 text-blue-500" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">Download JSON</p>
                    <p className="text-xs text-muted-foreground">Complete data export</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </a>
              <a href="/api/export/dot" download className="block">
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg hover-elevate cursor-pointer">
                  <Share className="h-5 w-5 text-purple-500" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">Download DOT Graph</p>
                    <p className="text-xs text-muted-foreground">Data relationships (GraphViz)</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </a>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md overflow-hidden" data-testid="card-premium">
          <div className="bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-400 p-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-white/20 flex items-center justify-center">
                <Crown className="h-6 w-6 text-white" />
              </div>
              <div className="text-white">
                <h3 className="font-bold">Upgrade to Pro</h3>
                <p className="text-sm text-white/80">Unlock all premium features</p>
              </div>
            </div>
          </div>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                { icon: Sparkles, label: "Web Dashboard" },
                { icon: Sparkles, label: "Calendar Sync" },
                { icon: Sparkles, label: "Analytics" },
                { icon: Sparkles, label: "Priority Support" },
              ].map((feature, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>{feature.label}</span>
                </div>
              ))}
            </div>
            <Button className="w-full bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600" data-testid="button-upgrade-pro">
              <Crown className="h-4 w-4 mr-2" />
              Upgrade - $9.99/month
            </Button>
          </CardContent>
        </Card>

        <Button 
          onClick={handleSave} 
          className="w-full h-12 text-base" 
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
