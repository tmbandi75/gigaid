import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  FileText, 
  ChevronRight, 
  CheckCircle, 
  Clock, 
  Send,
  AlertCircle,
  TrendingUp,
  Sparkles,
  Receipt
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import type { Invoice, AiNudge } from "@shared/schema";
import { NudgeChips } from "@/components/nudges/NudgeChip";
import { NudgeActionSheet } from "@/components/nudges/NudgeActionSheet";

const statusConfig: Record<string, { 
  color: string; 
  bg: string; 
  border: string;
  icon: typeof Clock; 
  label: string;
  gradient: string;
}> = {
  draft: { 
    color: "text-slate-600 dark:text-slate-400", 
    bg: "bg-slate-100 dark:bg-slate-800", 
    border: "border-slate-200 dark:border-slate-700",
    icon: Clock, 
    label: "Draft",
    gradient: "from-slate-400 to-slate-500"
  },
  sent: { 
    color: "text-amber-600 dark:text-amber-400", 
    bg: "bg-amber-50 dark:bg-amber-900/30", 
    border: "border-amber-200 dark:border-amber-800",
    icon: Send, 
    label: "Awaiting Payment",
    gradient: "from-amber-400 to-orange-500"
  },
  paid: { 
    color: "text-emerald-600 dark:text-emerald-400", 
    bg: "bg-emerald-50 dark:bg-emerald-900/30", 
    border: "border-emerald-200 dark:border-emerald-800",
    icon: CheckCircle, 
    label: "Paid",
    gradient: "from-emerald-400 to-teal-500"
  },
};

