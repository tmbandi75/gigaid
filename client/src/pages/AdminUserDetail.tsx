import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { 
  ArrowLeft,
  User,
  Activity,
  MessageSquare,
  CreditCard,
  Shield,
  Clock,
  Flag,
  AlertTriangle,
  ExternalLink,
  Loader2,
  RefreshCw,
  Bell,
  BellOff,
  FileText,
  Send,
  CheckCircle,
  XCircle
} from "lucide-react";
import { Link } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface UserProfile {
  id: string;
  email: string | null;
  username: string;
  name: string | null;
  phone: string | null;
  isPro: boolean;
  proExpiresAt: string | null;
  onboardingCompleted: boolean;
  onboardingStep: number;
  lastActiveAt: string | null;
  createdAt: string | null;
  publicProfileSlug: string | null;
  isFlagged: boolean;
  flagReason: string | null;
  isMessagingSuppressed: boolean;
  messagingSuppressedUntil: string | null;
}

interface FunnelState {
  onboardingCompleted: boolean;
  onboardingStep: number;
  hasBookingLink: boolean;
  leadsReceived: number;
  leadsConverted: number;
  estimatesSent: number;
  estimatesConfirmed: number;
  firstBookingAt: string | null;
  totalJobs: number;
  completedJobs: number;
  totalInvoices: number;
  paidInvoices: number;
}

interface UserNote {
  id: string;
  createdAt: string;
  note: string;
  actorUserId: string;
}

interface UserDetailResponse {
  profile: UserProfile;
  funnelState: FunnelState;
  notes: UserNote[];
  context: {
    from: string;
    metric?: string;
    alert?: string;
  } | null;
}

interface TimelineEvent {
  id: string;
  eventName: string;
  occurredAt: string;
  source: string;
  context: Record<string, any> | null;
}

interface AuditAction {
  id: string;
  createdAt: string;
  actorUserId: string;
  actorEmail: string | null;
  actionKey: string;
  reason: string;
  payload: Record<string, any> | null;
}

function ContextBanner({ context }: { context: UserDetailResponse["context"] }) {
  if (!context) return null;

  return (
    <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-900 rounded-lg p-3 mb-4">
      <div className="flex items-center gap-2 text-sm">
        <Activity className="h-4 w-4 text-blue-600" />
        <span className="text-blue-800 dark:text-blue-200">
          Navigated from Cockpit
          {context.metric && ` - ${context.metric.replace(/_/g, " ")}`}
          {context.alert && ` - Alert: ${context.alert.replace(/_/g, " ")}`}
        </span>
      </div>
    </div>
  );
}

