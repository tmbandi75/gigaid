import { useLocation, useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { ArrowLeft, Loader2 } from "lucide-react";
import { PhoneInput } from "@/components/ui/phone-input";
import type { Lead } from "@shared/schema";

const leadFormSchema = z.object({
  clientFirstName: z.string().min(1, "First name is required"),
  clientLastName: z.string().min(1, "Last name is required"),
  clientPhone: z.string().optional(),
  clientEmail: z.string().email().optional().or(z.literal("")),
  serviceType: z.string().min(1, "Service type is required"),
  description: z.string().optional(),
  status: z.string().default("new"),
});

type LeadFormData = z.infer<typeof leadFormSchema>;

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

const statusOptions = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "converted", label: "Converted" },
];

export default function LeadForm() {
  const { id } = useParams<{ id: string }>();
  const isEditing = id && id !== "new";
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: existingLead, isLoading: isLoadingLead } = useQuery<Lead>({
    queryKey: ["/api/leads", id],
    enabled: !!isEditing,
  });

  const form = useForm<LeadFormData>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: {
      clientFirstName: "",
      clientLastName: "",
      clientPhone: "",
      clientEmail: "",
      serviceType: "",
      description: "",
      status: "new",
    },
    values: existingLead ? {
      clientFirstName: existingLead.clientName.split(" ")[0] || "",
      clientLastName: existingLead.clientName.split(" ").slice(1).join(" ") || "",
      clientPhone: existingLead.clientPhone || "",
      clientEmail: existingLead.clientEmail || "",
      serviceType: existingLead.serviceType,
      description: existingLead.description || "",
      status: existingLead.status,
    } : undefined,
  });

  const createMutation = useMutation({
    mutationFn: async (data: LeadFormData) => {
      const payload = {
        clientName: `${data.clientFirstName} ${data.clientLastName}`.trim(),
        clientPhone: data.clientPhone,
        clientEmail: data.clientEmail || undefined,
        serviceType: data.serviceType,
        description: data.description,
        status: data.status,
        userId: "demo-user",
        source: "manual",
      };
      return apiRequest("POST", "/api/leads", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      toast({ title: "Lead created successfully" });
      navigate("/leads");
    },
    onError: () => {
      toast({ title: "Failed to create lead", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: LeadFormData) => {
      const payload = {
        clientName: `${data.clientFirstName} ${data.clientLastName}`.trim(),
        clientPhone: data.clientPhone,
        clientEmail: data.clientEmail || undefined,
        serviceType: data.serviceType,
        description: data.description,
        status: data.status,
      };
      return apiRequest("PATCH", `/api/leads/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      toast({ title: "Lead updated successfully" });
      navigate("/leads");
    },
    onError: () => {
      toast({ title: "Failed to update lead", variant: "destructive" });
    },
  });

  const onSubmit = (data: LeadFormData) => {
    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  if (isEditing && isLoadingLead) {
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
    <div className="flex flex-col min-h-full" data-testid="page-lead-form">
      <TopBar title={isEditing ? "Edit Lead" : "New Lead"} showActions={false} />
      
      <div className="px-4 py-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/leads")}
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
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="clientFirstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="John" 
                            {...field} 
                            data-testid="input-first-name"
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
                        <FormLabel>Last Name</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Doe" 
                            {...field} 
                            data-testid="input-last-name"
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
                      <FormLabel>Phone (optional)</FormLabel>
                      <FormControl>
                        <PhoneInput
                          value={field.value || ""}
                          onChange={field.onChange}
                          data-testid="input-phone"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="clientEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email (optional)</FormLabel>
                      <FormControl>
                        <Input 
                          type="email"
                          placeholder="john@example.com"
                          {...field}
                          data-testid="input-email"
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
                <FormField
                  control={form.control}
                  name="serviceType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Service Needed</FormLabel>
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
                      <FormLabel>Notes (optional)</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="What does the client need help with?"
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
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-status">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {statusOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
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
                isEditing ? "Update Lead" : "Add Lead"
              )}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
