import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Plus, Trash2, Calendar, ChevronDown, ChevronUp, Pencil } from "lucide-react";
import type { WeeklyAvailability, DayAvailability, TimeRange } from "@shared/schema";

const DAYS = [
  { key: "monday", label: "M", fullLabel: "Monday" },
  { key: "tuesday", label: "T", fullLabel: "Tuesday" },
  { key: "wednesday", label: "W", fullLabel: "Wednesday" },
  { key: "thursday", label: "T", fullLabel: "Thursday" },
  { key: "friday", label: "F", fullLabel: "Friday" },
  { key: "saturday", label: "S", fullLabel: "Saturday" },
  { key: "sunday", label: "S", fullLabel: "Sunday" },
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
  const [expandedDay, setExpandedDay] = useState<keyof WeeklyAvailability | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const updateDay = (day: keyof WeeklyAvailability, updates: Partial<DayAvailability>) => {
    const newAvailability = {
      ...currentAvailability,
      [day]: { ...currentAvailability[day], ...updates },
    };
    onChange(newAvailability, slotDuration);
  };

  const toggleDay = (day: keyof WeeklyAvailability) => {
    const dayData = currentAvailability[day];
    updateDay(day, { enabled: !dayData.enabled });
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

  const formatTimeShort = (time: string) => {
    const [hours] = time.split(":");
    const h = parseInt(hours);
    const ampm = h >= 12 ? "p" : "a";
    const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${displayHour}${ampm}`;
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

  const enabledDays = DAYS.filter(({ key }) => currentAvailability[key].enabled);

  const getAvailabilitySummary = () => {
    if (enabledDays.length === 0) return "No availability set";
    
    const dayGroups: { days: string[]; range: string }[] = [];
    
    enabledDays.forEach(({ key, fullLabel }) => {
      const day = currentAvailability[key];
      const rangeStr = day.ranges.map(r => `${formatTimeShort(r.start)}-${formatTimeShort(r.end)}`).join(", ");
      
      const existingGroup = dayGroups.find(g => g.range === rangeStr);
      if (existingGroup) {
        existingGroup.days.push(fullLabel.slice(0, 3));
      } else {
        dayGroups.push({ days: [fullLabel.slice(0, 3)], range: rangeStr });
      }
    });
    
    return dayGroups.map(g => {
      const daysStr = g.days.length > 2 
        ? `${g.days[0]}-${g.days[g.days.length - 1]}`
        : g.days.join(", ");
      return `${daysStr}: ${g.range}`;
    }).join(" · ");
  };

  return (
    <Card data-testid="card-availability">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4 shrink-0" />
              Availability
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">Set when clients can book you</CardDescription>
          </div>
          <div className="text-right shrink-0">
            <div className="text-xl font-bold">{getTotalHours().toFixed(0)}h</div>
            <p className="text-xs text-muted-foreground">{enabledDays.length} days/week</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {/* Appointment Duration - Compact */}
        <div className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50">
          <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
          <Label className="text-sm shrink-0">Duration</Label>
          <div className="flex gap-1 flex-wrap justify-end flex-1">
            {SLOT_DURATIONS.map((opt) => (
              <Badge
                key={opt.value}
                variant={slotDuration.toString() === opt.value ? "default" : "outline"}
                className="cursor-pointer text-xs"
                onClick={() => onChange(currentAvailability, parseInt(opt.value))}
                data-testid={`badge-duration-${opt.value}`}
              >
                {opt.label}
              </Badge>
            ))}
          </div>
        </div>

        {/* Day Pills - Horizontal Toggle Row */}
        <div className="space-y-2">
          <Label className="text-sm">Working Days</Label>
          <div className="flex gap-1.5" data-testid="day-pills-container">
            {DAYS.map(({ key, label, fullLabel }) => {
              const day = currentAvailability[key];
              return (
                <Badge
                  key={key}
                  variant={day.enabled ? "default" : "outline"}
                  className="flex-1 h-10 justify-center cursor-pointer text-sm font-medium"
                  onClick={() => toggleDay(key)}
                  data-testid={`day-toggle-${key}`}
                  aria-pressed={day.enabled}
                  aria-label={`${fullLabel} ${day.enabled ? 'enabled' : 'disabled'}`}
                >
                  {label}
                </Badge>
              );
            })}
          </div>
        </div>

        {/* Summary & Edit Toggle */}
        <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-muted/30 border">
          <p className="text-sm text-muted-foreground flex-1 min-w-0 truncate">
            {getAvailabilitySummary()}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              const newShowDetails = !showDetails;
              setShowDetails(newShowDetails);
              if (newShowDetails && enabledDays.length > 0) {
                setExpandedDay(enabledDays[0].key);
              } else {
                setExpandedDay(null);
              }
            }}
            className="shrink-0"
            data-testid="button-toggle-hours"
          >
            <Pencil className="h-3.5 w-3.5 mr-1.5" />
            {showDetails ? "Done" : "Edit Hours"}
            {showDetails ? <ChevronUp className="h-3.5 w-3.5 ml-1" /> : <ChevronDown className="h-3.5 w-3.5 ml-1" />}
          </Button>
        </div>

        {/* Expanded Time Editor */}
        {showDetails && (
          <div className="p-3 rounded-lg border bg-background space-y-3" data-testid="time-editor">
            {/* Day selector tabs within edit mode */}
            <div className="flex flex-wrap gap-1.5">
              {DAYS.map(({ key, fullLabel }) => {
                const day = currentAvailability[key];
                const isSelected = expandedDay === key;
                return (
                  <Badge
                    key={key}
                    variant={isSelected ? "default" : day.enabled ? "secondary" : "outline"}
                    className={`cursor-pointer text-xs ${!day.enabled ? "opacity-50" : ""}`}
                    onClick={() => setExpandedDay(key)}
                    data-testid={`badge-select-${key}`}
                  >
                    {fullLabel.slice(0, 3)}
                    {!day.enabled && " (off)"}
                  </Badge>
                );
              })}
            </div>

            {expandedDay && currentAvailability[expandedDay].enabled && (
              <>
                <div className="flex items-center justify-between gap-2 pt-2 border-t">
                  <Label className="font-medium">
                    {DAYS.find(d => d.key === expandedDay)?.fullLabel} Hours
                  </Label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Available</span>
                    <Switch
                      checked={currentAvailability[expandedDay].enabled}
                      onCheckedChange={(enabled) => updateDay(expandedDay, { enabled })}
                      aria-label={`Toggle ${DAYS.find(d => d.key === expandedDay)?.fullLabel} availability`}
                      data-testid={`switch-${expandedDay}`}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  {currentAvailability[expandedDay].ranges.map((range, rangeIndex) => (
                    <div 
                      key={rangeIndex} 
                      className="flex items-center gap-2 p-2 rounded-md bg-muted/50"
                    >
                      <Select
                        value={range.start}
                        onValueChange={(start) => updateRange(expandedDay, rangeIndex, { start })}
                      >
                        <SelectTrigger className="h-9 flex-1 text-sm" data-testid={`select-start-${rangeIndex}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIME_OPTIONS.map((time) => (
                            <SelectItem key={time} value={time} className="text-sm">
                              {formatTime(time)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-sm text-muted-foreground">to</span>
                      <Select
                        value={range.end}
                        onValueChange={(end) => updateRange(expandedDay, rangeIndex, { end })}
                      >
                        <SelectTrigger className="h-9 flex-1 text-sm" data-testid={`select-end-${rangeIndex}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIME_OPTIONS.filter((t) => t > range.start).map((time) => (
                            <SelectItem key={time} value={time} className="text-sm">
                              {formatTime(time)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {currentAvailability[expandedDay].ranges.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeRange(expandedDay, rangeIndex)}
                          data-testid={`button-remove-range-${rangeIndex}`}
                          aria-label="Remove time range"
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addRange(expandedDay)}
                    className="w-full"
                    data-testid="button-add-range"
                  >
                    <Plus className="h-4 w-4 mr-1.5" />
                    Add Time Block
                  </Button>
                </div>
              </>
            )}

            {expandedDay && !currentAvailability[expandedDay].enabled && (
              <div className="p-3 rounded-lg bg-muted/30 text-center border-t pt-4">
                <p className="text-sm text-muted-foreground mb-2">
                  {DAYS.find(d => d.key === expandedDay)?.fullLabel} is currently off
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => updateDay(expandedDay, { enabled: true })}
                  data-testid={`button-enable-${expandedDay}`}
                >
                  Enable {DAYS.find(d => d.key === expandedDay)?.fullLabel}
                </Button>
              </div>
            )}

            {!expandedDay && enabledDays.length > 0 && (
              <div className="p-3 rounded-lg bg-muted/30 text-center">
                <p className="text-sm text-muted-foreground">
                  Select a day above to edit its hours
                </p>
              </div>
            )}

            {enabledDays.length === 0 && (
              <div className="p-3 rounded-lg bg-muted/30 text-center">
                <p className="text-sm text-muted-foreground">
                  Enable at least one working day above to set hours
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export { DEFAULT_AVAILABILITY };
