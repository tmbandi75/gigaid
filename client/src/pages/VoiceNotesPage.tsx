import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VoiceNoteSummarizer } from "@/components/ai/VoiceNoteSummarizer";
import { VoiceNotesHistory } from "@/components/ai/VoiceNotesHistory";
import { Mic, History } from "lucide-react";

export default function VoiceNotesPage() {
  const [activeTab, setActiveTab] = useState("record");

  return (
    <div className="flex-1 p-4 md:p-6 overflow-y-auto" data-testid="voice-notes-page">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold" data-testid="text-voice-notes-title">Voice Notes</h1>
          <p className="text-muted-foreground mt-1">
            Record notes on the go and let AI summarize them for you
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="record" className="flex items-center gap-2" data-testid="tab-record">
              <Mic className="h-4 w-4" />
              Record
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2" data-testid="tab-history">
              <History className="h-4 w-4" />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="record">
            <VoiceNoteSummarizer 
              onNoteSaved={() => setActiveTab("history")}
            />
          </TabsContent>

          <TabsContent value="history">
            <VoiceNotesHistory />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
