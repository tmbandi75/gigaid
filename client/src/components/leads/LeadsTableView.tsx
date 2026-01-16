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
  Phone,
  Mail,
  Calendar,
  Clock,
  User,
  ArrowRight,
  MessageSquare,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Lead } from "@shared/schema";

interface LeadsTableViewProps {
  leads: Lead[];
  isLoading?: boolean;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return `${Math.floor(diffDays / 30)} months ago`;
}

const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
  new: { color: "text-blue-600", bg: "bg-blue-500/10", label: "New" },
  contacted: { color: "text-amber-600", bg: "bg-amber-500/10", label: "Contacted" },
  quoted: { color: "text-purple-600", bg: "bg-purple-500/10", label: "Quoted" },
  converted: { color: "text-emerald-600", bg: "bg-emerald-500/10", label: "Converted" },
  lost: { color: "text-gray-500", bg: "bg-gray-500/10", label: "Lost" },
};

function LeadTableRow({ lead }: { lead: Lead }) {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const config = statusConfig[lead.status] || statusConfig.new;

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      return apiRequest("PATCH", `/api/leads/${lead.id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      toast({ title: "Lead status updated" });
    },
  });

  return (
    <tr
      className="border-b last:border-b-0 transition-colors hover:bg-muted/30 cursor-pointer"
      onClick={() => navigate(`/leads/${lead.id}`)}
      data-testid={`table-row-lead-${lead.id}`}
    >
      <td className="px-4 py-4">
        <div className="flex flex-col">
          <span className="font-medium text-foreground">{lead.clientName}</span>
          {lead.clientEmail && (
            <span className="text-sm text-muted-foreground">{lead.clientEmail}</span>
          )}
        </div>
      </td>
      <td className="px-4 py-4">
        <span className="text-sm text-muted-foreground capitalize">{lead.serviceType || "-"}</span>
      </td>
      <td className="px-4 py-4">
        {lead.clientPhone ? (
          <a
            href={`tel:${lead.clientPhone}`}
            onClick={(e) => e.stopPropagation()}
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            <Phone className="h-3 w-3" />
            {lead.clientPhone}
          </a>
        ) : (
          <span className="text-muted-foreground/50 text-sm">-</span>
        )}
      </td>
      <td className="px-4 py-4">
        {lead.sourceType ? (
          <span className="text-sm text-muted-foreground capitalize">{lead.sourceType}</span>
        ) : (
          <span className="text-muted-foreground/50 text-sm">-</span>
        )}
      </td>
      <td className="px-4 py-4">
        <span className="text-sm text-muted-foreground">{getTimeAgo(lead.createdAt)}</span>
      </td>
      <td className="px-4 py-4">
        <Badge variant="secondary" className={`text-xs ${config.bg} ${config.color} border-0`}>
          {config.label}
        </Badge>
      </td>
      <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 justify-end">
          {lead.status === "new" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => updateStatusMutation.mutate("contacted")}
              className="h-8"
            >
              <Phone className="h-3 w-3 mr-1" />
              Contact
            </Button>
          )}
          {(lead.status === "contacted" || lead.status === "quoted") && (
            <Button
              size="sm"
              onClick={() => navigate(`/leads/${lead.id}/convert`)}
              className="h-8"
            >
              <ArrowRight className="h-3 w-3 mr-1" />
              Convert
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate(`/leads/${lead.id}`)}>
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate(`/leads/${lead.id}/edit`)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              {lead.clientPhone && (
                <DropdownMenuItem onClick={() => window.open(`tel:${lead.clientPhone}`)}>
                  <Phone className="h-4 w-4 mr-2" />
                  Call
                </DropdownMenuItem>
              )}
              {lead.clientEmail && (
                <DropdownMenuItem onClick={() => window.open(`mailto:${lead.clientEmail}`)}>
                  <Mail className="h-4 w-4 mr-2" />
                  Email
                </DropdownMenuItem>
              )}
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

export function LeadsTableView({ leads, isLoading }: LeadsTableViewProps) {
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

  if (leads.length === 0) {
    return null;
  }

  return (
    <Card className="border shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                Lead
              </th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                Service
              </th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                Phone
              </th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                Source
              </th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                Added
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
            {leads.map((lead) => (
              <LeadTableRow key={lead.id} lead={lead} />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
