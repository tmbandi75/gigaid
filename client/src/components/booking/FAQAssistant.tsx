import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { HelpCircle, X, Loader2, Send, Sparkles } from "lucide-react";

interface FAQAssistantProps {
  slug: string;
  providerName?: string;
}

const SUGGESTED_QUESTIONS = [
  "What's the cancellation policy?",
  "How do I pay for the service?",
  "What should I prepare before the visit?",
  "How long does a typical job take?",
];

export function FAQAssistant({ slug, providerName }: FAQAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);

  const askMutation = useMutation({
    mutationFn: async (q: string) => {
      const res = await apiRequest("POST", "/api/public/ai/faq", { question: q, slug });
      return res.json() as Promise<{ answer: string }>;
    },
    onSuccess: (data) => {
      setAnswer(data.answer);
    },
  });

  const handleAsk = (q: string) => {
    setQuestion(q);
    setAnswer(null);
    askMutation.mutate(q);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (question.trim()) {
      handleAsk(question);
    }
  };

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-50 shadow-lg"
        data-testid="button-open-faq"
      >
        <HelpCircle className="h-4 w-4 mr-1" />
        Questions?
      </Button>
    );
  }

  return (
    <div 
      className="fixed bottom-4 right-4 z-50 w-80 bg-background border rounded-lg shadow-xl"
      data-testid="faq-assistant-popup"
    >
      <div className="flex items-center justify-between p-3 border-b">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="font-medium text-sm">FAQ Assistant</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen(false)}
          data-testid="button-close-faq"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-3 max-h-64 overflow-y-auto">
        {!answer && !askMutation.isPending && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground mb-3">
              Common questions:
            </p>
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => handleAsk(q)}
                className="block w-full text-left text-sm p-2 rounded-lg hover-elevate border"
                data-testid={`faq-suggestion-${q.slice(0, 20)}`}
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {askMutation.isPending && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {answer && (
          <div className="space-y-3">
            <div className="p-2 rounded-lg bg-muted text-sm">
              <span className="font-medium">Q:</span> {question}
            </div>
            <div className="p-2 rounded-lg bg-primary/10 text-sm">
              <span className="font-medium">A:</span> {answer}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setAnswer(null); setQuestion(""); }}
              className="w-full"
              data-testid="button-ask-another"
            >
              Ask another question
            </Button>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-3 border-t flex gap-2">
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Type your question..."
          className="flex-1"
          data-testid="input-faq-question"
        />
        <Button
          type="submit"
          size="icon"
          disabled={!question.trim() || askMutation.isPending}
          data-testid="button-submit-faq"
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
