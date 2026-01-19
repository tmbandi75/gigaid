import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { SupportTicketForm } from "@/components/SupportTicketForm";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 dark:bg-background p-4">
      <div className="w-full max-w-md">
        <Card>
          <CardContent className="pt-6">
            <div className="flex mb-4 gap-2">
              <AlertCircle className="h-8 w-8 text-red-500" />
              <h1 className="text-2xl font-bold">404 Page Not Found</h1>
            </div>

            <p className="mt-4 text-sm text-muted-foreground">
              The page you're looking for doesn't exist or has been moved.
            </p>
          </CardContent>
        </Card>
        <SupportTicketForm context="Page not found (404)" />
      </div>
    </div>
  );
}
