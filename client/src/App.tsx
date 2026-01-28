import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ResponsiveLayout } from "@/components/layout/ResponsiveLayout";
import { VoiceFAB } from "@/components/layout/VoiceFAB";
import { OnboardingWrapper } from "@/components/onboarding/OnboardingWrapper";
import { PostHogProvider } from "@/components/PostHogProvider";
import { DriveModeProvider } from "@/components/drivemode/DriveModeProvider";
import { OptimisticCapabilityProvider, useOptimisticCapability } from "@/contexts/OptimisticCapabilityContext";
import { FirebaseAuthProvider, useFirebaseAuth } from "@/contexts/FirebaseAuthContext";
import { useEffect, useState } from "react";
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
import VoiceNotesPage from "@/pages/VoiceNotesPage";
import TermsOfService from "@/pages/terms";
import PrivacyPolicy from "@/pages/privacy";
import OnboardingPage from "@/pages/OnboardingPage";
import PricingPage from "@/pages/PricingPage";
import Downloads from "@/pages/Downloads";
import NotFound from "@/pages/not-found";

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
      <Route path="/onboarding/:step" component={OnboardingPage} />
      <Route path="/onboarding" component={OnboardingPage} />
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
      
      console.log('[Subscription] Payment successful - profile cache invalidated, optimistic capability granted');
    }
  }, [grantOptimisticCapability]);
  
  return null;
}

// Auth Gate Diagnostics Panel - DEV ONLY
function AuthDiagnosticsPanel() {
  const { firebaseUser, authLoading, lastAuthEventTs, callbackCount } = useFirebaseAuth();
  const [currentTime, setCurrentTime] = useState(Date.now());
  
  // Update current time every second to show time since last event
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);
  
  // Get additional state from useAuth if available
  let apiUserInfo = "N/A";
  let apiUserLoading = "N/A";
  let isLoggingOut = "N/A";
  let hasAppJwtToken = "N/A";
  
  try {
    // Check for app JWT token
    const token = localStorage.getItem("gigaid_app_jwt");
    hasAppJwtToken = token ? "true" : "false";
  } catch (e) {
    hasAppJwtToken = "error";
  }
  
  // Check global logout flag
  try {
    const { getGlobalLoggingOut } = require("@/lib/queryClient");
    isLoggingOut = getGlobalLoggingOut() ? "true" : "false";
  } catch (e) {
    isLoggingOut = "error";
  }
  
  const timeSinceLastEvent = lastAuthEventTs ? Math.round((currentTime - lastAuthEventTs) / 1000) : null;
  
  return (
    <div 
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        background: "rgba(0,0,0,0.9)",
        color: "#00ff00",
        fontFamily: "monospace",
        fontSize: "12px",
        padding: "12px",
        zIndex: 99999,
        maxHeight: "50vh",
        overflow: "auto"
      }}
      data-testid="auth-diagnostics-panel"
    >
      <div style={{ fontWeight: "bold", marginBottom: "8px", color: "#ff6600" }}>
        AUTH GATE DIAGNOSTICS (DEV ONLY)
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          <tr>
            <td style={{ padding: "4px", borderBottom: "1px solid #333" }}>firebaseAuthLoading</td>
            <td style={{ padding: "4px", borderBottom: "1px solid #333", color: authLoading ? "#ff0000" : "#00ff00" }}>
              {authLoading ? "TRUE (BLOCKING)" : "false"}
            </td>
          </tr>
          <tr>
            <td style={{ padding: "4px", borderBottom: "1px solid #333" }}>firebaseUser</td>
            <td style={{ padding: "4px", borderBottom: "1px solid #333" }}>
              {firebaseUser ? `uid: ${firebaseUser.uid.slice(0,8)}... email: ${firebaseUser.email}` : "null"}
            </td>
          </tr>
          <tr>
            <td style={{ padding: "4px", borderBottom: "1px solid #333" }}>lastAuthEventTs</td>
            <td style={{ padding: "4px", borderBottom: "1px solid #333" }}>
              {lastAuthEventTs ? `${lastAuthEventTs} (${timeSinceLastEvent}s ago)` : "null (never fired)"}
            </td>
          </tr>
          <tr>
            <td style={{ padding: "4px", borderBottom: "1px solid #333" }}>callbackCount</td>
            <td style={{ padding: "4px", borderBottom: "1px solid #333" }}>
              {callbackCount}
            </td>
          </tr>
          <tr>
            <td style={{ padding: "4px", borderBottom: "1px solid #333" }}>hasAppJwtToken</td>
            <td style={{ padding: "4px", borderBottom: "1px solid #333" }}>
              {hasAppJwtToken}
            </td>
          </tr>
          <tr>
            <td style={{ padding: "4px", borderBottom: "1px solid #333" }}>globalLogoutInProgress</td>
            <td style={{ padding: "4px", borderBottom: "1px solid #333", color: isLoggingOut === "true" ? "#ff0000" : "#00ff00" }}>
              {isLoggingOut}
            </td>
          </tr>
          <tr>
            <td style={{ padding: "4px", borderBottom: "1px solid #333" }}>location.pathname</td>
            <td style={{ padding: "4px", borderBottom: "1px solid #333" }}>
              {window.location.pathname}
            </td>
          </tr>
          <tr>
            <td style={{ padding: "4px", borderBottom: "1px solid #333" }}>currentTime</td>
            <td style={{ padding: "4px", borderBottom: "1px solid #333" }}>
              {currentTime}
            </td>
          </tr>
        </tbody>
      </table>
      <div style={{ marginTop: "8px", color: "#888" }}>
        If firebaseAuthLoading is TRUE and callbackCount is 0, onAuthStateChanged never fired.
        If callbackCount {">"} 0 but authLoading is still TRUE, there is a state update bug.
      </div>
    </div>
  );
}