const filters = [
  { value: "all", label: "All", icon: Receipt },
  { value: "draft", label: "Drafts", icon: Clock },
  { value: "sent", label: "Pending", icon: AlertCircle },
  { value: "paid", label: "Paid", icon: CheckCircle },
];

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function InvoiceCard({ invoice, nudges, onNudgeClick }: { invoice: Invoice; nudges: AiNudge[]; onNudgeClick: (nudge: AiNudge) => void }) {
  const config = statusConfig[invoice.status] || statusConfig.draft;
  const StatusIcon = config.icon;
  const total = invoice.amount + (invoice.tax || 0) - (invoice.discount || 0);
  const invoiceNudges = nudges.filter(n => n.entityType === "invoice" && n.entityId === invoice.id && n.status === "active");
  
  return (
    <Link href={`/invoices/${invoice.id}/view`} data-testid={`link-invoice-${invoice.id}`}>
      <Card className="group border-0 shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer overflow-hidden" data-testid={`invoice-card-${invoice.id}`}>
        <CardContent className="p-0">
          <div className="flex">
            <div className={`w-1.5 bg-gradient-to-b ${config.gradient}`} />
            <div className="flex-1 p-4">
              <div className="flex items-center gap-4">
                <div className={`relative h-14 w-14 rounded-2xl ${config.bg} flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105`}>
                  <FileText className={`h-6 w-6 ${config.color}`} />
                  {invoice.status === "paid" && (
                    <div className="absolute -bottom-1 -right-1 h-5 w-5 bg-emerald-500 rounded-full flex items-center justify-center shadow-sm">
                      <CheckCircle className="h-3 w-3 text-white" />
                    </div>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground">
                        #{invoice.invoiceNumber}
                      </span>
                      <Badge 
                        variant="secondary" 
                        className={`text-[10px] font-medium px-2 py-0.5 ${config.bg} ${config.color} border ${config.border}`}
                      >
                        {config.label}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground truncate font-medium">{invoice.clientName}</p>
                  {invoiceNudges.length > 0 && (
                    <div className="mt-1" onClick={(e) => e.preventDefault()}>
                      <NudgeChips nudges={invoiceNudges} onNudgeClick={onNudgeClick} />
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground/70 mt-0.5">{formatDate(invoice.createdAt)}</p>
                </div>
                
                <div className="text-right flex-shrink-0">
                  <p className="text-xl font-bold text-foreground">
                    {formatCurrency(total)}
                  </p>
                  <ChevronRight className="h-5 w-5 text-muted-foreground/40 ml-auto mt-1 group-hover:text-muted-foreground transition-colors" />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function EmptyState({ filter }: { filter: string }) {
  const messages: Record<string, { title: string; desc: string }> = {
    all: { title: "No Invoices Yet", desc: "Create your first invoice to start getting paid" },
    draft: { title: "No Drafts", desc: "Draft invoices you're working on will appear here" },
    sent: { title: "No Pending Invoices", desc: "Invoices awaiting payment will show here" },
    paid: { title: "No Paid Invoices", desc: "Your payment history will appear here" },
  };
  
  const msg = messages[filter] || messages.all;
  
  return (
    <div className="flex flex-col items-center py-16 text-center px-4">
      <div className="relative mb-6">
        <div className="h-24 w-24 rounded-3xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
          <FileText className="h-12 w-12 text-blue-500" />
        </div>
        <div className="absolute -bottom-2 -right-2 h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
      </div>
      <h3 className="text-xl font-bold text-foreground mb-2">{msg.title}</h3>
      <p className="text-muted-foreground mb-8 max-w-xs">
        {msg.desc}
      </p>
      <Link href="/invoices/new">
        <Button size="lg" className="bg-gradient-to-r from-blue-500 to-cyan-500 shadow-lg shadow-blue-500/25 h-12 px-6" data-testid="button-add-first-invoice">
          <Plus className="h-5 w-5 mr-2" />
          Create Invoice
        </Button>
      </Link>
    </div>
  );
}

export default function Invoices() {
  const [filter, setFilter] = useState<string>("all");
  const [selectedNudge, setSelectedNudge] = useState<AiNudge | null>(null);
  const [, navigate] = useLocation();
  
  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
  });

  const { data: nudges = [] } = useQuery<AiNudge[]>({
    queryKey: ["/api/nudges"],
  });

  const filteredInvoices = filter === "all" 
    ? invoices 
    : invoices.filter(inv => inv.status === filter);

  const stats = {
    total: invoices.reduce((sum, inv) => sum + inv.amount + (inv.tax || 0) - (inv.discount || 0), 0),
    paid: invoices.filter(inv => inv.status === "paid").reduce((sum, inv) => sum + inv.amount + (inv.tax || 0) - (inv.discount || 0), 0),
    pending: invoices.filter(inv => inv.status === "sent").reduce((sum, inv) => sum + inv.amount + (inv.tax || 0) - (inv.discount || 0), 0),
    count: { all: invoices.length, draft: invoices.filter(i => i.status === "draft").length, sent: invoices.filter(i => i.status === "sent").length, paid: invoices.filter(i => i.status === "paid").length }
  };

  return (
    <div className="flex flex-col min-h-full bg-background" data-testid="page-invoices">
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-500 via-blue-600 to-cyan-600 text-white px-4 md:px-6 lg:px-8 pt-6 pb-6">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 -right-20 w-60 h-60 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute top-10 -left-20 w-40 h-40 bg-cyan-400/20 rounded-full blur-2xl" />
          <div className="absolute bottom-0 right-10 w-32 h-32 bg-blue-300/10 rounded-full blur-2xl" />
        </div>
        
        <div className="relative max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Invoices</h1>
              <p className="text-sm text-white/70 mt-0.5">Manage your billing</p>
            </div>
            <Link href="/invoices/new">
              <Button className="bg-white/20 hover:bg-white/30 text-white hidden md:flex" data-testid="button-add-invoice-header-desktop">
                <Plus className="h-5 w-5 mr-2" />
                Create Invoice
              </Button>
              <Button size="icon" className="h-11 w-11 rounded-xl bg-white/20 backdrop-blur hover:bg-white/30 text-white border border-white/20 md:hidden" data-testid="button-add-invoice-header">
                <Plus className="h-5 w-5" />
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-400/20 flex items-center justify-center">
                  <CheckCircle className="h-4 w-4 text-emerald-200" />
                </div>
                <span className="text-xs font-medium text-white/80">Collected</span>
              </div>
              <p className="text-2xl md:text-3xl font-bold tracking-tight" data-testid="text-total-paid">{formatCurrency(stats.paid)}</p>
              <p className="text-xs text-white/60 mt-1">{stats.count.paid} paid</p>
            </div>
            
            <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-lg bg-amber-400/20 flex items-center justify-center">
                  <AlertCircle className="h-4 w-4 text-amber-200" />
                </div>
                <span className="text-xs font-medium text-white/80">Outstanding</span>
              </div>
              <p className="text-2xl md:text-3xl font-bold tracking-tight" data-testid="text-total-pending">{formatCurrency(stats.pending)}</p>
              <p className="text-xs text-white/60 mt-1">{stats.count.sent} pending</p>
            </div>

            <div className="hidden md:block bg-white/15 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-lg bg-slate-400/20 flex items-center justify-center">
                  <Clock className="h-4 w-4 text-slate-200" />
                </div>
                <span className="text-xs font-medium text-white/80">Drafts</span>
              </div>
              <p className="text-2xl md:text-3xl font-bold tracking-tight" data-testid="text-drafts-count">{stats.count.draft}</p>
              <p className="text-xs text-white/60 mt-1">in progress</p>
            </div>

            <div className="hidden md:block bg-white/15 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-lg bg-blue-400/20 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-blue-200" />
                </div>
                <span className="text-xs font-medium text-white/80">Total</span>
              </div>
              <p className="text-2xl md:text-3xl font-bold tracking-tight" data-testid="text-total-invoices">{formatCurrency(stats.total)}</p>
              <p className="text-xs text-white/60 mt-1">{stats.count.all} invoices</p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex-1 px-4 md:px-6 lg:px-8 pt-4 max-w-7xl mx-auto w-full">
        <Card className="border-0 shadow-lg mb-4 overflow-hidden bg-card">
          <CardContent className="p-1.5">
            <div className="flex gap-1">
              {filters.map((f) => {
                const FilterIcon = f.icon;
                const count = stats.count[f.value as keyof typeof stats.count] || 0;
                return (
                  <button
                    key={f.value}
                    onClick={() => setFilter(f.value)}
                    className={`flex-1 py-2.5 px-2 rounded-xl text-xs font-semibold transition-all flex flex-col items-center gap-1 ${
                      filter === f.value
                        ? "bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-md"
                        : "text-muted-foreground hover:bg-muted/50"
                    }`}
                    data-testid={`filter-${f.value}`}
                  >
                    <FilterIcon className="h-4 w-4" />
                    <span>{f.label}</span>
                    {f.value !== "all" && count > 0 && (
                      <span className={`text-[10px] ${filter === f.value ? "text-white/80" : "text-muted-foreground/60"}`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Link href="/invoices/new">
          <Button className="w-full mb-5 h-14 text-base font-semibold bg-gradient-to-r from-blue-500 to-cyan-500 shadow-lg shadow-blue-500/20 rounded-xl" data-testid="button-add-invoice">
            <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center mr-3">
              <Plus className="h-5 w-5" />
            </div>
            Create New Invoice
          </Button>
        </Link>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="border-0 shadow-sm overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex">
                    <div className="w-1.5 bg-muted animate-pulse" />
                    <div className="flex-1 p-4">
                      <div className="flex items-center gap-4">
                        <div className="h-14 w-14 bg-muted animate-pulse rounded-2xl" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 w-32 bg-muted animate-pulse rounded-lg" />
                          <div className="h-3 w-24 bg-muted animate-pulse rounded-lg" />
                        </div>
                        <div className="h-6 w-16 bg-muted animate-pulse rounded-lg" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredInvoices.length === 0 ? (
          <EmptyState filter={filter} />
        ) : (
          <div className="space-y-3">
            {filteredInvoices.map((invoice) => (
              <InvoiceCard 
                key={invoice.id} 
                invoice={invoice}
                nudges={nudges}
                onNudgeClick={(nudge) => setSelectedNudge(nudge)}
              />
            ))}
          </div>
        )}
        
        <div className="h-8" />
      </div>

      <NudgeActionSheet
        nudge={selectedNudge}
        open={!!selectedNudge}
        onClose={() => setSelectedNudge(null)}
        onNavigate={(path) => navigate(path)}
      />
    </div>
  );
}
