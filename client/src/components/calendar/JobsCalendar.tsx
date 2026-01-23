import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  LayoutGrid,
  List,
  Clock
} from "lucide-react";
import { useLocation } from "wouter";
import type { Job } from "@shared/schema";
import { cn } from "@/lib/utils";

type CalendarView = "month" | "week";

interface JobsCalendarProps {
  jobs: Job[];
}

const statusColors: Record<string, string> = {
  scheduled: "bg-blue-500",
  in_progress: "bg-amber-500",
  completed: "bg-emerald-500",
  cancelled: "bg-gray-400",
};

const statusLabels: Record<string, string> = {
  scheduled: "Coming Up",
  in_progress: "Working On",
  completed: "Done",
  cancelled: "Cancelled",
};

function formatTime(time: string): string {
  if (!time) return "";
  const [hours, minutes] = time.split(':');
  const h = parseInt(hours);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = [];
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  
  const startPadding = firstDay.getDay();
  for (let i = startPadding - 1; i >= 0; i--) {
    days.push(new Date(year, month, -i));
  }
  
  for (let day = 1; day <= lastDay.getDate(); day++) {
    days.push(new Date(year, month, day));
  }
  
  const endPadding = 6 - lastDay.getDay();
  for (let i = 1; i <= endPadding; i++) {
    days.push(new Date(year, month + 1, i));
  }
  
  return days;
}

function getWeekDays(date: Date): Date[] {
  const days: Date[] = [];
  const start = new Date(date);
  start.setDate(start.getDate() - start.getDay());
  
  for (let i = 0; i < 7; i++) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    days.push(day);
  }
  
  return days;
}

function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

function JobEvent({ job, compact = false }: { job: Job; compact?: boolean }) {
  const [, navigate] = useLocation();
  
  return (
    <div
      className={cn(
        "rounded px-1.5 py-0.5 text-white text-xs cursor-pointer hover-elevate truncate",
        statusColors[job.status] || "bg-gray-500",
        compact ? "text-[10px]" : ""
      )}
      onClick={(e) => {
        e.stopPropagation();
        navigate(`/jobs/${job.id}`);
      }}
      data-testid={`calendar-job-${job.id}`}
    >
      {compact ? (
        <span className="truncate">{job.clientName}</span>
      ) : (
        <div className="flex items-center gap-1">
          {job.scheduledTime && (
            <span className="font-medium">{formatTime(job.scheduledTime)}</span>
          )}
          <span className="truncate">{job.clientName}</span>
        </div>
      )}
    </div>
  );
}

function DayCell({ 
  date, 
  jobs, 
  isCurrentMonth, 
  isToday 
}: { 
  date: Date; 
  jobs: Job[]; 
  isCurrentMonth: boolean;
  isToday: boolean;
}) {
  const maxVisible = 3;
  const visibleJobs = jobs.slice(0, maxVisible);
  const remaining = jobs.length - maxVisible;
  
  return (
    <div 
      className={cn(
        "min-h-[80px] md:min-h-[100px] p-1 border-b border-r border-border",
        !isCurrentMonth && "bg-muted/30",
        isToday && "bg-primary/5"
      )}
      data-testid={`calendar-day-${date.toISOString().split('T')[0]}`}
    >
      <div className={cn(
        "text-xs font-medium mb-1",
        !isCurrentMonth && "text-muted-foreground",
        isToday && "text-primary font-bold"
      )}>
        {isToday ? (
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground">
            {date.getDate()}
          </span>
        ) : (
          date.getDate()
        )}
      </div>
      <div className="space-y-0.5">
        {visibleJobs.map((job) => (
          <JobEvent key={job.id} job={job} compact />
        ))}
        {remaining > 0 && (
          <div className="text-[10px] text-muted-foreground pl-1">
            +{remaining} more
          </div>
        )}
      </div>
    </div>
  );
}

