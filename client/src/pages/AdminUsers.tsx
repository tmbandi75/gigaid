import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getAuthToken } from "@/lib/authToken";
import { cn } from "@/lib/utils";
import { 
  Search,
  Users,
  UserX,
  AlertTriangle,
  CreditCard,
  TrendingDown,
  Loader2,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  Clock,
  ArrowRight,
  Sparkles,
} from "lucide-react";

interface UserListItem {
  id: string;
  email: string | null;
  username: string;
  name: string | null;
  phone?: string | null;
  isPro?: boolean;
  onboardingCompleted?: boolean;
  onboardingStep?: number;
  lastActiveAt: string | null;
  createdAt: string | null;
}

interface ViewResponse {
  users: UserListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  view: string;
}

interface SearchResponse {
  users: UserListItem[];
}

const viewConfig = {
  all_users: {
    label: "All Users",
    icon: Users,
    description: "All registered users",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  pro_users: {
    label: "Pro Users",
    icon: CreditCard,
    description: "Paying subscribers",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  free_users: {
    label: "Free Users",
    icon: Users,
    description: "Free tier users",
    color: "text-slate-500",
    bg: "bg-slate-500/10",
  },
  active_7d: {
    label: "Active (7d)",
    icon: UserCheck,
    description: "Active in last 7 days",
    color: "text-violet-500",
    bg: "bg-violet-500/10",
  },
  active_30d: {
    label: "Active (30d)",
    icon: UserCheck,
    description: "Active in last 30 days",
    color: "text-purple-500",
    bg: "bg-purple-500/10",
  },
  onboarding_stalled: {
    label: "Stalled",
    icon: UserX,
    description: "Users who haven't completed onboarding",
    color: "text-amber-500",
    bg: "bg-amber-500/10",
  },
  high_intent_no_booking: {
    label: "High Intent",
    icon: TrendingDown,
    description: "Created booking link but no bookings",
    color: "text-orange-500",
    bg: "bg-orange-500/10",
  },
  payment_failed_recent: {
    label: "Failed Payments",
    icon: CreditCard,
    description: "Failed payments in last 7 days",
    color: "text-red-500",
    bg: "bg-red-500/10",
  },
  inactive_7d_paying: {
    label: "At Risk",
    icon: AlertTriangle,
    description: "Paying users inactive for 7+ days",
    color: "text-amber-500",
    bg: "bg-amber-500/10",
  },
  churned_30d: {
    label: "Churned",
    icon: UserX,
    description: "Cancelled subscription in last 30 days",
    color: "text-red-500",
    bg: "bg-red-500/10",
  },
  comp_access: {
    label: "Comp Access",
    icon: CreditCard,
    description: "Users with complimentary access",
    color: "text-teal-500",
    bg: "bg-teal-500/10",
  },
  disabled_accounts: {
    label: "Disabled",
    icon: UserX,
    description: "Disabled accounts",
    color: "text-slate-500",
    bg: "bg-slate-500/10",
  },
};

function UserRow({ user, fromView }: { user: UserListItem; fromView?: string }) {
  const [, navigate] = useLocation();
  
  const handleClick = () => {
    const params = new URLSearchParams();
    params.set("from", "admin");
    if (fromView) params.set("view", fromView);
    navigate(`/admin/users/${user.id}?${params.toString()}`);
  };

  return (
    <div 
      className="flex items-center justify-between p-4 rounded-xl border bg-card hover-elevate cursor-pointer group transition-all"
      onClick={handleClick}
      data-testid={`user-row-${user.id}`}
    >
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-medium text-sm shrink-0">
          {(user.name || user.username || "?").charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">
              {user.name || user.username || "Unknown"}
            </span>
            {user.isPro && (
              <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs">Pro</Badge>
            )}
            {user.onboardingCompleted === false && (
              <Badge variant="outline" className="text-xs">Onboarding</Badge>
            )}
          </div>
          <div className="text-sm text-muted-foreground truncate">
            {user.email || user.phone || user.id.slice(0, 8)}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right text-sm text-muted-foreground hidden sm:block">
          {user.lastActiveAt ? (
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(user.lastActiveAt).toLocaleDateString()}
            </div>
          ) : (
            <span className="text-xs">Never active</span>
          )}
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
}

function SearchPanel() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const { data, isLoading } = useQuery<SearchResponse>({
    queryKey: ["/api/admin/users/search", debouncedQuery],
    queryFn: async () => {
      const token = getAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`/api/admin/users/search?q=${encodeURIComponent(debouncedQuery)}`, {
        credentials: "include",
        headers,
      });
      if (!res.ok) throw new Error("Search failed");
      return res.json();
    },
    enabled: debouncedQuery.length >= 2,
  });

  const handleSearch = () => {
    setDebouncedQuery(searchQuery);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by email, user ID, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-11 h-11 rounded-xl"
            data-testid="input-search"
          />
        </div>
        <Button 
          onClick={handleSearch} 
          disabled={searchQuery.length < 2} 
          data-testid="button-search"
          className="h-11 px-6 rounded-xl"
        >
          Search
        </Button>
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
        </div>
      )}

      {data?.users && data.users.length > 0 && (
        <div className="space-y-3">
          {data.users.map((user) => (
            <UserRow key={user.id} user={user} />
          ))}
        </div>
      )}

      {data?.users && data.users.length === 0 && debouncedQuery.length >= 2 && (
        <div className="text-center py-12">
          <div className="h-12 w-12 rounded-xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
            <Search className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">No users found matching "{debouncedQuery}"</p>
        </div>
      )}

      {!debouncedQuery && (
        <div className="text-center py-12">
          <div className="h-12 w-12 rounded-xl bg-violet-500/10 flex items-center justify-center mx-auto mb-3">
            <Search className="h-6 w-6 text-violet-500" />
          </div>
          <p className="text-muted-foreground">Enter at least 2 characters to search</p>
        </div>
      )}
    </div>
  );
}

