import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiFetch } from "@/lib/apiFetch";
import { useApiMutation } from "@/hooks/useApiMutation";
import { buildSlugAdjustedNotice } from "@/lib/slugAdjustedNotice";
import { getAuthToken } from "@/lib/authToken";
import { isNativePlatform } from "@/lib/platform";
import {
  Bell,
  Crown,
  Copy,
  Check,
  Loader2,
  Eye,
  EyeOff,
  Download,
  FileJson,
  Share,
  ArrowLeft,
  Settings as SettingsIcon,
  Globe,
  Sparkles,
  ChevronRight,
  DollarSign,
  Shield,
  Lock,
  Zap,
  User,
  AlertCircle,
  CheckCircle,
  Pencil,
  MessageCircle,
  BarChart3,
} from "lucide-react";
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
import { AvailabilityEditor } from "@/components/settings/AvailabilityEditor";
import { PaymentMethodsSettings } from "@/components/PaymentMethodsSettings";
import { StripeConnectSettings } from "@/components/settings/StripeConnectSettings";
import { EmailSignatureSettings } from "@/components/settings/EmailSignatureSettings";
import { AccountLinking } from "@/components/mobile-auth/AccountLinking";
import { PhoneLinkDialog } from "@/components/mobile-auth/PhoneLinkDialog";
import { WebPhoneEditDialog } from "@/components/mobile-auth/WebPhoneEditDialog";
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { AutomationSettings } from "@/components/settings/AutomationSettings";
import { MessagingSettings } from "@/components/settings/MessagingSettings";
import { SmsActivityPanel } from "@/components/settings/SmsActivityPanel";
import { ChangePasswordDialog } from "@/components/settings/ChangePasswordDialog";
import { SubscriptionSettings } from "@/components/settings/SubscriptionSettings";
import { SettingsSectionAccordion } from "@/components/settings/SettingsSectionAccordion";
import { HelpLink } from "@/components/HelpLink";
import {
  isEmailPasswordUser,
  getAccountLinkingInfo,
  linkAppleToCurrentUser,
  linkGoogleToCurrentUser,
  formatFirebaseLinkError,
  requireFirebaseUser,
} from "@/lib/firebase";
import type { Referral, WeeklyAvailability } from "@shared/schema";
import { useFeatureFlag, useUpdateFeatureFlag } from "@/hooks/use-nudges";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { copyTextToClipboard } from "@/lib/clipboard";
import { buildBookingLink, BOOKING_LINK_HOST_DISPLAY } from "@/lib/bookingBaseUrl";
import { useKeyboardInset } from "@/hooks/useKeyboardInset";
import {
  getAnalyticsConsent,
  setAnalyticsConsent,
} from "@/lib/consent/analyticsConsent";
import { logger } from "@/lib/logger";
import {
  initAnalyticsSafely,
  disableAnalytics,
  persistAnalyticsPreferences,
} from "@/lib/analytics/initAnalytics";
import {
  getATTStatus,
  requestATTUserInitiated,
  isIOSNative,
  type AnalyticsProfile,
} from "@/lib/att/attManager";
import { Directory } from "@capacitor/filesystem";

interface ReferralData {
  referralCode: string;
  referrals: Referral[];
  totalRewards: number;
}

interface PaymentMethod {
  id: string;
  type: string;
  isEnabled: boolean;
}

interface OnboardingStatus {
  completed: boolean;
  step: number;
  state: string;
  moneyProtectionReady: boolean;
  defaultServiceType: string | null;
  defaultPrice: number | null;
  depositPolicySet: boolean;
}

