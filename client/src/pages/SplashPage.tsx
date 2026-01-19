import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import logoImage from "@assets/image_1768853315979.png";

export default function SplashPage() {
  const [, setLocation] = useLocation();

  const handleGetStarted = () => {
    localStorage.setItem("gigaid_splash_seen", "true");
    setLocation("/");
  };

  const handleSignIn = () => {
    localStorage.setItem("gigaid_splash_seen", "true");
    setLocation("/");
  };

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-between px-6 py-12 bg-gray-50 dark:bg-gray-900"
      data-testid="page-splash"
    >
      <div className="flex-1 flex flex-col items-center justify-center max-w-md w-full">
        <img 
          src={logoImage} 
          alt="GigAid Logo" 
          className="w-full max-w-xs mb-8"
          data-testid="img-splash-logo"
        />
      </div>

      <div className="w-full max-w-md space-y-4 pb-8">
        <Button
          onClick={handleGetStarted}
          className="w-full h-14 text-lg font-semibold rounded-full bg-[#3B9ED9] hover:bg-[#2B8EC9] text-white shadow-lg"
          data-testid="button-get-started"
        >
          Get Started
        </Button>
        
        <button
          onClick={handleSignIn}
          className="w-full text-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 py-2 text-base"
          data-testid="button-sign-in"
        >
          Sign in
        </button>
      </div>
    </div>
  );
}
