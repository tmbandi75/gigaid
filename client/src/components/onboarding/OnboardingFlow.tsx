import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import confetti from "canvas-confetti";
import {
  Wrench,
  Zap,
  Sparkles,
  Hammer,
  Flower2,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CheckCircle2,
  Smartphone,
} from "lucide-react";

interface OnboardingFlowProps {
  onComplete: () => void;
}

const serviceTypes = [
  { id: "plumbing", label: "Plumbing", icon: Wrench },
  { id: "electrical", label: "Electrical", icon: Zap },
  { id: "cleaning", label: "Cleaning", icon: Sparkles },
  { id: "handyman", label: "Handyman", icon: Hammer },
  { id: "landscaping", label: "Landscaping", icon: Flower2 },
  { id: "other", label: "Other", icon: MoreHorizontal },
];

const jobTitleSuggestions: Record<string, string> = {
  plumbing: "Plumbing Repair",
  electrical: "Electrical Work",
  cleaning: "Home Cleaning",
  handyman: "Handyman Service",
  landscaping: "Lawn Care",
  other: "Service Call",
};

const celebrationMessages = [
  "You're officially set up. Let's keep the momentum going.",
  "That's how easy it is. We'll help you stay on track.",
  "You're ready. We'll tell you what to do next.",
];

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [step, setStep] = useState(1);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [jobData, setJobData] = useState({
    title: "",
    scheduledDate: new Date().toISOString().split("T")[0],
    scheduledTime: "",
    price: "",
    clientName: "",
    clientPhone: "",
  });
  const [createdJobId, setCreatedJobId] = useState<string | null>(null);
  const [invoiceData, setInvoiceData] = useState({
    amount: "",
    message: "",
  });
  const [skipPayment, setSkipPayment] = useState(false);

  const updateOnboardingMutation = useMutation({
    mutationFn: async (data: { step?: number; completed?: boolean }) => {
      return apiRequest("POST", "/api/onboarding/progress", data);
    },
  });

  const createJobMutation = useMutation({
    mutationFn: async (data: typeof jobData) => {
      const res = await apiRequest("POST", "/api/jobs", {
        title: data.title,
        scheduledDate: data.scheduledDate,
        scheduledTime: data.scheduledTime || null,
        price: data.price ? Math.round(parseFloat(data.price) * 100) : null,
        clientName: data.clientName || "New Client",
        clientPhone: data.clientPhone || null,
        serviceType: selectedService,
        status: "scheduled",
      });
      return res.json();
    },
    onSuccess: (job) => {
      setCreatedJobId(job.id);
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      const price = jobData.price ? parseFloat(jobData.price) : 0;
      setInvoiceData({
        amount: price > 0 ? jobData.price : "",
        message: `Hi! Thanks for choosing us. Here's your invoice for ${jobData.title}. You can pay securely online.`,
      });
      setStep(3);
      updateOnboardingMutation.mutate({ step: 3 });
    },
    onError: () => {
      toast({ title: "Failed to create job", variant: "destructive" });
    },
  });

  const createInvoiceMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/invoices", {
        jobId: createdJobId,
        clientName: jobData.clientName || "New Client",
        clientPhone: jobData.clientPhone || null,
        serviceDescription: jobData.title,
        amount: Math.round(parseFloat(invoiceData.amount) * 100),
        notes: invoiceData.message,
        status: "draft",
      });
      return res.json();
    },
    onSuccess: async (invoice) => {
      await apiRequest("POST", `/api/invoices/${invoice.id}/send`);
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Payment request sent!" });
      completeOnboarding();
    },
    onError: () => {
      toast({ title: "Failed to send payment request", variant: "destructive" });
    },
  });

  const completeOnboarding = async () => {
    await updateOnboardingMutation.mutateAsync({ completed: true });
    queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
    setStep(4);
    
    setTimeout(() => {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b"],
      });
    }, 300);
  };

  const handleServiceSelect = (serviceId: string) => {
    setSelectedService(serviceId);
    setJobData((prev) => ({
      ...prev,
      title: jobTitleSuggestions[serviceId] || "Service Call",
    }));
  };

  const handleContinueToStep2 = () => {
    if (!selectedService) {
      toast({ title: "Please select a service type" });
      return;
    }
    updateOnboardingMutation.mutate({ step: 2 });
    setStep(2);
  };

  const handleAddJob = () => {
    if (!jobData.title.trim()) {
      toast({ title: "Please enter a job title" });
      return;
    }
    createJobMutation.mutate(jobData);
  };

  const handleSendPaymentRequest = () => {
    if (!invoiceData.amount || parseFloat(invoiceData.amount) <= 0) {
      toast({ title: "Please enter an amount" });
      return;
    }
    createInvoiceMutation.mutate();
  };

  const handleSkipPayment = () => {
    setSkipPayment(true);
    completeOnboarding();
  };

  const handleGoToDashboard = () => {
    onComplete();
    navigate("/");
  };

  const celebrationMessage = celebrationMessages[Math.floor(Math.random() * celebrationMessages.length)];

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col" data-testid="onboarding-flow">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-4 py-8">
          {step < 4 && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Step {step} of 4</span>
                {step > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setStep(step - 1)}
                    data-testid="button-back"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Back
                  </Button>
                )}
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${(step / 4) * 100}%` }}
                />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6" data-testid="step-service-type">
              <div className="text-center">
                <h1 className="text-2xl font-bold text-foreground mb-2">
                  Let's get you ready to get paid
                </h1>
                <p className="text-muted-foreground">
                  What kind of work do you usually do?
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {serviceTypes.map((service) => {
                  const Icon = service.icon;
                  const isSelected = selectedService === service.id;
                  return (
                    <Card
                      key={service.id}
                      className={`cursor-pointer transition-all ${
                        isSelected
                          ? "border-primary bg-primary/5 ring-2 ring-primary"
                          : "hover-elevate"
                      }`}
                      onClick={() => handleServiceSelect(service.id)}
                      data-testid={`service-${service.id}`}
                    >
                      <CardContent className="p-4 flex flex-col items-center gap-2">
                        <div
                          className={`h-12 w-12 rounded-xl flex items-center justify-center ${
                            isSelected ? "bg-primary/10" : "bg-muted"
                          }`}
                        >
                          <Icon
                            className={`h-6 w-6 ${
                              isSelected ? "text-primary" : "text-muted-foreground"
                            }`}
                          />
                        </div>
                        <span
                          className={`font-medium text-sm ${
                            isSelected ? "text-primary" : "text-foreground"
                          }`}
                        >
                          {service.label}
                        </span>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <Button
                className="w-full h-12"
                onClick={handleContinueToStep2}
                disabled={!selectedService}
                data-testid="button-continue"
              >
                Continue
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6" data-testid="step-add-job">
              <div className="text-center">
                <h1 className="text-2xl font-bold text-foreground mb-2">
                  Let's add a job
                </h1>
                <p className="text-muted-foreground">
                  This can be a past job or one coming up — we'll help.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">Job Title</Label>
                  <Input
                    id="title"
                    value={jobData.title}
                    onChange={(e) => setJobData({ ...jobData, title: e.target.value })}
                    placeholder="e.g., Fix leaky faucet"
                    data-testid="input-job-title"
                  />
                </div>

                <div>
                  <Label htmlFor="clientName">Client Name</Label>
                  <Input
                    id="clientName"
                    value={jobData.clientName}
                    onChange={(e) => setJobData({ ...jobData, clientName: e.target.value })}
                    placeholder="e.g., John Smith"
                    data-testid="input-client-name"
                  />
                </div>

                <div>
                  <Label htmlFor="clientPhone">Client Phone (optional)</Label>
                  <Input
                    id="clientPhone"
                    value={jobData.clientPhone}
                    onChange={(e) => setJobData({ ...jobData, clientPhone: e.target.value })}
                    placeholder="e.g., (555) 123-4567"
                    data-testid="input-client-phone"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="date">Date</Label>
                    <Input
                      id="date"
                      type="date"
                      value={jobData.scheduledDate}
                      onChange={(e) => setJobData({ ...jobData, scheduledDate: e.target.value })}
                      data-testid="input-job-date"
                    />
                  </div>
                  <div>
                    <Label htmlFor="time">Time (optional)</Label>
                    <Input
                      id="time"
                      type="time"
                      value={jobData.scheduledTime}
                      onChange={(e) => setJobData({ ...jobData, scheduledTime: e.target.value })}
                      data-testid="input-job-time"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="price">Price (optional)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      $
                    </span>
                    <Input
                      id="price"
                      type="number"
                      className="pl-7"
                      value={jobData.price}
                      onChange={(e) => setJobData({ ...jobData, price: e.target.value })}
                      placeholder="0.00"
                      data-testid="input-job-price"
                    />
                  </div>
                </div>
              </div>

              <Button
                className="w-full h-12"
                onClick={handleAddJob}
                disabled={createJobMutation.isPending}
                data-testid="button-add-job"
              >
                {createJobMutation.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    Add Job
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </>
                )}
              </Button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6" data-testid="step-payment-request">
              <div className="text-center">
                <h1 className="text-2xl font-bold text-foreground mb-2">
                  Want to get paid for this job?
                </h1>
                <p className="text-muted-foreground">
                  We'll send a simple payment request to your client.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="amount">Amount</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      $
                    </span>
                    <Input
                      id="amount"
                      type="number"
                      className="pl-7"
                      value={invoiceData.amount}
                      onChange={(e) => setInvoiceData({ ...invoiceData, amount: e.target.value })}
                      placeholder="0.00"
                      data-testid="input-invoice-amount"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="message">Message (editable)</Label>
                  <Textarea
                    id="message"
                    value={invoiceData.message}
                    onChange={(e) => setInvoiceData({ ...invoiceData, message: e.target.value })}
                    rows={3}
                    data-testid="input-invoice-message"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Button
                  className="w-full h-12"
                  onClick={handleSendPaymentRequest}
                  disabled={createInvoiceMutation.isPending}
                  data-testid="button-send-payment"
                >
                  {createInvoiceMutation.isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    "Send Payment Request"
                  )}
                </Button>
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={handleSkipPayment}
                  data-testid="button-skip-payment"
                >
                  I'll do this later
                </Button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-8 text-center pt-8" data-testid="step-celebration">
              <div className="space-y-4">
                <div className="h-20 w-20 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                </div>
                <h1 className="text-3xl font-bold text-foreground">Nice work!</h1>
                <p className="text-muted-foreground text-lg max-w-sm mx-auto">
                  {celebrationMessage}
                </p>
              </div>

              <div className="space-y-4 bg-muted/30 rounded-xl p-6">
                <div className="flex items-center gap-3 justify-center">
                  <Smartphone className="h-6 w-6 text-primary" />
                  <span className="font-semibold text-foreground">Get the GigAid App</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    className="h-12"
                    onClick={() => window.open("https://apps.apple.com", "_blank")}
                    data-testid="button-app-store"
                  >
                    App Store
                  </Button>
                  <Button
                    variant="outline"
                    className="h-12"
                    onClick={() => window.open("https://play.google.com", "_blank")}
                    data-testid="button-play-store"
                  >
                    Google Play
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Install the app so you don't miss jobs, payments, or reminders.
                </p>
              </div>

              <Button
                className="w-full h-12"
                onClick={handleGoToDashboard}
                data-testid="button-go-dashboard"
              >
                Go to Dashboard
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
