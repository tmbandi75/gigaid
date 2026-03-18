import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Calendar,
  Clock,
  MapPin,
  Phone,
  Mail,
  User,
  Briefcase,
  DollarSign,
  CheckCircle2,
  Send,
  Navigation,
  Loader2,
  Users,
  FileText,
  Play,
  Image,
  Shield,
  CreditCard,
  Edit,
} from "lucide-react";
import type { Job, Client } from "@shared/schema";
import { JobLocationMap } from "@/components/JobLocationMap";
import { IntentActionCard } from "@/components/IntentActionCard";
import { NextActionBanner } from "@/components/NextActionBanner";
import { ScheduledMessagesPanel } from "@/components/ScheduledMessagesPanel";

interface PhotoAsset {
  id: string;
  storagePath: string;
  visibility: string;
}

interface DepositState {
  hasDeposit: boolean;
  depositRequestedCents: number;
  depositPaidCents: number;
  depositOutstandingCents?: number;
  isDepositFullyPaid?: boolean;
}

interface JobDetailDesktopViewProps {
  job: Job;
  jobPhotos: PhotoAsset[];
  depositStatus: DepositState | undefined;
  clientData: { client: Client | null } | undefined;
  depositOverride: string | null;
  statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: React.ElementType }>;
  paymentStatusConfig: Record<string, { label: string; color: string; bgColor: string }>;
  onCall: () => void;
  onOpenMaps: () => void;
  onEdit: () => void;
  onStartJob: () => void;
  onCompleteJob: () => void;
  onTheWay: () => void;
  onGetPaid: () => void;
  onRequestReview: () => void;
  onSendDepositRequest: () => void;
  onDepositOverrideChange: (value: string) => void;
  onUpdateLocation: () => void;
  startJobPending: boolean;
  completeJobPending: boolean;
  onTheWayPending: boolean;
  requestReviewPending: boolean;
  sendDepositRequestPending: boolean;
  updateLocationPending: boolean;
  updateClientDepositPending: boolean;
  formatDate: (d: string | null) => string;
  formatTime: (t: string | null) => string;
  formatPrice: (c: number | null) => string;
}

