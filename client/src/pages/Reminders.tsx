import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Bell, Plus, Phone, Mail, MessageSquare, Trash2, Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";
import type { Reminder } from "@shared/schema";

export default function Reminders() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    clientName: "",
    clientPhone: "",
    clientEmail: "",
    message: "",
    channel: "sms" as "sms" | "voice" | "email",
    scheduledAt: "",
    jobId: "",
  });

  const { data: reminders = [], isLoading } = useQuery<Reminder[]>({
    queryKey: ["/api/reminders"],
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => apiRequest("POST", "/api/reminders", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reminders"] });
      setIsDialogOpen(false);
      resetForm();
      toast({ title: "Reminder scheduled" });
    },
    onError: () => {
      toast({ title: "Failed to create reminder", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/reminders/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reminders"] });
      toast({ title: "Reminder deleted" });
    },
  });

  const resetForm = () => {
    setFormData({
      clientName: "",
      clientPhone: "",
      clientEmail: "",
      message: "",
      channel: "sms",
      scheduledAt: "",
      jobId: "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clientName || !formData.message || !formData.scheduledAt) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }
    createMutation.mutate(formData);
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case "sms": return <MessageSquare className="h-4 w-4" />;
      case "voice": return <Phone className="h-4 w-4" />;
      case "email": return <Mail className="h-4 w-4" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case "sent":
        return <Badge variant="default"><CheckCircle className="h-3 w-3 mr-1" />Sent</Badge>;
      case "acknowledged":
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Confirmed</Badge>;
      case "failed":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 pb-24 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Reminders</h1>
        <Button onClick={() => setIsDialogOpen(true)} data-testid="button-add-reminder">
          <Plus className="h-4 w-4 mr-1" />
          New
        </Button>
      </div>

      {reminders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-medium mb-2">No reminders yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Schedule SMS or voice call reminders for your clients
            </p>
            <Button onClick={() => setIsDialogOpen(true)} data-testid="button-create-first-reminder">
              Create Your First Reminder
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reminders.map((reminder) => (
            <Card key={reminder.id} data-testid={`card-reminder-${reminder.id}`}>
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    {getChannelIcon(reminder.channel)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{reminder.clientName}</span>
                      {getStatusBadge(reminder.status)}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{reminder.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Scheduled: {formatDateTime(reminder.scheduledAt)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteMutation.mutate(reminder.id)}
                    disabled={deleteMutation.isPending}
                    data-testid={`button-delete-reminder-${reminder.id}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent data-testid="dialog-create-reminder">
          <DialogHeader>
            <DialogTitle>Schedule Reminder</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="clientName">Client Name *</Label>
              <Input
                id="clientName"
                value={formData.clientName}
                onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                placeholder="Enter client name"
                data-testid="input-client-name"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="clientPhone">Phone</Label>
                <Input
                  id="clientPhone"
                  value={formData.clientPhone}
                  onChange={(e) => setFormData({ ...formData, clientPhone: e.target.value })}
                  placeholder="(555) 000-0000"
                  data-testid="input-client-phone"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="channel">Channel</Label>
                <Select
                  value={formData.channel}
                  onValueChange={(v) => setFormData({ ...formData, channel: v as any })}
                >
                  <SelectTrigger data-testid="select-channel">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="voice">Voice Call</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="scheduledAt">Schedule Date & Time *</Label>
              <Input
                id="scheduledAt"
                type="datetime-local"
                value={formData.scheduledAt}
                onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
                data-testid="input-scheduled-at"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Message *</Label>
              <Input
                id="message"
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder="Reminder: Your appointment is tomorrow at..."
                data-testid="input-message"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-reminder">
                {createMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : null}
                Schedule
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
