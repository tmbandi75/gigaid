import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import type { SmsMessage } from "@shared/schema";

interface LeadSmsConversationProps {
  leadId: string;
  clientPhone: string | null;
  clientName: string;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function SmsMessageBubble({ message }: { message: SmsMessage }) {
  const isOutbound = message.direction === "outbound";
  
  return (
    <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
      <div 
        className={`max-w-[80%] rounded-2xl px-3 py-2 ${
          isOutbound 
            ? 'bg-primary text-primary-foreground rounded-br-sm' 
            : 'bg-muted rounded-bl-sm'
        }`}
        data-testid={`sms-message-${message.id}`}
      >
        <p className="text-sm whitespace-pre-wrap">{message.body}</p>
        <div className={`flex items-center gap-1 mt-1 ${isOutbound ? 'justify-end' : 'justify-start'}`}>
          {isOutbound ? (
            <ArrowUpRight className="h-3 w-3 opacity-60" />
          ) : (
            <ArrowDownLeft className="h-3 w-3 opacity-60" />
          )}
          <span className="text-xs opacity-60">
            {formatDate(message.createdAt)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function LeadSmsConversation({ leadId, clientPhone, clientName }: LeadSmsConversationProps) {
  const { data: messages = [], isLoading } = useQuery<SmsMessage[]>({
    queryKey: ["/api/leads", leadId, "sms-messages"],
    enabled: !!clientPhone,
  });

  if (!clientPhone) {
    return null;
  }

  if (isLoading) {
    return (
      <Card className="border-0 shadow-md" data-testid="card-sms-conversation">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="h-4 w-4 text-emerald-500" />
            <h3 className="font-semibold text-sm">Text Messages</h3>
          </div>
          <div className="text-sm text-muted-foreground">Loading messages...</div>
        </CardContent>
      </Card>
    );
  }

  if (messages.length === 0) {
    return null;
  }

  const sortedMessages = [...messages].sort((a, b) => 
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  return (
    <Card className="border-0 shadow-md" data-testid="card-sms-conversation">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="h-4 w-4 text-emerald-500" />
          <h3 className="font-semibold text-sm">Text Messages with {clientName}</h3>
        </div>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {sortedMessages.map((msg) => (
            <SmsMessageBubble key={msg.id} message={msg} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
