import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  HelpCircle, 
  MessageCircle, 
  Mail, 
  Phone, 
  FileText,
  Zap,
  Calendar,
  CreditCard,
  Users,
  Settings,
  Send,
  Loader2,
  ExternalLink,
  Search,
  ArrowLeft,
  Book,
  Headphones,
  ChevronRight,
  Ticket,
  CheckCircle,
  Clock,
  AlertCircle,
} from "lucide-react";

const faqs = [
  {
    category: "Getting Started",
    icon: Zap,
    color: "from-violet-500 to-purple-500",
    questions: [
      {
        q: "How do I create my first job?",
        a: "Tap the '+' button on the Jobs page or use the quick action on your dashboard. Fill in the client details, select a service type from the organized dropdown, add date/time, and save. Your job will appear in your schedule.",
      },
      {
        q: "How do I set up my booking page?",
        a: "Go to Settings > Public Profile & Booking. Enable your public profile, set your URL, select your services from the catalog (up to 20), and configure your availability. Share your booking link with clients!",
      },
      {
        q: "How do I add my services?",
        a: "Go to More > Profile and tap 'Edit Services'. You'll see 28 categories (Plumbing, Electrical, Cleaning, Hair & Beauty, and more) with over 150 specific services. Select up to 20 services that you offer.",
      },
      {
        q: "What service categories are available?",
        a: "GigAid offers 28 service categories including: Handyman, Plumbing, Electrical, Cleaning, Lawn & Outdoor, Hair & Beauty, Pet Care, Child Care, Moving, Auto Services, Tech Help, Wellness, Creative & Media, Events, Education, and more!",
      },
      {
        q: "What's the typical workflow for a new gig?",
        a: "The typical flow is: Quick Capture (grab the lead) → Reply Composer (negotiate) → Price Confirmation (lock the deal) → Deposit (secure it) → Job (do the work) → Get Paid → Review Request. GigAid guides you through each step!",
      },
    ],
  },
  {
    category: "Quick Capture & Leads",
    icon: Zap,
    color: "from-pink-500 to-rose-500",
    questions: [
      {
        q: "What is Quick Capture?",
        a: "Quick Capture lets you instantly create leads from anywhere - Facebook Marketplace, Craigslist, texts, or any message. Just copy the text and paste it into GigAid, or use Share → GigAid on your phone.",
      },
      {
        q: "How does AI parsing work in Quick Capture?",
        a: "When you paste or share content, our AI automatically extracts the client's name, phone number, service needed, and source (like Facebook or Craigslist). You can review and adjust before saving.",
      },
      {
        q: "What is Source Tracking?",
        a: "GigAid tracks where each lead came from (Facebook, Nextdoor, referral, etc.). This helps you see which platforms bring the most business so you can focus your marketing.",
      },
      {
        q: "How do I use Quick Capture from Facebook?",
        a: "When you see a job post on Facebook, tap Share → GigAid (or copy the post text). GigAid will extract all the details and create a lead automatically. No typing required!",
      },
      {
        q: "How do I select a service type for leads?",
        a: "When creating a lead, use the service dropdown which shows all 28 categories organized by type. The AI will also try to match the service from the captured text to a category.",
      },
    ],
  },
  {
    category: "Photos & Attachments",
    icon: FileText,
    color: "from-amber-500 to-orange-500",
    questions: [
      {
        q: "Can clients send photos when booking?",
        a: "Yes! When clients book through your public booking page, they can upload up to 5 photos showing the work needed. This helps you prepare and quote accurately.",
      },
      {
        q: "Can I add photos to my jobs?",
        a: "Absolutely! When creating or editing a job, you can upload up to 10 photos. Great for documenting before/after work, materials used, or site conditions.",
      },
      {
        q: "Can clients add photos to reviews?",
        a: "Yes! Clients can attach up to 3 photos when leaving a review. They choose whether each photo is public (visible on your profile) or private (only you can see it).",
      },
      {
        q: "Where are my photos stored?",
        a: "All photos are securely stored in the cloud and linked to the relevant booking, job, or review. You can view them anytime from the associated record.",
      },
    ],
  },
  {
    category: "Reply Composer & Negotiations",
    icon: MessageCircle,
    color: "from-indigo-500 to-blue-500",
    questions: [
      {
        q: "What is the Reply Composer?",
        a: "Reply Composer uses AI to help you write professional responses to clients. It suggests replies for common situations like giving quotes, discussing availability, or following up.",
      },
      {
        q: "What scenarios does Reply Composer support?",
        a: "Reply Composer handles four key scenarios: Giving a Quote (with pricing), Sharing Availability (your schedule), Following Up (checking in), and Providing Details (answering questions about your services).",
      },
      {
        q: "How do I use Reply Composer?",
        a: "Open any lead and scroll to the Reply Composer section. Select your scenario (quote, availability, etc.), optionally add notes, and tap Generate. Copy the suggested reply and paste it into your messaging app.",
      },
      {
        q: "Can I customize the AI-generated replies?",
        a: "Yes! The AI uses your profile information (name, services, bio) to personalize replies. You can also add notes before generating, and edit the reply before copying it.",
      },
    ],
  },
  {
    category: "Price Confirmation",
    icon: FileText,
    color: "from-teal-500 to-cyan-500",
    questions: [
      {
        q: "What is Price Confirmation?",
        a: "Price Confirmation lets you lock in a price with your client before starting work. You send a link, they tap 'Looks Good', and the price is timestamped - no disputes later!",
      },
      {
        q: "How do I send a Price Confirmation?",
        a: "Open a lead and tap 'Send Price Confirmation'. Enter the agreed price and any notes, then send. The client receives a link via SMS or email to confirm.",
      },
      {
        q: "What happens when the client confirms?",
        a: "When the client confirms the price, GigAid automatically converts the lead to a job, sets the price, and marks everything as confirmed. You're ready to schedule!",
      },
      {
        q: "Can I see if the client viewed the confirmation?",
        a: "Yes! Price confirmations have status tracking: Draft, Sent, Viewed (they opened it), Confirmed (they approved), or Expired. You can see exactly where things stand.",
      },
    ],
  },
  {
    category: "Deposits & Payments",
    icon: CreditCard,
    color: "from-green-500 to-emerald-500",
    questions: [
      {
        q: "How do deposits work?",
        a: "Deposits let you collect a payment upfront to secure an appointment. The deposit is held safely and applied to the final bill. This protects you from no-shows!",
      },
      {
        q: "How do I request a deposit?",
        a: "After price confirmation, you can enable deposits in your booking settings. Clients pay via Apple Pay, Google Pay, or card. The deposit is held until job completion.",
      },
      {
        q: "What happens to the deposit after the job?",
        a: "When you mark a job complete and record payment, the deposit is shown as 'applied' to the total. The client only pays the remaining balance (Total - Deposit = Balance Due).",
      },
      {
        q: "What if the client cancels?",
        a: "Your cancellation policy determines what happens. Late cancellations may forfeit part or all of the deposit. You can also choose to refund deposits for good customers.",
      },
      {
        q: "How do I create an invoice?",
        a: "Go to Invoices and tap 'New Invoice'. Fill in the client details, service description, and amount. You can send it via email or share a link.",
      },
      {
        q: "How do I mark a job as paid?",
        a: "Open the job and tap 'Get Paid'. Select how the client paid (Cash, Zelle, Venmo, Card, etc.). If there was a deposit, it shows the breakdown automatically.",
      },
    ],
  },
  {
    category: "On The Way & Notifications",
    icon: Send,
    color: "from-orange-500 to-amber-500",
    questions: [
      {
        q: "What is 'On The Way'?",
        a: "'On The Way' sends an automatic text to your client letting them know you're headed to the job. It reduces anxiety, prevents no-shows, and makes you look professional.",
      },
      {
        q: "How do I send an 'On The Way' notification?",
        a: "Open the job you're heading to and tap the 'On The Way' button. GigAid sends an SMS to the client immediately. Simple and fast!",
      },
      {
        q: "What does the notification say?",
        a: "The message includes your name and says you're on your way. For example: 'Mike from Pro Gig Services is on the way to your appointment.'",
      },
      {
        q: "Can I customize the On The Way message?",
        a: "The message uses your profile name and business name automatically. The format is designed to be brief and professional.",
      },
    ],
  },
  {
    category: "Reviews & Reputation",
    icon: Users,
    color: "from-yellow-500 to-orange-500",
    questions: [
      {
        q: "How do I request a review?",
        a: "When you mark a job as paid in the Get Paid dialog, you'll see an option to 'Request a Review'. Tap it and GigAid sends a review link to your client automatically.",
      },
      {
        q: "How does the review process work?",
        a: "The client receives a link, taps it, sees the job details, gives a star rating (1-5), and optionally adds a comment and up to 3 photos. The review appears in your Reviews section.",
      },
      {
        q: "Can clients add photos to reviews?",
        a: "Yes! When clients submit a review, they can attach up to 3 photos showing your completed work. They can choose whether each photo is public (shown on your profile) or private (only you see it).",
      },
      {
        q: "Can clients only leave one review per job?",
        a: "Yes, each review link works once. After submitting, the link shows a thank-you message if they try to use it again.",
      },
      {
        q: "Where can I see my reviews?",
        a: "Go to More > Reviews to see all your reviews, your average rating, and feedback from clients. Great reviews help you get more business!",
      },
    ],
  },
  {
    category: "Scheduling & Jobs",
    icon: Calendar,
    color: "from-blue-500 to-cyan-500",
    questions: [
      {
        q: "How do I reschedule a job?",
        a: "Open the job from your Jobs list, tap Edit, change the date and time, then save. The client will be notified if you have reminders set up.",
      },
      {
        q: "Can I assign jobs to crew members?",
        a: "Yes! When creating or editing a job, you'll see an option to assign it to a crew member. First add crew members in the Crew section.",
      },
      {
        q: "How do reminders work?",
        a: "Set up reminders in the Reminders page. You can send SMS or voice reminders to clients before appointments. Reminders help reduce no-shows!",
      },
      {
        q: "What job statuses are available?",
        a: "Jobs can be: Scheduled (upcoming), In Progress (you're working on it), Completed (finished), or Cancelled. Update the status as you work.",
      },
      {
        q: "Can I add photos to jobs?",
        a: "Yes! When creating or editing a job, you can upload up to 10 photos. Use this to document before/after work, materials, or site conditions.",
      },
      {
        q: "How do I select the service type for a job?",
        a: "When creating a job, tap the service dropdown to see all categories. Services are organized into groups like Plumbing, Electrical, Cleaning, etc. Select the specific service that matches the work.",
      },
    ],
  },
  {
    category: "Owner View & Analytics",
    icon: FileText,
    color: "from-purple-500 to-violet-500",
    questions: [
      {
        q: "What is Owner View?",
        a: "Owner View is your business dashboard. It shows earnings, completed jobs, pending payments, and upcoming work. It's designed for end-of-day or weekly review.",
      },
      {
        q: "How do I access Owner View?",
        a: "Go to More > Owner View. You can also access it from the desktop/web version for a larger screen experience.",
      },
      {
        q: "What metrics can I see in Owner View?",
        a: "Owner View shows: Total earnings, jobs completed, average job value, unpaid invoices, upcoming jobs, and performance trends over time.",
      },
      {
        q: "Can I get weekly summaries?",
        a: "Yes! GigAid can send you weekly email summaries every Monday with your earnings, completed jobs, and upcoming schedule. Enable this in Settings.",
      },
    ],
  },
  {
    category: "Account & Settings",
    icon: Settings,
    color: "from-slate-500 to-gray-600",
    questions: [
      {
        q: "How do I update my profile?",
        a: "Go to More > Profile. You can update your name, email, phone, company name, and bio. Your bio can be enhanced using AI!",
      },
      {
        q: "How do I enable dark mode?",
        a: "Go to More and toggle the Dark Mode switch. Your preference is saved automatically.",
      },
      {
        q: "How do I connect Stripe for payments?",
        a: "Go to Settings > Stripe Connect and tap 'Connect with Stripe'. Follow the setup wizard to enable deposit collection and card payments.",
      },
      {
        q: "What's included in the Pro plan?",
        a: "Pro includes Owner View dashboard access, weekly email summaries, advanced analytics, priority support, and more. Upgrade in Settings!",
      },
    ],
  },
];

