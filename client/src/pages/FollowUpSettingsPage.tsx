import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiFetch";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bot,
  MessageSquare,
  FileText,
  Receipt,
  Save,
  Loader2,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  Info,
} from "lucide-react";
import { ApproachingLimitBanner } from "@/components/upgrade/ApproachingLimitBanner";
import { SmsOptOutBanner } from "@/components/settings/SmsOptOutBanner";
import { useLocation } from "wouter";

interface FollowUpRule {
  ruleType: string;
  enabled: boolean;
  delayHours: number;
  messageTemplate: string;
}

const RULE_META: Record<
  string,
  {
    name: string;
    description: string;
    example: string;
    icon: typeof MessageSquare;
    color: string;
    bgColor: string;
  }
> = {
  no_reply: {
    name: "No Reply",
    description: "When a client doesn't respond to your message",
    example: "A client you texted 2 days ago still hasn't replied",
    icon: MessageSquare,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
  },
  quote_pending: {
    name: "Quote Pending",
    description: "When a quote you sent hasn't been accepted yet",
    example: "You sent a quote 3 days ago and haven't heard back",
    icon: FileText,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
  },
  unpaid_invoice: {
    name: "Unpaid Invoice",
    description: "When an invoice hasn't been paid on time",
    example: "An invoice is overdue and payment hasn't come through",
    icon: Receipt,
    color: "text-rose-600 dark:text-rose-400",
    bgColor: "bg-rose-100 dark:bg-rose-900/30",
  },
};

const RULE_ORDER = ["no_reply", "quote_pending", "unpaid_invoice"];

const DELAY_OPTIONS = [
  { value: "6", label: "6 hours" },
  { value: "12", label: "12 hours" },
  { value: "24", label: "1 day" },
  { value: "48", label: "2 days" },
  { value: "72", label: "3 days" },
  { value: "120", label: "5 days" },
  { value: "168", label: "1 week" },
];

function getDelayLabel(hours: number): string {
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days === 7) return "1 week";
  return `${days}d`;
}

export default function FollowUpSettingsPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [rules, setRules] = useState<FollowUpRule[]>([]);
  const [expandedRule, setExpandedRule] = useState<string | null>(null);

  const { data, isLoading } = useQuery<FollowUpRule[]>({
    queryKey: QUERY_KEYS.followUpRules(),
  });

  useEffect(() => {
    if (data) {
      const mapped = RULE_ORDER.map((type) => {
        const existing = data.find((r) => r.ruleType === type);
        return existing
          ? {
              ruleType: existing.ruleType,
              enabled: existing.enabled,
              delayHours: existing.delayHours,
              messageTemplate: existing.messageTemplate || "",
            }
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
      toast({ title: "Saved", description: "Your auto follow-up settings have been updated." });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateRule = (index: number, field: keyof FollowUpRule, value: any) => {
    setRules((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const toggleExpand = (ruleType: string) => {
    setExpandedRule((prev) => (prev === ruleType ? null : ruleType));
  };

  const enabledCount = rules.filter((r) => r.enabled).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]" data-testid="loading-spinner">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6 pb-32">
      <ApproachingLimitBanner capability="sms.auto_followups" source="follow_up_settings" />
      <SmsOptOutBanner />
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/more")}
          className="shrink-0"
          data-testid="button-back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 shrink-0">
          <Bot className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold" data-testid="text-page-title">
            Auto Follow-Ups
          </h1>
          <p className="text-sm text-muted-foreground" data-testid="text-page-subtitle">
            {enabledCount} of {rules.length} active
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 p-4">
        <div className="flex gap-3">
          <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900 dark:text-blue-200">
            <p className="font-medium">How it works</p>
            <p className="text-blue-700 dark:text-blue-300 mt-1">
              When enabled, GigAid will automatically send a follow-up text to your clients after the wait time you set. You can customize each message.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {rules.map((rule, index) => {
          const meta = RULE_META[rule.ruleType];
          if (!meta) return null;
          const Icon = meta.icon;
          const isExpanded = expandedRule === rule.ruleType;

          return (
            <Card
              key={rule.ruleType}
              className={`transition-all duration-200 overflow-hidden ${
                rule.enabled
                  ? "border-border"
                  : "border-muted opacity-70"
              }`}
              data-testid={`card-rule-${rule.ruleType}`}
            >
              <CardContent className="p-0">
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer active:bg-muted/50 select-none"
                  onClick={() => toggleExpand(rule.ruleType)}
                  data-testid={`toggle-expand-${rule.ruleType}`}
                >
                  <div
                    className={`flex items-center justify-center h-10 w-10 rounded-lg shrink-0 ${meta.bgColor}`}
                  >
                    <Icon className={`h-5 w-5 ${meta.color}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p
                        className="font-medium text-sm"
                        data-testid={`text-rule-name-${rule.ruleType}`}
                      >
                        {meta.name}
                      </p>
                      {rule.enabled ? (
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0 h-4 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          data-testid={`badge-active-${rule.ruleType}`}
                        >
                          Active
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0 h-4"
                          data-testid={`badge-off-${rule.ruleType}`}
                        >
                          Off
                        </Badge>
                      )}
                    </div>
                    <p
                      className="text-xs text-muted-foreground mt-0.5"
                      data-testid={`text-rule-desc-${rule.ruleType}`}
                    >
                      {rule.enabled
                        ? `Sends after ${getDelayLabel(rule.delayHours)}`
                        : meta.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={rule.enabled}
                      onCheckedChange={(checked) => {
                        updateRule(index, "enabled", checked);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Toggle ${meta.name}`}
                      data-testid={`switch-enabled-${rule.ruleType}`}
                    />
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium">Example:</span> {meta.example}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Wait before sending
                      </label>
                      <Select
                        value={String(rule.delayHours)}
                        onValueChange={(v) =>
                          updateRule(index, "delayHours", parseInt(v))
                        }
                        disabled={!rule.enabled}
                      >
                        <SelectTrigger
                          className="w-full"
                          data-testid={`select-delay-${rule.ruleType}`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DELAY_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Message
                      </label>
                      <Textarea
                        value={rule.messageTemplate}
                        onChange={(e) =>
                          updateRule(index, "messageTemplate", e.target.value)
                        }
                        rows={3}
                        disabled={!rule.enabled}
                        className="resize-none text-sm"
                        placeholder="Write your follow-up message..."
                        data-testid={`textarea-template-${rule.ruleType}`}
                      />
                      <p className="text-xs text-muted-foreground">
                        Tip: Use{" "}
                        <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">
                          {"{{client_first_name}}"}
                        </code>{" "}
                        to include the client's name
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="fixed bottom-20 left-0 right-0 px-4 pb-4 bg-gradient-to-t from-background via-background to-transparent pt-6 z-10">
        <div className="max-w-2xl mx-auto">
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="w-full h-12 text-base bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
            data-testid="button-save-rules"
          >
            {mutation.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
            ) : (
              <Save className="h-5 w-5 mr-2" />
            )}
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}
