import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { safePriceCentsExact } from "@/lib/safePrice";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  User,
  Phone,
  Mail,
  Briefcase,
  MessageSquare,
  FileText,
  Edit,
  CheckCircle2,
  Loader2,
  DollarSign,
  Send,
  Eye,
  Clock,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import type { Lead, PriceConfirmation, AiNudge } from "@shared/schema";
import { LeadEmailConversation } from "@/components/lead/LeadEmailConversation";
import { LeadTextComposer } from "@/components/lead/LeadTextComposer";
import { LeadSmsConversation } from "@/components/lead/LeadSmsConversation";
import { NudgeChips } from "@/components/nudges/NudgeChip";
import { IntentActionCard } from "@/components/IntentActionCard";
import { NextActionBanner } from "@/components/NextActionBanner";

interface LeadSummaryDesktopViewProps {
  lead: Lead;
  activePriceConfirmation: PriceConfirmation | null | undefined;
  nudges: AiNudge[];
  nudgesEnabled: boolean;
  onCall: () => void;
  onEmail: () => void;
  onEdit: () => void;
  onConvert: () => void;
  onSendPrice: () => void;
  onViewJob: () => void;
  onNudgeClick: (nudge: AiNudge) => void;
  convertPending: boolean;
  statusConfig: Record<string, { label: string; color: string; bgColor: string }>;
  sourceConfig: Record<string, { label: string; color: string }>;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

const priceConfirmationStatusConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  draft: { label: "Draft", icon: FileText, color: "text-gray-500" },
  sent: { label: "Sent", icon: Send, color: "text-blue-500" },
  viewed: { label: "Viewed", icon: Eye, color: "text-amber-500" },
  confirmed: { label: "Confirmed", icon: CheckCircle2, color: "text-green-500" },
  expired: { label: "Expired", icon: Clock, color: "text-red-500" },
};

