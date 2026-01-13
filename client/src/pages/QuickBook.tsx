import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Copy, Check, Edit2, DollarSign, Calendar, MapPin, Clock, User, Sparkles, Send, PartyPopper } from "lucide-react";
import type { ParsedJobFields, FieldConfidence, PaymentConfig } from "@shared/schema";

type Step = "paste" | "preview" | "sent";

interface ParseResponse {
  draftId: string;
  fields: ParsedJobFields;
  confidence: FieldConfidence;
  suggestions?: {
    action: string;
    message: string;
  };
}

interface SendLinkResponse {
  bookingLinkUrl: string;
  paymentConfig: PaymentConfig;
}

export default function QuickBook() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const [step, setStep] = useState<Step>("paste");
  const [messageText, setMessageText] = useState("");
  const [draftId, setDraftId] = useState<string | null>(null);
  const [fields, setFields] = useState<ParsedJobFields>({});
  const [confidence, setConfidence] = useState<FieldConfidence>({ overall: 0 });
  const [isEditing, setIsEditing] = useState(false);
  const [bookingLinkUrl, setBookingLinkUrl] = useState("");
  const [paymentType, setPaymentType] = useState<"deposit" | "full" | "after">("deposit");
  const [depositAmount, setDepositAmount] = useState(50);
  const [copied, setCopied] = useState(false);

  // TODO: Analytics - quickbook_opened (fires once on component mount)
  useEffect(() => {
    // Track page view when component mounts
  }, []);

  const parseMutation = useMutation({
    mutationFn: async (text: string) => {
      // TODO: Analytics - quickbook_parse_submitted
      const res = await apiRequest("POST", "/api/quickbook/parse", { messageText: text });
      return res.json() as Promise<ParseResponse>;
    },
    onSuccess: (data) => {
      setDraftId(data.draftId);
      setFields(data.fields);
      setConfidence(data.confidence);
      setIsEditing(data.confidence.overall < 0.6);
      setStep("preview");
      // TODO: Analytics - quickbook_preview_shown (with confidence: data.confidence.overall)
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to parse message",
        variant: "destructive",
      });
    },
  });

  const updateDraftMutation = useMutation({
    mutationFn: async (updatedFields: Partial<ParsedJobFields>) => {
      const res = await apiRequest("PATCH", `/api/quickbook/draft/${draftId}`, { fields: updatedFields });
      return res.json();
    },
  });

  const sendLinkMutation = useMutation({
    mutationFn: async () => {
      // TODO: Analytics - quickbook_send_link_clicked
      const paymentConfig: PaymentConfig = {
        type: paymentType,
        depositAmount: paymentType === "deposit" ? depositAmount * 100 : undefined,
      };
      const res = await apiRequest("POST", `/api/quickbook/draft/${draftId}/send-link`, {
        paymentIntentConfig: paymentConfig,
      });
      return res.json() as Promise<SendLinkResponse>;
    },
    onSuccess: (data) => {
      setBookingLinkUrl(data.bookingLinkUrl);
      setStep("sent");
      // TODO: Analytics - quickbook_completed
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send booking link",
        variant: "destructive",
      });
    },
  });

  const handleParse = () => {
    if (messageText.trim().length < 10) {
      toast({
        title: "Message too short",
        description: "Please paste a longer message (at least 10 characters)",
        variant: "destructive",
      });
      return;
    }
    parseMutation.mutate(messageText);
  };

  const handleFieldChange = (key: keyof ParsedJobFields, value: any) => {
    setFields(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveEdits = async () => {
    if (draftId) {
      await updateDraftMutation.mutateAsync(fields);
      setIsEditing(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(bookingLinkUrl);
    setCopied(true);
    toast({ title: "Link copied!" });
    // TODO: Analytics - quickbook_copy_link_clicked
    setTimeout(() => setCopied(false), 2000);
  };

  const formatPrice = (cents?: number) => {
    if (!cents) return "";
    return `$${(cents / 100).toFixed(0)}`;
  };

  const formatDateTime = (dateTimeStr?: string) => {
    if (!dateTimeStr) return "";
    try {
      const dt = new Date(dateTimeStr);
      return dt.toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return dateTimeStr;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => step === "paste" ? navigate("/") : setStep(step === "sent" ? "preview" : "paste")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-semibold text-lg">QuickBook</h1>
      </div>

      <div className="p-4 max-w-lg mx-auto">
        {step === "paste" && (
          <div className="space-y-6">
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Paste what your client sent you</h2>
              <p className="text-muted-foreground text-sm">
                We'll turn this into a booked job.
              </p>
            </div>

            <Textarea
              placeholder={`Example:\n"Hi, I need help with a leaky faucet in my kitchen. Can you come by tomorrow around 2pm? My address is 123 Main St. Looking to spend around $150."`}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              className="min-h-[200px] text-base"
              data-testid="input-message-text"
            />

            <Button 
              onClick={handleParse} 
              className="w-full" 
              size="lg"
              disabled={parseMutation.isPending || messageText.trim().length < 10}
              data-testid="button-create-booking"
            >
              {parseMutation.isPending ? "Analyzing..." : "Create Booking"}
            </Button>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-6">
            <div className="text-center py-2">
              <h2 className="text-xl font-semibold mb-1">Here's what we got 👇</h2>
              {confidence.overall < 0.6 && (
                <p className="text-amber-600 text-sm">Quick check: update anything that looks off.</p>
              )}
            </div>

            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Job Details</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => isEditing ? handleSaveEdits() : setIsEditing(true)}
                  data-testid="button-toggle-edit"
                >
                  {isEditing ? <Check className="h-4 w-4 mr-1" /> : <Edit2 className="h-4 w-4 mr-1" />}
                  {isEditing ? "Save" : "Edit"}
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-muted rounded-lg">
                    <Sparkles className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">Service</Label>
                    {isEditing ? (
                      <Select
                        value={fields.service || ""}
                        onValueChange={(v) => handleFieldChange("service", v)}
                      >
                        <SelectTrigger data-testid="select-service">
                          <SelectValue placeholder="Select service" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="plumbing">Plumbing</SelectItem>
                          <SelectItem value="electrical">Electrical</SelectItem>
                          <SelectItem value="cleaning">Cleaning</SelectItem>
                          <SelectItem value="handyman">Handyman</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="font-medium capitalize">{fields.service || "Not specified"}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 bg-muted rounded-lg">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">Date & Time</Label>
                    {isEditing ? (
                      <Input
                        type="datetime-local"
                        value={fields.dateTimeStart?.slice(0, 16) || ""}
                        onChange={(e) => handleFieldChange("dateTimeStart", e.target.value)}
                        data-testid="input-datetime"
                      />
                    ) : (
                      <p className="font-medium">{formatDateTime(fields.dateTimeStart) || "Not specified"}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 bg-muted rounded-lg">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">Location</Label>
                    {isEditing ? (
                      <Input
                        value={fields.locationText || ""}
                        onChange={(e) => handleFieldChange("locationText", e.target.value)}
                        placeholder="Enter address"
                        data-testid="input-location"
                      />
                    ) : (
                      <p className="font-medium">{fields.locationText || "Not specified"}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 bg-muted rounded-lg">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">Price</Label>
                    {isEditing ? (
                      <Input
                        type="number"
                        value={fields.priceAmount ? fields.priceAmount / 100 : ""}
                        onChange={(e) => handleFieldChange("priceAmount", Math.round(parseFloat(e.target.value || "0") * 100))}
                        placeholder="Enter price"
                        data-testid="input-price"
                      />
                    ) : (
                      <p className="font-medium">{formatPrice(fields.priceAmount) || "Not specified"}</p>
                    )}
                  </div>
                </div>

                {(fields.clientName || fields.clientPhone || isEditing) && (
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-muted rounded-lg">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs text-muted-foreground">Client</Label>
                      {isEditing ? (
                        <div className="space-y-2">
                          <Input
                            value={fields.clientName || ""}
                            onChange={(e) => handleFieldChange("clientName", e.target.value)}
                            placeholder="Client name"
                            data-testid="input-client-name"
                          />
                          <Input
                            value={fields.clientPhone || ""}
                            onChange={(e) => handleFieldChange("clientPhone", e.target.value)}
                            placeholder="Phone number"
                            data-testid="input-client-phone"
                          />
                        </div>
                      ) : (
                        <p className="font-medium">
                          {fields.clientName || "Unknown"} {fields.clientPhone && `• ${fields.clientPhone}`}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center gap-2 text-green-600">
                  <Check className="h-4 w-4" />
                  <span className="font-medium">
                    ${depositAmount} deposit now / Remaining after the job
                  </span>
                </div>
                
                <details className="text-sm">
                  <summary className="cursor-pointer text-primary hover:underline">Change payment option</summary>
                  <div className="mt-3 space-y-2">
                    <Select value={paymentType} onValueChange={(v: "deposit" | "full" | "after") => setPaymentType(v)}>
                      <SelectTrigger data-testid="select-payment-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="deposit">Deposit upfront</SelectItem>
                        <SelectItem value="full">Full payment upfront</SelectItem>
                        <SelectItem value="after">Pay after job</SelectItem>
                      </SelectContent>
                    </Select>
                    {paymentType === "deposit" && (
                      <div className="flex items-center gap-2">
                        <Label>Deposit amount:</Label>
                        <Input
                          type="number"
                          value={depositAmount}
                          onChange={(e) => setDepositAmount(parseInt(e.target.value) || 50)}
                          className="w-24"
                          data-testid="input-deposit-amount"
                        />
                      </div>
                    )}
                  </div>
                </details>

                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Check className="h-4 w-4 text-green-600" />
                  <span>Automatic reminders sent to your client</span>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-2">
              <Button
                onClick={() => sendLinkMutation.mutate()}
                className="w-full"
                size="lg"
                disabled={sendLinkMutation.isPending}
                data-testid="button-send-booking-link"
              >
                <Send className="h-4 w-4 mr-2" />
                {sendLinkMutation.isPending ? "Sending..." : "Send Booking Link"}
              </Button>
              
              <Button
                variant="outline"
                onClick={() => setIsEditing(true)}
                className="w-full"
                data-testid="button-edit-details"
              >
                <Edit2 className="h-4 w-4 mr-2" />
                Edit details
              </Button>
            </div>
          </div>
        )}

        {step === "sent" && (
          <div className="space-y-6 text-center py-8">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <PartyPopper className="h-10 w-10 text-green-600" />
            </div>
            
            <div>
              <h2 className="text-2xl font-semibold mb-2">Booking link sent 🎉</h2>
              <p className="text-muted-foreground">
                Your client can book and pay in seconds. You'll be notified when it's confirmed.
              </p>
            </div>

            <Card className="text-left">
              <CardContent className="pt-4 space-y-3">
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600" />
                    You'll get a confirmation
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600" />
                    The appointment is added to your schedule
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600" />
                    Reminders are sent automatically
                  </li>
                </ul>
              </CardContent>
            </Card>

            <div className="bg-muted p-3 rounded-lg">
              <p className="text-xs text-muted-foreground mb-2">Booking Link</p>
              <div className="flex items-center gap-2">
                <Input
                  value={bookingLinkUrl}
                  readOnly
                  className="text-sm"
                  data-testid="input-booking-link"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyLink}
                  data-testid="button-copy-link"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <Button
              onClick={() => navigate("/")}
              className="w-full"
              size="lg"
              data-testid="button-done"
            >
              Done
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
