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
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import SplashPage from "@/pages/SplashPage";
import LandingPage from "@/pages/LandingPage";

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
      <Route path="/admin/cockpit" component={AdminCockpit} />
      <Route path="/admin/users" component={AdminUsers} />
      <Route path="/admin/users/:userId" component={AdminUserDetail} />
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

function AuthenticatedApp() {
  const [location, setLocation] = useLocation();
  const { isAuthenticated, isLoading } = useAuth();
  
  useEffect(() => {
    // Redirect authenticated users from "/" or "/welcome" 
    if (isAuthenticated && !isLoading) {
      if (location === "/" || location === "/welcome") {
        const splashSeen = localStorage.getItem('gigaid_splash_seen');
        if (splashSeen) {
          setLocation('/dashboard');
        }
      }
    }
  }, [isAuthenticated, isLoading, location, setLocation]);
  
  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }
  
  // Show landing page for unauthenticated users
  if (!isAuthenticated) {
    return <LandingPage />;
  }
  
  // Handle "/" and "/welcome" routes for authenticated users
  if (location === "/" || location === "/welcome") {
    return <SplashPage />;
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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
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
            <Route>
              <AuthenticatedApp />
            </Route>
            </Switch>
            <Toaster />
          </TooltipProvider>
        </OptimisticCapabilityProvider>
      </PostHogProvider>
    </QueryClientProvider>
  );
}

export default App;
