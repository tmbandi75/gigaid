export type Screen = 'dashboard' | 'jobs' | 'leads' | 'invoices' | 'tools' | 'messages';

export type Placement = 'header' | 'empty_state' | 'inline' | 'toast' | 'tooltip';

export interface AppState {
  services: { count: number };
  jobs: { count: number; completedCount: number };
  leads: { count: number };
  invoices: { count: number; sentCount: number };
  messages: { count: number };
  bookingLinkShared: boolean;
}

export interface CoachingMessage {
  id: string;
  screen: Screen;
  placement: Placement;
  text: string;
  condition: (state: AppState) => boolean;
  once: boolean;
}

export const COACHING_MESSAGES: CoachingMessage[] = [
  {
    id: 'dashboard_add_service',
    screen: 'dashboard',
    placement: 'header',
    text: 'Most solo pros get their first booking after adding just one service.',
    condition: (s) => s.services.count === 0,
    once: true
  },
  {
    id: 'dashboard_share_link',
    screen: 'dashboard',
    placement: 'header',
    text: 'Your booking link is your fastest path to your first job — most pros share it by text.',
    condition: (s) => s.services.count > 0 && s.jobs.count === 0 && !s.bookingLinkShared,
    once: true
  },
  {
    id: 'dashboard_first_job_congrats',
    screen: 'dashboard',
    placement: 'header',
    text: 'You got your first job — that is the hardest part. Keep the momentum going.',
    condition: (s) => s.jobs.count === 1,
    once: true
  },
  {
    id: 'jobs_empty',
    screen: 'jobs',
    placement: 'empty_state',
    text: 'Jobs usually start from booking links or messages. Add your first job to begin tracking your work and earnings.',
    condition: (s) => s.jobs.count === 0,
    once: true
  },
  {
    id: 'jobs_send_invoice_reminder',
    screen: 'jobs',
    placement: 'header',
    text: 'Completed jobs without invoices are money left on the table. Send invoices right after finishing.',
    condition: (s) => s.jobs.completedCount > 0 && s.invoices.sentCount === 0,
    once: true
  },
  {
    id: 'leads_empty',
    screen: 'leads',
    placement: 'empty_state',
    text: 'New leads often come from shared booking links or quick replies to messages.',
    condition: (s) => s.leads.count === 0,
    once: true
  },
  {
    id: 'leads_follow_up',
    screen: 'leads',
    placement: 'header',
    text: 'Following up within 24 hours doubles your chances of converting a lead.',
    condition: (s) => s.leads.count > 0 && s.jobs.count === 0,
    once: true
  },
  {
    id: 'invoices_empty',
    screen: 'invoices',
    placement: 'empty_state',
    text: 'Invoices help you get paid on time. Many pros send them right after finishing a job.',
    condition: (s) => s.invoices.count === 0,
    once: true
  },
  {
    id: 'invoices_get_paid_faster',
    screen: 'invoices',
    placement: 'header',
    text: 'Invoices sent the same day get paid 30% faster on average.',
    condition: (s) => s.invoices.count > 0 && s.invoices.sentCount === 0,
    once: true
  },
  {
    id: 'messages_empty',
    screen: 'messages',
    placement: 'empty_state',
    text: 'Messages with clients are tracked here. Quick responses build trust and win more jobs.',
    condition: (s) => s.messages.count === 0,
    once: true
  }
];
