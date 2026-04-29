import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PLAN_NAMES, Plan } from "@shared/plans";
import { PLAN_ORDER, type Plan as PlanTier } from "@shared/capabilities/plans";
import { safePriceCentsExact } from "@shared/safePrice";
import { getAuthToken } from "@/lib/authToken";
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
  XCircle,
  Sparkles,
  Gauge
} from "lucide-react";
import { Link } from "wouter";
import { apiFetch } from "@/lib/apiFetch";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { useApiMutation } from "@/hooks/useApiMutation";
import { useToast } from "@/hooks/use-toast";

interface UserProfile {
  id: string;
  email: string | null;
  username: string;
  name: string | null;
  phone: string | null;
  isPro: boolean;
  plan: string | null;
  proExpiresAt: string | null;
  onboardingCompleted: boolean;
  onboardingStep: number;
  lastActiveAt: string | null;
  createdAt: string | null;
  publicProfileSlug: string;
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
    queryKey: QUERY_KEYS.adminUserTimeline(userId),
    queryFn: async () => {
      const token = getAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`/api/admin/users/${userId}/timeline`, {
        credentials: "include",
        headers,
      });
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
    queryKey: QUERY_KEYS.adminUserAudit(userId),
    queryFn: async () => {
      const token = getAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`/api/admin/users/${userId}/audit`, {
        credentials: "include",
        headers,
      });
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

interface OutboundMessageRow {
  id: string;
  channel: string;
  type: string;
  status: string;
  toAddress: string;
  scheduledFor: string | null;
  sentAt: string | null;
  canceledAt: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string | null;
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "sent":
      return "default";
    case "canceled":
      return "secondary";
    case "failed":
      return "destructive";
    default:
      return "outline";
  }
}

