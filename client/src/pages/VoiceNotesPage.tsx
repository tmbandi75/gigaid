import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VoiceNoteSummarizer } from "@/components/ai/VoiceNoteSummarizer";
import { VoiceNotesHistory } from "@/components/ai/VoiceNotesHistory";
import { Mic, History } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

export default function VoiceNotesPage() {
  const [activeTab, setActiveTab] = useState("record");
  const isMobile = useIsMobile();

  const renderMobileHeader = () => (
    <div className="mb-6">
      <h1 className="text-2xl font-bold" data-testid="text-voice-notes-title">Voice Notes</h1>
      <p className="text-muted-foreground mt-1">
        Record notes on the go and let AI summarize them for you
      </p>
    </div>
  );

  const renderDesktopHeader = () => (
    <div className="border-b bg-background sticky top-0 z-[999]">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-5">
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/10 to-violet-500/10 flex items-center justify-center">
              <Mic className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground" data-testid="text-voice-notes-title">Voice Notes</h1>
              <p className="text-sm text-muted-foreground">Record notes on the go and let AI summarize them for you</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderMobileLayout = () => (
    <div className="flex-1 p-4 overflow-y-auto" data-testid="voice-notes-page">
      <div className="max-w-2xl mx-auto">
        {renderMobileHeader()}

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

        <div className="h-6" />
      </div>
    </div>
  );

  const renderDesktopLayout = () => (
    <div className="flex flex-col min-h-full bg-background" data-testid="voice-notes-page">
      {renderDesktopHeader()}

      <div className="flex-1 max-w-7xl mx-auto w-full px-6 lg:px-8 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 mb-4 max-w-md">
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

  return isMobile ? renderMobileLayout() : renderDesktopLayout();
}
