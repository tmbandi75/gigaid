import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bell,
  Users,
  MessageSquare,
  Mail,
  AlertCircle,
  CheckCircle2,
  Info,
  Link2,
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
  Search,
  FileText,
  Megaphone,
  RefreshCw,
  ArrowRight,
  Eye,
  Hash,
  Target,
} from "lucide-react";
import type { ServiceCategory, NotificationEventType } from "@shared/schema";
import { categoryEventMapping } from "@shared/schema";

interface ServiceItem {
  id: string;
  name: string;
  category: ServiceCategory;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  eligibleClientCount: number;
  suggestedMessage: string;
}

interface DesktopViewProps {
  step: "service" | "event" | "compose" | "review";
  setStep: (s: "service" | "event" | "compose" | "review") => void;
  services: ServiceItem[];
  servicesLoading: boolean;
  selectedServiceId: string;
  selectedServiceName: string;
  selectedServiceCategory: ServiceCategory | "";
  selectedEventType: NotificationEventType | "";
  eventReason: string;
  setEventReason: (v: string) => void;
  channel: "sms" | "email";
  setChannel: (v: "sms" | "email") => void;
  bookingLink: string;
  setBookingLink: (v: string) => void;
  messageContent: string;
  setMessageContent: (v: string) => void;
  validationResult: ValidationResult | null;
  validationError: string | null;
  eligibleClients: { count: number; clients: any[] } | undefined;
  handleServiceSelect: (id: string, name: string, cat: ServiceCategory) => void;
  handleEventSelect: (et: NotificationEventType) => void;
  handleValidate: () => void;
  handleSend: () => void;
  validateMutationPending: boolean;
  sendMutationPending: boolean;
  CATEGORY_LABELS: Record<ServiceCategory, string>;
  EVENT_LABELS: Record<NotificationEventType, string>;
  EVENT_DESCRIPTIONS: Record<NotificationEventType, string>;
  EVENT_ICONS: Record<NotificationEventType, any>;
  EVENT_COLORS: Record<NotificationEventType, string>;
  EVENT_ICON_BG: Record<NotificationEventType, string>;
  MAX_SMS_LENGTH: number;
  MAX_REASON_LENGTH: number;
}

