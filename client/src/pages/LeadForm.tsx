import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { apiFetch } from "@/lib/apiFetch";
import { useApiMutation } from "@/hooks/useApiMutation";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { ArrowLeft, Loader2, DollarSign, Send, Check, Clock, Eye, ExternalLink, UserPlus } from "lucide-react";
import { PhoneInput } from "@/components/ui/phone-input";
import { ServiceTypeSelect } from "@/components/ui/service-type-select";
import type { Lead, PriceConfirmation } from "@shared/schema";
import { ReplyComposer } from "@/components/lead/ReplyComposer";
import { useUpgradeOrchestrator, UpgradeBanner, UpgradeNudgeModal } from "@/upgrade";

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


const statusOptions = [
  { value: "new", label: "New" },
  { value: "response_sent", label: "Contacted" },
  { value: "engaged", label: "Engaged" },
  { value: "price_confirmed", label: "Price Confirmed" },
  { value: "cold", label: "Cold" },
  { value: "lost", label: "Lost" },
];

export default function LeadForm() {
  const { id } = useParams<{ id: string }>();
  const isEditing = id && id !== "new";
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [priceDialogOpen, setPriceDialogOpen] = useState(false);
  const [priceAmount, setPriceAmount] = useState("");
  const [priceNotes, setPriceNotes] = useState("");
  const priceConfirmUpgrade = useUpgradeOrchestrator({ capabilityKey: 'price.confirmation', surface: 'leads' });

  const { data: existingLead, isLoading: isLoadingLead } = useQuery<Lead>({
    queryKey: QUERY_KEYS.leads.detail(id!),
    enabled: !!isEditing,
  });

  const { data: activePriceConfirmation, isLoading: isLoadingPC } = useQuery<PriceConfirmation | null>({
    queryKey: QUERY_KEYS.leadPriceConfirmation(id!),
    queryFn: async () => {
      try {
        return await apiFetch(`/api/leads/${id}/active-price-confirmation`);
      } catch (e: any) {
        if (e?.statusCode === 404) return null;
        throw e;
      }
    },
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

  const createMutation = useApiMutation(
    async (data: LeadFormData) => {
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
      return apiFetch("/api/leads", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    [QUERY_KEYS.leads(), QUERY_KEYS.dashboardSummary()],
    {
      onSuccess: () => {
        toast({ title: "Lead created successfully" });
        navigate("/leads");
      },
      onError: () => {
        toast({ title: "Failed to create lead", variant: "destructive" });
      },
    }
  );

  const updateMutation = useApiMutation(
    async (data: LeadFormData) => {
      const payload = {
        clientName: `${data.clientFirstName} ${data.clientLastName}`.trim(),
        clientPhone: data.clientPhone,
        clientEmail: data.clientEmail || undefined,
        serviceType: data.serviceType,
        description: data.description,
        status: data.status,
      };
      return apiFetch(`/api/leads/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    },
    [QUERY_KEYS.leads(), QUERY_KEYS.leads.detail(id!), QUERY_KEYS.dashboardSummary()],
    {
      onSuccess: () => {
        toast({ title: "Lead updated successfully" });
        navigate(`/leads/${id}`);
      },
      onError: () => {
        toast({ title: "Failed to update lead", variant: "destructive" });
      },
    }
  );

  const sendPriceConfirmationMutation = useApiMutation(
    async () => {
      const parsedAmount = parseFloat(priceAmount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        throw new Error("Please enter a valid price greater than $0");
      }
      const priceInCents = Math.round(parsedAmount * 100);
      
      const confirmation = await apiFetch<{ id: string }>("/api/price-confirmations", {
        method: "POST",
        body: JSON.stringify({
          leadId: id,
          serviceType: existingLead?.serviceType,
          agreedPrice: priceInCents,
          notes: priceNotes || null,
        }),
      });
      
      return apiFetch(`/api/price-confirmations/${confirmation.id}/send`, {
        method: "POST",
      });
    },
    [QUERY_KEYS.leadPriceConfirmation(id!)],
    {
      onSuccess: (data: any) => {
        setPriceDialogOpen(false);
        setPriceAmount("");
        setPriceNotes("");
        
        const sentVia = [];
        if (data.smsSent) sentVia.push("SMS");
        if (data.emailSent) sentVia.push("Email");
        
        toast({ 
          title: "Price Confirmation Sent",
          description: sentVia.length > 0 
            ? `Sent via ${sentVia.join(" and ")}`
            : "Link created - share it with your client",
        });
        priceConfirmUpgrade.maybeShowPostSuccess();
      },
      onError: () => {
        toast({ title: "Failed to send price confirmation", variant: "destructive" });
      },
    }
  );

  const resendConfirmationMutation = useApiMutation(
    async () => {
      if (!activePriceConfirmation) throw new Error("No confirmation to resend");
      return apiFetch(`/api/price-confirmations/${activePriceConfirmation.id}/send`, {
        method: "POST",
      });
    },
    [QUERY_KEYS.leadPriceConfirmation(id!)],
    {
      onSuccess: (data: any) => {
        const sentVia = [];
        if (data.smsSent) sentVia.push("SMS");
        if (data.emailSent) sentVia.push("Email");
        toast({ 
          title: "Price Confirmation Resent",
          description: sentVia.length > 0 
            ? `Sent via ${sentVia.join(" and ")}`
            : "Link refreshed",
        });
      },
      onError: () => {
        toast({ title: "Failed to resend confirmation", variant: "destructive" });
      },
    }
  );

  const onSubmit = (data: LeadFormData) => {
    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const renderMobileHeader = () => (
    <TopBar title={isEditing ? "Edit Lead" : "New Lead"} showActions={false} />
  );

  const renderDesktopHeader = () => (
    <div className="border-b bg-background sticky top-0 z-[999]">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-5 flex items-center gap-4">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
          <UserPlus className="h-6 w-6 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">
          {isEditing ? "Edit Lead" : "New Lead"}
        </h1>
      </div>
    </div>
  );

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
      {isMobile ? renderMobileHeader() : renderDesktopHeader()}
      
      <div className={`flex-1 ${isMobile ? "px-4 py-4" : "px-6 lg:px-8 lg:max-w-7xl lg:mx-auto"} ${isMobile ? "pb-6" : "pb-12"}`}>
        {isMobile && (
          <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(isEditing ? `/leads/${id}` : "/leads")}
              className="-ml-2"
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            
            {isEditing && existingLead?.sourceUrl && (
              <a href={existingLead.sourceUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="default" size="sm" className="bg-blue-600" data-testid="button-open-source">
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Open original post
                </Button>
              </a>
            )}
          </div>
        )}

        {!isEditing && priceConfirmUpgrade.bannerPayload && (
          <div className="mb-4">
            <UpgradeBanner
              capabilityKey={priceConfirmUpgrade.bannerPayload.capabilityKey}
              remaining={priceConfirmUpgrade.bannerPayload.remaining}
              limit={priceConfirmUpgrade.bannerPayload.limit}
              current={priceConfirmUpgrade.bannerPayload.current}
              variant={priceConfirmUpgrade.variant}
              thresholdLevel={priceConfirmUpgrade.bannerPayload.thresholdLevel || "warn"}
              surface="leads"
              plan={priceConfirmUpgrade.bannerPayload.plan}
              recommendedPlan={priceConfirmUpgrade.bannerPayload.recommendedPlan}
            />
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <h3 className="font-medium text-foreground">Client Details</h3>
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
                  <h3 className="font-medium text-foreground">Service Details</h3>
                  <FormField
                    control={form.control}
                    name="serviceType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Service Needed</FormLabel>
                        <FormControl>
                          <ServiceTypeSelect
                            value={field.value}
                            onValueChange={field.onChange}
                            placeholder="Select service type"
                            data-testid="select-service-type"
                          />
                        </FormControl>
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
                            className="resize-none min-h-[100px]"
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
            </div>

            <div className="lg:flex lg:justify-end">
              <Button 
                type="submit" 
                className="w-full lg:w-auto lg:min-w-[200px]" 
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
            </div>
          </form>
        </Form>

        {/* Reply Composer - only show when editing */}
        {isEditing && existingLead && (
          <div className="mt-6">
            <ReplyComposer lead={existingLead} />
          </div>
        )}

        {/* Price Confirmation Section - only show when editing */}
        {isEditing && existingLead && existingLead.status !== "converted" && (
          <Card className="mt-6">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <DollarSign className="h-5 w-5" />
                Price Confirmation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoadingPC ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : activePriceConfirmation ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <Badge 
                      variant={
                        activePriceConfirmation.status === "confirmed" ? "default" :
                        activePriceConfirmation.status === "viewed" ? "secondary" :
                        activePriceConfirmation.status === "sent" ? "outline" :
                        "outline"
                      }
                      data-testid="badge-pc-status"
                    >
                      {activePriceConfirmation.status === "confirmed" && <Check className="h-3 w-3 mr-1" />}
                      {activePriceConfirmation.status === "viewed" && <Eye className="h-3 w-3 mr-1" />}
                      {activePriceConfirmation.status === "sent" && <Clock className="h-3 w-3 mr-1" />}
                      {activePriceConfirmation.status.charAt(0).toUpperCase() + activePriceConfirmation.status.slice(1)}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Price</span>
                    <span className="font-medium" data-testid="text-pc-price">
                      ${(activePriceConfirmation.agreedPrice / 100).toFixed(2)}
                    </span>
                  </div>
                  {activePriceConfirmation.status !== "confirmed" && (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => resendConfirmationMutation.mutate()}
                      disabled={resendConfirmationMutation.isPending}
                      data-testid="button-resend-pc"
                    >
                      {resendConfirmationMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      Resend to Client
                    </Button>
                  )}
                  {activePriceConfirmation.status === "confirmed" && activePriceConfirmation.convertedJobId && (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => navigate(`/jobs/${activePriceConfirmation.convertedJobId}`)}
                      data-testid="button-view-job"
                    >
                      View Created Job
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Send a price quote to {existingLead.clientName} for quick approval
                  </p>
                  <Button
                    type="button"
                    variant="default"
                    className="w-full"
                    onClick={() => setPriceDialogOpen(true)}
                    data-testid="button-send-price"
                  >
                    <DollarSign className="h-4 w-4 mr-2" />
                    Send Price Confirmation
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Price Confirmation Dialog */}
        <Dialog open={priceDialogOpen} onOpenChange={setPriceDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Send Price Confirmation</DialogTitle>
              <DialogDescription>
                Enter the agreed price for {existingLead?.clientName}. They'll receive a link to confirm.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="price-input">Price</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    id="price-input"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="pl-7"
                    value={priceAmount}
                    onChange={(e) => setPriceAmount(e.target.value)}
                    data-testid="input-price-amount"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="price-notes">Notes (optional)</label>
                <Textarea
                  id="price-notes"
                  placeholder="Any details about the service..."
                  className="resize-none"
                  value={priceNotes}
                  onChange={(e) => setPriceNotes(e.target.value)}
                  data-testid="input-price-notes"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPriceDialogOpen(false)}
                data-testid="button-cancel-price"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => sendPriceConfirmationMutation.mutate()}
                disabled={!priceAmount || parseFloat(priceAmount) <= 0 || sendPriceConfirmationMutation.isPending}
                data-testid="button-confirm-send-price"
              >
                {sendPriceConfirmationMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Send to Client
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      {priceConfirmUpgrade.modalPayload && (
        <UpgradeNudgeModal
          open={priceConfirmUpgrade.showModal}
          onOpenChange={priceConfirmUpgrade.dismissModal}
          title={priceConfirmUpgrade.modalPayload.title}
          subtitle={priceConfirmUpgrade.modalPayload.subtitle}
          bullets={priceConfirmUpgrade.modalPayload.bullets}
          primaryCta={priceConfirmUpgrade.modalPayload.primaryCta}
          secondaryCta={priceConfirmUpgrade.modalPayload.secondaryCta}
          variant={priceConfirmUpgrade.variant}
          triggerType={priceConfirmUpgrade.modalPayload.triggerType}
          capabilityKey={priceConfirmUpgrade.modalPayload.capabilityKey}
          surface="leads"
          plan={priceConfirmUpgrade.modalPayload.plan}
          current={priceConfirmUpgrade.modalPayload.current}
          limit={priceConfirmUpgrade.modalPayload.limit}
          remaining={priceConfirmUpgrade.modalPayload.remaining}
          recommendedPlan={priceConfirmUpgrade.modalPayload.recommendedPlan}
        />
      )}
      </div>
    </div>
  );
}
