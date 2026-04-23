import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  ChevronRight,
  Zap,
  CloudSnow,
  Calendar,
  Clock,
  ShieldAlert,
  Heart,
  Sparkles,
  RotateCcw,
} from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { useApiMutation } from "@/hooks/useApiMutation";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useUpgradeOrchestrator, UpgradeBanner, UpgradeInterceptModal } from "@/upgrade";
import { useCanPerform } from "@/hooks/useCapability";
import { 
  categoryEventMapping, 
  type ServiceCategory,
  type NotificationEventType,
} from "@shared/schema";
import { findCategoryForService } from "@shared/service-categories";
import NotifyClientsDesktopView from "@/components/notify-clients/NotifyClientsDesktopView";
import { SmsOptOutBanner } from "@/components/settings/SmsOptOutBanner";

const categoryIdToSchemaCategory: Record<string, ServiceCategory> = {
  "handyman": "handyman_repairs",
  "plumbing": "plumbing",
  "electrical": "electrical",
  "cleaning": "cleaning",
  "lawn-outdoor": "lawn_landscaping",
  "windows-exterior": "window_cleaning",
  "flooring": "carpet_flooring",
  "carpentry": "handyman_repairs",
  "hvac": "hvac",
  "moving": "moving_hauling",
  "auto": "auto_detailing",
  "security": "handyman_repairs",
  "seasonal": "snow_removal",
  "interior-care": "cleaning",
  "hair-beauty": "other",
  "child-care": "other",
  "pet-care": "other",
  "house-care": "other",
  "wellness": "other",
  "creative": "other",
  "events": "other",
  "education": "other",
  "specialty-cleaning": "cleaning",
  "professional": "other",
  "tech-help": "other",
  "concierge": "other",
  "inspection": "other",
  "other": "other",
};

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
  environmental: "Weather / Environmental",
  seasonal: "Seasonal Reminder",
  availability: "Schedule Opening",
  risk: "Safety / Risk Alert",
  relationship: "Client Check-In",
};

const EVENT_DESCRIPTIONS: Record<NotificationEventType, string> = {
  environmental: "Weather conditions affecting your clients",
  seasonal: "Time of year when service is typically needed",
  availability: "You have openings in your schedule",
  risk: "Safety or maintenance risks clients should address",
  relationship: "Following up with clients who haven't booked recently",
};

const EVENT_ICONS: Record<NotificationEventType, typeof CloudSnow> = {
  environmental: CloudSnow,
  seasonal: Calendar,
  availability: Clock,
  risk: ShieldAlert,
  relationship: Heart,
};

const EVENT_COLORS: Record<NotificationEventType, string> = {
  environmental: "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  seasonal: "bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  availability: "bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800",
  risk: "bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800",
  relationship: "bg-pink-50 dark:bg-pink-950/30 text-pink-600 dark:text-pink-400 border-pink-200 dark:border-pink-800",
};

const EVENT_ICON_BG: Record<NotificationEventType, string> = {
  environmental: "bg-blue-100 dark:bg-blue-900/50",
  seasonal: "bg-amber-100 dark:bg-amber-900/50",
  availability: "bg-green-100 dark:bg-green-900/50",
  risk: "bg-red-100 dark:bg-red-900/50",
  relationship: "bg-pink-100 dark:bg-pink-900/50",
};

const MAX_SMS_LENGTH = 320;
const MAX_REASON_LENGTH = 120;

type Step = "service" | "event" | "compose" | "review";
const STEPS: { key: Step; label: string }[] = [
  { key: "service", label: "Service" },
  { key: "event", label: "Reason" },
  { key: "compose", label: "Compose" },
  { key: "review", label: "Review" },
];

