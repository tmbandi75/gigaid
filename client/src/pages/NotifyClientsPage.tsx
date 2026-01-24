import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ArrowLeft, 
  Bell, 
  Users, 
  MessageSquare, 
  Mail, 
  AlertCircle, 
  CheckCircle2,
  Info,
  Link2,
  Plus,
  Send,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  categoryEventMapping, 
  serviceCategories, 
  notificationEventTypes,
  type ServiceCategory,
  type NotificationEventType,
} from "@shared/schema";

const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  snow_removal: "Snow Removal",
  lawn_landscaping: "Lawn & Landscaping",
  cleaning: "Cleaning",
  handyman_repairs: "Handyman & Repairs",
  moving_hauling: "Moving & Hauling",
  power_washing: "Power Washing",
  plumbing: "Plumbing",
  electrical: "Electrical",
  hvac: "HVAC",
  roofing: "Roofing",
  painting: "Painting",
  pool_spa_service: "Pool & Spa Service",
  pest_control: "Pest Control",
  appliance_repair: "Appliance Repair",
  window_cleaning: "Window Cleaning",
  carpet_flooring: "Carpet & Flooring",
  locksmith: "Locksmith",
  auto_detailing: "Auto Detailing",
  other: "Other Services",
};

const EVENT_LABELS: Record<NotificationEventType, string> = {
  environmental: "Weather/Environmental",
  seasonal: "Seasonal",
  availability: "Availability",
  risk: "Safety/Risk",
  relationship: "Relationship",
};

const EVENT_DESCRIPTIONS: Record<NotificationEventType, string> = {
  environmental: "Weather conditions affecting your clients (snow, rain, storms)",
  seasonal: "Time of year when service is typically needed",
  availability: "You have openings in your schedule",
  risk: "Safety or maintenance risks clients should address",
  relationship: "Following up with clients who haven't booked recently",
};

const MAX_SMS_LENGTH = 320;
const MAX_REASON_LENGTH = 120;

