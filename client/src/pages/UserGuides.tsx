import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  ArrowRight,
  Book,
  CheckCircle2,
  Circle,
  Zap,
  MessageCircle,
  FileText,
  CreditCard,
  Send,
  Star,
  LayoutDashboard,
  Users,
  Calendar,
  Share2,
  Smartphone,
  DollarSign,
  Clock,
  Target,
  Sparkles,
  ChevronRight,
  Copy,
  ExternalLink,
} from "lucide-react";

interface GuideStep {
  title: string;
  description: string;
  tip?: string;
}

interface Guide {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  duration: string;
  steps: GuideStep[];
}

const guides: Guide[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    description: "Set up your GigAid account and profile in minutes",
    icon: Zap,
    color: "from-violet-500 to-purple-500",
    duration: "5 min",
    steps: [
      {
        title: "Complete your profile",
        description: "Go to More > Profile and fill in your name, phone, email, and business name. Add a professional bio - you can use AI to enhance it!",
        tip: "A complete profile makes you look more professional to clients.",
      },
      {
        title: "Add your services",
        description: "In Settings, scroll to Services. Tap preset services like plumbing, electrical, or cleaning - or type your own custom service and tap + to add it.",
        tip: "Be specific! 'TV Mounting' is better than just 'Installation'.",
      },
      {
        title: "Set your availability",
        description: "Configure your working hours for each day of the week. This helps clients book during times you're actually available.",
        tip: "Leave buffer time between appointments for travel.",
      },
      {
        title: "Enable your booking page",
        description: "Toggle on 'Public Profile' in Settings. Set your URL slug (like 'mike-the-plumber') and share your booking link with clients!",
        tip: "Add your booking link to your Facebook profile and business cards.",
      },
    ],
  },
  {
    id: "facebook-to-paid",
    title: "Facebook to Paid Gig",
    description: "The complete workflow from marketplace post to getting paid",
    icon: Target,
    color: "from-pink-500 to-rose-500",
    duration: "10 min",
    steps: [
      {
        title: "Capture the lead (Quick Capture)",
        description: "When you see a job post on Facebook Marketplace, tap Share → GigAid (or copy the post and paste into GigAid). The AI automatically extracts the client's info, service needed, and source.",
        tip: "Speed matters! Respond within 5 minutes to dramatically increase your chances of winning the job.",
      },
      {
        title: "Send your first reply (Reply Composer)",
        description: "Open the lead you just created. Scroll to Reply Composer, select 'Quote' or 'Availability', add any notes, and tap Generate. Copy the AI-suggested reply and paste it back into Facebook Messenger.",
        tip: "The AI uses your profile to personalize replies. Keep your profile updated!",
      },
      {
        title: "Negotiate and agree on price",
        description: "As the conversation continues, use Reply Composer for follow-ups. When you agree on a price, you're ready for the next step.",
        tip: "Reply Composer handles quote, availability, follow-up, and details scenarios.",
      },
      {
        title: "Lock the price (Price Confirmation)",
        description: "Open the lead and tap 'Send Price Confirmation'. Enter the agreed price and any notes. Send it to the client - they'll receive a link to confirm.",
        tip: "A confirmed price is timestamped - no disputes about what was agreed!",
      },
      {
        title: "Collect a deposit (optional but powerful)",
        description: "If you have Stripe Connect set up, you can request a deposit to hold the appointment. The client pays via Apple Pay, Google Pay, or card.",
        tip: "Even a small deposit ($20-50) dramatically reduces no-shows.",
      },
      {
        title: "Client confirms → Job auto-created",
        description: "When the client taps 'Looks Good' on the confirmation link, GigAid automatically converts the lead to a job with all the details filled in.",
        tip: "The job shows the confirmed price and any deposit received.",
      },
      {
        title: "Send 'On The Way' notification",
        description: "When heading to the job, open it and tap 'On The Way'. The client gets an SMS letting them know you're coming. Professional and reduces anxiety!",
        tip: "Clients love this feature - it shows you're reliable.",
      },
      {
        title: "Complete the job and get paid",
        description: "After finishing the work, open the job and tap 'Get Paid'. Select how they paid (Cash, Zelle, Venmo, Card). If there was a deposit, it shows the breakdown automatically.",
        tip: "The dialog shows: Total - Deposit = Balance Due.",
      },
      {
        title: "Request a review",
        description: "After marking the job paid, you'll see an option to 'Request a Review'. Tap it to send the client a review link. They can rate you 1-5 stars and leave a comment.",
        tip: "Good reviews help you win more jobs. Make it easy for happy clients!",
      },
    ],
  },
  {
    id: "quick-capture",
    title: "Using Quick Capture",
    description: "Turn any message into a lead in seconds",
    icon: Share2,
    color: "from-cyan-500 to-blue-500",
    duration: "3 min",
    steps: [
      {
        title: "From Facebook or any app",
        description: "When you see a job post or receive a message, tap Share → GigAid. If Share isn't available, copy the text and paste it into the Quick Capture page in GigAid.",
        tip: "Works with Facebook, Craigslist, Nextdoor, texts, emails - anything!",
      },
      {
        title: "AI extracts the details",
        description: "GigAid's AI automatically finds: client name, phone number, email, service needed, and where the lead came from (source tracking).",
        tip: "Review the extracted info - AI is good but not perfect!",
      },
      {
        title: "Review and save",
        description: "Check the extracted information, adjust anything that's off, and tap Save. Your new lead appears in the Leads list immediately.",
        tip: "The source (Facebook, Craigslist, etc.) is saved automatically for analytics.",
      },
      {
        title: "Start the conversation",
        description: "Open your new lead and use Reply Composer to craft your first response. Copy it and paste it back to wherever the conversation started.",
        tip: "Quick Capture + Reply Composer = respond in under 60 seconds!",
      },
    ],
  },
  {
    id: "reply-composer",
    title: "Reply Composer Mastery",
    description: "Write professional responses with AI assistance",
    icon: MessageCircle,
    color: "from-indigo-500 to-violet-500",
    duration: "5 min",
    steps: [
      {
        title: "Open a lead",
        description: "From your Leads list, tap on any lead to open its detail page. Scroll down to find the Reply Composer section.",
        tip: "Reply Composer is available on every lead page.",
      },
      {
        title: "Choose your scenario",
        description: "Pick the type of reply you need: Quote (give pricing), Availability (share your schedule), Follow Up (check in after no response), or Details (answer questions about your services).",
        tip: "Each scenario generates a different style of response.",
      },
      {
        title: "Add context (optional)",
        description: "Type any additional notes in the text area - like a specific price, dates you're available, or details the client asked about. This helps the AI craft a better reply.",
        tip: "Example: '$150 for the job, available Saturday morning'",
      },
      {
        title: "Generate and review",
        description: "Tap 'Generate Reply'. The AI creates a professional response using your profile info and the context you provided. Read it and make any tweaks.",
        tip: "The AI uses your name, business name, and services from your profile.",
      },
      {
        title: "Copy and send",
        description: "Tap the Copy button to copy the reply. Switch to your messaging app (Facebook, text, etc.) and paste it. Done!",
        tip: "Edit the reply before sending if you want to add a personal touch.",
      },
    ],
  },
  {
    id: "price-confirmation",
    title: "Price Confirmation Flow",
    description: "Lock in prices and eliminate disputes",
    icon: FileText,
    color: "from-teal-500 to-emerald-500",
    duration: "4 min",
    steps: [
      {
        title: "When to send a Price Confirmation",
        description: "After negotiating with a client and agreeing on a price verbally, send a Price Confirmation to make it official. This creates a record both parties can reference.",
        tip: "Send it as soon as you agree - before either party forgets the terms!",
      },
      {
        title: "Create the confirmation",
        description: "Open the lead, scroll to Price Confirmation, and tap 'Send Price Confirmation'. Enter the agreed price and any notes (scope of work, included materials, etc.).",
        tip: "Be specific about what's included to avoid misunderstandings.",
      },
      {
        title: "Choose delivery method",
        description: "Send via SMS, email, or both. The client receives a link to view and confirm the price.",
        tip: "SMS has higher open rates than email for urgent confirmations.",
      },
      {
        title: "Track the status",
        description: "Check the status: Draft (not sent), Sent (waiting for response), Viewed (they opened it), Confirmed (approved!), or Expired.",
        tip: "If they viewed but didn't confirm, try a follow-up.",
      },
      {
        title: "Automatic job creation",
        description: "When the client taps 'Looks Good', the system automatically creates a job with all the details. The lead is marked as converted.",
        tip: "No double data entry - everything flows automatically!",
      },
    ],
  },
  {
    id: "deposits-payments",
    title: "Deposits & Getting Paid",
    description: "Collect deposits and record payments smoothly",
    icon: DollarSign,
    color: "from-green-500 to-emerald-500",
    duration: "6 min",
    steps: [
      {
        title: "Set up Stripe Connect",
        description: "Go to Settings > Stripe Connect and tap 'Connect with Stripe'. Follow the onboarding to enable payment collection. This is required for deposits.",
        tip: "Stripe handles all the payment security for you.",
      },
      {
        title: "Enable deposits for bookings",
        description: "In your booking settings, enable deposits. You can set a flat amount or percentage. Clients pay when confirming their appointment.",
        tip: "Even $20-30 deposits dramatically reduce no-shows.",
      },
      {
        title: "Deposits are held safely",
        description: "When a client pays a deposit, the money is held by Stripe until the job is complete. This protects both you and the customer.",
        tip: "You'll see 'Deposit: $X' on the job details page.",
      },
      {
        title: "Complete the job",
        description: "When you finish the work, open the job and tap 'Get Paid'. The dialog shows the total amount, deposit paid, and balance due.",
        tip: "Example: Total $150 - Deposit $30 = Balance Due $100.",
      },
      {
        title: "Record the payment",
        description: "Select how the client paid the balance: Cash, Zelle, Venmo, Check, or Card. Tap 'Mark as Paid' to record it.",
        tip: "This creates a payment record for your bookkeeping.",
      },
      {
        title: "Deposit is released",
        description: "After marking the job complete and paid, the held deposit is released to your Stripe account along with any platform fees.",
        tip: "Funds typically arrive in your bank within 2-3 business days.",
      },
    ],
  },
  {
    id: "on-the-way",
    title: "On The Way Notifications",
    description: "Let clients know you're coming",
    icon: Send,
    color: "from-orange-500 to-amber-500",
    duration: "2 min",
    steps: [
      {
        title: "Open the job you're heading to",
        description: "From your Jobs list or Dashboard, tap on the job you're about to head to.",
        tip: "The job must have a client phone number for SMS to work.",
      },
      {
        title: "Tap 'On The Way'",
        description: "Look for the 'On The Way' button on the job page. Tap it to send an instant notification to your client.",
        tip: "The button is usually near the top of the job detail page.",
      },
      {
        title: "Client receives SMS",
        description: "Your client gets a text message like: 'Mike from Pro Gig Services is on the way to your appointment.' Simple, professional, and reassuring.",
        tip: "Clients appreciate knowing you're coming - it reduces anxiety.",
      },
      {
        title: "Arrive and do great work",
        description: "When you arrive, the client is expecting you. No surprises, no waiting at the door wondering if you'll show up.",
        tip: "This small touch makes you stand out from other gig workers!",
      },
    ],
  },
  {
    id: "reviews",
    title: "Getting Reviews",
    description: "Build your reputation with client reviews",
    icon: Star,
    color: "from-yellow-500 to-orange-500",
    duration: "3 min",
    steps: [
      {
        title: "Complete the job and get paid",
        description: "First, finish the work and record the payment using the 'Get Paid' button. Reviews come after payment.",
        tip: "Happy clients are most likely to leave reviews right after great service.",
      },
      {
        title: "Request a review",
        description: "After marking the job paid, the success screen shows an option: 'Send Review Request'. Tap it to send a review link to your client.",
        tip: "Strike while the iron is hot - request immediately!",
      },
      {
        title: "Client receives the link",
        description: "The client gets an SMS with a link to your review page. It shows the job details and asks for a 1-5 star rating plus optional comment.",
        tip: "The link works on any device - phone, tablet, or computer.",
      },
      {
        title: "Review is submitted",
        description: "When the client submits their rating, it appears in your Reviews section. One-time use - they can't submit twice.",
        tip: "Thank clients who leave great reviews!",
      },
      {
        title: "View your reviews",
        description: "Go to More > Reviews to see all your reviews, average rating, and what clients are saying about your work.",
        tip: "Share great reviews on your social media for more credibility!",
      },
    ],
  },
  {
    id: "owner-view",
    title: "Owner View Dashboard",
    description: "Track your business performance at a glance",
    icon: LayoutDashboard,
    color: "from-purple-500 to-violet-500",
    duration: "4 min",
    steps: [
      {
        title: "Access Owner View",
        description: "Go to More > Owner View. This is your business dashboard - perfect for end-of-day review or weekly planning.",
        tip: "Also accessible from a desktop browser for a bigger screen experience.",
      },
      {
        title: "Review your earnings",
        description: "See your total earnings for the selected period. Track daily, weekly, or monthly performance.",
        tip: "Compare weeks to spot trends in your business.",
      },
      {
        title: "Check job metrics",
        description: "View completed jobs, average job value, and job type breakdown. Understand which services are most profitable.",
        tip: "Higher average job value = more efficient use of your time.",
      },
      {
        title: "Track unpaid invoices",
        description: "See any outstanding payments at a glance. Follow up on overdue invoices to keep cash flowing.",
        tip: "Set a personal rule: follow up on unpaid invoices within 7 days.",
      },
      {
        title: "Plan your week",
        description: "Check upcoming jobs to plan your schedule. Make sure you have the right materials and enough time between appointments.",
        tip: "Use Owner View on Sunday evenings to prepare for the week ahead.",
      },
      {
        title: "Weekly email summaries",
        description: "Enable weekly summaries in Settings to get an email every Monday with your previous week's performance. No need to even open the app!",
        tip: "Great for tracking progress over time without extra effort.",
      },
    ],
  },
  {
    id: "crew-management",
    title: "Managing Your Crew",
    description: "Assign jobs and coordinate with team members",
    icon: Users,
    color: "from-slate-500 to-gray-600",
    duration: "5 min",
    steps: [
      {
        title: "Add crew members",
        description: "Go to More > Crew and tap 'Add Crew Member'. Enter their name, phone, and email. They'll receive an invitation to join your team.",
        tip: "Add a profile photo for each crew member for easy recognition.",
      },
      {
        title: "Set crew availability",
        description: "Each crew member can have their own availability schedule. This helps you assign the right person for each job.",
        tip: "Some crew members may only work certain days or times.",
      },
      {
        title: "Assign jobs to crew",
        description: "When creating or editing a job, use the 'Assign to' dropdown to select a crew member. They'll be notified of the assignment.",
        tip: "Crew members can access their assigned jobs through the Crew Portal.",
      },
      {
        title: "Crew Portal access",
        description: "Crew members can log into the Crew Portal to see their assigned jobs, update job status, and record completions.",
        tip: "The portal is a simplified view - just what they need to do their work.",
      },
      {
        title: "Track crew performance",
        description: "In Owner View, see metrics broken down by crew member. Track who's completing the most jobs and generating the most revenue.",
        tip: "Use this data for bonus decisions and workload balancing.",
      },
    ],
  },
];

