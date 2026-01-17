import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Calendar, Clock, Loader2, Sparkles, Check, Plus, UserPlus, RefreshCw } from "lucide-react";
import { useLocation } from "wouter";
import type { Job, Lead } from "@shared/schema";

interface ScheduleSuggestion {
  date: string;
  time: string;
  reason: string;
}

interface SmartSchedulingProps {
  jobDuration?: number;
  onSelectSlot?: (date: string, time: string) => void;
}

export function SmartScheduling({ jobDuration = 60, onSelectSlot }: SmartSchedulingProps) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [duration, setDuration] = useState(jobDuration);
  const [preferredDate, setPreferredDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<ScheduleSuggestion | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [showLeadSelector, setShowLeadSelector] = useState(false);

  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const { data: leads = [] } = useQuery<Lead[]>({
    queryKey: ["/api/leads"],
  });

  const suggestMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/ai/schedule-suggestions", {
        duration,
        preferredDate: preferredDate || undefined,
      });
      return response.json() as Promise<{ suggestions: ScheduleSuggestion[] }>;
    },
    onError: () => {
      toast({ title: "Failed to get schedule suggestions", variant: "destructive" });
    },
  });

  const handleSuggest = () => {
    suggestMutation.mutate();
  };

  const handleSelectSlot = (slot: ScheduleSuggestion) => {
    setSelectedSlot(slot);
    onSelectSlot?.(slot.date, slot.time);
    toast({ title: "Time slot selected!" });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(":");
    const h = parseInt(hours);
    const ampm = h >= 12 ? "PM" : "AM";
    const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Smart Scheduling
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="duration" className="text-sm">Job Duration (min)</Label>
            <Input
              id="duration"
              type="number"
              min={15}
              step={15}
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value) || 60)}
              data-testid="input-job-duration"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="preferredDate" className="text-sm">Preferred Date</Label>
            <Input
              id="preferredDate"
              type="date"
              value={preferredDate}
              onChange={(e) => setPreferredDate(e.target.value)}
              data-testid="input-preferred-date"
            />
          </div>
        </div>

        <Button
          onClick={handleSuggest}
          disabled={suggestMutation.isPending}
          className="w-full"
          data-testid="button-suggest-slots"
        >
          {suggestMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Sparkles className="h-4 w-4 mr-2" />
          )}
          Find Best Time Slots
        </Button>

        {suggestMutation.data?.suggestions && suggestMutation.data.suggestions.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Suggested Slots</p>
            {suggestMutation.data.suggestions.map((slot, idx) => (
              <div
                key={idx}
                onClick={() => handleSelectSlot(slot)}
                className={`p-3 rounded-md border cursor-pointer transition-colors hover-elevate ${
                  selectedSlot?.date === slot.date && selectedSlot?.time === slot.time
                    ? "border-primary bg-primary/5"
                    : "border-border"
                }`}
                data-testid={`slot-suggestion-${idx}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{formatDate(slot.date)}</span>
                    <span className="text-muted-foreground">at</span>
                    <span className="font-medium">{formatTime(slot.time)}</span>
                  </div>
                  {selectedSlot?.date === slot.date && selectedSlot?.time === slot.time && (
                    <Check className="h-4 w-4" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{slot.reason}</p>
              </div>
            ))}
          </div>
        )}

        {selectedSlot && (
          <div className="space-y-3 p-3 rounded-md bg-muted/50">
            <p className="text-sm font-medium">What would you like to do with this time slot?</p>
            
            <div className="flex flex-col gap-2">
              <Button
                onClick={() => {
                  const params = new URLSearchParams();
                  params.set("scheduledDate", selectedSlot.date);
                  params.set("scheduledTime", selectedSlot.time);
                  navigate(`/jobs/new?${params.toString()}`);
                }}
                className="w-full"
                data-testid="button-create-job-from-slot"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create New Job
              </Button>

              {!showLeadSelector ? (
                <Button
                  variant="outline"
                  onClick={() => setShowLeadSelector(true)}
                  className="w-full"
                  disabled={leads.length === 0}
                  data-testid="button-apply-to-lead"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  {leads.length === 0 ? "No Leads Available" : "Apply to Existing Lead"}
                </Button>
              ) : (
                <div className="space-y-2">
                  <Select value={selectedLeadId} onValueChange={setSelectedLeadId}>
                    <SelectTrigger data-testid="select-lead">
                      <SelectValue placeholder="Select a lead..." />
                    </SelectTrigger>
                    <SelectContent>
                      {leads.map((lead) => (
                        <SelectItem key={lead.id} value={lead.id}>
                          {lead.clientName} - {lead.serviceType}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowLeadSelector(false);
                        setSelectedLeadId("");
                      }}
                      className="flex-1"
                      data-testid="button-cancel-lead-select"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      disabled={!selectedLeadId}
                      onClick={() => {
                        const params = new URLSearchParams();
                        params.set("leadId", selectedLeadId);
                        params.set("scheduledDate", selectedSlot.date);
                        params.set("scheduledTime", selectedSlot.time);
                        navigate(`/jobs/new?${params.toString()}`);
                      }}
                      className="flex-1"
                      data-testid="button-confirm-lead-select"
                    >
                      Apply Schedule
                    </Button>
                  </div>
                </div>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedSlot(null);
                  setShowLeadSelector(false);
                  setSelectedLeadId("");
                  suggestMutation.reset();
                }}
                className="w-full"
                data-testid="button-start-over"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Start Over
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
