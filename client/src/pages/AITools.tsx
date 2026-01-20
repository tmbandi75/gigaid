import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { DashboardSummary } from "@shared/schema";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TextToPlanInput } from "@/components/ai/TextToPlanInput";
import { SmartScheduling } from "@/components/ai/SmartScheduling";
import { FollowUpComposer } from "@/components/ai/FollowUpComposer";
import { VoiceNoteSummarizer } from "@/components/ai/VoiceNoteSummarizer";
import { VoiceNotesHistory } from "@/components/ai/VoiceNotesHistory";
import { ReferralMessageAI } from "@/components/ai/ReferralMessageAI";
import { BookingInsightsDashboard } from "@/components/ai/BookingInsightsDashboard";
import { UnlockNudge } from "@/components/ai/UnlockNudge";
import { NewServiceAIInput } from "@/components/ai/NewServiceAIInput";
import { ReviewDraftGenerator } from "@/components/ai/ReviewDraftGenerator";
import { ClientTags } from "@/components/ai/ClientTags";
import { EstimationTool } from "@/components/ai/EstimationTool";
import { 
  Sparkles, 
  Calendar, 
  Mic, 
  Share2, 
  TrendingUp, 
  Lightbulb, 
  Plus, 
  Star, 
  Tags,
  Wand2,
  Send,
  Zap,
  ChevronRight,
  X,
  Calculator,
  Lock,
} from "lucide-react";

interface AIFeature {
  id: string;
  title: string;
  description: string;
  icon: typeof Sparkles;
  category: "create" | "automate" | "grow";
  gradient: string;
  component: React.ReactNode;
  requiresUnlock?: boolean;
}

