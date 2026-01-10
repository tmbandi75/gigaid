import { useQuery } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, FileText, ChevronRight, DollarSign, CheckCircle, Clock, Send } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import type { Invoice } from "@shared/schema";

const statusColors: Record<string, string> = {
  draft: "bg-muted/50 text-muted-foreground border-muted",
  sent: "bg-chart-4/10 text-chart-4 border-chart-4/20",
  paid: "bg-chart-3/10 text-chart-3 border-chart-3/20",
};

const statusIcons: Record<string, typeof Clock> = {
  draft: Clock,
  sent: Send,
  paid: CheckCircle,
};

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
  const StatusIcon = statusIcons[invoice.status] || Clock;
  
  return (
    <Link href={`/invoices/${invoice.id}/view`}>
      <Card className="hover-elevate active-elevate-2 cursor-pointer" data-testid={`invoice-card-${invoice.id}`}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-lg bg-chart-4/10 flex items-center justify-center flex-shrink-0">
              <FileText className="h-6 w-6 text-chart-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <h3 className="font-medium text-foreground truncate">
                  #{invoice.invoiceNumber}
                </h3>
                <Badge 
                  variant="outline" 
                  className={`text-[10px] px-1.5 py-0 flex-shrink-0 capitalize ${statusColors[invoice.status]}`}
                >
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {invoice.status}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-2">{invoice.clientName}</p>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{formatDate(invoice.createdAt)}</span>
                <span className="font-semibold text-foreground flex items-center">
                  {formatCurrency(invoice.amount)}
                </span>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-2" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center py-12 text-center px-4">
      <div className="h-20 w-20 rounded-full bg-muted/50 flex items-center justify-center mb-6">
        <FileText className="h-10 w-10 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium text-foreground mb-2">No Invoices Yet</h3>
      <p className="text-muted-foreground mb-6 max-w-xs">
        Create invoices to get paid quickly for your work
      </p>
      <Link href="/invoices/new">
        <Button data-testid="button-add-first-invoice">
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
    <div className="flex flex-col min-h-full" data-testid="page-invoices">
      <TopBar title="Invoices" />
      
      <div className="px-4 py-4">
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Card className="bg-chart-3/10 border-chart-3/20">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="h-4 w-4 text-chart-3" />
                <span className="text-xs text-chart-3 font-medium">Paid</span>
              </div>
              <p className="text-xl font-bold text-foreground" data-testid="text-total-paid">
                {formatCurrency(totalPaid)}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-chart-4/10 border-chart-4/20">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-4 w-4 text-chart-4" />
                <span className="text-xs text-chart-4 font-medium">Pending</span>
              </div>
              <p className="text-xl font-bold text-foreground" data-testid="text-total-pending">
                {formatCurrency(totalPending)}
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={filter} onValueChange={setFilter} className="w-full mb-4">
          <TabsList className="w-full grid grid-cols-4 h-10">
            <TabsTrigger value="all" className="text-xs" data-testid="filter-all">All</TabsTrigger>
            <TabsTrigger value="draft" className="text-xs" data-testid="filter-draft">Draft</TabsTrigger>
            <TabsTrigger value="sent" className="text-xs" data-testid="filter-sent">Sent</TabsTrigger>
            <TabsTrigger value="paid" className="text-xs" data-testid="filter-paid">Paid</TabsTrigger>
          </TabsList>
        </Tabs>
        
        <Link href="/invoices/new">
          <Button className="w-full mb-6 h-12" data-testid="button-add-invoice">
            <Plus className="h-5 w-5 mr-2" />
            Create Invoice
          </Button>
        </Link>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-12 w-12 bg-muted animate-pulse rounded-lg" />
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
      </div>
    </div>
  );
}
