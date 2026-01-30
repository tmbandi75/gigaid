import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { COACHING_MESSAGES, Screen, AppState, Placement } from './coachingMessages';
import { useCoachingState } from './useCoachingState';

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
  leads: number;
  jobs: number;
  invoices: number;
  revenue: number;
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
      count: dashboard?.jobs ?? 0,
      completedCount: jobs?.filter(j => j.status === 'completed').length ?? 0
    },
    leads: { count: dashboard?.leads ?? 0 },
    invoices: { 
      count: dashboard?.invoices ?? 0,
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
    if (message) {
      markSeen(message.id);
      trackEvent('coaching_message_shown', {
        id: message.id,
        screen: message.screen,
        placement: message.placement
      });
    }
  }, [message?.id, markSeen]);

  if (isLoading || !message) return null;

  return (
    <p 
      className="text-sm text-muted-foreground leading-relaxed mt-1"
      data-testid={`coaching-${message.id}`}
    >
      {message.text}
    </p>
  );
}
