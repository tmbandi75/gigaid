import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { 
  Share2, 
  MessageSquare, 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Clipboard,
  Send,
  Plus,
  Loader2,
  Copy,
  Check,
  ArrowRight,
  Sparkles
} from "lucide-react";

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

export default function ShareCapture() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const [sharedText, setSharedText] = useState("");
  const [sharedUrl, setSharedUrl] = useState("");
  const [parsedLead, setParsedLead] = useState<ParsedLead | null>(null);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [selectedReply, setSelectedReply] = useState<string>("");
  const [copiedReply, setCopiedReply] = useState(false);
  const [step, setStep] = useState<"input" | "review" | "reply">("input");

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
      setSharedUrl(url);
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
        title: "Lead created!",
        description: `${lead.clientName} added to your leads`,
      });
      setStep("reply");
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
    parseMutation.mutate({ text: sharedText, url: sharedUrl || undefined });
  };

  const handleGetReplies = () => {
    replyMutation.mutate({
      text: sharedText,
      context: editedLead.serviceType || "general inquiry",
    });
  };

  const handleCopyReply = async () => {
    await navigator.clipboard.writeText(selectedReply);
    setCopiedReply(true);
    setTimeout(() => setCopiedReply(false), 2000);
    toast({
      title: "Copied!",
      description: "Reply copied to clipboard",
    });
  };

  const handleCreateAndReply = () => {
    createLeadMutation.mutate(editedLead);
  };

  const handleDone = () => {
    navigate("/leads");
  };

  const urgencyColors = {
    low: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    high: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  };

  return (
    <div className="min-h-screen bg-background p-4 pb-24">
      <div className="max-w-lg mx-auto space-y-4">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-full bg-primary/10">
            <Share2 className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Quick Capture</h1>
            <p className="text-sm text-muted-foreground">
              {step === "input" && "Paste a message to create a lead"}
              {step === "review" && "Review and save lead details"}
              {step === "reply" && "Copy your reply to send back"}
            </p>
          </div>
        </div>

        {step === "input" && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clipboard className="w-4 h-4" />
                Paste Message
              </CardTitle>
              <CardDescription>
                Paste the customer's message from Facebook, text, email, etc.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                data-testid="input-shared-text"
                placeholder="Paste the message here...

Example:
'Hi, I need a plumber to fix a leaky faucet. My name is Sarah and my number is 555-1234. Can you come today?'"
                value={sharedText}
                onChange={(e) => setSharedText(e.target.value)}
                className="min-h-[150px]"
              />
              
              <Input
                data-testid="input-shared-url"
                placeholder="URL (optional)"
                value={sharedUrl}
                onChange={(e) => setSharedUrl(e.target.value)}
              />

              <Button
                data-testid="button-parse"
                onClick={handleParse}
                disabled={parseMutation.isPending || !sharedText.trim()}
                className="w-full"
              >
                {parseMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Parsing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Parse & Create Lead
                  </>
                )}
              </Button>

              <div className="text-center">
                <Button
                  data-testid="button-manual-entry"
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep("review")}
                >
                  Or enter manually
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === "review" && (
          <>
            {parsedLead && (
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-primary mt-0.5" />
                    <div className="flex-1 space-y-2">
                      <p className="text-sm font-medium">AI detected:</p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">{parsedLead.source}</Badge>
                        <Badge variant="secondary">{parsedLead.serviceType}</Badge>
                        {parsedLead.extractedDetails?.urgency && (
                          <Badge className={urgencyColors[parsedLead.extractedDetails.urgency]}>
                            {parsedLead.extractedDetails.urgency} priority
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Lead Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="clientName" className="flex items-center gap-2">
                    <User className="w-4 h-4" /> Name
                  </Label>
                  <Input
                    id="clientName"
                    data-testid="input-client-name"
                    value={editedLead.clientName}
                    onChange={(e) => setEditedLead({ ...editedLead, clientName: e.target.value })}
                    placeholder="Customer name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="clientPhone" className="flex items-center gap-2">
                    <Phone className="w-4 h-4" /> Phone
                  </Label>
                  <Input
                    id="clientPhone"
                    data-testid="input-client-phone"
                    type="tel"
                    value={editedLead.clientPhone}
                    onChange={(e) => setEditedLead({ ...editedLead, clientPhone: e.target.value })}
                    placeholder="(555) 123-4567"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="clientEmail" className="flex items-center gap-2">
                    <Mail className="w-4 h-4" /> Email
                  </Label>
                  <Input
                    id="clientEmail"
                    data-testid="input-client-email"
                    type="email"
                    value={editedLead.clientEmail}
                    onChange={(e) => setEditedLead({ ...editedLead, clientEmail: e.target.value })}
                    placeholder="email@example.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="serviceType">Service Type</Label>
                  <Select
                    value={editedLead.serviceType}
                    onValueChange={(v) => setEditedLead({ ...editedLead, serviceType: v })}
                  >
                    <SelectTrigger data-testid="select-service-type">
                      <SelectValue placeholder="Select service" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="plumbing">Plumbing</SelectItem>
                      <SelectItem value="electrical">Electrical</SelectItem>
                      <SelectItem value="cleaning">Cleaning</SelectItem>
                      <SelectItem value="handyman">Handyman</SelectItem>
                      <SelectItem value="hvac">HVAC</SelectItem>
                      <SelectItem value="landscaping">Landscaping</SelectItem>
                      <SelectItem value="painting">Painting</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    data-testid="input-description"
                    value={editedLead.description}
                    onChange={(e) => setEditedLead({ ...editedLead, description: e.target.value })}
                    placeholder="What does the customer need?"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location" className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" /> Location
                  </Label>
                  <Input
                    id="location"
                    data-testid="input-location"
                    value={editedLead.location}
                    onChange={(e) => setEditedLead({ ...editedLead, location: e.target.value })}
                    placeholder="Address or area"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="source">Source</Label>
                  <Select
                    value={editedLead.source}
                    onValueChange={(v) => setEditedLead({ ...editedLead, source: v })}
                  >
                    <SelectTrigger data-testid="select-source">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="facebook">Facebook</SelectItem>
                      <SelectItem value="thumbtack">Thumbtack</SelectItem>
                      <SelectItem value="taskrabbit">TaskRabbit</SelectItem>
                      <SelectItem value="angi">Angi</SelectItem>
                      <SelectItem value="homeadvisor">HomeAdvisor</SelectItem>
                      <SelectItem value="yelp">Yelp</SelectItem>
                      <SelectItem value="google">Google</SelectItem>
                      <SelectItem value="instagram">Instagram</SelectItem>
                      <SelectItem value="twitter">Twitter/X</SelectItem>
                      <SelectItem value="linkedin">LinkedIn</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="sms">SMS/Text</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="referral">Referral</SelectItem>
                      <SelectItem value="manual">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    data-testid="button-back"
                    variant="outline"
                    onClick={() => setStep("input")}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button
                    data-testid="button-create-lead"
                    onClick={handleCreateAndReply}
                    disabled={createLeadMutation.isPending}
                    className="flex-1"
                  >
                    {createLeadMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Plus className="w-4 h-4 mr-2" />
                        Save Lead
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {step === "reply" && (
          <>
            <Card className="border-green-500/30 bg-green-50 dark:bg-green-950/20">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-green-500/20">
                    <Check className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium">Lead saved!</p>
                    <p className="text-sm text-muted-foreground">
                      {editedLead.clientName || "New lead"} added to your list
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Quick Reply
                </CardTitle>
                <CardDescription>
                  Copy this reply to send back to the customer
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  data-testid="input-reply"
                  value={selectedReply}
                  onChange={(e) => setSelectedReply(e.target.value)}
                  placeholder="Type your reply..."
                  className="min-h-[100px]"
                />

                <div className="flex gap-2">
                  <Button
                    data-testid="button-get-replies"
                    variant="outline"
                    onClick={handleGetReplies}
                    disabled={replyMutation.isPending}
                    className="flex-1"
                  >
                    {replyMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Suggest Replies
                      </>
                    )}
                  </Button>
                  <Button
                    data-testid="button-copy-reply"
                    onClick={handleCopyReply}
                    disabled={!selectedReply}
                    className="flex-1"
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
                </div>

                {quickReplies.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">
                      Suggested replies:
                    </p>
                    {quickReplies.map((reply) => (
                      <button
                        key={reply.id}
                        data-testid={`button-reply-${reply.id}`}
                        onClick={() => setSelectedReply(reply.text)}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${
                          selectedReply === reply.text
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <Badge variant="outline" className="text-xs">
                            {reply.tone}
                          </Badge>
                        </div>
                        <p className="text-sm">{reply.text}</p>
                      </button>
                    ))}
                  </div>
                )}

                <Button
                  data-testid="button-done"
                  onClick={handleDone}
                  variant="outline"
                  className="w-full"
                >
                  Done
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
