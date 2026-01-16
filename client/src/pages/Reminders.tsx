import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Bell, 
  Plus, 
  Phone, 
  Mail, 
  MessageSquare, 
  Trash2, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Loader2,
  Calendar,
  User,
  Send,
  Sparkles,
  AlertCircle,
  ChevronRight
} from "lucide-react";
import type { Reminder } from "@shared/schema";

type FilterStatus = "all" | "pending" | "sent" | "failed";

export default function Reminders() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
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
      toast({ title: "Reminder scheduled successfully" });
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

  const getChannelLabel = (channel: string) => {
    switch (channel) {
      case "sms": return "SMS";
      case "voice": return "Voice";
      case "email": return "Email";
      default: return channel;
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "pending":
        return { 
          icon: Clock, 
          label: "Pending", 
          className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
          dotColor: "bg-amber-500"
        };
      case "sent":
        return { 
          icon: CheckCircle, 
          label: "Sent", 
          className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
          dotColor: "bg-blue-500"
        };
      case "acknowledged":
        return { 
          icon: CheckCircle, 
          label: "Confirmed", 
          className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
          dotColor: "bg-green-500"
        };
      case "failed":
        return { 
          icon: XCircle, 
          label: "Failed", 
          className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
          dotColor: "bg-red-500"
        };
      default:
        return { 
          icon: AlertCircle, 
          label: status, 
          className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
          dotColor: "bg-gray-500"
        };
    }
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = date.toDateString() === tomorrow.toDateString();

    if (isToday) {
      return `Today at ${date.toLocaleString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}`;
    }
    if (isTomorrow) {
      return `Tomorrow at ${date.toLocaleString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}`;
    }
    return date.toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const filteredReminders = reminders.filter(reminder => {
    if (filterStatus === "all") return true;
    return reminder.status === filterStatus;
  });

  const pendingCount = reminders.filter(r => r.status === "pending").length;
  const sentCount = reminders.filter(r => r.status === "sent" || r.status === "acknowledged").length;
  const failedCount = reminders.filter(r => r.status === "failed").length;

  const quickMessages = [
    "Reminder: Your appointment is tomorrow at",
    "Just checking in about your upcoming appointment",
    "Don't forget about your scheduled service",
    "Following up on your recent inquiry",
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="pb-24" data-testid="page-reminders">
      {/* Header with gradient */}
      <div className="bg-gradient-to-br from-violet-500 to-purple-600 text-white p-6 rounded-b-3xl mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Reminders</h1>
            <p className="text-violet-100 text-sm">Keep your clients informed</p>
          </div>
          <Button 
            onClick={() => setIsDialogOpen(true)} 
            className="bg-white/20 hover:bg-white/30 backdrop-blur-sm border-0"
            data-testid="button-add-reminder"
          >
            <Plus className="h-4 w-4 mr-2" />
            New
          </Button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center">
            <div className="text-2xl font-bold">{pendingCount}</div>
            <div className="text-xs text-violet-100">Pending</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center">
            <div className="text-2xl font-bold">{sentCount}</div>
            <div className="text-xs text-violet-100">Sent</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center">
            <div className="text-2xl font-bold">{reminders.length}</div>
            <div className="text-xs text-violet-100">Total</div>
          </div>
        </div>
      </div>

      <div className="content-container space-y-4">
        {/* Filter tabs */}
        <Tabs value={filterStatus} onValueChange={(v) => setFilterStatus(v as FilterStatus)}>
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="all" data-testid="tab-all">
              All
            </TabsTrigger>
            <TabsTrigger value="pending" data-testid="tab-pending">
              Pending {pendingCount > 0 && `(${pendingCount})`}
            </TabsTrigger>
            <TabsTrigger value="sent" data-testid="tab-sent">
              Sent
            </TabsTrigger>
            <TabsTrigger value="failed" data-testid="tab-failed">
              Failed {failedCount > 0 && `(${failedCount})`}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {filteredReminders.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center mx-auto mb-4">
                <Bell className="h-8 w-8 text-violet-500" />
              </div>
              <h3 className="font-semibold text-lg mb-2">
                {filterStatus === "all" ? "No reminders yet" : `No ${filterStatus} reminders`}
              </h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">
                {filterStatus === "all" 
                  ? "Schedule SMS, voice, or email reminders to keep your clients informed about their appointments."
                  : `You don't have any reminders with "${filterStatus}" status.`
                }
              </p>
              {filterStatus === "all" && (
                <Button onClick={() => setIsDialogOpen(true)} data-testid="button-create-first-reminder">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Create Your First Reminder
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredReminders.map((reminder) => {
              const statusConfig = getStatusConfig(reminder.status);
              const StatusIcon = statusConfig.icon;
              const isPast = new Date(reminder.scheduledAt) < new Date();
              
              return (
                <Card 
                  key={reminder.id} 
                  className={`overflow-hidden transition-all hover:shadow-md ${isPast && reminder.status === "pending" ? "border-amber-300 dark:border-amber-700" : ""}`}
                  data-testid={`card-reminder-${reminder.id}`}
                >
                  <CardContent className="p-0">
                    <div className="flex">
                      {/* Left accent */}
                      <div className={`w-1 ${statusConfig.dotColor}`} />
                      
                      <div className="flex-1 p-4">
                        <div className="flex items-start gap-3">
                          {/* Channel icon */}
                          <div className={`p-2.5 rounded-xl ${
                            reminder.channel === "sms" ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" :
                            reminder.channel === "voice" ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" :
                            "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
                          }`}>
                            {getChannelIcon(reminder.channel)}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            {/* Header row */}
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold truncate">{reminder.clientName}</span>
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                  {getChannelLabel(reminder.channel)}
                                </Badge>
                              </div>
                              <Badge className={`${statusConfig.className} text-[10px] px-2 py-0.5 flex items-center gap-1`}>
                                <StatusIcon className="h-3 w-3" />
                                {statusConfig.label}
                              </Badge>
                            </div>
                            
                            {/* Message */}
                            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                              {reminder.message}
                            </p>
                            
                            {/* Footer */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                <span>{formatDateTime(reminder.scheduledAt)}</span>
                                {isPast && reminder.status === "pending" && (
                                  <Badge variant="outline" className="text-[10px] ml-2 text-amber-600 border-amber-300">
                                    Overdue
                                  </Badge>
                                )}
                              </div>
                              
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => deleteMutation.mutate(reminder.id)}
                                disabled={deleteMutation.isPending}
                                data-testid={`button-delete-reminder-${reminder.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Reminder Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md" data-testid="dialog-create-reminder">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-violet-500" />
              Schedule Reminder
            </DialogTitle>
            <DialogDescription>
              Send an automated reminder to your client via SMS, voice, or email.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Client Info */}
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="clientName" className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  Client Name *
                </Label>
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
                  <Label htmlFor="clientPhone" className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    Phone
                  </Label>
                  <Input
                    id="clientPhone"
                    value={formData.clientPhone}
                    onChange={(e) => setFormData({ ...formData, clientPhone: e.target.value })}
                    placeholder="(555) 000-0000"
                    data-testid="input-client-phone"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientEmail" className="flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    Email
                  </Label>
                  <Input
                    id="clientEmail"
                    type="email"
                    value={formData.clientEmail}
                    onChange={(e) => setFormData({ ...formData, clientEmail: e.target.value })}
                    placeholder="client@email.com"
                    data-testid="input-client-email"
                  />
                </div>
              </div>
            </div>

            {/* Channel Selection */}
            <div className="space-y-2">
              <Label>Delivery Channel *</Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: "sms", label: "SMS", icon: MessageSquare, color: "blue" },
                  { value: "voice", label: "Voice", icon: Phone, color: "green" },
                  { value: "email", label: "Email", icon: Mail, color: "purple" },
                ].map(({ value, label, icon: Icon, color }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFormData({ ...formData, channel: value as any })}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                      formData.channel === value 
                        ? `border-${color}-500 bg-${color}-50 dark:bg-${color}-900/20` 
                        : "border-border hover:border-muted-foreground/30"
                    }`}
                    data-testid={`button-channel-${value}`}
                  >
                    <Icon className={`h-5 w-5 ${formData.channel === value ? `text-${color}-500` : "text-muted-foreground"}`} />
                    <span className={`text-xs font-medium ${formData.channel === value ? `text-${color}-600 dark:text-${color}-400` : "text-muted-foreground"}`}>
                      {label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Schedule */}
            <div className="space-y-2">
              <Label htmlFor="scheduledAt" className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Schedule Date & Time *
              </Label>
              <Input
                id="scheduledAt"
                type="datetime-local"
                value={formData.scheduledAt}
                onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
                data-testid="input-scheduled-at"
              />
            </div>

            {/* Message */}
            <div className="space-y-2">
              <Label htmlFor="message" className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                Message *
              </Label>
              <Textarea
                id="message"
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder="Write your reminder message..."
                rows={3}
                data-testid="input-message"
              />
              
              {/* Quick message suggestions */}
              <div className="flex flex-wrap gap-1.5">
                {quickMessages.map((msg, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setFormData({ ...formData, message: msg })}
                    className="text-[10px] px-2 py-1 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
                    data-testid={`button-quick-message-${i}`}
                  >
                    {msg.slice(0, 30)}...
                  </button>
                ))}
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createMutation.isPending} 
                className="bg-violet-500 hover:bg-violet-600"
                data-testid="button-save-reminder"
              >
                {createMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Schedule Reminder
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