const CAMPAIGN_TEMPLATES = [
  { id: "promo", label: "Promotion", icon: Megaphone, color: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-950/30", starter: "Hi {{first_name}}, we're running a special on {{service}} this week! Book now and save: {{booking_link}}" },
  { id: "reminder", label: "Reminder", icon: Bell, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/30", starter: "Hi {{first_name}}, just a reminder — it's time for your {{service}} service. Book your slot: {{booking_link}}" },
  { id: "seasonal", label: "Seasonal", icon: Calendar, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/30", starter: "Hi {{first_name}}, the season is changing and now is the perfect time for {{service}}. Schedule here: {{booking_link}}" },
  { id: "announcement", label: "Announcement", icon: FileText, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/30", starter: "Hi {{first_name}}, exciting news! We've expanded our {{service}} offerings. Check availability: {{booking_link}}" },
  { id: "reengagement", label: "Re-engagement", icon: RefreshCw, color: "text-pink-600", bg: "bg-pink-50 dark:bg-pink-950/30", starter: "Hi {{first_name}}, we miss you! It's been a while since your last {{service}}. Let's get you scheduled: {{booking_link}}" },
];

const DESKTOP_STEPS = [
  { key: "audience", label: "Choose Audience", maps: ["service", "event"] },
  { key: "message", label: "Build Message", maps: ["compose"] },
  { key: "send", label: "Review & Send", maps: ["review"] },
];

function DesktopStepIndicator({ step }: { step: string }) {
  const mapStep = (s: string) => {
    if (s === "service" || s === "event") return 0;
    if (s === "compose") return 1;
    return 2;
  };
  const currentIdx = mapStep(step);

  return (
    <div className="flex items-center gap-2" data-testid="desktop-step-indicator">
      {DESKTOP_STEPS.map((ds, i) => {
        const isComplete = i < currentIdx;
        const isCurrent = i === currentIdx;
        return (
          <div key={ds.key} className="flex items-center gap-2 flex-1">
            <div className="flex items-center gap-2 flex-1">
              <div className={`
                w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all
                ${isComplete ? "bg-emerald-500 text-white" : ""}
                ${isCurrent ? "bg-primary text-primary-foreground ring-4 ring-primary/20" : ""}
                ${!isComplete && !isCurrent ? "bg-muted text-muted-foreground" : ""}
              `}>
                {isComplete ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
              </div>
              <span className={`text-sm font-medium whitespace-nowrap ${isCurrent ? "text-foreground" : "text-muted-foreground"}`}>
                {ds.label}
              </span>
            </div>
            {i < DESKTOP_STEPS.length - 1 && (
              <div className={`h-px flex-1 min-w-8 ${i < currentIdx ? "bg-emerald-500" : "bg-border"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function NotifyClientsDesktopView(props: DesktopViewProps) {
  const {
    step, setStep, services, servicesLoading,
    selectedServiceId, selectedServiceName, selectedServiceCategory,
    selectedEventType, eventReason, setEventReason,
    channel, setChannel, bookingLink, setBookingLink,
    messageContent, setMessageContent, validationResult, validationError,
    eligibleClients, handleServiceSelect, handleEventSelect,
    handleValidate, handleSend, validateMutationPending, sendMutationPending,
    CATEGORY_LABELS, EVENT_LABELS, EVENT_DESCRIPTIONS, EVENT_ICONS,
    EVENT_COLORS, EVENT_ICON_BG, MAX_SMS_LENGTH, MAX_REASON_LENGTH,
  } = props;

  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const filteredServices = useMemo(() => {
    return services.filter((s) => {
      if (categoryFilter !== "all" && s.category !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return s.name.toLowerCase().includes(q) || (CATEGORY_LABELS[s.category] || "").toLowerCase().includes(q);
      }
      return true;
    });
  }, [services, searchQuery, categoryFilter, CATEGORY_LABELS]);

  const serviceCategories = useMemo(() => {
    const cats = new Set(services.map(s => s.category));
    return Array.from(cats);
  }, [services]);

  const allowedEventTypes = selectedServiceCategory
    ? categoryEventMapping[selectedServiceCategory]
    : [];

  const remainingChars = MAX_SMS_LENGTH - messageContent.length;
  const remainingReasonChars = MAX_REASON_LENGTH - eventReason.length;

  const renderLeftPanel = () => (
    <div className="space-y-5">
      {step === "service" && (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search services..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-10 rounded-xl"
              aria-label="Search services"
              data-testid="input-desktop-search-services"
            />
          </div>

          {serviceCategories.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              <Button
                variant={categoryFilter === "all" ? "default" : "outline"}
                size="sm"
                className="rounded-full text-xs h-7"
                onClick={() => setCategoryFilter("all")}
                data-testid="filter-category-all"
              >
                All ({services.length})
              </Button>
              {serviceCategories.map((cat) => (
                <Button
                  key={cat}
                  variant={categoryFilter === cat ? "default" : "outline"}
                  size="sm"
                  className="rounded-full text-xs h-7"
                  onClick={() => setCategoryFilter(cat)}
                  data-testid={`filter-category-${cat}`}
                >
                  {CATEGORY_LABELS[cat] || cat}
                </Button>
              ))}
            </div>
          )}

          {servicesLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-[72px] rounded-xl" />)}
            </div>
          ) : filteredServices.length > 0 ? (
            <div className="space-y-2">
              {filteredServices.map((service) => {
                const isSelected = selectedServiceId === service.id;
                return (
                  <button
                    key={service.id}
                    className={`w-full text-left rounded-xl border-2 p-3.5 flex items-center gap-3 transition-all duration-150 group
                      ${isSelected
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-transparent bg-card hover:border-primary/30 hover:shadow-md"
                      }
                    `}
                    onClick={() => handleServiceSelect(service.id, service.name, service.category)}
                    data-testid={`button-service-${service.id}`}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"}`}>
                      <Bell className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{service.name}</div>
                      <div className="text-xs text-muted-foreground">{CATEGORY_LABELS[service.category] || service.category}</div>
                    </div>
                    {isSelected ? (
                      <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 flex-shrink-0 transition-opacity" />
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <Search className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No services match your search</p>
              <Button variant="ghost" size="sm" className="mt-2 text-xs" onClick={() => { setSearchQuery(""); setCategoryFilter("all"); }} data-testid="button-clear-service-filters">
                Clear filters
              </Button>
            </div>
          )}
        </>
      )}

      {step === "event" && (
        <>
          <div>
            <h3 className="text-sm font-semibold mb-1">Why are you reaching out?</h3>
            <p className="text-xs text-muted-foreground">Select the event type for your notification</p>
          </div>
          <div className="space-y-2">
            {allowedEventTypes.map((eventType) => {
              const Icon = EVENT_ICONS[eventType];
              const colorClass = EVENT_COLORS[eventType];
              const iconBg = EVENT_ICON_BG[eventType];
              const isSelected = selectedEventType === eventType;
              return (
                <button
                  key={eventType}
                  className={`w-full text-left rounded-xl border-2 p-3.5 flex items-center gap-3 transition-all duration-150
                    ${isSelected
                      ? "border-primary shadow-sm"
                      : `border-transparent hover:shadow-md ${colorClass}`
                    }
                  `}
                  onClick={() => handleEventSelect(eventType)}
                  data-testid={`button-event-${eventType}`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{EVENT_LABELS[eventType]}</div>
                    <div className="text-xs opacity-70 mt-0.5">{EVENT_DESCRIPTIONS[eventType]}</div>
                  </div>
                  {isSelected && <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        </>
      )}

      {(step === "compose" || step === "review") && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold mb-1">Compose Your Message</h3>
            <p className="text-xs text-muted-foreground">Write your notification or use a template</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="desktop-eventReason" className="text-xs font-medium text-muted-foreground">What's happening right now?</Label>
            <Textarea
              id="desktop-eventReason"
              placeholder="E.g., Snow is forecasted for tomorrow morning"
              value={eventReason}
              onChange={(e) => setEventReason(e.target.value.slice(0, MAX_REASON_LENGTH))}
              className="resize-none rounded-xl text-sm"
              rows={2}
              data-testid="input-event-reason"
            />
            <div className="flex justify-end">
              <span className={`text-[10px] ${remainingReasonChars < 20 ? "text-orange-500" : "text-muted-foreground"}`}>{remainingReasonChars} left</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">Send via</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border-2 text-xs font-medium transition-all ${channel === "sms" ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-muted-foreground/30"}`}
                onClick={() => setChannel("sms")}
                data-testid="button-channel-sms"
              >
                <MessageSquare className="h-3.5 w-3.5" /> SMS
              </button>
              <button
                className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border-2 text-xs font-medium transition-all ${channel === "email" ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-muted-foreground/30"}`}
                onClick={() => setChannel("email")}
                data-testid="button-channel-email"
              >
                <Mail className="h-3.5 w-3.5" /> Email
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Link2 className="h-3 w-3" /> Booking Link</Label>
            <Input
              placeholder="https://..."
              value={bookingLink}
              onChange={(e) => setBookingLink(e.target.value)}
              className="rounded-xl text-sm h-9"
              data-testid="input-booking-link"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-muted-foreground">Message</Label>
              {channel === "sms" && (
                <span className={`text-[10px] ${remainingChars < 0 ? "text-red-500 font-semibold" : remainingChars < 50 ? "text-orange-500" : "text-muted-foreground"}`}>
                  {remainingChars} / {MAX_SMS_LENGTH}
                </span>
              )}
            </div>
            <Textarea
              placeholder="Your message to clients..."
              value={messageContent}
              onChange={(e) => setMessageContent(e.target.value)}
              className="resize-none min-h-[100px] rounded-xl text-sm"
              data-testid="input-message-content"
            />
            {channel === "sms" && remainingChars < 0 && (
              <p className="text-[10px] text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Exceeds SMS limit</p>
            )}
          </div>

          {step === "compose" && (
            <Button
              className="w-full rounded-xl h-10 text-sm font-semibold"
              onClick={handleValidate}
              disabled={!eventReason || !bookingLink || validateMutationPending}
              data-testid="button-review-message"
            >
              {validateMutationPending ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground border-t-transparent" />
                  Validating...
                </div>
              ) : (
                <><Sparkles className="h-4 w-4 mr-2" /> Review & Send</>
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );

  const renderMiddlePanel = () => (
    <div className="space-y-4">
      <Card className="rounded-2xl border shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Target className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Audience Summary</h3>
          </div>

          {selectedServiceName ? (
            <div className="space-y-4">
              <div className="rounded-xl bg-primary/5 border border-primary/10 p-3">
                <div className="text-xs text-muted-foreground mb-1">Selected Service</div>
                <div className="font-semibold text-sm">{selectedServiceName}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{CATEGORY_LABELS[selectedServiceCategory as ServiceCategory] || ""}</div>
              </div>

              {selectedEventType && (
                <div className="rounded-xl bg-muted/50 p-3">
                  <div className="text-xs text-muted-foreground mb-1">Campaign Type</div>
                  <div className="font-medium text-sm flex items-center gap-2">
                    {(() => { const Icon = EVENT_ICONS[selectedEventType]; return Icon ? <Icon className="h-4 w-4" /> : null; })()}
                    {EVENT_LABELS[selectedEventType]}
                  </div>
                </div>
              )}

              <Separator />

              <div className="text-center">
                <div className="text-3xl font-bold text-primary">
                  {eligibleClients?.count ?? "—"}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {eligibleClients ? "Recipients selected" : "Estimated recipients"}
                </div>
              </div>

              {eligibleClients && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
                  <Zap className="h-3 w-3 text-amber-500" />
                  <span>Delivery: immediate via {channel === "sms" ? "SMS" : "email"}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6">
              <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                <Users className="h-6 w-6 text-muted-foreground/40" />
              </div>
              <p className="text-sm text-muted-foreground">Select a service to see your audience</p>
            </div>
          )}
        </CardContent>
      </Card>

      {step === "service" && services.length > 0 && (
        <Card className="rounded-2xl border shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-amber-500" />
              <h3 className="text-sm font-semibold">Suggested Campaigns</h3>
            </div>
            <div className="space-y-2">
              {services.slice(0, 3).map((service, idx) => {
                const labels = ["Reminder", "Seasonal Outreach", "Re-engagement"];
                return (
                  <button
                    key={service.id}
                    className="w-full text-left rounded-xl border bg-card p-3 hover:shadow-md hover:border-primary/30 transition-all group"
                    onClick={() => handleServiceSelect(service.id, service.name, service.category)}
                    data-testid={`suggested-campaign-${idx}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium">{service.name}</div>
                        <Badge variant="outline" className="text-[10px] mt-1 border-amber-200 text-amber-600">{labels[idx % 3]}</Badge>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {(step === "compose" || step === "review") && (
        <Card className="rounded-2xl border shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Quick Templates</h3>
            </div>
            <div className="space-y-1.5">
              {CAMPAIGN_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  className="w-full text-left rounded-lg p-2.5 flex items-center gap-2.5 hover:bg-muted/50 transition-colors group"
                  onClick={() => setMessageContent(tpl.starter)}
                  data-testid={`template-${tpl.id}`}
                >
                  <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${tpl.bg}`}>
                    <tpl.icon className={`h-3.5 w-3.5 ${tpl.color}`} />
                  </div>
                  <span className="text-xs font-medium">{tpl.label}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-2xl border shadow-sm bg-muted/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Suggested Timing</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Send when your clients are most likely to see the message — typically mid-morning or early afternoon on weekdays.
          </p>
        </CardContent>
      </Card>
    </div>
  );

  const renderRightPanel = () => (
    <div className="space-y-4 sticky top-28">
      <Card className="rounded-2xl border shadow-sm overflow-hidden">
        <div className="bg-muted/30 px-5 py-3 border-b flex items-center gap-2">
          <Eye className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Campaign Preview</span>
        </div>
        <CardContent className="p-5">
          {!selectedServiceName ? (
            <div className="text-center py-8">
              <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                <FileText className="h-7 w-7 text-muted-foreground/30" />
              </div>
              <p className="text-sm text-muted-foreground">Select a service and campaign type to preview your message</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">{selectedServiceName}</Badge>
                  {selectedEventType && (
                    <>
                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                      <Badge variant="outline" className="text-[10px]">{EVENT_LABELS[selectedEventType]}</Badge>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <Hash className="h-3 w-3" />
                  <span>{channel === "sms" ? "SMS" : "Email"}</span>
                  {eligibleClients && <><span className="mx-1">·</span><Users className="h-3 w-3" /><span>{eligibleClients.count} recipients</span></>}
                </div>
              </div>

              <div className={`rounded-xl p-4 text-sm whitespace-pre-wrap leading-relaxed ${
                channel === "sms"
                  ? "bg-gradient-to-b from-primary/5 to-primary/10 border border-primary/15"
                  : "bg-muted/50 border border-border"
              }`}>
                {messageContent || (
                  <span className="text-muted-foreground italic">
                    {eventReason
                      ? "Complete the compose step to see your message preview..."
                      : "Your message will appear here once composed..."}
                  </span>
                )}
              </div>

              {messageContent && channel === "sms" && (
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span>{messageContent.length} chars</span>
                  <span className={`${messageContent.length > MAX_SMS_LENGTH ? "text-red-500 font-semibold" : "text-emerald-600"}`}>
                    {messageContent.length <= MAX_SMS_LENGTH ? "Within SMS limit" : "Over SMS limit"}
                  </span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {step === "review" && (
        <Card className="rounded-2xl border shadow-sm">
          <CardContent className="p-5 space-y-3">
            {validateMutationPending && (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mb-3" />
                <p className="text-sm text-muted-foreground">Validating campaign...</p>
              </div>
            )}

            {!validateMutationPending && validationError && (
              <div className="space-y-3">
                <div className="rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-4 text-center">
                  <AlertCircle className="h-6 w-6 text-red-500 mx-auto mb-2" />
                  <h4 className="font-semibold text-red-700 dark:text-red-400 text-sm mb-1">Validation Failed</h4>
                  <p className="text-xs text-red-600 dark:text-red-400">{validationError}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 rounded-xl text-xs h-9" onClick={() => setStep("compose")} data-testid="button-edit-message">Edit</Button>
                  <Button className="flex-1 rounded-xl text-xs h-9" onClick={handleValidate} data-testid="button-retry-validation">
                    <RotateCcw className="h-3 w-3 mr-1" /> Retry
                  </Button>
                </div>
              </div>
            )}

            {validationResult && !validationResult.valid && (
              <div className="space-y-3">
                <div className="rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <h4 className="font-semibold text-red-700 dark:text-red-400 text-sm">Cannot Send</h4>
                  </div>
                  <ul className="space-y-1">
                    {validationResult.errors.map((err, i) => (
                      <li key={i} className="text-xs text-red-600 dark:text-red-400 flex items-start gap-1.5">
                        <span className="mt-1.5 w-1 h-1 rounded-full bg-red-500 flex-shrink-0" />{err}
                      </li>
                    ))}
                  </ul>
                </div>
                <Button variant="outline" className="w-full rounded-xl text-xs h-9" onClick={() => setStep("compose")} data-testid="button-edit-message">Edit Message</Button>
              </div>
            )}

            {validationResult && validationResult.valid && (
              <div className="space-y-3">
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-emerald-700 dark:text-emerald-400 text-xs">Ready to send</h4>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-500">
                      {validationResult.eligibleClientCount} recipient{validationResult.eligibleClientCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1.5">
                    <span className="text-muted-foreground">Channel</span>
                    <Badge variant="secondary" className="text-[10px]">{channel === "sms" ? "SMS" : "Email"}</Badge>
                  </div>
                  <Separator />
                  <div className="flex justify-between py-1.5">
                    <span className="text-muted-foreground">Recipients</span>
                    <span className="font-semibold">{validationResult.eligibleClientCount}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between py-1.5">
                    <span className="text-muted-foreground">Event</span>
                    <span className="font-medium">{EVENT_LABELS[selectedEventType as NotificationEventType]}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between py-1.5">
                    <span className="text-muted-foreground">Reason</span>
                    <span className="font-medium text-right max-w-[55%] truncate">{eventReason}</span>
                  </div>
                </div>

                {validationResult.warnings.length > 0 && (
                  <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                      <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">Heads up</span>
                    </div>
                    <ul className="space-y-0.5">
                      {validationResult.warnings.map((w, i) => (
                        <li key={i} className="text-[10px] text-amber-600 dark:text-amber-400">{w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <Button
                  className="w-full rounded-xl h-10 text-sm font-semibold"
                  onClick={handleSend}
                  disabled={sendMutationPending}
                  data-testid="button-send-notifications"
                >
                  {sendMutationPending ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground border-t-transparent" />
                      Sending...
                    </div>
                  ) : (
                    <><Send className="h-4 w-4 mr-2" /> Send to {validationResult.eligibleClientCount} Client{validationResult.eligibleClientCount !== 1 ? "s" : ""}</>
                  )}
                </Button>
                <Button variant="ghost" className="w-full text-xs" onClick={() => setStep("compose")} data-testid="button-edit-message">
                  Edit Message
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );

  return (
    <div className="flex-1 max-w-7xl mx-auto w-full px-6 lg:px-8 py-6">
      <div className="bg-card rounded-2xl border shadow-sm p-5 mb-6">
        <DesktopStepIndicator step={step} />
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-4">
          <Card className="rounded-2xl border shadow-sm overflow-hidden">
            <div className="bg-muted/20 px-5 py-3 border-b">
              <h2 className="text-sm font-semibold">
                {step === "service" ? "Select Service" : step === "event" ? "Select Event" : "Compose"}
              </h2>
            </div>
            <CardContent className="p-5">
              {renderLeftPanel()}
            </CardContent>
          </Card>
        </div>

        <div className="col-span-4">
          {renderMiddlePanel()}
        </div>

        <div className="col-span-4">
          {renderRightPanel()}
        </div>
      </div>
    </div>
  );
}
