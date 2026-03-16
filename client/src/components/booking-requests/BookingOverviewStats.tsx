import { Card, CardContent } from "@/components/ui/card";
import {
  CalendarClock,
  CalendarCheck,
  Calendar,
  AlertTriangle,
} from "lucide-react";

interface BookingOverviewStatsProps {
  pendingCount: number;
  acceptedCount: number;
  completedCount: number;
  cancelledCount: number;
  totalCount: number;
  activeFilter: string;
  onFilterChange: (filter: string) => void;
}

const stats = [
  { key: "pending", label: "Pending", icon: CalendarClock, gradient: "from-amber-500 to-orange-500", bg: "bg-amber-50 dark:bg-amber-950/30", border: "border-amber-200 dark:border-amber-800" },
  { key: "accepted", label: "Accepted", icon: CalendarCheck, gradient: "from-emerald-500 to-green-500", bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-200 dark:border-emerald-800" },
  { key: "completed", label: "Completed", icon: Calendar, gradient: "from-blue-500 to-cyan-500", bg: "bg-blue-50 dark:bg-blue-950/30", border: "border-blue-200 dark:border-blue-800" },
  { key: "cancelled", label: "Cancelled", icon: AlertTriangle, gradient: "from-gray-400 to-gray-500", bg: "bg-gray-50 dark:bg-gray-950/30", border: "border-gray-200 dark:border-gray-800" },
];

export function BookingOverviewStats({
  pendingCount,
  acceptedCount,
  completedCount,
  cancelledCount,
  totalCount,
  activeFilter,
  onFilterChange,
}: BookingOverviewStatsProps) {
  const counts: Record<string, number> = {
    pending: pendingCount,
    accepted: acceptedCount,
    completed: completedCount,
    cancelled: cancelledCount,
  };

  return (
    <div className="grid grid-cols-4 gap-4" data-testid="section-booking-overview">
      {stats.map((stat) => {
        const Icon = stat.icon;
        const count = counts[stat.key] || 0;
        const isActive = activeFilter === stat.key;

        return (
          <Card
            key={stat.key}
            className={`cursor-pointer transition-all hover:shadow-md ${stat.bg} ${isActive ? `ring-2 ring-primary shadow-md ${stat.border}` : "border-transparent"}`}
            onClick={() => onFilterChange(isActive ? "all" : stat.key)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onFilterChange(isActive ? "all" : stat.key); } }}
            aria-label={`Filter by ${stat.label}: ${count} bookings`}
            aria-pressed={isActive}
            data-testid={`stat-card-${stat.key}`}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className={`p-2 rounded-lg bg-gradient-to-br ${stat.gradient}`}>
                  <Icon className="h-4 w-4 text-white" />
                </div>
                <span className="text-2xl font-bold">{count}</span>
              </div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{stat.label}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
