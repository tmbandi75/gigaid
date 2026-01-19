import { useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Loader2, Send, CheckCircle, Mail, MessageSquare, AlertTriangle } from "lucide-react";
import { PhoneInput } from "@/components/ui/phone-input";
import type { Invoice } from "@shared/schema";

const invoiceFormSchema = z.object({
  clientFirstName: z.string().min(1, "First name is required"),
  clientLastName: z.string().min(1, "Last name is required"),
  clientEmail: z.string().email().optional().or(z.literal("")),
  clientPhone: z.string().optional(),
  serviceDescription: z.string().min(1, "Service description is required"),
  amount: z.coerce.number().min(1, "Amount must be at least $1"),
});

type InvoiceFormData = z.infer<typeof invoiceFormSchema>;

const paymentMethods = [
  { value: "cash", label: "Cash" },
  { value: "zelle", label: "Zelle" },
  { value: "venmo", label: "Venmo" },
  { value: "other", label: "Other" },
];

export default function InvoiceForm() {
  const { id } = useParams<{ id: string }>();
  const isEditing = id && id !== "new";
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [sendViaEmail, setSendViaEmail] = useState(true);
  const [sendViaSms, setSendViaSms] = useState(true);

  const { data: existingInvoice, isLoading: isLoadingInvoice } = useQuery<Invoice>({
    queryKey: ["/api/invoices", id],
    enabled: !!isEditing,
  });

  const hasEmail = !!(existingInvoice?.clientEmail);
  const hasPhone = !!(existingInvoice?.clientPhone);
  const hasBothChannels = hasEmail && hasPhone;
  const hasAnyChannel = hasEmail || hasPhone;

  const form = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: {
      clientFirstName: "",
      clientLastName: "",
      clientEmail: "",
      clientPhone: "",
      serviceDescription: "",
      amount: undefined,
    },
    values: existingInvoice ? {
      clientFirstName: existingInvoice.clientName.split(" ")[0] || "",
      clientLastName: existingInvoice.clientName.split(" ").slice(1).join(" ") || "",
      clientEmail: existingInvoice.clientEmail || "",
      clientPhone: existingInvoice.clientPhone || "",
      serviceDescription: existingInvoice.serviceDescription,
      amount: existingInvoice.amount / 100,
    } : undefined,
  });

  const createMutation = useMutation({
    mutationFn: async (data: InvoiceFormData) => {
      const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`;
      const payload = {
        clientName: `${data.clientFirstName} ${data.clientLastName}`.trim(),
        clientPhone: data.clientPhone,
        clientEmail: data.clientEmail || undefined,
        serviceDescription: data.serviceDescription,
        invoiceNumber,
        userId: "demo-user",
        amount: data.amount * 100,
        status: "draft",
      };
      return apiRequest("POST", "/api/invoices", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      toast({ title: "Invoice created successfully" });
      navigate("/invoices");
    },
    onError: () => {
      toast({ title: "Failed to create invoice", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: InvoiceFormData) => {
      const payload = {
        clientName: `${data.clientFirstName} ${data.clientLastName}`.trim(),
        clientPhone: data.clientPhone,
        clientEmail: data.clientEmail || undefined,
        serviceDescription: data.serviceDescription,
        amount: data.amount * 100,
      };
      return apiRequest("PATCH", `/api/invoices/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", id] });
      toast({ title: "Invoice updated successfully" });
      navigate(`/invoices/${id}/view`);
    },
    onError: () => {
      toast({ title: "Failed to update invoice", variant: "destructive" });
    },
  });

  const sendMutation = useMutation({
    mutationFn: async ({ sendEmail, sendSms }: { sendEmail: boolean; sendSms: boolean }) => {
      return apiRequest("POST", `/api/invoices/${id}/send`, { sendEmail, sendSms });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", id] });
      setShowSendDialog(false);
      const channels = [];
      if (sendViaEmail && hasEmail) channels.push("email");
      if (sendViaSms && hasPhone) channels.push("text");
      toast({ title: `Invoice sent via ${channels.join(" and ")}` });
    },
    onError: () => {
      toast({ title: "Failed to send invoice", variant: "destructive" });
    },
  });

  const handleSendClick = () => {
    if (!hasAnyChannel) {
      toast({ 
        title: "No contact information", 
        description: "Please add an email address or phone number to send this invoice.",
        variant: "destructive" 
      });
      return;
    }
    
    if (hasBothChannels) {
      setSendViaEmail(true);
      setSendViaSms(true);
      setShowSendDialog(true);
    } else {
      const channelName = hasEmail ? "email" : "text message";
      if (confirm(`Send invoice via ${channelName}?`)) {
        sendMutation.mutate({ sendEmail: hasEmail, sendSms: hasPhone });
      }
    }
  };

  const handleConfirmSend = () => {
    if (!sendViaEmail && !sendViaSms) {
      toast({ title: "Please select at least one delivery method", variant: "destructive" });
      return;
    }
    sendMutation.mutate({ sendEmail: sendViaEmail, sendSms: sendViaSms });
  };

  const markPaidMutation = useMutation({
    mutationFn: async (paymentMethod: string) => {
      return apiRequest("POST", `/api/invoices/${id}/mark-paid`, { paymentMethod });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      toast({ title: "Invoice marked as paid" });
      navigate("/invoices");
    },
    onError: () => {
      toast({ title: "Failed to mark invoice as paid", variant: "destructive" });
    },
  });

  const onSubmit = (data: InvoiceFormData) => {
    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  if (isEditing && isLoadingInvoice) {
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
    <div className="flex flex-col min-h-full" data-testid="page-invoice-form">
      <TopBar title={isEditing ? `Invoice #${existingInvoice?.invoiceNumber}` : "New Invoice"} showActions={false} />
      
      <div className="px-4 py-4 lg:px-8 lg:max-w-5xl lg:mx-auto">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/invoices")}
          className="mb-4 -ml-2"
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>

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
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6 space-y-4">
                  <h3 className="font-medium text-foreground">Invoice Details</h3>
                  
                  <FormField
                    control={form.control}
                    name="serviceDescription"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Service Description</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Describe the work completed..."
                            className="resize-none min-h-[120px]"
                            {...field}
                            data-testid="input-service-description"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Amount ($)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number"
                            placeholder="150"
                            {...field}
                            data-testid="input-amount"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
                  isEditing ? "Update Invoice" : "Create Invoice"
                )}
              </Button>
            </div>
          </form>
        </Form>

        {isEditing && existingInvoice && (
          <div className="mt-6 space-y-3">
            {existingInvoice.status === "draft" && (
              <Button 
                variant="outline"
                className="w-full h-12"
                onClick={handleSendClick}
                disabled={sendMutation.isPending}
                data-testid="button-send-invoice"
              >
                {sendMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Send Invoice
              </Button>
            )}
            
            {(existingInvoice.status === "draft" || existingInvoice.status === "sent") && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground text-center">Mark as paid:</p>
                <div className="grid grid-cols-2 gap-2">
                  {paymentMethods.map((method) => (
                    <Button
                      key={method.value}
                      variant="outline"
                      size="sm"
                      onClick={() => markPaidMutation.mutate(method.value)}
                      disabled={markPaidMutation.isPending}
                      data-testid={`button-paid-${method.value}`}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      {method.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {existingInvoice.status === "paid" && (
              <Card className="bg-chart-3/10 border-chart-3/20">
                <CardContent className="p-4 flex items-center justify-center gap-2">
                  <CheckCircle className="h-5 w-5 text-chart-3" />
                  <span className="font-medium text-chart-3">
                    Paid via {existingInvoice.paymentMethod || "Unknown"}
                  </span>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      <Dialog open={showSendDialog} onOpenChange={setShowSendDialog}>
        <DialogContent data-testid="dialog-send-invoice">
          <DialogHeader>
            <DialogTitle>Send Invoice</DialogTitle>
            <DialogDescription>
              Choose how you want to send this invoice to {existingInvoice?.clientName}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="flex items-center space-x-3">
              <Checkbox 
                id="send-email"
                checked={sendViaEmail}
                onCheckedChange={(checked) => setSendViaEmail(!!checked)}
                data-testid="checkbox-send-email"
              />
              <Label htmlFor="send-email" className="flex items-center gap-2 cursor-pointer">
                <Mail className="h-4 w-4" />
                <div>
                  <div className="font-medium">Email</div>
                  <div className="text-xs text-muted-foreground">{existingInvoice?.clientEmail}</div>
                </div>
              </Label>
            </div>
            
            <div className="flex items-center space-x-3">
              <Checkbox 
                id="send-sms"
                checked={sendViaSms}
                onCheckedChange={(checked) => setSendViaSms(!!checked)}
                data-testid="checkbox-send-sms"
              />
              <Label htmlFor="send-sms" className="flex items-center gap-2 cursor-pointer">
                <MessageSquare className="h-4 w-4" />
                <div>
                  <div className="font-medium">Text Message</div>
                  <div className="text-xs text-muted-foreground">{existingInvoice?.clientPhone}</div>
                </div>
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowSendDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmSend}
              disabled={sendMutation.isPending || (!sendViaEmail && !sendViaSms)}
              data-testid="button-confirm-send"
            >
              {sendMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