function OutboundMessagesSection({ userId }: { userId: string }) {
  const { data, isLoading } = useQuery<{ messages: OutboundMessageRow[] }>({
    queryKey: QUERY_KEYS.adminUserOutboundMessages(userId),
    queryFn: async () => {
      const token = getAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(
        `/api/admin/users/${userId}/outbound-messages?limit=50`,
        { credentials: "include", headers },
      );
      if (!res.ok) throw new Error("Failed to fetch outbound messages");
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

  const messages = data?.messages || [];

  return (
    <Card data-testid="card-outbound-messages">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Send className="h-4 w-4" />
          Outbound Messages ({messages.length})
        </CardTitle>
        <CardDescription>
          Last 50 outbound messages with status and any structured failure reason.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {messages.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">
            No outbound messages recorded.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3">When</th>
                  <th className="py-2 pr-3">Channel</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Failure reason</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((m) => {
                  const ts = m.sentAt || m.canceledAt || m.updatedAt || m.createdAt;
                  return (
                    <tr
                      key={m.id}
                      className="border-t align-top"
                      data-testid={`row-outbound-message-${m.id}`}
                    >
                      <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">
                        {ts ? new Date(ts).toLocaleString() : "—"}
                      </td>
                      <td className="py-2 pr-3">{m.channel}</td>
                      <td className="py-2 pr-3">{m.type}</td>
                      <td className="py-2 pr-3">
                        <Badge
                          variant={statusVariant(m.status)}
                          data-testid={`badge-outbound-status-${m.id}`}
                        >
                          {m.status}
                        </Badge>
                      </td>
                      <td
                        className="py-2 pr-3 text-muted-foreground"
                        data-testid={`text-outbound-reason-${m.id}`}
                      >
                        {m.failureReason || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface SmsOptOutEventRow {
  id: string;
  fromPhoneMasked: string;
  body: string | null;
  twilioSid: string | null;
  resolution: string;
  createdAt: string;
  // "matched"        = resolver attached this row to this user
  // "phone_candidate" = userId is null but the From phone equals this user's
  //                    stored E.164, so it's likely (but not confirmed) theirs
  matchKind: "matched" | "phone_candidate";
}

interface AttachTarget {
  eventId: string;
  fromPhoneMasked: string;
  resolution: string;
}

function SmsOptOutEventsSection({ userId }: { userId: string }) {
  const { data, isLoading } = useQuery<{ events: SmsOptOutEventRow[] }>({
    queryKey: QUERY_KEYS.adminUserSmsOptOutEvents(userId),
    queryFn: async () => {
      const token = getAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(
        `/api/admin/users/${userId}/sms-opt-out-events?limit=20`,
        { credentials: "include", headers },
      );
      if (!res.ok) throw new Error("Failed to fetch SMS opt-out events");
      return res.json();
    },
  });

  const { data: externalLinks } = useQuery<any>({
    queryKey: QUERY_KEYS.adminExternalLinks(),
  });
  const twilioMessageUrlTemplate: string | undefined =
    externalLinks?.twilio?.messageUrlTemplate;

  const { toast } = useToast();
  const [attachTarget, setAttachTarget] = useState<AttachTarget | null>(null);
  const [attachReason, setAttachReason] = useState("");

  // Mirrors the AdminSmsHealth "Clear phone" mutation: posts a written
  // reason, refreshes the panel + the messaging-suppression view (since
  // attaching also opts the user out), and surfaces toasts on either
  // outcome so the admin can see whether suppression was already active.
  const attachMutation = useApiMutation<
    { success: true; alreadySuppressed: boolean },
    { eventId: string; reason: string }
  >(
    async ({ eventId, reason }) =>
      apiFetch(
        `/api/admin/users/${userId}/sms-opt-out-events/${eventId}/attach`,
        {
          method: "POST",
          body: JSON.stringify({ reason }),
        },
      ),
    [
      QUERY_KEYS.adminUserSmsOptOutEvents(userId),
      QUERY_KEYS.adminUserMessaging(userId),
      QUERY_KEYS.adminUserAudit(userId),
    ],
    {
      onSuccess: (result) => {
        toast({
          title: "STOP attached to this user",
          description: result?.alreadySuppressed
            ? "Suppression was already active; STOP event reattached."
            : "User opted out of further SMS.",
        });
        setAttachTarget(null);
        setAttachReason("");
      },
      onError: (error) => {
        toast({
          title: "Could not attach STOP event",
          description: error.message || "Please try again",
          variant: "destructive",
        });
      },
    },
  );

  const events = data?.events || [];

  return (
    <Card data-testid="card-sms-opt-out-events">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <BellOff className="h-4 w-4" />
          STOP Audit History ({events.length})
        </CardTitle>
        <CardDescription>
          Inbound STOP webhooks matched to this user, plus any unmatched or
          ambiguous STOPs that arrived from this user's phone number (most
          recent first).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : events.length === 0 ? (
          <p
            className="text-muted-foreground text-center py-4"
            data-testid="text-sms-opt-out-events-empty"
          >
            No STOP events for this user.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3">When</th>
                  <th className="py-2 pr-3">From</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Body</th>
                  <th className="py-2 pr-3">Twilio SID</th>
                  <th className="py-2 pr-3 sr-only">Actions</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => {
                  const isCandidate = e.matchKind === "phone_candidate";
                  return (
                  <tr
                    key={e.id}
                    className={`border-t align-top ${isCandidate ? "bg-muted/40" : ""}`}
                    data-testid={`row-sms-opt-out-event-${e.id}`}
                  >
                    <td
                      className="py-2 pr-3 whitespace-nowrap text-muted-foreground"
                      data-testid={`text-sms-opt-out-when-${e.id}`}
                    >
                      {new Date(e.createdAt).toLocaleString()}
                    </td>
                    <td
                      className="py-2 pr-3 font-mono text-xs"
                      data-testid={`text-sms-opt-out-from-${e.id}`}
                    >
                      {e.fromPhoneMasked}
                    </td>
                    <td
                      className="py-2 pr-3"
                      data-testid={`badge-sms-opt-out-status-${e.id}`}
                    >
                      {isCandidate ? (
                        <Badge
                          variant="outline"
                          title="Resolver did not attach this STOP to this user, but it came from their phone number."
                        >
                          {e.resolution === "ambiguous"
                            ? "Ambiguous (same phone)"
                            : "Unmatched (same phone)"}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Matched</Badge>
                      )}
                    </td>
                    <td
                      className="py-2 pr-3 text-muted-foreground"
                      data-testid={`text-sms-opt-out-body-${e.id}`}
                    >
                      {e.body || "—"}
                    </td>
                    <td
                      className="py-2 pr-3 font-mono text-xs text-muted-foreground"
                      data-testid={`text-sms-opt-out-sid-${e.id}`}
                    >
                      {e.twilioSid ? (
                        twilioMessageUrlTemplate ? (
                          <a
                            href={twilioMessageUrlTemplate.replace(
                              "{{TWILIO_SID}}",
                              encodeURIComponent(e.twilioSid),
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                            data-testid={`link-sms-opt-out-sid-${e.id}`}
                          >
                            {e.twilioSid}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          e.twilioSid
                        )
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap text-right">
                      {isCandidate ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setAttachTarget({
                              eventId: e.id,
                              fromPhoneMasked: e.fromPhoneMasked,
                              resolution: e.resolution,
                            });
                            setAttachReason("");
                          }}
                          data-testid={`button-attach-sms-opt-out-${e.id}`}
                        >
                          Attach to this user
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
      <Dialog
        open={attachTarget !== null}
        onOpenChange={(open) => {
          if (!open && !attachMutation.isPending) {
            setAttachTarget(null);
            setAttachReason("");
          }
        }}
      >
        <DialogContent data-testid="dialog-attach-sms-opt-out">
          <DialogHeader>
            <DialogTitle>Attach STOP event to this user</DialogTitle>
            <DialogDescription>
              This will attach the{" "}
              {attachTarget?.resolution === "ambiguous"
                ? "ambiguous"
                : "unmatched"}{" "}
              STOP event from{" "}
              <span className="font-mono">
                {attachTarget?.fromPhoneMasked}
              </span>{" "}
              to this user, mark it as matched, and (if not already) opt them
              out of further SMS. The action is logged in the admin audit
              trail.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="attach-sms-opt-out-reason">
              Reason (required)
            </Label>
            <Textarea
              id="attach-sms-opt-out-reason"
              value={attachReason}
              onChange={(e) => setAttachReason(e.target.value)}
              placeholder="e.g. User confirmed via support chat that this STOP came from them."
              rows={3}
              data-testid="input-attach-sms-opt-out-reason"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAttachTarget(null);
                setAttachReason("");
              }}
              disabled={attachMutation.isPending}
              data-testid="button-cancel-attach-sms-opt-out"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!attachTarget || !attachReason.trim()) return;
                attachMutation.mutate({
                  eventId: attachTarget.eventId,
                  reason: attachReason.trim(),
                });
              }}
              disabled={
                !attachReason.trim() || attachMutation.isPending
              }
              data-testid="button-confirm-attach-sms-opt-out"
            >
              {attachMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Attach to this user
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function ExternalLinksSection({ userId }: { userId: string }) {
  const { data } = useQuery<any>({
    queryKey: QUERY_KEYS.adminExternalLinks(),
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
  stripeCredit?: {
    hasCustomer: boolean;
    balanceCents: number | null;
    currency: string | null;
    error: string | null;
  };
  note: string;
}

function MessagingSection({ userId }: { userId: string }) {
  const { data, isLoading } = useQuery<MessagingData>({
    queryKey: QUERY_KEYS.adminUserMessaging(userId),
    queryFn: async () => {
      const token = getAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`/api/admin/users/${userId}/messaging`, {
        credentials: "include",
        headers,
      });
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

interface SmsRateLimitData {
  plan: string | null;
  override: number | null;
  planDefault: number | null;
  planUnlimited: boolean;
  effectiveCap: number | null;
  effectiveUnlimited: boolean;
}

function describeCap(value: number | null, unlimited: boolean): string {
  if (unlimited) return "Unlimited";
  if (value === null) return "—";
  return `${value} / 24h`;
}

function SmsRateLimitSection({ userId }: { userId: string }) {
  const { toast } = useToast();
  const { data, isLoading } = useQuery<SmsRateLimitData>({
    queryKey: QUERY_KEYS.adminUserSmsRateLimit(userId),
    queryFn: async () => {
      const token = getAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`/api/admin/users/${userId}/sms-rate-limit`, {
        credentials: "include",
        headers,
      });
      if (!res.ok) throw new Error("Failed to fetch SMS rate limit");
      return res.json();
    },
  });

  // The select picks between three modes: plan default (null on server),
  // unlimited (0), and a custom positive cap.
  const [mode, setMode] = useState<"default" | "unlimited" | "custom">("default");
  const [customValue, setCustomValue] = useState<string>("");
  const [reason, setReason] = useState("");

  // Sync local form state from the fetched override whenever the server-side
  // value changes (initial load, refetch after save, or navigating to a
  // different user). Keyed on `userId` + `data?.override` so switching between
  // two admin user-detail pages doesn't leak stale mode/custom values from
  // the previous user.
  useEffect(() => {
    if (!data) return;
    if (data.override === null) {
      setMode("default");
      setCustomValue("");
    } else if (data.override === 0) {
      setMode("unlimited");
      setCustomValue("");
    } else {
      setMode("custom");
      setCustomValue(String(data.override));
    }
    setReason("");
  }, [userId, data?.override]);

  const saveMutation = useApiMutation<
    SmsRateLimitData,
    { override: number | null; reason: string }
  >(
    async (vars) =>
      apiFetch(`/api/admin/users/${userId}/sms-rate-limit`, {
        method: "PUT",
        body: JSON.stringify(vars),
      }),
    [
      QUERY_KEYS.adminUserSmsRateLimit(userId),
      QUERY_KEYS.adminUserAudit(userId),
    ],
    {
      onSuccess: () => {
        toast({ title: "SMS daily cap updated" });
        setReason("");
      },
      onError: (error: any) => {
        toast({
          title: "Could not update SMS daily cap",
          description: error.message || "Please try again",
          variant: "destructive",
        });
      },
    },
  );

  const handleSave = () => {
    if (!reason.trim()) {
      toast({ title: "Reason is required", variant: "destructive" });
      return;
    }
    let override: number | null;
    if (mode === "default") {
      override = null;
    } else if (mode === "unlimited") {
      override = 0;
    } else {
      const parsed = Number(customValue);
      if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1) {
        toast({
          title: "Enter a positive whole number",
          description: "Use 0 / Unlimited above to remove the daily cap.",
          variant: "destructive",
        });
        return;
      }
      override = parsed;
    }
    saveMutation.mutate({ override, reason: reason.trim() });
  };

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
    <Card data-testid="card-sms-rate-limit">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Gauge className="h-4 w-4" />
          SMS Daily Cap
        </CardTitle>
        <CardDescription>
          Per-user override for the rolling 24h SMS limit. Blank = use plan
          default, 0 = unlimited. Takes effect on the next outbound SMS.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <Label className="text-muted-foreground text-xs">Plan default</Label>
            <p className="font-medium" data-testid="text-sms-rate-limit-plan-default">
              {describeCap(data?.planDefault ?? null, data?.planUnlimited ?? false)}
            </p>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">Effective cap now</Label>
            <p className="font-medium" data-testid="text-sms-rate-limit-effective">
              {describeCap(data?.effectiveCap ?? null, data?.effectiveUnlimited ?? false)}
            </p>
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <Label className="text-xs">Override</Label>
          <Select
            value={mode}
            onValueChange={(v) => setMode(v as "default" | "unlimited" | "custom")}
          >
            <SelectTrigger data-testid="select-sms-rate-limit-mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default" data-testid="option-sms-rate-limit-default">
                Use plan default
              </SelectItem>
              <SelectItem value="unlimited" data-testid="option-sms-rate-limit-unlimited">
                Unlimited (0)
              </SelectItem>
              <SelectItem value="custom" data-testid="option-sms-rate-limit-custom">
                Custom cap…
              </SelectItem>
            </SelectContent>
          </Select>

          {mode === "custom" && (
            <Input
              type="number"
              min={1}
              step={1}
              placeholder="e.g. 25"
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              data-testid="input-sms-rate-limit-custom"
            />
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Reason (required, audited)</Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why are you changing this customer's SMS cap?"
            rows={2}
            data-testid="input-sms-rate-limit-reason"
          />
        </div>

        <Button
          size="sm"
          onClick={handleSave}
          disabled={saveMutation.isPending}
          data-testid="button-save-sms-rate-limit"
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : null}
          Save override
        </Button>
      </CardContent>
    </Card>
  );
}

function PaymentsSection({ userId }: { userId: string }) {
  const { data, isLoading } = useQuery<PaymentsData>({
    queryKey: QUERY_KEYS.adminUserPayments(userId),
    queryFn: async () => {
      const token = getAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`/api/admin/users/${userId}/payments`, {
        credentials: "include",
        headers,
      });
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
        <div className="flex justify-between items-center py-1">
          <span className="text-sm text-muted-foreground">Stripe Credit Balance</span>
          {(() => {
            const credit = data?.stripeCredit;
            if (!credit || !credit.hasCustomer) {
              return (
                <span className="text-sm text-muted-foreground" data-testid="text-stripe-credit-none">
                  No Stripe customer
                </span>
              );
            }
            if (credit.error) {
              return (
                <span className="text-sm text-destructive" data-testid="text-stripe-credit-error">
                  Unavailable
                </span>
              );
            }
            const cents = credit.balanceCents ?? 0;
            const formatted = cents > 0 ? safePriceCentsExact(cents) : "$0.00";
            return (
              <span className="text-sm font-medium" data-testid="text-stripe-credit-balance">
                {formatted}
                {credit.currency && credit.currency !== "USD" ? (
                  <span className="ml-1 text-muted-foreground">{credit.currency}</span>
                ) : null}
              </span>
            );
          })()}
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

  const actionMutation = useApiMutation(
    async ({ action_key, payload }: { action_key: string; payload?: any }) =>
      apiFetch(`/api/admin/users/${userId}/actions`, {
        method: "POST",
        body: JSON.stringify({ action_key, reason: reason.trim(), payload }),
      }),
    [QUERY_KEYS.adminUser(userId), QUERY_KEYS.adminUserAudit(userId), QUERY_KEYS.adminUserPayments(userId)],
    {
      onSuccess: () => {
        toast({ title: "Action completed and logged" });
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
    }
  );

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

interface PlanPriceConfig {
  plan: Plan;
  cadence: "monthly" | "yearly";
  envVar: string;
  priceId: string | null;
  configured: boolean;
  priceCents: number | null;
}

interface PlanPricesResponse {
  plans: PlanPriceConfig[];
  runbookUrl: string;
}

const RUNBOOK_HREF = "/docs/runbooks/stripe-plan-price-ids.md";

function planPriceLabel(p: PlanPriceConfig): string {
  const cadenceLabel = p.cadence === "monthly" ? "Monthly" : "Yearly";
  const planName = PLAN_NAMES[p.plan] ?? p.plan;
  // Yearly Stripe prices aren't tracked in shared/plans.ts, so priceCents
  // is only populated for the monthly cadence. Omit the trailing price
  // segment when we don't have a number to show.
  if (typeof p.priceCents === "number" && p.priceCents > 0) {
    return `${planName} · ${cadenceLabel} · ${safePriceCentsExact(p.priceCents)}/mo`;
  }
  return `${planName} · ${cadenceLabel}`;
}

function BillingActionsSection({ userId, profile }: { userId: string; profile: UserProfile }) {
  const { toast } = useToast();
  const [actionDialog, setActionDialog] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [compMonths, setCompMonths] = useState("1");
  const [creditAmount, setCreditAmount] = useState("");
  const [cancelImmediate, setCancelImmediate] = useState(false);
  const [selectedPriceKey, setSelectedPriceKey] = useState<string>("");

  const planPricesQuery = useQuery<PlanPricesResponse>({
    queryKey: QUERY_KEYS.adminUsersPlanPrices(),
  });
  const planPrices = planPricesQuery.data?.plans ?? [];
  const runbookUrl = planPricesQuery.data?.runbookUrl ?? RUNBOOK_HREF;
  const configuredCount = planPrices.filter((p) => p.configured).length;
  const missingPlanPrices = planPrices.filter((p) => !p.configured);
  const planPriceByKey = (key: string) =>
    planPrices.find((p) => `${p.plan}:${p.cadence}` === key);

  const actionMutation = useApiMutation(
    async ({ action_key, payload }: { action_key: string; payload?: any }) =>
      apiFetch(`/api/admin/users/${userId}/actions`, {
        method: "POST",
        body: JSON.stringify({ action_key, reason: reason.trim(), payload }),
      }),
    [QUERY_KEYS.adminUser(userId), QUERY_KEYS.adminUserAudit(userId), QUERY_KEYS.adminUserPayments(userId)],
    {
      onSuccess: () => {
        toast({ title: "Billing action completed and logged" });
        setActionDialog(null);
        setReason("");
        setCompMonths("1");
        setCreditAmount("");
        setCancelImmediate(false);
        setSelectedPriceKey("");
      },
      onError: (error: any) => {
        toast({ 
          title: "Billing action failed", 
          description: error.message || "Please try again",
          variant: "destructive" 
        });
      },
    }
  );

  const handleAction = (action_key: string, payload?: any) => {
    if (!reason.trim()) {
      toast({ title: "Reason is required", variant: "destructive" });
      return;
    }
    actionMutation.mutate({ action_key, payload });
  };

  return (
    <>
      <Card className="border-green-200 dark:border-green-900">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-4 w-4" />
            Billing Controls
          </CardTitle>
          <CardDescription>
            Stripe subscription and payment actions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={() => setActionDialog("change_plan")}
            data-testid="button-billing-change-plan"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Change Plan
          </Button>

          {planPricesQuery.isSuccess && missingPlanPrices.length > 0 && (
            <div
              className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
              data-testid="alert-billing-plan-prices-missing"
            >
              {configuredCount === 0 ? (
                <>
                  No Stripe plan prices configured in this environment.
                </>
              ) : (
                <>
                  {missingPlanPrices.length} plan/cadence pair
                  {missingPlanPrices.length === 1 ? "" : "s"} missing a Stripe price ID.
                </>
              )}{" "}
              <a
                href={runbookUrl}
                target="_blank"
                rel="noreferrer"
                className="underline"
                data-testid="link-billing-plan-prices-runbook"
              >
                Setup runbook
              </a>
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={() => setActionDialog("grant_comp")}
            data-testid="button-billing-grant-comp"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Grant Comp Access
          </Button>

          {profile.isPro && (
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={() => setActionDialog("revoke_comp")}
              data-testid="button-billing-revoke-comp"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Revoke Comp Access
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={() => setActionDialog("pause")}
            data-testid="button-billing-pause"
          >
            <Clock className="h-4 w-4 mr-2" />
            Pause Billing
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={() => setActionDialog("resume")}
            data-testid="button-billing-resume"
          >
            <Activity className="h-4 w-4 mr-2" />
            Resume Billing
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start text-red-600 hover:text-red-700"
            onClick={() => setActionDialog("cancel")}
            data-testid="button-billing-cancel"
          >
            <XCircle className="h-4 w-4 mr-2" />
            Cancel Subscription
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={() => setActionDialog("credit")}
            data-testid="button-billing-credit"
          >
            <CreditCard className="h-4 w-4 mr-2" />
            Apply Credit
          </Button>

          <Separator className="my-2" />

          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start text-red-600 hover:text-red-700"
            onClick={() => setActionDialog("disable")}
            data-testid="button-account-disable"
          >
            <Shield className="h-4 w-4 mr-2" />
            Disable Account
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={() => setActionDialog("enable")}
            data-testid="button-account-enable"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Enable Account
          </Button>
        </CardContent>
      </Card>

      <Dialog open={!!actionDialog} onOpenChange={(open) => !open && setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog === "change_plan" && "Change Plan"}
              {actionDialog === "grant_comp" && "Grant Comp Access"}
              {actionDialog === "revoke_comp" && "Revoke Comp Access"}
              {actionDialog === "pause" && "Pause Billing"}
              {actionDialog === "resume" && "Resume Billing"}
              {actionDialog === "cancel" && "Cancel Subscription"}
              {actionDialog === "credit" && "Apply Credit"}
              {actionDialog === "disable" && "Disable Account"}
              {actionDialog === "enable" && "Enable Account"}
            </DialogTitle>
            <DialogDescription>
              This billing action will be logged with your identity and the reason you provide.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {actionDialog === "change_plan" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="select-billing-plan-price">
                    New plan / cadence
                  </Label>
                  <TooltipProvider delayDuration={150}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <a
                          href={runbookUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-muted-foreground underline"
                          data-testid="link-billing-plan-prices-runbook-tooltip"
                        >
                          Why are some disabled?
                        </a>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-xs text-xs">
                        Plans whose Stripe price ID env var isn't set in this
                        environment are disabled. See the runbook for setup.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Select
                  value={selectedPriceKey}
                  onValueChange={setSelectedPriceKey}
                >
                  <SelectTrigger
                    id="select-billing-plan-price"
                    data-testid="select-billing-plan-price"
                  >
                    <SelectValue placeholder="Select a plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {planPrices.map((p) => {
                      const key = `${p.plan}:${p.cadence}`;
                      return (
                        <SelectItem
                          key={key}
                          value={key}
                          disabled={!p.configured}
                          data-testid={`select-item-billing-plan-${p.plan}-${p.cadence}`}
                        >
                          {planPriceLabel(p)}
                          {!p.configured && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              ({p.envVar} not set)
                            </span>
                          )}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {planPricesQuery.isSuccess && configuredCount === 0 && (
                  <p
                    className="text-xs text-amber-700 dark:text-amber-300"
                    data-testid="text-billing-no-plan-prices"
                  >
                    No Stripe plan prices are configured in this environment.{" "}
                    <a
                      href={runbookUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                    >
                      See the runbook
                    </a>{" "}
                    for setup instructions.
                  </p>
                )}
              </div>
            )}

            {actionDialog === "grant_comp" && (
              <div className="space-y-2">
                <Label>Duration (months)</Label>
                <Input
                  type="number"
                  min="1"
                  max="24"
                  value={compMonths}
                  onChange={(e) => setCompMonths(e.target.value)}
                  data-testid="input-comp-months"
                />
              </div>
            )}

            {actionDialog === "credit" && (
              <div className="space-y-2">
                <Label>Credit Amount ($)</Label>
                <Input
                  type="number"
                  min="1"
                  step="0.01"
                  placeholder="e.g., 25.00"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                  data-testid="input-credit-amount"
                />
              </div>
            )}

            {actionDialog === "cancel" && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={cancelImmediate}
                    onChange={(e) => setCancelImmediate(e.target.checked)}
                    className="rounded"
                    data-testid="checkbox-cancel-immediate"
                  />
                  Cancel immediately (otherwise cancels at period end)
                </Label>
              </div>
            )}

            <div className="space-y-2">
              <Label>Reason (required)</Label>
              <Textarea
                placeholder="Why are you taking this action?"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                data-testid="input-billing-reason"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setActionDialog(null)}
              data-testid="button-billing-cancel-dialog"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                switch (actionDialog) {
                  case "change_plan": {
                    const selected = planPriceByKey(selectedPriceKey);
                    if (!selected || !selected.configured || !selected.priceId) {
                      toast({
                        title: "Pick an available plan",
                        description:
                          "That plan/cadence has no Stripe price ID configured. See the runbook.",
                        variant: "destructive",
                      });
                      return;
                    }
                    const normalizePlanTier = (value: string | null | undefined): PlanTier => {
                      const candidate = (value ?? "free") as PlanTier;
                      return PLAN_ORDER.includes(candidate) ? candidate : "free";
                    };
                    const currentPlanTier = normalizePlanTier(profile.plan);
                    const selectedPlanTier = normalizePlanTier(selected.plan as unknown as string);
                    const currentLevel = PLAN_ORDER.indexOf(currentPlanTier);
                    const selectedLevel = PLAN_ORDER.indexOf(selectedPlanTier);
                    let isUpgrade: boolean;
                    if (selectedLevel !== currentLevel) {
                      // Tier change: direction is determined purely by tier
                      // (Free → Pro+ is always an upgrade; Business → Pro is
                      // always a downgrade), independent of cadence.
                      isUpgrade = selectedLevel > currentLevel;
                    } else {
                      // Same tier, cadence-only switch: treat the move to a
                      // yearly cadence as the upgrade direction (greater
                      // commitment, prepaid) and the move to monthly as the
                      // downgrade direction.
                      isUpgrade = selected.cadence === "yearly";
                    }
                    handleAction(
                      isUpgrade ? "billing_upgrade" : "billing_downgrade",
                      { priceId: selected.priceId },
                    );
                    break;
                  }
                  case "grant_comp":
                    handleAction("billing_grant_comp", { months: parseInt(compMonths) || 1 });
                    break;
                  case "revoke_comp":
                    handleAction("billing_revoke_comp");
                    break;
                  case "pause":
                    handleAction("billing_pause");
                    break;
                  case "resume":
                    handleAction("billing_resume");
                    break;
                  case "cancel":
                    handleAction("billing_cancel", { immediate: cancelImmediate });
                    break;
                  case "credit":
                    handleAction("billing_apply_credit", { 
                      amountCents: Math.round((parseFloat(creditAmount) || 0) * 100) 
                    });
                    break;
                  case "disable":
                    handleAction("account_disable");
                    break;
                  case "enable":
                    handleAction("account_enable");
                    break;
                }
              }}
              disabled={
                actionMutation.isPending ||
                !reason.trim() ||
                (actionDialog === "change_plan" &&
                  (!selectedPriceKey ||
                    !planPriceByKey(selectedPriceKey)?.configured))
              }
              data-testid="button-billing-confirm"
            >
              {actionMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
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
    queryKey: QUERY_KEYS.adminUser(userId),
    queryFn: async () => {
      const token = getAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const urlParams = new URLSearchParams();
      if (from) urlParams.set("from", from);
      if (view) urlParams.set("metric", view);
      const res = await fetch(`/api/admin/users/${userId}?${urlParams.toString()}`, {
        credentials: "include",
        headers,
      });
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
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <div className="h-16 w-16 rounded-2xl bg-red-500/10 flex items-center justify-center">
          <AlertTriangle className="h-8 w-8 text-red-500" />
        </div>
        <h1 className="text-xl font-semibold">User Not Found</h1>
        <p className="text-muted-foreground">The user you're looking for doesn't exist.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="page-admin-user-detail">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-violet-500" />
            User Detail
          </h1>
          <p className="text-muted-foreground mt-1 font-mono text-sm">{userId}</p>
        </div>
      </div>

      <div className="space-y-4">
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

        <div className="grid md:grid-cols-2 gap-4">
          <SmsRateLimitSection userId={userId} />
        </div>

        <Tabs defaultValue="timeline">
          <TabsList className="w-full grid grid-cols-6">
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="messages" data-testid="tab-outbound-messages">Outbound Messages</TabsTrigger>
            <TabsTrigger value="stop-audit" data-testid="tab-stop-audit">STOP Audit</TabsTrigger>
            <TabsTrigger value="audit">Audit Log</TabsTrigger>
            <TabsTrigger value="links">External Links</TabsTrigger>
            <TabsTrigger value="actions">Actions</TabsTrigger>
          </TabsList>
          <TabsContent value="timeline" className="mt-4">
            <TimelineSection userId={userId} />
          </TabsContent>
          <TabsContent value="messages" className="mt-4">
            <OutboundMessagesSection userId={userId} />
          </TabsContent>
          <TabsContent value="stop-audit" className="mt-4">
            <SmsOptOutEventsSection userId={userId} />
          </TabsContent>
          <TabsContent value="audit" className="mt-4">
            <AuditSection userId={userId} />
          </TabsContent>
          <TabsContent value="links" className="mt-4">
            <ExternalLinksSection userId={userId} />
          </TabsContent>
          <TabsContent value="actions" className="mt-4">
            <div className="space-y-4">
              <ActionsSection userId={userId} profile={data.profile} />
              <BillingActionsSection userId={userId} profile={data.profile} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