function AuthenticatedApp() {
  const [location, setLocation] = useLocation();
  const { firebaseUser, authLoading, lastAuthEventTs, callbackCount } = useFirebaseAuth();
  
  // CRITICAL: Block ALL routing decisions until Firebase auth state is resolved
  // No redirects, no rendering decisions until authLoading === false
  if (authLoading) {
    console.log("[AuthenticatedApp] authLoading === true, blocking all routing");
    console.log("[AuthenticatedApp] lastAuthEventTs:", lastAuthEventTs, "callbackCount:", callbackCount);
    
    // Show diagnostics panel in development
    const isDev = import.meta.env.DEV;
    
    return (
      <div className="min-h-screen flex items-center justify-center">
        {isDev && <AuthDiagnosticsPanel />}
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }
  
  // authLoading === false: Firebase has definitively resolved auth state
  console.log("[AuthenticatedApp] authLoading === false, firebaseUser:", firebaseUser?.email ?? "null");
  
  // Unauthenticated users see SplashPage (which has login UI)
  if (!firebaseUser) {
    return <SplashPage />;
  }
  
  // Authenticated users: redirect from "/" or "/welcome" to dashboard
  // This redirect is safe because authLoading === false
  if (location === "/" || location === "/welcome") {
    // Use useEffect pattern to avoid render-time navigation
    return <RedirectToDashboard />;
  }
  
  // Show app for authenticated users
  return (
    <DriveModeProvider>
      <OnboardingWrapper>
        <ResponsiveLayout>
          <Router />
        </ResponsiveLayout>
        <VoiceFAB />
      </OnboardingWrapper>
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
    <QueryClientProvider client={queryClient}>
      <FirebaseAuthProvider>
        <PostHogProvider>
          <OptimisticCapabilityProvider>
            <TooltipProvider>
              <ThemeInitializer />
              <SubscriptionHandler />
              <Switch>
              <Route path="/book/:slug" component={PublicBooking} />
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
              <Route path="/downloads" component={Downloads} />
              {/* /login redirects to home which shows the combined splash/login page */}
              <Route path="/login" component={SplashPage} />
              <Route path="/force-logout" component={ForceLogout} />
              <Route>
                <AuthenticatedApp />
              </Route>
              </Switch>
              <Toaster />
            </TooltipProvider>
          </OptimisticCapabilityProvider>
        </PostHogProvider>
      </FirebaseAuthProvider>
    </QueryClientProvider>
  );
}

export default App;
