import { useState, useCallback } from "react";
import { useLocation, useParams, useSearch } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  ArrowLeft, 
  Loader2, 
  Sparkles, 
  Calendar, 
  Clock, 
  Briefcase,
  User,
  MapPin,
  DollarSign,
  FileText,
  Phone,
  Timer,
  CheckCircle2,
  Wrench,
  Users,
  Camera,
  XCircle,
  HelpCircle,
  ExternalLink
} from "lucide-react";
import { PhoneInput } from "@/components/ui/phone-input";
import type { Job } from "@shared/schema";
import { GetPaidDialog } from "@/components/job/GetPaidDialog";
import { JobLocationMap } from "@/components/JobLocationMap";

interface ScheduleSuggestion {
  date: string;
  time: string;
  reason: string;
}

interface CrewInvite {
  id: string;
  crewMemberId: number;
  crewFirstName?: string;
  crewEmail?: string;
  crewPhone?: string;
  status: string;
  confirmedAt?: string;
  declinedAt?: string;
  declineReason?: string;
}

interface CrewPhoto {
  id: string;
  photoUrl: string;
  caption?: string;
  createdAt: string;
}

interface CrewMember {
  id: number;
  userId: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  status: string;
}

const jobFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  serviceType: z.string().min(1, "Service type is required"),
  description: z.string().optional(),
  location: z.string().optional(),
  scheduledDate: z.string().min(1, "Date is required"),
  scheduledTime: z.string().min(1, "Time is required"),
  duration: z.coerce.number().min(15, "Duration must be at least 15 minutes").optional(),
  price: z.coerce.number().optional(),
  clientFirstName: z.string().optional(),
  clientLastName: z.string().optional(),
  clientPhone: z.string().optional(),
  status: z.string().optional(),
});

type JobFormData = z.infer<typeof jobFormSchema>;

const serviceTypes = [
  { value: "plumbing", label: "Plumbing", icon: "🔧" },
  { value: "electrical", label: "Electrical", icon: "⚡" },
  { value: "cleaning", label: "Cleaning", icon: "✨" },
  { value: "hvac", label: "HVAC", icon: "❄️" },
  { value: "painting", label: "Painting", icon: "🎨" },
  { value: "carpentry", label: "Carpentry", icon: "🪚" },
  { value: "landscaping", label: "Landscaping", icon: "🌳" },
  { value: "general", label: "General Maintenance", icon: "🔨" },
];

const jobStatuses = [
  { value: "scheduled", label: "Scheduled", color: "bg-blue-500" },
  { value: "in_progress", label: "In Progress", color: "bg-amber-500" },
  { value: "completed", label: "Completed", color: "bg-emerald-500" },
  { value: "cancelled", label: "Cancelled", color: "bg-gray-500" },
];

function parseClientName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

