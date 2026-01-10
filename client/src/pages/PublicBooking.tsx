import { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Star, Calendar, CheckCircle, Loader2, ChevronLeft, ChevronRight, Clock, History, RotateCcw, MapPin, Zap, Navigation } from "lucide-react";
import { SmartServiceRecommender } from "@/components/booking/SmartServiceRecommender";
import { JobNotesAutocomplete } from "@/components/booking/JobNotesAutocomplete";
import { FAQAssistant } from "@/components/booking/FAQAssistant";
import { PriceEstimator } from "@/components/booking/PriceEstimator";
import { Confetti } from "@/components/booking/Confetti";
import { PhoneInput } from "@/components/ui/phone-input";

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
  }>;
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

export default function PublicBooking() {
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
  const [clientZipCode, setClientZipCode] = useState("");
  const [zipConfirmed, setZipConfirmed] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [bookingHistory, setBookingHistory] = useState<BookingHistoryItem[]>([]);

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

  const { data: profile, isLoading, error } = useQuery<PublicProfile>({
    queryKey: ["/api/public/profile", slug],
    queryFn: async () => {
      const res = await fetch(`/api/public/profile/${slug}`);
      if (!res.ok) throw new Error("Profile not found");
      return res.json();
    },
    enabled: !!slug,
  });

  const selectedDateStr = selectedDate 
    ? `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`
    : null;

  const { data: slotsData, isLoading: slotsLoading } = useQuery<AvailableSlots>({
    queryKey: ["/api/public/available-slots", slug, selectedDateStr],
    queryFn: async () => {
      const res = await fetch(`/api/public/available-slots/${slug}/${selectedDateStr}`);
      if (!res.ok) throw new Error("Failed to fetch slots");
      return res.json();
    },
    enabled: !!slug && !!selectedDateStr && !zipConfirmed,
  });

  const { data: smartSlotsData, isLoading: smartSlotsLoading } = useQuery<SmartSlotsResponse>({
    queryKey: ["/api/public/smart-slots", slug, selectedDateStr, clientZipCode],
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

  const submitMutation = useMutation({
    mutationFn: (data: { clientName: string; clientPhone: string; clientEmail: string; serviceType: string; location: string; description: string; preferredDate: string; preferredTime: string }) =>
      apiRequest("POST", `/api/public/book/${slug}`, data),
    onSuccess: () => {
      saveToBookingHistory({
        serviceType: formData.serviceType,
        description: formData.description,
        date: selectedDateStr || "",
        time: selectedTime || "",
        bookedAt: new Date().toISOString(),
      });
      setShowConfetti(true);
      setSubmitted(true);
      toast({ title: "Booking request sent!" });
    },
    onError: () => {
      toast({ title: "Failed to submit booking", variant: "destructive" });
    },
  });

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
    submitMutation.mutate({
      clientName: `${formData.clientFirstName} ${formData.clientLastName}`.trim(),
      clientPhone: formData.clientPhone,
      clientEmail: formData.clientEmail,
      serviceType: formData.serviceType,
      location: formData.location,
      description: formData.description,
      preferredDate: selectedDateStr!,
      preferredTime: selectedTime,
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <h2 className="text-xl font-semibold mb-2">Profile Not Found</h2>
            <p className="text-muted-foreground">
              This booking page doesn't exist or has been disabled.
            </p>
          </CardContent>
        </Card>
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
              <h2 className="text-xl font-semibold mb-2">Request Submitted!</h2>
              <p className="text-muted-foreground mb-4">
                {profile.name.split(" ")[0]} will get back to you shortly to confirm your booking.
              </p>
              <Button variant="outline" onClick={() => { setSubmitted(false); setShowConfetti(false); setSelectedDate(null); setSelectedTime(null); }}>
                Submit Another Request
              </Button>
            </CardContent>
          </Card>
          <div className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1">
            Powered by{" "}
            <a 
              href="http://www.gigaid.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:underline"
              data-testid="link-gigaid-confirmation"
            >
              <img src="/gigaid-logo.png" alt="GigAid" className="h-4 inline-block" />
            </a>
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
                        onChange={(e) => setClientZipCode(e.target.value.replace(/\D/g, "").slice(0, 5))}
                        className="flex-1"
                        data-testid="input-client-zip"
                      />
                      <Button
                        type="button"
                        disabled={clientZipCode.length !== 5}
                        onClick={() => setZipConfirmed(true)}
                        data-testid="button-confirm-zip"
                      >
                        <Zap className="h-4 w-4 mr-1" />
                        Find Best Times
                      </Button>
                    </div>
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
                      {clientZipCode}
                      <button
                        type="button"
                        className="ml-1 hover:text-primary"
                        onClick={() => { setZipConfirmed(false); setSelectedTime(null); }}
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
                  <Label htmlFor="location">Location / Address</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="123 Main St, City"
                    data-testid="input-location"
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

                {selectedDate && selectedTime && (
                  <div className="p-3 rounded-lg bg-muted">
                    <p className="text-sm font-medium">Selected Appointment</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })} at {formatTime(selectedTime)}
                    </p>
                  </div>
                )}

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={submitMutation.isPending || !selectedDate || !selectedTime}
                  data-testid="button-submit-booking"
                >
                  {submitMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Calendar className="h-4 w-4 mr-2" />
                  )}
                  Request Booking
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <PriceEstimator slug={slug || ""} />

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
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-muted-foreground">
          Powered by{" "}
          <a 
            href="http://www.gigaid.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="hover:underline"
            data-testid="link-gigaid"
          >
            GigAid<sup className="text-[8px]">TM</sup>
          </a>
        </p>
      </div>

      <FAQAssistant slug={slug || ""} providerName={profile?.name} />
    </div>
  );
}
