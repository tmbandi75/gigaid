import { Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export function VoiceFAB() {
  const [isRecording, setIsRecording] = useState(false);

  const handlePress = () => {
    setIsRecording(!isRecording);
  };

  return (
    <Button
      size="icon"
      className={`fixed bottom-24 right-4 z-40 h-14 w-14 rounded-full shadow-lg ${
        isRecording 
          ? "bg-destructive hover:bg-destructive/90 animate-pulse" 
          : "bg-primary hover:bg-primary/90"
      }`}
      onClick={handlePress}
      data-testid="button-voice-fab"
    >
      <Mic className="h-6 w-6 text-primary-foreground" />
    </Button>
  );
}
