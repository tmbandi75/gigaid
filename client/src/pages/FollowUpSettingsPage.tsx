import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiFetch";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Bot, Clock, MessageSquare, Save, Loader2 } from "lucide-react";

interface FollowUpRule {
  ruleType: string;
  enabled: boolean;
  delayHours: number;
  messageTemplate: string;
}

const RULE_META: Record<string, { name: string; description: string }> = {
  no_reply: { name: "No Reply Follow-Up", description: "Send when a client hasn't responded" },
  quote_pending: { name: "Quote Pending", description: "Send when a quote hasn't been accepted" },
  unpaid_invoice: { name: "Unpaid Invoice", description: "Send when an invoice remains unpaid" },
};

const RULE_ORDER = ["no_reply", "quote_pending", "unpaid_invoice"];

export default function FollowUpSettingsPage() {
  const { toast } = useToast();
  const [rules, setRules] = useState<FollowUpRule[]>([]);

  const { data, isLoading } = useQuery<FollowUpRule[]>({
    queryKey: QUERY_KEYS.followUpRules(),
  });

  useEffect(() => {
    if (data) {
      const mapped = RULE_ORDER.map((type) => {
        const existing = data.find((r) => r.ruleType === type);
        return existing
          ? { ruleType: existing.ruleType, enabled: existing.enabled, delayHours: existing.delayHours, messageTemplate: existing.messageTemplate || "" }
          : { ruleType: type, enabled: true, delayHours: 24, messageTemplate: "" };
      });
      setRules(mapped);
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch<FollowUpRule[]>("/api/follow-up-rules", {
        method: "PUT",
        body: JSON.stringify({ rules }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.followUpRules() });
      toast({ title: "Saved", description: "Follow-up rules updated successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save follow-up rules.", variant: "destructive" });
    },
  });

  const updateRule = (index: number, field: keyof FollowUpRule, value: any) => {
    setRules((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]" data-testid="loading-spinner">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center h-10 w-10 rounded-md bg-primary/10">
          <Bot className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold" data-testid="text-page-title">Auto Follow-Ups</h1>
          <p className="text-sm text-muted-foreground" data-testid="text-page-subtitle">
            Customize when automatic follow-up messages are sent
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {rules.map((rule, index) => {
          const meta = RULE_META[rule.ruleType];
          return (
            <Card key={rule.ruleType} data-testid={`card-rule-${rule.ruleType}`}>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <MessageSquare className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-sm" data-testid={`text-rule-name-${rule.ruleType}`}>
                        {meta?.name}
                      </p>
                      <p className="text-xs text-muted-foreground" data-testid={`text-rule-desc-${rule.ruleType}`}>
                        {meta?.description}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={rule.enabled}
                    onCheckedChange={(checked) => updateRule(index, "enabled", checked)}
                    data-testid={`switch-enabled-${rule.ruleType}`}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5 text-xs">
                    <Clock className="h-3.5 w-3.5" />
                    Wait time (hours)
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    max={720}
                    value={rule.delayHours}
                    onChange={(e) => updateRule(index, "delayHours", parseInt(e.target.value) || 1)}
                    disabled={!rule.enabled}
                    data-testid={`input-delay-${rule.ruleType}`}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Message template</Label>
                  <Textarea
                    value={rule.messageTemplate}
                    onChange={(e) => updateRule(index, "messageTemplate", e.target.value)}
                    rows={3}
                    disabled={!rule.enabled}
                    className="resize-none text-sm"
                    data-testid={`textarea-template-${rule.ruleType}`}
                  />
                  <p className="text-xs text-muted-foreground">
                    Use <code className="bg-muted px-1 rounded text-xs">{"{{client_first_name}}"}</code> to personalize
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="w-full"
        data-testid="button-save-rules"
      >
        {mutation.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <Save className="h-4 w-4 mr-2" />
        )}
        Save Changes
      </Button>
    </div>
  );
}
