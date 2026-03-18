import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Check,
  Copy,
  ArrowRight,
  Loader2,
  Briefcase,
  MessageSquare,
  Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageInputPanel } from "./MessageInputPanel";
import { ExtractedLeadPanel } from "./ExtractedLeadPanel";
import type { LucideIcon } from "lucide-react";

interface ParsedLead {
  extractedDetails?: {
    urgency?: "low" | "medium" | "high";
  };
}

interface QuickReply {
  id: string;
  text: string;
  tone: "professional" | "friendly" | "casual";
}

interface EditedLead {
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  serviceType: string;
  description: string;
  source: string;
  sourceUrl: string;
  location: string;
  locationLat: number | undefined;
  locationLng: number | undefined;
}

interface ServiceType {
  value: string;
  label: string;
  icon: LucideIcon;
}

interface SourceItem {
  value: string;
  label: string;
}

interface SourceConfig {
  color: string;
  label: string;
}

interface QuickCaptureDesktopViewProps {
  sharedText: string;
  onTextChange: (text: string) => void;
  onParse: () => void;
  isParsing: boolean;
  parsedLead: ParsedLead | null;
  editedLead: EditedLead;
  onEditedLeadChange: (lead: EditedLead) => void;
  onCreateLead: () => void;
  isCreating: boolean;
  step: "input" | "review" | "reply";
  quickReplies: QuickReply[];
  selectedReply: string;
  onSelectReply: (text: string) => void;
  onCopyReply: () => void;
  copiedReply: boolean;
  isLoadingReplies: boolean;
  onNavigateLeads: () => void;
  serviceTypes: ServiceType[];
  sources: SourceItem[];
  sourceConfigMap: Record<string, SourceConfig>;
}

const toneConfig = {
  professional: { icon: Briefcase, color: "border-blue-500 bg-blue-50 dark:bg-blue-950/30", label: "Professional" },
  friendly: { icon: MessageSquare, color: "border-green-500 bg-green-50 dark:bg-green-950/30", label: "Friendly" },
  casual: { icon: Zap, color: "border-amber-500 bg-amber-50 dark:bg-amber-950/30", label: "Casual" },
};

export function QuickCaptureDesktopView({
  sharedText,
  onTextChange,
  onParse,
  isParsing,
  parsedLead,
  editedLead,
  onEditedLeadChange,
  onCreateLead,
  isCreating,
  step,
  quickReplies,
  selectedReply,
  onSelectReply,
  onCopyReply,
  copiedReply,
  isLoadingReplies,
  onNavigateLeads,
  serviceTypes,
  sources,
  sourceConfigMap,
}: QuickCaptureDesktopViewProps) {
  const hasExtracted = step === "review" || step === "reply";

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        <MessageInputPanel
          sharedText={sharedText}
          onTextChange={onTextChange}
          onParse={onParse}
          isParsing={isParsing}
        />

        <ExtractedLeadPanel
          parsedLead={parsedLead}
          editedLead={editedLead}
          onEditedLeadChange={onEditedLeadChange}
          onCreateLead={onCreateLead}
          isCreating={isCreating}
          isParsing={isParsing}
          hasExtracted={hasExtracted}
          serviceTypes={serviceTypes}
          sources={sources}
          sourceConfigMap={sourceConfigMap}
        />
      </div>

      <AnimatePresence>
        {step === "reply" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <Card className="rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
              <CardContent className="p-6 space-y-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-green-500/10">
                    <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="font-semibold">Lead saved!</p>
                    <p className="text-sm text-muted-foreground">
                      {editedLead.clientName || "New lead"} added to your list. Pick a reply to send back.
                    </p>
                  </div>
                </div>

                {isLoadingReplies ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : quickReplies.length > 0 ? (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                    {quickReplies.map((reply) => {
                      const config = toneConfig[reply.tone];
                      const ToneIcon = config.icon;
                      const isSelected = selectedReply === reply.text;
                      return (
                        <button
                          key={reply.id}
                          data-testid={`button-reply-desktop-${reply.id}`}
                          onClick={() => onSelectReply(reply.text)}
                          className={`text-left p-4 rounded-xl border-2 transition-all ${
                            isSelected
                              ? "border-primary bg-primary/5 shadow-sm"
                              : `${config.color} border-transparent hover:border-primary/30`
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <ToneIcon className={`w-4 h-4 ${isSelected ? "text-primary" : ""}`} />
                            <span className={`text-xs font-semibold uppercase tracking-wide ${isSelected ? "text-primary" : "text-muted-foreground"}`}>
                              {config.label}
                            </span>
                            {isSelected && <Check className="w-4 h-4 text-primary ml-auto" />}
                          </div>
                          <p className="text-sm leading-relaxed">{reply.text}</p>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <Textarea
                    data-testid="input-reply-desktop"
                    value={selectedReply}
                    onChange={(e) => onSelectReply(e.target.value)}
                    placeholder="Type your reply..."
                    className="min-h-[100px] text-base bg-muted/30 border-2 focus:border-primary resize-none"
                  />
                )}

                {quickReplies.length > 0 && selectedReply && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Edit if needed</p>
                    <Textarea
                      data-testid="input-reply-edit-desktop"
                      value={selectedReply}
                      onChange={(e) => onSelectReply(e.target.value)}
                      className="min-h-[80px] text-sm bg-muted/30 border-2 focus:border-primary resize-none"
                    />
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <Button
                    data-testid="button-copy-reply-desktop"
                    onClick={onCopyReply}
                    disabled={!selectedReply}
                    className="h-11 px-6 font-medium"
                    aria-label="Copy Reply"
                  >
                    {copiedReply ? (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-2" />
                        Copy Reply
                      </>
                    )}
                  </Button>
                  <Button
                    data-testid="button-view-leads-desktop"
                    variant="outline"
                    onClick={onNavigateLeads}
                    className="h-11 px-6 font-medium"
                    aria-label="View all leads"
                  >
                    View all leads
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
