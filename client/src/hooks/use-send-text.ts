import { useToast } from "@/hooks/use-toast";

interface SendTextOptions {
  phoneNumber: string;
  message: string;
}

export function useSendText() {
  const { toast } = useToast();

  const sendText = async ({ phoneNumber, message }: SendTextOptions) => {
    const cleanPhone = phoneNumber.replace(/\D/g, "");
    
    if (!cleanPhone) {
      toast({
        title: "No phone number",
        description: "Client phone number is required to send a text",
        variant: "destructive",
      });
      return false;
    }

    try {
      await navigator.clipboard.writeText(message);
      toast({
        title: "Message copied!",
        description: "Opening your messaging app...",
      });
    } catch {
      toast({
        title: "Message ready",
        description: "Opening your messaging app...",
      });
    }

    const encodedMessage = encodeURIComponent(message);
    const smsUrl = `sms:${cleanPhone}?body=${encodedMessage}`;
    
    window.location.href = smsUrl;
    
    return true;
  };

  return { sendText };
}
