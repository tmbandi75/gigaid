import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/TopBar";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  User, 
  Bell, 
  Palette, 
  HelpCircle, 
  LogOut, 
  ChevronRight,
  Share2,
  Star,
  Shield,
  Moon,
  Sun
} from "lucide-react";
import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";

interface UserProfile {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  photo: string | null;
}

const menuItems = [
  { icon: User, label: "Profile", description: "Manage your account", href: "#" },
  { icon: Bell, label: "Notifications", description: "SMS & email preferences", href: "#" },
  { icon: Share2, label: "Booking Link", description: "Share your booking page", href: "#", badge: "New" },
  { icon: Star, label: "Reviews", description: "View client feedback", href: "#" },
  { icon: Shield, label: "Privacy", description: "Data & security settings", href: "#" },
  { icon: HelpCircle, label: "Help & Support", description: "FAQs and contact", href: "#" },
];

export default function More() {
  const [, navigate] = useLocation();
  const [darkMode, setDarkMode] = useState(false);

  const { data: profile } = useQuery<UserProfile>({
    queryKey: ["/api/profile"],
  });

  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark');
    setDarkMode(isDark);
  }, []);

  const displayName = profile?.name || "Gig Worker";
  const displayEmail = profile?.email || "gig@example.com";
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
    <div className="flex flex-col min-h-full" data-testid="page-more">
      <TopBar title="More" showActions={false} />
      
      <div className="px-4 py-6 space-y-6">
        <Card 
          data-testid="card-profile"
          className="hover-elevate active-elevate-2 cursor-pointer"
          onClick={() => navigate("/profile")}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                {profile?.photo ? (
                  <AvatarImage src={profile.photo} alt="Profile" />
                ) : null}
                <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h2 className="font-medium text-lg text-foreground">{displayName}</h2>
                <p className="text-sm text-muted-foreground">{displayEmail}</p>
                <Badge variant="outline" className="mt-1 text-xs">
                  Free Plan
                </Badge>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-2">
            <div 
              className="flex items-center justify-between p-3 rounded-lg hover-elevate"
              data-testid="toggle-dark-mode"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-muted/50 flex items-center justify-center">
                  {darkMode ? (
                    <Moon className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <Sun className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <p className="font-medium text-foreground">Dark Mode</p>
                  <p className="text-xs text-muted-foreground">
                    {darkMode ? "Dark theme enabled" : "Light theme enabled"}
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

        <Card>
          <CardContent className="p-2">
            {menuItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <div key={item.label}>
                  <div 
                    className="flex items-center justify-between p-3 rounded-lg hover-elevate active-elevate-2 cursor-pointer"
                    data-testid={`menu-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-muted/50 flex items-center justify-center">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground">{item.label}</p>
                          {item.badge && (
                            <Badge variant="default" className="text-[10px] px-1.5 py-0">
                              {item.badge}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                  {index < menuItems.length - 1 && (
                    <div className="mx-3 border-b border-border/50" />
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="border-destructive/20">
          <CardContent className="p-2">
            <div 
              className="flex items-center justify-between p-3 rounded-lg hover-elevate active-elevate-2 cursor-pointer"
              data-testid="menu-logout"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
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

        <p className="text-center text-xs text-muted-foreground pb-4">
          Gig Aid v1.0.0
        </p>
      </div>
    </div>
  );
}
