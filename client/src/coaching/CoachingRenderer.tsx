import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { COACHING_MESSAGES, Screen, AppState, Placement } from './coachingMessages';
import { useCoachingState } from './useCoachingState';
import { Lightbulb } from 'lucide-react';

function trackEvent(eventName: string, properties?: Record<string, unknown>) {
  if (typeof window !== 'undefined' && (window as { posthog?: { capture: (event: string, props?: Record<string, unknown>) => void } }).posthog) {
    (window as { posthog?: { capture: (event: string, props?: Record<string, unknown>) => void } }).posthog?.capture(eventName, properties);
  }
}

interface CoachingRendererProps {
  screen: Screen;
  placement?: Placement;
}

interface DashboardSummary {
  totalLeads: number;
  totalJobs: number;
  totalEarnings: number;
}

interface Profile {
  services: string[] | null;
  bookingLinkShared?: boolean;
}

interface OnboardingStatus {
  step: number;
  completed: boolean;
  state?: string;
}

export function CoachingRenderer({ screen, placement = 'header' }: CoachingRendererProps) {
  const { hasSeen, markSeen } = useCoachingState();
  const [displayedMessage, setDisplayedMessage] = useState<string | null>(null);
  const markedRef = useRef<Set<string>>(new Set());

  const { data: dashboard, isLoading: dashboardLoading } = useQuery<DashboardSummary>({
    queryKey: ['/api/dashboard/summary'],
  });

  const { data: profile, isLoading: profileLoading } = useQuery<Profile>({
    queryKey: ['/api/profile'],
  });

  const { data: onboarding } = useQuery<OnboardingStatus>({
    queryKey: ['/api/onboarding'],
  });

  const { data: jobs, isLoading: jobsLoading } = useQuery<{ status: string }[]>({
    queryKey: ['/api/jobs'],
  });

  const { data: invoices, isLoading: invoicesLoading } = useQuery<{ status: string }[]>({
    queryKey: ['/api/invoices'],
  });

  const isLoading = dashboardLoading || profileLoading || jobsLoading || invoicesLoading;

  const appState: AppState = {
    services: { count: profile?.services?.length ?? 0 },
    jobs: { 
      count: dashboard?.totalJobs ?? 0,
      completedCount: jobs?.filter(j => j.status === 'completed').length ?? 0
    },
    leads: { count: dashboard?.totalLeads ?? 0 },
    invoices: { 
      count: invoices?.length ?? 0,
      sentCount: invoices?.filter(i => i.status === 'sent' || i.status === 'paid').length ?? 0
    },
    messages: { count: 0 },
    bookingLinkShared: profile?.bookingLinkShared ?? (onboarding?.step ?? 0) >= 3
  };

  const message = !isLoading ? COACHING_MESSAGES.find(
    m =>
      m.screen === screen &&
      m.placement === placement &&
      m.condition(appState) &&
      (!m.once || !hasSeen(m.id))
  ) : null;

  useEffect(() => {
    if (message && !markedRef.current.has(message.id)) {
      setDisplayedMessage(message.id);
      markedRef.current.add(message.id);
      
      const timer = setTimeout(() => {
        markSeen(message.id);
        trackEvent('coaching_message_shown', {
          id: message.id,
          screen: message.screen,
          placement: message.placement
        });
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [message?.id, markSeen]);

  const messageToShow = displayedMessage 
    ? COACHING_MESSAGES.find(m => m.id === displayedMessage) 
    : message;

  if (isLoading || !messageToShow) return null;

  return (
    <div 
      className="flex items-start gap-2 mt-3 p-3 bg-amber-50 dark:bg-amber-950/30 border-l-2 border-amber-400 rounded-r-md"
      data-testid={`coaching-${messageToShow.id}`}
    >
      <Lightbulb className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
      <p className="text-sm text-amber-800 dark:text-amber-200 leading-relaxed">
        {messageToShow.text}
      </p>
    </div>
  );
}