function ProfileSection({ profile }: { profile: UserProfile }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile
          </CardTitle>
          <div className="flex gap-2">
            {profile.isPro && <Badge>Pro</Badge>}
            {profile.isFlagged && (
              <Badge variant="destructive">
                <Flag className="h-3 w-3 mr-1" />
                Flagged
              </Badge>
            )}
            {profile.isMessagingSuppressed && (
              <Badge variant="secondary">
                <BellOff className="h-3 w-3 mr-1" />
                Suppressed
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-muted-foreground text-xs">Name</Label>
            <p className="font-medium">{profile.name || profile.username || "N/A"}</p>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">Email</Label>
            <p className="font-medium">{profile.email || "N/A"}</p>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">Phone</Label>
            <p className="font-medium">{profile.phone || "N/A"}</p>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">User ID</Label>
            <p className="font-mono text-sm">{profile.id}</p>
          </div>
        </div>
        <Separator />
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <Label className="text-muted-foreground text-xs">Created</Label>
            <p>{profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : "N/A"}</p>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">Last Active</Label>
            <p>{profile.lastActiveAt ? new Date(profile.lastActiveAt).toLocaleDateString() : "Never"}</p>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">Onboarding</Label>
            <p>{profile.onboardingCompleted ? "Completed" : `Step ${profile.onboardingStep}`}</p>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">Pro Expires</Label>
            <p>{profile.proExpiresAt ? new Date(profile.proExpiresAt).toLocaleDateString() : "N/A"}</p>
          </div>
        </div>
        {profile.isFlagged && profile.flagReason && (
          <>
            <Separator />
            <div className="bg-destructive/10 rounded-lg p-3">
              <Label className="text-destructive text-xs">Flag Reason</Label>
              <p className="text-sm">{profile.flagReason}</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function FunnelSection({ funnel }: { funnel: FunnelState }) {
  const steps = [
    { label: "Onboarding", done: funnel.onboardingCompleted, value: funnel.onboardingStep },
    { label: "Booking Link", done: funnel.hasBookingLink },
    { label: "Leads Received", done: funnel.leadsReceived > 0, value: funnel.leadsReceived },
    { label: "First Booking", done: !!funnel.firstBookingAt },
    { label: "Jobs Completed", done: funnel.completedJobs > 0, value: `${funnel.completedJobs}/${funnel.totalJobs}` },
    { label: "Invoices Paid", done: funnel.paidInvoices > 0, value: `${funnel.paidInvoices}/${funnel.totalInvoices}` },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4" />
          Funnel State
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {steps.map((step, i) => (
            <div key={i} className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                {step.done ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-muted-foreground" />
                )}
                <span className={step.done ? "font-medium" : "text-muted-foreground"}>
                  {step.label}
                </span>
              </div>
              {step.value !== undefined && (
                <span className="text-sm text-muted-foreground">{step.value}</span>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function TimelineSection({ userId }: { userId: string }) {
  const { data, isLoading } = useQuery<{ events: TimelineEvent[] }>({
    queryKey: ["/api/admin/users", userId, "timeline"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/users/${userId}/timeline`);
      if (!res.ok) throw new Error("Failed to fetch timeline");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4" />
          Activity Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data?.events && data.events.length > 0 ? (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {data.events.map((event) => (
              <div key={event.id} className="flex gap-3 text-sm">
                <div className="w-20 text-muted-foreground text-xs">
                  {new Date(event.occurredAt).toLocaleDateString()}
                </div>
                <div className="flex-1">
                  <span className="font-medium">{event.eventName.replace(/_/g, " ")}</span>
                  <span className="text-muted-foreground ml-2">via {event.source}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-4">No events recorded</p>
        )}
      </CardContent>
    </Card>
  );
}

function NotesSection({ notes, userId }: { notes: UserNote[]; userId: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4" />
          Admin Notes ({notes.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {notes.length > 0 ? (
          <div className="space-y-3 max-h-48 overflow-y-auto">
            {notes.map((note) => (
              <div key={note.id} className="bg-muted/50 rounded-lg p-3 text-sm">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>{note.actorUserId}</span>
                  <span>{new Date(note.createdAt).toLocaleDateString()}</span>
                </div>
                <p>{note.note}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-4">No notes yet</p>
        )}
      </CardContent>
    </Card>
  );
}

function AuditSection({ userId }: { userId: string }) {
  const { data, isLoading } = useQuery<{ actions: AuditAction[] }>({
    queryKey: ["/api/admin/users", userId, "audit"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/users/${userId}/audit`);
      if (!res.ok) throw new Error("Failed to fetch audit");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="h-4 w-4" />
          Admin Audit Log
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data?.actions && data.actions.length > 0 ? (
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {data.actions.map((action) => (
              <div key={action.id} className="border rounded-lg p-3 text-sm">
                <div className="flex justify-between mb-1">
                  <span className="font-medium">{action.actionKey.replace(/_/g, " ")}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(action.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-muted-foreground">{action.reason}</p>
                <p className="text-xs text-muted-foreground mt-1">by {action.actorUserId}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-4">No admin actions recorded</p>
        )}
      </CardContent>
    </Card>
  );
}

function ExternalLinksSection({ userId }: { userId: string }) {
  const { data } = useQuery<any>({
    queryKey: ["/api/admin/users/links/external"],
  });

  const links = [
    { 
      label: "Amplitude", 
      url: data?.amplitude?.userUrlTemplate?.replace("{{USER_ID}}", userId) || "#",
      icon: Activity 
    },
    { 
      label: "Customer.io", 
      url: data?.customerIo?.baseUrl || "#",
      icon: MessageSquare 
    },
    { 
      label: "OneSignal", 
      url: data?.oneSignal?.baseUrl || "#",
      icon: Bell 
    },
    { 
      label: "Stripe", 
      url: data?.stripe?.baseUrl || "#",
      icon: CreditCard 
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <ExternalLink className="h-4 w-4" />
          External Tools
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {links.map((link) => (
            <Button
              key={link.label}
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={() => window.open(link.url, "_blank")}
              data-testid={`button-link-${link.label.toLowerCase()}`}
            >
              <link.icon className="h-4 w-4 mr-2" />
              {link.label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface MessagingData {
  customerIo: { status: string; note: string };
  oneSignal: { pushEnabled: boolean; status: string; note: string };
  preferences: { notifyBySms: boolean; notifyByEmail: boolean };
  suppression: { active: boolean; until: string; reason: string } | null;
}

interface PaymentsData {
  subscription: { isPro: boolean; expiresAt: string | null };
  stripeConnect: { accountId: string | null; status: string };
  invoices: { total: number; paid: number };
  note: string;
}

function MessagingSection({ userId }: { userId: string }) {
  const { data, isLoading } = useQuery<MessagingData>({
    queryKey: ["/api/admin/users", userId, "messaging"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/users/${userId}/messaging`);
      if (!res.ok) throw new Error("Failed to fetch messaging");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquare className="h-4 w-4" />
          Messaging Status
        </CardTitle>
        <CardDescription>Read-only view of messaging configuration</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between items-center py-1">
          <span className="text-sm text-muted-foreground">Email Notifications</span>
          <Badge variant={data?.preferences?.notifyByEmail ? "default" : "secondary"}>
            {data?.preferences?.notifyByEmail ? "Enabled" : "Disabled"}
          </Badge>
        </div>
        <div className="flex justify-between items-center py-1">
          <span className="text-sm text-muted-foreground">SMS Notifications</span>
          <Badge variant={data?.preferences?.notifyBySms ? "default" : "secondary"}>
            {data?.preferences?.notifyBySms ? "Enabled" : "Disabled"}
          </Badge>
        </div>
        {data?.suppression && (
          <div className="bg-amber-50 dark:bg-amber-950 rounded-lg p-3 mt-2">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 text-sm font-medium">
              <BellOff className="h-4 w-4" />
              Messaging Suppressed
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Until: {new Date(data.suppression.until).toLocaleString()}
            </p>
            <p className="text-sm text-muted-foreground">
              Reason: {data.suppression.reason}
            </p>
          </div>
        )}
        <div className="text-xs text-muted-foreground pt-2">
          {data?.customerIo?.note} | {data?.oneSignal?.note}
        </div>
      </CardContent>
    </Card>
  );
}

function PaymentsSection({ userId }: { userId: string }) {
  const { data, isLoading } = useQuery<PaymentsData>({
    queryKey: ["/api/admin/users", userId, "payments"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/users/${userId}/payments`);
      if (!res.ok) throw new Error("Failed to fetch payments");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <CreditCard className="h-4 w-4" />
          Payments Summary
        </CardTitle>
        <CardDescription>Read-only view of payment status</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between items-center py-1">
          <span className="text-sm text-muted-foreground">Subscription</span>
          <Badge variant={data?.subscription?.isPro ? "default" : "secondary"}>
            {data?.subscription?.isPro ? "Pro" : "Free"}
          </Badge>
        </div>
        {data?.subscription?.expiresAt && (
          <div className="flex justify-between items-center py-1">
            <span className="text-sm text-muted-foreground">Pro Expires</span>
            <span className="text-sm">{new Date(data.subscription.expiresAt).toLocaleDateString()}</span>
          </div>
        )}
        <div className="flex justify-between items-center py-1">
          <span className="text-sm text-muted-foreground">Stripe Connect</span>
          <Badge variant={data?.stripeConnect?.status === "active" ? "default" : "secondary"}>
            {data?.stripeConnect?.status || "Not connected"}
          </Badge>
        </div>
        <div className="flex justify-between items-center py-1">
          <span className="text-sm text-muted-foreground">Invoices</span>
          <span className="text-sm font-medium">
            {data?.invoices?.paid || 0} / {data?.invoices?.total || 0} paid
          </span>
        </div>
        <div className="text-xs text-muted-foreground pt-2 border-t">
          {data?.note}
        </div>
      </CardContent>
    </Card>
  );
}

function ActionsSection({ userId, profile }: { userId: string; profile: UserProfile }) {
  const { toast } = useToast();
  const [actionDialog, setActionDialog] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [noteText, setNoteText] = useState("");
  const [pushMessage, setPushMessage] = useState("");
  const [suppressHours, setSuppressHours] = useState("24");

  const actionMutation = useMutation({
    mutationFn: async ({ action_key, payload }: { action_key: string; payload?: any }) => {
      const res = await apiRequest("POST", `/api/admin/users/${userId}/actions`, {
        action_key,
        reason: reason.trim(),
        payload,
      });
      return res;
    },
    onSuccess: () => {
      toast({ title: "Action completed and logged" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users", userId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users", userId, "audit"] });
      setActionDialog(null);
      setReason("");
      setNoteText("");
      setPushMessage("");
    },
    onError: (error: any) => {
      toast({ 
        title: "Action failed", 
        description: error.message || "Please try again",
        variant: "destructive" 
      });
    },
  });

  const handleAction = (action_key: string, payload?: any) => {
    if (!reason.trim()) {
      toast({ title: "Reason is required", variant: "destructive" });
      return;
    }
    actionMutation.mutate({ action_key, payload });
  };

  return (
    <>
      <Card className="border-amber-200 dark:border-amber-900">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4" />
            Admin Actions
          </CardTitle>
          <CardDescription>
            All actions are logged with your identity and reason
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={() => setActionDialog("flag")}
            disabled={profile.isFlagged}
            data-testid="button-action-flag"
          >
            <Flag className="h-4 w-4 mr-2" />
            Flag User
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={() => setActionDialog("note")}
            data-testid="button-action-note"
          >
            <FileText className="h-4 w-4 mr-2" />
            Add Note
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={() => setActionDialog("suppress")}
            disabled={profile.isMessagingSuppressed}
            data-testid="button-action-suppress"
          >
            <BellOff className="h-4 w-4 mr-2" />
            Suppress Messaging
          </Button>

          {profile.isMessagingSuppressed && (
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={() => setActionDialog("unsuppress")}
              data-testid="button-action-unsuppress"
            >
              <Bell className="h-4 w-4 mr-2" />
              Unsuppress Messaging
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={() => setActionDialog("push")}
            data-testid="button-action-push"
          >
            <Send className="h-4 w-4 mr-2" />
            Send One-Off Push
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={() => setActionDialog("reset_onboarding")}
            data-testid="button-action-reset"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset Onboarding
          </Button>
        </CardContent>
      </Card>

      <Dialog open={!!actionDialog} onOpenChange={(open) => !open && setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog === "flag" && "Flag User"}
              {actionDialog === "note" && "Add Admin Note"}
              {actionDialog === "suppress" && "Suppress Messaging"}
              {actionDialog === "unsuppress" && "Unsuppress Messaging"}
              {actionDialog === "push" && "Send One-Off Push"}
              {actionDialog === "reset_onboarding" && "Reset Onboarding"}
            </DialogTitle>
            <DialogDescription>
              This action will be logged with your identity and the reason you provide.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {actionDialog === "note" && (
              <div className="space-y-2">
                <Label>Note</Label>
                <Textarea
                  placeholder="Enter your note..."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  data-testid="input-note"
                />
              </div>
            )}

            {actionDialog === "suppress" && (
              <div className="space-y-2">
                <Label>Duration (hours)</Label>
                <Input
                  type="number"
                  value={suppressHours}
                  onChange={(e) => setSuppressHours(e.target.value)}
                  data-testid="input-suppress-hours"
                />
              </div>
            )}

            {actionDialog === "push" && (
              <div className="space-y-2">
                <Label>Push Message</Label>
                <Textarea
                  placeholder="Enter push notification message..."
                  value={pushMessage}
                  onChange={(e) => setPushMessage(e.target.value)}
                  data-testid="input-push-message"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Reason (required)</Label>
              <Textarea
                placeholder="Why are you taking this action?"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                data-testid="input-reason"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                let payload: any = undefined;
                if (actionDialog === "note") payload = { note: noteText };
                if (actionDialog === "suppress") payload = { duration_hours: parseInt(suppressHours) };
                if (actionDialog === "push") payload = { message: pushMessage };

                const actionKeyMap: Record<string, string> = {
                  flag: "user_flagged",
                  note: "add_note",
                  suppress: "suppress_messaging",
                  unsuppress: "unsuppress_messaging",
                  push: "send_one_off_push",
                  reset_onboarding: "reset_onboarding_state",
                };

                handleAction(actionKeyMap[actionDialog!], payload);
              }}
              disabled={!reason.trim() || actionMutation.isPending}
              data-testid="button-confirm-action"
            >
              {actionMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Confirm Action
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function AdminUserDetail() {
  const [, params] = useRoute("/admin/users/:userId");
  const userId = params?.userId;
  const [location] = useLocation();
  
  const searchParams = new URLSearchParams(location.split("?")[1] || "");
  const from = searchParams.get("from");
  const view = searchParams.get("view");

  const { data, isLoading, error } = useQuery<UserDetailResponse>({
    queryKey: ["/api/admin/users", userId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (view) params.set("metric", view);
      const res = await fetch(`/api/admin/users/${userId}?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch user");
      return res.json();
    },
    enabled: !!userId,
  });

  if (!userId) {
    return <div>User ID required</div>;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <AlertTriangle className="h-12 w-12 text-muted-foreground" />
        <h1 className="text-xl font-semibold">User Not Found</h1>
        <Link href="/admin/users">
          <Button variant="outline">Back to Users</Button>
        </Link>
      </div>
    );
  }

  const backUrl = from === "cockpit" 
    ? "/admin/cockpit" 
    : view 
      ? `/admin/users?view=${view}` 
      : "/admin/users";

  return (
    <div className="min-h-screen bg-background pb-8" data-testid="page-admin-user-detail">
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white px-4 py-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4">
            <Link href={backUrl}>
              <Button variant="ghost" size="sm" className="text-white hover:text-white/80" data-testid="button-back">
                <ArrowLeft className="h-4 w-4 mr-2" />
                {from === "cockpit" ? "Back to Cockpit" : "Back to Users"}
              </Button>
            </Link>
          </div>
          <div className="mt-4">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <User className="h-6 w-6" />
              User Detail
            </h1>
            <p className="text-slate-300 text-sm mt-1 font-mono">{userId}</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-4 space-y-4">
        <ContextBanner context={data.context} />
        
        <ProfileSection profile={data.profile} />

        <div className="grid md:grid-cols-2 gap-4">
          <FunnelSection funnel={data.funnelState} />
          <NotesSection notes={data.notes} userId={userId} />
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <MessagingSection userId={userId} />
          <PaymentsSection userId={userId} />
        </div>

        <Tabs defaultValue="timeline">
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="audit">Audit Log</TabsTrigger>
            <TabsTrigger value="links">External Links</TabsTrigger>
            <TabsTrigger value="actions">Actions</TabsTrigger>
          </TabsList>
          <TabsContent value="timeline" className="mt-4">
            <TimelineSection userId={userId} />
          </TabsContent>
          <TabsContent value="audit" className="mt-4">
            <AuditSection userId={userId} />
          </TabsContent>
          <TabsContent value="links" className="mt-4">
            <ExternalLinksSection userId={userId} />
          </TabsContent>
          <TabsContent value="actions" className="mt-4">
            <ActionsSection userId={userId} profile={data.profile} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
