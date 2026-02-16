import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiFetch";
import { useApiMutation } from "@/hooks/useApiMutation";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { 
  Clock, 
  MessageSquare, 
  Star,
  Loader2,
  Save,
  Calendar
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AutomationSettings {
  id: string;
  userId: string;
  postJobFollowupEnabled: boolean;
  followupDelayHours: number;
  followupTemplate: string;
  paymentReminderEnabled: boolean;
  paymentReminderDelayHours: number;
  paymentReminderTemplate: string;
  reviewLinkUrl: string | null;
  autoConfirmEnabled: boolean;
  confirmationTemplate: string | null;
}

export function AutomationSettings() {
  const { toast } = useToast();
  
  const { data: settings, isLoading } = useQuery<AutomationSettings>({
    queryKey: QUERY_KEYS.automationSettings(),
  });
  
  const [followupEnabled, setFollowupEnabled] = useState(true);
  const [followupDelay, setFollowupDelay] = useState("24");
  const [followupTemplate, setFollowupTemplate] = useState("");
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderDelay, setReminderDelay] = useState("24");
  const [reminderTemplate, setReminderTemplate] = useState("");
  const [reviewLink, setReviewLink] = useState("");
  const [confirmEnabled, setConfirmEnabled] = useState(true);
  const [confirmTemplate, setConfirmTemplate] = useState("");
  
  useEffect(() => {
    if (settings) {
      setFollowupEnabled(settings.postJobFollowupEnabled ?? true);
      setFollowupDelay(String(settings.followupDelayHours || 24));
      setFollowupTemplate(settings.followupTemplate || "");
      setReminderEnabled(settings.paymentReminderEnabled ?? true);
      setReminderDelay(String(settings.paymentReminderDelayHours || 24));
      setReminderTemplate(settings.paymentReminderTemplate || "");
      setReviewLink(settings.reviewLinkUrl || "");
      setConfirmEnabled(settings.autoConfirmEnabled ?? true);
      setConfirmTemplate(settings.confirmationTemplate || "");
    }
  }, [settings]);
  
  const saveMutation = useApiMutation(
    () => apiFetch("/api/automation-settings", {
      method: "PUT",
      body: JSON.stringify({
        postJobFollowupEnabled: followupEnabled,
        followupDelayHours: parseInt(followupDelay),
        followupTemplate,
        paymentReminderEnabled: reminderEnabled,
        paymentReminderDelayHours: parseInt(reminderDelay),
        paymentReminderTemplate: reminderTemplate,
        reviewLinkUrl: reviewLink || null,
        autoConfirmEnabled: confirmEnabled,
        confirmationTemplate: confirmTemplate || null,
      }),
    }),
    [QUERY_KEYS.automationSettings()],
    {
      onSuccess: () => {
        toast({ title: "Settings saved", description: "Your automation settings have been updated." });
      },
      onError: (error: any) => {
        toast({ 
          title: "Failed to save", 
          description: error.message || "Please try again.", 
          variant: "destructive" 
        });
      },
    }
  );
  
  if (isLoading) {
    return (
      <Card className="border-0 shadow-md" data-testid="card-automation">
        <CardContent className="p-4">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="border-0 shadow-md" data-testid="card-automation">
      <CardContent className="p-4">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
            <Clock className="h-4 w-4 text-white" />
          </div>
          Automation
        </h3>
        
        <p className="text-sm text-muted-foreground mb-4">
          Automatically send follow-ups after completing jobs. Messages are scheduled, never immediate.
        </p>
        
        <div className="space-y-6">
          <div className="p-4 rounded-lg border bg-muted/30">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-500" />
                <span className="font-medium text-sm">Auto Booking Confirmation</span>
              </div>
              <Switch
                checked={confirmEnabled}
                onCheckedChange={setConfirmEnabled}
                aria-label="Toggle Auto Booking Confirmation"
                data-testid="switch-confirm-enabled"
              />
            </div>
            
            {confirmEnabled && (
              <div className="space-y-3 mt-3">
                <p className="text-xs text-muted-foreground">
                  Automatically sends when you schedule or reschedule a job.
                </p>
                
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Message template ({confirmTemplate.length}/500)
                  </Label>
                  <Textarea
                    className="mt-1 text-sm"
                    rows={3}
                    maxLength={500}
                    value={confirmTemplate}
                    onChange={(e) => setConfirmTemplate(e.target.value)}
                    placeholder="Hi {{client_first_name}} — just confirming we're set for {{job_date}} at {{job_time}}..."
                    data-testid="textarea-confirm-template"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Use: {"{{client_first_name}}"}, {"{{job_date}}"}, {"{{job_time}}"}
                  </p>
                </div>
              </div>
            )}
          </div>
          
          <div className="p-4 rounded-lg border bg-muted/30">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">Auto Follow-up</span>
              </div>
              <Switch
                checked={followupEnabled}
                onCheckedChange={setFollowupEnabled}
                aria-label="Toggle Auto Follow-up"
                data-testid="switch-followup-enabled"
              />
            </div>
            
            {followupEnabled && (
              <div className="space-y-3 mt-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Send after</Label>
                  <Select value={followupDelay} onValueChange={setFollowupDelay}>
                    <SelectTrigger className="mt-1" data-testid="select-followup-delay">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="24">24 hours</SelectItem>
                      <SelectItem value="48">48 hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Message template ({followupTemplate.length}/500)
                  </Label>
                  <Textarea
                    className="mt-1 text-sm"
                    rows={3}
                    maxLength={500}
                    value={followupTemplate}
                    onChange={(e) => setFollowupTemplate(e.target.value)}
                    placeholder="Hi {{client_first_name}} — thanks again..."
                    data-testid="textarea-followup-template"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Use: {"{{client_first_name}}"}, {"{{client_name}}"}, {"{{job_title}}"}
                  </p>
                </div>
              </div>
            )}
          </div>
          
          <div className="p-4 rounded-lg border bg-muted/30">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-500" />
                <span className="font-medium text-sm">Payment Reminder</span>
              </div>
              <Switch
                checked={reminderEnabled}
                onCheckedChange={setReminderEnabled}
                aria-label="Toggle Payment Reminder"
                data-testid="switch-reminder-enabled"
              />
            </div>
            
            {reminderEnabled && (
              <div className="space-y-3 mt-3">
                <p className="text-xs text-muted-foreground">
                  Only sent if job has an unpaid invoice.
                </p>
                
                <div>
                  <Label className="text-xs text-muted-foreground">Send after</Label>
                  <Select value={reminderDelay} onValueChange={setReminderDelay}>
                    <SelectTrigger className="mt-1" data-testid="select-reminder-delay">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="24">24 hours</SelectItem>
                      <SelectItem value="48">48 hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Message template ({reminderTemplate.length}/500)
                  </Label>
                  <Textarea
                    className="mt-1 text-sm"
                    rows={3}
                    maxLength={500}
                    value={reminderTemplate}
                    onChange={(e) => setReminderTemplate(e.target.value)}
                    placeholder="Hi {{client_first_name}} — quick note..."
                    data-testid="textarea-reminder-template"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Use: {"{{client_first_name}}"}, {"{{job_title}}"}, {"{{invoice_link}}"}
                  </p>
                </div>
              </div>
            )}
          </div>
          
          <div className="p-4 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-2 mb-3">
              <Star className="h-4 w-4 text-yellow-500" />
              <span className="font-medium text-sm">Review Link</span>
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              Add a review link to include in follow-up messages (optional).
            </p>
            <Input
              type="url"
              placeholder="https://g.page/your-business/review"
              value={reviewLink}
              onChange={(e) => setReviewLink(e.target.value)}
              data-testid="input-review-link"
            />
          </div>
          
          <Button 
            className="w-full"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            data-testid="button-save-automation"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Automation Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
