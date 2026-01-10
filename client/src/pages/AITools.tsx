import { useState } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TextToPlanInput } from "@/components/ai/TextToPlanInput";
import { SmartScheduling } from "@/components/ai/SmartScheduling";
import { FollowUpComposer } from "@/components/ai/FollowUpComposer";
import { VoiceNoteSummarizer } from "@/components/ai/VoiceNoteSummarizer";
import { ReferralMessageAI } from "@/components/ai/ReferralMessageAI";
import { BookingInsightsDashboard } from "@/components/ai/BookingInsightsDashboard";
import { UnlockNudge } from "@/components/ai/UnlockNudge";
import { NewServiceAIInput } from "@/components/ai/NewServiceAIInput";
import { ReviewDraftGenerator } from "@/components/ai/ReviewDraftGenerator";
import { ClientTags } from "@/components/ai/ClientTags";
import { Sparkles, Calendar, MessageSquare, Mic, Share2, TrendingUp, Lightbulb, Plus, Star, Tags } from "lucide-react";

const tabs = [
  { id: "jobs", label: "Jobs", icon: Sparkles },
  { id: "schedule", label: "Schedule", icon: Calendar },
  { id: "messages", label: "Messages", icon: MessageSquare },
  { id: "voice", label: "Voice", icon: Mic },
  { id: "growth", label: "Growth", icon: TrendingUp },
  { id: "crm", label: "CRM", icon: Tags },
];

export default function AITools() {
  const [activeTab, setActiveTab] = useState("jobs");

  return (
    <div className="flex flex-col min-h-full" data-testid="page-ai-tools">
      <TopBar title="AI Tools" showActions={false} />

      <div className="px-4 py-4 flex-1">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">AI-Powered Features</h2>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full flex overflow-x-auto" data-testid="tabs-list-ai-tools">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="flex-1 min-w-[80px]"
                data-testid={`tab-${tab.id}`}
              >
                <tab.icon className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <ScrollArea className="mt-4">
            <TabsContent value="jobs" className="space-y-4 mt-0">
              <TextToPlanInput
                onJobCreated={(job) => {
                  console.log("Job created:", job);
                }}
              />
              <NewServiceAIInput
                onServicesCreated={(services) => {
                  console.log("Services created:", services);
                }}
              />
            </TabsContent>

            <TabsContent value="schedule" className="space-y-4 mt-0">
              <SmartScheduling
                jobDuration={60}
                onSelectSlot={(date, time) => {
                  console.log("Slot selected:", date, time);
                }}
              />
            </TabsContent>

            <TabsContent value="messages" className="space-y-4 mt-0">
              <FollowUpComposer
                clientName="Demo Client"
                context="job_completed"
                lastService="Plumbing Repair"
              />
              <ReviewDraftGenerator
                clientName="Demo Client"
                jobName="Kitchen Sink Repair"
              />
            </TabsContent>

            <TabsContent value="voice" className="space-y-4 mt-0">
              <VoiceNoteSummarizer
                onSummaryComplete={(summary) => {
                  console.log("Summary:", summary);
                }}
              />
            </TabsContent>

            <TabsContent value="growth" className="space-y-4 mt-0">
              <ReferralMessageAI
                link="https://gigaid.app/book/demo"
                providerName="Demo Provider"
                serviceCategory="plumbing"
              />
              <BookingInsightsDashboard />
              <UnlockNudge
                completedFeatures={["profile"]}
                incompleteFeatures={["services", "availability", "public_profile"]}
              />
            </TabsContent>

            <TabsContent value="crm" className="space-y-4 mt-0">
              <ClientTags
                clientHistory={{
                  name: "Demo Client",
                  totalJobs: 5,
                  totalSpent: 75000,
                  lastJobDate: new Date().toISOString(),
                  cancellations: 0,
                  noShows: 0,
                  averageRating: 4.8,
                  paymentHistory: "prompt",
                  referrals: 2,
                }}
              />
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </div>
    </div>
  );
}