export default function NotifyClientsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [step, setStep] = useState<"service" | "event" | "compose" | "review">("service");
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const [selectedServiceCategory, setSelectedServiceCategory] = useState<ServiceCategory | "">("");
  const [selectedEventType, setSelectedEventType] = useState<NotificationEventType | "">("");
  const [eventReason, setEventReason] = useState("");
  const [channel, setChannel] = useState<"sms" | "email">("sms");
  const [bookingLink, setBookingLink] = useState("");
  const [messageContent, setMessageContent] = useState("");
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    errors: string[];
    warnings: string[];
    eligibleClientCount: number;
    suggestedMessage: string;
  } | null>(null);

  const { data: services, isLoading: servicesLoading } = useQuery<any[]>({
    queryKey: ["/api/provider-services"],
  });

  const { data: eligibleClients, isLoading: clientsLoading } = useQuery<{ count: number; clients: any[] }>({
    queryKey: ["/api/notification-campaigns/eligible-clients", channel],
    enabled: step === "compose" || step === "review",
  });

  const validateMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/notification-campaigns/validate", data);
      return response.json();
    },
    onSuccess: (result) => {
      setValidationResult(result);
      if (result.suggestedMessage && !messageContent) {
        setMessageContent(result.suggestedMessage);
      }
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/notification-campaigns", data);
      return response.json();
    },
    onSuccess: (result) => {
      toast({
        title: "Notifications Sent",
        description: `Successfully notified ${result.sent} clients.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/notification-campaigns"] });
      setLocation("/dashboard");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Send",
        description: error.message || "Could not send notifications. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleServiceSelect = (serviceId: string, category: ServiceCategory) => {
    setSelectedServiceId(serviceId);
    setSelectedServiceCategory(category);
    setSelectedEventType("");
    setStep("event");
  };

  const handleEventSelect = (eventType: NotificationEventType) => {
    setSelectedEventType(eventType);
    setStep("compose");
  };

  const handleValidate = () => {
    if (!selectedServiceId || !selectedEventType || !eventReason || !bookingLink) return;
    
    validateMutation.mutate({
      serviceId: selectedServiceId,
      eventType: selectedEventType,
      eventReason,
      channel,
      bookingLink,
      messageContent,
    });
    setStep("review");
  };

  const handleSend = () => {
    if (!validationResult?.valid) return;
    
    sendMutation.mutate({
      serviceId: selectedServiceId,
      eventType: selectedEventType,
      eventReason,
      channel,
      bookingLink,
      messageContent,
    });
  };

  const allowedEventTypes = selectedServiceCategory 
    ? categoryEventMapping[selectedServiceCategory] 
    : [];

  const remainingChars = MAX_SMS_LENGTH - messageContent.length;
  const remainingReasonChars = MAX_REASON_LENGTH - eventReason.length;

  return (
    <div className="container max-w-2xl mx-auto p-4 pb-20">
      <div className="flex items-center gap-3 mb-6">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => {
            if (step === "service") setLocation("/dashboard");
            else if (step === "event") setStep("service");
            else if (step === "compose") setStep("event");
            else if (step === "review") setStep("compose");
          }}
          data-testid="button-back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-semibold">Notify Clients</h1>
          <p className="text-sm text-muted-foreground">
            {step === "service" && "Select a service"}
            {step === "event" && "Choose why you're reaching out"}
            {step === "compose" && "Compose your message"}
            {step === "review" && "Review and send"}
          </p>
        </div>
      </div>

      {step === "service" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Bell className="h-5 w-5" />
              Select a Service
            </CardTitle>
            <CardDescription>
              Choose which service you want to notify clients about
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {servicesLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : services && services.length > 0 ? (
              services.map((service: any) => (
                <Button
                  key={service.id}
                  variant="outline"
                  className="w-full justify-start h-auto p-4"
                  onClick={() => handleServiceSelect(service.id, service.category)}
                  data-testid={`button-service-${service.id}`}
                >
                  <div className="text-left">
                    <div className="font-medium">{service.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {CATEGORY_LABELS[service.category as ServiceCategory] || service.category}
                    </div>
                  </div>
                </Button>
              ))
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  No services configured yet. Add a service to start notifying clients.
                </p>
                <Button onClick={() => setLocation("/settings")} data-testid="button-add-service">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Service
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === "event" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Info className="h-5 w-5" />
              Why are you reaching out?
            </CardTitle>
            <CardDescription>
              Client notifications must be tied to a real event. Select the reason that applies.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {allowedEventTypes.map((eventType) => (
              <Button
                key={eventType}
                variant="outline"
                className="w-full justify-start h-auto p-4"
                onClick={() => handleEventSelect(eventType)}
                data-testid={`button-event-${eventType}`}
              >
                <div className="text-left">
                  <div className="font-medium">{EVENT_LABELS[eventType]}</div>
                  <div className="text-sm text-muted-foreground">
                    {EVENT_DESCRIPTIONS[eventType]}
                  </div>
                </div>
              </Button>
            ))}
            <Alert className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Why event-based only?</AlertTitle>
              <AlertDescription>
                Client notifications are restricted to real events to prevent spam and maintain trust. 
                This isn't a marketing tool - it's for timely, relevant updates.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {step === "compose" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Event Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="eventReason">
                  Why is this event relevant right now? 
                  <span className="text-muted-foreground ml-1">({remainingReasonChars} characters left)</span>
                </Label>
                <Textarea
                  id="eventReason"
                  placeholder="E.g., Snow is forecasted for tomorrow morning"
                  value={eventReason}
                  onChange={(e) => setEventReason(e.target.value.slice(0, MAX_REASON_LENGTH))}
                  className="resize-none"
                  rows={2}
                  data-testid="input-event-reason"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Delivery Channel</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button
                  variant={channel === "sms" ? "default" : "outline"}
                  onClick={() => setChannel("sms")}
                  className="flex-1"
                  data-testid="button-channel-sms"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  SMS
                </Button>
                <Button
                  variant={channel === "email" ? "default" : "outline"}
                  onClick={() => setChannel("email")}
                  className="flex-1"
                  data-testid="button-channel-email"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Email
                </Button>
              </div>
              {eligibleClients && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>{eligibleClients.count} eligible clients</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Link2 className="h-5 w-5" />
                Booking Link
              </CardTitle>
              <CardDescription>Required for all client notifications</CardDescription>
            </CardHeader>
            <CardContent>
              <Input
                placeholder="https://..."
                value={bookingLink}
                onChange={(e) => setBookingLink(e.target.value)}
                data-testid="input-booking-link"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Message</CardTitle>
              {channel === "sms" && (
                <CardDescription>
                  {remainingChars} characters remaining. Must include opt-out text.
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Your message to clients..."
                value={messageContent}
                onChange={(e) => setMessageContent(e.target.value)}
                className="resize-none min-h-[120px]"
                data-testid="input-message-content"
              />
              {channel === "sms" && remainingChars < 50 && remainingChars >= 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>Getting close to the character limit</AlertDescription>
                </Alert>
              )}
              {channel === "sms" && remainingChars < 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>Message exceeds SMS character limit</AlertDescription>
                </Alert>
              )}
            </CardContent>
            <CardFooter>
              <Button 
                className="w-full" 
                onClick={handleValidate}
                disabled={!eventReason || !bookingLink || validateMutation.isPending}
                data-testid="button-review-message"
              >
                Review Message
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {step === "review" && (
        <div className="space-y-4">
          {validateMutation.isPending && (
            <Card>
              <CardContent className="py-8">
                <div className="flex items-center justify-center gap-3">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                  <span>Validating message...</span>
                </div>
              </CardContent>
            </Card>
          )}

          {validationResult && !validationResult.valid && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Cannot Send</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside mt-2">
                  {validationResult.errors.map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {validationResult && validationResult.valid && (
            <>
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Ready to Send</AlertTitle>
                <AlertDescription>
                  Your message passes all checks and is ready to be sent to {validationResult.eligibleClientCount} clients.
                </AlertDescription>
              </Alert>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Message Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted rounded-lg p-4 whitespace-pre-wrap text-sm">
                    {messageContent}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Channel</span>
                    <span className="font-medium">{channel === "sms" ? "SMS" : "Email"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Recipients</span>
                    <span className="font-medium">{validationResult.eligibleClientCount} clients</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Event Type</span>
                    <span className="font-medium">{EVENT_LABELS[selectedEventType as NotificationEventType]}</span>
                  </div>
                  <Separator className="my-3" />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Reason</span>
                    <span className="font-medium text-right max-w-[60%]">{eventReason}</span>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button 
                    className="w-full" 
                    onClick={handleSend}
                    disabled={sendMutation.isPending}
                    data-testid="button-send-notifications"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {sendMutation.isPending ? "Sending..." : "Send Notifications"}
                  </Button>
                </CardFooter>
              </Card>
            </>
          )}

          {validationResult && validationResult.warnings.length > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Warnings</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside mt-2">
                  {validationResult.warnings.map((warning, i) => (
                    <li key={i}>{warning}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <Button 
            variant="outline" 
            className="w-full" 
            onClick={() => setStep("compose")}
            data-testid="button-edit-message"
          >
            Edit Message
          </Button>
        </div>
      )}
    </div>
  );
}