interface SupportTicket {
  id: number;
  subject: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case "solved":
    case "closed":
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case "pending":
    case "hold":
      return <Clock className="h-4 w-4 text-amber-500" />;
    default:
      return <AlertCircle className="h-4 w-4 text-blue-500" />;
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case "new": return "New";
    case "open": return "Open";
    case "pending": return "Pending";
    case "hold": return "On Hold";
    case "solved": return "Solved";
    case "closed": return "Closed";
    default: return status;
  }
};

export default function HelpSupport() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [contactForm, setContactForm] = useState({
    subject: "",
    message: "",
    category: "general",
    priority: "normal",
  });
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [showTickets, setShowTickets] = useState(false);

  const { data: ticketsData, isLoading: ticketsLoading } = useQuery<{ tickets: SupportTicket[] }>({
    queryKey: ["/api/support/tickets"],
    enabled: showTickets,
  });

  const createTicketMutation = useMutation({
    mutationFn: async (data: { subject: string; description: string; category: string; priority: string }) => {
      return apiRequest("/api/support/tickets", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({ title: "Support ticket created! We'll respond as soon as possible." });
      setContactForm({ subject: "", message: "", category: "general", priority: "normal" });
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets"] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to create ticket", 
        description: error.message || "Please try again or email us directly.",
        variant: "destructive" 
      });
    },
  });

  const filteredFaqs = faqs.map(category => ({
    ...category,
    questions: category.questions.filter(
      q => 
        q.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.a.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  })).filter(category => category.questions.length > 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.subject || !contactForm.message) {
      toast({ title: "Please fill in all fields", variant: "destructive" });
      return;
    }
    
    createTicketMutation.mutate({
      subject: contactForm.subject,
      description: contactForm.message,
      category: contactForm.category,
      priority: contactForm.priority,
    });
  };

  return (
    <div className="min-h-screen bg-background pb-24" data-testid="page-help-support">
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-600 via-slate-700 to-slate-800 text-white px-4 pt-6 pb-12">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 -left-10 w-32 h-32 bg-slate-400/10 rounded-full blur-2xl" />
        </div>
        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/more")}
            className="mb-4 -ml-2 text-white/80 hover:text-white hover:bg-white/10"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center">
              <Headphones className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Help & Support</h1>
              <p className="text-slate-300/80">We're here to help you</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-6 relative z-10 space-y-4">
        <Card className="border-0 shadow-lg">
          <CardContent className="p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for help..."
                className="pl-10 h-12 bg-muted/50 border-0"
                data-testid="input-search-help"
              />
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Card className="border-0 shadow-md hover-elevate cursor-pointer" data-testid="card-email-support">
            <CardContent className="p-4">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mb-3">
                <Mail className="h-5 w-5 text-white" />
              </div>
              <p className="font-medium text-sm">Email Us</p>
              <p className="text-xs text-muted-foreground mt-0.5">support@gigaid.app</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md hover-elevate cursor-pointer" data-testid="card-phone-support">
            <CardContent className="p-4">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center mb-3">
                <Phone className="h-5 w-5 text-white" />
              </div>
              <p className="font-medium text-sm">Call Us</p>
              <p className="text-xs text-muted-foreground mt-0.5">1-800-GIG-AID</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-0 shadow-md" data-testid="card-faqs">
          <CardContent className="p-4">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" />
              Frequently Asked Questions
            </h2>

            {searchQuery && filteredFaqs.length === 0 ? (
              <div className="py-12 text-center">
                <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                  <Search className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">No results found for "{searchQuery}"</p>
              </div>
            ) : (
              <div className="space-y-3">
                {(searchQuery ? filteredFaqs : faqs).map((category) => {
                  const Icon = category.icon;
                  const isExpanded = expandedCategory === category.category;
                  
                  return (
                    <div key={category.category} className="border rounded-lg overflow-hidden">
                      <button
                        className="w-full flex items-center gap-3 p-3 text-left hover-elevate"
                        onClick={() => setExpandedCategory(isExpanded ? null : category.category)}
                      >
                        <div className={`h-9 w-9 rounded-lg bg-gradient-to-br ${category.color} flex items-center justify-center shrink-0`}>
                          <Icon className="h-4 w-4 text-white" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{category.category}</p>
                          <p className="text-xs text-muted-foreground">{category.questions.length} questions</p>
                        </div>
                        <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                      </button>
                      
                      {isExpanded && (
                        <div className="border-t bg-muted/30">
                          <Accordion type="single" collapsible className="w-full">
                            {category.questions.map((faq, index) => (
                              <AccordionItem key={index} value={`${index}`} className="border-0">
                                <AccordionTrigger className="text-left text-sm px-4 py-3 hover:no-underline hover:bg-muted/50">
                                  {faq.q}
                                </AccordionTrigger>
                                <AccordionContent className="text-sm text-muted-foreground px-4 pb-4">
                                  {faq.a}
                                </AccordionContent>
                              </AccordionItem>
                            ))}
                          </Accordion>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md" data-testid="card-contact">
          <CardContent className="p-4">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Ticket className="h-5 w-5 text-primary" />
              Submit a Support Ticket
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  value={contactForm.subject}
                  onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                  placeholder="What do you need help with?"
                  className="h-12"
                  data-testid="input-subject"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    value={contactForm.category}
                    onValueChange={(value) => setContactForm({ ...contactForm, category: value })}
                  >
                    <SelectTrigger className="h-12" data-testid="select-category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General Question</SelectItem>
                      <SelectItem value="billing">Billing & Payments</SelectItem>
                      <SelectItem value="technical">Technical Issue</SelectItem>
                      <SelectItem value="feature">Feature Request</SelectItem>
                      <SelectItem value="account">Account Help</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select
                    value={contactForm.priority}
                    onValueChange={(value) => setContactForm({ ...contactForm, priority: value })}
                  >
                    <SelectTrigger className="h-12" data-testid="select-priority">
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  value={contactForm.message}
                  onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                  placeholder="Describe your issue or question in detail..."
                  className="min-h-[120px] resize-none"
                  data-testid="textarea-message"
                />
              </div>
              <Button 
                type="submit" 
                className="w-full h-12"
                disabled={createTicketMutation.isPending}
                data-testid="button-send-message"
              >
                {createTicketMutation.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                ) : (
                  <Send className="h-5 w-5 mr-2" />
                )}
                Submit Ticket
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md" data-testid="card-my-tickets">
          <CardContent className="p-4">
            <button 
              className="w-full flex items-center justify-between"
              onClick={() => setShowTickets(!showTickets)}
            >
              <h2 className="font-semibold flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-primary" />
                My Support Tickets
              </h2>
              <ChevronRight className={`h-5 w-5 text-muted-foreground transition-transform ${showTickets ? "rotate-90" : ""}`} />
            </button>
            
            {showTickets && (
              <div className="mt-4 space-y-3">
                {ticketsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : ticketsData?.tickets && ticketsData.tickets.length > 0 ? (
                  ticketsData.tickets.map((ticket) => (
                    <div 
                      key={ticket.id} 
                      className="p-3 border rounded-lg hover-elevate cursor-pointer"
                      data-testid={`ticket-${ticket.id}`}
                    >
                      <div className="flex items-start gap-3">
                        {getStatusIcon(ticket.status)}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{ticket.subject}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-xs">
                              {getStatusLabel(ticket.status)}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(ticket.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center">
                    <Ticket className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">No support tickets yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Submit a ticket above if you need help</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card 
          className="border-0 shadow-md hover-elevate cursor-pointer"
          onClick={() => navigate("/guides")}
          data-testid="card-user-guides"
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
                <Book className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">User Guides & Tutorials</p>
                <p className="text-xs text-muted-foreground">Step-by-step walkthroughs</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
