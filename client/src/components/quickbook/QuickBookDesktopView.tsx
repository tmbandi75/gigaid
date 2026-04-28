import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { safePrice } from "@/lib/safePrice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sparkles,
  Calendar,
  DollarSign,
  MapPin,
  User,
  Check,
  Copy,
  Send,
  Edit2,
  PartyPopper,
  Loader2,
  Wrench,
  Zap,
  SprayCan,
} from "lucide-react";
import type { ParsedJobFields, FieldConfidence } from "@shared/schema";
import { AddressAutocomplete } from "@/components/booking/AddressAutocomplete";

type Step = "paste" | "preview" | "sent";

interface QuickBookDesktopViewProps {
  step: Step;
  messageText: string;
  setMessageText: (text: string) => void;
  fields: ParsedJobFields;
  confidence: FieldConfidence;
  isEditing: boolean;
  setIsEditing: (editing: boolean) => void;
  bookingLinkUrl: string;
  paymentType: "deposit" | "full" | "after";
  setPaymentType: (type: "deposit" | "full" | "after") => void;
  depositAmount: number;
  setDepositAmount: (amount: number) => void;
  copied: boolean;
  handleParse: () => void;
  handleFieldChange: (key: keyof ParsedJobFields, value: any) => void;
  handleSaveEdits: () => void;
  handleCopyLink: () => void;
  sendLinkMutation: { mutate: () => void; isPending: boolean };
  parseMutation: { isPending: boolean };
  navigate: (path: string) => void;
  formatPrice: (cents?: number) => string;
  formatDateTime: (dateTimeStr?: string) => string;
}

const exampleChips = [
  { label: "Plumbing request", icon: Wrench, text: "Hi, I need help fixing a leaky faucet in my kitchen. Can you come tomorrow around 2pm? My address is 123 Main St. Looking to spend around $150. Thanks! - Sarah Johnson, 555-0123" },
  { label: "Electrical repair", icon: Zap, text: "Hey, I have some outlets that aren't working in my living room. Could you come check them out this Saturday morning? I'm at 456 Oak Ave. Budget is around $200. - Mike Chen, 555-0456" },
  { label: "Cleaning job", icon: SprayCan, text: "Hi there, I need a deep clean of my 3-bedroom apartment before I move out next Friday. The address is 789 Elm St, Apt 4B. Can you give me a quote? - Lisa Park, 555-0789" },
];

