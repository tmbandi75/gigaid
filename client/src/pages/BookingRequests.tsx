import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { PageSpinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Calendar,
  Clock,
  MapPin,
  Phone,
  Mail,
  CreditCard,
  Loader2,
  ChevronRight,
  User,
  CheckCircle,
  AlertCircle,
  Copy,
  Wallet,
  ArrowLeft,
  CalendarCheck,
  CalendarClock,
  XCircle,
  Inbox,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

interface BookingRequest {
  id: number;
  clientName: string;
  clientPhone: string;
  clientEmail: string | null;
  serviceType: string;
  description: string | null;
  location: string | null;
  preferredDate: string;
  preferredTime: string;
  status: string;
  depositAmountCents: number | null;
  depositCurrency: string | null;
  depositStatus: string | null;
  completionStatus: string | null;
  autoReleaseAt: string | null;
  lateRescheduleCount: number | null;
  retainedAmountCents: number | null;
  rolledAmountCents: number | null;
  waiveRescheduleFee: boolean | null;
  confirmationToken: string | null;
  createdAt: string;
  totalAmountCents: number | null;
  remainderPaymentStatus: string | null;
  remainderPaymentMethod: string | null;
  remainderPaidAt: string | null;
  remainderNotes: string | null;
}

const statusFilters = [
  { value: "all", label: "All", icon: Inbox },
  { value: "pending", label: "Pending", icon: CalendarClock },
  { value: "accepted", label: "Accepted", icon: CalendarCheck },
  { value: "completed", label: "Completed", icon: CheckCircle },
  { value: "cancelled", label: "Cancelled", icon: XCircle },
];

const depositStatusConfig: Record<string, { color: string; label: string }> = {
  none: { color: "bg-muted text-muted-foreground", label: "No Deposit" },
  pending: { color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400", label: "Pending" },
  captured: { color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", label: "Held" },
  released: { color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", label: "Released" },
  on_hold_dispute: { color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", label: "Dispute" },
  refunded: { color: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400", label: "Refunded" },
};

const completionStatusConfig: Record<string, { color: string; label: string; icon: typeof CheckCircle }> = {
  scheduled: { color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", label: "Scheduled", icon: Calendar },
  awaiting_confirmation: { color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", label: "Awaiting", icon: Clock },
  completed: { color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", label: "Completed", icon: CheckCircle },
  dispute: { color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", label: "Dispute", icon: AlertCircle },
};

const paymentMethodOptions = [
  { value: "zelle", label: "Zelle" },
  { value: "venmo", label: "Venmo" },
  { value: "cashapp", label: "Cash App" },
  { value: "cash", label: "Cash" },
  { value: "check", label: "Check" },
  { value: "stripe", label: "Card (Stripe)" },
  { value: "other", label: "Other" },
];

export default function BookingRequests() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedBooking, setSelectedBooking] = useState<BookingRequest | null>(null);
  const [showRemainderPaymentDialog, setShowRemainderPaymentDialog] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("");
  const [remainderNotes, setRemainderNotes] = useState("");

  const { data: bookings, isLoading } = useQuery<BookingRequest[]>({
    queryKey: ["/api/booking-requests"],
  });

  const recordRemainderPaymentMutation = useMutation({
    mutationFn: async ({ bookingId, paymentMethod, notes }: { bookingId: number; paymentMethod: string; notes: string }) => {
      const response = await apiRequest("POST", `/api/bookings/${bookingId}/record-remainder-payment`, { paymentMethod, notes });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Payment recorded", description: "The remainder payment has been marked as paid." });
      queryClient.invalidateQueries({ queryKey: ["/api/booking-requests"] });
      if (selectedBooking) {
        setSelectedBooking({ 
          ...selectedBooking, 
          remainderPaymentStatus: "paid",
          remainderPaymentMethod: selectedPaymentMethod,
          remainderPaidAt: new Date().toISOString(),
        });
      }
      setShowRemainderPaymentDialog(false);
      setSelectedPaymentMethod("");
      setRemainderNotes("");
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to record payment", 
        description: error.message || "Please try again.",
        variant: "destructive" 
      });
    },
  });

  const waiveFeeMutation = useMutation({
    mutationFn: (bookingId: number) =>
      apiRequest("POST", `/api/bookings/${bookingId}/waive-reschedule-fee`),
    onSuccess: () => {
      toast({ title: "Reschedule fee waived" });
      queryClient.invalidateQueries({ queryKey: ["/api/booking-requests"] });
      if (selectedBooking) {
        setSelectedBooking({ ...selectedBooking, waiveRescheduleFee: true });
      }
    },
    onError: () => {
      toast({ title: "Failed to waive fee", variant: "destructive" });
    },
  });

  const formatCurrency = (cents: number, currency: string = "usd") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(":").map(Number);
    const period = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`;
  };

  const copyBookingLink = (token: string) => {
    const link = `${window.location.origin}/booking/${token}`;
    navigator.clipboard.writeText(link);
    toast({ title: "Booking link copied" });
  };

  const filteredBookings = bookings?.filter((b) => {
    if (statusFilter === "all") return true;
    return b.status === statusFilter;
  }) || [];

  const pendingCount = bookings?.filter(b => b.status === "pending").length || 0;
  const acceptedCount = bookings?.filter(b => b.status === "accepted").length || 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white px-4 pt-6 pb-8">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full blur-3xl" />
            <div className="absolute bottom-0 -left-10 w-32 h-32 bg-emerald-400/10 rounded-full blur-2xl" />
          </div>
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/more")}
              className="mb-4 -ml-2 text-white/80 hover:text-white hover:bg-white/10"
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <h1 className="text-2xl font-bold">Booking Requests</h1>
            <p className="text-emerald-100/80 mt-1">Manage customer bookings</p>
          </div>
        </div>
        <PageSpinner message="Loading bookings..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20" data-testid="page-booking-requests">
      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white px-4 pt-6 pb-8">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 -left-10 w-32 h-32 bg-emerald-400/10 rounded-full blur-2xl" />
        </div>
        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/more")}
            className="mb-4 -ml-2 text-white/80 hover:text-white hover:bg-white/10"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <h1 className="text-2xl font-bold">Booking Requests</h1>
          <p className="text-emerald-100/80 mt-1">Manage customer bookings</p>
          
          <div className="flex gap-6 mt-6">
            <div className="text-center">
              <p className="text-3xl font-bold">{pendingCount}</p>
              <p className="text-xs text-emerald-100/70 uppercase tracking-wide">Pending</p>
            </div>
            <div className="w-px bg-white/20" />
            <div className="text-center">
              <p className="text-3xl font-bold">{acceptedCount}</p>
              <p className="text-xs text-emerald-100/70 uppercase tracking-wide">Accepted</p>
            </div>
            <div className="w-px bg-white/20" />
            <div className="text-center">
              <p className="text-3xl font-bold">{bookings?.length || 0}</p>
              <p className="text-xs text-emerald-100/70 uppercase tracking-wide">Total</p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="content-container -mt-4 relative z-10">
        <Card className="border-0 shadow-lg mb-4">
          <CardContent className="p-2">
            <div className="flex gap-1 overflow-x-auto">
              {statusFilters.map((filter) => {
                const Icon = filter.icon;
                const isActive = statusFilter === filter.value;
                return (
                  <Button
                    key={filter.value}
                    variant={isActive ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setStatusFilter(filter.value)}
                    className={`flex-shrink-0 gap-1.5 ${isActive ? "" : "text-muted-foreground"}`}
                    data-testid={`filter-${filter.value}`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {filter.label}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {filteredBookings.length === 0 ? (
          <Card className="border-0 shadow-md">
            <CardContent className="py-16 text-center">
              <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                <Calendar className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="font-semibold text-lg mb-2">No bookings found</h3>
              <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                {statusFilter === "all" 
                  ? "When customers book your services, they'll appear here"
                  : `No ${statusFilter} bookings at the moment`}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredBookings.map((booking) => {
              const depositConfig = depositStatusConfig[booking.depositStatus || "none"] || depositStatusConfig.none;
              const completionConfig = completionStatusConfig[booking.completionStatus || "scheduled"] || completionStatusConfig.scheduled;
              const CompletionIcon = completionConfig.icon;

              return (
                <Card
                  key={booking.id}
                  className="border-0 shadow-md cursor-pointer hover-elevate overflow-hidden"
                  onClick={() => setSelectedBooking(booking)}
                  data-testid={`booking-card-${booking.id}`}
                >
                  <CardContent className="p-0">
                    <div className="flex">
                      <div className={`w-1 ${booking.status === "pending" ? "bg-amber-500" : booking.status === "accepted" ? "bg-emerald-500" : booking.status === "completed" ? "bg-blue-500" : "bg-gray-300"}`} />
                      <div className="flex-1 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <h3 className="font-semibold truncate">{booking.clientName}</h3>
                              <Badge variant="secondary" className={`text-xs ${completionConfig.color}`}>
                                <CompletionIcon className="h-3 w-3 mr-1" />
                                {completionConfig.label}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground capitalize mb-3">
                              {booking.serviceType}
                            </p>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded-md">
                                <Calendar className="h-3.5 w-3.5" />
                                {formatDate(booking.preferredDate)}
                              </span>
                              <span className="flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded-md">
                                <Clock className="h-3.5 w-3.5" />
                                {formatTime(booking.preferredTime)}
                              </span>
                            </div>
                          </div>
                          <div className="text-right shrink-0 flex flex-col items-end gap-2">
                            {booking.depositAmountCents && booking.depositAmountCents > 0 && (
                              <div>
                                <p className="text-sm font-semibold" data-testid={`deposit-amount-${booking.id}`}>
                                  {formatCurrency(booking.depositAmountCents, booking.depositCurrency || "usd")}
                                </p>
                                <Badge variant="secondary" className={`text-xs ${depositConfig.color}`}>
                                  {depositConfig.label}
                                </Badge>
                              </div>
                            )}
                            <ChevronRight className="h-5 w-5 text-muted-foreground/50" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!selectedBooking} onOpenChange={() => setSelectedBooking(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {selectedBooking && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <User className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <span className="block">{selectedBooking.clientName}</span>
                    <span className="text-sm font-normal text-muted-foreground capitalize">{selectedBooking.serviceType}</span>
                  </div>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 flex-1">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{formatDate(selectedBooking.preferredDate)}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-1">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{formatTime(selectedBooking.preferredTime)}</span>
                  </div>
                </div>

                {selectedBooking.location && (
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <span>{selectedBooking.location}</span>
                  </div>
                )}

                {selectedBooking.description && (
                  <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                    {selectedBooking.description}
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a href={`tel:${selectedBooking.clientPhone}`} className="text-primary hover:underline">
                      {selectedBooking.clientPhone}
                    </a>
                  </div>
                  {selectedBooking.clientEmail && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <a href={`mailto:${selectedBooking.clientEmail}`} className="text-primary hover:underline">
                        {selectedBooking.clientEmail}
                      </a>
                    </div>
                  )}
                </div>

                <Separator />

                {selectedBooking.depositAmountCents && selectedBooking.depositAmountCents > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-medium flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      Deposit Information
                    </h4>
                    
                    <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Amount</span>
                        <span className="font-medium" data-testid="detail-deposit-amount">
                          {formatCurrency(selectedBooking.depositAmountCents, selectedBooking.depositCurrency || "usd")}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Status</span>
                        <Badge className={(depositStatusConfig[selectedBooking.depositStatus || "none"] || depositStatusConfig.none).color}>
                          {(depositStatusConfig[selectedBooking.depositStatus || "none"] || depositStatusConfig.none).label}
                        </Badge>
                      </div>
                      
                      {selectedBooking.retainedAmountCents && selectedBooking.retainedAmountCents > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Retained (reschedule fee)</span>
                          <span className="text-sm text-orange-600" data-testid="detail-retained-amount">
                            {formatCurrency(selectedBooking.retainedAmountCents, selectedBooking.depositCurrency || "usd")}
                          </span>
                        </div>
                      )}
                      
                      {selectedBooking.rolledAmountCents && 
                       selectedBooking.rolledAmountCents !== selectedBooking.depositAmountCents && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Applied to booking</span>
                          <span className="text-sm text-green-600" data-testid="detail-rolled-amount">
                            {formatCurrency(selectedBooking.rolledAmountCents, selectedBooking.depositCurrency || "usd")}
                          </span>
                        </div>
                      )}

                      {selectedBooking.lateRescheduleCount && selectedBooking.lateRescheduleCount > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Late reschedules</span>
                          <span className="text-sm" data-testid="detail-reschedule-count">
                            {selectedBooking.lateRescheduleCount}
                          </span>
                        </div>
                      )}

                      {selectedBooking.autoReleaseAt && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Auto-release</span>
                          <span className="text-sm">
                            {new Date(selectedBooking.autoReleaseAt).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>

                    {selectedBooking.depositStatus === "captured" && (
                      <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                        <div className="space-y-0.5">
                          <Label htmlFor="waive-fee" className="text-sm font-medium">
                            Waive reschedule fee
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            If enabled, customer won't be charged for late reschedules
                          </p>
                        </div>
                        <Switch
                          id="waive-fee"
                          checked={selectedBooking.waiveRescheduleFee || false}
                          onCheckedChange={() => {
                            if (!selectedBooking.waiveRescheduleFee) {
                              waiveFeeMutation.mutate(selectedBooking.id);
                            }
                          }}
                          disabled={selectedBooking.waiveRescheduleFee || waiveFeeMutation.isPending}
                          data-testid="switch-waive-fee"
                        />
                      </div>
                    )}
                  </div>
                )}

                {selectedBooking.totalAmountCents && 
                 selectedBooking.totalAmountCents > (selectedBooking.depositAmountCents || 0) && (
                  <div className="space-y-3">
                    <h4 className="font-medium flex items-center gap-2">
                      <Wallet className="h-4 w-4" />
                      Remaining Balance
                    </h4>
                    
                    <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Total Service</span>
                        <span className="font-medium" data-testid="detail-total-amount">
                          {formatCurrency(selectedBooking.totalAmountCents, selectedBooking.depositCurrency || "usd")}
                        </span>
                      </div>
                      {selectedBooking.depositAmountCents && selectedBooking.depositAmountCents > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Deposit</span>
                          <span className="text-sm text-green-600" data-testid="detail-deposit-subtracted">
                            -{formatCurrency(selectedBooking.depositAmountCents, selectedBooking.depositCurrency || "usd")}
                          </span>
                        </div>
                      )}
                      <Separator />
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Remainder Due</span>
                        <span className="font-semibold" data-testid="detail-remainder-amount">
                          {formatCurrency(
                            selectedBooking.totalAmountCents - (selectedBooking.depositAmountCents || 0), 
                            selectedBooking.depositCurrency || "usd"
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Status</span>
                        {selectedBooking.remainderPaymentStatus === "paid" ? (
                          <Badge variant="default" className="bg-green-600" data-testid="badge-remainder-paid">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Paid
                          </Badge>
                        ) : (
                          <Badge variant="outline" data-testid="badge-remainder-pending">
                            Pending
                          </Badge>
                        )}
                      </div>
                      {selectedBooking.remainderPaymentStatus === "paid" && selectedBooking.remainderPaymentMethod && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Paid via</span>
                          <span className="text-sm capitalize">
                            {selectedBooking.remainderPaymentMethod === "cashapp" ? "Cash App" : selectedBooking.remainderPaymentMethod}
                            {selectedBooking.remainderPaidAt && ` on ${new Date(selectedBooking.remainderPaidAt).toLocaleDateString()}`}
                          </span>
                        </div>
                      )}
                      {selectedBooking.remainderNotes && (
                        <div className="text-xs text-muted-foreground mt-2">
                          Note: {selectedBooking.remainderNotes}
                        </div>
                      )}
                    </div>

                    {selectedBooking.remainderPaymentStatus !== "paid" && (
                      <Button
                        className="w-full"
                        onClick={() => setShowRemainderPaymentDialog(true)}
                        data-testid="button-record-remainder"
                      >
                        <Wallet className="h-4 w-4 mr-2" />
                        Record Remainder Payment
                      </Button>
                    )}
                  </div>
                )}

                {selectedBooking.confirmationToken && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => copyBookingLink(selectedBooking.confirmationToken!)}
                    data-testid="button-copy-booking-link"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Booking Link
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showRemainderPaymentDialog} onOpenChange={setShowRemainderPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Remainder Payment</DialogTitle>
            <DialogDescription>
              {selectedBooking && selectedBooking.totalAmountCents && (
                <>
                  Record the payment of{" "}
                  {formatCurrency(
                    selectedBooking.totalAmountCents - (selectedBooking.depositAmountCents || 0), 
                    selectedBooking.depositCurrency || "usd"
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={selectedPaymentMethod} onValueChange={setSelectedPaymentMethod}>
                <SelectTrigger data-testid="select-payment-method">
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethodOptions.map((method) => (
                    <SelectItem key={method.value} value={method.value}>
                      {method.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={remainderNotes}
                onChange={(e) => setRemainderNotes(e.target.value)}
                placeholder="Any notes about this payment..."
                data-testid="textarea-remainder-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRemainderPaymentDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedBooking && selectedPaymentMethod) {
                  recordRemainderPaymentMutation.mutate({
                    bookingId: selectedBooking.id,
                    paymentMethod: selectedPaymentMethod,
                    notes: remainderNotes,
                  });
                }
              }}
              disabled={!selectedPaymentMethod || recordRemainderPaymentMutation.isPending}
              data-testid="button-confirm-remainder"
            >
              {recordRemainderPaymentMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
