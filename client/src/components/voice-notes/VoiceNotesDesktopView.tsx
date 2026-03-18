import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { VoiceNoteSummarizer } from "@/components/ai/VoiceNoteSummarizer";
import { VoiceNotesHistory } from "@/components/ai/VoiceNotesHistory";
import { Mic, History } from "lucide-react";

interface VoiceNotesDesktopViewProps {
  onNoteSaved?: (noteId: string) => void;
}

export function VoiceNotesDesktopView({ onNoteSaved }: VoiceNotesDesktopViewProps) {
  return (
    <div className="max-w-6xl mx-auto py-8 px-6 lg:px-8" data-testid="desktop-voice-notes">
      <div className="grid grid-cols-2 gap-8">
        <div className="space-y-4">
          <div className="flex items-center gap-3 px-1">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Mic className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Voice Recorder</h2>
              <p className="text-sm text-muted-foreground">
                Record notes and GigAid will summarize them automatically.
              </p>
            </div>
          </div>

          <VoiceNoteSummarizer onNoteSaved={onNoteSaved} />
        </div>

        <div className="space-y-4">
          <Card className="rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <CardHeader className="p-6 pb-4">
              <div className="flex items-center gap-3 mb-1">
                <div className="h-10 w-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
                  <History className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <CardTitle className="text-lg">Recent Voice Notes</CardTitle>
                  <CardDescription className="text-sm">
                    Your saved recordings and AI summaries.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              <VoiceNotesHistory />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
