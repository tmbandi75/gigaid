import { useState, useEffect, ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown } from "lucide-react";

interface SettingsSectionAccordionProps {
  id: string;
  title: string;
  subtitle: string;
  icon: ReactNode;
  iconGradient?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  headerExtra?: ReactNode;
}

const LS_KEY = "settings_sections_state";

function readSavedState(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeSavedState(state: Record<string, boolean>) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch {}
}

export function SettingsSectionAccordion({
  id,
  title,
  subtitle,
  icon,
  iconGradient = "from-slate-500 to-gray-500",
  children,
  defaultOpen = false,
  className = "",
  headerExtra,
}: SettingsSectionAccordionProps) {
  const [isOpen, setIsOpen] = useState(() => {
    const saved = readSavedState();
    return saved[id] !== undefined ? saved[id] : defaultOpen;
  });

  useEffect(() => {
    const saved = readSavedState();
    saved[id] = isOpen;
    writeSavedState(saved);
  }, [id, isOpen]);

  return (
    <Card className={`border shadow-sm ${className}`} data-testid={`section-${id}`}>
      <CardContent className="p-0">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between gap-2 p-4 cursor-pointer"
          aria-expanded={isOpen}
          aria-controls={`section-${id}-content`}
          data-testid={`section-${id}-header`}
        >
          <div className="flex items-center gap-3">
            <div className={`h-8 w-8 rounded-lg bg-gradient-to-br ${iconGradient} flex items-center justify-center shrink-0`}>
              {icon}
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-base">{title}</h3>
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {headerExtra}
            <ChevronDown
              className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
            />
          </div>
        </button>

        <div
          id={`section-${id}-content`}
          className={`overflow-hidden transition-all duration-200 ${isOpen ? "max-h-[5000px] opacity-100" : "max-h-0 opacity-0"}`}
        >
          <div className="px-4 pb-4">
            {children}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
