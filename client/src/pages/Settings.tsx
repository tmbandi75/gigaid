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
  Settings as SettingsIcon, 
  Bell, 
  Link2, 
  Share2, 
  Crown, 
  Copy, 
  Check,
  Loader2,
  ExternalLink,
} from "lucide-react";
import type { User, Referral } from "@shared/schema";

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
    businessName: "",
    bio: "",
    services: [] as string[],
  });

  useEffect(() => {
    if (profile) {
      setSettings({
        publicProfileEnabled: profile.publicProfileEnabled || false,
        publicProfileSlug: profile.publicProfileSlug || "",
        notifyBySms: profile.notifyBySms !== false,
        notifyByEmail: profile.notifyByEmail !== false,
        businessName: profile.businessName || "",
        bio: profile.bio || "",
        services: profile.services || [],
      });
    }
  }, [profile]);

  const updateMutation = useMutation({
    mutationFn: (data: Partial<typeof settings>) => apiRequest("PATCH", "/api/settings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      toast({ title: "Settings saved" });
    },
    onError: () => {
      toast({ title: "Failed to save settings", variant: "destructive" });
    },
  });

  const handleSave = () => {
    updateMutation.mutate(settings);
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
                <Label htmlFor="businessName">Business Name</Label>
                <Input
                  id="businessName"
                  value={settings.businessName}
                  onChange={(e) => setSettings({ ...settings, businessName: e.target.value })}
                  placeholder="Your Business Name"
                  data-testid="input-business-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  value={settings.bio}
                  onChange={(e) => setSettings({ ...settings, bio: e.target.value })}
                  placeholder="Tell clients about yourself..."
                  rows={3}
                  data-testid="input-bio"
                />
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
                <div className="flex gap-2">
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
              </div>
            </>
          )}
        </CardContent>
      </Card>

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