export function LeadSummaryDesktopView({
  lead,
  activePriceConfirmation,
  nudges,
  nudgesEnabled,
  onCall,
  onEmail,
  onEdit,
  onConvert,
  onSendPrice,
  onViewJob,
  onNudgeClick,
  convertPending,
  statusConfig,
  sourceConfig,
}: LeadSummaryDesktopViewProps) {
  const status = statusConfig[lead.status] || statusConfig.new;
  const source = sourceConfig[lead.source || "manual"] || sourceConfig.manual;
  const pcStatus = activePriceConfirmation?.status
    ? priceConfirmationStatusConfig[activePriceConfirmation.status]
    : null;

  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6" data-testid="lead-desktop-content">
      <div className="mb-4">
        <IntentActionCard entityType="lead" entityId={lead.id} />
        <NextActionBanner entityType="lead" entityId={lead.id} />
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-3 space-y-4" data-testid="panel-customer-overview">
          <Card className="rounded-xl border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                Customer
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="font-medium text-foreground" data-testid="text-customer-name-panel">{lead.clientName}</p>
                {lead.clientPhone && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                    <Phone className="h-3 w-3" />
                    <span data-testid="text-phone-panel">{lead.clientPhone}</span>
                  </div>
                )}
                {lead.clientEmail && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                    <Mail className="h-3 w-3" />
                    <span data-testid="text-email-panel" className="truncate">{lead.clientEmail}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={`${status.bgColor} ${status.color} border-0`} data-testid="badge-status-panel">
                  {status.label}
                </Badge>
                <Badge variant="secondary" data-testid="badge-source-panel">
                  {source.label}
                </Badge>
              </div>

              <div className="border-t pt-3 grid grid-cols-1 gap-2">
                {lead.clientPhone && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="justify-start gap-2 text-xs"
                    onClick={onCall}
                    aria-label="Call customer"
                    data-testid="button-call-panel"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    Call
                  </Button>
                )}
                {lead.clientEmail && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="justify-start gap-2 text-xs"
                    onClick={onEmail}
                    aria-label="Email customer"
                    data-testid="button-email-panel"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    Email
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {lead.description && (
            <Card className="rounded-xl border shadow-sm" data-testid="card-description-panel">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    Client Request
                  </CardTitle>
                  {lead.source === "booking_form" && (
                    <Badge variant="secondary" className="text-[10px]">From booking form</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground" data-testid="text-description-panel">{lead.description}</p>
              </CardContent>
            </Card>
          )}

          <Card className="rounded-xl border shadow-sm" data-testid="card-service-panel">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-violet-500" />
                Service Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Service Type</p>
                <p className="font-medium capitalize text-sm" data-testid="text-service-panel">{lead.serviceType}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Created</p>
                <p className="font-medium text-sm" data-testid="text-created-panel">{formatDate(lead.createdAt)}</p>
              </div>
            </CardContent>
          </Card>

          {lead.notes && (
            <Card className="rounded-xl border shadow-sm" data-testid="card-notes-panel">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-500" />
                  Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground" data-testid="text-notes-panel">{lead.notes}</p>
              </CardContent>
            </Card>
          )}

          {lead.sourceUrl && (
            <Card className="rounded-xl border shadow-sm" data-testid="card-source-url-panel">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ExternalLink className="h-4 w-4 text-cyan-500" />
                  <span className="text-sm font-medium">Source Link</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(lead.sourceUrl!, "_blank")}
                  aria-label="Open source link"
                  data-testid="button-open-source-panel"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="col-span-6 space-y-4" data-testid="panel-conversation">
          {nudgesEnabled && nudges.length > 0 && (
            <Card className="rounded-xl border shadow-sm bg-gradient-to-r from-violet-500/5 to-purple-500/5" data-testid="card-nudges-panel">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-violet-500" />
                  <h3 className="font-semibold text-sm">AI Suggestions</h3>
                </div>
                <NudgeChips nudges={nudges} onNudgeClick={onNudgeClick} />
              </CardContent>
            </Card>
          )}

          <Card className="rounded-xl border shadow-sm" data-testid="card-sms-conversation-panel">
            <CardContent className="p-0">
              <LeadSmsConversation
                leadId={lead.id}
                clientPhone={lead.clientPhone}
                clientName={lead.clientName}
              />
            </CardContent>
          </Card>

          <Card className="rounded-xl border shadow-sm" data-testid="card-text-composer-panel">
            <CardContent className="p-0">
              <LeadTextComposer
                leadId={lead.id}
                clientPhone={lead.clientPhone}
                clientName={lead.clientName}
                serviceType={lead.serviceType}
                description={lead.description || undefined}
              />
            </CardContent>
          </Card>

          <Card className="rounded-xl border shadow-sm" data-testid="card-email-conversation-panel">
            <CardContent className="p-0">
              <LeadEmailConversation
                leadId={lead.id}
                clientEmail={lead.clientEmail}
                clientName={lead.clientName}
                serviceType={lead.serviceType}
                description={lead.description || undefined}
              />
            </CardContent>
          </Card>
        </div>

        <div className="col-span-3 space-y-4" data-testid="panel-actions">
          <Card className="rounded-xl border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Next Steps</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!lead.convertedJobId && (
                <Button
                  className="w-full"
                  onClick={onConvert}
                  disabled={convertPending}
                  aria-label="Convert to job"
                  data-testid="button-convert-panel"
                >
                  {convertPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  )}
                  Convert to Job
                </Button>
              )}

              {lead.convertedJobId && (
                <Button
                  className="w-full"
                  onClick={onViewJob}
                  aria-label="View job"
                  data-testid="button-view-job-panel"
                >
                  <Briefcase className="h-4 w-4 mr-2" />
                  View Job
                </Button>
              )}

              {lead.status !== "price_confirmed" && !lead.convertedJobId && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={onSendPrice}
                  aria-label="Send price confirmation"
                  data-testid="button-send-price-panel"
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  Send Price Confirmation
                </Button>
              )}

              <Button
                variant="secondary"
                className="w-full"
                onClick={onEdit}
                aria-label="Edit lead details"
                data-testid="button-edit-panel"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Lead Details
              </Button>
            </CardContent>
          </Card>

          {activePriceConfirmation && pcStatus && (
            <Card className="rounded-xl border shadow-sm" data-testid="card-price-confirmation-panel">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-emerald-500" />
                    Price Confirmation
                  </CardTitle>
                  <Badge variant="secondary" className={pcStatus.color} data-testid="badge-pc-status-panel">
                    <pcStatus.icon className="h-3 w-3 mr-1" />
                    {pcStatus.label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Price:</span>
                  <span className="font-bold text-lg" data-testid="text-pc-price-panel">
                    {safePriceCentsExact(activePriceConfirmation.agreedPrice)}
                  </span>
                </div>
                {activePriceConfirmation.notes && (
                  <p className="text-sm text-muted-foreground" data-testid="text-pc-notes-panel">
                    {activePriceConfirmation.notes}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          <Card className="rounded-xl border shadow-sm" data-testid="card-status-panel">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Request Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {["new", "response_sent", "engaged", "price_confirmed"].map((s) => {
                  const cfg = statusConfig[s];
                  const isCurrent = lead.status === s;
                  return (
                    <div
                      key={s}
                      className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm ${isCurrent ? cfg.bgColor + " font-medium" : "text-muted-foreground"}`}
                      data-testid={`status-step-${s}`}
                    >
                      <div className={`h-2 w-2 rounded-full ${isCurrent ? "bg-current" : "bg-muted-foreground/30"}`} />
                      <span className={isCurrent ? cfg.color : ""}>{cfg?.label || s}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
