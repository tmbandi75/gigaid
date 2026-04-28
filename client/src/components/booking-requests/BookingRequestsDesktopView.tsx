import { useState, useMemo } from "react";
import { BookingOverviewStats } from "./BookingOverviewStats";
import { BookingSearchBar } from "./BookingSearchBar";
import { BookingSuggestionsPanel } from "./BookingSuggestionsPanel";
import { BookingListPanel } from "./BookingListPanel";
import { BookingDetailsPanel } from "./BookingDetailsPanel";

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

interface BookingRequestsDesktopViewProps {
  bookings: BookingRequest[];
  selectedBooking: BookingRequest | null;
  onSelectBooking: (booking: BookingRequest) => void;
  formatDate: (dateStr: string) => string;
  formatTime: (timeStr: string) => string;
  formatCurrency: (cents: number | null | undefined, currency?: string) => string;
  onCopyLink: (token: string) => void;
  onRecordPayment: () => void;
  onWaiveFee?: (bookingId: number) => void;
  isWaiving?: boolean;
}

export function BookingRequestsDesktopView({
  bookings,
  selectedBooking,
  onSelectBooking,
  formatDate,
  formatTime,
  formatCurrency,
  onCopyLink,
  onRecordPayment,
  onWaiveFee,
  isWaiving,
}: BookingRequestsDesktopViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const pendingCount = bookings.filter(b => b.status === "pending").length;
  const acceptedCount = bookings.filter(b => b.status === "accepted").length;
  const completedCount = bookings.filter(b => b.status === "completed").length;
  const cancelledCount = bookings.filter(b => b.status === "cancelled").length;

  const filteredBookings = useMemo(() => {
    let result = bookings;

    if (statusFilter !== "all") {
      result = result.filter(b => b.status === statusFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(b =>
        b.clientName.toLowerCase().includes(q) ||
        b.serviceType.toLowerCase().includes(q) ||
        b.preferredDate.includes(q)
      );
    }

    return result;
  }, [bookings, statusFilter, searchQuery]);

  const handleViewPending = () => {
    setStatusFilter("pending");
    setSearchQuery("");
  };

  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6 space-y-6" data-testid="section-booking-desktop">
      <BookingOverviewStats
        pendingCount={pendingCount}
        acceptedCount={acceptedCount}
        completedCount={completedCount}
        cancelledCount={cancelledCount}
        totalCount={bookings.length}
        activeFilter={statusFilter}
        onFilterChange={setStatusFilter}
      />

      <BookingSuggestionsPanel
        pendingCount={pendingCount}
        onViewPending={handleViewPending}
      />

      <BookingSearchBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        counts={{
          all: bookings.length,
          pending: pendingCount,
          accepted: acceptedCount,
          completed: completedCount,
          cancelled: cancelledCount,
        }}
      />

      <div className="grid grid-cols-5 gap-6">
        <div className="col-span-3">
          <BookingListPanel
            bookings={filteredBookings}
            selectedBookingId={selectedBooking?.id ?? null}
            onSelectBooking={onSelectBooking}
            formatDate={formatDate}
            formatTime={formatTime}
            formatCurrency={formatCurrency}
          />
        </div>
        <div className="col-span-2">
          <BookingDetailsPanel
            booking={selectedBooking}
            formatDate={formatDate}
            formatTime={formatTime}
            formatCurrency={formatCurrency}
            onCopyLink={onCopyLink}
            onRecordPayment={onRecordPayment}
            onWaiveFee={onWaiveFee}
            isWaiving={isWaiving}
          />
        </div>
      </div>
    </div>
  );
}
