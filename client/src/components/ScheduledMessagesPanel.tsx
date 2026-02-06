import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiFetch";
import { useApiMutation } from "@/hooks/useApiMutation";
import { 
  Clock, 
  MessageSquare, 
  X,
  Loader2,
  Check,
  AlertCircle
} from "lucide-react";

interface OutboundMessage {
  id: string;
  type: string;
  status: string;
  scheduledFor: string;
  sentAt: string | null;
  canceledAt: string | null;
  channel: string;
}

interface ScheduledMessagesPanelProps {
  jobId: string;
}

export function ScheduledMessagesPanel({ jobId }: ScheduledMessagesPanelProps) {
  const { toast } = useToast();
  
  const { data: messages = [], isLoading } = useQuery<OutboundMessage[]>({
    queryKey: ["/api/jobs", jobId, "scheduled-messages"],
    queryFn: async () => {
      const res = await fetch(`/api/jobs/${jobId}/scheduled-messages`);
      if (!res.ok) return [];
      return res.json();
    },
  });
  
  const cancelMutation = useApiMutation(
    async (messageId: string) => {
      return apiFetch(`/api/outbound-messages/${messageId}/cancel`, { method: "POST" });
    },
    [["/api/jobs", jobId, "scheduled-messages"]],
    {
      onSuccess: () => {
        toast({ title: "Message canceled", description: "The scheduled message has been canceled." });
      },
      onError: () => {
        toast({ title: "Failed to cancel", variant: "destructive" });
      },
    }
  );
  
  if (isLoading || messages.length === 0) {
    return null;
  }
  
  const scheduledMessages = messages.filter(m => m.status === "scheduled" || m.status === "queued");
  const sentMessages = messages.filter(m => m.status === "sent");
  const canceledMessages = messages.filter(m => m.status === "canceled");
  
  if (scheduledMessages.length === 0 && sentMessages.length === 0 && canceledMessages.length === 0) {
    return null;
  }
  
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    
    if (diffHours > 0 && diffHours < 48) {
      return `in ${diffHours} hours`;
    }
    return date.toLocaleDateString(undefined, { 
      weekday: "short", 
      month: "short", 
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  };
  
  const getTypeLabel = (type: string) => {
    switch (type) {
      case "followup": return "Follow-up";
      case "payment_reminder": return "Payment Reminder";
      case "review_request": return "Review Request";
      default: return type;
    }
  };
  
  const getChannelLabel = (channel: string) => {
    switch (channel) {
      case "sms": return "SMS";
      case "email": return "Email";
      case "inapp": return "In-app";
      default: return channel;
    }
  };
  
  return (
    <div className="mt-4 p-4 rounded-lg border bg-muted/30" data-testid="panel-scheduled-messages">
      <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
        <Clock className="h-4 w-4 text-primary" />
        Scheduled Messages
      </h4>
      
      <div className="space-y-2">
        {scheduledMessages.map((msg) => (
          <div 
            key={msg.id} 
            className="flex items-center justify-between p-2 rounded bg-background border"
            data-testid={`message-scheduled-${msg.id}`}
          >
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <div>
                <span className="text-sm font-medium">{getTypeLabel(msg.type)}</span>
                <span className="text-xs text-muted-foreground ml-2">
                  via {getChannelLabel(msg.channel)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {formatDate(msg.scheduledFor)}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-destructive hover:text-destructive"
                onClick={() => cancelMutation.mutate(msg.id)}
                disabled={cancelMutation.isPending}
                data-testid={`button-cancel-${msg.id}`}
              >
                {cancelMutation.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <X className="h-3 w-3" />
                )}
              </Button>
            </div>
          </div>
        ))}
        
        {sentMessages.map((msg) => (
          <div 
            key={msg.id} 
            className="flex items-center justify-between p-2 rounded bg-green-500/10 border border-green-500/20"
            data-testid={`message-sent-${msg.id}`}
          >
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              <span className="text-sm">{getTypeLabel(msg.type)}</span>
              <Badge variant="outline" className="text-xs bg-green-500/10 border-green-500/30 text-green-700">
                Sent
              </Badge>
            </div>
            <span className="text-xs text-muted-foreground">
              {msg.sentAt ? new Date(msg.sentAt).toLocaleDateString() : ""}
            </span>
          </div>
        ))}
        
        {canceledMessages.length > 0 && (
          <div className="text-xs text-muted-foreground mt-2">
            {canceledMessages.length} message(s) canceled
          </div>
        )}
      </div>
    </div>
  );
}