export default function Settings() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { firebaseUser, authLoading } = useFirebaseAuth();
  const phoneLinkFlowDoneRef = useRef<(() => void) | null>(null);
  const [phoneLinkOpen, setPhoneLinkOpen] = useState(false);
  const isMobile = useIsMobile();
  const [bookingLinkCopied, setBookingLinkCopied] = useState(false);
  const { isAuthenticated, logoutAsync } = useAuth();
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);
  const [attBlocked, setAttBlocked] = useState(false);
  const [forceOpenGetBooked, setForceOpenGetBooked] = useState(
    () => typeof window !== "undefined" && window.location.hash === "#get-booked"
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === "#get-booked") {
      setForceOpenGetBooked(true);
    }
  }, []);

  const profileQuery = useQuery<any>({ queryKey: ["/api/profile"] });

  const linkingInfo = useMemo(
    () => getAccountLinkingInfo(firebaseUser ?? null),
    [firebaseUser],
  );

  const endPhoneLinkFlow = () => {
    phoneLinkFlowDoneRef.current?.();
    phoneLinkFlowDoneRef.current = null;
  };

  // Scroll into view when a hash anchor (e.g. "#sms-activity" from the
  // held-back-text toast) is present. The element may not be mounted
  // immediately on first render, so we briefly retry.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash?.replace(/^#/, "");
    if (!hash) return;

    let attempts = 0;
    const maxAttempts = 20; // ~2s of polling
    let cancelled = false;
    const tryScroll = () => {
      if (cancelled) return;
      const el = document.getElementById(hash);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        // Clear the hash so re-opening Settings later doesn't auto-scroll
        // again. Use replaceState so we don't push a history entry.
        try {
          const url = `${window.location.pathname}${window.location.search}`;
          window.history.replaceState(null, "", url);
        } catch {
          /* non-fatal */
        }
        return;
      }
      attempts += 1;
      if (attempts < maxAttempts) {
        setTimeout(tryScroll, 100);
      }
    };
    tryScroll();
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    if (profileQuery.data) {
      setAnalyticsEnabled(profileQuery.data.analyticsEnabled ?? false);
      const status = profileQuery.data.attStatus;
      if (isIOSNative() && (status === "denied" || status === "restricted")) {
        setAttBlocked(true);
      }
    }
  }, [profileQuery.data]);

  const handleAnalyticsToggle = async (checked: boolean) => {
    if (!profileQuery.data) {
      toast({
        title: "Loading",
        description: "Please wait while your profile loads.",
      });
      return;
    }

    setAnalyticsEnabled(checked);
    const currentProfile = profileQuery.data;

    if (!checked) {
      setAnalyticsConsent("denied");
      disableAnalytics();
      await persistAnalyticsPreferences({
        analyticsEnabled: false,
        attStatus: currentProfile.attStatus ?? "unknown",
        attPromptedAt: currentProfile.attPromptedAt ?? null,
        analyticsDisabledReason: "user_disabled",
      });
      return;
    }

    setAnalyticsConsent("granted");

    if (isIOSNative()) {
      const currentAttStatus = await getATTStatus();

      if (currentAttStatus === "denied" || currentAttStatus === "restricted") {
        setAttBlocked(true);
        setAnalyticsEnabled(false);
        setAnalyticsConsent("denied");
        toast({
          title: "Tracking disabled in iOS Settings",
          description:
            "To enable analytics, allow tracking in Settings > Privacy & Security > Tracking.",
        });
        await persistAnalyticsPreferences({
          analyticsEnabled: false,
          attStatus: currentAttStatus,
          attPromptedAt: currentProfile.attPromptedAt ?? null,
          analyticsDisabledReason:
            currentAttStatus === "denied" ? "att_denied" : "restricted",
        });
        return;
      }

      if (
        currentAttStatus === "unknown" ||
        currentAttStatus === "not_determined"
      ) {
        const profileForATT: AnalyticsProfile = {
          analyticsEnabled: true,
          attStatus: currentAttStatus,
          attPromptedAt: currentProfile.attPromptedAt ?? null,
          analyticsDisabledReason:
            currentProfile.analyticsDisabledReason ?? null,
        };
        const result = await requestATTUserInitiated(profileForATT);
        const now = new Date().toISOString();

        if (result === "authorized") {
          const updatedProfile: AnalyticsProfile = {
            analyticsEnabled: true,
            attStatus: "authorized",
            attPromptedAt: now,
            analyticsDisabledReason: null,
          };
          await persistAnalyticsPreferences(updatedProfile);
          await initAnalyticsSafely(updatedProfile);
          return;
        }

        const reason =
          result === "denied"
            ? "att_denied"
            : result === "restricted"
              ? "restricted"
              : "not_supported";
        setAnalyticsEnabled(false);
        setAnalyticsConsent("denied");
        setAttBlocked(result === "denied" || result === "restricted");
        await persistAnalyticsPreferences({
          analyticsEnabled: false,
          attStatus: result === "unavailable" ? "unavailable" : result,
          attPromptedAt: now,
          analyticsDisabledReason: reason,
        });
        toast({
          title: "Analytics not enabled",
          description:
            "Tracking permission was not granted. Analytics will remain off.",
        });
        return;
      }

      if (currentAttStatus === "authorized") {
        const updatedProfile: AnalyticsProfile = {
          analyticsEnabled: true,
          attStatus: "authorized",
          attPromptedAt: currentProfile.attPromptedAt ?? null,
          analyticsDisabledReason: null,
        };
        await persistAnalyticsPreferences(updatedProfile);
        await initAnalyticsSafely(updatedProfile);
        return;
      }
    }

    const updatedProfile: AnalyticsProfile = {
      analyticsEnabled: true,
      attStatus: currentProfile.attStatus ?? "unavailable",
      attPromptedAt: currentProfile.attPromptedAt ?? null,
      analyticsDisabledReason: null,
    };
    await persistAnalyticsPreferences(updatedProfile);
    await initAnalyticsSafely(updatedProfile);
  };

  const handleAuthenticatedDownload = async (url: string, filename: string) => {
    try {
      const token = getAuthToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(url, {
        credentials: "include",
        headers,
      });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`);
      }

      const blob = await response.blob();

      if (isNativePlatform()) {
        const { Filesystem } = await import("@capacitor/filesystem");
        const { Share } = await import("@capacitor/share");

        const toBase64 = (source: Blob): Promise<string> =>
          new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () =>
              reject(new Error("Could not read file data"));
            reader.onload = () => {
              const result = reader.result;
              if (typeof result !== "string") {
                reject(new Error("Could not read file data"));
                return;
              }
              const commaIndex = result.indexOf(",");
              if (commaIndex === -1) {
                reject(new Error("Could not read file data"));
                return;
              }
              resolve(result.slice(commaIndex + 1));
            };
            reader.readAsDataURL(source);
          });

        const safeFilename = filename.replace(/[\\/:"*?<>|]+/g, "-");
        const base64 = await toBase64(blob);

        await Filesystem.writeFile({
          path: safeFilename,
          data: base64,
          directory: Directory.Documents,
        });

        const uri = await Filesystem.getUri({
          directory: Directory.Documents,
          path: safeFilename,
        });

        await Share.share({
          title: "Export data",
          text: "Here is your GigAid export file.",
          url: uri.uri,
          dialogTitle: "Export data",
        });

        toast({
          title: "Export ready",
          description: "Choose where to save or share your file.",
        });
        return;
      }

      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      toast({
        title: "Download started",
        description: `${filename} is downloading`,
      });
    } catch (error: any) {
      logger.error("Download error:", error);
      toast({
        title: "Download failed",
        description: error.message || "Could not download file",
        variant: "destructive",
      });
    }
  };

  const { data: aiNudgesFlag } = useFeatureFlag("ai_micro_nudges");
  const updateFeatureFlag = useUpdateFeatureFlag();

  const { data: profile } = useQuery<any>({
    queryKey: QUERY_KEYS.profile(),
  });

  const { data: onboardingStatus, isLoading: isOnboardingLoading } =
    useQuery<OnboardingStatus>({
      queryKey: QUERY_KEYS.onboarding(),
    });

  const {
    data: subscription,
    isLoading: isSubscriptionLoading,
    isError: isSubscriptionError,
  } = useQuery<{ plan: string; hasSubscription: boolean }>({
    queryKey: QUERY_KEYS.subscriptionStatus(),
    retry: 1,
    staleTime: 60000,
  });

  // Derive plan display from subscription - handle loading/error explicitly
  const getPlanLabel = (): string => {
    if (isSubscriptionLoading) return "Loading...";
    if (isSubscriptionError || !subscription) return "Unable to load";
    const plan = subscription.plan;
    if (!plan || plan === "free") return "Free";
    return plan.charAt(0).toUpperCase() + plan.slice(1).replace("_", "+");
  };

  const isBusinessPlan =
    subscription !== undefined && subscription.plan === "business";
  const currentPlanLabel = getPlanLabel();

  const isMoneyProtectionReady = onboardingStatus
    ? onboardingStatus.moneyProtectionReady
    : true;
  const needsSetup = !isOnboardingLoading && !isMoneyProtectionReady;

  const { data: paymentMethods } = useQuery<PaymentMethod[]>({
    queryKey: QUERY_KEYS.paymentMethods(),
  });

  const savedStripeEnabled =
    paymentMethods?.some(
      (method) => method.type === "stripe" && method.isEnabled,
    ) ?? false;

  const [stripeEnabled, setStripeEnabled] = useState(false);

  useEffect(() => {
    setStripeEnabled(savedStripeEnabled);
  }, [savedStripeEnabled]);

  const { data: stripeStatus } = useQuery<{
    connected: boolean;
    accountId?: string;
  }>({
    queryKey: QUERY_KEYS.stripeConnectStatus(),
    enabled: stripeEnabled,
  });

  const [settings, setSettings] = useState({
    publicProfileEnabled: false,
    publicProfileSlug: "",
    notifyBySms: true,
    notifyByEmail: true,
    availability: null as WeeklyAvailability | null,
    slotDuration: 60,
    showReviewsOnBooking: true,
    publicEstimationEnabled: true,
    noShowProtectionEnabled: true,
    noShowProtectionDepositPercent: 25,
  });
  const [showQuickSetup, setShowQuickSetup] = useState(false);
  const [quickSetupPrice, setQuickSetupPrice] = useState("");
  const [slugError, setSlugError] = useState<string | null>(null);
  const [slugChecking, setSlugChecking] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const originalSlug = profile?.publicProfileSlug || "";

  useEffect(() => {
    if (profile) {
      let parsedAvailability = null;
      try {
        if (profile.availability) {
          parsedAvailability =
            typeof profile.availability === "string"
              ? JSON.parse(profile.availability)
              : profile.availability;
        }
      } catch (e) {
        parsedAvailability = null;
      }
      setSettings({
        publicProfileEnabled: profile.publicProfileEnabled || false,
        publicProfileSlug: profile.publicProfileSlug || "",
        notifyBySms: profile.notifyBySms !== false,
        notifyByEmail: profile.notifyByEmail !== false,
        availability: parsedAvailability,
        slotDuration: profile.slotDuration || 60,
        showReviewsOnBooking: profile.showReviewsOnBooking !== false,
        publicEstimationEnabled: profile.publicEstimationEnabled !== false,
        noShowProtectionEnabled: profile.noShowProtectionEnabled !== false,
        noShowProtectionDepositPercent:
          profile.noShowProtectionDepositPercent ?? 25,
      });
    }
  }, [profile]);

  const RESERVED_SLUGS = new Set([
    "admin",
    "api",
    "login",
    "signup",
    "register",
    "settings",
    "profile",
    "dashboard",
    "help",
    "support",
    "about",
    "terms",
    "privacy",
    "contact",
    "pricing",
    "billing",
    "account",
    "app",
    "book",
    "booking",
    "onboarding",
    "downloads",
    "home",
    "test",
    "demo",
    "status",
    "health",
  ]);

  const handleSlugChange = (value: string) => {
    const cleaned = value
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "")
      .replace(/--+/g, "-")
      .replace(/^-|-$/g, "");
    setSettings({ ...settings, publicProfileSlug: cleaned });
    setSlugAvailable(null);

    if (!cleaned || cleaned.length < 3) {
      setSlugError(cleaned ? "URL must be at least 3 characters" : null);
      return;
    }
    if (cleaned.length > 48) {
      setSlugError("URL must be 48 characters or less");
      return;
    }
    if (RESERVED_SLUGS.has(cleaned)) {
      setSlugError("This URL is reserved. Please choose a different one.");
      return;
    }
    setSlugError(null);

    if (cleaned === originalSlug) {
      setSlugAvailable(null);
      return;
    }
    setSlugChecking(true);
  };

  useEffect(() => {
    const slug = settings.publicProfileSlug;
    if (!slug || slug.length < 3 || slug === originalSlug || slugError) {
      setSlugChecking(false);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await apiFetch(`/api/slug/check/${slug}`);
        const data = typeof res === "string" ? JSON.parse(res) : res;
        if (data.available) {
          setSlugAvailable(true);
          setSlugError(null);
        } else {
          setSlugAvailable(false);
          setSlugError(data.reason || "This URL is not available");
        }
      } catch {
        setSlugAvailable(null);
      }
      setSlugChecking(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [settings.publicProfileSlug, originalSlug, slugError]);

  const updateMutation = useApiMutation<any, any>(
    (data: any) =>
      apiFetch("/api/settings", {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    [QUERY_KEYS.profile()],
    {
      onSuccess: (data, variables) => {
        // The save succeeded — but the slug uniqueness index may have
        // forced our requested slug to a `-2` suffix when a concurrent
        // writer claimed it first. Compare the slug we asked for to
        // the slug the server actually wrote and surface a small
        // non-blocking notice so the user sees their saved link
        // diverged from what they typed.
        const notice = buildSlugAdjustedNotice(
          variables?.publicProfileSlug ?? null,
          data?.publicProfileSlug ?? null,
        );
        if (notice) {
          toast({
            title: notice.title,
            description: notice.description,
          });
        } else {
          toast({ title: "Settings saved" });
        }
      },
      onError: () => {
        toast({ title: "Failed to save settings", variant: "destructive" });
      },
    },
  );

  const [resumeSmsDialogOpen, setResumeSmsDialogOpen] = useState(false);
  const accountLinkingRef = useRef<HTMLDivElement | null>(null);
  const [highlightAccountLinking, setHighlightAccountLinking] = useState(false);
  const autoRetryAfterPhoneLinkRef = useRef(false);
  // Web (non-Capacitor) phone editor dialog. The native flow lives in
  // PhoneLinkDialog and is gated on isNativePlatform(). Web users hitting
  // the bounce banner or the AccountLinking section get this OTP-verified
  // editor instead, which talks to /api/profile/phone/{send,verify}-otp.
  const [webPhoneEditOpen, setWebPhoneEditOpen] = useState(false);
  const autoRetryAfterPhoneEditRef = useRef(false);
  const openWebPhoneEditor = (autoRetryResume: boolean) => {
    autoRetryAfterPhoneEditRef.current = autoRetryResume;
    setWebPhoneEditOpen(true);
  };
  const focusPhoneNumberField = () => {
    // Banner CTA: open the verifying editor and gently flash the
    // AccountLinking section so the user knows where the editor lives.
    // On native we open the existing PhoneLinkDialog flow; on web we open
    // the new OTP-verified WebPhoneEditDialog.
    const autoRetry = Boolean(
      profile?.smsConfirmationLastFailureAt || profile?.phoneUnreachable,
    );
    if (isNativePlatform()) {
      autoRetryAfterPhoneLinkRef.current = autoRetry;
      phoneLinkFlowDoneRef.current = () => {};
      setPhoneLinkOpen(true);
    } else {
      openWebPhoneEditor(autoRetry);
    }
    const el = accountLinkingRef.current;
    if (el) {
      try {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch {
        /* non-fatal: jsdom and very old browsers may not implement smooth scroll */
      }
      setHighlightAccountLinking(true);
      window.setTimeout(() => setHighlightAccountLinking(false), 2000);
    }
  };
  const resumeSmsMutation = useApiMutation<
    {
      success: boolean;
      confirmationSent?: boolean;
      confirmationWarning?: string;
    },
    { forceConfirmationSend?: boolean } | void
  >(
    (vars) =>
      apiFetch("/api/profile/sms/resume", {
        method: "POST",
        body: JSON.stringify({
          forceConfirmationSend: !!vars?.forceConfirmationSend,
        }),
      }),
    [QUERY_KEYS.profile()],
    {
      onSuccess: (data) => {
        setResumeSmsDialogOpen(false);
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

  // Called by both the SMS bounce banner CTA and the AccountLinking
  // "Change" affordance once the new number has been verified server-side.
  // Refreshes the profile cache, surfaces a success toast, and (if the
  // edit was triggered from a confirmation-failure state) automatically
  // re-runs the SMS resume so the user gets a fresh confirmation text on
  // the new number without a second tap.
  const handleWebPhoneUpdated = (newPhone: string) => {
    setWebPhoneEditOpen(false);
    void queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
    toast({
      title: "Phone number updated",
      description: autoRetryAfterPhoneEditRef.current
        ? `Re-sending your SMS confirmation to ${newPhone}…`
        : `${newPhone} is verified and saved.`,
    });
    if (autoRetryAfterPhoneEditRef.current) {
      autoRetryAfterPhoneEditRef.current = false;
      // Force the resume endpoint to send a fresh confirmation SMS even
      // though verify-otp has already cleared the lingering failure state.
      resumeSmsMutation.mutate({ forceConfirmationSend: true });
    }
  };

  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const deleteKeyboardInset = useKeyboardInset(showDeleteDialog);
  const isDeleteConfirmValid =
    deleteConfirmText.trim().toUpperCase() === "DELETE";

  const handleDeleteAccount = async () => {
    if (!isDeleteConfirmValid) return;
    logger.info("[AccountDeleteFlow] step=client_start");
    setIsDeleting(true);
    setDeleteError(null);
    try {
      logger.info("[AccountDeleteFlow] step=client_api_delete_request");
      const result = await apiFetch<{
        success?: boolean;
        message?: string;
        tablesCleared?: number;
      }>("/api/account", { method: "DELETE" });
      logger.info(
        "[AccountDeleteFlow] step=client_api_delete_ok",
        result ?? {},
      );
      logger.info("[AccountDeleteFlow] step=client_logout_start");
      await logoutAsync();
      logger.info("[AccountDeleteFlow] step=client_logout_done redirect=/");
      window.location.href = "/";
    } catch (error) {
      logger.error("[AccountDeleteFlow] step=client_failed", error);
      setDeleteError("We couldn't delete your account. Please try again.");
      setIsDeleting(false);
    }
  };

  const resetDeleteDialog = () => {
    setDeleteConfirmText("");
    setDeleteError(null);
    setIsDeleting(false);
    setShowDeleteDialog(false);
  };

  const quickSetupMutation = useApiMutation(
    async (price: number) => {
      await apiFetch("/api/onboarding", {
        method: "PATCH",
        body: JSON.stringify({
          defaultPrice: price,
          depositPolicySet: true,
          completed: true,
          state: "completed",
          step: 8,
        }),
      });
    },
    [QUERY_KEYS.onboarding(), QUERY_KEYS.profile()],
    {
      onSuccess: () => {
        setShowQuickSetup(false);
        setQuickSetupPrice("");
        toast({ title: "Deposit protection enabled" });
      },
      onError: () => {
        toast({ title: "Failed to save settings", variant: "destructive" });
      },
    },
  );

  const handleQuickSetup = () => {
    const priceInCents = Math.round(parseFloat(quickSetupPrice) * 100);
    if (isNaN(priceInCents) || priceInCents <= 0) {
      toast({ title: "Please enter a valid price", variant: "destructive" });
      return;
    }
    quickSetupMutation.mutate(priceInCents);
  };

  const handleSave = () => {
    if (slugError) {
      toast({
        title: "Please fix the booking URL before saving",
        variant: "destructive",
      });
      return;
    }
    const dataToSave = {
      publicProfileEnabled: settings.publicProfileEnabled,
      publicProfileSlug: settings.publicProfileSlug,
      notifyBySms: settings.notifyBySms,
      notifyByEmail: settings.notifyByEmail,
      availability: settings.availability
        ? JSON.stringify(settings.availability)
        : null,
      slotDuration: settings.slotDuration,
      showReviewsOnBooking: settings.showReviewsOnBooking,
      publicEstimationEnabled: settings.publicEstimationEnabled,
      noShowProtectionEnabled: settings.noShowProtectionEnabled,
      noShowProtectionDepositPercent: settings.noShowProtectionDepositPercent,
    };
    updateMutation.mutate(dataToSave);
  };

  const handleAvailabilityChange = (
    availability: WeeklyAvailability,
    slotDuration: number,
  ) => {
    setSettings({ ...settings, availability, slotDuration });
  };

  const copyBookingLink = async () => {
    const link = buildBookingLink(settings.publicProfileSlug);
    const copiedOk = await copyTextToClipboard(link);
    if (!copiedOk) {
      toast({ title: "Could not copy booking link", variant: "destructive" });
      return;
    }
    setBookingLinkCopied(true);
    setTimeout(() => setBookingLinkCopied(false), 2000);
    toast({ title: "Booking link copied!" });
  };

  const renderMobileHeader = () => (
    <div className="relative overflow-hidden bg-gradient-to-br from-slate-600 via-slate-700 to-slate-800 text-white px-4 pt-6 pb-8">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 -left-10 w-32 h-32 bg-slate-400/10 rounded-full blur-2xl" />
      </div>
      <div className="relative">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/more")}
          className="mb-4 -ml-2 text-white/80"
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center">
            <SettingsIcon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Settings</h1>
            <p className="text-slate-300/80">Configure your app preferences</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderDesktopHeader = () => (
    <div className="border-b bg-background sticky top-0 z-[999]">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-5 flex items-center gap-4">
        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-slate-500/10 to-gray-500/10 flex items-center justify-center">
          <SettingsIcon className="h-6 w-6 text-slate-700 dark:text-slate-300" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground">App preferences</p>
        </div>
      </div>
    </div>
  );

  const stripeStatusBanner = (
    <div
      className={`flex items-center gap-2 p-3 rounded-lg ${
        stripeEnabled && stripeStatus?.connected
          ? "bg-green-500/10 border border-green-500/20"
          : "bg-amber-500/10 border border-amber-500/20"
      }`}
    >
      {stripeEnabled && stripeStatus?.connected ? (
        <>
          <CheckCircle className="h-4 w-4 text-green-600" />
          <span className="text-sm text-green-700 dark:text-green-400">
            Stripe connected - You can accept card payments
          </span>
        </>
      ) : (
        <>
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <span className="text-sm text-amber-700 dark:text-amber-400">
            Enable Stripe to accept card payments and deposits
          </span>
        </>
      )}
    </div>
  );

  return (
    <div
      className={`min-h-screen bg-background ${isMobile ? "pb-24" : "pb-12"}`}
      data-testid="page-settings"
    >
      {isMobile ? renderMobileHeader() : renderDesktopHeader()}

      <div
        className={`${isMobile ? "px-4 py-4" : "max-w-7xl mx-auto px-6 lg:px-8 py-6"} space-y-4`}
      >
        {/* SECTION 1: Get Paid (always expanded by default) */}
        <SettingsSectionAccordion
          id="get-paid"
          title="Get Paid"
          subtitle="Everything required to collect money from clients"
          icon={<DollarSign className="h-4 w-4 text-white" />}
          iconGradient="from-green-500 to-emerald-500"
          defaultOpen={true}
          className="border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/30 dark:bg-emerald-950/10"
          headerExtra={
            stripeEnabled && stripeStatus?.connected ? (
              <Badge
                variant="secondary"
                className="text-xs bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
              >
                Connected
              </Badge>
            ) : null
          }
        >
          <div className="space-y-6">
            <div className="flex items-center justify-end -mt-2">
              <HelpLink slug="invoices-payments" label="Invoices & Payments" />
            </div>
            {stripeStatusBanner}

            <PaymentMethodsSettings onStripeToggle={setStripeEnabled} />

            {stripeEnabled && (
              <>
                <Separator />
                <StripeConnectSettings />
              </>
            )}

            <Separator />

            <div className="space-y-4">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <Shield className="h-4 w-4 text-blue-500" />
                Deposit Protection
              </h4>

              {needsSetup ? (
                <div className="p-4 rounded-xl border-dashed border-2 border-primary/30 bg-primary/5">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Lock className="h-5 w-5 text-primary" />
                    </div>
                    <div className="space-y-2 flex-1">
                      <p className="font-medium text-foreground">
                        Set a default price to enable booking protection
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Complete your pricing setup to automatically protect
                        against no-shows.
                      </p>
                      {showQuickSetup ? (
                        <div className="mt-3 space-y-3">
                          <div>
                            <Label
                              htmlFor="quick-setup-price"
                              className="text-sm"
                            >
                              Your typical job price
                            </Label>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="relative flex-1">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                  id="quick-setup-price"
                                  type="number"
                                  placeholder="150"
                                  value={quickSetupPrice}
                                  onChange={(e) =>
                                    setQuickSetupPrice(e.target.value)
                                  }
                                  className="pl-9"
                                  data-testid="input-quick-setup-price"
                                />
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              This enables automatic 30% deposit protection for
                              bookings
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={handleQuickSetup}
                              disabled={quickSetupMutation.isPending}
                              data-testid="button-save-quick-setup"
                            >
                              {quickSetupMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              ) : null}
                              Enable Protection
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setShowQuickSetup(false)}
                              data-testid="button-cancel-quick-setup"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          className="mt-2"
                          onClick={() => setShowQuickSetup(true)}
                          data-testid="button-setup-deposit"
                        >
                          Quick setup (30 sec)
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">
                        Protect me from no-shows
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Automatically require deposits for higher-risk bookings
                      </p>
                    </div>
                    <Switch
                      checked={settings.noShowProtectionEnabled}
                      onCheckedChange={(checked) =>
                        setSettings({
                          ...settings,
                          noShowProtectionEnabled: checked,
                        })
                      }
                      aria-label="Toggle Protect me from no-shows"
                      data-testid="switch-no-show-protection"
                    />
                  </div>

                  {settings.noShowProtectionEnabled && (
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div>
                        <p className="font-medium text-sm">
                          Default deposit amount
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Percentage collected upfront for bookings
                        </p>
                      </div>
                      <Select
                        value={String(settings.noShowProtectionDepositPercent)}
                        onValueChange={(value) =>
                          setSettings({
                            ...settings,
                            noShowProtectionDepositPercent: Number(value),
                          })
                        }
                      >
                        <SelectTrigger
                          className="w-24"
                          data-testid="select-deposit-percent"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">0%</SelectItem>
                          <SelectItem value="10">10%</SelectItem>
                          <SelectItem value="25">25%</SelectItem>
                          <SelectItem value="50">50%</SelectItem>
                          <SelectItem value="75">75%</SelectItem>
                          <SelectItem value="100">100%</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </SettingsSectionAccordion>

        {/* SECTION 2: Get Booked */}
        <SettingsSectionAccordion
          id="get-booked"
          title="Get Booked"
          subtitle="How clients find and book you"
          icon={<Globe className="h-4 w-4 text-white" />}
          iconGradient="from-blue-500 to-indigo-500"
          defaultOpen={false}
          forceOpen={forceOpenGetBooked}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-end -mt-2">
              <HelpLink
                slug="public-profile"
                label="Public Profile & Booking"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Enable Public Profile</p>
                <p className="text-xs text-muted-foreground">
                  Let clients find and book you
                </p>
              </div>
              <Switch
                checked={settings.publicProfileEnabled}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, publicProfileEnabled: checked })
                }
                aria-label="Toggle Enable Public Profile"
                data-testid="switch-public-profile"
              />
            </div>

            {settings.publicProfileEnabled && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label className="text-sm">Your Booking URL</Label>
                  <div className="flex gap-2">
                    <Input
                      value={settings.publicProfileSlug}
                      onChange={(e) => handleSlugChange(e.target.value)}
                      placeholder="your-name"
                      data-testid="input-profile-slug"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={copyBookingLink}
                      aria-label="Copy booking link"
                      data-testid="button-copy-booking"
                    >
                      {bookingLinkCopied ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground">
                      {BOOKING_LINK_HOST_DISPLAY}/book/
                      {settings.publicProfileSlug || "your-name"}
                    </p>
                    {slugChecking && (
                      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                    )}
                    {slugAvailable === true && !slugChecking && (
                      <span className="text-xs text-green-600 flex items-center gap-1">
                        <Check className="h-3 w-3" /> Available
                      </span>
                    )}
                  </div>
                  {slugError && (
                    <p className="text-xs text-destructive">{slugError}</p>
                  )}
                </div>

                {needsSetup && (
                  <div className="p-4 rounded-xl border-dashed border-2 border-amber-500/30 bg-amber-500/5">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                        <Lock className="h-5 w-5 text-amber-600" />
                      </div>
                      <div className="space-y-2">
                        <p className="font-medium text-foreground">
                          Complete setup to enable deposits
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Your booking link works, but deposits won't be
                          collected until you complete setup.
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2"
                          onClick={() => navigate("/onboarding")}
                          data-testid="button-setup-booking"
                        >
                          Quick setup (30 sec)
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-sm">Your Services</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate("/profile?edit=true")}
                      data-testid="button-edit-services"
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1.5" />
                      Edit in Profile
                    </Button>
                  </div>
                  {profile?.services && profile.services.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {profile.services.map((service: string) => (
                        <Badge key={service} variant="secondary">
                          {service}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No services added yet. Edit your profile to add services.
                    </p>
                  )}
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {settings.showReviewsOnBooking ? (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div>
                      <p className="font-medium text-sm">Show Reviews</p>
                      <p className="text-xs text-muted-foreground">
                        Display ratings on booking page
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.showReviewsOnBooking}
                    onCheckedChange={(checked) =>
                      setSettings({
                        ...settings,
                        showReviewsOnBooking: checked,
                      })
                    }
                    aria-label="Toggle Show Reviews"
                    data-testid="switch-show-reviews"
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">
                        Public Price Estimates
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Allow customers to get AI estimates on booking page
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.publicEstimationEnabled}
                    onCheckedChange={(checked) =>
                      setSettings({
                        ...settings,
                        publicEstimationEnabled: checked,
                      })
                    }
                    aria-label="Toggle Public Price Estimates"
                    data-testid="switch-public-estimation"
                  />
                </div>

                <Separator />

                {settings.publicProfileEnabled && (
                  <AvailabilityEditor
                    availability={settings.availability}
                    slotDuration={settings.slotDuration}
                    onChange={handleAvailabilityChange}
                  />
                )}
              </>
            )}

            {!settings.publicProfileEnabled && (
              <p className="text-sm text-muted-foreground py-2">
                Enable your public profile above to configure availability.
              </p>
            )}
          </div>
        </SettingsSectionAccordion>

        {/* SECTION 3: Automate */}
        <SettingsSectionAccordion
          id="automate"
          title="Automate"
          subtitle="Let GigAid follow up for you"
          icon={<Zap className="h-4 w-4 text-white" />}
          iconGradient="from-orange-500 to-amber-500"
          defaultOpen={false}
        >
          <div className="space-y-6">
            <AutomationSettings />
            <Separator />
            <div>
              <h4 className="font-medium text-sm flex items-center gap-2 mb-4">
                <MessageCircle className="h-4 w-4 text-blue-500" />
                Messaging
              </h4>
              <MessagingSettings />
            </div>
          </div>
        </SettingsSectionAccordion>

        {/* SECTION 4: Account */}
        <SettingsSectionAccordion
          id="account"
          title="Account"
          subtitle="Your account and app preferences"
          icon={<User className="h-4 w-4 text-white" />}
          iconGradient="from-violet-500 to-purple-600"
          defaultOpen={false}
        >
          <div className="space-y-6">
            <div className="flex items-center justify-end -mt-2">
              <HelpLink slug="account-privacy" label="Account & Privacy" />
            </div>
            {/* Plan */}
            {!isBusinessPlan && subscription !== undefined && (
              <>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center shrink-0">
                      <Crown className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        Current Plan: {currentPlanLabel}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Unlock advanced automations, booking protection, and AI
                        tools
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => navigate("/pricing")}
                    data-testid="button-upgrade-plan"
                  >
                    Upgrade
                  </Button>
                </div>
                <Separator />
              </>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <Crown className="h-4 w-4 text-primary" />
                  Plan & Billing
                </h4>
                <HelpLink slug="subscription" label="Subscription" size="xs" />
              </div>
              <SubscriptionSettings />
            </div>

            <Separator />

            {/* Notifications */}
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <Bell className="h-4 w-4 text-amber-500" />
                  Notifications
                </h4>
                <HelpLink
                  slug="notifications"
                  label="Notifications"
                  size="xs"
                />
              </div>
              <div className="space-y-4 pl-6">
                {profile?.smsConfirmationLastFailureAt && (
                  <div
                    className="rounded-md border border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950/40 p-3 space-y-2"
                    data-testid="banner-sms-confirmation-failed"
                  >
                    <div className="flex items-start gap-2">
                      <AlertCircle
                        className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0"
                        aria-hidden="true"
                      />
                      <div className="space-y-1">
                        <p
                          className="font-medium text-sm text-red-900 dark:text-red-100"
                          data-testid="text-sms-confirmation-failed-title"
                        >
                          We couldn't deliver your SMS confirmation
                        </p>
                        <p
                          className="text-xs text-red-800 dark:text-red-200"
                          data-testid="text-sms-confirmation-failed-detail"
                        >
                          {profile?.smsConfirmationLastFailureMessage ||
                            "The confirmation text we sent didn't go through."}{" "}
                          Update your phone number and we'll try again.
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 pl-6">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-400 text-red-900 hover:bg-red-100 dark:border-red-600 dark:text-red-100 dark:hover:bg-red-900/40"
                        onClick={focusPhoneNumberField}
                        data-testid="button-sms-confirmation-update-phone"
                      >
                        Update phone number
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-900 hover:bg-red-100 dark:text-red-100 dark:hover:bg-red-900/40"
                        onClick={() => resumeSmsMutation.mutate()}
                        disabled={resumeSmsMutation.isPending}
                        data-testid="button-sms-confirmation-try-again"
                      >
                        {resumeSmsMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Retrying...
                          </>
                        ) : (
                          "Try again"
                        )}
                      </Button>
                    </div>
                  </div>
                )}
                {profile?.smsOptOut && (
                  <div
                    className="rounded-md border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40 p-3 space-y-2"
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
                          We won't send you any text messages until you resume.
                          You can also reply START to any of our numbers.
                        </p>
                      </div>
                    </div>
                    <AlertDialog
                      open={resumeSmsDialogOpen}
                      onOpenChange={setResumeSmsDialogOpen}
                    >
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
                            You'll start receiving GigAid text messages again,
                            and we'll send a quick confirmation text to your
                            phone so you know they're going through. You can
                            stop them any time by replying STOP.
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
                )}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">SMS Notifications</p>
                    <p className="text-xs text-muted-foreground">
                      Receive updates via text message
                    </p>
                  </div>
                  <Switch
                    checked={settings.notifyBySms}
                    onCheckedChange={(checked) =>
                      setSettings({ ...settings, notifyBySms: checked })
                    }
                    aria-label="Toggle SMS Notifications"
                    data-testid="switch-notify-sms"
                    disabled={profile?.smsOptOut === true}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Email Notifications</p>
                    <p className="text-xs text-muted-foreground">
                      Receive updates via email
                    </p>
                  </div>
                  <Switch
                    checked={settings.notifyByEmail}
                    onCheckedChange={(checked) =>
                      setSettings({ ...settings, notifyByEmail: checked })
                    }
                    aria-label="Toggle Email Notifications"
                    data-testid="switch-notify-email"
                  />
                </div>
                <SmsActivityPanel />
              </div>
            </div>

            <Separator />

            {/* AI Suggestions */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-500" />
                AI Suggestions
              </h4>
              <div className="pl-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Smart Action Nudges</p>
                    <p className="text-xs text-muted-foreground">
                      Get AI-powered suggestions for leads and invoices
                    </p>
                  </div>
                  <Switch
                    checked={aiNudgesFlag?.enabled ?? true}
                    onCheckedChange={(checked) => {
                      updateFeatureFlag.mutate({
                        key: "ai_micro_nudges",
                        enabled: checked,
                      });
                    }}
                    disabled={updateFeatureFlag.isPending}
                    aria-label="Toggle Smart Action Nudges"
                    data-testid="switch-ai-nudges"
                  />
                </div>
              </div>
            </div>

            <Separator />

            <EmailSignatureSettings />

            <Separator />

            {!authLoading && firebaseUser && (
              <div
                ref={accountLinkingRef}
                className={`rounded-md transition-shadow ${
                  highlightAccountLinking
                    ? "ring-2 ring-red-400 ring-offset-2 dark:ring-red-500"
                    : ""
                }`}
                data-testid="section-account-linking"
              >
                <AccountLinking
                  currentProvider={linkingInfo.currentProvider}
                  linkedMethods={linkingInfo.linkedMethods}
                  email={profile?.email}
                  phone={profile?.phone}
                  onLinkApple={async () => {
                    try {
                      await linkAppleToCurrentUser();
                      toast({
                        title: "Apple linked",
                        description:
                          "You can now sign in with Apple on this account.",
                      });
                      await queryClient.invalidateQueries({
                        queryKey: ["/api/profile"],
                      });
                    } catch (e) {
                      toast({
                        title: "Could not link Apple",
                        description: formatFirebaseLinkError(e),
                        variant: "destructive",
                      });
                    }
                  }}
                  onLinkGoogle={async () => {
                    try {
                      await linkGoogleToCurrentUser();
                      toast({
                        title: "Google linked",
                        description:
                          "You can now sign in with Google on this account.",
                      });
                      await queryClient.invalidateQueries({
                        queryKey: ["/api/profile"],
                      });
                    } catch (e) {
                      toast({
                        title: "Could not link Google",
                        description: formatFirebaseLinkError(e),
                        variant: "destructive",
                      });
                    }
                  }}
                  onLinkPhone={
                    isNativePlatform()
                      ? () =>
                          new Promise<void>((resolve) => {
                            phoneLinkFlowDoneRef.current = resolve;
                            autoRetryAfterPhoneLinkRef.current = Boolean(
                              profile?.smsConfirmationLastFailureAt,
                            );
                            setPhoneLinkOpen(true);
                          })
                      : async () => {
                          openWebPhoneEditor(
                            Boolean(profile?.smsConfirmationLastFailureAt),
                          );
                        }
                  }
                  onChangePhone={
                    !isNativePlatform()
                      ? () =>
                          openWebPhoneEditor(
                            Boolean(profile?.smsConfirmationLastFailureAt),
                          )
                      : undefined
                  }
                  onLinkEmail={() => {
                    toast({
                      title: "Email linking",
                      description:
                        "Add or link email from the mobile app or contact support.",
                    });
                  }}
                />
                {isNativePlatform() ? (
                  <PhoneLinkDialog
                    open={phoneLinkOpen}
                    onOpenChange={(o) => {
                      setPhoneLinkOpen(o);
                      if (!o) endPhoneLinkFlow();
                    }}
                    onLinked={async () => {
                      try {
                        await requireFirebaseUser().reload();
                      } catch {
                        /* session may already be current */
                      }
                      toast({
                        title: "Phone linked",
                        description:
                          "You can now sign in with this phone number.",
                      });
                      await queryClient.invalidateQueries({
                        queryKey: ["/api/profile"],
                      });
                      if (autoRetryAfterPhoneLinkRef.current) {
                        autoRetryAfterPhoneLinkRef.current = false;
                        resumeSmsMutation.mutate();
                      }
                    }}
                  />
                ) : (
                  <WebPhoneEditDialog
                    open={webPhoneEditOpen}
                    onOpenChange={setWebPhoneEditOpen}
                    currentPhone={profile?.phone ?? null}
                    onUpdated={handleWebPhoneUpdated}
                  />
                )}
              </div>
            )}

            <Separator />

            <div className="space-y-4">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-indigo-500" />
                Analytics
              </h4>
              <div className="pl-6 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-sm">
                      Enable usage analytics
                    </p>
                    <p className="text-xs text-muted-foreground">
                      We use anonymous usage data to improve reliability and
                      features.
                    </p>
                  </div>
                  <Switch
                    checked={analyticsEnabled}
                    onCheckedChange={handleAnalyticsToggle}
                    aria-label="Toggle Enable usage analytics"
                    data-testid="switch-analytics"
                  />
                </div>
                {attBlocked && (
                  <div
                    className="p-3 text-xs text-muted-foreground bg-muted rounded-md"
                    data-testid="text-att-blocked"
                  >
                    <p>
                      Tracking is disabled in your iOS settings. To enable
                      analytics, allow tracking in{" "}
                      <strong>
                        Settings &gt; Privacy &amp; Security &gt; Tracking
                      </strong>
                      .
                    </p>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-violet-500" />
                AI features
              </h4>
              <div className="pl-6 space-y-2 text-xs text-muted-foreground">
                <p>
                  Some tools use <strong>OpenAI</strong> (
                  <strong>gpt-4o-mini</strong>) to generate suggestions or
                  summaries from text you enter and related job or business
                  content in your account.
                </p>
                <p>
                  Details on what categories of information may be sent and how
                  OpenAI fits into our processing are in the{" "}
                  <a
                    href="/privacy#ai-third-parties"
                    className="underline text-foreground"
                  >
                    Privacy Policy (OpenAI)
                  </a>
                  .
                </p>
              </div>
            </div>

            {isAuthenticated && (
              <>
                <Separator />

                <div className="space-y-4">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <Lock className="h-4 w-4 text-slate-500" />
                    Account & Security
                  </h4>
                  <div className="pl-6 space-y-4">
                    {isEmailPasswordUser() && <ChangePasswordDialog />}

                    {deleteError && (
                      <div
                        className="p-3 text-sm text-destructive bg-destructive/10 rounded-md"
                        data-testid="text-delete-error"
                      >
                        {deleteError}
                      </div>
                    )}
                    <AlertDialog
                      open={showDeleteDialog}
                      onOpenChange={(open) => {
                        if (!open) resetDeleteDialog();
                        else setShowDeleteDialog(true);
                      }}
                    >
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="destructive"
                          className="w-full"
                          data-testid="button-delete-account"
                        >
                          Delete account
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent
                        className="w-[calc(100%-1rem)] sm:w-full max-h-[85vh] overflow-hidden"
                        data-testid="dialog-delete-account"
                        style={
                          deleteKeyboardInset > 0
                            ? {
                                top: "auto",
                                bottom: `calc(${deleteKeyboardInset}px + 1rem + env(safe-area-inset-bottom, 0px))`,
                                transform: "translateX(-50%)",
                                maxHeight: `calc(100dvh - ${deleteKeyboardInset}px - 2rem - env(safe-area-inset-bottom, 0px))`,
                              }
                            : undefined
                        }
                      >
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Delete your account?
                          </AlertDialogTitle>
                          <AlertDialogDescription asChild>
                            <div
                              className="min-h-0 overflow-y-auto pr-1 space-y-3"
                              style={{
                                maxHeight:
                                  deleteKeyboardInset > 0
                                    ? `calc(100dvh - ${deleteKeyboardInset}px - 14rem)`
                                    : "52vh",
                              }}
                            >
                              <p>
                                This action is <strong>permanent</strong> and
                                cannot be undone. All of the following will be
                                deleted:
                              </p>
                              <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                                <li>Your profile and personal information</li>
                                <li>All jobs, leads, and clients</li>
                                <li>Invoices and payment records</li>
                                <li>Booking requests and reviews</li>
                                <li>Voice notes and photos</li>
                                <li>Crew memberships and messages</li>
                                <li>Stripe payment connections</li>
                                <li>All analytics and tracking data</li>
                                <li>
                                  Referrals, templates, and automation rules
                                </li>
                              </ul>
                              <p className="text-sm">
                                Type <strong>DELETE</strong> below to confirm:
                              </p>
                              <Input
                                data-testid="input-delete-confirm"
                                placeholder="Type DELETE to confirm"
                                value={deleteConfirmText}
                                onChange={(e) =>
                                  setDeleteConfirmText(e.target.value)
                                }
                                autoComplete="off"
                                disabled={isDeleting}
                              />
                              {deleteError && (
                                <p className="text-sm text-destructive">
                                  {deleteError}
                                </p>
                              )}
                            </div>
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel
                            data-testid="button-cancel-delete"
                            disabled={isDeleting}
                          >
                            Cancel
                          </AlertDialogCancel>
                          <Button
                            variant="destructive"
                            onClick={handleDeleteAccount}
                            disabled={isDeleting || !isDeleteConfirmValid}
                            data-testid="button-confirm-delete"
                          >
                            {isDeleting ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : null}
                            Permanently delete account
                          </Button>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>

                <Separator />

                {/* Data Export */}
                <div className="space-y-3">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <Download className="h-4 w-4 text-blue-500" />
                    Export Data
                  </h4>
                  <button
                    onClick={() =>
                      handleAuthenticatedDownload(
                        "/api/export/json",
                        `gigaid-export-${new Date().toISOString().split("T")[0]}.json`,
                      )
                    }
                    className="block w-full text-left"
                    data-testid="button-download-json"
                  >
                    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg hover-elevate cursor-pointer">
                      <FileJson className="h-5 w-5 text-blue-500" />
                      <div className="flex-1">
                        <p className="font-medium text-sm">Download JSON</p>
                        <p className="text-xs text-muted-foreground">
                          Complete data export
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </button>
                  <button
                    onClick={() =>
                      handleAuthenticatedDownload(
                        "/api/export/dot",
                        `gigaid-graph-${new Date().toISOString().split("T")[0]}.dot`,
                      )
                    }
                    className="block w-full text-left"
                    data-testid="button-download-dot"
                  >
                    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg hover-elevate cursor-pointer">
                      <Share className="h-5 w-5 text-purple-500" />
                      <div className="flex-1">
                        <p className="font-medium text-sm">
                          Download DOT Graph
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Data relationships (GraphViz)
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>
        </SettingsSectionAccordion>

        {/* Save Button */}
        <Button
          onClick={handleSave}
          className="w-full"
          size="lg"
          disabled={updateMutation.isPending}
          data-testid="button-save-settings"
        >
          {updateMutation.isPending ? (
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
          ) : null}
          Save Settings
        </Button>
      </div>
    </div>
  );
}
