import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Bell,
  MessageSquare,
  Phone,
  Mail,
  Calendar,
  User,
  Send,
  Pencil,
  Trash2,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";
import type { Reminder } from "@shared/schema";

interface ReminderPreviewPanelProps {
  reminder: Reminder | null;
  onEdit: (reminder: Reminder) => void;
  onDelete: (id: string) => void;
  onSendNow?: (reminder: Reminder) => void;
  isDeleting: boolean;
  formatDateTime: (dateStr: string) => string;
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
      return { icon: Clock, label: "Pending", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" };
    case "sent":
      return { icon: CheckCircle, label: "Sent", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" };
    case "acknowledged":
      return { icon: CheckCircle, label: "Confirmed", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" };
    case "failed":
      return { icon: XCircle, label: "Failed", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" };
    default:
      return { icon: AlertCircle, label: status, className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400" };
  }
}

export function ReminderPreviewPanel({
  reminder,
  onEdit,
  onDelete,
  onSendNow,
  isDeleting,
  formatDateTime,
}: ReminderPreviewPanelProps) {
  if (!reminder) {
    return (
      <Card className="rounded-xl border shadow-sm h-full flex items-center justify-center" data-testid="panel-preview-empty">
        <CardContent className="py-16 text-center">
          <div className="w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
            <Bell className="h-7 w-7 text-muted-foreground/40" />
          </div>
          <p className="text-sm text-muted-foreground">Select a reminder to view details</p>
        </CardContent>
      </Card>
    );
  }

  const statusConfig = getStatusConfig(reminder.status);
  const StatusIcon = statusConfig.icon;
  const isPast = new Date(reminder.scheduledAt) < new Date();
  const isOverdue = isPast && reminder.status === "pending";

  return (
    <Card className="rounded-xl border shadow-sm sticky top-28" data-testid="panel-preview-detail">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-base">Reminder Details</h3>
          <Badge className={`${statusConfig.className} text-xs flex items-center gap-1`}>
            <StatusIcon className="h-3 w-3" />
            {statusConfig.label}
          </Badge>
        </div>

        <Separator />

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{reminder.clientName}</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-muted-foreground">{getChannelIcon(reminder.channel)}</div>
            <span className="text-sm">{getChannelLabel(reminder.channel)}</span>
            {reminder.clientPhone && <span className="text-xs text-muted-foreground ml-1">({reminder.clientPhone})</span>}
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">{formatDateTime(reminder.scheduledAt)}</span>
            {isOverdue && (
              <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">Overdue</Badge>
            )}
          </div>
        </div>

        <Separator />

        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">Message</p>
          <div className="bg-muted/30 rounded-lg p-3">
            <p className="text-sm">{reminder.message}</p>
          </div>
        </div>

        <Separator />

        <div className="flex flex-col gap-2">
          {reminder.status === "pending" && (
            <Button
              size="sm"
              className="w-full"
              onClick={() => onSendNow?.(reminder)}
              disabled={!onSendNow}
              aria-label="Send reminder now"
              data-testid="button-preview-send-now"
            >
              <Send className="h-3.5 w-3.5 mr-1.5" />
              Send Now
            </Button>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => onEdit(reminder)}
              aria-label="Edit reminder"
              data-testid="button-preview-edit"
            >
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => onDelete(reminder.id)}
              disabled={isDeleting}
              aria-label="Delete reminder"
              data-testid="button-preview-delete"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Delete
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
