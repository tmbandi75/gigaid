import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Plus, Trash2, Calendar } from "lucide-react";
import type { WeeklyAvailability, DayAvailability, TimeRange } from "@shared/schema";

const DAYS = [
  { key: "monday", label: "Mon", fullLabel: "Monday" },
  { key: "tuesday", label: "Tue", fullLabel: "Tuesday" },
  { key: "wednesday", label: "Wed", fullLabel: "Wednesday" },
  { key: "thursday", label: "Thu", fullLabel: "Thursday" },
  { key: "friday", label: "Fri", fullLabel: "Friday" },
  { key: "saturday", label: "Sat", fullLabel: "Saturday" },
  { key: "sunday", label: "Sun", fullLabel: "Sunday" },
] as const;

const TIME_OPTIONS = [
  "06:00", "06:30", "07:00", "07:30", "08:00", "08:30", "09:00", "09:30",
  "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00", "13:30",
  "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
  "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30", "22:00",
];

const DEFAULT_AVAILABILITY: WeeklyAvailability = {
  monday: { enabled: true, ranges: [{ start: "09:00", end: "17:00" }] },
  tuesday: { enabled: true, ranges: [{ start: "09:00", end: "17:00" }] },
  wednesday: { enabled: true, ranges: [{ start: "09:00", end: "17:00" }] },
  thursday: { enabled: true, ranges: [{ start: "09:00", end: "17:00" }] },
  friday: { enabled: true, ranges: [{ start: "09:00", end: "17:00" }] },
  saturday: { enabled: false, ranges: [{ start: "09:00", end: "17:00" }] },
  sunday: { enabled: false, ranges: [{ start: "09:00", end: "17:00" }] },
};

const SLOT_DURATIONS = [
  { value: "30", label: "30 min" },
  { value: "60", label: "1 hour" },
  { value: "90", label: "1.5 hours" },
  { value: "120", label: "2 hours" },
];

interface AvailabilityEditorProps {
  availability: WeeklyAvailability | null;
  slotDuration: number;
  onChange: (availability: WeeklyAvailability, slotDuration: number) => void;
}

export function AvailabilityEditor({ availability, slotDuration, onChange }: AvailabilityEditorProps) {
  const currentAvailability = availability || DEFAULT_AVAILABILITY;

  const updateDay = (day: keyof WeeklyAvailability, updates: Partial<DayAvailability>) => {
    const newAvailability = {
      ...currentAvailability,
      [day]: { ...currentAvailability[day], ...updates },
    };
    onChange(newAvailability, slotDuration);
  };

  const updateRange = (day: keyof WeeklyAvailability, rangeIndex: number, updates: Partial<TimeRange>) => {
    const dayData = currentAvailability[day];
    const newRanges = [...dayData.ranges];
    newRanges[rangeIndex] = { ...newRanges[rangeIndex], ...updates };
    updateDay(day, { ranges: newRanges });
  };

  const addRange = (day: keyof WeeklyAvailability) => {
    const dayData = currentAvailability[day];
    const lastRange = dayData.ranges[dayData.ranges.length - 1];
    const newStart = lastRange ? lastRange.end : "09:00";
    const startIndex = TIME_OPTIONS.indexOf(newStart);
    const newEnd = TIME_OPTIONS[Math.min(startIndex + 2, TIME_OPTIONS.length - 1)] || "17:00";
    updateDay(day, { ranges: [...dayData.ranges, { start: newStart, end: newEnd }] });
  };

  const removeRange = (day: keyof WeeklyAvailability, rangeIndex: number) => {
    const dayData = currentAvailability[day];
    const newRanges = dayData.ranges.filter((_, i) => i !== rangeIndex);
    updateDay(day, { ranges: newRanges.length > 0 ? newRanges : [{ start: "09:00", end: "17:00" }] });
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(":");
    const h = parseInt(hours);
    const ampm = h >= 12 ? "PM" : "AM";
    const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getTotalHours = () => {
    let total = 0;
    DAYS.forEach(({ key }) => {
      const day = currentAvailability[key];
      if (day.enabled) {
        day.ranges.forEach((range) => {
          const [startH, startM] = range.start.split(":").map(Number);
          const [endH, endM] = range.end.split(":").map(Number);
          total += (endH * 60 + endM - startH * 60 - startM) / 60;
        });
      }
    });
    return total;
  };

  const enabledDays = DAYS.filter(({ key }) => currentAvailability[key].enabled).length;

  return (
    <Card data-testid="card-availability">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Availability
            </CardTitle>
            <CardDescription>Set when clients can book you</CardDescription>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{getTotalHours().toFixed(0)}h</div>
            <p className="text-xs text-muted-foreground">{enabledDays} days/week</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <div className="flex-1">
            <Label className="text-sm">Appointment Duration</Label>
          </div>
          <div className="flex gap-1">
            {SLOT_DURATIONS.map((opt) => (
              <Badge
                key={opt.value}
                variant={slotDuration.toString() === opt.value ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => onChange(currentAvailability, parseInt(opt.value))}
                data-testid={`badge-duration-${opt.value}`}
              >
                {opt.label}
              </Badge>
            ))}
          </div>
        </div>

        <div className="grid gap-3">
          {DAYS.map(({ key, label, fullLabel }) => {
            const day = currentAvailability[key];
            return (
              <div 
                key={key} 
                className={`rounded-lg border transition-all ${
                  day.enabled 
                    ? "bg-background border-border" 
                    : "bg-muted/30 border-transparent"
                }`}
                data-testid={`availability-${key}`}
              >
                <div className="flex items-center gap-3 p-3">
                  <Switch
                    checked={day.enabled}
                    onCheckedChange={(enabled) => updateDay(key, { enabled })}
                    data-testid={`switch-${key}`}
                  />
                  <div className="w-20">
                    <span className="font-medium hidden sm:inline">{fullLabel}</span>
                    <span className="font-medium sm:hidden">{label}</span>
                  </div>
                  
                  {day.enabled ? (
                    <div className="flex-1 flex flex-wrap items-center gap-2">
                      {day.ranges.map((range, rangeIndex) => (
                        <div 
                          key={rangeIndex} 
                          className="flex items-center gap-1 px-2 py-1 rounded-md bg-primary/5 border border-primary/10"
                        >
                          <Select
                            value={range.start}
                            onValueChange={(start) => updateRange(key, rangeIndex, { start })}
                          >
                            <SelectTrigger className="h-7 w-20 text-xs border-0 bg-transparent p-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {TIME_OPTIONS.map((time) => (
                                <SelectItem key={time} value={time} className="text-xs">
                                  {formatTime(time)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <span className="text-xs text-muted-foreground">-</span>
                          <Select
                            value={range.end}
                            onValueChange={(end) => updateRange(key, rangeIndex, { end })}
                          >
                            <SelectTrigger className="h-7 w-20 text-xs border-0 bg-transparent p-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {TIME_OPTIONS.filter((t) => t > range.start).map((time) => (
                                <SelectItem key={time} value={time} className="text-xs">
                                  {formatTime(time)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {day.ranges.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeRange(key, rangeIndex)}
                              className="p-1 hover:bg-destructive/10 rounded"
                              data-testid={`button-remove-range-${key}-${rangeIndex}`}
                            >
                              <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                            </button>
                          )}
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => addRange(key)}
                        className="h-7 px-2 text-xs"
                        data-testid={`button-add-range-${key}`}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add
                      </Button>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">Unavailable</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export { DEFAULT_AVAILABILITY };
