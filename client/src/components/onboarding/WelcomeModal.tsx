import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Briefcase, Calendar, Link2, Bell } from "lucide-react";

interface WelcomeModalProps {
  open: boolean;
  onClose: () => void;
  onStart: () => void;
}

export function WelcomeModal({ open, onClose, onStart }: WelcomeModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-welcome">
        <DialogHeader>
          <DialogTitle className="text-2xl text-center">Welcome to Gig Aid</DialogTitle>
          <DialogDescription className="text-center pt-2">
            Your all-in-one platform to manage clients, jobs, and grow your business.
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Briefcase className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">Manage Jobs</p>
              <p className="text-sm text-muted-foreground">Track all your work in one place</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">Smart Scheduling</p>
              <p className="text-sm text-muted-foreground">AI helps you find the best times</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Link2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">Share Booking Links</p>
              <p className="text-sm text-muted-foreground">Let clients book you directly</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">Automatic Reminders</p>
              <p className="text-sm text-muted-foreground">Never miss an appointment</p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onStart} className="w-full" data-testid="button-get-started">
            Get Started
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
