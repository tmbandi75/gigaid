import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { LucideIcon, Plus } from "lucide-react";

interface StatItem {
  label: string;
  value: string | number;
  icon?: LucideIcon;
}

interface DesktopPageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  stats?: StatItem[];
  addButtonLabel?: string;
  addButtonHref?: string;
  addButtonGradient?: string;
  children?: React.ReactNode;
}

export function DesktopPageHeader({
  title,
  subtitle,
  icon: Icon,
  stats,
  addButtonLabel,
  addButtonHref,
  addButtonGradient = "from-primary to-violet-600",
  children,
}: DesktopPageHeaderProps) {
  return (
    <div className="hidden md:block border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-5">
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            {Icon && (
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/10 to-violet-500/10 flex items-center justify-center">
                <Icon className="h-6 w-6 text-primary" />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-foreground" data-testid="page-title">{title}</h1>
              {subtitle && (
                <p className="text-sm text-muted-foreground">{subtitle}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {stats && stats.length > 0 && (
              <div className="hidden lg:flex items-center gap-6 pr-6 border-r">
                {stats.map((stat, index) => (
                  <div key={index} className="text-center">
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                ))}
              </div>
            )}

            {children}

            {addButtonLabel && addButtonHref && (
              <Link href={addButtonHref}>
                <Button className={`bg-gradient-to-r ${addButtonGradient} shadow-md`} data-testid="button-add-new">
                  <Plus className="h-4 w-4 mr-2" />
                  {addButtonLabel}
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
