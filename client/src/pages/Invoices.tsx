import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  FileText, 
  ChevronRight, 
  DollarSign, 
  CheckCircle, 
  Clock, 
  Send,
  TrendingUp,
  AlertCircle
} from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import type { Invoice } from "@shared/schema";

const statusConfig: Record<string, { color: string; bg: string; icon: typeof Clock; label: string }> = {
  draft: { color: "text-gray-600", bg: "bg-gray-500/10", icon: Clock, label: "Draft" },
  sent: { color: "text-amber-600", bg: "bg-amber-500/10", icon: Send, label: "Sent" },
  paid: { color: "text-emerald-600", bg: "bg-emerald-500/10", icon: CheckCircle, label: "Paid" },
};

const filters = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Pending" },
  { value: "paid", label: "Paid" },
];

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function InvoiceCard({ invoice }: { invoice: Invoice }) {
  const config = statusConfig[invoice.status] || statusConfig.draft;
  const StatusIcon = config.icon;
  
  return (
    <Link href={`/invoices/${invoice.id}/view`} data-testid={`link-invoice-${invoice.id}`}>
      <Card className="border-0 shadow-sm hover-elevate cursor-pointer overflow-hidden" data-testid={`invoice-card-${invoice.id}`}>
        <CardContent className="p-0">
          <div className="flex">
            <div className={`w-1 ${invoice.status === "paid" ? "bg-emerald-500" : invoice.status === "sent" ? "bg-amber-500" : "bg-gray-400"}`} />
            <div className="flex-1 p-4">
              <div className="flex items-start gap-3">
                <div className={`h-12 w-12 rounded-xl ${config.bg} flex items-center justify-center flex-shrink-0`}>
                  <FileText className={`h-5 w-5 ${config.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h3 className="font-semibold text-foreground truncate">
                      #{invoice.invoiceNumber}
                    </h3>
                    <Badge 
                      variant="secondary" 
                      className={`text-[10px] px-2 py-0.5 flex-shrink-0 ${config.bg} ${config.color} border-0`}
                    >
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {config.label}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{invoice.clientName}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{formatDate(invoice.createdAt)}</span>
                    <span className="text-base font-bold text-foreground">
                      {formatCurrency(invoice.amount)}
                    </span>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground/50 flex-shrink-0 mt-2" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center py-12 text-center px-4">
      <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center mb-6">
        <FileText className="h-10 w-10 text-blue-600" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">No Invoices Yet</h3>
      <p className="text-muted-foreground mb-6 max-w-xs">
        Create invoices to get paid quickly for your work
      </p>
      <Link href="/invoices/new">
        <Button className="bg-gradient-to-r from-blue-500 to-cyan-500" data-testid="button-add-first-invoice">
          <Plus className="h-4 w-4 mr-2" />
          Create Your First Invoice
        </Button>
      </Link>
    </div>
  );
}

export default function Invoices() {
  const [filter, setFilter] = useState<string>("all");
  
  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
  });

  const filteredInvoices = filter === "all" 
    ? invoices 
    : invoices.filter(inv => inv.status === filter);

  const totalPaid = invoices
    .filter(inv => inv.status === "paid")
    .reduce((sum, inv) => sum + inv.amount, 0);

  const totalPending = invoices
    .filter(inv => inv.status === "sent")
    .reduce((sum, inv) => sum + inv.amount, 0);

  return (
    <div className="flex flex-col min-h-full bg-background" data-testid="page-invoices">
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-500 via-blue-600 to-cyan-600 text-white px-4 pt-6 pb-8">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 -left-10 w-32 h-32 bg-cyan-400/20 rounded-full blur-2xl" />
        </div>
        
        <div className="relative">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold">Invoices</h1>
              <p className="text-sm text-white/80">Track your payments</p>
            </div>
            <Link href="/invoices/new">
              <Button size="icon" className="bg-white/20 hover:bg-white/30 text-white" data-testid="button-add-invoice-header">
                <Plus className="h-5 w-5" />
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/15 backdrop-blur rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="h-4 w-4 text-white/80" />
                <span className="text-xs text-white/80">Paid</span>
              </div>
              <p className="text-2xl font-bold" data-testid="text-total-paid">{formatCurrency(totalPaid)}</p>
            </div>
            <div className="bg-white/15 backdrop-blur rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle className="h-4 w-4 text-white/80" />
                <span className="text-xs text-white/80">Pending</span>
              </div>
              <p className="text-2xl font-bold" data-testid="text-total-pending">{formatCurrency(totalPending)}</p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex-1 px-4 py-6 -mt-4">
        <Card className="border-0 shadow-md mb-4 overflow-hidden">
          <CardContent className="p-1">
            <div className="flex gap-1">
              {filters.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
                    filter === f.value
                      ? "bg-blue-500 text-white shadow-sm"
                      : "text-muted-foreground hover:bg-muted/50"
                  }`}
                  data-testid={`filter-${f.value}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Link href="/invoices/new">
          <Button className="w-full mb-6 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 shadow-lg" data-testid="button-add-invoice">
            <Plus className="h-5 w-5 mr-2" />
            Create Invoice
          </Button>
        </Link>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-12 w-12 bg-muted animate-pulse rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                      <div className="h-3 w-32 bg-muted animate-pulse rounded" />
                      <div className="h-3 w-20 bg-muted animate-pulse rounded" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredInvoices.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-3">
            {filteredInvoices.map((invoice) => (
              <InvoiceCard key={invoice.id} invoice={invoice} />
            ))}
          </div>
        )}
        
        <div className="h-6" />
      </div>
    </div>
  );
}
