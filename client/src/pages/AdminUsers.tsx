import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Search,
  Users,
  UserX,
  AlertTriangle,
  CreditCard,
  TrendingDown,
  ArrowLeft,
  Loader2,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { Link } from "wouter";

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
  onboarding_stalled: {
    label: "Onboarding Stalled",
    icon: UserX,
    description: "Users who haven't completed onboarding",
  },
  high_intent_no_booking: {
    label: "High Intent",
    icon: TrendingDown,
    description: "Created booking link but no bookings",
  },
  payment_failed_recent: {
    label: "Payment Failed",
    icon: CreditCard,
    description: "Failed payments in last 7 days",
  },
  inactive_7d_paying: {
    label: "Inactive Paying",
    icon: AlertTriangle,
    description: "Paying users inactive for 7+ days",
  },
  churned_30d: {
    label: "Churned",
    icon: UserX,
    description: "Cancelled subscription in last 30 days",
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
      className="flex items-center justify-between p-3 rounded-lg hover-elevate cursor-pointer border"
      onClick={handleClick}
      data-testid={`user-row-${user.id}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">
            {user.name || user.username || "Unknown"}
          </span>
          {user.isPro && (
            <Badge variant="secondary" className="text-xs">Pro</Badge>
          )}
          {user.onboardingCompleted === false && (
            <Badge variant="outline" className="text-xs">Onboarding</Badge>
          )}
        </div>
        <div className="text-sm text-muted-foreground truncate">
          {user.email || user.phone || user.id.slice(0, 8)}
        </div>
      </div>
      <div className="text-right text-sm text-muted-foreground">
        {user.lastActiveAt ? (
          <span>Active {new Date(user.lastActiveAt).toLocaleDateString()}</span>
        ) : (
          <span>Never active</span>
        )}
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
      const res = await fetch(`/api/admin/users/search?q=${encodeURIComponent(debouncedQuery)}`);
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
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by email, user ID, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-10"
            data-testid="input-search"
          />
        </div>
        <Button onClick={handleSearch} disabled={searchQuery.length < 2} data-testid="button-search">
          Search
        </Button>
      </div>

      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {data?.users && data.users.length > 0 && (
        <div className="space-y-2">
          {data.users.map((user) => (
            <UserRow key={user.id} user={user} />
          ))}
        </div>
      )}

      {data?.users && data.users.length === 0 && debouncedQuery.length >= 2 && (
        <div className="text-center py-8 text-muted-foreground">
          No users found matching "{debouncedQuery}"
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
      const res = await fetch(`/api/admin/users/views?view=${view}&page=${page}`);
      if (!res.ok) throw new Error("Failed to load view");
      return res.json();
    },
  });

  const config = viewConfig[view as keyof typeof viewConfig];

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-destructive">
        Failed to load users. Please try again.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">{config?.label || view}</h3>
          <p className="text-sm text-muted-foreground">{config?.description}</p>
        </div>
        <Badge variant="outline">
          {data?.pagination.total || 0} users
        </Badge>
      </div>

      {data?.users && data.users.length > 0 ? (
        <div className="space-y-2">
          {data.users.map((user) => (
            <UserRow key={user.id} user={user} fromView={view} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          No users in this view
        </div>
      )}

      {data?.pagination && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            data-testid="button-prev-page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {data.pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.min(data.pagination.totalPages, p + 1))}
            disabled={page === data.pagination.totalPages}
            data-testid="button-next-page"
          >
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
    <div className="min-h-screen bg-background pb-8" data-testid="page-admin-users">
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white px-4 py-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4">
            <Link href="/admin/cockpit">
              <Button variant="ghost" size="sm" className="text-white hover:text-white/80" data-testid="button-back-cockpit">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Cockpit
              </Button>
            </Link>
          </div>
          <div className="mt-4">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6" />
              User Management
            </h1>
            <p className="text-slate-300 text-sm mt-1">Search and view user details</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-4">
        <Card>
          <CardHeader className="pb-2">
            <Tabs value={activeView} onValueChange={setActiveView}>
              <TabsList className="grid grid-cols-3 lg:grid-cols-6 w-full">
                <TabsTrigger value="search" data-testid="tab-search">
                  <Search className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Search</span>
                </TabsTrigger>
                <TabsTrigger value="onboarding_stalled" data-testid="tab-onboarding">
                  <UserX className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Stalled</span>
                </TabsTrigger>
                <TabsTrigger value="high_intent_no_booking" data-testid="tab-high-intent">
                  <TrendingDown className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Intent</span>
                </TabsTrigger>
                <TabsTrigger value="payment_failed_recent" data-testid="tab-payment-failed">
                  <CreditCard className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Failed</span>
                </TabsTrigger>
                <TabsTrigger value="inactive_7d_paying" data-testid="tab-inactive">
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Inactive</span>
                </TabsTrigger>
                <TabsTrigger value="churned_30d" data-testid="tab-churned">
                  <UserX className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Churned</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className="pt-4">
            {activeView === "search" ? (
              <SearchPanel />
            ) : (
              <ViewPanel view={activeView} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
