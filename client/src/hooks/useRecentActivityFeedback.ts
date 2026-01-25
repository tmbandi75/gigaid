import { useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface RecentMessage {
  id: string;
  type: string;
  status: string;
  sentAt: string | null;
  jobId: string;
}

interface RecentActivity {
  recentMessages: RecentMessage[];
  recentPayments: { invoiceId: string; paidAt: string }[];
}

const STORAGE_KEY_MESSAGES = "gigaid_shown_messages";
const STORAGE_KEY_PAYMENTS = "gigaid_shown_payments";

function getStoredSet(key: string): Set<string> {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      return new Set(JSON.parse(stored));
    }
  } catch {
    // Ignore parse errors
  }
  return new Set();
}

function persistSet(key: string, set: Set<string>) {
  try {
    // Keep only last 100 entries to prevent unbounded growth
    const arr = Array.from(set).slice(-100);
    localStorage.setItem(key, JSON.stringify(arr));
  } catch {
    // Ignore storage errors
  }
}

export function useRecentActivityFeedback() {
  const { toast } = useToast();
  const shownMessagesRef = useRef<Set<string>>(getStoredSet(STORAGE_KEY_MESSAGES));
  const shownPaymentsRef = useRef<Set<string>>(getStoredSet(STORAGE_KEY_PAYMENTS));
  
  const { data: activity } = useQuery<RecentActivity>({
    queryKey: ["/api/recent-activity"],
    refetchInterval: 30000,
    staleTime: 10000,
  });
  
  useEffect(() => {
    if (!activity) return;
    
    const messageTypeLabels: Record<string, string> = {
      followup: "Follow-up sent",
      payment_reminder: "Payment reminder sent",
      review_request: "Review request sent",
      confirmation: "Booking confirmation sent",
    };
    
    let messagesUpdated = false;
    let paymentsUpdated = false;
    
    for (const msg of activity.recentMessages) {
      if (msg.status === "sent" && msg.sentAt && !shownMessagesRef.current.has(msg.id)) {
        const label = messageTypeLabels[msg.type] || "Message sent";
        toast({
          title: label,
          description: "GigAid handled it automatically.",
        });
        shownMessagesRef.current.add(msg.id);
        messagesUpdated = true;
      }
    }
    
    for (const payment of activity.recentPayments) {
      if (!shownPaymentsRef.current.has(payment.invoiceId)) {
        toast({
          title: "Invoice paid",
          description: "Payment received from your client.",
        });
        shownPaymentsRef.current.add(payment.invoiceId);
        paymentsUpdated = true;
      }
    }
    
    // Persist to localStorage after updates
    if (messagesUpdated) {
      persistSet(STORAGE_KEY_MESSAGES, shownMessagesRef.current);
    }
    if (paymentsUpdated) {
      persistSet(STORAGE_KEY_PAYMENTS, shownPaymentsRef.current);
    }
  }, [activity, toast]);
}
