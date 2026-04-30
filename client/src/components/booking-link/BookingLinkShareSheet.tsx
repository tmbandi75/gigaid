import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, MessageCircle, MessageSquare, Check } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { trackEvent } from "@/components/PostHogProvider";
import { recordShareTap } from "@/lib/bookingLinkAnalytics";
import {
  recordBookingLinkShared,
  copyBookingLinkToClipboard,
} from "@/lib/bookingLinkShareFlow";
import { copyTextToClipboard } from "@/lib/clipboard";
import type { BookingLinkShareScreen } from "@/lib/useBookingLinkShareAction";

export interface BookingLinkShareSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  screen: BookingLinkShareScreen;
  context: "plan" | "leads" | "jobs" | "bookings";
  /** Optional override for the editable message body. */
  messageOverride?: string;
  /**
   * Fired immediately after a successful share completes via this sheet
   * (SMS / WhatsApp / Copy). Mirrors the `booking_link_shared` analytics
   * event so callers can react to the same trigger (e.g. hide a nudge
   * card) without subscribing to PostHog. Receives the share method.
   */
  onShared?: (method: "sms" | "whatsapp" | "copy") => void;
}

function defaultMessage(bookingLink: string): string {
  return `Hey — I just started taking bookings. If you or someone you know needs help, here's my link: ${bookingLink}`;
}

