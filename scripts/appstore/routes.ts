export interface RouteConfig {
  name: string;
  path: string;
  headline: [string, string];
  subheadline?: string;
  highlightSelector: string;
  phonePlacement: {
    rotation: number;
    scale: number;
    offsetX: number;
    offsetY: number;
  };
  backgroundPreset: "bg1" | "bg2" | "bg3" | "bg4";
  accentWord: string;
}

export const ROUTES: RouteConfig[] = [
  {
    name: "hero",
    path: "/dashboard",
    headline: ["RUN YOUR BUSINESS", "FROM ONE APP"],
    subheadline: "Booking \u2022 Invoicing \u2022 Payments \u2022 Clients",
    highlightSelector: '[data-testid="page-game-plan"]',
    phonePlacement: { rotation: -3, scale: 0.82, offsetX: 0, offsetY: 30 },
    backgroundPreset: "bg1",
    accentWord: "BUSINESS",
  },
  {
    name: "booking",
    path: "/book/gig-worker",
    headline: ["CLIENTS BOOK YOU", "AUTOMATICALLY"],
    highlightSelector: ".booking-page, main",
    phonePlacement: { rotation: 3, scale: 0.80, offsetX: 20, offsetY: 20 },
    backgroundPreset: "bg2",
    accentWord: "BOOK",
  },
  {
    name: "payments",
    path: "/invoices",
    headline: ["INVOICE & GET PAID", "INSTANTLY"],
    highlightSelector: '[data-testid="page-invoices"]',
    phonePlacement: { rotation: -2, scale: 0.82, offsetX: -15, offsetY: 25 },
    backgroundPreset: "bg3",
    accentWord: "PAID",
  },
  {
    name: "jobs",
    path: "/jobs",
    headline: ["NEVER LOSE TRACK", "OF JOBS"],
    highlightSelector: '[data-testid="page-jobs"]',
    phonePlacement: { rotation: 2, scale: 0.80, offsetX: 10, offsetY: 30 },
    backgroundPreset: "bg4",
    accentWord: "TRACK",
  },
  {
    name: "ai",
    path: "/ai-tools",
    headline: ["AI KEEPS YOU", "ON TRACK"],
    subheadline: "Smart reminders & follow-ups",
    highlightSelector: '[data-testid="page-ai-tools"], main',
    phonePlacement: { rotation: -3, scale: 0.82, offsetX: -10, offsetY: 20 },
    backgroundPreset: "bg1",
    accentWord: "AI",
  },
  {
    name: "clients",
    path: "/leads",
    headline: ["EVERY CUSTOMER.", "ONE PLACE."],
    highlightSelector: '[data-testid="page-leads"]',
    phonePlacement: { rotation: 2, scale: 0.80, offsetX: 15, offsetY: 25 },
    backgroundPreset: "bg2",
    accentWord: "CUSTOMER",
  },
  {
    name: "overview",
    path: "/more",
    headline: ["GROW WITHOUT", "THE CHAOS"],
    highlightSelector: '[data-testid="page-more"], main',
    phonePlacement: { rotation: -2, scale: 0.82, offsetX: 0, offsetY: 30 },
    backgroundPreset: "bg3",
    accentWord: "GROW",
  },
];
