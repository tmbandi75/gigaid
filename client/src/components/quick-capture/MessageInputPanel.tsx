import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Loader2, MessageSquare } from "lucide-react";
import { ExampleMessageChips } from "./ExampleMessageChips";

interface MessageInputPanelProps {
  sharedText: string;
  onTextChange: (text: string) => void;
  onParse: () => void;
  isParsing: boolean;
}

export function MessageInputPanel({
  sharedText,
  onTextChange,
  onParse,
  isParsing,
}: MessageInputPanelProps) {
  return (
    <Card className="rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 hover:shadow-md transition h-full flex flex-col">
      <CardContent className="p-6 flex flex-col flex-1 gap-5">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <MessageSquare className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Customer Message</h3>
            <p className="text-xs text-muted-foreground">
              Paste a customer message and GigAid will extract lead information.
            </p>
          </div>
        </div>

        <Textarea
          data-testid="input-shared-text-desktop"
          placeholder={`Paste a message from SMS, Facebook, Craigslist, email, or WhatsApp.\n\nExample:\nHi, I need a plumber to fix a leaking faucet.\nMy name is Sarah. Call me at 555-1234.`}
          value={sharedText}
          onChange={(e) => onTextChange(e.target.value)}
          className="flex-1 min-h-[240px] text-base bg-muted/30 border-2 focus:border-primary transition-colors resize-none"
        />

        <ExampleMessageChips onSelect={onTextChange} />

        <Button
          data-testid="button-parse-desktop"
          onClick={onParse}
          disabled={isParsing || !sharedText.trim()}
          className="w-full h-12 text-base font-medium"
          size="lg"
          aria-label="Extract Lead"
        >
          {isParsing ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5 mr-2" />
              Extract Lead
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
