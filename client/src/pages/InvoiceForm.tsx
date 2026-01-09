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
import { ArrowLeft, Loader2, Send, CheckCircle } from "lucide-react";
import type { Invoice } from "@shared/schema";

const invoiceFormSchema = z.object({
  clientName: z.string().min(1, "Client name is required"),
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

  const { data: existingInvoice, isLoading: isLoadingInvoice } = useQuery<Invoice>({
    queryKey: ["/api/invoices", id],
    enabled: !!isEditing,
  });

  const form = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: {
      clientName: "",
      clientEmail: "",
      clientPhone: "",
      serviceDescription: "",
      amount: undefined,
    },
    values: existingInvoice ? {
      clientName: existingInvoice.clientName,
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
        ...data,
        invoiceNumber,
        userId: "demo-user",
        amount: data.amount * 100,
        clientEmail: data.clientEmail || undefined,
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
        ...data,
        amount: data.amount * 100,
        clientEmail: data.clientEmail || undefined,
      };
      return apiRequest("PATCH", `/api/invoices/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", id] });
      toast({ title: "Invoice updated successfully" });
      navigate("/invoices");
    },
    onError: () => {
      toast({ title: "Failed to update invoice", variant: "destructive" });
    },
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/invoices/${id}/send`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", id] });
      toast({ title: "Invoice sent successfully" });
    },
    onError: () => {
      toast({ title: "Failed to send invoice", variant: "destructive" });
    },
  });

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
      
      <div className="px-4 py-4">
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
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h3 className="font-medium text-foreground">Client Details</h3>
                
                <FormField
                  control={form.control}
                  name="clientName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client Name</FormLabel>
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
                        <Input 
                          type="tel"
                          placeholder="(555) 123-4567"
                          {...field}
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
                          className="resize-none"
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
                isEditing ? "Update Invoice" : "Create Invoice"
              )}
            </Button>
          </form>
        </Form>

        {isEditing && existingInvoice && (
          <div className="mt-6 space-y-3">
            {existingInvoice.status === "draft" && (
              <Button 
                variant="outline"
                className="w-full h-12"
                onClick={() => sendMutation.mutate()}
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
    </div>
  );
}
