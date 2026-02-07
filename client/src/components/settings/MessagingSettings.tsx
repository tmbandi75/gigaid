import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiFetch";
import { useApiMutation } from "@/hooks/useApiMutation";
import { MessageCircle, Phone, Inbox, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { QUERY_KEYS } from "@/lib/queryKeys";

interface MessageUsage {
  outboundSent: number;
  outboundLimit: number | null;
  outboundRemaining: number | null;
  inboxEnabled: boolean;
  plan: string;
}

interface Profile {
  personalPhone?: string | null;
  inAppInboxEnabled?: boolean;
}

export function MessagingSettings() {
  const { toast } = useToast();
  const [showInboxConfirm, setShowInboxConfirm] = useState(false);

  const { data: profile, isLoading: profileLoading } = useQuery<Profile>({
    queryKey: QUERY_KEYS.profile(),
  });

  const { data: usage, isLoading: usageLoading } = useQuery<MessageUsage>({
    queryKey: QUERY_KEYS.messagesUsage(),
  });

  const updateProfileMutation = useApiMutation(
    (updates: Partial<Profile>) => apiFetch("/api/profile", { method: "PATCH", body: JSON.stringify(updates) }),
    [QUERY_KEYS.profile(), QUERY_KEYS.messagesUsage()],
    {
      onSuccess: () => {
        toast({ title: "Settings saved" });
      },
      onError: () => {
        toast({ title: "Failed to save settings", variant: "destructive" });
      },
    }
  );

  const isProPlusOrHigher = usage?.plan === "pro_plus" || usage?.plan === "business";
  const isLoading = profileLoading || usageLoading;

  const usagePercent = usage?.outboundLimit 
    ? Math.min(100, (usage.outboundSent / usage.outboundLimit) * 100)
    : 0;

  const isNearLimit = usage?.outboundLimit && usagePercent >= 80;
  const isAtLimit = usage?.outboundLimit && usage.outboundSent >= usage.outboundLimit;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Usage Stats */}
      <div className="space-y-4">
        <h4 className="font-medium text-sm flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-blue-500" />
          Monthly Usage
        </h4>
        <div className="pl-6 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Messages sent</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                {usage?.outboundSent || 0}
                {usage?.outboundLimit ? ` / ${usage.outboundLimit}` : " (unlimited)"}
              </span>
              {isAtLimit && (
                <Badge variant="destructive" className="text-xs">
                  Limit reached
                </Badge>
              )}
              {isNearLimit && !isAtLimit && (
                <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                  Near limit
                </Badge>
              )}
            </div>
          </div>

          {usage?.outboundLimit && (
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full rounded-full transition-all duration-300",
                  isAtLimit ? "bg-destructive" : isNearLimit ? "bg-amber-500" : "bg-primary"
                )}
                style={{ width: `${usagePercent}%` }}
              />
            </div>
          )}

          {usage?.outboundRemaining !== null && !isAtLimit && (
            <p className="text-xs text-muted-foreground">
              {usage?.outboundRemaining} messages remaining this month
            </p>
          )}

          {isAtLimit && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-lg">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-destructive">Monthly limit reached</p>
                <p className="text-muted-foreground text-xs mt-1">
                  Upgrade your plan to send more messages, or wait until your billing cycle resets.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <Separator />

      {/* Personal Phone for Forwarding */}
      <div className="space-y-4">
        <h4 className="font-medium text-sm flex items-center gap-2">
          <Phone className="h-4 w-4 text-green-500" />
          Reply Forwarding
        </h4>
        <div className="pl-6 space-y-3">
          <p className="text-xs text-muted-foreground">
            When clients reply to messages you send through GigAid, we'll forward their replies to your personal phone.
          </p>
          <div className="space-y-2">
            <Label htmlFor="personal-phone" className="text-sm">Your personal phone number</Label>
            <div className="flex gap-2">
              <Input
                id="personal-phone"
                type="tel"
                placeholder="(555) 123-4567"
                defaultValue={profile?.personalPhone || ""}
                className="max-w-xs"
                data-testid="input-personal-phone"
                onBlur={(e) => {
                  const value = e.target.value.trim();
                  if (value !== (profile?.personalPhone || "")) {
                    updateProfileMutation.mutate({ personalPhone: value || null });
                  }
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              This is where client replies will be forwarded. Leave empty to only store messages in GigAid.
            </p>
          </div>
        </div>
      </div>

      <Separator />

      {/* In-App Inbox (Pro+ only) */}
      <div className="space-y-4">
        <h4 className="font-medium text-sm flex items-center gap-2">
          <Inbox className="h-4 w-4 text-purple-500" />
          In-App Inbox
          {!isProPlusOrHigher && (
            <Badge variant="secondary" className="text-xs">Pro+ only</Badge>
          )}
        </h4>
        <div className="pl-6 space-y-3">
          {isProPlusOrHigher ? (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Keep replies inside GigAid</p>
                  <p className="text-xs text-muted-foreground">
                    Replies will appear in GigAid instead of your phone.
                  </p>
                </div>
                <Switch
                  checked={profile?.inAppInboxEnabled || false}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setShowInboxConfirm(true);
                    } else {
                      updateProfileMutation.mutate({ inAppInboxEnabled: false });
                    }
                  }}
                  disabled={updateProfileMutation.isPending}
                  data-testid="switch-in-app-inbox"
                />
              </div>
              {profile?.inAppInboxEnabled && (
                <div className="flex items-start gap-2 p-3 bg-primary/5 rounded-lg">
                  <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium">Inbox enabled</p>
                    <p className="text-muted-foreground text-xs mt-1">
                      Client replies will appear in your GigAid inbox. You can reply directly from the app.
                    </p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                Upgrade to Pro+ to manage replies in GigAid.
              </p>
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={showInboxConfirm} onOpenChange={setShowInboxConfirm}>
        <AlertDialogContent data-testid="dialog-inbox-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Enable in-app inbox?</AlertDialogTitle>
            <AlertDialogDescription>
              Replies will no longer go to your phone. You must open GigAid to see and respond to client messages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-inbox-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                updateProfileMutation.mutate({ inAppInboxEnabled: true });
                setShowInboxConfirm(false);
              }}
              data-testid="button-inbox-confirm"
            >
              Enable inbox
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
