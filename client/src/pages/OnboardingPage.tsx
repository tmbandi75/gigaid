import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";

export default function OnboardingPage() {
  const [, navigate] = useLocation();
  const search = useSearch();
  
  const searchParams = new URLSearchParams(search);
  const requestedStep = searchParams.get("step");

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
