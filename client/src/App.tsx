import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ResponsiveLayout } from "@/components/layout/ResponsiveLayout";
import { VoiceFAB } from "@/components/layout/VoiceFAB";
import { ActivationGate } from "@/components/ActivationGate";
import { PostHogProvider } from "@/components/PostHogProvider";
import { DriveModeProvider } from "@/components/drivemode/DriveModeProvider";
import { OptimisticCapabilityProvider, useOptimisticCapability } from "@/contexts/OptimisticCapabilityContext";
import { FirebaseAuthProvider, useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { useEffect, type ReactNode } from "react";
import { getPlatform } from "@/lib/platform";
import { useAuth } from "@/hooks/use-auth";
import { useSubscriptionRestore } from "@/hooks/useSubscriptionRestore";
import SplashPage from "@/pages/SplashPage";
import ForceLogout from "@/pages/force-logout";

import TodaysGamePlanPage from "@/pages/TodaysGamePlanPage";
import Dashboard from "@/pages/Dashboard";
import Jobs from "@/pages/Jobs";
import JobForm from "@/pages/JobForm";
import JobSummary from "@/pages/JobSummary";
import Leads from "@/pages/Leads";
import LeadForm from "@/pages/LeadForm";
import LeadSummary from "@/pages/LeadSummary";
import Invoices from "@/pages/Invoices";
import InvoiceForm from "@/pages/InvoiceForm";
import InvoiceView from "@/pages/InvoiceView";
import Reminders from "@/pages/Reminders";
import Crew from "@/pages/Crew";
import Settings from "@/pages/Settings";
import More from "@/pages/More";
import Profile from "@/pages/Profile";
import Reviews from "@/pages/Reviews";
import Referrals from "@/pages/Referrals";
import HelpSupport from "@/pages/HelpSupport";
import UserGuides from "@/pages/UserGuides";
import AITools from "@/pages/AITools";
import PublicBooking from "@/pages/PublicBooking";
import FirstBookingPage from "@/pages/FirstBookingPage";
import FreeSetup from "@/pages/FreeSetup";
import InvoiceRating from "@/pages/InvoiceRating";
import CrewPortal from "@/pages/CrewPortal";
import CustomerBookingDetail from "@/pages/CustomerBookingDetail";
import BookingRequests from "@/pages/BookingRequests";
import PublicInvoice from "@/pages/PublicInvoice";
import ConfirmPrice from "@/pages/ConfirmPrice";
import PayDeposit from "@/pages/PayDeposit";
import OwnerView from "@/pages/OwnerView";
import ShareCapture from "@/pages/ShareCapture";
import PublicReview from "@/pages/PublicReview";
import QuickBook from "@/pages/QuickBook";
import QuickBookConfirm from "@/pages/QuickBookConfirm";
import NotifyClientsPage from "@/pages/NotifyClientsPage";
import MoneyPlanPage from "@/pages/MoneyPlanPage";
import ProPlusContext from "@/pages/ProPlusContext";
import Messages from "@/pages/Messages";
import AdminCockpit from "@/pages/AdminCockpit";
import AdminUsers from "@/pages/AdminUsers";
import AdminUserDetail from "@/pages/AdminUserDetail";
import AdminSystemHealth from "@/pages/AdminSystemHealth";
import AdminSmsHealth from "@/pages/AdminSmsHealth";
import AdminAuditLogs from "@/pages/AdminAuditLogs";
import AdminAnalytics from "@/pages/AdminAnalytics";
import AdminCustomerIO from "@/pages/AdminCustomerIO";
import AdminBilling from "@/pages/AdminBilling";
import AdminStripeMonitoring from "@/pages/AdminStripeMonitoring";
import AdminChurnRetention from "@/pages/AdminChurnRetention";
import AdminGrowth from "@/pages/AdminGrowth";
import { AdminLayout } from "@/components/layout/AdminLayout";
import VoiceNotesPage from "@/pages/VoiceNotesPage";
import TermsOfService from "@/pages/terms";
import PrivacyPolicy from "@/pages/privacy";
import OnboardingPage from "@/pages/OnboardingPage";
import PaydayOnboarding from "@/pages/PaydayOnboarding";
import PricingPage from "@/pages/PricingPage";
import Downloads from "@/pages/Downloads";
import FollowUpSettingsPage from "@/pages/FollowUpSettingsPage";
import AutoQuotePage from "@/pages/AutoQuotePage";
import PriceOptimizationPage from "@/pages/PriceOptimizationPage";
import ProfitWarningsPage from "@/pages/ProfitWarningsPage";
import ViewAllStats from "@/pages/ViewAllStats";
import NotFound from "@/pages/not-found";
import E2ENbaHarness from "@/pages/E2ENbaHarness";
import { AppErrorBoundary } from "@/components/ErrorBoundary";
import { logClientEnv } from "./debug/envProbe";
import { logger } from "@/lib/logger";
import { registerNativeDeepLinkHandler } from "@/lib/nativeDeepLink";

logClientEnv();

function Router() {
  return (
    <Switch>
      <Route path="/dashboard" component={TodaysGamePlanPage} />
      <Route path="/dashboard-overview" component={Dashboard} />
      <Route path="/jobs" component={Jobs} />
      <Route path="/jobs/new" component={JobForm} />
      <Route path="/jobs/:id" component={JobSummary} />
      <Route path="/jobs/:id/edit" component={JobForm} />
      <Route path="/leads" component={Leads} />
      <Route path="/leads/new" component={LeadForm} />
      <Route path="/leads/:id" component={LeadSummary} />
      <Route path="/leads/:id/edit" component={LeadForm} />
      <Route path="/invoices" component={Invoices} />
      <Route path="/invoices/new" component={InvoiceForm} />
      <Route path="/invoices/:id/edit" component={InvoiceForm} />
      <Route path="/invoices/:id/view" component={InvoiceView} />
      <Route path="/invoices/:id" component={InvoiceView} />
      <Route path="/reminders" component={Reminders} />
      <Route path="/crew" component={Crew} />
      <Route path="/settings" component={Settings} />
      <Route path="/more" component={More} />
      <Route path="/profile" component={Profile} />
      <Route path="/reviews" component={Reviews} />
      <Route path="/referrals" component={Referrals} />
      <Route path="/help" component={HelpSupport} />
      <Route path="/guides" component={UserGuides} />
      <Route path="/ai-tools" component={AITools} />
      <Route path="/follow-up-settings" component={FollowUpSettingsPage} />
      <Route path="/auto-quote" component={AutoQuotePage} />
      <Route path="/price-optimization" component={PriceOptimizationPage} />
      <Route path="/profit-warnings" component={ProfitWarningsPage} />
      <Route path="/view-all-stats" component={ViewAllStats} />
      <Route path="/voice-notes" component={VoiceNotesPage} />
      <Route path="/booking-requests" component={BookingRequests} />
      <Route path="/share" component={ShareCapture} />
      <Route path="/quickbook" component={QuickBook} />
      <Route path="/money-plan" component={MoneyPlanPage} />
      <Route path="/pro-plus-context" component={ProPlusContext} />
      <Route path="/messages" component={Messages} />
      <Route path="/notify-clients" component={NotifyClientsPage} />
      <Route path="/owner" component={OwnerView} />
      <Route path="/pricing" component={PricingPage} />
      <Route path="/downloads" component={Downloads} />
      <Route path="/admin/cockpit" component={AdminCockpit} />
      <Route path="/admin/users" component={AdminUsers} />
      <Route path="/admin/users/:userId" component={AdminUserDetail} />
      <Route path="/admin/system" component={AdminSystemHealth} />
      <Route path="/admin/sms" component={AdminSmsHealth} />
      <Route path="/admin/audit-logs" component={AdminAuditLogs} />
      <Route path="/admin/analytics" component={AdminAnalytics} />
      <Route path="/admin/customerio" component={AdminCustomerIO} />
      <Route path="/admin/billing" component={AdminBilling} />
      <Route path="/admin/stripe" component={AdminStripeMonitoring} />
      <Route path="/admin/churn" component={AdminChurnRetention} />
      <Route path="/admin/growth" component={AdminGrowth} />
      <Route path="/onboarding/:step" component={OnboardingPage} />
      <Route path="/onboarding" component={OnboardingPage} />
      <Route path="/payday-onboarding" component={PaydayOnboarding} />
      <Route component={NotFound} />
    </Switch>
  );
}

function ThemeInitializer() {
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const platform = getPlatform();
    if (platform === 'android') {
      document.documentElement.style.setProperty('--safe-area-inset-top', '28px');
    } else if (platform === 'ios') {
      document.documentElement.style.setProperty('--safe-area-inset-top', '0px');
    }
  }, []);
  
  return null;
}

