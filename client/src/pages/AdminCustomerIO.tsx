import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  ArrowLeft
} from "lucide-react";
import { Link } from "wouter";
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
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-4">
            <Link href="/admin/cockpit">
              <Button variant="ghost" size="sm" className="text-white hover:bg-white/10" data-testid="button-back">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Mail className="h-6 w-6" />
                Customer.io Management
              </h1>
              <p className="text-purple-100 text-sm mt-1">Manage messaging campaigns and user sync</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Connection Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                {status?.trackingApiConfigured ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                <span>Tracking API</span>
              </div>
              <div className="flex items-center gap-2">
                {status?.appApiConfigured ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                <span>App API (Campaigns)</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="users">
          <TabsList>
            <TabsTrigger value="users" data-testid="tab-users">
              <Users className="h-4 w-4 mr-2" />
              User Operations
            </TabsTrigger>
            <TabsTrigger value="campaigns" data-testid="tab-campaigns">
              <Send className="h-4 w-4 mr-2" />
              Campaigns
            </TabsTrigger>
            <TabsTrigger value="metrics" data-testid="tab-metrics">
              <BarChart3 className="h-4 w-4 mr-2" />
              Delivery Metrics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Sync User</CardTitle>
                <CardDescription>Push user data to Customer.io</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Label htmlFor="sync-user-id">User ID</Label>
                    <Input 
                      id="sync-user-id"
                      value={syncUserId}
                      onChange={(e) => setSyncUserId(e.target.value)}
                      placeholder="Enter user ID"
                      data-testid="input-sync-user-id"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button 
                      onClick={() => syncUserMutation.mutate(syncUserId)}
                      disabled={!syncUserId || syncUserMutation.isPending}
                      data-testid="button-sync-user"
                    >
                      {syncUserMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                      Sync
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Track Event</CardTitle>
                <CardDescription>Send a custom event for a user</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="event-user-id">User ID</Label>
                    <Input 
                      id="event-user-id"
                      value={eventUserId}
                      onChange={(e) => setEventUserId(e.target.value)}
                      placeholder="Enter user ID"
                      data-testid="input-event-user-id"
                    />
                  </div>
                  <div>
                    <Label htmlFor="event-name">Event Name</Label>
                    <Input 
                      id="event-name"
                      value={eventName}
                      onChange={(e) => setEventName(e.target.value)}
                      placeholder="e.g., manual_nudge"
                      data-testid="input-event-name"
                    />
                  </div>
                </div>
                <Button 
                  className="mt-4"
                  onClick={() => trackEventMutation.mutate({ userId: eventUserId, eventName })}
                  disabled={!eventUserId || !eventName || trackEventMutation.isPending}
                  data-testid="button-track-event"
                >
                  {trackEventMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                  Track Event
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="campaigns" className="space-y-4">
            {!status?.appApiConfigured ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  App API not configured. Add CUSTOMERIO_APP_API_KEY to enable campaign management.
                </CardContent>
              </Card>
            ) : campaignsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <div className="space-y-3">
                {campaignsData?.campaigns?.map((campaign) => (
                  <Card key={campaign.id}>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{campaign.name}</div>
                          <div className="text-sm text-muted-foreground">
                            Type: {campaign.type} | ID: {campaign.id}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={campaign.active ? "default" : "secondary"}>
                            {campaign.active ? "Active" : "Paused"}
                          </Badge>
                          {campaign.active ? (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => pauseCampaignMutation.mutate(campaign.id)}
                              disabled={pauseCampaignMutation.isPending}
                              data-testid={`button-pause-${campaign.id}`}
                            >
                              <Pause className="h-4 w-4 mr-1" />
                              Pause
                            </Button>
                          ) : (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => resumeCampaignMutation.mutate(campaign.id)}
                              disabled={resumeCampaignMutation.isPending}
                              data-testid={`button-resume-${campaign.id}`}
                            >
                              <Play className="h-4 w-4 mr-1" />
                              Resume
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {(!campaignsData?.campaigns || campaignsData.campaigns.length === 0) && (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      No campaigns found
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="metrics">
            <Card>
              <CardHeader>
                <CardTitle>Delivery Metrics (Last 7 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                {metricsData?.actions && metricsData.actions.length > 0 ? (
                  <div className="space-y-2">
                    {metricsData.actions.map((action) => (
                      <div key={action.actionKey} className="flex justify-between items-center py-2 border-b last:border-0">
                        <span className="font-mono text-sm">{action.actionKey}</span>
                        <Badge variant="secondary">{action.count}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-4">No Customer.io actions recorded</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
