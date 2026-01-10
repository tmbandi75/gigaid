import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
} from "lucide-react";

const faqs = [
  {
    category: "Getting Started",
    icon: Zap,
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
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [contactForm, setContactForm] = useState({
    subject: "",
    message: "",
  });
  const [isSending, setIsSending] = useState(false);

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
    <div className="p-4 pb-24 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Help & Support</h1>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search help articles..."
          className="pl-10"
          data-testid="input-search-help"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card className="hover-elevate cursor-pointer" data-testid="card-email-support">
          <CardContent className="py-4 text-center">
            <Mail className="h-8 w-8 mx-auto mb-2 text-primary" />
            <p className="font-medium text-sm">Email Support</p>
            <p className="text-xs text-muted-foreground">support@gigaid.app</p>
          </CardContent>
        </Card>
        <Card className="hover-elevate cursor-pointer" data-testid="card-phone-support">
          <CardContent className="py-4 text-center">
            <Phone className="h-8 w-8 mx-auto mb-2 text-primary" />
            <p className="font-medium text-sm">Phone Support</p>
            <p className="text-xs text-muted-foreground">1-800-GIG-AID</p>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-faqs">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <HelpCircle className="h-5 w-5" />
            Frequently Asked Questions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {searchQuery && filteredFaqs.length === 0 ? (
            <div className="py-8 text-center">
              <HelpCircle className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No results found for "{searchQuery}"</p>
            </div>
          ) : (
            <Accordion type="multiple" className="w-full">
              {(searchQuery ? filteredFaqs : faqs).map((category, catIndex) => (
                <div key={category.category} className={catIndex > 0 ? "mt-4" : ""}>
                  <div className="flex items-center gap-2 mb-2 text-sm font-medium text-muted-foreground">
                    <category.icon className="h-4 w-4" />
                    {category.category}
                  </div>
                  {category.questions.map((faq, index) => (
                    <AccordionItem key={index} value={`${catIndex}-${index}`}>
                      <AccordionTrigger className="text-left text-sm hover:no-underline">
                        {faq.q}
                      </AccordionTrigger>
                      <AccordionContent className="text-sm text-muted-foreground">
                        {faq.a}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </div>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-contact">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageCircle className="h-5 w-5" />
            Contact Us
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={contactForm.subject}
                onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                placeholder="What do you need help with?"
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
                className="min-h-[100px]"
                data-testid="textarea-message"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full"
              disabled={isSending}
              data-testid="button-send-message"
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send Message
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium text-sm">Documentation</p>
                <p className="text-xs text-muted-foreground">Full user guide & tutorials</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" data-testid="button-docs">
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
