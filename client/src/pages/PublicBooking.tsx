import { useState, useEffect, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiFetch";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { useApiMutation } from "@/hooks/useApiMutation";
import { trackEvent } from "@/components/PostHogProvider";
import { Star, Calendar, CheckCircle, Loader2, ChevronLeft, ChevronRight, Clock, History, RotateCcw, MapPin, Zap, Navigation, Shield, RefreshCw, CreditCard, AlertTriangle } from "lucide-react";
import { SmartServiceRecommender } from "@/components/booking/SmartServiceRecommender";
import { JobNotesAutocomplete } from "@/components/booking/JobNotesAutocomplete";
import { FAQAssistant } from "@/components/booking/FAQAssistant";
import { PriceEstimator } from "@/components/booking/PriceEstimator";
import { CategoryEstimator } from "@/components/booking/CategoryEstimator";
import { Confetti } from "@/components/booking/Confetti";
import { PhoneInput } from "@/components/ui/phone-input";
import { AddressAutocomplete } from "@/components/booking/AddressAutocomplete";
import { PhotoUpload } from "@/components/ui/photo-upload";
import { SupportTicketForm } from "@/components/SupportTicketForm";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { useUtmCapture } from "@/hooks/useUtmCapture";

interface PublicProfile {
  name: string;
  photo: string | null;
  businessName: string | null;
  services: string[];
  bio: string | null;
  rating: number;
  reviewCount: number;
  showReviews?: boolean;
  reviews: Array<{
    id: string;
    clientName: string;
    rating: number;
    comment: string;
    createdAt: string;
    providerResponse?: string | null;
    photos?: string[];
  }>;
  depositEnabled?: boolean;
  depositType?: string;
  depositValue?: number;
  lateRescheduleWindowHours?: number;
  lateRescheduleRetainPctFirst?: number;
  publicEstimationEnabled?: boolean;
  acceptedPaymentMethods?: Array<{ type: string; label: string | null; instructions: string | null }>;
  stripeConnected?: boolean;
  stripePublishableKey?: string;
  referralCode?: string;
}

interface DepositPaymentInfo {
  clientSecret: string;
  paymentIntentId: string;
  amount: number;
  currency: string;
}

interface BookingHistoryItem {
  serviceType: string;
  description: string;
  date: string;
  time: string;
  bookedAt: string;
}

interface AvailableSlots {
  available: boolean;
  slots: string[];
  slotDuration: number;
}

interface OptimizedSlot {
  time: string;
  proximityScore: number;
  travelTime: number;
  recommendation: "best" | "good" | "available";
  nearbyJob: { distance: number } | null;
}

interface SmartSlotsResponse {
  available: boolean;
  slots: string[];
  optimizedSlots: OptimizedSlot[];
  slotDuration: number;
  clientZipCode: string;
}

function DepositPaymentForm({ onSuccess, onError }: { onSuccess: () => void; onError: (msg: string) => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.href,
        },
        redirect: "if_required",
      });

      if (error) {
        onError(error.message || "Payment failed. Please try again.");
      } else {
        onSuccess();
      }
    } catch (err: any) {
      onError(err?.message || "An unexpected error occurred.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handlePayment} className="space-y-4" data-testid="form-deposit-payment">
      <PaymentElement data-testid="stripe-payment-element" />
      <Button
        type="submit"
        className="w-full"
        disabled={!stripe || processing}
        data-testid="button-pay-deposit"
      >
        {processing ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <CreditCard className="h-4 w-4 mr-2" />
        )}
        {processing ? "Processing..." : "Pay Deposit"}
      </Button>
    </form>
  );
}

