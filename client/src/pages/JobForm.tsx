import { useState, useEffect } from "react";
import { useLocation, useParams, useSearch } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ArrowLeft, Loader2, Sparkles, Calendar, Clock } from "lucide-react";
import { PhoneInput } from "@/components/ui/phone-input";
import type { Job, InsertJob } from "@shared/schema";

interface ScheduleSuggestion {
  date: string;
  time: string;
  reason: string;
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
  clientName: z.string().optional(),
  clientPhone: z.string().optional(),
  status: z.string().optional(),
});

type JobFormData = z.infer<typeof jobFormSchema>;

const serviceTypes = [
  { value: "plumbing", label: "Plumbing" },
  { value: "electrical", label: "Electrical" },
  { value: "cleaning", label: "Cleaning" },
  { value: "hvac", label: "HVAC" },
  { value: "painting", label: "Painting" },
  { value: "carpentry", label: "Carpentry" },
  { value: "landscaping", label: "Landscaping" },
  { value: "general", label: "General Maintenance" },
];

const jobStatuses = [
  { value: "scheduled", label: "Scheduled" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export default function JobForm() {
  const { id } = useParams<{ id: string }>();
  const isEditing = id && id !== "new";
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showSuggestions, setShowSuggestions] = useState(false);

  const urlParams = new URLSearchParams(searchString);
  const prefillData = {
    serviceType: urlParams.get("serviceType") || "",
    date: urlParams.get("date") || "",
    time: urlParams.get("time") || "",
    clientName: urlParams.get("clientName") || "",
    clientPhone: urlParams.get("clientPhone") || "",
    description: urlParams.get("description") || "",
    duration: urlParams.get("duration") ? parseInt(urlParams.get("duration")!) : undefined,
    price: urlParams.get("price") ? parseInt(urlParams.get("price")!) / 100 : undefined,
  };

  const { data: existingJob, isLoading: isLoadingJob } = useQuery<Job>({
    queryKey: ["/api/jobs", id],
    enabled: !!isEditing,
  });

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
      clientName: prefillData.clientName || "",
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
      clientName: existingJob.clientName || "",
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
      const payload = {
        ...data,
        userId: "demo-user",
        price: data.price ? data.price * 100 : undefined,
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
    mutationFn: async (data: JobFormData) => {
      const payload = {
        ...data,
        price: data.price ? data.price * 100 : undefined,
        status: data.status,
      };
      return apiRequest("PATCH", `/api/jobs/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      toast({ title: "Job updated successfully" });
      navigate("/jobs");
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
      <div className="flex flex-col min-h-full">
        <TopBar title="Loading..." showActions={false} />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full" data-testid="page-job-form">
      <TopBar title={isEditing ? "Edit Job" : "New Job"} showActions={false} />
      
      <div className="px-4 py-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/jobs")}
          className="mb-4 -ml-2"
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Job Title</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g., Fix bathroom sink" 
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
                      <FormLabel>Service Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-service-type">
                            <SelectValue placeholder="Select service type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {serviceTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
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
                      <FormLabel>Description (optional)</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Job details..."
                          className="resize-none"
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
                        <FormLabel>Job Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-status">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {jobStatuses.map((status) => (
                              <SelectItem key={status.value} value={status.value}>
                                {status.label}
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

            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-foreground">Schedule</h3>
                  {!isEditing && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleGetSuggestions}
                      disabled={suggestionsMutation.isPending}
                      data-testid="button-get-suggestions"
                    >
                      {suggestionsMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4 mr-1" />
                      )}
                      Suggest Times
                    </Button>
                  )}
                </div>

                {showSuggestions && suggestionsMutation.data?.suggestions && (
                  <Card className="bg-muted/50" data-testid="card-suggestions">
                    <CardHeader className="py-3 px-4">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        AI-Suggested Time Slots
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 space-y-2">
                      {suggestionsMutation.data.suggestions.map((suggestion, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 bg-background rounded-md border hover-elevate cursor-pointer"
                          onClick={() => handleSelectSuggestion(suggestion)}
                          data-testid={`suggestion-slot-${index}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <Calendar className="h-3 w-3 text-muted-foreground" />
                                <span className="text-sm font-medium">{formatDate(suggestion.date)}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Clock className="h-3 w-3 text-muted-foreground" />
                                <span className="text-sm">{formatTime(suggestion.time)}</span>
                              </div>
                            </div>
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            Select
                          </Badge>
                        </div>
                      ))}
                      <p className="text-xs text-muted-foreground mt-2">
                        Tap a slot to use it
                      </p>
                    </CardContent>
                  </Card>
                )}

                {suggestionsMutation.isError && (
                  <p className="text-sm text-destructive">
                    Failed to get suggestions. Please try again.
                  </p>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="scheduledDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date</FormLabel>
                        <FormControl>
                          <Input 
                            type="date" 
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
                        <FormLabel>Time</FormLabel>
                        <FormControl>
                          <Input 
                            type="time" 
                            {...field} 
                            data-testid="input-time"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="duration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duration (minutes)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="60"
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
                      <FormLabel>Location (optional)</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="123 Main St, City"
                          {...field}
                          data-testid="input-location"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6 space-y-4">
                <h3 className="font-medium text-foreground">Client & Payment</h3>
                
                <FormField
                  control={form.control}
                  name="clientName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client Name (optional)</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="John Doe"
                          {...field}
                          data-testid="input-client-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="clientPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client Phone (optional)</FormLabel>
                      <FormControl>
                        <PhoneInput
                          value={field.value || ""}
                          onChange={field.onChange}
                          data-testid="input-client-phone"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price ($) (optional)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number"
                          placeholder="150"
                          {...field}
                          data-testid="input-price"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Button 
              type="submit" 
              className="w-full h-12" 
              disabled={isPending}
              data-testid="button-submit"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {isEditing ? "Updating..." : "Creating..."}
                </>
              ) : (
                isEditing ? "Update Job" : "Create Job"
              )}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
