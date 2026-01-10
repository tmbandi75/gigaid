import { useState, useEffect, useRef, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { Sparkles, Loader2 } from "lucide-react";

interface JobNotesAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  serviceName?: string;
  placeholder?: string;
}

export function JobNotesAutocomplete({ 
  value, 
  onChange, 
  serviceName, 
  placeholder = "Describe what you need help with..." 
}: JobNotesAutocompleteProps) {
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [showSuggestion, setShowSuggestion] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const autocompleteMutation = useMutation({
    mutationFn: async (partialText: string) => {
      const res = await apiRequest("POST", "/api/public/ai/autocomplete-notes", { partialText, serviceName });
      return res.json() as Promise<{ suggestion: string | null }>;
    },
    onSuccess: (data) => {
      if (data.suggestion && data.suggestion !== value) {
        setSuggestion(data.suggestion);
        setShowSuggestion(true);
      }
    },
  });

  const debouncedAutocomplete = useCallback((text: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    const words = text.trim().split(/\s+/);
    if (words.length < 3) {
      setSuggestion(null);
      setShowSuggestion(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      autocompleteMutation.mutate(text);
    }, 800);
  }, []);

  useEffect(() => {
    debouncedAutocomplete(value);
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [value, debouncedAutocomplete]);

  const acceptSuggestion = () => {
    if (suggestion) {
      onChange(suggestion);
      setSuggestion(null);
      setShowSuggestion(false);
    }
  };

  const dismissSuggestion = () => {
    setSuggestion(null);
    setShowSuggestion(false);
  };

  return (
    <div className="relative" data-testid="job-notes-autocomplete">
      <Textarea
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          if (showSuggestion) {
            setShowSuggestion(false);
          }
        }}
        placeholder={placeholder}
        rows={3}
        data-testid="input-job-notes"
      />
      
      {autocompleteMutation.isPending && (
        <div className="absolute top-2 right-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}

      {showSuggestion && suggestion && (
        <div 
          className="mt-2 p-3 rounded-lg border bg-muted/50 space-y-2"
          data-testid="notes-suggestion"
        >
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" />
            AI Suggestion
          </div>
          <p className="text-sm">{suggestion}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={acceptSuggestion}
              className="text-xs text-primary hover:underline"
              data-testid="button-accept-suggestion"
            >
              Use this
            </button>
            <button
              type="button"
              onClick={dismissSuggestion}
              className="text-xs text-muted-foreground hover:underline"
              data-testid="button-dismiss-suggestion"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
