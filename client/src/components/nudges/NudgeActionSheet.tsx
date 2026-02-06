import { useState, useEffect } from "react";
import { useApiMutation } from "@/hooks/useApiMutation";
import { X, Send, Clock, FileText, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiFetch";
import type { AiNudge } from "@shared/schema";

interface NudgeActionSheetProps {
  nudge: AiNudge | null;
  open: boolean;
  onClose: () => void;
  onCreateJob?: (prefill: any) => void;
  onCreateInvoice?: (prefill: any) => void;
}

export function NudgeActionSheet({ 
  nudge, 
  open, 
  onClose,
  onCreateJob,
  onCreateInvoice,
}: NudgeActionSheetProps) {
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  
  useEffect(() => {
    if (nudge?.actionPayload) {
      const payload = JSON.parse(nudge.actionPayload);
      setMessage(payload.suggestedMessage || payload.reminderMessage || payload.firmerMessage || "");
    } else {
      setMessage("");
    }
  }, [nudge]);

  // Trust signal messages based on nudge type
  const getTrustSignal = (nudgeType: string, actionType: string): { title: string; description: string } => {
    const signals: Record<string, { title: string; description: string }> = {
      lead_follow_up: { 
        title: "Protected", 
        description: "You reached out before this lead went cold. Response rates drop 60% after 24 hours." 
      },
      lead_silent_rescue: { 
        title: "Good save", 
        description: "Checking in now prevents this lead from slipping away." 
      },
      lead_convert_to_job: { 
        title: "Locked in", 
        description: "This opportunity is now secured on your calendar." 
      },
      lead_hot_alert: { 
        title: "Quick action", 
        description: "Fast responses win 78% more jobs. You're ahead of the competition." 
      },
      lead_conversion_required: { 
        title: "Opportunity protected", 
        description: "This high-intent lead is now safely booked." 
      },
      invoice_reminder: { 
        title: "Payment nudged", 
        description: "Gentle reminders recover 85% of delayed payments." 
      },
      invoice_reminder_firm: { 
        title: "Following up", 
        description: "Consistent follow-up protects your cash flow." 
      },
      invoice_overdue_escalation: { 
        title: "Taking action", 
        description: "You're not letting this payment slip through the cracks." 
      },
      invoice_create_from_job_done: { 
        title: "Getting paid", 
        description: "Invoicing quickly means faster payment. You're protecting your earnings." 
      },
      job_stuck: { 
        title: "Updated", 
        description: "Keeping records current protects you if questions come up later." 
      },
      job_invoice_escalation: { 
        title: "Money protected", 
        description: "You're making sure this payment doesn't get forgotten." 
      },
    };
    return signals[nudgeType] || { title: "Done", description: "Action completed." };
  };

  const dismissMutation = useApiMutation(
    () => apiFetch(`/api/ai/nudges/${nudge?.id}/dismiss`, { method: "POST" }),
    [["/api/ai/nudges"]],
    {
      onSuccess: () => {
        toast({ 
          title: "Got it", 
          description: "I'll trust your judgment on this one." 
        });
        onClose();
      },
    }
  );

  const snoozeMutation = useApiMutation(
    (hours: number) => apiFetch(`/api/ai/nudges/${nudge?.id}/snooze`, { method: "POST", body: JSON.stringify({ hours }) }),
    [["/api/ai/nudges"]],
    {
      onSuccess: () => {
        toast({ 
          title: "I'll keep watching", 
          description: "I'll remind you tomorrow. This stays on my radar." 
        });
        onClose();
      },
    }
  );

  const actMutation = useApiMutation(
    (actionType: string) => apiFetch<any>(`/api/ai/nudges/${nudge?.id}/act`, {
      method: "POST",
      body: JSON.stringify({ action_type: actionType, payload: { message } }),
    }),
    [["/api/ai/nudges"]],
    {
      onSuccess: (data: any, actionType: string) => {
        const trustSignal = getTrustSignal(nudge?.nudgeType || "", actionType);
        
        if (actionType === "create_job" && data?.jobPrefill) {
          onCreateJob?.(data.jobPrefill);
          toast({ title: trustSignal.title, description: trustSignal.description });
        } else if (actionType === "create_invoice" && data?.invoicePrefill) {
          onCreateInvoice?.(data.invoicePrefill);
          toast({ title: trustSignal.title, description: trustSignal.description });
        } else if (actionType === "send_message") {
          toast({ 
            title: trustSignal.title, 
            description: trustSignal.description 
          });
          navigator.clipboard.writeText(message);
        }
        
        onClose();
      },
    }
  );

  if (!nudge) return null;

  const isMessageNudge = [
    "lead_follow_up",
    "lead_silent_rescue",
    "invoice_reminder",
    "invoice_overdue_escalation",
  ].includes(nudge.nudgeType);

  const isConvertNudge = nudge.nudgeType === "lead_convert_to_job";
  const isInvoiceNudge = nudge.nudgeType === "invoice_create_from_job_done";

  const handlePrimaryAction = () => {
    if (isMessageNudge) {
      actMutation.mutate("send_message");
    } else if (isConvertNudge) {
      actMutation.mutate("create_job");
    } else if (isInvoiceNudge) {
      actMutation.mutate("create_invoice");
    }
  };

  const isPending = dismissMutation.isPending || snoozeMutation.isPending || actMutation.isPending;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader className="text-left pb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <SheetTitle className="text-lg">Heads up</SheetTitle>
              <SheetDescription className="text-sm">
                {nudge.explainText}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-4">
          {isMessageNudge && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Edit message before sending
              </label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                className="resize-none"
                data-testid="nudge-message-input"
              />
            </div>
          )}

          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={handlePrimaryAction}
              disabled={isPending}
              data-testid="nudge-action-primary"
            >
              {actMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : isMessageNudge ? (
                <Send className="h-4 w-4 mr-2" />
              ) : (
                <FileText className="h-4 w-4 mr-2" />
              )}
              {isMessageNudge ? "Copy Message" : isConvertNudge ? "Create Job" : "Create Invoice"}
            </Button>
          </div>

          <div className="flex gap-2 pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => snoozeMutation.mutate(24)}
              disabled={isPending}
              data-testid="nudge-snooze-btn"
            >
              <Clock className="h-4 w-4 mr-1" />
              Later
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="flex-1"
              onClick={() => dismissMutation.mutate()}
              disabled={isPending}
              data-testid="nudge-dismiss-btn"
            >
              <X className="h-4 w-4 mr-1" />
              Dismiss
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