function SubscriptionHandler() {
  const { grantOptimisticCapability } = useOptimisticCapability();
  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const subscriptionStatus = params.get('subscription');
    
    if (subscriptionStatus === 'success') {
      grantOptimisticCapability("deposit_enforcement", 15000);
      
      queryClient.invalidateQueries({ queryKey: ['/api/profile'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('subscription');
      window.history.replaceState({}, '', newUrl.toString());
      
      logger.info('[Subscription] Payment successful - profile cache invalidated, optimistic capability granted');
    }
  }, [grantOptimisticCapability]);
  
  return null;
}

/**
 * Registers native deep link handling at the default route so launch URLs
 * are processed as soon as the app loads (cold start from Stripe return).
 * Wraps AuthenticatedApp so we do not depend on auth state to handle the link.
 */
function NativeDeepLinkHandler({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  useEffect(() => {
    return registerNativeDeepLinkHandler((path) => setLocation(path));
  }, [setLocation]);
  return <>{children}</>;
}

function AuthenticatedApp() {
  const [location, setLocation] = useLocation();
  const { firebaseUser, authLoading, lastAuthEventTs, callbackCount, isTokenReady } = useFirebaseAuth();
  const { user } = useAuth();
  useSubscriptionRestore(user);
  
  // CRITICAL: Block ALL routing decisions until Firebase auth state is resolved
  // No redirects, no rendering decisions until authLoading === false
  if (authLoading) {
    logger.debug("[AuthenticatedApp] authLoading === true, blocking all routing");
    logger.debug("[AuthenticatedApp] lastAuthEventTs:", lastAuthEventTs, "callbackCount:", callbackCount);
    
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }
  
  // authLoading === false: Firebase has definitively resolved auth state
  // Auth state resolved
  
  // Unauthenticated users see SplashPage (which has login UI)
  if (!firebaseUser) {
    return <SplashPage />;
  }

  // Firebase session alone is not enough: require app JWT from /api/auth/web/firebase.
  // Otherwise deleted or blocked accounts still reach the dashboard with a live Firebase user.
  if (!isTokenReady) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-2 bg-background px-4">
        <div className="animate-pulse text-muted-foreground text-center">Signing you in…</div>
        <p className="text-xs text-muted-foreground text-center max-w-sm">
          If this takes too long, refresh the page or try signing in again.
        </p>
      </div>
    );
  }
  
  // Authenticated users: redirect from "/" or "/welcome" to dashboard
  // This redirect is safe because authLoading === false
  if (location === "/" || location === "/welcome") {
    // Use useEffect pattern to avoid render-time navigation
    return <RedirectToDashboard />;
  }
  
  // Onboarding page renders full-screen without app shell
  const isOnboardingRoute = location.startsWith("/onboarding") || location.startsWith("/payday-onboarding");
  // Admin pages have their own layout without the user sidebar
  const isAdminRoute = location.startsWith("/admin");
  
  // Show app for authenticated users
  return (
    <DriveModeProvider>
      {isOnboardingRoute ? (
        <Router />
      ) : isAdminRoute ? (
        <AdminLayout>
          <Router />
        </AdminLayout>
      ) : (
        <ActivationGate>
          <ResponsiveLayout>
            <Router />
          </ResponsiveLayout>
          <VoiceFAB />
        </ActivationGate>
      )}
    </DriveModeProvider>
  );
}

