import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { VoiceFAB } from "@/components/layout/VoiceFAB";
import { useEffect } from "react";

import Dashboard from "@/pages/Dashboard";
import Jobs from "@/pages/Jobs";
import JobForm from "@/pages/JobForm";
import Leads from "@/pages/Leads";
import LeadForm from "@/pages/LeadForm";
import Invoices from "@/pages/Invoices";
import InvoiceForm from "@/pages/InvoiceForm";
import Reminders from "@/pages/Reminders";
import Crew from "@/pages/Crew";
import Settings from "@/pages/Settings";
import More from "@/pages/More";
import Profile from "@/pages/Profile";
import PublicBooking from "@/pages/PublicBooking";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/jobs" component={Jobs} />
      <Route path="/jobs/new" component={JobForm} />
      <Route path="/jobs/:id" component={JobForm} />
      <Route path="/leads" component={Leads} />
      <Route path="/leads/new" component={LeadForm} />
      <Route path="/leads/:id" component={LeadForm} />
      <Route path="/invoices" component={Invoices} />
      <Route path="/invoices/new" component={InvoiceForm} />
      <Route path="/invoices/:id" component={InvoiceForm} />
      <Route path="/reminders" component={Reminders} />
      <Route path="/crew" component={Crew} />
      <Route path="/settings" component={Settings} />
      <Route path="/more" component={More} />
      <Route path="/profile" component={Profile} />
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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeInitializer />
        <Switch>
          <Route path="/book/:slug" component={PublicBooking} />
          <Route>
            <MobileLayout>
              <Router />
            </MobileLayout>
            <VoiceFAB />
          </Route>
        </Switch>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
