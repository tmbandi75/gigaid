import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreHorizontal,
  Edit,
  Trash2,
  Send,
  Download,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Invoice } from "@shared/schema";

interface InvoicesTableViewProps {
  invoices: Invoice[];
  isLoading?: boolean;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function isOverdue(createdAt: string, status: string): boolean {
  if (status === "paid") return false;
  const created = new Date(createdAt);
  const dueDate = new Date(created);
  dueDate.setDate(dueDate.getDate() + 30);
  return dueDate < new Date();
}

function getDueDate(createdAt: string): string {
  const created = new Date(createdAt);
  const dueDate = new Date(created);
  dueDate.setDate(dueDate.getDate() + 30);
  return dueDate.toISOString();
}

const statusConfig: Record<string, { color: string; bg: string; label: string; icon: typeof Clock }> = {
  draft: { color: "text-gray-600", bg: "bg-gray-500/10", label: "Draft", icon: Clock },
  sent: { color: "text-blue-600", bg: "bg-blue-500/10", label: "Sent", icon: Send },
  paid: { color: "text-emerald-600", bg: "bg-emerald-500/10", label: "Paid", icon: CheckCircle2 },
  overdue: { color: "text-red-600", bg: "bg-red-500/10", label: "Overdue", icon: AlertCircle },
};

function InvoiceTableRow({ invoice }: { invoice: Invoice }) {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const isInvoiceOverdue = isOverdue(invoice.createdAt, invoice.status);
  const calculatedDueDate = getDueDate(invoice.createdAt);
  const effectiveStatus = isInvoiceOverdue ? "overdue" : invoice.status;
  const config = statusConfig[effectiveStatus] || statusConfig.draft;

  const sendInvoiceMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/invoices/${invoice.id}/send`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Invoice sent!", description: "Your client has been notified." });
    },
    onError: () => {
      toast({ title: "Failed to send invoice", variant: "destructive" });
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", `/api/invoices/${invoice.id}`, { status: "paid" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Invoice marked as paid" });
    },
  });

  return (
    <tr
      className="border-b last:border-b-0 transition-colors hover:bg-muted/30 cursor-pointer"
      onClick={() => navigate(`/invoices/${invoice.id}`)}
      data-testid={`table-row-invoice-${invoice.id}`}
    >
      <td className="px-4 py-4">
        <div className="flex flex-col">
          <span className="font-medium text-foreground">#{invoice.invoiceNumber || invoice.id.slice(0, 8)}</span>
          <span className="text-sm text-muted-foreground">{invoice.clientName}</span>
        </div>
      </td>
      <td className="px-4 py-4">
        <span className="font-semibold text-foreground">{formatCurrency(invoice.amount)}</span>
      </td>
      <td className="px-4 py-4">
        <span className="text-sm text-muted-foreground">{formatDate(invoice.createdAt)}</span>
      </td>
      <td className="px-4 py-4">
        <span className={`text-sm ${isInvoiceOverdue ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
          {formatDate(calculatedDueDate)}
        </span>
      </td>
      <td className="px-4 py-4">
        <Badge variant="secondary" className={`text-xs ${config.bg} ${config.color} border-0`}>
          <config.icon className="h-3 w-3 mr-1" />
          {config.label}
        </Badge>
      </td>
      <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 justify-end">
          {invoice.status === "draft" && (
            <Button
              size="sm"
              onClick={() => sendInvoiceMutation.mutate()}
              disabled={sendInvoiceMutation.isPending}
              className="h-8"
            >
              {sendInvoiceMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <>
                  <Send className="h-3 w-3 mr-1" />
                  Send
                </>
              )}
            </Button>
          )}
          {(invoice.status === "sent" || isInvoiceOverdue) && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => markPaidMutation.mutate()}
              disabled={markPaidMutation.isPending}
              className="h-8"
            >
              {markPaidMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Mark Paid
                </>
              )}
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate(`/invoices/${invoice.id}`)}>
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate(`/invoices/${invoice.id}/edit`)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </td>
    </tr>
  );
}

export function InvoicesTableView({ invoices, isLoading }: InvoicesTableViewProps) {
  if (isLoading) {
    return (
      <Card className="border shadow-sm">
        <div className="animate-pulse">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4 border-b last:border-b-0">
              <div className="h-4 bg-muted rounded flex-1" />
              <div className="h-4 bg-muted rounded w-24" />
              <div className="h-4 bg-muted rounded w-32" />
              <div className="h-4 bg-muted rounded w-20" />
              <div className="h-4 bg-muted rounded w-16" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (invoices.length === 0) {
    return null;
  }

  return (
    <Card className="border shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                Invoice
              </th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                Amount
              </th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                Created
              </th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                Due Date
              </th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                Status
              </th>
              <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 w-32">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => (
              <InvoiceTableRow key={invoice.id} invoice={invoice} />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
