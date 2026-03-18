import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Send,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import type { Reminder } from "@shared/schema";
import { ReminderOverviewCards } from "./ReminderOverviewCards";
import { SmartSuggestionsPanel } from "./SmartSuggestionsPanel";
import { ReminderSearchBar, type FilterChip } from "./ReminderSearchBar";
import { ReminderListPanel } from "./ReminderListPanel";
import { ReminderPreviewPanel } from "./ReminderPreviewPanel";

interface RemindersDesktopViewProps {
  reminders: Reminder[];
  pendingCount: number;
  sentCount: number;
  failedCount: number;
  onEdit: (reminder: Reminder) => void;
  onDelete: (id: string) => void;
  isDeleting: boolean;
  formatDateTime: (dateStr: string) => string;
}

export function RemindersDesktopView({
  reminders,
  pendingCount,
  sentCount,
  failedCount,
  onEdit,
  onDelete,
  isDeleting,
  formatDateTime,
}: RemindersDesktopViewProps) {
  const [selectedReminder, setSelectedReminder] = useState<Reminder | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterChip, setFilterChip] = useState<FilterChip>("all");
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());

  const overdueCount = useMemo(() =>
    reminders.filter(r => r.status === "pending" && new Date(r.scheduledAt) < new Date()).length,
    [reminders]
  );

  const handleOverviewFilter = (filter: string) => {
    if (filter === "all") {
      setFilterChip("all");
    } else {
      setFilterChip(filter as FilterChip);
    }
  };

  const filteredReminders = useMemo(() => {
    let result = reminders;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r =>
        r.clientName.toLowerCase().includes(q) ||
        r.message.toLowerCase().includes(q)
      );
    }

    if (filterChip !== "all") {
      if (filterChip === "overdue") {
        result = result.filter(r => r.status === "pending" && new Date(r.scheduledAt) < new Date());
      } else if (["sms", "email", "voice"].includes(filterChip)) {
        result = result.filter(r => r.channel === filterChip);
      } else {
        result = result.filter(r => r.status === filterChip);
      }
    }

    return result;
  }, [reminders, searchQuery, filterChip]);

  const handleToggleBulkSelect = (id: string) => {
    setBulkSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = () => {
    bulkSelected.forEach(id => onDelete(id));
    setBulkSelected(new Set());
  };

  return (
    <div className="max-w-7xl mx-auto w-full px-6 lg:px-8 py-6 space-y-6" data-testid="desktop-reminders-view">
      <ReminderOverviewCards
        pendingCount={pendingCount}
        sentCount={sentCount}
        failedCount={failedCount}
        overdueCount={overdueCount}
        activeFilter={filterChip}
        onFilterChange={handleOverviewFilter}
      />

      {overdueCount > 0 && (
        <div className="flex items-center gap-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-3" data-testid="banner-overdue">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
          <p className="text-sm flex-1">
            <span className="font-semibold">{overdueCount} reminder{overdueCount > 1 ? "s are" : " is"} overdue.</span>
          </p>
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7 border-amber-300"
            disabled
            title="Bulk sending will be available in a future update"
            data-testid="button-send-all-overdue"
          >
            <Send className="h-3 w-3 mr-1" />
            Send All
          </Button>
        </div>
      )}

      <SmartSuggestionsPanel />

      <ReminderSearchBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeChip={filterChip}
        onChipChange={setFilterChip}
      />

      {bulkSelected.size > 0 && (
        <div className="flex items-center gap-3 bg-muted/50 rounded-xl p-3" data-testid="bar-bulk-actions">
          <Badge variant="secondary" className="text-xs">{bulkSelected.size} selected</Badge>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            disabled
            title="Bulk sending will be available in a future update"
            data-testid="button-bulk-send"
          >
            <Send className="h-3 w-3 mr-1" />
            Send Selected
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs text-destructive hover:text-destructive"
            onClick={handleBulkDelete}
            disabled={isDeleting}
            data-testid="button-bulk-delete"
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Delete Selected
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs ml-auto"
            onClick={() => setBulkSelected(new Set())}
            data-testid="button-bulk-clear"
          >
            Clear
          </Button>
        </div>
      )}

      <div className="grid grid-cols-5 gap-6">
        <div className="col-span-3">
          <ReminderListPanel
            reminders={filteredReminders}
            selectedReminderId={selectedReminder?.id ?? null}
            onSelect={setSelectedReminder}
            onEdit={onEdit}
            onDelete={onDelete}
            isDeleting={isDeleting}
            formatDateTime={formatDateTime}
            selectedIds={bulkSelected}
            onToggleSelect={handleToggleBulkSelect}
          />
        </div>
        <div className="col-span-2">
          <ReminderPreviewPanel
            reminder={selectedReminder}
            onEdit={onEdit}
            onDelete={onDelete}
            isDeleting={isDeleting}
            formatDateTime={formatDateTime}
          />
        </div>
      </div>
    </div>
  );
}
