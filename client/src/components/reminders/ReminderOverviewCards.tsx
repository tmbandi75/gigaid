import { Card, CardContent } from "@/components/ui/card";
import {
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from "lucide-react";

interface ReminderOverviewCardsProps {
  pendingCount: number;
  sentCount: number;
  failedCount: number;
  overdueCount: number;
  activeFilter: string;
  onFilterChange: (filter: string) => void;
}

export function ReminderOverviewCards({
  pendingCount,
  sentCount,
  failedCount,
  overdueCount,
  activeFilter,
  onFilterChange,
}: ReminderOverviewCardsProps) {
  const cards = [
    {
      id: "pending",
      label: "Pending",
      count: pendingCount,
      icon: Clock,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/10",
      borderActive: "border-amber-400",
    },
    {
      id: "sent",
      label: "Sent",
      count: sentCount,
      icon: CheckCircle,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-500/10",
      borderActive: "border-blue-400",
    },
    {
      id: "failed",
      label: "Failed",
      count: failedCount,
      icon: XCircle,
      color: "text-red-600 dark:text-red-400",
      bg: "bg-red-500/10",
      borderActive: "border-red-400",
    },
    {
      id: "overdue",
      label: "Overdue",
      count: overdueCount,
      icon: AlertTriangle,
      color: "text-orange-600 dark:text-orange-400",
      bg: "bg-orange-500/10",
      borderActive: "border-orange-400",
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-4" data-testid="section-overview-cards">
      {cards.map((card) => {
        const isActive = activeFilter === card.id;
        return (
          <Card
            key={card.id}
            className={`rounded-xl shadow-sm border cursor-pointer transition-all hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 outline-none ${
              isActive ? `${card.borderActive} border-2` : "border-slate-200 dark:border-slate-700"
            }`}
            onClick={() => onFilterChange(isActive ? "all" : card.id)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onFilterChange(isActive ? "all" : card.id); } }}
            tabIndex={0}
            role="button"
            aria-label={`Filter by ${card.label}: ${card.count}`}
            data-testid={`card-overview-${card.id}`}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`h-10 w-10 rounded-lg ${card.bg} flex items-center justify-center flex-shrink-0`}>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </div>
              <div>
                <div className="text-2xl font-bold">{card.count}</div>
                <p className="text-xs text-muted-foreground">{card.label}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
