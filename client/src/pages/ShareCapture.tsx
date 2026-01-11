import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { 
  MessageSquare, 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Loader2,
  Copy,
  Check,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Zap,
  AlertCircle,
  Briefcase,
  ChevronDown,
  X
} from "lucide-react";
import { 
  SiFacebook, 
  SiNextdoor,
  SiYelp,
  SiInstagram,
  SiWhatsapp,
  SiLinkedin
} from "react-icons/si";

interface ParsedLead {
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  serviceType: string;
  description: string;
  source: string;
  suggestedReply: string;
  extractedDetails: {
    location?: string;
    urgency?: "low" | "medium" | "high";
    preferredDate?: string;
    preferredTime?: string;
    budget?: string;
  };
}

interface QuickReply {
  id: string;
  text: string;
  tone: "professional" | "friendly" | "casual";
}

const SOURCE_CONFIG: Record<string, { icon: React.ComponentType<{ className?: string }> | null; color: string; label: string }> = {
  facebook: { icon: SiFacebook, color: "bg-blue-500", label: "Facebook" },
  craigslist: { icon: null, color: "bg-purple-600", label: "Craigslist" },
  nextdoor: { icon: SiNextdoor, color: "bg-green-600", label: "Nextdoor" },
  thumbtack: { icon: null, color: "bg-blue-600", label: "Thumbtack" },
  taskrabbit: { icon: null, color: "bg-green-500", label: "TaskRabbit" },
  angi: { icon: null, color: "bg-red-500", label: "Angi" },
  homeadvisor: { icon: null, color: "bg-orange-500", label: "HomeAdvisor" },
  yelp: { icon: SiYelp, color: "bg-red-600", label: "Yelp" },
  google: { icon: null, color: "bg-blue-500", label: "Google" },
  instagram: { icon: SiInstagram, color: "bg-gradient-to-r from-purple-500 to-pink-500", label: "Instagram" },
  twitter: { icon: null, color: "bg-black dark:bg-white dark:text-black", label: "X" },
  linkedin: { icon: SiLinkedin, color: "bg-blue-700", label: "LinkedIn" },
  whatsapp: { icon: SiWhatsapp, color: "bg-green-500", label: "WhatsApp" },
  sms: { icon: null, color: "bg-emerald-500", label: "Text" },
  email: { icon: null, color: "bg-gray-500", label: "Email" },
  referral: { icon: null, color: "bg-amber-500", label: "Referral" },
  manual: { icon: null, color: "bg-slate-500", label: "Other" },
};

const SERVICE_TYPES = [
  { value: "plumbing", label: "Plumbing", icon: "🔧" },
  { value: "electrical", label: "Electrical", icon: "⚡" },
  { value: "cleaning", label: "Cleaning", icon: "✨" },
  { value: "handyman", label: "Handyman", icon: "🛠️" },
  { value: "hvac", label: "HVAC", icon: "❄️" },
  { value: "landscaping", label: "Landscaping", icon: "🌿" },
  { value: "painting", label: "Painting", icon: "🎨" },
  { value: "moving", label: "Moving", icon: "📦" },
  { value: "other", label: "Other", icon: "📋" },
];

const SOURCES = [
  { value: "facebook", label: "Facebook" },
  { value: "craigslist", label: "Craigslist" },
  { value: "nextdoor", label: "Nextdoor" },
  { value: "thumbtack", label: "Thumbtack" },
  { value: "taskrabbit", label: "TaskRabbit" },
  { value: "angi", label: "Angi" },
  { value: "yelp", label: "Yelp" },
  { value: "google", label: "Google" },
  { value: "instagram", label: "Instagram" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "sms", label: "Text/SMS" },
  { value: "email", label: "Email" },
  { value: "referral", label: "Referral" },
  { value: "manual", label: "Other" },
];

