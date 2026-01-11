import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
import { apiRequest, queryClient } from "@/lib/queryClient";
import { TopBar } from "@/components/layout/TopBar";
import {
  Calendar,
  Clock,
  MapPin,
  Phone,
  Mail,
  CreditCard,
  Shield,
  RefreshCw,
  Loader2,
  ChevronRight,
  User,
  CheckCircle,
  AlertCircle,
  XCircle,
  Copy,
  Wallet,
  DollarSign,
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
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "accepted", label: "Accepted" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
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
  scheduled: { color: "bg-muted text-muted-foreground", label: "Scheduled", icon: Calendar },
  awaiting_confirmation: { color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", label: "Awaiting Confirmation", icon: Clock },
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

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <TopBar title="Booking Requests" />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      <TopBar title="Booking Requests" />
      
      <div className="p-4 space-y-4">
        {/* Filter */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {statusFilters.map((filter) => (
            <Button
              key={filter.value}
              variant={statusFilter === filter.value ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(filter.value)}
              data-testid={`filter-${filter.value}`}
            >
              {filter.label}
            </Button>
          ))}
        </div>

        {/* Booking List */}
        {filteredBookings.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No booking requests found</p>
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
                  className="cursor-pointer hover-elevate"
                  onClick={() => setSelectedBooking(booking)}
                  data-testid={`booking-card-${booking.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold truncate">{booking.clientName}</h3>
                          <Badge variant="secondary" className={completionConfig.color}>
                            <CompletionIcon className="h-3 w-3 mr-1" />
                            {completionConfig.label}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground capitalize mb-2">
                          {booking.serviceType}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(booking.preferredDate)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatTime(booking.preferredTime)}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {booking.depositAmountCents && booking.depositAmountCents > 0 && (
                          <div className="mb-2">
                            <p className="text-sm font-medium" data-testid={`deposit-amount-${booking.id}`}>
                              {formatCurrency(booking.depositAmountCents, booking.depositCurrency || "usd")}
                            </p>
                            <Badge variant="secondary" className={`text-xs ${depositConfig.color}`}>
                              {depositConfig.label}
                            </Badge>
                          </div>
                        )}
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Booking Detail Dialog */}
      <Dialog open={!!selectedBooking} onOpenChange={() => setSelectedBooking(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {selectedBooking && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  {selectedBooking.clientName}
                </DialogTitle>
                <DialogDescription className="capitalize">
                  {selectedBooking.serviceType}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Schedule */}
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    {formatDate(selectedBooking.preferredDate)}
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    {formatTime(selectedBooking.preferredTime)}
                  </div>
                </div>

                {/* Location */}
                {selectedBooking.location && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    {selectedBooking.location}
                  </div>
                )}

                {/* Description */}
                {selectedBooking.description && (
                  <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                    {selectedBooking.description}
                  </div>
                )}

                {/* Contact */}
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

                {/* Deposit Information */}
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

                    {/* Waive Reschedule Fee Toggle */}
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

                {/* Remainder Payment Section */}
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
                        <DollarSign className="h-4 w-4 mr-2" />
                        Record Remainder Payment
                      </Button>
                    )}
                  </div>
                )}

                <Separator />

                {/* Customer Booking Link */}
                {selectedBooking.confirmationToken && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Customer Booking Link</h4>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs bg-muted p-2 rounded truncate">
                        {window.location.origin}/booking/{selectedBooking.confirmationToken}
                      </code>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => copyBookingLink(selectedBooking.confirmationToken!)}
                        data-testid="button-copy-link"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedBooking(null)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Record Remainder Payment Dialog */}
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
                  )}{" "}
                  from {selectedBooking.clientName}.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="payment-method">Payment Method</Label>
              <Select value={selectedPaymentMethod} onValueChange={setSelectedPaymentMethod}>
                <SelectTrigger id="payment-method" data-testid="select-payment-method">
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethodOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment-notes">Notes (optional)</Label>
              <Textarea
                id="payment-notes"
                placeholder="Any additional notes about this payment..."
                value={remainderNotes}
                onChange={(e) => setRemainderNotes(e.target.value)}
                rows={3}
                data-testid="input-payment-notes"
              />
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowRemainderPaymentDialog(false);
                setSelectedPaymentMethod("");
                setRemainderNotes("");
              }}
            >
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
              {recordRemainderPaymentMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              )}
              Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