export function BookingLinkShareSheet({
  open,
  onOpenChange,
  screen,
  context,
  messageOverride,
  onShared,
}: BookingLinkShareSheetProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  const { data } = useQuery<{ bookingLink: string | null; servicesCount: number }>({
    queryKey: QUERY_KEYS.bookingLink(),
  });
  const bookingLink = data?.bookingLink ?? null;

  const [message, setMessage] = useState(() =>
    bookingLink ? messageOverride ?? defaultMessage(bookingLink) : "",
  );
  const [copied, setCopied] = useState(false);
  // Tracks whether we've already fired the open analytics for the current
  // open transition. We only want booking_link_share_opened +
  // recordShareTap to fire ONCE per open — not every time bookingLink or
  // messageOverride change while the sheet is mounted open.
  const openLoggedRef = useRef(false);

  // Reset the message + copied state to the live default when the sheet opens
  // so a re-open after a previous edit starts fresh and reflects the latest
  // bookingLink value.
  useEffect(() => {
    if (!open) {
      openLoggedRef.current = false;
      return;
    }
    if (bookingLink) {
      setMessage(messageOverride ?? defaultMessage(bookingLink));
    }
    setCopied(false);
    if (!openLoggedRef.current) {
      openLoggedRef.current = true;
      trackEvent("booking_link_share_opened", { screen });
      void recordShareTap(context);
    }
  }, [open, bookingLink, messageOverride, screen, context]);

  const invalidateGamePlan = () => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dashboardGamePlan() });
    queryClient.invalidateQueries({ queryKey: ["/api/booking/share-progress"] });
  };

  // Fire-and-forget so we never block the user-perceptible navigation
  // (sms:, wa.me) on a slow analytics POST. PostHog is queued client-side
  // and recordBookingLinkShared marks the local flag synchronously before
  // POSTing, so the NBA still flips even if the API write is slow or
  // fails.
  const fireCompleted = (
    method: "sms" | "whatsapp" | "copy",
    serverMethod: "share" | "copy",
  ) => {
    trackEvent("booking_link_shared", { screen, method });
    void recordBookingLinkShared({
      method: serverMethod,
      target: method,
      userId,
      onLocalMark: invalidateGamePlan,
      onApiSuccess: invalidateGamePlan,
    });
    // Notify the host AFTER the analytics + recording side effects have
    // been kicked off so consumers see the same ordering as the
    // PostHog event. Wrapped so a host-side throw can never break the
    // user-visible deep-link / clipboard flow.
    if (onShared) {
      try {
        onShared(method);
      } catch {
        // swallow — host callback is purely best-effort UI state.
      }
    }
  };

  const handleSms = () => {
    if (!bookingLink) return;
    const body = message.trim() || defaultMessage(bookingLink);
    // Order matters here: fireCompleted is fire-and-forget and runs its
    // synchronous prelude (PostHog enqueue + markBookingLinkShared +
    // queryClient invalidations + apiFetch() request kickoff) BEFORE we
    // hand the tab off to the SMS scheme. That way the completion tracking
    // survives even if the OS interrupts JS execution to launch Messages.
    // We still trigger the deep link on the same synchronous tick so the
    // browser keeps the user-gesture context for sms:.
    fireCompleted("sms", "share");
    if (typeof window !== "undefined") {
      window.location.href = `sms:?body=${encodeURIComponent(body)}`;
    }
    onOpenChange(false);
  };

  const handleWhatsapp = () => {
    if (!bookingLink) return;
    const body = message.trim() || defaultMessage(bookingLink);
    // Same ordering rationale as handleSms — kick off completion tracking
    // first, then open the WhatsApp tab synchronously so popup blockers
    // honor the click gesture.
    fireCompleted("whatsapp", "share");
    if (typeof window !== "undefined") {
      window.open(
        `https://wa.me/?text=${encodeURIComponent(body)}`,
        "_blank",
        "noopener,noreferrer",
      );
    }
    onOpenChange(false);
  };

  const handleCopy = async () => {
    if (!bookingLink) return;
    const body = message.trim() || defaultMessage(bookingLink);
    const ok = await copyTextToClipboard(body);
    if (!ok) {
      toast({
        title: "Couldn't copy",
        description: "Please copy the message manually",
        variant: "destructive",
      });
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    fireCompleted("copy", "copy");
    // Preserve the existing "Link copied" toast title that the rest of
    // the booking-link surfaces use, with a follow-on description that
    // nudges the worker to send it now.
    toast({
      title: "Link copied",
      description: "Send it to someone now",
    });
  };

  const handleCopyLinkOnly = async () => {
    if (!bookingLink) return;
    const { copied: copiedOk } = await copyBookingLinkToClipboard({
      bookingLink,
      userId,
      onLocalMark: invalidateGamePlan,
      onApiSuccess: invalidateGamePlan,
    });
    if (copiedOk) {
      trackEvent("booking_link_copied", { screen });
      toast({
        title: "Link copied",
        description: "Your booking link is ready to share",
      });
    } else {
      toast({
        title: "Couldn't copy",
        description: "Please copy the link manually",
        variant: "destructive",
      });
    }
  };

  const isMobile = useIsMobile();

  const body: ReactNode = (
    <div className="mt-4 space-y-4">
      <div className="space-y-1.5">
        <Label
          htmlFor="share-sheet-link"
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          Your booking link
        </Label>
        <div className="flex items-center gap-2">
          <Input
            id="share-sheet-link"
            readOnly
            value={bookingLink ?? ""}
            onClick={(e) => (e.target as HTMLInputElement).select()}
            className="font-mono text-xs"
            data-testid="input-share-sheet-link"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleCopyLinkOnly}
            className="shrink-0"
            data-testid="button-share-sheet-copy-link-only"
          >
            <Copy className="h-4 w-4" />
            <span className="sr-only">Copy link only</span>
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label
          htmlFor="share-sheet-message"
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          Message
        </Label>
        <Textarea
          id="share-sheet-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          className="resize-none text-sm"
          data-testid="textarea-share-sheet-message"
        />
      </div>

      <div className="grid grid-cols-3 gap-2 pt-1">
        <Button
          type="button"
          size="lg"
          variant="default"
          onClick={handleSms}
          disabled={!bookingLink}
          className="flex flex-col h-auto py-3 gap-1"
          data-testid="button-share-sheet-sms"
        >
          <MessageSquare className="h-5 w-5" />
          <span className="text-xs font-medium">SMS</span>
        </Button>
        <Button
          type="button"
          size="lg"
          variant="default"
          onClick={handleWhatsapp}
          disabled={!bookingLink}
          className="flex flex-col h-auto py-3 gap-1 bg-[#25D366] hover:bg-[#20bd5a] text-white"
          data-testid="button-share-sheet-whatsapp"
        >
          <SiWhatsapp className="h-5 w-5" />
          <span className="text-xs font-medium">WhatsApp</span>
        </Button>
        <Button
          type="button"
          size="lg"
          variant="outline"
          onClick={handleCopy}
          disabled={!bookingLink}
          className="flex flex-col h-auto py-3 gap-1"
          data-testid="button-share-sheet-copy"
        >
          {copied ? <Check className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
          <span className="text-xs font-medium">{copied ? "Copied" : "Copy"}</span>
        </Button>
      </div>
    </div>
  );

  const titleText = "Send your booking link";
  const descriptionText =
    "Pick how you want to share. Most pros get booked after 3–5 sends.";

  // Bottom sheet on mobile (<768px), centered Dialog on tablet+/desktop.
  // Both surfaces render identical content + the same data-testid sentinel
  // so e2e specs and component tests can drive either at the same locator.
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl max-h-[92vh] overflow-y-auto"
          data-testid="sheet-booking-link-share"
        >
          <SheetHeader className="text-left">
            <SheetTitle>{titleText}</SheetTitle>
            <SheetDescription>{descriptionText}</SheetDescription>
          </SheetHeader>
          {body}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md"
        data-testid="sheet-booking-link-share"
      >
        <DialogHeader className="text-left">
          <DialogTitle>{titleText}</DialogTitle>
          <DialogDescription>{descriptionText}</DialogDescription>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}
