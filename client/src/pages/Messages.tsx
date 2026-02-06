import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  MessageSquare, 
  Send, 
  ArrowLeft, 
  Phone, 
  User,
  Loader2,
  Check,
  CheckCheck,
  AlertCircle
} from "lucide-react";
import { PriorityBadge, inferMessagePriority } from "@/components/priority/PriorityBadge";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { apiFetch } from "@/lib/apiFetch";
import { useApiMutation } from "@/hooks/useApiMutation";

interface Conversation {
  clientPhone: string;
  clientName: string | null;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  relatedJobId: string | null;
  relatedLeadId: string | null;
}

interface SmsMessage {
  id: string;
  userId: string;
  clientPhone: string;
  clientName: string | null;
  direction: "outbound" | "inbound";
  body: string;
  twilioSid: string | null;
  relatedJobId: string | null;
  relatedLeadId: string | null;
  isRead: boolean;
  createdAt: string;
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatMessageTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function ConversationList({ 
  conversations, 
  onSelect, 
  selectedPhone 
}: { 
  conversations: Conversation[];
  onSelect: (phone: string, name: string | null) => void;
  selectedPhone: string | null;
}) {
  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center p-6">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <MessageSquare className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="font-medium text-foreground mb-2">No messages yet</h3>
        <p className="text-sm text-muted-foreground">
          When you send follow-up messages to clients, conversations will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {conversations.map((conv) => {
        const isSelected = conv.clientPhone === selectedPhone;
        const displayName = conv.clientName || conv.clientPhone;
        const initials = conv.clientName 
          ? conv.clientName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
          : "?";
        
        const priority = inferMessagePriority({ unreadCount: conv.unreadCount, lastMessageAt: conv.lastMessageAt });
        
        return (
          <button
            key={conv.clientPhone}
            onClick={() => onSelect(conv.clientPhone, conv.clientName)}
            className={`w-full p-3 rounded-md text-left hover-elevate transition-colors ${
              isSelected ? "bg-muted" : ""
            }`}
            data-testid={`conversation-${conv.clientPhone}`}
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-medium text-primary">{initials}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium text-foreground truncate">
                      {displayName}
                    </span>
                    {priority && <PriorityBadge priority={priority} compact />}
                  </div>
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {formatTime(conv.lastMessageAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-muted-foreground truncate">
                    {conv.lastMessage}
                  </p>
                  {conv.unreadCount > 0 && (
                    <Badge 
                      variant="default" 
                      className="h-5 min-w-5 flex items-center justify-center text-xs px-1.5"
                    >
                      {conv.unreadCount}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

interface MessageUsage {
  outboundSent: number;
  outboundLimit: number | null;
  outboundRemaining: number | null;
  plan: string;
}

function MessageThread({ 
  phone, 
  clientName,
  onBack 
}: { 
  phone: string;
  clientName: string | null;
  onBack: () => void;
}) {
  const { toast } = useToast();
  const [reply, setReply] = useState("");

  const { data: messages = [], isLoading } = useQuery<SmsMessage[]>({
    queryKey: ["/api/sms/conversation", phone],
    refetchInterval: 5000,
  });

  const { data: usage } = useQuery<MessageUsage>({
    queryKey: ["/api/messages/usage"],
    staleTime: 30000,
  });

  const isNearLimit = !!(usage?.outboundLimit && usage.outboundRemaining !== null && usage.outboundRemaining <= 5);
  const isAtLimit = !!(usage?.outboundLimit && usage.outboundRemaining !== null && usage.outboundRemaining <= 0);

  const sendMutation = useApiMutation(
    async (message: string) => {
      await apiFetch("/api/sms/send", { method: "POST", body: JSON.stringify({
        to: phone,
        message,
        clientName,
      }) });
    },
    [["/api/sms/conversation", phone], ["/api/sms/conversations"], ["/api/sms/unread-count"], ["/api/messages/usage"]],
    {
      onSuccess: () => {
        setReply("");
        toast({ title: "Message sent" });
      },
      onError: (error: any) => {
        const errorData = error?.response?.data || error?.data || {};
        if (errorData.code === "SMS_LIMIT_EXCEEDED") {
          toast({ 
            title: "Message limit reached", 
            description: errorData.message || "Upgrade to send more messages.",
            variant: "destructive" 
          });
        } else {
          toast({ title: "Failed to send message", variant: "destructive" });
        }
      },
    }
  );

  const handleSend = () => {
    if (!reply.trim() || isAtLimit) return;
    sendMutation.mutate(reply.trim());
  };

  const displayName = clientName || phone;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 p-4 border-b">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onBack}
          className="md:hidden"
          data-testid="button-back-conversations"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
          <User className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="font-medium text-foreground">{displayName}</h3>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Phone className="h-3 w-3" />
            <span>{phone}</span>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            No messages in this conversation
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}
                data-testid={`message-${msg.id}`}
              >
                <div
                  className={`max-w-[80%] rounded-md px-3 py-2 ${
                    msg.direction === "outbound"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                  <div className={`flex items-center justify-end gap-1 mt-1 text-xs ${
                    msg.direction === "outbound" ? "text-primary-foreground/70" : "text-muted-foreground"
                  }`}>
                    <span>{formatMessageTime(msg.createdAt)}</span>
                    {msg.direction === "outbound" && (
                      msg.isRead ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      <div className="p-4 border-t space-y-2">
        {isAtLimit && (
          <div className="flex items-center gap-2 px-3 py-2 bg-destructive/10 text-destructive rounded-md text-sm" data-testid="warning-limit-reached">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>You've reached your Free message limit. Upgrade to keep messaging and manage replies in GigAid.</span>
          </div>
        )}
        {isNearLimit && !isAtLimit && (
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 rounded-md text-sm" data-testid="warning-near-limit">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{usage?.outboundRemaining} messages remaining this month</span>
          </div>
        )}
        <div className="flex gap-2">
          <Textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder={isAtLimit ? "Message limit reached" : "Type a message..."}
            className="resize-none min-h-[44px] max-h-32"
            rows={1}
            disabled={isAtLimit}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            data-testid="textarea-reply"
          />
          <Button
            onClick={handleSend}
            disabled={!reply.trim() || sendMutation.isPending || isAtLimit}
            size="icon"
            data-testid="button-send-reply"
          >
            {sendMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function Messages() {
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const { data: conversations = [], isLoading } = useQuery<Conversation[]>({
    queryKey: ["/api/sms/conversations"],
    refetchInterval: 10000,
  });

  const queryClient = useQueryClient();
  const handleSelectConversation = (phone: string, name: string | null) => {
    setSelectedPhone(phone);
    setSelectedName(name);
    queryClient.invalidateQueries({ queryKey: ["/api/sms/unread-count"] });
  };

  const handleBack = () => {
    setSelectedPhone(null);
    setSelectedName(null);
  };

  const renderMobileHeader = () => (
    <div className="px-4 py-3 border-b">
      <h1 className="text-xl font-semibold">Messages</h1>
      <p className="text-xs text-muted-foreground">Messages here stay in GigAid</p>
    </div>
  );

  const renderDesktopHeader = () => (
    <div className="border-b bg-background sticky top-0 z-[999]">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-5">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-500/10 to-blue-500/10 flex items-center justify-center">
            <MessageSquare className="h-6 w-6 text-indigo-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground" data-testid="page-title">Messages</h1>
            <p className="text-sm text-muted-foreground">Messages here stay in GigAid</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderMobileLayout = () => (
    <div className="flex flex-col h-full max-h-[calc(100vh-120px)]" data-testid="page-messages">
      {renderMobileHeader()}

      <div className="flex-1 flex overflow-hidden">
        <div className={`w-full flex-shrink-0 overflow-y-auto ${
          selectedPhone ? "hidden" : ""
        }`}>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="p-2">
              <ConversationList
                conversations={conversations}
                onSelect={handleSelectConversation}
                selectedPhone={selectedPhone}
              />
            </div>
          )}
        </div>

        <div className={`flex-1 ${selectedPhone ? "" : "hidden"}`}>
          {selectedPhone ? (
            <MessageThread
              phone={selectedPhone}
              clientName={selectedName}
              onBack={handleBack}
            />
          ) : (
            <div className="text-center p-6">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-medium text-foreground mb-2">Select a conversation</h3>
              <p className="text-sm text-muted-foreground">
                Choose a conversation from the list to view messages
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderDesktopLayout = () => (
    <div className="flex flex-col h-screen bg-background" data-testid="page-messages">
      {renderDesktopHeader()}

      <div className="flex-1 flex overflow-hidden max-w-7xl mx-auto w-full px-6 lg:px-8 py-6">
        <div className="w-80 border-r flex-shrink-0 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="p-2">
              <ConversationList
                conversations={conversations}
                onSelect={handleSelectConversation}
                selectedPhone={selectedPhone}
              />
            </div>
          )}
        </div>

        <div className="flex-1 flex items-center justify-center">
          {selectedPhone ? (
            <MessageThread
              phone={selectedPhone}
              clientName={selectedName}
              onBack={handleBack}
            />
          ) : (
            <div className="text-center p-6">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-medium text-foreground mb-2">Select a conversation</h3>
              <p className="text-sm text-muted-foreground">
                Choose a conversation from the list to view messages
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (isMobile === undefined) {
    return null;
  }

  return isMobile ? renderMobileLayout() : renderDesktopLayout();
}
