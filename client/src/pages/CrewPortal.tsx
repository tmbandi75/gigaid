import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "wouter";
import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  MapPin,
  Calendar,
  Clock,
  Phone,
  User,
  CheckCircle2,
  XCircle,
  Send,
  Camera,
  Navigation,
  MessageCircle,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Upload,
  Plus,
} from "lucide-react";

interface CrewPortalData {
  invite: {
    id: string;
    status: string;
    confirmedAt: string | null;
    declinedAt: string | null;
    expiresAt: string;
  };
  job: {
    id: string;
    title: string;
    description: string | null;
    scheduledDate: string | null;
    scheduledTime: string | null;
    address: string | null;
    status: string;
    clientName: string | null;
    clientPhone: string | null;
  } | null;
  crewMember: {
    id: string;
    name: string;
  } | null;
  owner: {
    name: string | null;
    phone: string | null;
    email: string | null;
  } | null;
  photos: Array<{
    id: string;
    photoUrl: string;
    caption: string | null;
    uploadedAt: string;
  }>;
  messages: Array<{
    id: string;
    message: string;
    isFromCrew: boolean;
    createdAt: string;
  }>;
}

export default function CrewPortal() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [messageText, setMessageText] = useState("");
  const [declineReason, setDeclineReason] = useState("");
  const [showDeclineForm, setShowDeclineForm] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [photoCaption, setPhotoCaption] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const portalQueryKey = ["/api/public/crew-portal", token];
  
  const { data, isLoading, error } = useQuery<CrewPortalData>({
    queryKey: portalQueryKey,
    queryFn: async () => {
      const res = await fetch(`/api/public/crew-portal/${token}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to load");
      }
      return res.json();
    },
    enabled: !!token,
    retry: false,
  });

  const confirmMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/public/crew-portal/${token}/confirm`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: portalQueryKey });
      toast({
        title: "Confirmed!",
        description: "You've confirmed your attendance for this job.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to confirm attendance. Please try again.",
        variant: "destructive",
      });
    },
  });

  const declineMutation = useMutation({
    mutationFn: (reason: string) =>
      apiRequest("POST", `/api/public/crew-portal/${token}/decline`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: portalQueryKey });
      setShowDeclineForm(false);
      toast({
        title: "Declined",
        description: "You've declined this job assignment.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to decline. Please try again.",
        variant: "destructive",
      });
    },
  });

  const messageMutation = useMutation({
    mutationFn: (message: string) =>
      apiRequest("POST", `/api/public/crew-portal/${token}/message`, { message }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: portalQueryKey });
      setMessageText("");
      toast({
        title: "Message Sent",
        description: "Your message has been sent to the team lead.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handlePhotoUpload = async (file: File) => {
    if (!file) return;
    
    setIsUploading(true);
    try {
      const uploadRes = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type,
        }),
      });

      if (!uploadRes.ok) {
        throw new Error("Failed to get upload URL");
      }

      const { uploadURL, objectPath } = await uploadRes.json();

      const uploadToStorage = await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!uploadToStorage.ok) {
        throw new Error("Failed to upload file");
      }

      await apiRequest("POST", `/api/public/crew-portal/${token}/photo`, {
        photoUrl: objectPath,
        caption: photoCaption || null,
      });

      queryClient.invalidateQueries({ queryKey: portalQueryKey });
      setPhotoCaption("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      toast({
        title: "Photo Uploaded",
        description: "Your photo has been uploaded successfully.",
      });
    } catch (err) {
      console.error("Photo upload error:", err);
      toast({
        title: "Upload Failed",
        description: "Failed to upload photo. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading job details...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    const errorMessage = (error as any)?.message || "This link is invalid or has expired.";
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-destructive/10 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
            <h2 className="text-xl font-semibold">Link Not Valid</h2>
            <p className="text-muted-foreground">{errorMessage}</p>
            <p className="text-sm text-muted-foreground">
              Please contact your team lead for a new link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { invite, job, crewMember, owner, photos, messages } = data;

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "TBD";
    const date = new Date(dateStr + "T12:00:00");
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (timeStr: string | null | undefined) => {
    if (!timeStr) return "TBD";
    const [hours, minutes] = timeStr.split(":");
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const openDirections = () => {
    if (!job?.address) return;
    const encoded = encodeURIComponent(job.address);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encoded}`, "_blank");
  };

  const callOwner = () => {
    if (owner?.phone) {
      window.location.href = `tel:${owner.phone}`;
    }
  };

  const callClient = () => {
    if (job?.clientPhone) {
      window.location.href = `tel:${job.clientPhone}`;
    }
  };

  const isConfirmed = invite.status === "confirmed";
  const isDeclined = invite.status === "declined";
  const canRespond = !isConfirmed && !isDeclined && invite.status !== "revoked";

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/10 to-background">
      <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground p-6 pb-8">
        <div className="max-w-lg mx-auto">
          <p className="text-sm opacity-90 mb-1">Job Assignment</p>
          <h1 className="text-2xl font-bold mb-2" data-testid="text-job-title">
            {job?.title || "Job Details"}
          </h1>
          {crewMember && (
            <p className="text-sm opacity-90">
              Hi {crewMember.name.split(" ")[0]}, here are your job details
            </p>
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-4 pb-8 space-y-4">
        {isConfirmed && (
          <Card className="border-green-500/50 bg-green-50 dark:bg-green-950/20">
            <CardContent className="py-4 flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
              <div>
                <p className="font-medium text-green-700 dark:text-green-400">
                  You're confirmed!
                </p>
                <p className="text-sm text-green-600 dark:text-green-500">
                  See you at the job site.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {isDeclined && (
          <Card className="border-orange-500/50 bg-orange-50 dark:bg-orange-950/20">
            <CardContent className="py-4 flex items-center gap-3">
              <XCircle className="w-6 h-6 text-orange-600" />
              <div>
                <p className="font-medium text-orange-700 dark:text-orange-400">
                  You declined this job
                </p>
                <p className="text-sm text-orange-600 dark:text-orange-500">
                  Contact your team lead if you change your mind.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Schedule
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Date</p>
                <p className="font-medium" data-testid="text-job-date">
                  {formatDate(job?.scheduledDate)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Time</p>
                <p className="font-medium" data-testid="text-job-time">
                  {formatTime(job?.scheduledTime)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              Location
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-foreground" data-testid="text-job-address">
              {job?.address || "Address not specified"}
            </p>
            {job?.address && (
              <Button
                onClick={openDirections}
                className="w-full gap-2"
                data-testid="button-get-directions"
              >
                <Navigation className="w-4 h-4" />
                Get Directions
                <ExternalLink className="w-4 h-4 ml-auto" />
              </Button>
            )}
          </CardContent>
        </Card>

        {job?.description && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Job Details</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground" data-testid="text-job-description">
                {job.description}
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              Contacts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {owner && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{owner.name || "Team Lead"}</p>
                    <p className="text-sm text-muted-foreground">Team Lead</p>
                  </div>
                </div>
                {owner.phone && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={callOwner}
                    data-testid="button-call-owner"
                  >
                    <Phone className="w-4 h-4" />
                  </Button>
                )}
              </div>
            )}
            {job?.clientName && (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                      <User className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">{job.clientName}</p>
                      <p className="text-sm text-muted-foreground">Client</p>
                    </div>
                  </div>
                  {job.clientPhone && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={callClient}
                      data-testid="button-call-client"
                    >
                      <Phone className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {canRespond && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Confirm Attendance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!showDeclineForm ? (
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={() => confirmMutation.mutate()}
                    disabled={confirmMutation.isPending}
                    className="gap-2"
                    data-testid="button-confirm-attendance"
                  >
                    {confirmMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    I'll Be There
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowDeclineForm(true)}
                    data-testid="button-show-decline"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Can't Make It
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <Textarea
                    placeholder="Reason for declining (optional)..."
                    value={declineReason}
                    onChange={(e) => setDeclineReason(e.target.value)}
                    rows={3}
                    data-testid="input-decline-reason"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setShowDeclineForm(false)}
                      data-testid="button-cancel-decline"
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => declineMutation.mutate(declineReason)}
                      disabled={declineMutation.isPending}
                      data-testid="button-confirm-decline"
                    >
                      {declineMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : null}
                      Decline Job
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-primary" />
              Messages
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {messages.length > 0 && (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-3 rounded-lg ${
                      msg.isFromCrew
                        ? "bg-primary/10 ml-4"
                        : "bg-muted mr-4"
                    }`}
                    data-testid={`message-${msg.id}`}
                  >
                    <p className="text-sm">{msg.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {msg.isFromCrew ? "You" : owner?.name || "Team Lead"} -{" "}
                      {new Date(msg.createdAt).toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Textarea
                placeholder="Send a message to your team lead..."
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                rows={2}
                className="flex-1"
                data-testid="input-message"
              />
              <Button
                size="icon"
                onClick={() => messageText.trim() && messageMutation.mutate(messageText.trim())}
                disabled={!messageText.trim() || messageMutation.isPending}
                data-testid="button-send-message"
              >
                {messageMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Camera className="w-5 h-5 text-primary" />
              Photos
              {photos.length > 0 && (
                <Badge variant="secondary">{photos.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {photos.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {photos.map((photo) => (
                  <div
                    key={photo.id}
                    className="aspect-square rounded-lg overflow-hidden bg-muted"
                    data-testid={`photo-${photo.id}`}
                  >
                    <img
                      src={photo.photoUrl}
                      alt={photo.caption || "Job photo"}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            )}
            
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Upload photos from the job site
              </p>
              <div className="flex gap-2">
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handlePhotoUpload(file);
                  }}
                  disabled={isUploading}
                  className="flex-1"
                  data-testid="input-photo-upload"
                />
              </div>
              {isUploading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading photo...
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="text-center text-xs text-muted-foreground pt-4">
          <p className="flex items-center justify-center gap-1">Powered by <img src="/gigaid-logo.png" alt="GigAid" className="h-4 inline-block" /></p>
          <p className="mt-1">
            Link expires:{" "}
            {new Date(invite.expiresAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
        </div>
      </div>
    </div>
  );
}
