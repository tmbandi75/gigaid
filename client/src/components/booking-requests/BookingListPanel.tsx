import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  CalendarClock,
  CreditCard,
} from "lucide-react";

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
  totalAmountCents: number | null;
  createdAt: string;
  confirmationToken: string | null;
  autoReleaseAt: string | null;
  lateRescheduleCount: number | null;
  retainedAmountCents: number | null;
  rolledAmountCents: number | null;
  waiveRescheduleFee: boolean | null;
  remainderPaymentStatus: string | null;
  remainderPaymentMethod: string | null;
  remainderPaidAt: string | null;
  remainderNotes: string | null;
}

interface BookingListPanelProps {
  bookings: BookingRequest[];
  selectedBookingId: number | null;
  onSelectBooking: (booking: BookingRequest) => void;
  formatDate: (dateStr: string) => string;
  formatTime: (timeStr: string) => string;
  formatCurrency: (cents: number | null | undefined, currency?: string) => string;
}

const statusColors: Record<string, string> = {
  pending: "bg-amber-500",
  accepted: "bg-emerald-500",
  completed: "bg-blue-500",
  cancelled: "bg-gray-300 dark:bg-gray-600",
  declined: "bg-red-400",
};

const completionStatusConfig: Record<string, { color: string; label: string; icon: typeof CheckCircle }> = {
  scheduled: { color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", label: "Scheduled", icon: Calendar },
  awaiting_confirmation: { color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", label: "Awaiting", icon: CalendarClock },
  completed: { color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", label: "Completed", icon: CheckCircle },
  dispute: { color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", label: "Dispute", icon: AlertCircle },
};

const depositStatusLabels: Record<string, { color: string; label: string }> = {
  none: { color: "bg-muted text-muted-foreground", label: "No Deposit" },
  pending: { color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400", label: "Pending" },
  captured: { color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", label: "Held" },
  released: { color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", label: "Released" },
  on_hold_dispute: { color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", label: "Dispute" },
  refunded: { color: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400", label: "Refunded" },
};

export function BookingListPanel({
  bookings,
  selectedBookingId,
  onSelectBooking,
  formatDate,
  formatTime,
  formatCurrency,
}: BookingListPanelProps) {
  if (bookings.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-4">
            <Calendar className="h-8 w-8 text-emerald-500" />
          </div>
          <h3 className="font-semibold text-lg mb-2">No bookings found</h3>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            When customers book your services, they'll appear here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-320px)]" data-testid="section-booking-list">
      {bookings.map((booking) => {
        const isSelected = selectedBookingId === booking.id;
        const completionCfg = completionStatusConfig[booking.completionStatus || "scheduled"] || completionStatusConfig.scheduled;
        const CompIcon = completionCfg.icon;
        const depositCfg = depositStatusLabels[booking.depositStatus || "none"] || depositStatusLabels.none;
        const isPending = booking.status === "pending";

        return (
          <Card
            key={booking.id}
            className={`cursor-pointer transition-all overflow-hidden rounded-xl ${
              isSelected
                ? "ring-2 ring-primary shadow-md"
                : isPending
                ? "border-yellow-400 dark:border-yellow-700 bg-yellow-50/50 dark:bg-yellow-950/10 hover:shadow-lg hover:border-blue-400"
                : "hover:shadow-lg hover:border-blue-400"
            }`}
            onClick={() => onSelectBooking(booking)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelectBooking(booking); } }}
            aria-label={`Booking from ${booking.clientName} for ${booking.serviceType}`}
            aria-selected={isSelected}
            data-testid={`booking-card-${booking.id}`}
          >
            <CardContent className="p-0">
              <div className="flex">
                <div className={`w-1.5 ${statusColors[booking.status] || "bg-gray-300"}`} />
                <div className="flex-1 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold truncate">{booking.clientName}</h3>
                        <Badge variant="secondary" className={`text-xs ${completionCfg.color}`}>
                          <CompIcon className="h-3 w-3 mr-1" />
                          {completionCfg.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground capitalize mb-2 truncate">
                        {booking.serviceType}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
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
                      {booking.totalAmountCents && booking.totalAmountCents > 0 && (
                        <p className="text-sm font-semibold">
                          {formatCurrency(booking.totalAmountCents, booking.depositCurrency || "usd")}
                        </p>
                      )}
                      {booking.depositAmountCents && booking.depositAmountCents > 0 && (
                        <div className="flex items-center gap-1.5">
                          <CreditCard className="h-3 w-3 text-muted-foreground" />
                          <Badge variant="secondary" className={`text-[10px] ${depositCfg.color}`}>
                            {depositCfg.label}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