function WeekDayColumn({ 
  date, 
  jobs, 
  isToday 
}: { 
  date: Date; 
  jobs: Job[];
  isToday: boolean;
}) {
  const sortedJobs = [...jobs].sort((a, b) => {
    if (!a.scheduledTime || !b.scheduledTime) return 0;
    return a.scheduledTime.localeCompare(b.scheduledTime);
  });
  
  return (
    <div 
      className={cn(
        "flex-1 min-w-0 border-r border-border last:border-r-0",
        isToday && "bg-primary/5"
      )}
    >
      <div className={cn(
        "text-center py-2 border-b border-border sticky top-0 bg-background z-10",
        isToday && "bg-primary/5"
      )}>
        <div className="text-xs text-muted-foreground">
          {date.toLocaleDateString('en-US', { weekday: 'short' })}
        </div>
        <div className={cn(
          "text-lg font-semibold",
          isToday && "text-primary"
        )}>
          {isToday ? (
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground">
              {date.getDate()}
            </span>
          ) : (
            date.getDate()
          )}
        </div>
      </div>
      <div className="p-1 space-y-1 min-h-[200px]">
        {sortedJobs.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-4">
            No jobs
          </div>
        ) : (
          sortedJobs.map((job) => (
            <JobEvent key={job.id} job={job} />
          ))
        )}
      </div>
    </div>
  );
}

export function JobsCalendar({ jobs }: JobsCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>("month");
  const today = new Date();
  
  const jobsByDate = useMemo(() => {
    const map = new Map<string, Job[]>();
    jobs.forEach((job) => {
      if (job.scheduledDate) {
        const dateKey = job.scheduledDate.split('T')[0];
        if (!map.has(dateKey)) {
          map.set(dateKey, []);
        }
        map.get(dateKey)!.push(job);
      }
    });
    return map;
  }, [jobs]);
  
  const navigatePeriod = (direction: number) => {
    const newDate = new Date(currentDate);
    if (view === "month") {
      newDate.setMonth(newDate.getMonth() + direction);
    } else {
      newDate.setDate(newDate.getDate() + direction * 7);
    }
    setCurrentDate(newDate);
  };
  
  const goToToday = () => {
    setCurrentDate(new Date());
  };
  
  const days = view === "month" 
    ? getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth())
    : getWeekDays(currentDate);
  
  const headerTitle = view === "month"
    ? currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : `Week of ${days[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  
  return (
    <Card className="border-0 shadow-md" data-testid="jobs-calendar">
      <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 space-y-0">
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => navigatePeriod(-1)}
            data-testid="calendar-prev"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => navigatePeriod(1)}
            data-testid="calendar-next"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={goToToday}
            data-testid="calendar-today"
          >
            Today
          </Button>
        </div>
        
        <h3 className="font-semibold text-lg" data-testid="calendar-title">
          {headerTitle}
        </h3>
        
        <div className="flex items-center gap-1">
          <Button
            variant={view === "month" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setView("month")}
            data-testid="calendar-view-month"
          >
            <LayoutGrid className="h-4 w-4 mr-1" />
            Month
          </Button>
          <Button
            variant={view === "week" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setView("week")}
            data-testid="calendar-view-week"
          >
            <List className="h-4 w-4 mr-1" />
            Week
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        {view === "month" ? (
          <div className="border-t border-l border-border">
            <div className="grid grid-cols-7">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div 
                  key={day} 
                  className="text-xs font-medium text-muted-foreground text-center py-2 border-b border-r border-border bg-muted/50"
                >
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((date, index) => {
                const dateKey = date.toISOString().split('T')[0];
                const dayJobs = jobsByDate.get(dateKey) || [];
                const isCurrentMonth = date.getMonth() === currentDate.getMonth();
                const isToday = isSameDay(date, today);
                
                return (
                  <DayCell
                    key={index}
                    date={date}
                    jobs={dayJobs}
                    isCurrentMonth={isCurrentMonth}
                    isToday={isToday}
                  />
                );
              })}
            </div>
          </div>
        ) : (
          <div className="border-t border-l border-border flex">
            {days.map((date, index) => {
              const dateKey = date.toISOString().split('T')[0];
              const dayJobs = jobsByDate.get(dateKey) || [];
              const isToday = isSameDay(date, today);
              
              return (
                <WeekDayColumn
                  key={index}
                  date={date}
                  jobs={dayJobs}
                  isToday={isToday}
                />
              );
            })}
          </div>
        )}
      </CardContent>
      
      <div className="p-3 border-t border-border flex items-center gap-4 flex-wrap">
        <span className="text-xs text-muted-foreground">Status:</span>
        {Object.entries(statusColors).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className={cn("w-3 h-3 rounded", color)} />
            <span className="text-xs">{statusLabels[status]}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
