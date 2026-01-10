import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Clock, Plus, Trash2 } from "lucide-react";
import type { WeeklyAvailability, DayAvailability, TimeRange } from "@shared/schema";

const DAYS = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
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

  return (
    <Card data-testid="card-availability">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Availability
        </CardTitle>
        <CardDescription>Set your working hours for each day. Add multiple time slots per day.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Appointment Duration</Label>
          <Select
            value={slotDuration.toString()}
            onValueChange={(v) => onChange(currentAvailability, parseInt(v))}
          >
            <SelectTrigger data-testid="select-slot-duration">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">30 minutes</SelectItem>
              <SelectItem value="60">1 hour</SelectItem>
              <SelectItem value="90">1.5 hours</SelectItem>
              <SelectItem value="120">2 hours</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-4 pt-2">
          {DAYS.map(({ key, label }) => {
            const day = currentAvailability[key];
            return (
              <div 
                key={key} 
                className={`p-4 rounded-lg border ${day.enabled ? "bg-background" : "bg-muted/50"}`}
                data-testid={`availability-${key}`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <Switch
                    checked={day.enabled}
                    onCheckedChange={(enabled) => updateDay(key, { enabled })}
                    data-testid={`switch-${key}`}
                  />
                  <span className={`font-medium ${!day.enabled ? "text-muted-foreground" : ""}`}>
                    {label}
                  </span>
                </div>

                {day.enabled && (
                  <div className="space-y-2 pl-10">
                    {day.ranges.map((range, rangeIndex) => (
                      <div key={rangeIndex} className="flex items-center gap-2 flex-wrap">
                        <Select
                          value={range.start}
                          onValueChange={(start) => updateRange(key, rangeIndex, { start })}
                        >
                          <SelectTrigger className="w-28" data-testid={`select-${key}-${rangeIndex}-start`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TIME_OPTIONS.map((time) => (
                              <SelectItem key={time} value={time}>
                                {formatTime(time)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <span className="text-muted-foreground">to</span>
                        <Select
                          value={range.end}
                          onValueChange={(end) => updateRange(key, rangeIndex, { end })}
                        >
                          <SelectTrigger className="w-28" data-testid={`select-${key}-${rangeIndex}-end`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TIME_OPTIONS.filter((t) => t > range.start).map((time) => (
                              <SelectItem key={time} value={time}>
                                {formatTime(time)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {day.ranges.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeRange(key, rangeIndex)}
                            data-testid={`button-remove-range-${key}-${rangeIndex}`}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => addRange(key)}
                      className="mt-1"
                      data-testid={`button-add-range-${key}`}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add time slot
                    </Button>
                  </div>
                )}

                {!day.enabled && (
                  <p className="text-sm text-muted-foreground pl-10">Unavailable</p>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export { DEFAULT_AVAILABILITY };
