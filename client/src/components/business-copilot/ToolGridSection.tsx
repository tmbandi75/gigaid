import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Wand2,
  Zap,
  TrendingUp,
  Lock,
} from "lucide-react";

interface AIFeature {
  id: string;
  title: string;
  description: string;
  icon: typeof Wand2;
  category: "create" | "automate" | "grow";
  gradient: string;
  requiresUnlock?: boolean;
}

interface ToolGridSectionProps {
  features: AIFeature[];
  hasUnlockedAdvanced: boolean;
  onOpenTool: (toolId: string) => void;
  onLockedClick: () => void;
}

const CATEGORIES = [
  { id: "create" as const, label: "Create", icon: Wand2, color: "text-violet-500" },
  { id: "automate" as const, label: "Automate", icon: Zap, color: "text-emerald-500" },
  { id: "grow" as const, label: "Grow", icon: TrendingUp, color: "text-amber-500" },
];

export function ToolGridSection({ features, hasUnlockedAdvanced, onOpenTool, onLockedClick }: ToolGridSectionProps) {
  return (
    <section data-testid="section-tool-grid">
      <h2 className="text-lg font-semibold mb-4">All Tools</h2>
      <div className="space-y-6">
        {CATEGORIES.map((category) => {
          const categoryFeatures = features.filter((f) => f.category === category.id);
          if (categoryFeatures.length === 0) return null;
          return (
            <div key={category.id} className="space-y-3">
              <div className="flex items-center gap-2">
                <category.icon className={`h-4 w-4 ${category.color}`} />
                <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                  {category.label}
                </h3>
                <Badge variant="secondary" className="text-xs">
                  {categoryFeatures.length}
                </Badge>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {categoryFeatures.map((feature) => {
                  const isLocked = feature.requiresUnlock && !hasUnlockedAdvanced;
                  return (
                    <Card
                      key={feature.id}
                      className={`rounded-xl border shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200 cursor-pointer group overflow-visible focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 outline-none ${
                        isLocked ? "opacity-60" : ""
                      }`}
                      onClick={() => isLocked ? onLockedClick() : onOpenTool(feature.id)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); isLocked ? onLockedClick() : onOpenTool(feature.id); } }}
                      tabIndex={0}
                      role="button"
                      aria-label={isLocked ? `${feature.title} (locked)` : feature.title}
                      data-testid={`card-tool-${feature.id}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex flex-col gap-3">
                          <div className={`h-11 w-11 rounded-xl bg-gradient-to-br ${isLocked ? "from-gray-400 to-gray-500" : feature.gradient} flex items-center justify-center shadow-md flex-shrink-0 relative`}>
                            <feature.icon className="h-5 w-5 text-white" />
                            {isLocked && (
                              <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-muted border-2 border-background flex items-center justify-center" data-testid={`lock-indicator-${feature.id}`}>
                                <Lock className="h-3 w-3 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-semibold text-sm mb-0.5">{feature.title}</h4>
                            <p className="text-xs text-muted-foreground line-clamp-2" data-testid={isLocked ? `text-locked-${feature.id}` : undefined}>
                              {isLocked ? "Unlocks after your first paid job" : feature.description}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