export function JobDetailDesktopView({
  job,
  jobPhotos,
  depositStatus,
  clientData,
  depositOverride,
  statusConfig,
  paymentStatusConfig,
  onCall,
  onOpenMaps,
  onEdit,
  onStartJob,
  onCompleteJob,
  onTheWay,
  onGetPaid,
  onRequestReview,
  onSendDepositRequest,
  onDepositOverrideChange,
  onUpdateLocation,
  startJobPending,
  completeJobPending,
  onTheWayPending,
  requestReviewPending,
  sendDepositRequestPending,
  updateLocationPending,
  updateClientDepositPending,
  formatDate,
  formatTime,
  formatPrice,
}: JobDetailDesktopViewProps) {
  const status = statusConfig[job.status] || statusConfig.scheduled;
  const paymentStatus = paymentStatusConfig[job.paymentStatus || "unpaid"];

  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6" data-testid="job-desktop-content">
      <div className="mb-4 space-y-2">
        <IntentActionCard entityType="job" entityId={job.id} />
        <NextActionBanner entityType="job" entityId={job.id} />
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-4 space-y-4" data-testid="panel-job-summary">
          <Card className="rounded-xl border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-500" />
                Job Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Date</p>
                  <p className="font-medium text-sm" data-testid="text-date-panel">{formatDate(job.scheduledDate)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Time</p>
                  <p className="font-medium text-sm" data-testid="text-time-panel">{formatTime(job.scheduledTime)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Duration</p>
                  <p className="font-medium text-sm" data-testid="text-duration-panel">{job.duration ? `${job.duration} min` : "Not set"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Service</p>
                  <p className="font-medium text-sm capitalize" data-testid="text-service-panel">{job.serviceType}</p>
                </div>
              </div>

              <div className="border-t pt-3 flex items-center gap-2 flex-wrap">
                <Badge className={`${status.bgColor} ${status.color} border-0`} data-testid="badge-status-panel">
                  <status.icon className="h-3 w-3 mr-1" />
                  {status.label}
                </Badge>
                <Badge className={`${paymentStatus.bgColor} ${paymentStatus.color} border-0`} data-testid="badge-payment-panel">
                  <DollarSign className="h-3 w-3 mr-1" />
                  {paymentStatus.label}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {job.description && (
            <Card className="rounded-xl border shadow-sm" data-testid="card-description-panel">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4 text-violet-500" />
                  Description
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground" data-testid="text-description-panel">{job.description}</p>
              </CardContent>
            </Card>
          )}

          {job.notes && (
            <Card className="rounded-xl border shadow-sm" data-testid="card-notes-panel">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4 text-amber-500" />
                  Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground" data-testid="text-notes-panel">{job.notes}</p>
              </CardContent>
            </Card>
          )}

          {jobPhotos.length > 0 && (
            <Card className="rounded-xl border shadow-sm" data-testid="card-photos-panel">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Image className="h-4 w-4 text-pink-500" />
                  Photos ({jobPhotos.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2">
                  {jobPhotos.map((photo) => (
                    <a
                      key={photo.id}
                      href={photo.storagePath}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="aspect-square rounded-lg overflow-hidden bg-muted"
                      data-testid={`job-photo-panel-${photo.id}`}
                    >
                      <img src={photo.storagePath} alt="Job photo" className="w-full h-full object-cover" />
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {job.assignedCrewId && (
            <Card className="rounded-xl border shadow-sm" data-testid="card-crew-panel">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4 text-indigo-500" />
                  Assigned Crew
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm" data-testid="text-crew-id-panel">Crew ID: {job.assignedCrewId}</p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="col-span-5 space-y-4" data-testid="panel-client-location">
          <Card className="rounded-xl border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <User className="h-4 w-4 text-green-500" />
                Client
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="font-medium" data-testid="text-client-name-panel">{job.clientName || "Not set"}</p>
                {job.clientPhone && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                    <Phone className="h-3 w-3" />
                    <span data-testid="text-client-phone-panel">{job.clientPhone}</span>
                  </div>
                )}
                {job.clientEmail && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                    <Mail className="h-3 w-3" />
                    <span data-testid="text-client-email-panel" className="truncate">{job.clientEmail}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {job.clientPhone && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onCall}
                    aria-label="Call client"
                    data-testid="button-call-panel"
                  >
                    <Phone className="h-3.5 w-3.5 mr-1.5" />
                    Call
                  </Button>
                )}
                {job.clientPhone && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.location.href = `sms:${job.clientPhone}`}
                    aria-label="Text client"
                    data-testid="button-text-panel"
                  >
                    <Send className="h-3.5 w-3.5 mr-1.5" />
                    Text
                  </Button>
                )}
                {job.clientEmail && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.location.href = `mailto:${job.clientEmail}`}
                    aria-label="Email client"
                    data-testid="button-email-panel"
                  >
                    <Mail className="h-3.5 w-3.5 mr-1.5" />
                    Email
                  </Button>
                )}
              </div>

              {clientData?.client && (
                <div className="border-t pt-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Deposit Requirement</p>
                      <p className="text-xs text-muted-foreground">Custom deposit for this client</p>
                    </div>
                    <Select
                      value={depositOverride || "default"}
                      onValueChange={onDepositOverrideChange}
                      disabled={updateClientDepositPending}
                    >
                      <SelectTrigger className="w-28" data-testid="select-client-deposit-panel">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Default</SelectItem>
                        <SelectItem value="0">No deposit</SelectItem>
                        <SelectItem value="10">10%</SelectItem>
                        <SelectItem value="25">25%</SelectItem>
                        <SelectItem value="50">50%</SelectItem>
                        <SelectItem value="75">75%</SelectItem>
                        <SelectItem value="100">100%</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {job.location && (
            <Card className="rounded-xl border shadow-sm" data-testid="card-location-panel">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-red-500" />
                    Location
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onOpenMaps}
                      aria-label="Get directions"
                      data-testid="button-directions-panel"
                    >
                      <Navigation className="h-3.5 w-3.5 mr-1.5" />
                      Directions
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm" data-testid="text-location-panel">{job.location}</p>
                {job.customerLat && job.customerLng && (
                  <div className="rounded-lg overflow-hidden border">
                    <JobLocationMap
                      customerLat={job.customerLat}
                      customerLng={job.customerLng}
                      providerLat={job.providerLat ?? undefined}
                      providerLng={job.providerLng ?? undefined}
                      providerLocationUpdatedAt={job.providerLocationUpdatedAt ?? undefined}
                      jobLocation={job.location || ""}
                      onUpdateLocation={onUpdateLocation}
                      isUpdatingLocation={updateLocationPending}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {job.status === "completed" && (
            <ScheduledMessagesPanel jobId={job.id} />
          )}
        </div>

        <div className="col-span-3 space-y-4" data-testid="panel-actions">
          <Card className="rounded-xl border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Job Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {job.status === "scheduled" && (
                <Button
                  className="w-full"
                  onClick={onStartJob}
                  disabled={startJobPending}
                  aria-label="Start job"
                  data-testid="button-start-job-panel"
                >
                  {startJobPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  Start Job
                </Button>
              )}

              {job.status === "in_progress" && (
                <Button
                  className="w-full"
                  onClick={onCompleteJob}
                  disabled={completeJobPending}
                  aria-label="Complete job"
                  data-testid="button-complete-job-panel"
                >
                  {completeJobPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  )}
                  Complete Job
                </Button>
              )}

              {job.status === "scheduled" && job.clientPhone && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={onTheWay}
                  disabled={onTheWayPending}
                  aria-label="Notify on the way"
                  data-testid="button-on-the-way-panel"
                >
                  {onTheWayPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  On The Way
                </Button>
              )}

              {job.paymentStatus === "paid" && !job.reviewRequestedAt && job.clientPhone && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={onRequestReview}
                  disabled={requestReviewPending}
                  aria-label="Request review"
                  data-testid="button-request-review-panel"
                >
                  {requestReviewPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  )}
                  Request Review
                </Button>
              )}

              <Button
                variant="secondary"
                className="w-full"
                onClick={onEdit}
                aria-label="Edit job details"
                data-testid="button-edit-panel"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Job Details
              </Button>
            </CardContent>
          </Card>

          {job.price && (
            <Card className="rounded-xl border shadow-sm" data-testid="card-payment-panel">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-emerald-500" />
                  Payment
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total Price</p>
                  <p className="text-2xl font-bold text-emerald-600" data-testid="text-price-panel">{formatPrice(job.price)}</p>
                </div>
                {job.paymentStatus !== "paid" && (
                  <Button
                    className="w-full"
                    onClick={onGetPaid}
                    aria-label="Collect payment"
                    data-testid="button-get-paid-panel"
                  >
                    <DollarSign className="h-4 w-4 mr-2" />
                    Collect Payment
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {depositStatus?.hasDeposit && (
            <Card className="rounded-xl border shadow-sm" data-testid="card-deposit-panel">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Shield className="h-4 w-4 text-amber-500" />
                    Deposit
                  </CardTitle>
                  {depositStatus.isDepositFullyPaid ? (
                    <Badge className="bg-green-500/10 text-green-700 border-0">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Paid
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-500/10 text-amber-700 border-0">
                      <Clock className="h-3 w-3 mr-1" />
                      Awaiting
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Required</p>
                    <p className="text-lg font-bold text-amber-600" data-testid="text-deposit-amount-panel">
                      {formatPrice(depositStatus.depositRequestedCents)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Paid</p>
                    <p className="text-lg font-bold text-green-600" data-testid="text-deposit-paid-panel">
                      {formatPrice(depositStatus.depositPaidCents)}
                    </p>
                  </div>
                </div>
                {!depositStatus.isDepositFullyPaid && job.clientPhone && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={onSendDepositRequest}
                    disabled={sendDepositRequestPending}
                    aria-label="Request deposit payment"
                    data-testid="button-send-deposit-panel"
                  >
                    {sendDepositRequestPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CreditCard className="h-4 w-4 mr-2" />
                    )}
                    Request Deposit
                  </Button>
                )}
                {!depositStatus.isDepositFullyPaid && !job.clientPhone && (
                  <p className="text-xs text-muted-foreground text-center">
                    Add client phone to send deposit request
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
