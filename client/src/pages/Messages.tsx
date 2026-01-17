import { useQuery, useMutation } from "@tanstack/react-query";
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
  CheckCheck
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

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
                  <span className="font-medium text-foreground truncate">
                    {displayName}
                  </span>
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

  const sendMutation = useMutation({
    mutationFn: async (message: string) => {
      await apiRequest("POST", "/api/sms/send", {
        to: phone,
        message,
        clientName,
      });
    },
    onSuccess: () => {
      setReply("");
      queryClient.invalidateQueries({ queryKey: ["/api/sms/conversation", phone] });
      queryClient.invalidateQueries({ queryKey: ["/api/sms/conversations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sms/unread-count"] });
      toast({ title: "Message sent" });
    },
    onError: () => {
      toast({ title: "Failed to send message", variant: "destructive" });
    },
  });

  const handleSend = () => {
    if (!reply.trim()) return;
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

      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Type a message..."
            className="resize-none min-h-[44px] max-h-32"
            rows={1}
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
            disabled={!reply.trim() || sendMutation.isPending}
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

  const { data: conversations = [], isLoading } = useQuery<Conversation[]>({
    queryKey: ["/api/sms/conversations"],
    refetchInterval: 10000,
  });

  const handleSelectConversation = (phone: string, name: string | null) => {
    setSelectedPhone(phone);
    setSelectedName(name);
    queryClient.invalidateQueries({ queryKey: ["/api/sms/unread-count"] });
  };

  const handleBack = () => {
    setSelectedPhone(null);
    setSelectedName(null);
  };

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-120px)]">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b">
        <h1 className="text-xl font-semibold">Messages</h1>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className={`w-full md:w-80 md:border-r flex-shrink-0 overflow-y-auto ${
          selectedPhone ? "hidden md:block" : ""
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

        <div className={`flex-1 ${selectedPhone ? "" : "hidden md:flex md:items-center md:justify-center"}`}>
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
}
