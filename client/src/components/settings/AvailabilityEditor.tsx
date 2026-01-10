import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock } from "lucide-react";
import type { WeeklyAvailability, DayAvailability } from "@shared/schema";

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
  monday: { enabled: true, start: "09:00", end: "17:00" },
  tuesday: { enabled: true, start: "09:00", end: "17:00" },
  wednesday: { enabled: true, start: "09:00", end: "17:00" },
  thursday: { enabled: true, start: "09:00", end: "17:00" },
  friday: { enabled: true, start: "09:00", end: "17:00" },
  saturday: { enabled: false, start: "09:00", end: "17:00" },
  sunday: { enabled: false, start: "09:00", end: "17:00" },
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
        <CardDescription>Set your working hours for each day</CardDescription>
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

        <div className="space-y-3 pt-2">
          {DAYS.map(({ key, label }) => {
            const day = currentAvailability[key];
            return (
              <div 
                key={key} 
                className={`flex items-center gap-3 p-3 rounded-lg border ${day.enabled ? "bg-background" : "bg-muted/50"}`}
                data-testid={`availability-${key}`}
              >
                <Switch
                  checked={day.enabled}
                  onCheckedChange={(enabled) => updateDay(key, { enabled })}
                  data-testid={`switch-${key}`}
                />
                <span className={`w-24 font-medium ${!day.enabled ? "text-muted-foreground" : ""}`}>
                  {label}
                </span>
                {day.enabled ? (
                  <div className="flex items-center gap-2 flex-1">
                    <Select
                      value={day.start}
                      onValueChange={(start) => updateDay(key, { start })}
                    >
                      <SelectTrigger className="w-28" data-testid={`select-${key}-start`}>
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
                      value={day.end}
                      onValueChange={(end) => updateDay(key, { end })}
                    >
                      <SelectTrigger className="w-28" data-testid={`select-${key}-end`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_OPTIONS.filter((t) => t > day.start).map((time) => (
                          <SelectItem key={time} value={time}>
                            {formatTime(time)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">Unavailable</span>
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
