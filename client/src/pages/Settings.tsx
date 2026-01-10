import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Bell, 
  Link2, 
  Share2, 
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
} from "lucide-react";
import { AvailabilityEditor, DEFAULT_AVAILABILITY } from "@/components/settings/AvailabilityEditor";
import { PaymentMethodsSettings } from "@/components/PaymentMethodsSettings";
import type { Referral, WeeklyAvailability } from "@shared/schema";

interface ReferralData {
  referralCode: string;
  referrals: Referral[];
  totalRewards: number;
}

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [bookingLinkCopied, setBookingLinkCopied] = useState(false);

  const { data: profile } = useQuery<any>({
    queryKey: ["/api/profile"],
  });

  const { data: referralData } = useQuery<ReferralData>({
    queryKey: ["/api/referrals"],
  });

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

  const copyReferralLink = () => {
    const link = `${window.location.origin}/join?ref=${referralData?.referralCode || ""}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Referral link copied!" });
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
    <div className="p-4 pb-24 space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card data-testid="card-notifications">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
          </CardTitle>
          <CardDescription>Configure how you receive notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">SMS Notifications</p>
              <p className="text-sm text-muted-foreground">Receive updates via text message</p>
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
              <p className="font-medium">Email Notifications</p>
              <p className="text-sm text-muted-foreground">Receive updates via email</p>
            </div>
            <Switch
              checked={settings.notifyByEmail}
              onCheckedChange={(checked) => setSettings({ ...settings, notifyByEmail: checked })}
              data-testid="switch-notify-email"
            />
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-public-profile">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Public Profile & Booking
          </CardTitle>
          <CardDescription>Let clients find and book you directly</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Enable Public Profile</p>
              <p className="text-sm text-muted-foreground">Make your profile visible to clients</p>
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
                <Label htmlFor="slug">Profile URL</Label>
                <div className="flex gap-2">
                  <Input
                    id="slug"
                    value={settings.publicProfileSlug}
                    onChange={(e) => setSettings({ ...settings, publicProfileSlug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })}
                    placeholder="your-name"
                    data-testid="input-profile-slug"
                  />
                  <Button variant="outline" onClick={copyBookingLink} data-testid="button-copy-booking">
                    {bookingLinkCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {window.location.origin}/book/{settings.publicProfileSlug || "your-name"}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Services</Label>
                <div className="flex flex-wrap gap-2">
                  {settings.services.map((service) => (
                    <Badge key={service} variant="secondary" className="cursor-pointer" onClick={() => removeService(service)}>
                      {service} &times;
                    </Badge>
                  ))}
                </div>
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
                <div className="flex gap-2 mt-2">
                  <Input
                    value={customServiceInput}
                    onChange={(e) => setCustomServiceInput(e.target.value)}
                    placeholder="Add custom service..."
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
                <div>
                  <p className="font-medium flex items-center gap-2">
                    {settings.showReviewsOnBooking ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    Show Reviews on Booking Page
                  </p>
                  <p className="text-sm text-muted-foreground">Let potential clients see your ratings</p>
                </div>
                <Switch
                  checked={settings.showReviewsOnBooking}
                  onCheckedChange={(checked) => setSettings({ ...settings, showReviewsOnBooking: checked })}
                  data-testid="switch-show-reviews"
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {settings.publicProfileEnabled && (
        <AvailabilityEditor
          availability={settings.availability}
          slotDuration={settings.slotDuration}
          onChange={handleAvailabilityChange}
        />
      )}

      <PaymentMethodsSettings />

      <Card data-testid="card-referrals">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Referrals
          </CardTitle>
          <CardDescription>Invite others and earn rewards</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-lg bg-muted">
            <p className="text-sm text-muted-foreground mb-2">Your referral code</p>
            <div className="flex items-center gap-2">
              <code className="text-lg font-mono font-bold">{referralData?.referralCode || "Loading..."}</code>
              <Button variant="ghost" size="icon" onClick={copyReferralLink} data-testid="button-copy-referral">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold">{referralData?.referrals?.length || 0}</p>
              <p className="text-sm text-muted-foreground">People referred</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-green-600">
                ${((referralData?.totalRewards || 0) / 100).toFixed(2)}
              </p>
              <p className="text-sm text-muted-foreground">Total rewards</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-export">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Data
          </CardTitle>
          <CardDescription>Download your data in different formats</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3">
            <a 
              href="/api/export/json" 
              download
              className="w-full"
            >
              <Button variant="outline" className="w-full justify-start" data-testid="button-export-json">
                <FileJson className="h-4 w-4 mr-2 text-blue-500" />
                <div className="text-left">
                  <p className="font-medium">Download JSON</p>
                  <p className="text-xs text-muted-foreground">Complete data export</p>
                </div>
              </Button>
            </a>
            <a 
              href="/api/export/dot" 
              download
              className="w-full"
            >
              <Button variant="outline" className="w-full justify-start" data-testid="button-export-dot">
                <Share className="h-4 w-4 mr-2 text-purple-500" />
                <div className="text-left">
                  <p className="font-medium">Download DOT Graph</p>
                  <p className="text-xs text-muted-foreground">Data relationships (GraphViz format)</p>
                </div>
              </Button>
            </a>
          </div>
          <p className="text-xs text-muted-foreground">
            JSON includes all your jobs, leads, invoices, and more. DOT file can be visualized at graphviz.org
          </p>
        </CardContent>
      </Card>

      <Card data-testid="card-premium">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-yellow-500" />
            Pro Plan
          </CardTitle>
          <CardDescription>Unlock advanced features</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              <span className="text-sm">Web dashboard access</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              <span className="text-sm">Google Calendar sync</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              <span className="text-sm">Advanced analytics</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              <span className="text-sm">Priority support</span>
            </div>
          </div>
          <Button className="w-full mt-4" data-testid="button-upgrade-pro">
            Upgrade to Pro - $9.99/month
          </Button>
        </CardContent>
      </Card>

      <Button 
        onClick={handleSave} 
        className="w-full" 
        disabled={updateMutation.isPending}
        data-testid="button-save-settings"
      >
        {updateMutation.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : null}
        Save Settings
      </Button>
    </div>
  );
}
