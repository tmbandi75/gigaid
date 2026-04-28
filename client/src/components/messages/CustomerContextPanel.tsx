import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  User,
  Phone,
  Briefcase,
  FileText,
  Link2,
  StickyNote,
} from "lucide-react";
import { useLocation } from "wouter";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { formatCurrency as baseFormatCurrency } from "@/lib/formatCurrency";

interface Job {
  id: string;
  title: string;
  status: string;
  scheduledDate: string | null;
  createdAt: string;
}

interface Invoice {
  id: string;
  status: string;
  amount: number;
  createdAt: string;
}

interface CustomerContextPanelProps {
  clientPhone: string;
  clientName: string | null;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatCurrency(amount: number | null | undefined): string {
  return baseFormatCurrency(amount, { maximumFractionDigits: 2 });
}

export function CustomerContextPanel({ clientPhone, clientName }: CustomerContextPanelProps) {
  const [, navigate] = useLocation();
  const displayName = clientName || clientPhone;

  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: QUERY_KEYS.jobs(),
    staleTime: 60000,
  });

  const { data: invoices = [] } = useQuery<Invoice[]>({
    queryKey: QUERY_KEYS.invoices(),
    staleTime: 60000,
  });

  const clientJobs = jobs.filter(
    (j) => j.title?.toLowerCase().includes(displayName.toLowerCase().split(" ")[0] || "")
  ).slice(0, 3);

  const clientInvoices = invoices.slice(0, 3);

  return (
    <div className="space-y-4" data-testid="panel-customer-context">
      <Card className="rounded-xl border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            Customer Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="font-medium text-foreground" data-testid="text-customer-name">{displayName}</p>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
              <Phone className="h-3 w-3" />
              <span data-testid="text-customer-phone">{clientPhone}</span>
            </div>
          </div>

          <div className="border-t pt-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Quick Actions</p>
            <div className="grid grid-cols-1 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="justify-start gap-2 text-xs"
                onClick={() => navigate("/jobs")}
                aria-label="Create a job"
                data-testid="button-create-job"
              >
                <Briefcase className="h-3.5 w-3.5" />
                Create Job
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="justify-start gap-2 text-xs"
                onClick={() => navigate("/invoices")}
                aria-label="Send an invoice"
                data-testid="button-send-invoice"
              >
                <FileText className="h-3.5 w-3.5" />
                Send Invoice
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="justify-start gap-2 text-xs"
                onClick={() => navigate("/booking-requests")}
                aria-label="Send booking link"
                data-testid="button-send-booking"
              >
                <Link2 className="h-3.5 w-3.5" />
                Send Booking Link
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="justify-start gap-2 text-xs"
                onClick={() => navigate("/voice-notes")}
                aria-label="Add a note"
                data-testid="button-add-note"
              >
                <StickyNote className="h-3.5 w-3.5" />
                Add Note
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {clientJobs.length > 0 && (
        <Card className="rounded-xl border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-muted-foreground" />
              Recent Jobs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {clientJobs.map((job) => (
              <div
                key={job.id}
                className="flex items-center justify-between text-sm cursor-pointer hover:bg-muted/50 rounded-md p-2 -mx-2 transition-colors"
                onClick={() => navigate(`/jobs/${job.id}`)}
                data-testid={`job-item-${job.id}`}
              >
                <span className="truncate text-foreground">{job.title}</span>
                <Badge variant="outline" className="text-[10px] shrink-0 ml-2">
                  {job.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {clientInvoices.length > 0 && (
        <Card className="rounded-xl border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Recent Invoices
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {clientInvoices.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between text-sm cursor-pointer hover:bg-muted/50 rounded-md p-2 -mx-2 transition-colors"
                onClick={() => navigate(`/invoices/${inv.id}`)}
                data-testid={`invoice-item-${inv.id}`}
              >
                <span className="text-foreground">{formatCurrency(inv.amount)}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{formatDate(inv.createdAt)}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {inv.status}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
