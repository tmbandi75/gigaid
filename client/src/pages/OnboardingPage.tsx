import { useLocation, useParams, useSearch } from "wouter";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";

export default function OnboardingPage() {
  console.log("[OnboardingPage] Rendering - route matched!");
  const [, navigate] = useLocation();
  const params = useParams<{ step?: string }>();
  const search = useSearch();
  console.log("[OnboardingPage] params:", params, "search:", search);
  
  // Support both URL param (/onboarding/4) and query string (/onboarding?step=4)
  const searchParams = new URLSearchParams(search);
  const queryStep = searchParams.get("step");
  const requestedStep = params.step || queryStep;

  const handleComplete = () => {
    navigate("/dashboard");
  };

  return (
    <OnboardingFlow 
      onComplete={handleComplete}
      initialStep={requestedStep ? parseInt(requestedStep, 10) : undefined}
    />
  );
}
