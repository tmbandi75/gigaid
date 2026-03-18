import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  User,
  Phone,
  Mail,
  Briefcase,
  MapPin,
  Sparkles,
  Loader2,
  ArrowRight,
  AlertCircle,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { AddressAutocomplete } from "@/components/booking/AddressAutocomplete";
import { ExtractionLoadingState } from "./ExtractionLoadingState";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

interface ParsedLead {
  extractedDetails?: {
    urgency?: "low" | "medium" | "high";
  };
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

interface ExtractedLeadPanelProps {
  parsedLead: ParsedLead | null;
  editedLead: EditedLead;
  onEditedLeadChange: (lead: EditedLead) => void;
  onCreateLead: () => void;
  isCreating: boolean;
  isParsing: boolean;
  hasExtracted: boolean;
  serviceTypes: ServiceType[];
  sources: SourceItem[];
  sourceConfigMap: Record<string, SourceConfig>;
}

const urgencyConfig = {
  low: { color: "text-green-600 dark:text-green-400", bg: "bg-green-100 dark:bg-green-900/40", label: "Low priority" },
  medium: { color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-900/40", label: "Medium priority" },
  high: { color: "text-red-600 dark:text-red-400", bg: "bg-red-100 dark:bg-red-900/40", label: "High priority" },
};

export function ExtractedLeadPanel({
  parsedLead,
  editedLead,
  onEditedLeadChange,
  onCreateLead,
  isCreating,
  isParsing,
  hasExtracted,
  serviceTypes,
  sources,
  sourceConfigMap,
}: ExtractedLeadPanelProps) {
  const [showServicePicker, setShowServicePicker] = useState(false);
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const selectedService = serviceTypes.find((s) => s.value === editedLead.serviceType);
  const currentSourceCfg = sourceConfigMap[editedLead.source] || sourceConfigMap.manual;

  if (isParsing) {
    return (
      <Card className="rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 h-full flex flex-col">
        <CardContent className="p-6 flex-1 flex items-center justify-center">
          <ExtractionLoadingState />
        </CardContent>
      </Card>
    );
  }

  if (!hasExtracted) {
    return (
      <Card className="rounded-xl shadow-sm border border-dashed border-slate-300 dark:border-slate-700 h-full flex flex-col">
        <CardContent className="p-6 flex-1 flex flex-col items-center justify-center text-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-8 w-8 text-primary/40" />
          </div>
          <div className="space-y-1">
            <h3 className="font-semibold text-muted-foreground">Extracted Lead</h3>
            <p className="text-sm text-muted-foreground/70 max-w-xs">
              Paste a customer message on the left and click Extract Lead to see AI-extracted information here.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 hover:shadow-md transition h-full flex flex-col">
      <CardContent className="p-6 flex flex-col flex-1 gap-5 overflow-y-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Extracted Lead</h3>
              <p className="text-xs text-muted-foreground">Review and edit fields below</p>
            </div>
          </div>
          {parsedLead?.extractedDetails?.urgency && (
            <Badge className={`${urgencyConfig[parsedLead.extractedDetails.urgency].bg} ${urgencyConfig[parsedLead.extractedDetails.urgency].color} border-0`}>
              <AlertCircle className="w-3 h-3 mr-1" />
              {urgencyConfig[parsedLead.extractedDetails.urgency].label}
            </Badge>
          )}
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" /> Name
            </label>
            <Input
              data-testid="input-client-name-desktop"
              value={editedLead.clientName}
              onChange={(e) => onEditedLeadChange({ ...editedLead, clientName: e.target.value })}
              placeholder="Customer name"
              className="h-11 text-sm bg-muted/30 border focus:border-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5" /> Phone
            </label>
            <Input
              data-testid="input-client-phone-desktop"
              type="tel"
              value={editedLead.clientPhone}
              onChange={(e) => onEditedLeadChange({ ...editedLead, clientPhone: e.target.value })}
              placeholder="(555) 123-4567"
              className="h-11 text-sm bg-muted/30 border focus:border-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" /> Email
            </label>
            <Input
              data-testid="input-client-email-desktop"
              type="email"
              value={editedLead.clientEmail}
              onChange={(e) => onEditedLeadChange({ ...editedLead, clientEmail: e.target.value })}
              placeholder="email@example.com"
              className="h-11 text-sm bg-muted/30 border focus:border-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5" /> Service
            </label>
            <button
              data-testid="select-service-type-desktop"
              onClick={() => setShowServicePicker(!showServicePicker)}
              className="w-full h-11 px-3 flex items-center justify-between bg-muted/30 border rounded-md text-sm hover:border-primary/50 transition-colors"
            >
              <span className={`flex items-center gap-2 ${editedLead.serviceType ? "" : "text-muted-foreground"}`}>
                {selectedService ? (
                  <>
                    <selectedService.icon className="h-4 w-4" />
                    {selectedService.label}
                  </>
                ) : "Select service"}
              </span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showServicePicker ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence>
              {showServicePicker && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="grid grid-cols-3 gap-2 pt-2">
                    {serviceTypes.map((service) => (
                      <button
                        key={service.value}
                        onClick={() => {
                          onEditedLeadChange({ ...editedLead, serviceType: service.value });
                          setShowServicePicker(false);
                        }}
                        className={`p-2.5 rounded-xl text-center transition-all ${
                          editedLead.serviceType === service.value
                            ? "bg-primary text-primary-foreground"
                            : "bg-card border hover:bg-accent"
                        }`}
                      >
                        <div className="flex justify-center mb-0.5">
                          <service.icon className="h-4 w-4" />
                        </div>
                        <div className="text-xs font-medium">{service.label}</div>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              What they need
            </label>
            <Textarea
              data-testid="input-description-desktop"
              value={editedLead.description}
              onChange={(e) => onEditedLeadChange({ ...editedLead, description: e.target.value })}
              placeholder="Job description"
              className="min-h-[70px] text-sm bg-muted/30 border focus:border-primary resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" /> Location
            </label>
            <AddressAutocomplete
              value={editedLead.location}
              onChange={(fullAddress, components) => {
                onEditedLeadChange({
                  ...editedLead,
                  location: fullAddress,
                  locationLat: components?.lat,
                  locationLng: components?.lng,
                });
              }}
              placeholder="Start typing an address..."
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Lead Source
            </label>
            <button
              data-testid="select-source-desktop"
              onClick={() => setShowSourcePicker(!showSourcePicker)}
              className="w-full h-11 px-3 flex items-center justify-between bg-muted/30 border rounded-md text-sm hover:border-primary/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${currentSourceCfg.color}`} />
                <span>{currentSourceCfg.label}</span>
              </div>
              <ChevronDown className={`w-4 h-4 transition-transform ${showSourcePicker ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence>
              {showSourcePicker && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    {sources.map((source) => {
                      const cfg = sourceConfigMap[source.value] || sourceConfigMap.manual;
                      return (
                        <button
                          key={source.value}
                          onClick={() => {
                            onEditedLeadChange({ ...editedLead, source: source.value });
                            setShowSourcePicker(false);
                          }}
                          className={`p-2.5 rounded-xl flex items-center gap-2 transition-all ${
                            editedLead.source === source.value
                              ? "bg-primary text-primary-foreground"
                              : "bg-card border hover:bg-accent"
                          }`}
                        >
                          <div className={`w-3 h-3 rounded-full ${cfg.color}`} />
                          <span className="text-xs font-medium">{source.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="mt-auto pt-4">
          <Button
            data-testid="button-create-lead-desktop"
            onClick={onCreateLead}
            disabled={isCreating}
            className="w-full h-12 text-base font-medium"
            size="lg"
            aria-label="Create Lead"
          >
            {isCreating ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                Create Lead
                <ArrowRight className="w-5 h-5 ml-2" />
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