export default function JobForm() {
  const { id } = useParams<{ id: string }>();
  const isEditing = id && id !== "new";
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showGetPaidDialog, setShowGetPaidDialog] = useState(false);
  const [completedJobData, setCompletedJobData] = useState<{ title: string; price?: number; clientName?: string } | null>(null);

  const urlParams = new URLSearchParams(searchString);
  const prefillClientName = urlParams.get("clientName") || "";
  const parsedPrefill = parseClientName(prefillClientName);
  
  const prefillData = {
    serviceType: urlParams.get("serviceType") || "",
    date: urlParams.get("date") || "",
    time: urlParams.get("time") || "",
    clientFirstName: parsedPrefill.firstName,
    clientLastName: parsedPrefill.lastName,
    clientPhone: urlParams.get("clientPhone") || "",
    description: urlParams.get("description") || "",
    duration: urlParams.get("duration") ? parseInt(urlParams.get("duration")!) : undefined,
    price: urlParams.get("price") ? parseInt(urlParams.get("price")!) / 100 : undefined,
  };

  const { data: existingJob, isLoading: isLoadingJob } = useQuery<Job>({
    queryKey: ["/api/jobs", id],
    enabled: !!isEditing,
  });

  const { data: crewInvites = [] } = useQuery<CrewInvite[]>({
    queryKey: ["/api/jobs", id, "crew-invites"],
    queryFn: async () => {
      const res = await fetch(`/api/jobs/${id}/crew-invites`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!isEditing,
  });

  const { data: crewPhotos = [] } = useQuery<CrewPhoto[]>({
    queryKey: ["/api/jobs", id, "crew-photos"],
    queryFn: async () => {
      const res = await fetch(`/api/jobs/${id}/crew-photos`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!isEditing,
  });

  const { data: crewMembers = [] } = useQuery<CrewMember[]>({
    queryKey: ["/api/crew"],
    enabled: !!isEditing,
  });

  const [selectedCrewId, setSelectedCrewId] = useState<string>("");

  const assignCrewMutation = useMutation({
    mutationFn: async (crewMemberId: number) => {
      const member = crewMembers.find(m => m.id === crewMemberId);
      return apiRequest("POST", "/api/crew-invites", {
        jobId: id,
        crewMemberId,
        crewFirstName: member?.firstName || "",
        crewEmail: member?.email || null,
        crewPhone: member?.phone || null,
        message: `You've been assigned to a job`,
        sendSms: !!member?.phone,
        sendEmail: !!member?.email,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", id, "crew-invites"] });
      setSelectedCrewId("");
      toast({ title: "Crew member assigned successfully" });
    },
    onError: () => {
      toast({ title: "Failed to assign crew member", variant: "destructive" });
    },
  });

  const updateLocationMutation = useMutation({
    mutationFn: async ({ lat, lng }: { lat: number; lng: number }) => {
      return apiRequest("PATCH", `/api/jobs/${id}/provider-location`, { lat, lng });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", id] });
      toast({ title: "Location updated" });
    },
    onError: () => {
      toast({ title: "Failed to update location", variant: "destructive" });
    },
  });

  const handleUpdateMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast({ title: "Geolocation not supported", variant: "destructive" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        updateLocationMutation.mutate({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => {
        toast({ title: "Location permission denied", variant: "destructive" });
      },
      { enableHighAccuracy: false, maximumAge: 60000, timeout: 10000 }
    );
  }, [updateLocationMutation, toast]);

  const parsedExisting = existingJob ? parseClientName(existingJob.clientName || "") : { firstName: "", lastName: "" };

  const form = useForm<JobFormData>({
    resolver: zodResolver(jobFormSchema),
    defaultValues: {
      title: prefillData.description || "",
      serviceType: prefillData.serviceType || "",
      description: prefillData.description || "",
      location: "",
      scheduledDate: prefillData.date || new Date().toISOString().split('T')[0],
      scheduledTime: prefillData.time || "09:00",
      duration: prefillData.duration || 60,
      price: prefillData.price,
      clientFirstName: prefillData.clientFirstName || "",
      clientLastName: prefillData.clientLastName || "",
      clientPhone: prefillData.clientPhone || "",
      status: "scheduled",
    },
    values: existingJob ? {
      title: existingJob.title,
      serviceType: existingJob.serviceType,
      description: existingJob.description || "",
      location: existingJob.location || "",
      scheduledDate: existingJob.scheduledDate,
      scheduledTime: existingJob.scheduledTime,
      duration: existingJob.duration || 60,
      price: existingJob.price ? existingJob.price / 100 : undefined,
      clientFirstName: parsedExisting.firstName,
      clientLastName: parsedExisting.lastName,
      clientPhone: existingJob.clientPhone || "",
      status: existingJob.status,
    } : undefined,
  });

  const duration = form.watch("duration");
  const scheduledDate = form.watch("scheduledDate");

  const suggestionsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/ai/schedule-suggestions", {
        duration: duration || 60,
        preferredDate: scheduledDate,
      });
      return response.json() as Promise<{ suggestions: ScheduleSuggestion[] }>;
    },
  });

  const handleGetSuggestions = () => {
    setShowSuggestions(true);
    suggestionsMutation.mutate();
  };

  const handleSelectSuggestion = (suggestion: ScheduleSuggestion) => {
    form.setValue("scheduledDate", suggestion.date);
    form.setValue("scheduledTime", suggestion.time);
    setShowSuggestions(false);
    toast({ title: "Time slot selected" });
  };

  const createMutation = useMutation({
    mutationFn: async (data: JobFormData) => {
      const clientName = [data.clientFirstName, data.clientLastName]
        .filter(Boolean)
        .join(" ")
        .trim();
      
      const payload = {
        title: data.title,
        serviceType: data.serviceType,
        description: data.description,
        location: data.location,
        scheduledDate: data.scheduledDate,
        scheduledTime: data.scheduledTime,
        duration: data.duration,
        price: data.price ? data.price * 100 : undefined,
        clientName: clientName || undefined,
        clientPhone: data.clientPhone,
        userId: "demo-user",
        status: "scheduled",
      };
      return apiRequest("POST", "/api/jobs", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      toast({ title: "Job created successfully" });
      navigate("/jobs");
    },
    onError: () => {
      toast({ title: "Failed to create job", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: JobFormData & { _showGetPaid?: boolean }) => {
      const clientName = [data.clientFirstName, data.clientLastName]
        .filter(Boolean)
        .join(" ")
        .trim();
      
      const payload = {
        title: data.title,
        serviceType: data.serviceType,
        description: data.description,
        location: data.location,
        scheduledDate: data.scheduledDate,
        scheduledTime: data.scheduledTime,
        duration: data.duration,
        price: data.price ? data.price * 100 : undefined,
        clientName: clientName || undefined,
        clientPhone: data.clientPhone,
        status: data.status,
      };
      
      const response = await apiRequest("PATCH", `/api/jobs/${id}`, payload);
      return { data, clientName, response };
    },
    onSuccess: ({ data, clientName }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      
      if (data.status === "completed" && existingJob?.status !== "completed") {
        setCompletedJobData({
          title: data.title,
          price: data.price ? data.price * 100 : undefined,
          clientName: clientName || undefined,
        });
        setShowGetPaidDialog(true);
        toast({ title: "Job marked as complete!" });
      } else {
        toast({ title: "Job updated successfully" });
        navigate("/jobs");
      }
    },
    onError: () => {
      toast({ title: "Failed to update job", variant: "destructive" });
    },
  });

  const onSubmit = (data: JobFormData) => {
    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric"
      });
    } catch {
      return dateStr;
    }
  };

  const formatTime = (timeStr: string) => {
    try {
      const [hours, minutes] = timeStr.split(":");
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? "PM" : "AM";
      const hour12 = hour % 12 || 12;
      return `${hour12}:${minutes} ${ampm}`;
    } catch {
      return timeStr;
    }
  };

  if (isEditing && isLoadingJob) {
    return (
      <div className="flex flex-col min-h-full bg-background">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            <p className="text-sm text-muted-foreground">Loading job details...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full bg-background" data-testid="page-job-form">
      <div className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-violet-600 text-primary-foreground px-4 pt-4 pb-6">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 -left-10 w-32 h-32 bg-violet-400/20 rounded-full blur-2xl" />
        </div>
        
        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/jobs")}
            className="text-primary-foreground hover:bg-white/20 -ml-2 mb-3"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
              {isEditing ? (
                <Wrench className="h-6 w-6" />
              ) : (
                <Briefcase className="h-6 w-6" />
              )}
            </div>
            <div>
              <h1 className="text-xl font-bold">
                {isEditing ? "Edit Job" : "New Job"}
              </h1>
              <p className="text-sm text-primary-foreground/80">
                {isEditing ? "Update job details" : "Create a new job entry"}
              </p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex-1 px-4 py-6 -mt-2">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <Card className="border-0 shadow-md overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-primary to-violet-500" />
              <CardContent className="pt-5 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm">Job Details</h3>
                </div>
                
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Job Title
                      </FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g., Fix bathroom sink" 
                          className="h-12 text-base"
                          {...field} 
                          data-testid="input-title"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="serviceType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Service Type
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-12" data-testid="select-service-type">
                            <SelectValue placeholder="Select service type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {serviceTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              <span className="flex items-center gap-2">
                                <span>{type.icon}</span>
                                <span>{type.label}</span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Description (optional)
                      </FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Add any details about the job..."
                          className="resize-none min-h-[80px]"
                          {...field}
                          data-testid="input-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {isEditing && (
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Status
                        </FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-12" data-testid="select-status">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {jobStatuses.map((status) => (
                              <SelectItem key={status.value} value={status.value}>
                                <span className="flex items-center gap-2">
                                  <span className={`h-2 w-2 rounded-full ${status.color}`} />
                                  <span>{status.label}</span>
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-blue-500 to-cyan-500" />
              <CardContent className="pt-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-blue-500" />
                    <h3 className="font-semibold text-sm">Schedule</h3>
                  </div>
                  {!isEditing && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleGetSuggestions}
                      disabled={suggestionsMutation.isPending}
                      className="h-8"
                      data-testid="button-get-suggestions"
                    >
                      {suggestionsMutation.isPending ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <Sparkles className="h-3 w-3 mr-1" />
                      )}
                      AI Suggest
                    </Button>
                  )}
                </div>

                {showSuggestions && suggestionsMutation.data?.suggestions && (
                  <div className="rounded-xl bg-gradient-to-br from-primary/5 to-violet-500/5 border border-primary/20 p-4 space-y-2" data-testid="card-suggestions">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">AI-Suggested Slots</span>
                    </div>
                    {suggestionsMutation.data.suggestions.map((suggestion, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-background rounded-lg border hover-elevate cursor-pointer"
                        onClick={() => handleSelectSuggestion(suggestion)}
                        data-testid={`suggestion-slot-${index}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Calendar className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{formatDate(suggestion.date)}</p>
                            <p className="text-xs text-muted-foreground">{formatTime(suggestion.time)}</p>
                          </div>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          Select
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}

                {suggestionsMutation.isError && (
                  <p className="text-sm text-destructive">
                    Failed to get suggestions. Please try again.
                  </p>
                )}
                
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="scheduledDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Date
                        </FormLabel>
                        <FormControl>
                          <Input 
                            type="date" 
                            className="h-12"
                            {...field} 
                            data-testid="input-date"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="scheduledTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Time
                        </FormLabel>
                        <FormControl>
                          <Input 
                            type="time" 
                            className="h-12"
                            {...field} 
                            data-testid="input-time"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="duration"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                          <Timer className="h-3 w-3" />
                          Duration (min)
                        </FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="60"
                            className="h-12"
                            {...field}
                            data-testid="input-duration"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          Location
                        </FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Address"
                            className="h-12"
                            {...field}
                            data-testid="input-location"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {isEditing && existingJob?.customerLat && existingJob?.customerLng && (
              <div className="space-y-3">
                <JobLocationMap
                  customerLat={existingJob.customerLat}
                  customerLng={existingJob.customerLng}
                  providerLat={existingJob.providerLat ?? undefined}
                  providerLng={existingJob.providerLng ?? undefined}
                  providerLocationUpdatedAt={existingJob.providerLocationUpdatedAt ?? undefined}
                  jobLocation={existingJob.location || "Customer location"}
                  onUpdateLocation={handleUpdateMyLocation}
                  isUpdatingLocation={updateLocationMutation.isPending}
                />
              </div>
            )}

            <Card className="border-0 shadow-md overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
              <CardContent className="pt-5 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <User className="h-4 w-4 text-emerald-500" />
                  <h3 className="font-semibold text-sm">Client Information</h3>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="clientFirstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          First Name
                        </FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="John"
                            className="h-12"
                            {...field}
                            data-testid="input-client-first-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="clientLastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Last Name
                        </FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Doe"
                            className="h-12"
                            {...field}
                            data-testid="input-client-last-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="clientPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        Phone Number
                      </FormLabel>
                      <FormControl>
                        <PhoneInput
                          value={field.value || ""}
                          onChange={field.onChange}
                          className="h-12"
                          data-testid="input-client-phone"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
              <CardContent className="pt-5 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-4 w-4 text-amber-500" />
                  <h3 className="font-semibold text-sm">Pricing</h3>
                </div>
                
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Job Price ($)
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input 
                            type="number"
                            placeholder="0.00"
                            className="h-12 pl-9 text-lg font-semibold"
                            {...field}
                            data-testid="input-price"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {isEditing && (
              <Card className="border-0 shadow-md overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-indigo-500 to-purple-500" />
                <CardContent className="pt-5 space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-4 w-4 text-indigo-500" />
                    <h3 className="font-semibold text-sm">Crew Assignment</h3>
                  </div>

                  {crewMembers.length > 0 ? (
                    <div className="space-y-3">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Assign a Crew Member
                      </p>
                      <div className="flex gap-2">
                        <Select value={selectedCrewId} onValueChange={setSelectedCrewId}>
                          <SelectTrigger className="h-12 flex-1" data-testid="select-crew-member">
                            <SelectValue placeholder="Select crew member..." />
                          </SelectTrigger>
                          <SelectContent>
                            {crewMembers
                              .filter(m => m.status === "joined" && !crewInvites.some(inv => inv.crewMemberId === m.id))
                              .map((member) => (
                                <SelectItem key={member.id} value={member.id.toString()}>
                                  {member.firstName} {member.lastName || ""} {member.role ? `(${member.role})` : ""}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          onClick={() => {
                            if (selectedCrewId) {
                              assignCrewMutation.mutate(parseInt(selectedCrewId));
                            }
                          }}
                          disabled={!selectedCrewId || assignCrewMutation.isPending}
                          className="h-12 px-6"
                          data-testid="button-assign-crew"
                        >
                          {assignCrewMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Assign"
                          )}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No crew members yet. Add crew members in <span className="text-primary cursor-pointer" onClick={() => navigate("/crew")}>More → Crew</span>.
                    </p>
                  )}
                  
                  {crewInvites.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Assigned Crew
                      </p>
                      {crewInvites.map((invite) => (
                        <div 
                          key={invite.id} 
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                          data-testid={`crew-invite-${invite.id}`}
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="w-4 h-4 text-primary" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">
                                {invite.crewFirstName || "Crew Member"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {invite.crewPhone || invite.crewEmail || "No contact"}
                              </p>
                            </div>
                          </div>
                          <Badge 
                            variant="secondary"
                            className={`text-xs ${
                              invite.status === "confirmed" 
                                ? "bg-emerald-500/10 text-emerald-600" 
                                : invite.status === "declined" 
                                  ? "bg-red-500/10 text-red-600"
                                  : "bg-amber-500/10 text-amber-600"
                            }`}
                          >
                            {invite.status === "confirmed" && <CheckCircle2 className="w-3 h-3 mr-1" />}
                            {invite.status === "declined" && <XCircle className="w-3 h-3 mr-1" />}
                            {invite.status === "pending" && <HelpCircle className="w-3 h-3 mr-1" />}
                            {invite.status === "viewed" && <HelpCircle className="w-3 h-3 mr-1" />}
                            {invite.status.charAt(0).toUpperCase() + invite.status.slice(1)}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}

                  {crewPhotos.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                        <Camera className="h-3 w-3" />
                        Photos from Crew ({crewPhotos.length})
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {crewPhotos.map((photo) => (
                          <a 
                            key={photo.id}
                            href={photo.photoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="aspect-square rounded-lg overflow-hidden bg-muted relative group"
                            data-testid={`crew-photo-${photo.id}`}
                          >
                            <img 
                              src={photo.photoUrl} 
                              alt={photo.caption || "Job photo"} 
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <ExternalLink className="w-5 h-5 text-white" />
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Button 
              type="submit" 
              className="w-full h-14 text-base font-semibold bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90 shadow-lg" 
              disabled={isPending}
              data-testid="button-submit"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  {isEditing ? "Updating..." : "Creating..."}
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5 mr-2" />
                  {isEditing ? "Update Job" : "Create Job"}
                </>
              )}
            </Button>
            
            <div className="h-6" />
          </form>
        </Form>
      </div>

      {id && completedJobData && (
        <GetPaidDialog
          open={showGetPaidDialog}
          onClose={() => {
            setShowGetPaidDialog(false);
            navigate("/jobs");
          }}
          jobId={id}
          jobTitle={completedJobData.title}
          amount={completedJobData.price}
          clientName={completedJobData.clientName}
        />
      )}
    </div>
  );
}
