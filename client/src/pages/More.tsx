import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  User, 
  Bell, 
  HelpCircle, 
  LogOut, 
  ChevronRight,
  Share2,
  Star,
  Moon,
  Sun,
  Users,
  Settings,
  Sparkles,
  Gift,
  Shield,
  Palette,
  Calendar,
  Crown,
  MessageSquare,
  Car,
  MapPin,
  Navigation,
} from "lucide-react";
import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useDriveModeContext } from "@/components/drivemode/DriveModeProvider";

interface UserProfile {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  photo: string | null;
  businessName?: string | null;
}

const menuSections = [
  {
    title: "Tools",
    items: [
      { icon: Share2, label: "Quick Capture", description: "Save leads from any app", href: "/share", badge: "New", gradient: "from-emerald-500 to-teal-500" },
      { icon: Sparkles, label: "Business Co-Pilot", description: "See what works. Get paid faster.", href: "/ai-tools", gradient: "from-violet-500 to-purple-500" },
      { icon: MessageSquare, label: "Messages", description: "Client conversations", href: "/messages", gradient: "from-indigo-500 to-blue-500" },
      { icon: Users, label: "Crew", description: "Manage team members", href: "/crew", gradient: "from-blue-500 to-cyan-500" },
      { icon: Bell, label: "Reminders", description: "SMS & voice alerts", href: "/reminders", gradient: "from-amber-500 to-orange-500" },
      { icon: Calendar, label: "Booking Requests", description: "Customer bookings", href: "/booking-requests", gradient: "from-green-500 to-emerald-500" },
    ]
  },
  {
    title: "Business",
    items: [
      { icon: Crown, label: "Owner View", description: "Business snapshot", href: "/owner", gradient: "from-amber-500 to-yellow-500" },
      { icon: Share2, label: "Booking Link", description: "Share your page", href: "/settings", gradient: "from-emerald-500 to-teal-500" },
      { icon: Star, label: "Reviews", description: "Client feedback", href: "/reviews", gradient: "from-yellow-500 to-amber-500" },
      { icon: Gift, label: "Referrals", description: "Earn rewards", href: "/referrals", gradient: "from-pink-500 to-rose-500" },
    ]
  },
  {
    title: "Account",
    items: [
      { icon: User, label: "Profile", description: "Your info", href: "/profile", gradient: "from-slate-500 to-gray-500" },
      { icon: Settings, label: "Settings", description: "App preferences", href: "/settings", gradient: "from-slate-500 to-gray-500" },
      { icon: HelpCircle, label: "Help & Support", description: "FAQs and contact", href: "/help", gradient: "from-slate-500 to-gray-500" },
    ]
  },
];

function GpsStatusIndicator({ status, speed }: { status: string; speed: number | null }) {
  const getStatusInfo = () => {
    switch (status) {
      case 'active':
        return { color: 'bg-green-500', text: speed !== null ? `${speed} mph` : 'Tracking' };
      case 'requesting':
        return { color: 'bg-yellow-500 animate-pulse', text: 'Connecting...' };
      case 'denied':
        return { color: 'bg-red-500', text: 'Permission denied' };
      case 'error':
        return { color: 'bg-red-500', text: 'GPS error' };
      default:
        return { color: 'bg-gray-400', text: 'Inactive' };
    }
  };

  const info = getStatusInfo();
  
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <div className={`h-2 w-2 rounded-full ${info.color}`} />
      <span>{info.text}</span>
    </div>
  );
}

