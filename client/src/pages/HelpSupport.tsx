import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
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
} from "lucide-react";

const faqs = [
  {
    category: "Getting Started",
    icon: Zap,
    color: "from-violet-500 to-purple-500",
    questions: [
      {
        q: "How do I create my first job?",
        a: "Tap the '+' button on the Jobs page or use the quick action on your dashboard. Fill in the client details, service type, date/time, and save. Your job will appear in your schedule.",
      },
      {
        q: "How do I set up my booking page?",
        a: "Go to Settings > Public Profile & Booking. Enable your public profile, set your URL, add your services, and configure your availability. Share your booking link with clients!",
      },
      {
        q: "How do I add my services?",
        a: "In Settings, scroll to Services. You can click preset services like plumbing or electrical, or type in your own custom service and press the + button to add it.",
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
    ],
  },
  {
    category: "Invoicing & Payments",
    icon: CreditCard,
    color: "from-green-500 to-emerald-500",
    questions: [
      {
        q: "How do I create an invoice?",
        a: "Go to Invoices and tap 'New Invoice'. Fill in the client details, service description, and amount. You can send it via email or share a link.",
      },
      {
        q: "How do I mark an invoice as paid?",
        a: "Open the invoice and tap 'Mark as Paid'. You can also select the payment method (cash, Zelle, Venmo, etc.) for your records.",
      },
      {
        q: "Can clients leave reviews after paying?",
        a: "Yes! When you mark an invoice as paid and send it, clients will see a 'Thank you' message with an option to rate your service.",
      },
    ],
  },
  {
    category: "Managing Leads",
    icon: Users,
    color: "from-amber-500 to-orange-500",
    questions: [
      {
        q: "What's the difference between a lead and a job?",
        a: "A lead is a potential client who's interested in your services. Once they book, you can convert them to a job. Leads help you track your sales pipeline.",
      },
      {
        q: "How do I convert a lead to a job?",
        a: "Open the lead and tap 'Convert to Job'. This will create a new job with the lead's information pre-filled.",
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
        q: "What's included in the Pro plan?",
        a: "Pro includes web dashboard access, Google Calendar sync, advanced analytics, priority support, and more. Upgrade in Settings!",
      },
    ],
  },
];

export default function HelpSupport() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [contactForm, setContactForm] = useState({
    subject: "",
    message: "",
  });
  const [isSending, setIsSending] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

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
    
    setIsSending(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsSending(false);
    setContactForm({ subject: "", message: "" });
    toast({ title: "Message sent! We'll get back to you soon." });
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
              <MessageCircle className="h-5 w-5 text-primary" />
              Send Us a Message
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
              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  value={contactForm.message}
                  onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                  placeholder="Describe your issue or question..."
                  className="min-h-[120px] resize-none"
                  data-testid="textarea-message"
                />
              </div>
              <Button 
                type="submit" 
                className="w-full h-12"
                disabled={isSending}
                data-testid="button-send-message"
              >
                {isSending ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                ) : (
                  <Send className="h-5 w-5 mr-2" />
                )}
                Send Message
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md hover-elevate cursor-pointer">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
                <Book className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">Documentation</p>
                <p className="text-xs text-muted-foreground">Full user guide & tutorials</p>
              </div>
              <Button variant="ghost" size="icon" data-testid="button-docs">
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
