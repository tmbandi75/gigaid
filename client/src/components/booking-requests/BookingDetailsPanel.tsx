import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Calendar,
  Clock,
  MapPin,
  Phone,
  Mail,
  CreditCard,
  User,
  CheckCircle,
  AlertCircle,
  Copy,
  Wallet,
  CalendarClock,
  Inbox,
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
  autoReleaseAt: string | null;
  lateRescheduleCount: number | null;
  retainedAmountCents: number | null;
  rolledAmountCents: number | null;
  waiveRescheduleFee: boolean | null;
  confirmationToken: string | null;
  createdAt: string;
  remainderPaymentStatus: string | null;
  remainderPaymentMethod: string | null;
  remainderPaidAt: string | null;
  remainderNotes: string | null;
}

interface BookingDetailsPanelProps {
  booking: BookingRequest | null;
  formatDate: (dateStr: string) => string;
  formatTime: (timeStr: string) => string;
  formatCurrency: (cents: number | null | undefined, currency?: string) => string;
  onCopyLink: (token: string) => void;
  onRecordPayment: () => void;
  onWaiveFee?: (bookingId: number) => void;
  isWaiving?: boolean;
}

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
  awaiting_confirmation: { color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", label: "Awaiting", icon: CalendarClock },
  completed: { color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", label: "Completed", icon: CheckCircle },
  dispute: { color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", label: "Dispute", icon: AlertCircle },
};

export function BookingDetailsPanel({
  booking,
  formatDate,
  formatTime,
  formatCurrency,
  onCopyLink,
  onRecordPayment,
  onWaiveFee,
  isWaiving,
}: BookingDetailsPanelProps) {
  if (!booking) {
    return (
      <Card className="h-full flex items-center justify-center min-h-[400px]">
        <CardContent className="text-center py-12">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <Inbox className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-lg mb-2">Select a booking</h3>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Click on a booking from the list to view its details here.
          </p>
        </CardContent>
      </Card>
    );
  }

  const depositCfg = depositStatusConfig[booking.depositStatus || "none"] || depositStatusConfig.none;
  const completionCfg = completionStatusConfig[booking.completionStatus || "scheduled"] || completionStatusConfig.scheduled;
  const CompIcon = completionCfg.icon;
  const hasDeposit = booking.depositAmountCents && booking.depositAmountCents > 0;
  const hasRemainder = booking.totalAmountCents && booking.totalAmountCents > (booking.depositAmountCents || 0);

  return (
    <Card className="overflow-y-auto max-h-[calc(100vh-320px)]" data-testid="section-booking-details">
      <CardContent className="p-6 space-y-5">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
            <User className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold truncate">{booking.clientName}</h2>
            <p className="text-sm text-muted-foreground capitalize">{booking.serviceType}</p>
            <div className="mt-2">
              <Badge variant="secondary" className={`${completionCfg.color}`}>
                <CompIcon className="h-3 w-3 mr-1" />
                {completionCfg.label}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2 flex-1">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">{formatDate(booking.preferredDate)}</span>
          </div>
          <div className="flex items-center gap-2 flex-1">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">{formatTime(booking.preferredTime)}</span>
          </div>
        </div>

        {booking.location && (
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
            <span>{booking.location}</span>
          </div>
        )}

        {booking.description && (
          <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
            {booking.description}
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <a href={`tel:${booking.clientPhone}`} className="text-primary hover:underline" data-testid="link-client-phone">
              {booking.clientPhone}
            </a>
          </div>
          {booking.clientEmail && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <a href={`mailto:${booking.clientEmail}`} className="text-primary hover:underline" data-testid="link-client-email">
                {booking.clientEmail}
              </a>
            </div>
          )}
        </div>

        <Separator />

        {hasDeposit && (
          <div className="space-y-3">
            <h4 className="font-medium flex items-center gap-2 text-sm">
              <CreditCard className="h-4 w-4" />
              Deposit Information
            </h4>
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Amount</span>
                <span className="font-medium text-sm" data-testid="detail-deposit-amount">
                  {formatCurrency(booking.depositAmountCents!, booking.depositCurrency || "usd")}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge className={depositCfg.color}>{depositCfg.label}</Badge>
              </div>
              {booking.retainedAmountCents && booking.retainedAmountCents > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Retained</span>
                  <span className="text-sm text-orange-600">
                    {formatCurrency(booking.retainedAmountCents, booking.depositCurrency || "usd")}
                  </span>
                </div>
              )}
            </div>

            {booking.depositStatus === "captured" && onWaiveFee && (
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div className="space-y-0.5">
                  <Label htmlFor="waive-fee-desktop" className="text-sm font-medium">
                    Waive reschedule fee
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    If enabled, customer won't be charged for late reschedules
                  </p>
                </div>
                <Switch
                  id="waive-fee-desktop"
                  checked={booking.waiveRescheduleFee || false}
                  onCheckedChange={() => {
                    if (!booking.waiveRescheduleFee) {
                      onWaiveFee(booking.id);
                    }
                  }}
                  disabled={booking.waiveRescheduleFee || isWaiving}
                  aria-label="Toggle Waive reschedule fee"
                  data-testid="switch-waive-fee-desktop"
                />
              </div>
            )}
          </div>
        )}

        {hasRemainder && (
          <div className="space-y-3">
            <h4 className="font-medium flex items-center gap-2 text-sm">
              <Wallet className="h-4 w-4" />
              Remaining Balance
            </h4>
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="font-medium text-sm">
                  {formatCurrency(booking.totalAmountCents!, booking.depositCurrency || "usd")}
                </span>
              </div>
              {hasDeposit && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Deposit</span>
                  <span className="text-sm text-green-600">
                    -{formatCurrency(booking.depositAmountCents!, booking.depositCurrency || "usd")}
                  </span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Due</span>
                <span className="font-semibold">
                  {formatCurrency(
                    booking.totalAmountCents! - (booking.depositAmountCents || 0),
                    booking.depositCurrency || "usd"
                  )}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Status</span>
                {booking.remainderPaymentStatus === "paid" ? (
                  <Badge variant="default" className="bg-green-600">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Paid
                  </Badge>
                ) : (
                  <Badge variant="outline">Pending</Badge>
                )}
              </div>
              {booking.remainderPaymentStatus === "paid" && booking.remainderPaymentMethod && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Paid via</span>
                  <span className="text-sm capitalize">
                    {booking.remainderPaymentMethod === "cashapp" ? "Cash App" : booking.remainderPaymentMethod}
                  </span>
                </div>
              )}
            </div>
            {booking.remainderPaymentStatus !== "paid" && (
              <Button
                className="w-full"
                onClick={onRecordPayment}
                data-testid="button-record-remainder-desktop"
              >
                <Wallet className="h-4 w-4 mr-2" />
                Record Remainder Payment
              </Button>
            )}
          </div>
        )}

        {booking.confirmationToken && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => onCopyLink(booking.confirmationToken!)}
            data-testid="button-copy-booking-link-desktop"
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy Booking Link
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
