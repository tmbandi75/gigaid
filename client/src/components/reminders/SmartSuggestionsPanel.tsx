import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Calendar,
  Send,
  X,
} from "lucide-react";

interface Suggestion {
  id: string;
  type: "appointment" | "review" | "payment";
  clientName: string;
  detail: string;
  icon: typeof Calendar;
  gradient: string;
}

const PLACEHOLDER_SUGGESTIONS: Suggestion[] = [];

const TYPE_LABELS: Record<string, string> = {
  appointment: "Appointment Reminder",
  review: "Review Request",
  payment: "Payment Reminder",
};

interface SmartSuggestionsPanelProps {
  onSendReminder?: (suggestion: Suggestion) => void;
}

export function SmartSuggestionsPanel({ onSendReminder }: SmartSuggestionsPanelProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visibleSuggestions = PLACEHOLDER_SUGGESTIONS.filter(s => !dismissed.has(s.id));

  if (visibleSuggestions.length === 0) return null;

  return (
    <section data-testid="section-smart-suggestions">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        Smart Suggestions
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {visibleSuggestions.map((suggestion) => (
          <Card
            key={suggestion.id}
            className="rounded-xl border shadow-sm"
            data-testid={`card-suggestion-${suggestion.id}`}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3 mb-3">
                <div className={`h-9 w-9 rounded-lg bg-gradient-to-br ${suggestion.gradient} flex items-center justify-center flex-shrink-0`}>
                  <suggestion.icon className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">{TYPE_LABELS[suggestion.type]}</p>
                  <p className="font-semibold text-sm truncate">{suggestion.clientName}</p>
                  <p className="text-xs text-muted-foreground">{suggestion.detail}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 h-8 text-xs rounded-lg"
                  onClick={() => onSendReminder?.(suggestion)}
                  data-testid={`button-send-suggestion-${suggestion.id}`}
                >
                  <Send className="h-3 w-3 mr-1" />
                  Send Reminder
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setDismissed(prev => new Set(prev).add(suggestion.id))}
                  aria-label={`Dismiss suggestion for ${suggestion.clientName}`}
                  data-testid={`button-dismiss-suggestion-${suggestion.id}`}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