export default function More() {
  const [, navigate] = useLocation();
  const [darkMode, setDarkMode] = useState(false);
  const { enterDriveMode, gpsStatus, currentSpeed } = useDriveModeContext();

  const { data: profile } = useQuery<UserProfile>({
    queryKey: ["/api/profile"],
  });

  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark');
    setDarkMode(isDark);
  }, []);

  const displayName = profile?.name || "Gig Worker";
  const displayEmail = profile?.email || "gig@example.com";
  const businessName = profile?.businessName || "Your Business";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const toggleDarkMode = (enabled: boolean) => {
    setDarkMode(enabled);
    if (enabled) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  return (
    <div className="flex flex-col min-h-full bg-background" data-testid="page-more">
      <div 
        className="relative overflow-hidden text-white px-4 pt-6 pb-8"
        style={{ 
          background: 'linear-gradient(180deg, #1F2937 0%, #111827 100%)',
          boxShadow: 'inset 0 -12px 20px rgba(0, 0, 0, 0.25)'
        }}>
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 -left-10 w-32 h-32 bg-slate-400/10 rounded-full blur-2xl" />
        </div>
        
        <div className="relative">
          <div 
            className="flex items-center gap-4 cursor-pointer"
            onClick={() => navigate("/profile")}
            data-testid="card-profile"
          >
            <Avatar className="h-16 w-16 ring-2 ring-white/20">
              {profile?.photo ? (
                <AvatarImage src={profile.photo} alt="Profile" />
              ) : null}
              <AvatarFallback className="bg-gradient-to-br from-primary to-violet-600 text-white text-xl font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h2 className="font-semibold text-lg">{displayName}</h2>
              <p className="text-sm text-white/70">{businessName}</p>
              <Badge variant="secondary" className="mt-1.5 text-[10px] bg-white/10 text-white border-0">
                Free Plan
              </Badge>
            </div>
            <ChevronRight className="h-5 w-5 text-white/50" />
          </div>
        </div>
      </div>
      
      <div className="flex-1 px-4 py-6 -mt-4 space-y-4">
        <Card className="border-0 shadow-md overflow-hidden">
          <CardContent className="p-0">
            <div 
              className="flex items-center justify-between p-4"
              data-testid="toggle-dark-mode"
            >
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${darkMode ? "bg-slate-800" : "bg-amber-100"}`}>
                  {darkMode ? (
                    <Moon className="h-5 w-5 text-slate-300" />
                  ) : (
                    <Sun className="h-5 w-5 text-amber-600" />
                  )}
                </div>
                <div>
                  <p className="font-medium text-foreground">Appearance</p>
                  <p className="text-xs text-muted-foreground">
                    {darkMode ? "Dark mode" : "Light mode"}
                  </p>
                </div>
              </div>
              <Switch 
                checked={darkMode} 
                onCheckedChange={toggleDarkMode}
                data-testid="switch-dark-mode"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md overflow-hidden">
          <CardContent className="p-0">
            <div 
              className="flex items-center justify-between p-4"
              data-testid="drive-mode-section"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm">
                  <Car className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Drive Mode</p>
                  <GpsStatusIndicator status={gpsStatus} speed={currentSpeed} />
                </div>
              </div>
              <Button 
                size="sm" 
                onClick={enterDriveMode}
                data-testid="button-enter-drive-mode"
              >
                <Navigation className="h-4 w-4 mr-1" />
                Start
              </Button>
            </div>
            {gpsStatus === 'denied' && (
              <div className="px-4 pb-4 -mt-2">
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Please enable location access in your browser settings for automatic detection.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {menuSections.map((section) => (
          <div key={section.title}>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">
              {section.title}
            </h3>
            <Card className="border-0 shadow-md overflow-hidden">
              <CardContent className="p-0">
                {section.items.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label}>
                      <div 
                        className="flex items-center justify-between p-4 hover-elevate cursor-pointer"
                        data-testid={`menu-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                        onClick={() => item.href !== "#" && navigate(item.href)}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${item.gradient} flex items-center justify-center shadow-sm`}>
                            <Icon className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-foreground">{item.label}</p>
                              {item.badge && (
                                <Badge className="text-[10px] px-1.5 py-0 bg-gradient-to-r from-violet-500 to-purple-500 border-0">
                                  {item.badge}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">{item.description}</p>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground/50" />
                      </div>
                      {index < section.items.length - 1 && (
                        <div className="mx-4 border-b border-border/50" />
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        ))}

        <Card className="border-0 shadow-md border-destructive/10 overflow-hidden">
          <CardContent className="p-0">
            <div 
              className="flex items-center justify-between p-4 hover-elevate cursor-pointer"
              data-testid="menu-logout"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                  <LogOut className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="font-medium text-destructive">Log Out</p>
                  <p className="text-xs text-muted-foreground">Sign out of your account</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="text-center py-4">
          <img src="/gigaid-logo.png" alt="GigAid" className="h-6 mx-auto mb-1" style={{ filter: 'drop-shadow(0 1px 2px rgba(255,255,255,0.3))' }} />
          <p className="text-xs text-muted-foreground">v1.0.0</p>
        </div>
        
        <div className="h-4" />
      </div>
    </div>
  );
}
