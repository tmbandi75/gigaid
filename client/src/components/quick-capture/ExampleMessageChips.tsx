import { Badge } from "@/components/ui/badge";
import { Wrench, SprayCan, Plug } from "lucide-react";

const EXAMPLES = [
  {
    label: "Plumber request",
    icon: Wrench,
    text: `Hi, I need a plumber to fix a leaking faucet in my kitchen. It's been dripping for a few days now. My name is Sarah Johnson, you can reach me at 555-1234 or email sarah.j@email.com. I'm available this weekend.`,
  },
  {
    label: "Cleaning request",
    icon: SprayCan,
    text: `Hello! I'm looking for a deep cleaning service for my 3-bedroom apartment. Moving out at the end of the month and need everything spotless. Name's Mike Torres, call me at 555-8901. Located at 45 Oak Street.`,
  },
  {
    label: "Electrical repair",
    icon: Plug,
    text: `Hey, I have some flickering lights and a couple of outlets that stopped working in my garage. Could be a wiring issue. I'm David Chen, phone 555-4567. Pretty urgent since we use the garage daily.`,
  },
];

interface ExampleMessageChipsProps {
  onSelect: (text: string) => void;
}

export function ExampleMessageChips({ onSelect }: ExampleMessageChipsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <span className="text-xs text-muted-foreground self-center mr-1">Try:</span>
      {EXAMPLES.map((ex) => {
        const Icon = ex.icon;
        return (
          <button
            key={ex.label}
            onClick={() => onSelect(ex.text)}
            data-testid={`chip-example-${ex.label.split(" ")[0].toLowerCase()}`}
          >
            <Badge
              variant="outline"
              className="cursor-pointer gap-1.5 px-3 py-1.5 hover:bg-accent transition-colors"
            >
              <Icon className="h-3 w-3" />
              {ex.label}
            </Badge>
          </button>
        );
      })}
    </div>
  );
}