function StepIndicator({ currentStep }: { currentStep: Step }) {
  const currentIndex = STEPS.findIndex(s => s.key === currentStep);
  return (
    <div className="flex items-center gap-1 w-full" data-testid="step-indicator">
      {STEPS.map((s, i) => {
        const isComplete = i < currentIndex;
        const isCurrent = i === currentIndex;
        return (
          <div key={s.key} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div className={`
                w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300
                ${isComplete ? "bg-green-500 text-white" : ""}
                ${isCurrent ? "bg-primary text-primary-foreground ring-4 ring-primary/20" : ""}
                ${!isComplete && !isCurrent ? "bg-muted text-muted-foreground" : ""}
              `}>
                {isComplete ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
              </div>
              <span className={`text-[10px] mt-1 font-medium transition-colors ${isCurrent ? "text-primary" : "text-muted-foreground"}`}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-0.5 flex-1 mx-1 mb-4 rounded transition-colors ${i < currentIndex ? "bg-green-500" : "bg-muted"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function NotifyClientsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  
  const notificationCap = useCanPerform('notifications.event_driven');
  const notifyUpgrade = useUpgradeOrchestrator({ capabilityKey: 'notifications.event_driven', surface: 'notifications' });
  const [interceptModalOpen, setInterceptModalOpen] = useState(false);

  const [step, setStep] = useState<Step>("service");
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const [selectedServiceName, setSelectedServiceName] = useState<string>("");
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

  const { data: profile, isLoading: profileLoading } = useQuery<any>({
    queryKey: QUERY_KEYS.profile(),
  });

  const services = (profile?.services || []).map((serviceName: string, index: number) => {
    const category = findCategoryForService(serviceName);
    const categoryId = category?.id || "other";
    const schemaCategory = categoryIdToSchemaCategory[categoryId] || "other";
    return {
      id: `profile-service-${index}`,
      name: serviceName,
      category: schemaCategory,
    };
  });
  const servicesLoading = profileLoading;

  useEffect(() => {
    if (profile?.publicProfileSlug && !bookingLink) {
      setBookingLink(`${window.location.origin}/book/${profile.publicProfileSlug}`);
    }
  }, [profile?.publicProfileSlug]);

  const { data: eligibleClients } = useQuery<{ count: number; clients: any[] }>({
    queryKey: QUERY_KEYS.eligibleClients(channel),
    enabled: isMobile
      ? (step === "compose" || step === "review")
      : !!selectedServiceId,
  });

  const [validationError, setValidationError] = useState<string | null>(null);

  const validateMutation = useApiMutation(
    async (data: any) => {
      return apiFetch("/api/notification-campaigns/validate", { method: "POST", body: JSON.stringify(data) });
    },
    [],
    {
      onSuccess: (result: any) => {
        setValidationError(null);
        setValidationResult(result);
        if (result.suggestedMessage && !messageContent) {
          setMessageContent(result.suggestedMessage);
        }
      },
      onError: (error: any) => {
        setValidationError(error.message || "Validation failed. Please try again.");
      },
    }
  );

  const sendMutation = useApiMutation(
    async (data: any) => {
      return apiFetch("/api/notification-campaigns", { method: "POST", body: JSON.stringify(data) });
    },
    [QUERY_KEYS.campaigns()],
    {
      onSuccess: (result: any) => {
        toast({
          title: "Notifications Sent",
          description: `Successfully notified ${result.sent} clients.`,
        });
        setLocation("/dashboard");
      },
      onError: (error: any) => {
        toast({
          title: "Failed to Send",
          description: error.message || "Could not send notifications. Please try again.",
          variant: "destructive",
        });
      },
    }
  );

  const handleServiceSelect = (serviceId: string, serviceName: string, category: ServiceCategory) => {
    setSelectedServiceId(serviceId);
    setSelectedServiceName(serviceName);
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
    if (notificationCap.mode === 'suggest_only' || !notificationCap.allowed) {
      setInterceptModalOpen(true);
      return;
    }
    
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

  const handleBackNavigation = () => {
    if (step === "service") setLocation("/dashboard");
    else if (step === "event") setStep("service");
    else if (step === "compose") setStep("event");
    else if (step === "review") setStep("compose");
  };

  const renderServiceStep = () => (
    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-3">
          <Zap className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-xl font-semibold">Which service?</h2>
        <p className="text-sm text-muted-foreground mt-1">Pick the service you want to notify clients about</p>
      </div>

      {servicesLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      ) : services && services.length > 0 ? (
        <div className="space-y-2">
          {services.map((service: any) => (
            <button
              key={service.id}
              className="w-full text-left rounded-xl border border-border bg-card p-4 flex items-center gap-4 hover:border-primary/50 hover:bg-accent/50 active:scale-[0.98] transition-all duration-150"
              onClick={() => handleServiceSelect(service.id, service.name, service.category)}
              data-testid={`button-service-${service.id}`}
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Bell className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{service.name}</div>
                <div className="text-xs text-muted-foreground">
                  {CATEGORY_LABELS[service.category as ServiceCategory] || service.category}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </button>
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Plus className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-center mb-4 text-sm">
              No services configured yet
            </p>
            <Button onClick={() => setLocation("/profile?edit=true")} size="sm" data-testid="button-add-service">
              <Plus className="h-4 w-4 mr-1" />
              Add Services
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderEventStep = () => (
    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold">Why are you reaching out?</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Notifications must be tied to a real event to maintain trust
        </p>
      </div>

      {selectedServiceName && (
        <div className="flex items-center justify-center mb-2">
          <Badge variant="secondary" className="text-xs px-3 py-1">
            {selectedServiceName}
          </Badge>
        </div>
      )}

      <div className="space-y-2">
        {allowedEventTypes.map((eventType) => {
          const Icon = EVENT_ICONS[eventType];
          const colorClass = EVENT_COLORS[eventType];
          const iconBg = EVENT_ICON_BG[eventType];
          return (
            <button
              key={eventType}
              className={`w-full text-left rounded-xl border p-4 flex items-center gap-4 hover:shadow-md active:scale-[0.98] transition-all duration-150 ${colorClass}`}
              onClick={() => handleEventSelect(eventType)}
              data-testid={`button-event-${eventType}`}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{EVENT_LABELS[eventType]}</div>
                <div className="text-xs opacity-80 mt-0.5">
                  {EVENT_DESCRIPTIONS[eventType]}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 opacity-50 flex-shrink-0" />
            </button>
          );
        })}
      </div>

      <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 mt-4">
        <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
        <p className="text-xs text-muted-foreground">
          Event-based notifications prevent spam and keep your clients engaged. 
          This is not a marketing tool.
        </p>
      </div>
    </div>
  );

  const renderComposeStep = () => (
    <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
      {selectedServiceName && selectedEventType && (
        <div className="flex items-center gap-2 flex-wrap justify-center">
          <Badge variant="secondary" className="text-xs">{selectedServiceName}</Badge>
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
          <Badge variant="outline" className="text-xs">{EVENT_LABELS[selectedEventType as NotificationEventType]}</Badge>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="eventReason" className="text-sm font-medium">
          What's happening right now?
        </Label>
        <Textarea
          id="eventReason"
          placeholder="E.g., Snow is forecasted for tomorrow morning"
          value={eventReason}
          onChange={(e) => setEventReason(e.target.value.slice(0, MAX_REASON_LENGTH))}
          className="resize-none rounded-xl"
          rows={2}
          data-testid="input-event-reason"
        />
        <div className="flex justify-end">
          <span className={`text-xs ${remainingReasonChars < 20 ? "text-orange-500" : "text-muted-foreground"}`}>
            {remainingReasonChars} left
          </span>
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-medium">Send via</Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 text-sm font-medium transition-all duration-150 ${
              channel === "sms" 
                ? "border-primary bg-primary/5 text-primary" 
                : "border-border hover:border-muted-foreground/30"
            }`}
            onClick={() => setChannel("sms")}
            data-testid="button-channel-sms"
          >
            <MessageSquare className="h-4 w-4" />
            SMS
          </button>
          <button
            className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 text-sm font-medium transition-all duration-150 ${
              channel === "email" 
                ? "border-primary bg-primary/5 text-primary" 
                : "border-border hover:border-muted-foreground/30"
            }`}
            onClick={() => setChannel("email")}
            data-testid="button-channel-email"
          >
            <Mail className="h-4 w-4" />
            Email
          </button>
        </div>
        {eligibleClients && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
            <Users className="h-3.5 w-3.5" />
            <span>{eligibleClients.count} eligible client{eligibleClients.count !== 1 ? "s" : ""}</span>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium flex items-center gap-1.5">
          <Link2 className="h-3.5 w-3.5" />
          Booking Link
        </Label>
        <Input
          placeholder="https://..."
          value={bookingLink}
          onChange={(e) => setBookingLink(e.target.value)}
          className="rounded-xl"
          data-testid="input-booking-link"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Message</Label>
          {channel === "sms" && (
            <span className={`text-xs ${remainingChars < 0 ? "text-red-500 font-semibold" : remainingChars < 50 ? "text-orange-500" : "text-muted-foreground"}`}>
              {remainingChars} / {MAX_SMS_LENGTH}
            </span>
          )}
        </div>
        <Textarea
          placeholder="Your message to clients..."
          value={messageContent}
          onChange={(e) => setMessageContent(e.target.value)}
          className="resize-none min-h-[120px] rounded-xl"
          data-testid="input-message-content"
        />
        {channel === "sms" && remainingChars < 0 && (
          <p className="text-xs text-red-500 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Message exceeds SMS character limit
          </p>
        )}
      </div>

      <Button 
        className="w-full rounded-xl h-12 text-sm font-semibold" 
        onClick={handleValidate}
        disabled={!eventReason || !bookingLink || validateMutation.isPending}
        data-testid="button-review-message"
      >
        {validateMutation.isPending ? (
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground border-t-transparent" />
            Validating...
          </div>
        ) : (
          <>
            <Sparkles className="h-4 w-4 mr-2" />
            Review & Send
          </>
        )}
      </Button>
    </div>
  );

  const renderReviewStep = () => (
    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
      {validateMutation.isPending && (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-3 border-primary border-t-transparent mb-4" />
          <p className="text-sm text-muted-foreground">Checking your message...</p>
        </div>
      )}

      {!validateMutation.isPending && validationError && (
        <div className="space-y-4">
          <div className="rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-5 text-center">
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-3" />
            <h3 className="font-semibold text-red-700 dark:text-red-400 mb-1">Something went wrong</h3>
            <p className="text-sm text-red-600 dark:text-red-400">{validationError}</p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="flex-1 rounded-xl" 
              onClick={() => setStep("compose")}
              data-testid="button-edit-message"
            >
              Edit Message
            </Button>
            <Button 
              className="flex-1 rounded-xl" 
              onClick={handleValidate}
              data-testid="button-retry-validation"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </div>
      )}

      {validationResult && !validationResult.valid && (
        <div className="space-y-4">
          <div className="rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <h3 className="font-semibold text-red-700 dark:text-red-400">Cannot Send</h3>
            </div>
            <ul className="space-y-1.5">
              {validationResult.errors.map((error, i) => (
                <li key={i} className="text-sm text-red-600 dark:text-red-400 flex items-start gap-2">
                  <span className="mt-1.5 w-1 h-1 rounded-full bg-red-500 flex-shrink-0" />
                  {error}
                </li>
              ))}
            </ul>
          </div>
          <Button 
            variant="outline" 
            className="w-full rounded-xl" 
            onClick={() => setStep("compose")}
            data-testid="button-edit-message"
          >
            Edit Message
          </Button>
        </div>
      )}

      {validationResult && validationResult.valid && (
        <>
          <div className="rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="font-semibold text-green-700 dark:text-green-400 text-sm">Ready to send</h3>
              <p className="text-xs text-green-600 dark:text-green-500">
                {validationResult.eligibleClientCount} client{validationResult.eligibleClientCount !== 1 ? "s" : ""} will receive this message
              </p>
            </div>
          </div>

          <Card className="rounded-xl overflow-hidden">
            <div className="bg-muted/30 px-4 py-2.5 border-b">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Preview</span>
            </div>
            <CardContent className="p-4">
              <div className={`rounded-xl p-4 text-sm whitespace-pre-wrap leading-relaxed ${
                channel === "sms" 
                  ? "bg-primary/5 border border-primary/10" 
                  : "bg-muted/50 border border-border"
              }`}>
                {messageContent}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between py-1">
                <span className="text-xs text-muted-foreground">Channel</span>
                <Badge variant="secondary" className="text-xs">
                  {channel === "sms" ? "SMS" : "Email"}
                </Badge>
              </div>
              <Separator />
              <div className="flex items-center justify-between py-1">
                <span className="text-xs text-muted-foreground">Recipients</span>
                <span className="text-sm font-semibold">{validationResult.eligibleClientCount}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between py-1">
                <span className="text-xs text-muted-foreground">Event</span>
                <span className="text-xs font-medium">{EVENT_LABELS[selectedEventType as NotificationEventType]}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between py-1">
                <span className="text-xs text-muted-foreground">Reason</span>
                <span className="text-xs font-medium text-right max-w-[55%] truncate">{eventReason}</span>
              </div>
            </CardContent>
          </Card>

          {validationResult.warnings.length > 0 && (
            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">Heads up</span>
              </div>
              <ul className="space-y-1">
                {validationResult.warnings.map((warning, i) => (
                  <li key={i} className="text-xs text-amber-600 dark:text-amber-400">{warning}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-2 pt-2">
            <Button 
              className="w-full rounded-xl h-12 text-sm font-semibold" 
              onClick={handleSend}
              disabled={sendMutation.isPending}
              data-testid="button-send-notifications"
            >
              {sendMutation.isPending ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground border-t-transparent" />
                  Sending...
                </div>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send to {validationResult.eligibleClientCount} Client{validationResult.eligibleClientCount !== 1 ? "s" : ""}
                </>
              )}
            </Button>
            <Button 
              variant="ghost" 
              className="w-full rounded-xl text-xs" 
              onClick={() => setStep("compose")}
              data-testid="button-edit-message"
            >
              Edit Message
            </Button>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-background" data-testid="page-notify-clients">
      {isMobile ? (
        <>
          <div 
            className="relative overflow-hidden text-white px-4 pt-5 pb-8"
            style={{ 
              background: 'linear-gradient(135deg, #1a56db 0%, #3b82f6 50%, #6366f1 100%)',
            }}
          >
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute -top-16 -right-16 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
              <div className="absolute bottom-0 -left-12 w-36 h-36 bg-indigo-400/20 rounded-full blur-2xl" />
            </div>
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={handleBackNavigation}
                  className="text-white hover:bg-white/20 -ml-1 h-9 w-9"
                  data-testid="button-back"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                  <h1 className="text-lg font-bold tracking-tight">Notify Clients</h1>
                  <p className="text-xs text-white/70">Send targeted, event-based notifications</p>
                </div>
              </div>
            </div>
          </div>

          <div className="max-w-2xl px-4 -mt-4 mx-auto w-full relative z-10">
            <div className="bg-card rounded-xl border shadow-sm p-4 mb-5">
              <StepIndicator currentStep={step} />
            </div>
          </div>

          <div className="flex-1 max-w-2xl px-4 pb-24 mx-auto w-full">
            <div className="mb-4">
              <SmsOptOutBanner />
            </div>
            {notifyUpgrade.bannerPayload && (
              <div className="mb-4">
                <UpgradeBanner
                  capabilityKey={notifyUpgrade.bannerPayload.capabilityKey}
                  remaining={notifyUpgrade.bannerPayload.remaining}
                  limit={notifyUpgrade.bannerPayload.limit}
                  current={notifyUpgrade.bannerPayload.current}
                  variant={notifyUpgrade.variant}
                  thresholdLevel={notifyUpgrade.bannerPayload.thresholdLevel || "warn"}
                  surface="notifications"
                  plan={notifyUpgrade.bannerPayload.plan}
                  recommendedPlan={notifyUpgrade.bannerPayload.recommendedPlan}
                />
              </div>
            )}

            {step === "service" && renderServiceStep()}
            {step === "event" && renderEventStep()}
            {step === "compose" && renderComposeStep()}
            {step === "review" && renderReviewStep()}
          </div>
        </>
      ) : (
        <>
          <div className="border-b bg-background sticky top-0 z-[999]">
            <div className="max-w-7xl mx-auto px-6 lg:px-8 py-4">
              <div className="flex items-center gap-4">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={handleBackNavigation}
                  className="h-10 w-10"
                  aria-label="Go back"
                  data-testid="button-back"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary/20 to-violet-500/20 flex items-center justify-center flex-shrink-0">
                  <Bell className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h1 className="text-xl font-semibold">Notify Clients</h1>
                  <p className="text-xs text-muted-foreground">Send targeted, event-based notifications</p>
                </div>
              </div>
            </div>
          </div>

          <div className="max-w-7xl mx-auto px-6 lg:px-8 mt-4">
            <SmsOptOutBanner />
          </div>

          {notifyUpgrade.bannerPayload && (
            <div className="max-w-7xl mx-auto px-6 lg:px-8 mt-4">
              <UpgradeBanner
                capabilityKey={notifyUpgrade.bannerPayload.capabilityKey}
                remaining={notifyUpgrade.bannerPayload.remaining}
                limit={notifyUpgrade.bannerPayload.limit}
                current={notifyUpgrade.bannerPayload.current}
                variant={notifyUpgrade.variant}
                thresholdLevel={notifyUpgrade.bannerPayload.thresholdLevel || "warn"}
                surface="notifications"
                plan={notifyUpgrade.bannerPayload.plan}
                recommendedPlan={notifyUpgrade.bannerPayload.recommendedPlan}
              />
            </div>
          )}

          <NotifyClientsDesktopView
            step={step}
            setStep={setStep}
            services={services}
            servicesLoading={servicesLoading}
            selectedServiceId={selectedServiceId}
            selectedServiceName={selectedServiceName}
            selectedServiceCategory={selectedServiceCategory}
            selectedEventType={selectedEventType}
            eventReason={eventReason}
            setEventReason={setEventReason}
            channel={channel}
            setChannel={setChannel}
            bookingLink={bookingLink}
            setBookingLink={setBookingLink}
            messageContent={messageContent}
            setMessageContent={setMessageContent}
            validationResult={validationResult}
            validationError={validationError}
            eligibleClients={eligibleClients}
            handleServiceSelect={handleServiceSelect}
            handleEventSelect={handleEventSelect}
            handleValidate={handleValidate}
            handleSend={handleSend}
            validateMutationPending={validateMutation.isPending}
            sendMutationPending={sendMutation.isPending}
            CATEGORY_LABELS={CATEGORY_LABELS}
            EVENT_LABELS={EVENT_LABELS}
            EVENT_DESCRIPTIONS={EVENT_DESCRIPTIONS}
            EVENT_ICONS={EVENT_ICONS}
            EVENT_COLORS={EVENT_COLORS}
            EVENT_ICON_BG={EVENT_ICON_BG}
            MAX_SMS_LENGTH={MAX_SMS_LENGTH}
            MAX_REASON_LENGTH={MAX_REASON_LENGTH}
          />
        </>
      )}

      <UpgradeInterceptModal
        open={interceptModalOpen}
        onOpenChange={setInterceptModalOpen}
        featureKey="notifications.event_driven"
        featureName="Smart Notifications"
      />
    </div>
  );
}
