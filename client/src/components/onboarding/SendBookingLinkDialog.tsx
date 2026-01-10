import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PhoneInput } from "@/components/ui/phone-input";
import { Loader2, Send, CheckCircle2, Smartphone, Link2 } from "lucide-react";

interface SendBookingLinkDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function SendBookingLinkDialog({ open, onClose, onSuccess }: SendBookingLinkDialogProps) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [step, setStep] = useState<"input" | "success">("input");
  const { toast } = useToast();

  const sendMutation = useMutation({
    mutationFn: async (phone: string) => {
      return apiRequest("POST", "/api/onboarding/send-booking-link", { phoneNumber: phone });
    },
    onSuccess: () => {
      setStep("success");
      onSuccess?.();
    },
    onError: () => {
      toast({
        title: "Couldn't send the link",
        description: "Please check your phone number and try again",
        variant: "destructive",
      });
    },
  });

  const handleSend = () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      toast({
        title: "Enter your phone number",
        description: "We need your number to text you the link",
        variant: "destructive",
      });
      return;
    }
    sendMutation.mutate(phoneNumber);
  };

  const handleClose = () => {
    setStep("input");
    setPhoneNumber("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-send-booking-link">
        {step === "input" && (
          <>
            <DialogHeader>
              <div className="mx-auto p-3 rounded-full bg-primary/10 mb-2">
                <Smartphone className="h-8 w-8 text-primary" />
              </div>
              <DialogTitle className="text-center text-xl">Get Your Booking Link</DialogTitle>
              <DialogDescription className="text-center">
                We'll text you your booking link so you can send it to your next customer right away
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Your Phone Number</label>
                <PhoneInput
                  value={phoneNumber}
                  onChange={setPhoneNumber}
                  placeholder="(555) 123-4567"
                  data-testid="input-phone-number"
                />
              </div>
              <Button
                className="w-full h-12 text-base"
                onClick={handleSend}
                disabled={sendMutation.isPending}
                data-testid="button-send-link"
              >
                {sendMutation.isPending ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-5 w-5 mr-2" />
                    Text Me My Booking Link
                  </>
                )}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Standard message rates apply
              </p>
            </div>
          </>
        )}

        {step === "success" && (
          <>
            <DialogHeader>
              <div className="mx-auto p-4 rounded-full bg-emerald-500/10 mb-2">
                <CheckCircle2 className="h-10 w-10 text-emerald-600" />
              </div>
              <DialogTitle className="text-center text-xl">Link Sent!</DialogTitle>
              <DialogDescription className="text-center">
                Check your phone for your booking link. Share it with your next customer to get booked!
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 p-4 bg-muted/50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Link2 className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Pro tip</p>
                  <p className="text-xs text-muted-foreground">
                    Copy your link and paste it in your text messages, emails, or social media bio
                  </p>
                </div>
              </div>
            </div>
            <Button
              className="w-full mt-4"
              onClick={handleClose}
              data-testid="button-done"
            >
              Got It
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