export default function AITools() {
  const [activeFeature, setActiveFeature] = useState<string | null>(null);

  const { data: summary } = useQuery<DashboardSummary>({
    queryKey: ["/api/dashboard/summary"],
  });

  // Advanced features unlock after first completed job, invoice sent, or payment collected
  const hasUnlockedAdvanced = (summary?.completedJobs ?? 0) > 0 || (summary?.totalEarnings ?? 0) > 0;

  const features: AIFeature[] = [
    {
      id: "text-to-plan",
      title: "Text to Job",
      description: "Type or speak a job description and let AI create it for you",
      icon: Wand2,
      category: "create",
      gradient: "from-violet-500 to-purple-600",
      component: (
        <TextToPlanInput
          onJobCreated={(job) => {
            console.log("Job created:", job);
            setActiveFeature(null);
          }}
        />
      ),
    },
    {
      id: "smart-schedule",
      title: "Smart Scheduling",
      description: "AI finds the best time slots based on your calendar",
      icon: Calendar,
      category: "automate",
      gradient: "from-blue-500 to-cyan-500",
      component: (
        <SmartScheduling
          jobDuration={60}
          onSelectSlot={(date, time) => {
            console.log("Slot selected:", date, time);
          }}
        />
      ),
    },
    {
      id: "follow-up",
      title: "Follow-Up Messages",
      description: "Generate personalized follow-up messages for clients",
      icon: Send,
      category: "automate",
      gradient: "from-emerald-500 to-teal-500",
      component: <FollowUpComposer />,
    },
    {
      id: "voice-notes",
      title: "Voice Notes",
      description: "Record voice memos and get AI-powered summaries",
      icon: Mic,
      category: "create",
      gradient: "from-rose-500 to-pink-500",
      component: (
        <Tabs defaultValue="record" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="record" data-testid="tab-record">Record</TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-history">Saved Notes</TabsTrigger>
          </TabsList>
          <TabsContent value="record">
            <VoiceNoteSummarizer
              onSummaryComplete={(summary) => {
                console.log("Summary:", summary);
              }}
            />
          </TabsContent>
          <TabsContent value="history">
            <VoiceNotesHistory />
          </TabsContent>
        </Tabs>
      ),
    },
    {
      id: "referral-message",
      title: "Referral Generator",
      description: "Create shareable referral messages to grow your business",
      icon: Share2,
      category: "grow",
      gradient: "from-amber-500 to-orange-500",
      requiresUnlock: true,
      component: (
        <ReferralMessageAI
          link="https://gigaid.app/book/demo"
          providerName="Demo Provider"
          serviceCategory="plumbing"
        />
      ),
    },
    {
      id: "booking-insights",
      title: "Get More Bookings",
      description: "See what's working and where you're losing jobs",
      icon: TrendingUp,
      category: "grow",
      gradient: "from-indigo-500 to-blue-600",
      requiresUnlock: true,
      component: <BookingInsightsDashboard />,
    },
    {
      id: "new-service",
      title: "Service Builder",
      description: "Instantly create new service offerings with AI",
      icon: Plus,
      category: "create",
      gradient: "from-fuchsia-500 to-purple-500",
      component: (
        <NewServiceAIInput
          onServicesCreated={(services) => {
            console.log("Services created:", services);
          }}
        />
      ),
    },
    {
      id: "review-draft",
      title: "Review Responses",
      description: "Draft professional responses to client reviews",
      icon: Star,
      category: "automate",
      gradient: "from-yellow-500 to-amber-500",
      component: (
        <ReviewDraftGenerator
          clientName="Demo Client"
          jobName="Kitchen Sink Repair"
        />
      ),
    },
    {
      id: "client-tags",
      title: "Know Who's Serious",
      description: "Spot ready-to-buy clients vs. tire kickers",
      icon: Tags,
      category: "grow",
      gradient: "from-cyan-500 to-blue-500",
      requiresUnlock: true,
      component: (
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
      ),
    },
    {
      id: "unlock-nudge",
      title: "Grow My Business",
      description: "Unlock your next revenue milestone",
      icon: Lightbulb,
      category: "grow",
      gradient: "from-green-500 to-emerald-500",
      requiresUnlock: true,
      component: (
        <UnlockNudge
          completedFeatures={["profile"]}
          incompleteFeatures={["services", "availability", "public_profile"]}
        />
      ),
    },
    {
      id: "estimation-tool",
      title: "Price Estimator",
      description: "AI-powered estimates for any job type",
      icon: Calculator,
      category: "create",
      gradient: "from-emerald-500 to-green-600",
      component: (
        <EstimationTool
          onEstimateComplete={(estimate) => {
            console.log("Estimate generated:", estimate);
          }}
        />
      ),
    },
  ];

  const categories = [
    { id: "create", label: "Create", icon: Wand2, color: "text-violet-500" },
    { id: "automate", label: "Automate", icon: Zap, color: "text-emerald-500" },
    { id: "grow", label: "Grow", icon: TrendingUp, color: "text-amber-500" },
  ];

  const activeFeatureData = features.find((f) => f.id === activeFeature);

  return (
    <div className="flex flex-col min-h-full bg-background" data-testid="page-ai-tools">
      <div className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-primary/5 to-background px-4 pt-6 pb-8">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-4 -right-4 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute top-1/2 -left-8 w-24 h-24 bg-violet-500/10 rounded-full blur-2xl" />
        </div>
        
        <div className="relative">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center shadow-lg">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Business Co-Pilot</h1>
              <p className="text-sm text-muted-foreground">See what works. Fix what doesn't. Get paid faster.</p>
            </div>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 px-4 pb-24">
        <div className="py-4 space-y-6">
          {categories.map((category) => {
            const categoryFeatures = features.filter((f) => f.category === category.id);
            return (
              <div key={category.id} className="space-y-3">
                <div className="flex items-center gap-2">
                  <category.icon className={`h-4 w-4 ${category.color}`} />
                  <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                    {category.label}
                  </h2>
                  <Badge variant="secondary" className="text-xs">
                    {categoryFeatures.length}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-1 gap-3">
                  {categoryFeatures.map((feature) => {
                    const isLocked = feature.requiresUnlock && !hasUnlockedAdvanced;
                    return (
                      <Card
                        key={feature.id}
                        className={`group overflow-visible border-0 shadow-sm ${
                          isLocked 
                            ? "opacity-60 cursor-not-allowed" 
                            : "cursor-pointer hover-elevate"
                        }`}
                        onClick={() => !isLocked && setActiveFeature(feature.id)}
                        data-testid={`card-feature-${feature.id}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center gap-4">
                            <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${isLocked ? "from-gray-400 to-gray-500" : feature.gradient} flex items-center justify-center shadow-md flex-shrink-0 relative`}>
                              <feature.icon className="h-6 w-6 text-white" />
                              {isLocked && (
                                <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-muted border-2 border-background flex items-center justify-center" data-testid={`lock-indicator-${feature.id}`}>
                                  <Lock className="h-3 w-3 text-muted-foreground" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-base mb-0.5">{feature.title}</h3>
                              <p className="text-sm text-muted-foreground line-clamp-1" data-testid={isLocked ? `text-locked-${feature.id}` : undefined}>
                                {isLocked ? "Unlocks after your first paid job" : feature.description}
                              </p>
                            </div>
                            {isLocked ? (
                              <Lock className="h-5 w-5 text-muted-foreground/50 flex-shrink-0" />
                            ) : (
                              <ChevronRight className="h-5 w-5 text-muted-foreground/50 flex-shrink-0 group-hover:text-primary transition-colors" />
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <Card className="bg-gradient-to-br from-primary/5 to-violet-500/5 border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Zap className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Pro Tip</h3>
                  <p className="text-sm text-muted-foreground">
                    Use the voice button at the bottom of any screen to quickly create jobs, leads, or invoices hands-free.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>

      {activeFeature && activeFeatureData && (
        <Dialog open={!!activeFeature} onOpenChange={() => setActiveFeature(null)}>
          <DialogContent 
            className="max-w-lg max-h-[85vh] overflow-hidden p-0"
            data-testid={`dialog-feature-${activeFeature}`}
          >
            <div className={`relative bg-gradient-to-br ${activeFeatureData.gradient} p-6 pb-8`}>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 text-white/80 hover:text-white hover:bg-white/20"
                onClick={() => setActiveFeature(null)}
                data-testid="button-close-feature"
              >
                <X className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                  <activeFeatureData.icon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold text-white">
                    {activeFeatureData.title}
                  </DialogTitle>
                  <DialogDescription className="text-sm text-white/80 mt-0.5">
                    {activeFeatureData.description}
                  </DialogDescription>
                </div>
              </div>
            </div>
            
            <ScrollArea className="max-h-[60vh]">
              <div className="p-4">
                {activeFeatureData.component}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
