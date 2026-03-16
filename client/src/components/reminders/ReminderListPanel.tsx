import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Bell,
  MessageSquare,
  Phone,
  Mail,
  Calendar,
  Send,
  Pencil,
  Trash2,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";
import type { Reminder } from "@shared/schema";

interface ReminderListPanelProps {
  reminders: Reminder[];
  selectedReminderId: string | null;
  onSelect: (reminder: Reminder) => void;
  onEdit: (reminder: Reminder) => void;
  onDelete: (id: string) => void;
  isDeleting: boolean;
  formatDateTime: (dateStr: string) => string;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
}

function getChannelIcon(channel: string) {
  switch (channel) {
    case "sms": return <MessageSquare className="h-4 w-4" />;
    case "voice": return <Phone className="h-4 w-4" />;
    case "email": return <Mail className="h-4 w-4" />;
    default: return <Bell className="h-4 w-4" />;
  }
}

function getChannelLabel(channel: string) {
  switch (channel) {
    case "sms": return "SMS";
    case "voice": return "Voice";
    case "email": return "Email";
    default: return channel;
  }
}

function getStatusConfig(status: string) {
  switch (status) {
    case "pending":
      return { icon: Clock, label: "Pending", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", dotColor: "bg-amber-500" };
    case "sent":
      return { icon: CheckCircle, label: "Sent", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", dotColor: "bg-blue-500" };
    case "acknowledged":
      return { icon: CheckCircle, label: "Confirmed", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", dotColor: "bg-green-500" };
    case "failed":
      return { icon: XCircle, label: "Failed", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", dotColor: "bg-red-500" };
    default:
      return { icon: AlertCircle, label: status, className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400", dotColor: "bg-gray-500" };
  }
}

export function ReminderListPanel({
  reminders,
  selectedReminderId,
  onSelect,
  onEdit,
  onDelete,
  isDeleting,
  formatDateTime,
  selectedIds,
  onToggleSelect,
}: ReminderListPanelProps) {
  if (reminders.length === 0) {
    return (
      <Card className="border-dashed rounded-xl">
        <CardContent className="py-12 text-center">
          <div className="w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
            <Bell className="h-7 w-7 text-muted-foreground/40" />
          </div>
          <h3 className="font-semibold text-base mb-1">No reminders match</h3>
          <p className="text-sm text-muted-foreground">Try adjusting your search or filters.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2" data-testid="section-reminder-list">
      {reminders.map((reminder) => {
        const statusConfig = getStatusConfig(reminder.status);
        const StatusIcon = statusConfig.icon;
        const isPast = new Date(reminder.scheduledAt) < new Date();
        const isOverdue = isPast && reminder.status === "pending";
        const isActive = selectedReminderId === reminder.id;
        const isChecked = selectedIds.has(reminder.id);

        return (
          <Card
            key={reminder.id}
            className={`rounded-xl border shadow-sm transition-all cursor-pointer hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 outline-none ${
              isActive ? "border-primary border-2 bg-primary/5" : ""
            } ${isOverdue ? "border-red-400 bg-red-50 dark:bg-red-950/20" : ""}`}
            onClick={() => onSelect(reminder)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(reminder); } }}
            tabIndex={0}
            role="button"
            aria-label={`Reminder for ${reminder.clientName}`}
            data-testid={`card-reminder-desktop-${reminder.id}`}
          >
            <CardContent className="p-0">
              <div className="flex">
                <div className={`w-1 ${statusConfig.dotColor} rounded-l-xl`} />
                <div className="flex-1 p-3.5">
                  <div className="flex items-start gap-3">
                    <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => onToggleSelect(reminder.id)}
                        aria-label={`Select reminder for ${reminder.clientName}`}
                        data-testid={`checkbox-reminder-${reminder.id}`}
                      />
                    </div>

                    <div className={`p-2 rounded-xl flex-shrink-0 ${
                      reminder.channel === "sms" ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" :
                      reminder.channel === "voice" ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" :
                      "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
                    }`}>
                      {getChannelIcon(reminder.channel)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm truncate">{reminder.clientName}</span>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{getChannelLabel(reminder.channel)}</Badge>
                        </div>
                        <Badge className={`${statusConfig.className} text-[10px] px-2 py-0.5 flex items-center gap-1`}>
                          <StatusIcon className="h-3 w-3" />
                          {statusConfig.label}
                        </Badge>
                      </div>

                      <p className="text-sm text-muted-foreground line-clamp-1 mb-1.5">{reminder.message}</p>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>{formatDateTime(reminder.scheduledAt)}</span>
                          {isOverdue && (
                            <Badge variant="outline" className="text-[10px] ml-1.5 text-amber-600 border-amber-300">Overdue</Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => onEdit(reminder)}
                            aria-label={`Edit reminder for ${reminder.clientName}`}
                            data-testid={`button-edit-reminder-${reminder.id}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => onDelete(reminder.id)}
                            disabled={isDeleting}
                            aria-label={`Delete reminder for ${reminder.clientName}`}
                            data-testid={`button-delete-reminder-desktop-${reminder.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
