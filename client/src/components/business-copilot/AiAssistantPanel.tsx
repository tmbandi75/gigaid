import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sparkles,
  Send,
  MessageCircle,
} from "lucide-react";

const SUGGESTED_PROMPTS = [
  "How can I get more jobs this week?",
  "What should I charge for drywall repair?",
  "Which leads should I follow up with?",
];

export function AiAssistantPanel() {
  const [query, setQuery] = useState("");

  const handleSubmit = (text: string) => {
    if (!text.trim()) return;
    setQuery("");
  };

  return (
    <section data-testid="section-ai-assistant">
      <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        Ask GigAid
      </h2>
      <Card className="rounded-xl border shadow-sm">
        <CardContent className="p-5 space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <MessageCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Ask about your business..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit(query)}
                className="pl-10 h-11 rounded-xl"
                aria-label="Ask GigAid a question"
                data-testid="input-ai-assistant-query"
              />
            </div>
            <Button
              size="icon"
              className="h-11 w-11 rounded-xl"
              onClick={() => handleSubmit(query)}
              disabled={!query.trim()}
              aria-label="Send question"
              data-testid="button-ai-assistant-send"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground font-medium">Suggested</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_PROMPTS.map((prompt, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  size="sm"
                  className="rounded-full text-xs h-8"
                  onClick={() => handleSubmit(prompt)}
                  data-testid={`button-ai-prompt-${idx}`}
                >
                  {prompt}
                </Button>
              ))}
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground/60 text-center">
            AI responses are coming soon. Your questions help us build better answers.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