function RedirectToDashboard() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation("/dashboard");
  }, [setLocation]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading...</div>
    </div>
  );
}

function App() {
  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <FirebaseAuthProvider>
          <PostHogProvider>
            <OptimisticCapabilityProvider>
              <TooltipProvider>
                <ThemeInitializer />
                <SubscriptionHandler />
                <div className="min-h-screen safe-area-top bg-background">
                <Switch>
                <Route path="/free-setup" component={FreeSetup} />
                <Route path="/book/:slug" component={PublicBooking} />
                <Route path="/first-booking/:pageId" component={FirstBookingPage} />
                <Route path="/booking/:token" component={CustomerBookingDetail} />
                <Route path="/invoice/:token" component={PublicInvoice} />
                <Route path="/invoice/:id/rate" component={InvoiceRating} />
                <Route path="/confirm-price/:token" component={ConfirmPrice} />
                <Route path="/pay-deposit/:token" component={PayDeposit} />
                <Route path="/crew-portal/:token" component={CrewPortal} />
                <Route path="/review/:token" component={PublicReview} />
                <Route path="/qb/:token" component={QuickBookConfirm} />
                <Route path="/terms" component={TermsOfService} />
                <Route path="/privacy" component={PrivacyPolicy} />
                <Route path="/support" component={HelpSupport} />
                <Route path="/downloads" component={Downloads} />
                {/* /login redirects to home which shows the combined splash/login page */}
                <Route path="/login" component={SplashPage} />
                <Route path="/force-logout" component={ForceLogout} />
                {import.meta.env.DEV && (
                  <Route path="/_e2e/nba" component={E2ENbaHarness} />
                )}
                <Route>
                  <NativeDeepLinkHandler>
                    <AuthenticatedApp />
                  </NativeDeepLinkHandler>
                </Route>
                </Switch>
                <Toaster />
                </div>
              </TooltipProvider>
            </OptimisticCapabilityProvider>
          </PostHogProvider>
        </FirebaseAuthProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}

export default App;
