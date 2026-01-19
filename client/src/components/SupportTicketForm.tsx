import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { LifeBuoy, CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

const supportTicketSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  description: z.string().min(10, "Please describe the issue (at least 10 characters)"),
});

type SupportTicketFormData = z.infer<typeof supportTicketSchema>;

interface SupportTicketFormProps {
  context?: string;
  pageUrl?: string;
}

export function SupportTicketForm({ context, pageUrl }: SupportTicketFormProps) {
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<SupportTicketFormData>({
    resolver: zodResolver(supportTicketSchema),
    defaultValues: {
      name: "",
      email: "",
      description: "",
    },
  });

  const createTicket = useMutation({
    mutationFn: async (data: SupportTicketFormData) => {
      const fullDescription = [
        data.description,
        "",
        "---",
        `Page: ${pageUrl || window.location.href}`,
        context ? `Context: ${context}` : "",
      ].filter(Boolean).join("\n");

      return apiRequest("POST", "/api/support/tickets/public", {
        subject: `Support Request: ${context || "Page Issue"}`,
        description: fullDescription,
        requesterEmail: data.email,
        requesterName: data.name,
        priority: "normal",
      });
    },
    onSuccess: () => {
      setSubmitted(true);
    },
  });

  const onSubmit = (data: SupportTicketFormData) => {
    createTicket.mutate(data);
  };

  if (submitted) {
    return (
      <Card className="mt-6" data-testid="card-ticket-submitted">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 text-green-600">
            <CheckCircle className="h-6 w-6" />
            <div>
              <p className="font-medium">Ticket submitted</p>
              <p className="text-sm text-muted-foreground">We'll get back to you soon.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-6" data-testid="card-support-form">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <LifeBuoy className="h-5 w-5" />
          Need Help?
        </CardTitle>
        <CardDescription>
          Open a support ticket and we'll look into this for you.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Your Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="John Doe"
                        data-testid="input-support-name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="you@example.com"
                        data-testid="input-support-email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>What happened?</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the issue you encountered..."
                      rows={3}
                      data-testid="input-support-description"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {createTicket.isError && (
              <div className="flex items-center gap-2 text-sm text-red-600">
                <AlertCircle className="h-4 w-4" />
                <span>Failed to submit. Please try again.</span>
              </div>
            )}
            <Button
              type="submit"
              disabled={createTicket.isPending}
              className="w-full"
              data-testid="button-submit-ticket"
            >
              {createTicket.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Submitting...
                </>
              ) : (
                "Submit Ticket"
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