export default function UserGuides() {
  const [, navigate] = useLocation();
  const [selectedGuide, setSelectedGuide] = useState<Guide | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const handleGuideSelect = (guide: Guide) => {
    setSelectedGuide(guide);
    setCurrentStep(0);
    setCompletedSteps(new Set());
  };

  const handleStepComplete = (stepIndex: number) => {
    const newCompleted = new Set(completedSteps);
    newCompleted.add(stepIndex);
    setCompletedSteps(newCompleted);
    
    if (stepIndex < (selectedGuide?.steps.length || 0) - 1) {
      setCurrentStep(stepIndex + 1);
    }
  };

  const handleBack = () => {
    if (selectedGuide) {
      setSelectedGuide(null);
    } else {
      navigate("/help");
    }
  };

  const progress = selectedGuide 
    ? (completedSteps.size / selectedGuide.steps.length) * 100 
    : 0;

  return (
    <div className="min-h-screen bg-background pb-24" data-testid="page-user-guides">
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-600 to-violet-700 text-white px-4 pt-6 pb-12">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 -left-10 w-32 h-32 bg-purple-400/10 rounded-full blur-2xl" />
        </div>
        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="mb-4 -ml-2 text-white/80 hover:text-white hover:bg-white/10"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            {selectedGuide ? "All Guides" : "Help & Support"}
          </Button>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center">
              <Book className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">
                {selectedGuide ? selectedGuide.title : "User Guides"}
              </h1>
              <p className="text-purple-200/80">
                {selectedGuide ? selectedGuide.description : "Step-by-step tutorials"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-6 relative z-10">
        {!selectedGuide ? (
          <div className="space-y-3">
            <Card className="border-0 shadow-lg bg-gradient-to-r from-pink-500 to-rose-500 text-white" data-testid="card-featured-guide">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <Target className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">New to GigAid?</p>
                    <p className="text-sm text-white/80 mt-1">
                      Start with "Facebook to Paid Gig" - it walks you through the complete workflow from finding a job to getting paid.
                    </p>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="mt-3"
                      onClick={() => handleGuideSelect(guides.find(g => g.id === "facebook-to-paid")!)}
                      data-testid="button-featured-guide"
                    >
                      Start This Guide
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="pt-2">
              <h2 className="font-semibold text-lg mb-3">All Guides</h2>
              <div className="space-y-2">
                {guides.map((guide) => {
                  const Icon = guide.icon;
                  return (
                    <Card
                      key={guide.id}
                      className="border-0 shadow-md hover-elevate cursor-pointer"
                      onClick={() => handleGuideSelect(guide)}
                      data-testid={`card-guide-${guide.id}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className={`h-11 w-11 rounded-xl bg-gradient-to-br ${guide.color} flex items-center justify-center shrink-0`}>
                            <Icon className="h-5 w-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{guide.title}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {guide.description}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">
                              <Clock className="h-3 w-3 mr-1" />
                              {guide.duration}
                            </Badge>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Card className="border-0 shadow-lg" data-testid="card-progress">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Progress</span>
                  <span className="text-sm text-muted-foreground">
                    {completedSteps.size} of {selectedGuide.steps.length} steps
                  </span>
                </div>
                <Progress value={progress} className="h-2" />
              </CardContent>
            </Card>

            <div className="space-y-3">
              {selectedGuide.steps.map((step, index) => {
                const isCompleted = completedSteps.has(index);
                const isCurrent = index === currentStep;
                
                return (
                  <Card
                    key={index}
                    className={`border-0 shadow-md transition-all ${
                      isCurrent ? "ring-2 ring-primary" : ""
                    } ${isCompleted ? "opacity-75" : ""}`}
                    data-testid={`step-${index}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex gap-3">
                        <div className="shrink-0 pt-0.5">
                          {isCompleted ? (
                            <div className="h-6 w-6 rounded-full bg-green-500 flex items-center justify-center">
                              <CheckCircle2 className="h-4 w-4 text-white" />
                            </div>
                          ) : (
                            <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center ${
                              isCurrent ? "border-primary text-primary" : "border-muted-foreground/30 text-muted-foreground"
                            }`}>
                              <span className="text-xs font-medium">{index + 1}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium text-sm ${isCompleted ? "line-through text-muted-foreground" : ""}`}>
                            {step.title}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {step.description}
                          </p>
                          {step.tip && (
                            <div className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
                              <div className="flex items-start gap-2">
                                <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                <p className="text-xs text-primary">
                                  <span className="font-medium">Pro tip:</span> {step.tip}
                                </p>
                              </div>
                            </div>
                          )}
                          {!isCompleted && (
                            <Button
                              size="sm"
                              className="mt-3"
                              onClick={() => handleStepComplete(index)}
                              data-testid={`button-complete-step-${index}`}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              Mark as Done
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {completedSteps.size === selectedGuide.steps.length && (
              <Card className="border-0 shadow-lg bg-gradient-to-r from-green-500 to-emerald-500 text-white" data-testid="card-guide-complete">
                <CardContent className="p-6 text-center">
                  <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-white/20 flex items-center justify-center">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <h3 className="text-xl font-bold mb-2" data-testid="text-guide-complete">Guide Complete!</h3>
                  <p className="text-white/80 mb-4">
                    You've finished "{selectedGuide.title}". Ready for the next one?
                  </p>
                  <Button
                    variant="secondary"
                    onClick={() => setSelectedGuide(null)}
                    data-testid="button-back-to-guides"
                  >
                    View All Guides
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
