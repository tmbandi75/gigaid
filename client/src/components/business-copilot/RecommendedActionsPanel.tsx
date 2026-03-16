import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import {
  Send,
  Star,
  Bell,
  ChevronRight,
} from "lucide-react";

interface ActionItem {
  id: string;
  icon: typeof Send;
  gradient: string;
  title: string;
  description: string;
  route?: string;
  toolId?: string;
  tag?: string;
}

interface RecommendedActionsPanelProps {
  onOpenTool: (toolId: string) => void;
}

export function RecommendedActionsPanel({ onOpenTool }: RecommendedActionsPanelProps) {
  const [, navigate] = useLocation();

  const actions: ActionItem[] = [
    {
      id: "follow-up-leads",
      icon: Send,
      gradient: "from-emerald-500 to-teal-500",
      title: "Follow Up With Leads",
      description: "Send personalized messages to warm leads before they go cold",
      toolId: "follow-up",
      tag: "Recommended",
    },
    {
      id: "reply-reviews",
      icon: Star,
      gradient: "from-yellow-500 to-amber-500",
      title: "Reply to Reviews",
      description: "Draft professional responses to build your reputation",
      toolId: "review-draft",
    },
    {
      id: "send-campaign",
      icon: Bell,
      gradient: "from-violet-500 to-purple-500",
      title: "Send Reminder Campaign",
      description: "Re-engage past clients with a targeted notification",
      route: "/notify-clients",
      tag: "Popular",
    },
  ];

  const handleClick = (action: ActionItem) => {
    if (action.route) {
      navigate(action.route);
    } else if (action.toolId) {
      onOpenTool(action.toolId);
    }
  };

  return (
    <section data-testid="section-recommended-actions">
      <h2 className="text-lg font-semibold mb-3">Recommended Actions</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {actions.map((action) => (
          <Card
            key={action.id}
            className="rounded-xl border shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200 cursor-pointer group focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 outline-none"
            onClick={() => handleClick(action)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleClick(action); } }}
            tabIndex={0}
            role="button"
            aria-label={action.title}
            data-testid={`card-action-${action.id}`}
          >
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${action.gradient} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                  <action.icon className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-sm">{action.title}</h3>
                    {action.tag && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {action.tag}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{action.description}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary flex-shrink-0 mt-0.5 transition-colors" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
