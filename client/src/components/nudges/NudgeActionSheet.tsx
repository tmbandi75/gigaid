import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { apiRequest } from "@/lib/queryClient";
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
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  
  useEffect(() => {
    if (nudge?.actionPayload) {
      const payload = JSON.parse(nudge.actionPayload);
      setMessage(payload.suggestedMessage || payload.reminderMessage || payload.firmerMessage || "");
    } else {
      setMessage("");
    }
  }, [nudge]);

  const dismissMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/ai/nudges/${nudge?.id}/dismiss`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/nudges"] });
      toast({ title: "Dismissed", description: "Nudge dismissed" });
      onClose();
    },
  });

  const snoozeMutation = useMutation({
    mutationFn: async (hours: number) => {
      await apiRequest("POST", `/api/ai/nudges/${nudge?.id}/snooze`, { hours });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/nudges"] });
      toast({ title: "Snoozed", description: "We'll remind you later" });
      onClose();
    },
  });

  const actMutation = useMutation({
    mutationFn: async (actionType: string) => {
      const res = await apiRequest("POST", `/api/ai/nudges/${nudge?.id}/act`, {
        action_type: actionType,
        payload: { message },
      });
      return res.json();
    },
    onSuccess: (data, actionType) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/nudges"] });
      
      if (actionType === "create_job" && data.jobPrefill) {
        onCreateJob?.(data.jobPrefill);
      } else if (actionType === "create_invoice" && data.invoicePrefill) {
        onCreateInvoice?.(data.invoicePrefill);
      } else if (actionType === "send_message") {
        toast({ 
          title: "Message copied!", 
          description: "Paste it in your messaging app" 
        });
        navigator.clipboard.writeText(message);
      }
      
      onClose();
    },
  });

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
              <SheetTitle className="text-lg">AI Suggestion</SheetTitle>
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