function ViewPanel({ view }: { view: string }) {
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery<ViewResponse>({
    queryKey: ["/api/admin/users/views", view, page],
    queryFn: async () => {
      const token = getAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`/api/admin/users/views?view=${view}&page=${page}`, {
        credentials: "include",
        headers,
      });
      if (!res.ok) throw new Error("Failed to load view");
      return res.json();
    },
  });

  const config = viewConfig[view as keyof typeof viewConfig];
  const IconComponent = config?.icon || Users;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
        <p className="text-sm text-muted-foreground mt-3">Loading users...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <div className="h-12 w-12 rounded-xl bg-red-500/10 flex items-center justify-center mx-auto mb-3">
          <AlertTriangle className="h-6 w-6 text-red-500" />
        </div>
        <p className="text-destructive font-medium">Failed to load users</p>
        <p className="text-sm text-muted-foreground mt-1">Please try again</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border">
        <div className="flex items-center gap-3">
          <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", config?.bg)}>
            <IconComponent className={cn("h-5 w-5", config?.color)} />
          </div>
          <div>
            <h3 className="font-semibold">{config?.label || view}</h3>
            <p className="text-sm text-muted-foreground">{config?.description}</p>
          </div>
        </div>
        <Badge variant="outline" className="text-sm">
          {data?.pagination.total || 0} users
        </Badge>
      </div>

      {data?.users && data.users.length > 0 ? (
        <div className="space-y-3">
          {data.users.map((user) => (
            <UserRow key={user.id} user={user} fromView={view} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="h-12 w-12 rounded-xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
            <Users className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">No users in this view</p>
        </div>
      )}

      {data?.pagination && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            data-testid="button-prev-page"
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground px-4">
            Page {page} of {data.pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.min(data.pagination.totalPages, p + 1))}
            disabled={page === data.pagination.totalPages}
            data-testid="button-next-page"
            className="gap-1"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

export default function AdminUsers() {
  const [activeView, setActiveView] = useState("search");

  return (
    <div className="space-y-6" data-testid="page-admin-users">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-violet-500" />
            User Management
          </h1>
          <p className="text-muted-foreground mt-1">Search and manage user accounts</p>
        </div>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="border-b">
          <Tabs value={activeView} onValueChange={setActiveView}>
            <TabsList className="grid grid-cols-3 lg:grid-cols-6 w-full bg-muted/30 p-1 rounded-xl">
              <TabsTrigger value="search" data-testid="tab-search" className="rounded-lg gap-1.5">
                <Search className="h-4 w-4" />
                <span className="hidden sm:inline">Search</span>
              </TabsTrigger>
              <TabsTrigger value="onboarding_stalled" data-testid="tab-onboarding" className="rounded-lg gap-1.5">
                <UserX className="h-4 w-4" />
                <span className="hidden sm:inline">Stalled</span>
              </TabsTrigger>
              <TabsTrigger value="high_intent_no_booking" data-testid="tab-high-intent" className="rounded-lg gap-1.5">
                <TrendingDown className="h-4 w-4" />
                <span className="hidden sm:inline">Intent</span>
              </TabsTrigger>
              <TabsTrigger value="payment_failed_recent" data-testid="tab-payment-failed" className="rounded-lg gap-1.5">
                <CreditCard className="h-4 w-4" />
                <span className="hidden sm:inline">Failed</span>
              </TabsTrigger>
              <TabsTrigger value="inactive_7d_paying" data-testid="tab-inactive" className="rounded-lg gap-1.5">
                <AlertTriangle className="h-4 w-4" />
                <span className="hidden sm:inline">At Risk</span>
              </TabsTrigger>
              <TabsTrigger value="churned_30d" data-testid="tab-churned" className="rounded-lg gap-1.5">
                <UserX className="h-4 w-4" />
                <span className="hidden sm:inline">Churned</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="pt-6">
          {activeView === "search" ? (
            <SearchPanel />
          ) : (
            <ViewPanel view={activeView} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
