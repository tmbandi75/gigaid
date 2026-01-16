import { useLocation, useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  ArrowLeft,
  Edit,
  Calendar,
  Clock,
  MapPin,
  Phone,
  Mail,
  User,
  Briefcase,
  DollarSign,
  Timer,
  CheckCircle2,
  AlertCircle,
  Send,
  Navigation,
  Loader2,
  Users,
  FileText,
  XCircle,
  Play,
  Image,
} from "lucide-react";
import type { Job } from "@shared/schema";
import { JobLocationMap } from "@/components/JobLocationMap";
import { GetPaidDialog } from "@/components/job/GetPaidDialog";
import { useState } from "react";

const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  scheduled: { label: "Scheduled", color: "text-blue-600", bgColor: "bg-blue-500/10", icon: Calendar },
  in_progress: { label: "In Progress", color: "text-amber-600", bgColor: "bg-amber-500/10", icon: Clock },
  completed: { label: "Completed", color: "text-green-600", bgColor: "bg-green-500/10", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", color: "text-red-600", bgColor: "bg-red-500/10", icon: XCircle },
};

const paymentStatusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  unpaid: { label: "Unpaid", color: "text-red-600", bgColor: "bg-red-500/10" },
  partial: { label: "Partial", color: "text-amber-600", bgColor: "bg-amber-500/10" },
  paid: { label: "Paid", color: "text-green-600", bgColor: "bg-green-500/10" },
};