export function QuickBookDesktopView({
  step,
  messageText,
  setMessageText,
  fields,
  confidence,
  isEditing,
  setIsEditing,
  bookingLinkUrl,
  paymentType,
  setPaymentType,
  depositAmount,
  setDepositAmount,
  copied,
  handleParse,
  handleFieldChange,
  handleSaveEdits,
  handleCopyLink,
  sendLinkMutation,
  parseMutation,
  navigate,
  formatPrice,
  formatDateTime,
}: QuickBookDesktopViewProps) {
  if (step === "sent") {
    return (
      <div className="max-w-2xl mx-auto py-12 px-6">
        <div className="text-center space-y-6">
          <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
            <PartyPopper className="h-10 w-10 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold mb-2">Booking link ready!</h2>
            <p className="text-muted-foreground">
              Your client can book and pay in seconds. You'll be notified when it's confirmed.
            </p>
          </div>

          <Card className="text-left rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <CardContent className="pt-4 space-y-3">
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  You'll get a confirmation
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  The appointment is added to your schedule
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  Reminders are sent automatically
                </li>
              </ul>
            </CardContent>
          </Card>

          <div className="bg-muted p-4 rounded-xl">
            <p className="text-xs text-muted-foreground mb-2">Booking Link</p>
            <div className="flex items-center gap-2">
              <Input
                value={bookingLinkUrl}
                readOnly
                className="text-sm"
                data-testid="desktop-input-booking-link"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopyLink}
                aria-label="Copy link"
                data-testid="desktop-button-copy-link"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <Button
            onClick={() => navigate("/")}
            className="w-full"
            size="lg"
            data-testid="desktop-button-done"
          >
            Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-6 lg:px-8" data-testid="desktop-quickbook">
      <div className="grid grid-cols-2 gap-8">
        {/* LEFT PANEL — Client Message */}
        <Card className="rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="p-6 pb-4">
            <div className="flex items-center gap-3 mb-1">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Client Message</CardTitle>
                <CardDescription className="text-sm">
                  Paste what your client sent you and GigAid will turn it into a booking.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 pt-0 space-y-4">
            <Textarea
              placeholder={"Paste a message from SMS, Facebook, email, or WhatsApp.\n\nExample:\nHi I need help fixing a leaky faucet in my kitchen.\nCan you come tomorrow around 2pm?\nMy address is 123 Main St.\nLooking to spend around $150."}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              className="min-h-[220px] text-base resize-none"
              data-testid="desktop-input-message-text"
              aria-label="Client message"
            />

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium">Try an example:</p>
              <div className="flex flex-wrap gap-2">
                {exampleChips.map((chip) => {
                  const Icon = chip.icon;
                  return (
                    <Button
                      key={chip.label}
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs"
                      onClick={() => setMessageText(chip.text)}
                      data-testid={`desktop-chip-${chip.label.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {chip.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            <Button
              onClick={handleParse}
              className="w-full"
              size="lg"
              disabled={parseMutation.isPending || messageText.trim().length < 10}
              data-testid="desktop-button-create-booking"
              aria-label="Generate booking from message"
            >
              {parseMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Booking
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* RIGHT PANEL — Booking Preview */}
        <Card className="rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="p-6 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Booking Preview</CardTitle>
              {step === "preview" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => isEditing ? handleSaveEdits() : setIsEditing(true)}
                  data-testid="desktop-button-toggle-edit"
                  aria-label={isEditing ? "Save edits" : "Edit booking details"}
                >
                  {isEditing ? <Check className="h-4 w-4 mr-1" /> : <Edit2 className="h-4 w-4 mr-1" />}
                  {isEditing ? "Save" : "Edit"}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            {step === "paste" && !parseMutation.isPending && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="h-16 w-16 rounded-full bg-muted/60 flex items-center justify-center mb-4">
                  <Sparkles className="h-7 w-7 text-muted-foreground/50" />
                </div>
                <p className="text-muted-foreground text-sm">
                  Booking details will appear here after generating the booking.
                </p>
              </div>
            )}

            {parseMutation.isPending && (
              <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Analyzing message...</p>
                  <p className="text-xs text-muted-foreground">Extracting job details...</p>
                  <p className="text-xs text-muted-foreground">Preparing booking...</p>
                </div>
              </div>
            )}

            {step === "preview" && (
              <div className="space-y-5">
                {confidence.overall < 0.6 && (
                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30">
                    <p className="text-amber-700 dark:text-amber-400 text-sm">
                      Some details may need your review. Please update anything that looks off.
                    </p>
                  </div>
                )}

                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-muted rounded-lg shrink-0">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs text-muted-foreground">Customer Name</Label>
                      {isEditing ? (
                        <Input
                          value={fields.clientName || ""}
                          onChange={(e) => handleFieldChange("clientName", e.target.value)}
                          placeholder="Client name"
                          data-testid="desktop-input-client-name"
                        />
                      ) : (
                        <p className="font-medium text-sm">{fields.clientName || "Not specified"}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-muted rounded-lg shrink-0">
                      <Sparkles className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs text-muted-foreground">Service Type</Label>
                      {isEditing ? (
                        <Select
                          value={fields.service || ""}
                          onValueChange={(v) => handleFieldChange("service", v)}
                        >
                          <SelectTrigger data-testid="desktop-select-service">
                            <SelectValue placeholder="Select service" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="plumbing">Plumbing</SelectItem>
                            <SelectItem value="electrical">Electrical</SelectItem>
                            <SelectItem value="cleaning">Cleaning</SelectItem>
                            <SelectItem value="handyman">Handyman</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="font-medium text-sm capitalize">{fields.service || "Not specified"}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-muted rounded-lg shrink-0">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs text-muted-foreground">Address</Label>
                      {isEditing ? (
                        <AddressAutocomplete
                          value={fields.locationText || ""}
                          onChange={(fullAddress, components) => {
                            handleFieldChange("locationText", fullAddress);
                            if (components?.lat && components?.lng) {
                              handleFieldChange("locationLat", components.lat);
                              handleFieldChange("locationLng", components.lng);
                            }
                          }}
                          placeholder="Start typing an address..."
                        />
                      ) : (
                        <p className="font-medium text-sm">{fields.locationText || "Not specified"}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-muted rounded-lg shrink-0">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs text-muted-foreground">Date / Time</Label>
                      {isEditing ? (
                        <Input
                          type="datetime-local"
                          value={fields.dateTimeStart?.slice(0, 16) || ""}
                          onChange={(e) => handleFieldChange("dateTimeStart", e.target.value)}
                          data-testid="desktop-input-datetime"
                        />
                      ) : (
                        <p className="font-medium text-sm">{formatDateTime(fields.dateTimeStart) || "Not specified"}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-muted rounded-lg shrink-0">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs text-muted-foreground">Estimated Price</Label>
                      {isEditing ? (
                        <Input
                          type="number"
                          value={fields.priceAmount ? fields.priceAmount / 100 : ""}
                          onChange={(e) => handleFieldChange("priceAmount", Math.round(parseFloat(e.target.value || "0") * 100))}
                          placeholder="Enter price"
                          data-testid="desktop-input-price"
                        />
                      ) : (
                        <p className="font-medium text-sm">{formatPrice(fields.priceAmount) || "Not specified"}</p>
                      )}
                    </div>
                  </div>

                  {(fields.clientPhone || isEditing) && (
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-muted rounded-lg shrink-0">
                        <User className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <Label className="text-xs text-muted-foreground">Phone</Label>
                        {isEditing ? (
                          <Input
                            value={fields.clientPhone || ""}
                            onChange={(e) => handleFieldChange("clientPhone", e.target.value)}
                            placeholder="Phone number"
                            data-testid="desktop-input-client-phone"
                          />
                        ) : (
                          <p className="font-medium text-sm">{fields.clientPhone || "Not specified"}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-t pt-4 space-y-3">
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <Check className="h-4 w-4" />
                    <span className="font-medium text-sm">
                      {safePrice(depositAmount)} deposit now / Remaining after the job
                    </span>
                  </div>

                  <details className="text-sm">
                    <summary className="cursor-pointer text-primary hover:underline">Change payment option</summary>
                    <div className="mt-3 space-y-2">
                      <Select value={paymentType} onValueChange={(v: "deposit" | "full" | "after") => setPaymentType(v)}>
                        <SelectTrigger data-testid="desktop-select-payment-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="deposit">Deposit upfront</SelectItem>
                          <SelectItem value="full">Full payment upfront</SelectItem>
                          <SelectItem value="after">Pay after job</SelectItem>
                        </SelectContent>
                      </Select>
                      {paymentType === "deposit" && (
                        <div className="flex items-center gap-2">
                          <Label>Deposit amount:</Label>
                          <Input
                            type="number"
                            value={depositAmount}
                            onChange={(e) => setDepositAmount(parseInt(e.target.value) || 50)}
                            className="w-24"
                            data-testid="desktop-input-deposit-amount"
                          />
                        </div>
                      )}
                    </div>
                  </details>
                </div>

                <Button
                  onClick={() => sendLinkMutation.mutate()}
                  className="w-full"
                  size="lg"
                  disabled={sendLinkMutation.isPending}
                  data-testid="desktop-button-confirm-booking"
                  aria-label="Confirm booking"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {sendLinkMutation.isPending ? "Sending..." : "Confirm Booking"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