export default function PublicBooking() {
  useUtmCapture();
  const { slug } = useParams<{ slug: string }>();
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [formData, setFormData] = useState({
    clientFirstName: "",
    clientLastName: "",
    clientPhone: "",
    clientEmail: "",
    serviceType: "",
    location: "",
    description: "",
  });
  const [bookingPhotos, setBookingPhotos] = useState<string[]>([]);
  const [clientZipCode, setClientZipCode] = useState("");
  const [clientLocationName, setClientLocationName] = useState("");
  const [zipConfirmed, setZipConfirmed] = useState(false);
  const [zipValidating, setZipValidating] = useState(false);
  const [zipError, setZipError] = useState<string | null>(null);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [bookingHistory, setBookingHistory] = useState<BookingHistoryItem[]>([]);
  const [policyAcknowledged, setPolicyAcknowledged] = useState(false);
  const [depositPaymentInfo, setDepositPaymentInfo] = useState<DepositPaymentInfo | null>(null);
  const [depositPaymentComplete, setDepositPaymentComplete] = useState(false);
  const [serviceAreaWarning, setServiceAreaWarning] = useState<string | null>(null);

  const getBookingHistoryKey = () => {
    const phone = formData.clientPhone.replace(/\D/g, "");
    return phone.length >= 10 ? `booking_history_${slug}_${phone}` : null;
  };

  const loadBookingHistory = () => {
    const key = getBookingHistoryKey();
    if (!key) return [];
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  };

  const saveToBookingHistory = (booking: BookingHistoryItem) => {
    const key = getBookingHistoryKey();
    if (!key) return;
    const history = loadBookingHistory();
    const updated = [booking, ...history.filter((h: BookingHistoryItem) => 
      !(h.serviceType === booking.serviceType && h.date === booking.date)
    )].slice(0, 10);
    localStorage.setItem(key, JSON.stringify(updated));
  };

  const applyHistoryBooking = (item: BookingHistoryItem) => {
    setFormData(prev => ({
      ...prev,
      serviceType: item.serviceType,
      description: item.description,
    }));
    setShowHistoryPanel(false);
    toast({ title: "Applied from history" });
  };

  const validateAndConfirmZip = async () => {
    if (clientZipCode.length !== 5) return;
    
    setZipValidating(true);
    setZipError(null);
    setServiceAreaWarning(null);
    
    try {
      const res = await fetch("/api/public/validate-zip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zipCode: clientZipCode, slug }),
      });
      
      const data = await res.json();
      
      if (data.valid) {
        setZipConfirmed(true);
        if (data.locationName) {
          setClientLocationName(data.locationName);
        }
        if (data.inServiceArea === false) {
          setServiceAreaWarning("This provider may not serve your area. You can still request a booking.");
        }
      } else {
        setZipError(data.error || "Please enter a valid US ZIP code");
      }
    } catch (error) {
      setZipError("Unable to verify ZIP code. Please try again.");
    } finally {
      setZipValidating(false);
    }
  };

  const [, navigate] = useLocation();
  const [isRedirecting, setIsRedirecting] = useState(false);

  const { data: profile, isLoading, error } = useQuery<PublicProfile>({
    queryKey: QUERY_KEYS.publicProfile(slug),
    queryFn: async () => {
      const res = await fetch(`/api/public/profile/${slug}`);
      if (!res.ok) throw new Error("Profile not found");
      const data = await res.json();
      if (data.redirect) {
        setIsRedirecting(true);
        navigate(`/book/${data.redirect}`, { replace: true });
        return null as unknown as PublicProfile;
      }
      return data;
    },
    enabled: !!slug && !isRedirecting,
  });

  const selectedDateStr = selectedDate 
    ? `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`
    : null;

  const { data: slotsData, isLoading: slotsLoading } = useQuery<AvailableSlots>({
    queryKey: QUERY_KEYS.publicAvailableSlots(slug, selectedDateStr),
    queryFn: async () => {
      const res = await fetch(`/api/public/available-slots/${slug}/${selectedDateStr}`);
      if (!res.ok) throw new Error("Failed to fetch slots");
      return res.json();
    },
    enabled: !!slug && !!selectedDateStr && !zipConfirmed,
  });

  const { data: smartSlotsData, isLoading: smartSlotsLoading } = useQuery<SmartSlotsResponse>({
    queryKey: QUERY_KEYS.publicSmartSlots(slug, selectedDateStr, clientZipCode),
    queryFn: async () => {
      const res = await fetch(`/api/public/smart-slots/${slug}/${selectedDateStr}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientZipCode }),
      });
      if (!res.ok) throw new Error("Failed to fetch smart slots");
      return res.json();
    },
    enabled: !!slug && !!selectedDateStr && zipConfirmed && clientZipCode.length === 5,
  });

  const submitMutation = useApiMutation(
    (data: { clientName: string; clientPhone: string; clientEmail: string; serviceType: string; location: string; description: string; preferredDate: string; preferredTime: string; photos?: string[]; policyAcknowledged?: boolean }) =>
      apiFetch(`/api/public/book/${slug}`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    [],
    {
      onSuccess: (data: any) => {
        saveToBookingHistory({
          serviceType: formData.serviceType,
          description: formData.description,
          date: selectedDateStr || "",
          time: selectedTime || "",
          bookedAt: new Date().toISOString(),
        });
        if (data?.depositPayment?.clientSecret) {
          setDepositPaymentInfo(data.depositPayment);
          setSubmitted(true);
        } else {
          setShowConfetti(true);
          setSubmitted(true);
          toast({ title: "Booking request sent!" });
        }
      },
      onError: () => {
        toast({ title: "Failed to submit booking", variant: "destructive" });
      },
    }
  );

  const stripePromise = useMemo(() => {
    if (profile?.stripePublishableKey) {
      return loadStripe(profile.stripePublishableKey);
    }
    return null;
  }, [profile?.stripePublishableKey]);

  const handleCheckHistory = () => {
    const history = loadBookingHistory();
    setBookingHistory(history);
    if (history.length > 0) {
      setShowHistoryPanel(true);
    } else {
      toast({ title: "No previous bookings found for this phone number" });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clientFirstName || !formData.clientLastName || !formData.clientPhone || !formData.serviceType || !selectedDate || !selectedTime) {
      toast({ title: "Please fill in all required fields and select a time", variant: "destructive" });
      return;
    }
    
    // Check for policy acknowledgment when deposits are required
    const depositRequired = profile?.depositEnabled && profile?.depositValue && profile.depositValue > 0;
    if (depositRequired && !policyAcknowledged) {
      toast({ 
        title: "Policy acknowledgment required", 
        description: "Please agree to the cancellation and reschedule policy to confirm your booking.",
        variant: "destructive" 
      });
      return;
    }
    
    submitMutation.mutate({
      clientName: `${formData.clientFirstName} ${formData.clientLastName}`.trim(),
      clientPhone: formData.clientPhone,
      clientEmail: formData.clientEmail,
      serviceType: formData.serviceType,
      location: formData.location,
      description: formData.description,
      preferredDate: selectedDateStr!,
      preferredTime: selectedTime,
      photos: bookingPhotos.length > 0 ? bookingPhotos : undefined,
      policyAcknowledged: depositRequired ? policyAcknowledged : undefined,
    });
  };

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${i < rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`}
      />
    ));
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(":");
    const h = parseInt(hours);
    const ampm = h >= 12 ? "PM" : "AM";
    const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: (Date | null)[] = [];
    
    // Add empty days for padding
    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(null);
    }
    
    // Add days of the month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(new Date(year, month, d));
    }
    
    return days;
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isPast = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  const isSelected = (date: Date) => {
    return selectedDate?.toDateString() === date.toDateString();
  };

  const monthYear = currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  if (isLoading || isRedirecting) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <Card>
            <CardContent className="py-12 text-center">
              <h2 className="text-xl font-semibold mb-2">Profile Not Found</h2>
              <p className="text-muted-foreground">
                This booking page doesn't exist or has been disabled.
              </p>
            </CardContent>
          </Card>
          <SupportTicketForm context="Booking profile not found" />
        </div>
      </div>
    );
  }

  if (submitted && depositPaymentInfo && !depositPaymentComplete) {
    if (!stripePromise) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="max-w-md w-full space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Booking Submitted
                </CardTitle>
                <CardDescription>
                  Your booking has been created. A deposit of ${(depositPaymentInfo.amount / 100).toFixed(2)} is required to confirm your time slot.
                  The provider will contact you with payment instructions.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => { setSubmitted(false); setShowConfetti(false); setSelectedDate(null); setSelectedTime(null); setDepositPaymentInfo(null); setDepositPaymentComplete(false); }}
                  data-testid="button-submit-another-fallback"
                >
                  Book Another Service
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                Complete Your Deposit
              </CardTitle>
              <CardDescription>
                Your booking has been created. Pay the deposit to confirm your time slot.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 p-3 rounded-lg bg-muted" data-testid="text-deposit-amount">
                <p className="text-sm font-medium">
                  Deposit Amount: <span className="text-primary">${(depositPaymentInfo.amount / 100).toFixed(2)}</span>
                </p>
              </div>
              <Elements stripe={stripePromise} options={{ clientSecret: depositPaymentInfo.clientSecret }}>
                <DepositPaymentForm
                  onSuccess={() => {
                    setDepositPaymentComplete(true);
                    setShowConfetti(true);
                    toast({ title: "Deposit paid successfully!" });
                  }}
                  onError={(msg) => {
                    toast({ title: "Payment failed", description: msg, variant: "destructive" });
                  }}
                />
              </Elements>
              <div className="mt-4 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                <div className="flex items-start gap-2">
                  <Shield className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-green-600 dark:text-green-400">
                    Your payment is secure. The deposit is held safely and only released after job completion.
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                className="w-full mt-3"
                onClick={() => {
                  setDepositPaymentInfo(null);
                  setShowConfetti(true);
                  toast({ title: "Booking created without deposit payment" });
                }}
                data-testid="button-skip-deposit"
              >
                Skip deposit for now
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Confetti active={showConfetti} duration={5000} />
        <div className="max-w-md w-full space-y-4">
          <Card>
            <CardContent className="py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mx-auto mb-4 animate-bounce">
                <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-xl font-semibold mb-2" data-testid="text-booking-success">
                {depositPaymentComplete ? "Booking Confirmed & Deposit Paid!" : "Request Submitted!"}
              </h2>
              <p className="text-muted-foreground mb-4">
                {profile.name.split(" ")[0]} will get back to you shortly to confirm your booking.
              </p>
              <Button variant="outline" onClick={() => { setSubmitted(false); setShowConfetti(false); setSelectedDate(null); setSelectedTime(null); setDepositPaymentInfo(null); setDepositPaymentComplete(false); }} data-testid="button-submit-another">
                Submit Another Request
              </Button>
            </CardContent>
          </Card>
          <div className="text-center pt-4">
            <a 
              href="https://gigaid.ai" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-block"
              data-testid="link-gigaid-confirmation"
            >
              <img src="/gigaid-logo.png" alt="GigAid" className="h-32 mx-auto" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }} />
            </a>
            <p className="text-xs text-muted-foreground mt-1">Powered by GigAid</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="page-public-booking">
      <div className="max-w-4xl mx-auto p-4 py-8 space-y-6">
        <Card data-testid="card-provider-profile">
          <CardContent className="py-6">
            <div className="flex items-start gap-4">
              <Avatar className="h-16 w-16">
                {profile.photo ? (
                  <AvatarImage src={profile.photo} alt={profile.name} />
                ) : null}
                <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                  {getInitials(profile.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h1 className="text-xl font-bold">{profile.name}</h1>
                {profile.businessName && (
                  <p className="text-muted-foreground">{profile.businessName}</p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex">{renderStars(Math.round(profile.rating))}</div>
                  <span className="text-sm text-muted-foreground">
                    {profile.rating.toFixed(1)} ({profile.reviewCount} reviews)
                  </span>
                </div>
              </div>
            </div>

            {profile.bio && (
              <p className="text-sm text-muted-foreground mt-4">{profile.bio}</p>
            )}

            {profile.services.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {profile.services.map((service) => (
                  <Badge key={service} variant="secondary">
                    {service}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          <Card data-testid="card-calendar">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Select a Date
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                  data-testid="button-prev-month"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <span className="font-medium">{monthYear}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                  data-testid="button-next-month"
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center text-sm mb-2">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div key={d} className="font-medium text-muted-foreground py-2">{d}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {getDaysInMonth(currentMonth).map((date, i) => (
                  <div key={i} className="aspect-square">
                    {date ? (
                      <button
                        type="button"
                        disabled={isPast(date)}
                        onClick={() => { setSelectedDate(date); setSelectedTime(null); }}
                        className={`w-full h-full rounded-lg flex items-center justify-center text-sm transition-colors
                          ${isPast(date) ? "text-muted-foreground/30 cursor-not-allowed" : "hover-elevate cursor-pointer"}
                          ${isSelected(date) ? "bg-primary text-primary-foreground" : ""}
                          ${isToday(date) && !isSelected(date) ? "border-2 border-primary" : ""}
                        `}
                        data-testid={`date-${date.getDate()}`}
                      >
                        {date.getDate()}
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>

              {selectedDate && !zipConfirmed && (
                <div className="mt-6 space-y-4">
                  <div className="p-4 rounded-lg bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20">
                    <div className="flex items-center gap-2 mb-3">
                      <MapPin className="h-5 w-5 text-blue-500" />
                      <span className="font-medium">Where is the job located?</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      Enter your ZIP code so we can suggest the best times based on nearby appointments.
                    </p>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={5}
                        placeholder="Enter ZIP code"
                        value={clientZipCode}
                        onChange={(e) => {
                          setClientZipCode(e.target.value.replace(/\D/g, "").slice(0, 5));
                          setZipError(null);
                        }}
                        className={`flex-1 ${zipError ? "border-red-500" : ""}`}
                        data-testid="input-client-zip"
                      />
                      <Button
                        type="button"
                        disabled={clientZipCode.length !== 5 || zipValidating}
                        onClick={validateAndConfirmZip}
                        data-testid="button-confirm-zip"
                      >
                        {zipValidating ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <Zap className="h-4 w-4 mr-1" />
                        )}
                        {zipValidating ? "Checking..." : "Find Best Times"}
                      </Button>
                    </div>
                    {zipError && (
                      <p className="text-sm text-red-500 mt-2" data-testid="text-zip-error">{zipError}</p>
                    )}
                  </div>
                </div>
              )}

              {selectedDate && zipConfirmed && (
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span className="font-medium">
                        Available times for {selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
                      </span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      <MapPin className="h-3 w-3 mr-1" />
                      {clientLocationName ? `${clientLocationName} ${clientZipCode}` : clientZipCode}
                      <button
                        type="button"
                        className="ml-1 hover:text-primary"
                        onClick={() => { setZipConfirmed(false); setSelectedTime(null); setClientLocationName(""); }}
                        data-testid="button-change-zip"
                      >
                        (change)
                      </button>
                    </Badge>
                  </div>
                  
                  {smartSlotsLoading || slotsLoading ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : !(smartSlotsData?.available || slotsData?.available) ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Not available on this day
                    </p>
                  ) : (smartSlotsData?.optimizedSlots?.length || 0) === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No available slots on this day
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {(smartSlotsData?.optimizedSlots?.filter(s => s.recommendation === "best")?.length || 0) > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Zap className="h-4 w-4 text-green-500" />
                            <span className="text-sm font-medium text-green-600 dark:text-green-400">Best Times - Minimized Travel</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {smartSlotsData?.optimizedSlots?.filter(s => s.recommendation === "best").map((slot) => (
                              <Button
                                key={slot.time}
                                variant={selectedTime === slot.time ? "default" : "outline"}
                                size="sm"
                                onClick={() => setSelectedTime(slot.time)}
                                className="flex-col h-auto py-2 relative"
                                data-testid={`slot-${slot.time}`}
                              >
                                <span>{formatTime(slot.time)}</span>
                                {slot.nearbyJob && (
                                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                    <Navigation className="h-3 w-3" />
                                    {slot.nearbyJob.distance} mi away
                                  </span>
                                )}
                              </Button>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {(smartSlotsData?.optimizedSlots?.filter(s => s.recommendation === "good")?.length || 0) > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Clock className="h-4 w-4 text-yellow-500" />
                            <span className="text-sm font-medium text-yellow-600 dark:text-yellow-400">Good Times - Nearby Jobs</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {smartSlotsData?.optimizedSlots?.filter(s => s.recommendation === "good").map((slot) => (
                              <Button
                                key={slot.time}
                                variant={selectedTime === slot.time ? "default" : "outline"}
                                size="sm"
                                onClick={() => setSelectedTime(slot.time)}
                                className="flex-col h-auto py-2"
                                data-testid={`slot-${slot.time}`}
                              >
                                <span>{formatTime(slot.time)}</span>
                                {slot.nearbyJob && (
                                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                    <Navigation className="h-3 w-3" />
                                    {slot.nearbyJob.distance} mi away
                                  </span>
                                )}
                              </Button>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {(smartSlotsData?.optimizedSlots?.filter(s => s.recommendation === "available")?.length || 0) > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium text-muted-foreground">Other Available Times</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            {smartSlotsData?.optimizedSlots?.filter(s => s.recommendation === "available").map((slot) => (
                              <Button
                                key={slot.time}
                                variant={selectedTime === slot.time ? "default" : "outline"}
                                size="sm"
                                onClick={() => setSelectedTime(slot.time)}
                                data-testid={`slot-${slot.time}`}
                              >
                                {formatTime(slot.time)}
                              </Button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-booking-form">
            <CardHeader>
              <CardTitle>Your Details</CardTitle>
              <CardDescription>
                Fill out the form and {profile.name.split(" ")[0]} will confirm your booking.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="clientFirstName">First Name *</Label>
                    <Input
                      id="clientFirstName"
                      value={formData.clientFirstName}
                      onChange={(e) => setFormData({ ...formData, clientFirstName: e.target.value })}
                      placeholder="John"
                      data-testid="input-first-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clientLastName">Last Name *</Label>
                    <Input
                      id="clientLastName"
                      value={formData.clientLastName}
                      onChange={(e) => setFormData({ ...formData, clientLastName: e.target.value })}
                      placeholder="Smith"
                      data-testid="input-last-name"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="clientPhone">Phone *</Label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <PhoneInput
                        id="clientPhone"
                        value={formData.clientPhone}
                        onChange={(value) => setFormData({ ...formData, clientPhone: value })}
                        data-testid="input-client-phone"
                      />
                    </div>
                    {formData.clientPhone.replace(/\D/g, "").length >= 10 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={handleCheckHistory}
                        data-testid="button-check-history"
                        title="Check booking history"
                      >
                        <History className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {showHistoryPanel && bookingHistory.length > 0 && (
                  <Card className="border-primary/20">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <History className="h-4 w-4" />
                          Your Previous Bookings
                        </CardTitle>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowHistoryPanel(false)}
                        >
                          Close
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {bookingHistory.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2 rounded-lg bg-muted/50 hover-elevate cursor-pointer"
                          onClick={() => applyHistoryBooking(item)}
                          data-testid={`history-item-${idx}`}
                        >
                          <div>
                            <p className="text-sm font-medium">
                              {item.serviceType.charAt(0).toUpperCase() + item.serviceType.slice(1)}
                            </p>
                            <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                              {item.description || "No description"}
                            </p>
                          </div>
                          <Button type="button" variant="ghost" size="sm">
                            <RotateCcw className="h-4 w-4 mr-1" />
                            Rebook
                          </Button>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                <div className="space-y-2">
                  <Label htmlFor="clientEmail">Email</Label>
                  <Input
                    id="clientEmail"
                    type="email"
                    value={formData.clientEmail}
                    onChange={(e) => setFormData({ ...formData, clientEmail: e.target.value })}
                    placeholder="john@example.com"
                    data-testid="input-client-email"
                  />
                </div>

                <SmartServiceRecommender
                  slug={slug || ""}
                  onSelectService={(serviceId) => setFormData({ ...formData, serviceType: serviceId })}
                />

                <div className="space-y-2">
                  <Label htmlFor="serviceType">Service Needed *</Label>
                  <Select
                    value={formData.serviceType}
                    onValueChange={(v) => setFormData({ ...formData, serviceType: v })}
                  >
                    <SelectTrigger data-testid="select-service-type">
                      <SelectValue placeholder="Select a service" />
                    </SelectTrigger>
                    <SelectContent>
                      {profile.services.length > 0 ? (
                        profile.services.map((service) => (
                          <SelectItem key={service} value={service}>
                            {service.charAt(0).toUpperCase() + service.slice(1)}
                          </SelectItem>
                        ))
                      ) : (
                        <>
                          <SelectItem value="plumbing">Plumbing</SelectItem>
                          <SelectItem value="electrical">Electrical</SelectItem>
                          <SelectItem value="cleaning">Cleaning</SelectItem>
                          <SelectItem value="handyman">Handyman</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Location / Address</Label>
                  <AddressAutocomplete
                    value={formData.location}
                    onChange={(fullAddress, components) => {
                      setFormData({ ...formData, location: fullAddress });
                      if (components.zipCode && components.zipCode.length === 5) {
                        setClientZipCode(components.zipCode);
                      }
                    }}
                    placeholder="Start typing your address..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Describe the Job</Label>
                  <JobNotesAutocomplete
                    value={formData.description}
                    onChange={(v) => setFormData({ ...formData, description: v })}
                    serviceName={formData.serviceType}
                    placeholder="Please describe what you need help with..."
                  />
                </div>

                <PhotoUpload
                  photos={bookingPhotos}
                  onPhotosChange={setBookingPhotos}
                  maxPhotos={5}
                  label="Add photos (optional)"
                  helpText="Helps the pro prepare and quote accurately"
                />

                {selectedDate && selectedTime && (
                  <div className="p-3 rounded-lg bg-muted">
                    <p className="text-sm font-medium">Selected Appointment</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })} at {formatTime(selectedTime)}
                    </p>
                  </div>
                )}

                {/* Accepted Payment Methods */}
                {profile.acceptedPaymentMethods && profile.acceptedPaymentMethods.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2" data-testid="section-payment-methods">
                    <span className="text-xs text-muted-foreground">Accepted:</span>
                    {profile.acceptedPaymentMethods.map((method, idx) => (
                      <Badge key={idx} variant="secondary" data-testid={`badge-payment-method-${idx}`}>
                        {method.type === "stripe" ? "Credit Card" : (method.label || method.type)}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Service Area Warning */}
                {serviceAreaWarning && (
                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800" data-testid="text-service-area-warning">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                      <p className="text-sm text-amber-700 dark:text-amber-400">{serviceAreaWarning}</p>
                    </div>
                  </div>
                )}

                {/* Deposit Information and Cancellation Policy */}
                {profile.depositEnabled && profile.depositValue && profile.depositValue > 0 && (
                  <div className="space-y-3" data-testid="section-deposit-info">
                    {/* Deposit Amount */}
                    <div className="p-4 rounded-lg bg-muted/50 border">
                      <div className="flex items-center gap-2 mb-2">
                        <CreditCard className="h-4 w-4 text-primary" />
                        <span className="font-medium text-sm">Deposit Required</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {profile.depositType === "percent" 
                          ? `${profile.depositValue}% of the service cost`
                          : `$${(profile.depositValue / 100).toFixed(2)}`
                        } will be collected to confirm your booking.
                      </p>
                    </div>

                    {/* Conditional: Stripe protected vs separate collection */}
                    {profile.stripeConnected ? (
                      <>
                        {/* Deposit Safety - Stripe protected */}
                        <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                          <div className="flex items-start gap-3">
                            <Shield className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                            <div>
                              <p className="font-medium text-sm text-green-700 dark:text-green-400">Your deposit is protected</p>
                              <p className="text-xs text-green-600/80 dark:text-green-500/80 mt-1">
                                Deposits are held securely and only released to the provider after job completion.
                              </p>
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="p-4 rounded-lg bg-muted/30 border" data-testid="section-deposit-separate">
                        <div className="flex items-start gap-3">
                          <CreditCard className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                          <div>
                            <p className="font-medium text-sm">Your provider will collect the deposit separately</p>
                            {profile.acceptedPaymentMethods && profile.acceptedPaymentMethods.filter(m => m.type !== "stripe").length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {profile.acceptedPaymentMethods.filter(m => m.type !== "stripe").map((method, idx) => (
                                  <Badge key={idx} variant="outline" data-testid={`badge-deposit-method-${idx}`}>
                                    {method.label || method.type}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Reschedule Policy */}
                    <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                      <div className="flex items-start gap-3">
                        <RefreshCw className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                        <div>
                          <p className="font-medium text-sm text-blue-700 dark:text-blue-400">Reschedule Policy</p>
                          <p className="text-xs text-blue-600/80 dark:text-blue-500/80 mt-1">
                            Late reschedules (within {profile.lateRescheduleWindowHours || 24}h of appointment) 
                            may incur a {profile.lateRescheduleRetainPctFirst || 40}% fee. The rest applies to your new booking.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Booking Confirmation Notice */}
                    <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                      <div className="flex items-start gap-3">
                        <Calendar className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                        <div>
                          <p className="font-medium text-sm text-amber-700 dark:text-amber-400">This time is reserved once payment is confirmed</p>
                          <p className="text-xs text-amber-600/80 dark:text-amber-500/80 mt-1">
                            Your appointment slot will be locked in and held for you as soon as the deposit is paid.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Policy Acknowledgment Checkbox */}
                    <label className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border cursor-pointer hover-elevate" data-testid="label-policy-acknowledgment">
                      <input
                        type="checkbox"
                        checked={policyAcknowledged}
                        onChange={(e) => setPolicyAcknowledged(e.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-gray-300"
                        data-testid="checkbox-policy-acknowledgment"
                      />
                      <span className="text-sm text-muted-foreground">
                        I understand and agree to the cancellation and reschedule policy. Cancellations or no-shows may result in forfeiture of the deposit.
                      </span>
                    </label>
                  </div>
                )}

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={
                    submitMutation.isPending || 
                    !selectedDate || 
                    !selectedTime ||
                    (profile.depositEnabled && (profile.depositValue ?? 0) > 0 && !policyAcknowledged)
                  }
                  data-testid="button-submit-booking"
                >
                  {submitMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Calendar className="h-4 w-4 mr-2" />
                  )}
                  {profile.depositEnabled && profile.depositValue && profile.depositValue > 0 
                    ? "Confirm Booking" 
                    : "Request Booking"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {formData.serviceType && (
          <CategoryEstimator
            slug={slug || ""}
            serviceType={formData.serviceType}
            providerPublicEstimationEnabled={profile.publicEstimationEnabled !== false}
          />
        )}

        {!formData.serviceType && (
          <PriceEstimator slug={slug || ""} />
        )}

        {profile.reviews.length > 0 && (
          <Card data-testid="card-reviews">
            <CardHeader>
              <CardTitle>Recent Reviews</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {profile.reviews.map((review) => (
                <div key={review.id} className="border-b last:border-0 pb-4 last:pb-0">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{review.clientName}</span>
                    <div className="flex">{renderStars(review.rating)}</div>
                  </div>
                  <p className="text-sm text-muted-foreground">{review.comment}</p>
                  {review.photos && review.photos.length > 0 && (
                    <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
                      {review.photos.map((photoUrl, idx) => (
                        <a
                          key={idx}
                          href={photoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0"
                          data-testid={`review-photo-${review.id}-${idx}`}
                        >
                          <img
                            src={photoUrl}
                            alt={`Review photo ${idx + 1}`}
                            className="w-20 h-20 object-cover rounded-lg border"
                          />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <div className="text-center text-sm text-muted-foreground flex flex-col items-center justify-center gap-2 py-4">
          <a 
            href="http://gigaid.ai" 
            target="_blank" 
            rel="noopener noreferrer"
            data-testid="link-gigaid"
          >
            <img src="/gigaid-logo.png" alt="GigAid" className="h-12 inline-block" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }} />
          </a>
          <span>Powered by <a href="http://gigaid.ai" target="_blank" rel="noopener noreferrer" className="hover:underline font-medium">GigAid</a></span>
          {profile?.referralCode && (
            <a
              href={`/free-setup?ref=${profile.referralCode}`}
              className="text-xs text-primary hover:underline mt-1"
              data-testid="link-powered-by-cta"
              onClick={() => {
                trackEvent("referral_cta_clicked", {
                  referral_code: profile.referralCode,
                  source_slug: slug,
                });
                fetch("/api/referral/click", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ code: profile.referralCode }),
                }).catch(() => {});
              }}
            >
              Get your own free booking page
            </a>
          )}
        </div>
      </div>

      <FAQAssistant slug={slug || ""} providerName={profile?.name} />
    </div>
  );
}
