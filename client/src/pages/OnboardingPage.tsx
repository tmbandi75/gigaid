import { useLocation, useParams, useSearch } from "wouter";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { WebOnboardingLayout } from "@/components/onboarding/WebOnboardingLayout";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sparkles } from "lucide-react";

export default function OnboardingPage() {
  const [, navigate] = useLocation();
  const params = useParams<{ step?: string }>();
  const search = useSearch();
  const isMobile = useIsMobile();

  const searchParams = new URLSearchParams(search);
  const queryStep = searchParams.get("step");
  const requestedStep = params.step || queryStep;

  const handleComplete = () => {
    navigate("/");
  };

  const parsedStep = requestedStep ? parseInt(requestedStep, 10) : undefined;

  return (
    <div className="min-h-screen relative overflow-hidden" data-testid="page-onboarding">
      <div className="absolute inset-0 bg-gradient-to-br from-[#6366F1] via-[#4F46E5] to-[#3730A3]" />

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-[#818CF8]/30 rounded-full blur-sm" />
        <div className="absolute top-16 right-10 w-20 h-20 bg-[#6366F1]/50 rounded-full" />
        <div className="absolute top-1/4 -right-10 w-40 h-40 bg-[#4338CA]/40 rounded-full blur-md" />
        <div className="absolute -bottom-16 -left-16 w-56 h-56 bg-[#818CF8]/25 rounded-full" />
        <div className="absolute bottom-32 left-1/4 w-24 h-24 bg-[#6366F1]/30 rounded-full blur-sm" />
        <div className="absolute top-1/2 -left-8 w-32 h-32 bg-[#4338CA]/30 rounded-full blur-md" />
      </div>

      <div className="relative min-h-screen flex flex-col">
        {isMobile ? (
          <>
            <div className="px-4 pt-6 pb-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-white">Welcome to GigAid</h1>
              </div>
              <p className="text-white/80 text-sm">Let's set up your profile in just a few steps</p>
            </div>

            <div className="flex-1 px-4 pb-6">
              <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm rounded-2xl shadow-2xl shadow-black/20 overflow-hidden">
                <OnboardingFlow
                  onComplete={handleComplete}
                  initialStep={parsedStep}
                />
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="px-6 lg:px-8 pt-6 pb-2">
              <div className="max-w-5xl mx-auto flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-white">GigAid</h1>
              </div>
            </div>

            <div className="flex-1">
              <WebOnboardingLayout
                onComplete={handleComplete}
                initialStep={parsedStep}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