function formatDate(dateString: string | null): string {
  if (!dateString) return "Not set";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function formatTime(timeString: string | null): string {
  if (!timeString) return "Not set";
  const [hours, minutes] = timeString.split(":");
  const h = parseInt(hours);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

function formatPrice(cents: number | null): string {
  if (!cents) return "$0.00";
  return `$${(cents / 100).toFixed(2)}`;
}

export default function JobSummary() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showGetPaid, setShowGetPaid] = useState(false);

  const { data: job, isLoading } = useQuery<Job>({
    queryKey: ["/api/jobs", id],
    enabled: !!id,
  });

  // Fetch job photos
  interface PhotoAsset {
    id: string;
    storagePath: string;
    visibility: string;
  }
  const { data: jobPhotos = [] } = useQuery<PhotoAsset[]>({
    queryKey: ["/api/photo-assets", "job", id],
    queryFn: async () => {
      const res = await fetch(`/api/photo-assets?sourceType=job&sourceId=${id}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!id,
  });

  const onTheWayMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/jobs/${id}/on-the-way`);
    },
    onSuccess: () => {
      toast({ title: "Notification sent!", description: "Your client knows you're on the way." });
    },
    onError: () => {
      toast({ title: "Failed to send notification", variant: "destructive" });
    },
  });

  const requestReviewMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/jobs/${id}/request-review`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", id] });
      toast({ title: "Review request sent!" });
    },
    onError: () => {
      toast({ title: "Failed to send review request", variant: "destructive" });
    },
  });

  const startJobMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", `/api/jobs/${id}`, { status: "in_progress" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: "Job started!", description: "Good luck with this one!" });
    },
    onError: () => {
      toast({ title: "Failed to start job", variant: "destructive" });
    },
  });

  const completeJobMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", `/api/jobs/${id}`, { status: "completed" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: "Job completed!", description: "Great work! Don't forget to get paid." });
    },
    onError: (error: Error) => {
      if (error.message?.includes("RESOLUTION_REQUIRED")) {
        setShowGetPaid(true);
        toast({ 
          title: "Choose how to get paid first", 
          description: "Before marking complete, decide how to handle payment.",
        });
      } else {
        toast({ title: "Failed to complete job", variant: "destructive" });
      }
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4" data-testid="page-job-not-found">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <p className="text-lg text-muted-foreground">Job not found</p>
        <Button onClick={() => navigate("/jobs")} data-testid="button-back-to-jobs">
          Back to Jobs
        </Button>
      </div>
    );
  }

  const status = statusConfig[job.status] || statusConfig.scheduled;
  const StatusIcon = status.icon;
  const paymentStatus = paymentStatusConfig[job.paymentStatus || "unpaid"];

  const handleOpenMaps = () => {
    if (job.location) {
      const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.location)}`;
      window.open(url, "_blank");
    }
  };

  const handleCall = () => {
    if (job.clientPhone) {
      window.location.href = `tel:${job.clientPhone}`;
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24" data-testid="page-job-summary">
      <div className="relative overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-violet-600 text-primary-foreground px-4 pt-6 pb-16">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 -left-10 w-32 h-32 bg-violet-400/20 rounded-full blur-2xl" />
        </div>
        
        <div className="relative">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/jobs")}
              className="text-primary-foreground hover:bg-white/20 -ml-2"
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate(`/jobs/${id}/edit`)}
              data-testid="button-edit"
            >
              <Edit className="h-4 w-4 mr-1" />
              Edit
            </Button>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0">
              <Briefcase className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold truncate" data-testid="text-job-title">{job.title}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge className={`${status.bgColor} ${status.color} border-0`} data-testid="badge-status">
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {status.label}
                </Badge>
                <Badge className={`${paymentStatus.bgColor} ${paymentStatus.color} border-0`} data-testid="badge-payment">
                  <DollarSign className="h-3 w-3 mr-1" />
                  {paymentStatus.label}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-8 relative z-10 space-y-4">
        <Card className="border-0 shadow-lg" data-testid="card-schedule">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="h-4 w-4 text-blue-500" />
              <h3 className="font-semibold text-sm">Schedule</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Date</p>
                <p className="font-medium" data-testid="text-date">{formatDate(job.scheduledDate)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Time</p>
                <p className="font-medium" data-testid="text-time">{formatTime(job.scheduledTime)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Duration</p>
                <p className="font-medium" data-testid="text-duration">{job.duration ? `${job.duration} min` : "Not set"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Service</p>
                <p className="font-medium capitalize" data-testid="text-service">{job.serviceType}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md" data-testid="card-client">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <User className="h-4 w-4 text-green-500" />
              <h3 className="font-semibold text-sm">Client</h3>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Name</p>
                <p className="font-medium" data-testid="text-client-name">{job.clientName || "Not set"}</p>
              </div>
              {job.clientPhone && (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Phone</p>
                    <p className="font-medium" data-testid="text-client-phone">{job.clientPhone}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleCall} data-testid="button-call">
                    <Phone className="h-4 w-4 mr-1" />
                    Call
                  </Button>
                </div>
              )}
              {job.clientEmail && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Email</p>
                  <p className="font-medium" data-testid="text-client-email">{job.clientEmail}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {job.location && (
          <Card className="border-0 shadow-md" data-testid="card-location">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-red-500" />
                  <h3 className="font-semibold text-sm">Location</h3>
                </div>
                <Button variant="outline" size="sm" onClick={handleOpenMaps} data-testid="button-directions">
                  <Navigation className="h-4 w-4 mr-1" />
                  Directions
                </Button>
              </div>
              <p className="text-sm" data-testid="text-location">{job.location}</p>
              
              {job.customerLat && job.customerLng && (
                <div className="mt-3">
                  <JobLocationMap 
                    customerLat={job.customerLat}
                    customerLng={job.customerLng}
                    providerLat={job.providerLat ?? undefined}
                    providerLng={job.providerLng ?? undefined}
                    providerLocationUpdatedAt={job.providerLocationUpdatedAt ?? undefined}
                    jobLocation={job.location || ""}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {job.price && (
          <Card className="border-0 shadow-md" data-testid="card-price">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <DollarSign className="h-4 w-4 text-emerald-500" />
                <h3 className="font-semibold text-sm">Payment</h3>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total Price</p>
                  <p className="text-2xl font-bold text-emerald-600" data-testid="text-price">{formatPrice(job.price)}</p>
                </div>
                {job.paymentStatus !== "paid" && (
                  <Button onClick={() => setShowGetPaid(true)} data-testid="button-get-paid">
                    <DollarSign className="h-4 w-4 mr-1" />
                    Get Paid
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {job.description && (
          <Card className="border-0 shadow-md" data-testid="card-description">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-4 w-4 text-violet-500" />
                <h3 className="font-semibold text-sm">Description</h3>
              </div>
              <p className="text-sm text-muted-foreground" data-testid="text-description">{job.description}</p>
            </CardContent>
          </Card>
        )}

        {job.notes && (
          <Card className="border-0 shadow-md" data-testid="card-notes">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-4 w-4 text-amber-500" />
                <h3 className="font-semibold text-sm">Notes</h3>
              </div>
              <p className="text-sm text-muted-foreground" data-testid="text-notes">{job.notes}</p>
            </CardContent>
          </Card>
        )}

        {jobPhotos.length > 0 && (
          <Card className="border-0 shadow-md" data-testid="card-photos">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Image className="h-4 w-4 text-pink-500" />
                <h3 className="font-semibold text-sm">Photos ({jobPhotos.length})</h3>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {jobPhotos.map((photo) => (
                  <a
                    key={photo.id}
                    href={photo.storagePath}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="aspect-square rounded-lg overflow-hidden bg-muted relative group"
                    data-testid={`job-photo-${photo.id}`}
                  >
                    <img
                      src={photo.storagePath}
                      alt="Job photo"
                      className="w-full h-full object-cover"
                    />
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {job.assignedCrewId && (
          <Card className="border-0 shadow-md" data-testid="card-crew">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-4 w-4 text-indigo-500" />
                <h3 className="font-semibold text-sm">Assigned Crew</h3>
              </div>
              <p className="text-sm" data-testid="text-crew-id">Crew ID: {job.assignedCrewId}</p>
            </CardContent>
          </Card>
        )}

        <Separator className="my-2" />

        <div className="space-y-3">
          {job.status === "scheduled" && (
            <Button
              className="w-full h-12"
              onClick={() => startJobMutation.mutate()}
              disabled={startJobMutation.isPending}
              data-testid="button-start-job"
            >
              {startJobMutation.isPending ? (
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              ) : (
                <Play className="h-5 w-5 mr-2" />
              )}
              Start Job
            </Button>
          )}

          {job.status === "in_progress" && (
            <Button
              className="w-full h-12"
              onClick={() => completeJobMutation.mutate()}
              disabled={completeJobMutation.isPending}
              data-testid="button-complete-job"
            >
              {completeJobMutation.isPending ? (
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-5 w-5 mr-2" />
              )}
              Complete Job
            </Button>
          )}

          {job.status === "scheduled" && job.clientPhone && (
            <Button
              className="w-full h-12"
              variant="outline"
              onClick={() => onTheWayMutation.mutate()}
              disabled={onTheWayMutation.isPending}
              data-testid="button-on-the-way"
            >
              {onTheWayMutation.isPending ? (
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              ) : (
                <Send className="h-5 w-5 mr-2" />
              )}
              On The Way
            </Button>
          )}

          {job.paymentStatus === "paid" && !job.reviewRequestedAt && job.clientPhone && (
            <Button
              className="w-full h-12"
              variant="outline"
              onClick={() => requestReviewMutation.mutate()}
              disabled={requestReviewMutation.isPending}
              data-testid="button-request-review"
            >
              {requestReviewMutation.isPending ? (
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-5 w-5 mr-2" />
              )}
              Request Review
            </Button>
          )}

          <Button
            className="w-full h-12"
            onClick={() => navigate(`/jobs/${id}/edit`)}
            data-testid="button-edit-bottom"
          >
            <Edit className="h-5 w-5 mr-2" />
            Edit Job Details
          </Button>
        </div>
      </div>

      <GetPaidDialog
        open={showGetPaid}
        onClose={() => setShowGetPaid(false)}
        jobId={job.id}
        jobTitle={job.title}
        amount={job.price ?? undefined}
      />
    </div>
  );
}
