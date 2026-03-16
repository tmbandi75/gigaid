import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, Inbox, CalendarClock, CalendarCheck, CheckCircle, XCircle } from "lucide-react";

interface BookingSearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: string;
  onStatusFilterChange: (filter: string) => void;
  counts: {
    all: number;
    pending: number;
    accepted: number;
    completed: number;
    cancelled: number;
  };
}

const filterChips = [
  { value: "all", label: "All", icon: Inbox },
  { value: "pending", label: "Pending", icon: CalendarClock },
  { value: "accepted", label: "Accepted", icon: CalendarCheck },
  { value: "completed", label: "Completed", icon: CheckCircle },
  { value: "cancelled", label: "Cancelled", icon: XCircle },
];

export function BookingSearchBar({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  counts,
}: BookingSearchBarProps) {
  return (
    <div className="space-y-3" data-testid="section-booking-search">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search bookings by client, service, or date..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 pr-10"
          data-testid="input-booking-search"
          aria-label="Search bookings"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
            onClick={() => onSearchChange("")}
            aria-label="Clear search"
            data-testid="button-clear-booking-search"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        {filterChips.map((chip) => {
          const Icon = chip.icon;
          const isActive = statusFilter === chip.value;
          const count = counts[chip.value as keyof typeof counts] || 0;

          return (
            <Button
              key={chip.value}
              variant={isActive ? "default" : "outline"}
              size="sm"
              onClick={() => onStatusFilterChange(chip.value)}
              className={`gap-1.5 ${!isActive ? "text-muted-foreground" : ""}`}
              aria-label={`Filter ${chip.label}: ${count}`}
              aria-pressed={isActive}
              data-testid={`filter-chip-${chip.value}`}
            >
              <Icon className="h-3.5 w-3.5" />
              {chip.label}
              {count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${isActive ? "bg-white/20" : "bg-muted"}`}>
                  {count}
                </span>
              )}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
