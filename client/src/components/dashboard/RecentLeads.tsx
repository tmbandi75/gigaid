import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, UserPlus, Phone, Mail } from "lucide-react";
import { Link } from "wouter";
import type { Lead } from "@shared/schema";

interface RecentLeadsProps {
  leads: Lead[];
  isLoading?: boolean;
}

const statusColors: Record<string, string> = {
  new: "bg-chart-3/10 text-chart-3 border-chart-3/20",
  contacted: "bg-primary/10 text-primary border-primary/20",
  converted: "bg-chart-2/10 text-chart-2 border-chart-2/20",
};

export function RecentLeads({ leads, isLoading }: RecentLeadsProps) {
  if (isLoading) {
    return (
      <Card data-testid="card-leads-loading">
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <div className="h-5 w-28 bg-muted animate-pulse rounded" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
              <div className="h-10 w-10 bg-muted animate-pulse rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                <div className="h-3 w-32 bg-muted animate-pulse rounded" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (leads.length === 0) {
    return (
      <Card data-testid="card-leads-empty">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-medium">Recent Leads</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center py-6 text-center">
            <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
              <UserPlus className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground mb-4">No leads yet</p>
            <Link href="/leads/new">
              <Button data-testid="button-add-first-lead">Add Your First Lead</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-recent-leads">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-lg font-medium">Recent Leads</CardTitle>
        <Link href="/leads">
          <Button variant="ghost" size="sm" className="text-primary" data-testid="link-view-all-leads">
            View All
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="space-y-2">
        {leads.slice(0, 3).map((lead) => (
          <Link key={lead.id} href={`/leads/${lead.id}`}>
            <div 
              className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover-elevate active-elevate-2 cursor-pointer"
              data-testid={`lead-card-${lead.id}`}
            >
              <div className="h-10 w-10 rounded-full bg-chart-3/10 flex items-center justify-center flex-shrink-0">
                <span className="text-lg font-medium text-chart-3">
                  {lead.clientName.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-foreground truncate">{lead.clientName}</p>
                  <Badge 
                    variant="outline" 
                    className={`text-[10px] px-1.5 py-0 capitalize ${statusColors[lead.status]}`}
                  >
                    {lead.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="truncate">{lead.serviceType}</span>
                  {lead.clientPhone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                    </span>
                  )}
                  {lead.clientEmail && (
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
