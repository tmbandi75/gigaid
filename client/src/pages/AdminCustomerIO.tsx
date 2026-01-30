import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { 
  Mail, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  Loader2,
  Play,
  Pause,
  Send,
  Users,
  BarChart3,
  Sparkles,
  Zap,
  Radio,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface CustomerIOStatus {
  configured: boolean;
  trackingApiConfigured: boolean;
  appApiConfigured: boolean;
}

interface Campaign {
  id: string;
  name: string;
  type: string;
  active: boolean;
  created: number;
  updated: number;
}

export default function AdminCustomerIO() {
  const { toast } = useToast();
  const [syncUserId, setSyncUserId] = useState("");
  const [eventUserId, setEventUserId] = useState("");
  const [eventName, setEventName] = useState("");

  const { data: status, isLoading: statusLoading } = useQuery<CustomerIOStatus>({
    queryKey: ["/api/admin/customerio/status"],
  });

  const { data: campaignsData, isLoading: campaignsLoading } = useQuery<{ campaigns: Campaign[] }>({
    queryKey: ["/api/admin/customerio/campaigns"],
    enabled: status?.appApiConfigured === true,
  });

  const { data: metricsData } = useQuery<{ period: string; actions: { actionKey: string; count: number }[] }>({
    queryKey: ["/api/admin/customerio/delivery-metrics"],
  });

  const syncUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest("POST", `/api/admin/customerio/sync-user/${userId}`);
    },
    onSuccess: () => {
      toast({ title: "User synced to Customer.io" });
      setSyncUserId("");
    },
    onError: (error: Error) => {
      toast({ title: "Sync failed", description: error.message, variant: "destructive" });
    },
  });

  const trackEventMutation = useMutation({
    mutationFn: async ({ userId, eventName }: { userId: string; eventName: string }) => {
      return apiRequest("POST", `/api/admin/customerio/track-event/${userId}`, { eventName });
    },
    onSuccess: () => {
      toast({ title: "Event tracked" });
      setEventUserId("");
      setEventName("");
    },
    onError: (error: Error) => {
      toast({ title: "Track failed", description: error.message, variant: "destructive" });
    },
  });

  const pauseCampaignMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      return apiRequest("POST", `/api/admin/customerio/campaigns/${campaignId}/pause`);
    },
    onSuccess: () => {
      toast({ title: "Campaign paused" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/customerio/campaigns"] });
    },
    onError: (error: Error) => {
      toast({ title: "Pause failed", description: error.message, variant: "destructive" });
    },
  });

  const resumeCampaignMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      return apiRequest("POST", `/api/admin/customerio/campaigns/${campaignId}/resume`);
    },
    onSuccess: () => {
      toast({ title: "Campaign resumed" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/customerio/campaigns"] });
    },
    onError: (error: Error) => {
      toast({ title: "Resume failed", description: error.message, variant: "destructive" });
    },
  });

  if (statusLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
        <p className="text-sm text-muted-foreground mt-3">Loading Customer.io status...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="page-admin-customerio">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-violet-500" />
            Customer.io
          </h1>
          <p className="text-muted-foreground mt-1">Manage messaging campaigns and user sync</p>
        </div>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-violet-500" />
            <CardTitle>Connection Status</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className={cn(
              "flex items-center gap-3 p-4 rounded-xl border",
              status?.trackingApiConfigured ? "bg-emerald-500/5 border-emerald-500/20" : "bg-red-500/5 border-red-500/20"
            )}>
              {status?.trackingApiConfigured ? (
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-emerald-500" />
                </div>
              ) : (
                <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                  <XCircle className="h-5 w-5 text-red-500" />
                </div>
              )}
              <div>
                <p className="font-medium">Tracking API</p>
                <p className="text-sm text-muted-foreground">
                  {status?.trackingApiConfigured ? "Connected" : "Not configured"}
                </p>
              </div>
            </div>
            <div className={cn(
              "flex items-center gap-3 p-4 rounded-xl border",
              status?.appApiConfigured ? "bg-emerald-500/5 border-emerald-500/20" : "bg-red-500/5 border-red-500/20"
            )}>
              {status?.appApiConfigured ? (
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-emerald-500" />
                </div>
              ) : (
                <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                  <XCircle className="h-5 w-5 text-red-500" />
                </div>
              )}
              <div>
                <p className="font-medium">App API (Campaigns)</p>
                <p className="text-sm text-muted-foreground">
                  {status?.appApiConfigured ? "Connected" : "Not configured"}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList className="bg-muted/30 p-1 rounded-xl">
          <TabsTrigger value="users" data-testid="tab-users" className="rounded-lg gap-2">
            <Users className="h-4 w-4" />
            User Operations
          </TabsTrigger>
          <TabsTrigger value="campaigns" data-testid="tab-campaigns" className="rounded-lg gap-2">
            <Send className="h-4 w-4" />
            Campaigns
          </TabsTrigger>
          <TabsTrigger value="metrics" data-testid="tab-metrics" className="rounded-lg gap-2">
            <BarChart3 className="h-4 w-4" />
            Delivery Metrics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-violet-500" />
                <CardTitle>Sync User</CardTitle>
              </div>
              <CardDescription>Push user data to Customer.io</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="sync-user-id">User ID</Label>
                  <Input 
                    id="sync-user-id"
                    value={syncUserId}
                    onChange={(e) => setSyncUserId(e.target.value)}
                    placeholder="Enter user ID"
                    data-testid="input-sync-user-id"
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="flex items-end">
                  <Button 
                    onClick={() => syncUserMutation.mutate(syncUserId)}
                    disabled={!syncUserId || syncUserMutation.isPending}
                    data-testid="button-sync-user"
                    className="h-11 px-6 rounded-xl gap-2"
                  >
                    {syncUserMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Sync
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-violet-500" />
                <CardTitle>Track Event</CardTitle>
              </div>
              <CardDescription>Send a custom event for a user</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="event-user-id">User ID</Label>
                  <Input 
                    id="event-user-id"
                    value={eventUserId}
                    onChange={(e) => setEventUserId(e.target.value)}
                    placeholder="Enter user ID"
                    data-testid="input-event-user-id"
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="event-name">Event Name</Label>
                  <Input 
                    id="event-name"
                    value={eventName}
                    onChange={(e) => setEventName(e.target.value)}
                    placeholder="e.g., manual_nudge"
                    data-testid="input-event-name"
                    className="h-11 rounded-xl"
                  />
                </div>
              </div>
              <Button 
                onClick={() => trackEventMutation.mutate({ userId: eventUserId, eventName })}
                disabled={!eventUserId || !eventName || trackEventMutation.isPending}
                data-testid="button-track-event"
                className="h-11 px-6 rounded-xl gap-2"
              >
                {trackEventMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Track Event
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-4">
          {!status?.appApiConfigured ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="py-12 text-center">
                <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center mx-auto mb-3">
                  <Mail className="h-6 w-6 text-amber-500" />
                </div>
                <p className="text-muted-foreground">
                  App API not configured. Add CUSTOMERIO_APP_API_KEY to enable campaign management.
                </p>
              </CardContent>
            </Card>
          ) : campaignsLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
              <p className="text-sm text-muted-foreground mt-3">Loading campaigns...</p>
            </div>
          ) : (
            <div className="space-y-3">
              {campaignsData?.campaigns?.map((campaign) => (
                <Card key={campaign.id} className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "h-10 w-10 rounded-xl flex items-center justify-center",
                          campaign.active ? "bg-emerald-500/10" : "bg-slate-500/10"
                        )}>
                          <Mail className={cn(
                            "h-5 w-5",
                            campaign.active ? "text-emerald-500" : "text-slate-500"
                          )} />
                        </div>
                        <div>
                          <p className="font-medium">{campaign.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Type: {campaign.type} | ID: {campaign.id}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge 
                          variant="outline"
                          className={cn(
                            campaign.active 
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" 
                              : "bg-slate-500/10 text-slate-600 border-slate-500/20"
                          )}
                        >
                          {campaign.active ? "Active" : "Paused"}
                        </Badge>
                        {campaign.active ? (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => pauseCampaignMutation.mutate(campaign.id)}
                            disabled={pauseCampaignMutation.isPending}
                            data-testid={`button-pause-${campaign.id}`}
                            className="gap-1 rounded-lg"
                          >
                            <Pause className="h-4 w-4" />
                            Pause
                          </Button>
                        ) : (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => resumeCampaignMutation.mutate(campaign.id)}
                            disabled={resumeCampaignMutation.isPending}
                            data-testid={`button-resume-${campaign.id}`}
                            className="gap-1 rounded-lg"
                          >
                            <Play className="h-4 w-4" />
                            Resume
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {(!campaignsData?.campaigns || campaignsData.campaigns.length === 0) && (
                <Card className="border-0 shadow-sm">
                  <CardContent className="py-12 text-center">
                    <div className="h-12 w-12 rounded-xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                      <Mail className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground">No campaigns found</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="metrics">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-violet-500" />
                <CardTitle>Delivery Metrics (Last 7 Days)</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {metricsData?.actions && metricsData.actions.length > 0 ? (
                <div className="space-y-3">
                  {metricsData.actions.map((action) => (
                    <div 
                      key={action.actionKey} 
                      className="flex items-center justify-between p-4 rounded-xl bg-muted/30"
                    >
                      <span className="font-mono text-sm bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg">
                        {action.actionKey}
                      </span>
                      <Badge variant="secondary" className="text-sm">
                        {action.count} events
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="h-12 w-12 rounded-xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                    <BarChart3 className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground">No Customer.io actions recorded</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
