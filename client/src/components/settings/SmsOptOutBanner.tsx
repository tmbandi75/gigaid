import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiFetch";
import { useApiMutation } from "@/hooks/useApiMutation";
import { QUERY_KEYS } from "@/lib/queryKeys";

interface SmsOptOutProfile {
  smsOptOut?: boolean;
}

interface SmsOptOutBannerProps {
  className?: string;
}

export function SmsOptOutBanner({ className }: SmsOptOutBannerProps) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: profile } = useQuery<SmsOptOutProfile>({
    queryKey: QUERY_KEYS.profile(),
  });

  const resumeSmsMutation = useApiMutation<{
    success: boolean;
    confirmationSent?: boolean;
    confirmationWarning?: string;
  }>(
    () =>
      apiFetch("/api/profile/sms/resume", {
        method: "POST",
      }),
    [QUERY_KEYS.profile()],
    {
      onSuccess: (data) => {
        setDialogOpen(false);
        if (data?.confirmationWarning) {
          toast({
            title: "SMS resumed",
            description: `You'll start receiving text messages again. ${data.confirmationWarning}`,
          });
        } else if (data?.confirmationSent) {
          toast({
            title: "SMS resumed",
            description:
              "We just sent a confirmation text so you know messages are flowing again.",
          });
        } else {
          toast({
            title: "SMS resumed",
            description: "You'll start receiving text messages again.",
          });
        }
      },
      onError: () => {
        toast({
          title: "Couldn't resume SMS",
          description: "Please try again in a moment.",
          variant: "destructive",
        });
      },
    },
  );

  if (!profile?.smsOptOut) {
    return null;
  }

  return (
    <div
      className={`rounded-md border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40 p-3 space-y-2 ${className ?? ""}`}
      data-testid="banner-sms-opt-out"
    >
      <div className="flex items-start gap-2">
        <AlertCircle
          className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0"
          aria-hidden="true"
        />
        <div className="space-y-1">
          <p
            className="font-medium text-sm text-amber-900 dark:text-amber-100"
            data-testid="text-sms-opt-out-title"
          >
            SMS paused — you replied STOP
          </p>
          <p className="text-xs text-amber-800 dark:text-amber-200">
            We won't send you any text messages until you resume. You can also
            reply START to any of our numbers.
          </p>
        </div>
      </div>
      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            className="border-amber-400 text-amber-900 hover:bg-amber-100 dark:border-amber-600 dark:text-amber-100 dark:hover:bg-amber-900/40"
            data-testid="button-resume-sms"
          >
            Resume SMS
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resume SMS messages?</AlertDialogTitle>
            <AlertDialogDescription>
              You'll start receiving GigAid text messages again, and we'll
              send a quick confirmation text to your phone so you know they're
              going through. You can stop them any time by replying STOP.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-resume-sms-cancel">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => resumeSmsMutation.mutate()}
              disabled={resumeSmsMutation.isPending}
              data-testid="button-resume-sms-confirm"
            >
              {resumeSmsMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Resuming...
                </>
              ) : (
                "Yes, resume SMS"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
