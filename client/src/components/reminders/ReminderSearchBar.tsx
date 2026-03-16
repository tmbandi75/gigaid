import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

type FilterChip = "all" | "pending" | "sent" | "failed" | "overdue" | "sms" | "email" | "voice";

interface ReminderSearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeChip: FilterChip;
  onChipChange: (chip: FilterChip) => void;
}

const FILTER_CHIPS: { id: FilterChip; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "sent", label: "Sent" },
  { id: "failed", label: "Failed" },
  { id: "overdue", label: "Overdue" },
  { id: "sms", label: "SMS" },
  { id: "email", label: "Email" },
  { id: "voice", label: "Voice" },
];

export function ReminderSearchBar({
  searchQuery,
  onSearchChange,
  activeChip,
  onChipChange,
}: ReminderSearchBarProps) {
  return (
    <div className="space-y-3" data-testid="section-search-bar">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by client name or message..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 h-10 rounded-xl"
          aria-label="Search reminders"
          data-testid="input-search-reminders"
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {FILTER_CHIPS.map((chip) => (
          <Button
            key={chip.id}
            variant={activeChip === chip.id ? "default" : "outline"}
            size="sm"
            className="rounded-full text-xs h-7"
            onClick={() => onChipChange(chip.id)}
            data-testid={`chip-filter-${chip.id}`}
          >
            {chip.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

export type { FilterChip };