export default function ShareCapture() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const [sharedText, setSharedText] = useState("");
  const [parsedLead, setParsedLead] = useState<ParsedLead | null>(null);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [selectedReply, setSelectedReply] = useState<string>("");
  const [copiedReply, setCopiedReply] = useState(false);
  const [step, setStep] = useState<"input" | "review" | "reply">("input");
  const [showServicePicker, setShowServicePicker] = useState(false);
  const [showSourcePicker, setShowSourcePicker] = useState(false);

  const [editedLead, setEditedLead] = useState({
    clientName: "",
    clientPhone: "",
    clientEmail: "",
    serviceType: "",
    description: "",
    source: "manual",
    location: "",
  });

  const { data: profile } = useQuery<{ name: string; services: string[] }>({
    queryKey: ["/api/profile"],
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const text = params.get("text") || "";
    const url = params.get("url") || "";
    const title = params.get("title") || "";
    
    if (text || url || title) {
      const combined = [title, text].filter(Boolean).join("\n\n");
      setSharedText(combined);
      if (combined) {
        parseMutation.mutate({ text: combined, url: url || undefined });
      }
    }
  }, []);

  const parseMutation = useMutation({
    mutationFn: async (data: { text: string; url?: string }) => {
      const res = await apiRequest("POST", "/api/share/parse", data);
      return res.json();
    },
    onSuccess: (data: ParsedLead) => {
      setParsedLead(data);
      setEditedLead({
        clientName: data.clientName || "",
        clientPhone: data.clientPhone || "",
        clientEmail: data.clientEmail || "",
        serviceType: data.serviceType || "",
        description: data.description || "",
        source: data.source || "manual",
        location: data.extractedDetails?.location || "",
      });
      setSelectedReply(data.suggestedReply || "");
      setStep("review");
    },
    onError: () => {
      toast({
        title: "Couldn't parse content",
        description: "Try entering the lead details manually",
        variant: "destructive",
      });
    },
  });

  const replyMutation = useMutation({
    mutationFn: async (data: { text: string; context: string }) => {
      const res = await apiRequest("POST", "/api/share/replies", data);
      return res.json();
    },
    onSuccess: (data: { replies: QuickReply[] }) => {
      setQuickReplies(data.replies || []);
    },
  });

  const createLeadMutation = useMutation({
    mutationFn: async (data: typeof editedLead) => {
      const res = await apiRequest("POST", "/api/leads", {
        clientName: data.clientName || "Unknown",
        clientPhone: data.clientPhone || "",
        clientEmail: data.clientEmail || "",
        serviceType: data.serviceType || "other",
        description: data.description || "",
        source: data.source || "manual",
        status: "new",
        notes: data.location ? `Location: ${data.location}` : null,
      });
      return res.json();
    },
    onSuccess: (lead) => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      toast({
        title: "Lead saved!",
        description: `${lead.clientName} added to your leads`,
      });
      setStep("reply");
      replyMutation.mutate({
        text: sharedText || editedLead.description,
        context: editedLead.serviceType || "general inquiry",
      });
    },
    onError: () => {
      toast({
        title: "Error creating lead",
        description: "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleParse = () => {
    if (!sharedText.trim()) {
      toast({
        title: "No content to parse",
        description: "Paste or type the message you received",
        variant: "destructive",
      });
      return;
    }
    parseMutation.mutate({ text: sharedText });
  };

  const handleCopyReply = async () => {
    await navigator.clipboard.writeText(selectedReply);
    setCopiedReply(true);
    setTimeout(() => setCopiedReply(false), 2000);
    toast({
      title: "Copied!",
      description: "Now paste it in your chat",
    });
  };

  const handleCreateAndReply = () => {
    createLeadMutation.mutate(editedLead);
  };

  const sourceConfig = SOURCE_CONFIG[editedLead.source] || SOURCE_CONFIG.manual;
  const selectedService = SERVICE_TYPES.find(s => s.value === editedLead.serviceType);

  const urgencyConfig = {
    low: { color: "text-green-600 dark:text-green-400", bg: "bg-green-100 dark:bg-green-900/40", label: "Low priority" },
    medium: { color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-900/40", label: "Medium priority" },
    high: { color: "text-red-600 dark:text-red-400", bg: "bg-red-100 dark:bg-red-900/40", label: "High priority" },
  };

  const toneConfig = {
    professional: { icon: Briefcase, color: "border-blue-500 bg-blue-50 dark:bg-blue-950/30", label: "Professional" },
    friendly: { icon: MessageSquare, color: "border-green-500 bg-green-50 dark:bg-green-950/30", label: "Friendly" },
    casual: { icon: Zap, color: "border-amber-500 bg-amber-50 dark:bg-amber-950/30", label: "Casual" },
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30" data-testid="page-share-capture">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => step === "input" ? navigate("/more") : setStep(step === "review" ? "input" : "review")}
            className="p-2 -ml-2 rounded-full hover-elevate"
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            {["input", "review", "reply"].map((s, i) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  s === step ? "w-8 bg-primary" : 
                  ["input", "review", "reply"].indexOf(step) > i ? "w-3 bg-primary/60" : "w-3 bg-muted"
                }`}
              />
            ))}
          </div>
          <button
            onClick={() => navigate("/leads")}
            className="p-2 -mr-2 rounded-full hover-elevate"
            data-testid="button-close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="px-4 py-6 max-w-lg mx-auto">
        <AnimatePresence mode="wait">
          {/* STEP 1: Input */}
          {step === "input" && (
            <motion.div
              key="input"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              <div className="text-center space-y-2">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 mb-2">
                  <Sparkles className="w-8 h-8 text-primary" />
                </div>
                <h1 className="text-2xl font-bold">Quick Capture</h1>
                <p className="text-muted-foreground">
                  Paste a message and we'll extract the lead info
                </p>
              </div>

              <div className="space-y-4">
                <Textarea
                  data-testid="input-shared-text"
                  placeholder="Paste the customer's message here...

Example:
Hi, I need a plumber to fix a leaky faucet. My name is Sarah, call me at 555-1234."
                  value={sharedText}
                  onChange={(e) => setSharedText(e.target.value)}
                  className="min-h-[200px] text-base bg-card border-2 focus:border-primary transition-colors resize-none"
                />

                <Button
                  data-testid="button-parse"
                  onClick={handleParse}
                  disabled={parseMutation.isPending || !sharedText.trim()}
                  className="w-full h-14 text-lg font-medium"
                  size="lg"
                >
                  {parseMutation.isPending ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 mr-2" />
                      Extract Lead Info
                    </>
                  )}
                </Button>

                <button
                  data-testid="button-manual-entry"
                  onClick={() => setStep("review")}
                  className="w-full py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Or enter details manually
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 2: Review */}
          {step === "review" && (
            <motion.div
              key="review"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {/* AI Detection Banner */}
              {parsedLead && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-primary/20">
                      <Sparkles className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <p className="font-medium text-sm">AI detected</p>
                      <div className="flex flex-wrap gap-2">
                        <Badge className={`${sourceConfig.color} text-white border-0`}>
                          {sourceConfig.label}
                        </Badge>
                        {selectedService && (
                          <Badge variant="secondary">
                            {selectedService.icon} {selectedService.label}
                          </Badge>
                        )}
                        {parsedLead.extractedDetails?.urgency && (
                          <Badge className={`${urgencyConfig[parsedLead.extractedDetails.urgency].bg} ${urgencyConfig[parsedLead.extractedDetails.urgency].color} border-0`}>
                            <AlertCircle className="w-3 h-3 mr-1" />
                            {urgencyConfig[parsedLead.extractedDetails.urgency].label}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              <div className="text-center">
                <h1 className="text-xl font-bold">Review Lead Details</h1>
                <p className="text-sm text-muted-foreground">Tap to edit any field</p>
              </div>

              {/* Form Fields */}
              <div className="space-y-4">
                {/* Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" /> Name
                  </label>
                  <Input
                    data-testid="input-client-name"
                    value={editedLead.clientName}
                    onChange={(e) => setEditedLead({ ...editedLead, clientName: e.target.value })}
                    placeholder="Customer name"
                    className="h-12 text-base bg-card border-2 focus:border-primary"
                  />
                </div>

                {/* Phone */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5" /> Phone
                  </label>
                  <Input
                    data-testid="input-client-phone"
                    type="tel"
                    value={editedLead.clientPhone}
                    onChange={(e) => setEditedLead({ ...editedLead, clientPhone: e.target.value })}
                    placeholder="(555) 123-4567"
                    className="h-12 text-base bg-card border-2 focus:border-primary"
                  />
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5" /> Email
                  </label>
                  <Input
                    data-testid="input-client-email"
                    type="email"
                    value={editedLead.clientEmail}
                    onChange={(e) => setEditedLead({ ...editedLead, clientEmail: e.target.value })}
                    placeholder="email@example.com"
                    className="h-12 text-base bg-card border-2 focus:border-primary"
                  />
                </div>

                {/* Service Type Picker */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5" /> Service Type
                  </label>
                  <button
                    data-testid="select-service-type"
                    onClick={() => setShowServicePicker(!showServicePicker)}
                    className="w-full h-12 px-4 flex items-center justify-between bg-card border-2 rounded-md text-base hover:border-primary/50 transition-colors"
                  >
                    <span className={editedLead.serviceType ? "" : "text-muted-foreground"}>
                      {selectedService ? `${selectedService.icon} ${selectedService.label}` : "Select service"}
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
                          {SERVICE_TYPES.map((service) => (
                            <button
                              key={service.value}
                              onClick={() => {
                                setEditedLead({ ...editedLead, serviceType: service.value });
                                setShowServicePicker(false);
                              }}
                              className={`p-3 rounded-xl text-center transition-all ${
                                editedLead.serviceType === service.value
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-card border hover-elevate"
                              }`}
                            >
                              <div className="text-xl mb-1">{service.icon}</div>
                              <div className="text-xs font-medium">{service.label}</div>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    What they need
                  </label>
                  <Textarea
                    data-testid="input-description"
                    value={editedLead.description}
                    onChange={(e) => setEditedLead({ ...editedLead, description: e.target.value })}
                    placeholder="Job description"
                    className="min-h-[80px] text-base bg-card border-2 focus:border-primary resize-none"
                  />
                </div>

                {/* Location */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" /> Location
                  </label>
                  <Input
                    data-testid="input-location"
                    value={editedLead.location}
                    onChange={(e) => setEditedLead({ ...editedLead, location: e.target.value })}
                    placeholder="Address or area"
                    className="h-12 text-base bg-card border-2 focus:border-primary"
                  />
                </div>

                {/* Source Picker */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Lead Source
                  </label>
                  <button
                    data-testid="select-source"
                    onClick={() => setShowSourcePicker(!showSourcePicker)}
                    className="w-full h-12 px-4 flex items-center justify-between bg-card border-2 rounded-md text-base hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${sourceConfig.color}`} />
                      <span>{sourceConfig.label}</span>
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
                          {SOURCES.map((source) => {
                            const config = SOURCE_CONFIG[source.value] || SOURCE_CONFIG.manual;
                            return (
                              <button
                                key={source.value}
                                onClick={() => {
                                  setEditedLead({ ...editedLead, source: source.value });
                                  setShowSourcePicker(false);
                                }}
                                className={`p-3 rounded-xl flex items-center gap-2 transition-all ${
                                  editedLead.source === source.value
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-card border hover-elevate"
                                }`}
                              >
                                <div className={`w-3 h-3 rounded-full ${config.color}`} />
                                <span className="text-sm font-medium">{source.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Save Button */}
              <Button
                data-testid="button-create-lead"
                onClick={handleCreateAndReply}
                disabled={createLeadMutation.isPending}
                className="w-full h-14 text-lg font-medium"
                size="lg"
              >
                {createLeadMutation.isPending ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    Save Lead & Get Reply
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>
            </motion.div>
          )}

          {/* STEP 3: Reply */}
          {step === "reply" && (
            <motion.div
              key="reply"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {/* Success Banner */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-4 rounded-2xl bg-gradient-to-r from-green-500/10 via-green-500/5 to-transparent border border-green-500/20"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-green-500/20">
                    <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="font-medium">Lead saved!</p>
                    <p className="text-sm text-muted-foreground">
                      {editedLead.clientName || "New lead"} added to your list
                    </p>
                  </div>
                </div>
              </motion.div>

              <div className="text-center">
                <h1 className="text-xl font-bold">Reply to Customer</h1>
                <p className="text-sm text-muted-foreground">Pick a reply style and send it back</p>
              </div>

              {/* Quick Reply Options */}
              {replyMutation.isPending ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : quickReplies.length > 0 ? (
                <div className="space-y-3">
                  {quickReplies.map((reply, index) => {
                    const config = toneConfig[reply.tone];
                    const ToneIcon = config.icon;
                    const isSelected = selectedReply === reply.text;
                    
                    return (
                      <motion.button
                        key={reply.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        data-testid={`button-reply-${reply.id}`}
                        onClick={() => setSelectedReply(reply.text)}
                        className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${
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
                          {isSelected && (
                            <Check className="w-4 h-4 text-primary ml-auto" />
                          )}
                        </div>
                        <p className="text-sm leading-relaxed">{reply.text}</p>
                      </motion.button>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-3">
                  <Textarea
                    data-testid="input-reply"
                    value={selectedReply}
                    onChange={(e) => setSelectedReply(e.target.value)}
                    placeholder="Type your reply..."
                    className="min-h-[120px] text-base bg-card border-2 focus:border-primary resize-none"
                  />
                </div>
              )}

              {/* Edit Reply */}
              {quickReplies.length > 0 && selectedReply && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Edit if needed</p>
                  <Textarea
                    data-testid="input-reply-edit"
                    value={selectedReply}
                    onChange={(e) => setSelectedReply(e.target.value)}
                    className="min-h-[100px] text-base bg-card border-2 focus:border-primary resize-none"
                  />
                </div>
              )}

              {/* Copy Button */}
              <Button
                data-testid="button-copy-reply"
                onClick={handleCopyReply}
                disabled={!selectedReply}
                className="w-full h-14 text-lg font-medium"
                size="lg"
              >
                {copiedReply ? (
                  <>
                    <Check className="w-5 h-5 mr-2" />
                    Copied! Now paste in your chat
                  </>
                ) : (
                  <>
                    <Copy className="w-5 h-5 mr-2" />
                    Copy Reply
                  </>
                )}
              </Button>

              {/* Done Button */}
              <button
                data-testid="button-done"
                onClick={() => navigate("/leads")}
                className="w-full py-3 text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-2"
              >
                View all leads
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
