import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { apiFetch } from "@/lib/apiFetch";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { useApiMutation } from "@/hooks/useApiMutation";
import { 
  Users, 
  Plus, 
  Trash2, 
  Mail, 
  Phone, 
  UserCheck, 
  UserX, 
  Clock, 
  Loader2, 
  ChevronDown, 
  ChevronUp, 
  Briefcase, 
  CheckCircle2, 
  XCircle, 
  Link2Off, 
  ExternalLink,
  UserPlus,
  Calendar,
  TrendingUp,
  Copy,
  MoreVertical,
  Search,
  MessageSquare,
  PhoneCall,
  ClipboardList,
} from "lucide-react";
import type { CrewMember } from "@shared/schema";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CrewInvite {
  id: string;
  jobId: number;
  jobTitle?: string;
  jobDate?: string;
  status: string;
  createdAt: string;
  expiresAt: string;
  token: string;
}

export default function Crew() {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "joined" | "invited" | "inactive">("all");
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    role: "helper" as string,
    customRole: "",
  });

  const { data: crew = [], isLoading } = useQuery<CrewMember[]>({
    queryKey: QUERY_KEYS.crew(),
    queryFn: () => apiFetch<CrewMember[]>("/api/crew"),
  });

  const createMutation = useApiMutation(
    (data: { name: string; phone: string; email: string; role: string }) =>
      apiFetch<CrewMember>("/api/crew", { method: "POST", body: JSON.stringify(data) }),
    [QUERY_KEYS.crew()],
    {
      onSuccess: () => {
        setIsDialogOpen(false);
        resetForm();
        toast({ title: "Crew member added successfully" });
      },
      onError: (error: Error) => {
        let msg = "Failed to add crew member";
        try {
          const jsonStart = error.message?.indexOf("{");
          if (jsonStart !== undefined && jsonStart >= 0) {
            const parsed = JSON.parse(error.message.substring(jsonStart));
            if (parsed.error) msg = parsed.error;
          }
        } catch {
          if (error.message?.includes("already exists")) {
            const colonIdx = error.message.indexOf(":");
            const body = colonIdx >= 0 ? error.message.substring(colonIdx + 1).trim() : error.message;
            msg = body || error.message;
          }
        }
        toast({ title: msg, variant: "destructive" });
      },
    }
  );

  const updateMutation = useApiMutation(
    ({ id, status }: { id: string; status: string }) =>
      apiFetch(`/api/crew/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    [QUERY_KEYS.crew()],
    {
      onSuccess: () => {
        toast({ title: "Status updated" });
      },
    }
  );

  const deleteMutation = useApiMutation(
    (id: string) => apiFetch(`/api/crew/${id}`, { method: "DELETE" }),
    [QUERY_KEYS.crew()],
    {
      onSuccess: () => {
        toast({ title: "Crew member removed" });
      },
    }
  );

  const { data: crewInvites = [] } = useQuery<CrewInvite[]>({
    queryKey: QUERY_KEYS.crewMemberInvites(expandedMember || ""),
    queryFn: () => apiFetch<CrewInvite[]>(`/api/crew/${expandedMember}/invites`),
    enabled: !!expandedMember,
  });

  const revokeMutation = useApiMutation(
    (inviteId: string) =>
      apiFetch(`/api/crew-invites/${inviteId}/revoke`, { method: "POST" }),
    [QUERY_KEYS.crewMemberInvites(expandedMember || ""), QUERY_KEYS.crewInvites()],
    {
      onSuccess: () => {
        toast({ title: "Invite revoked" });
      },
      onError: () => {
        toast({ title: "Failed to revoke invite", variant: "destructive" });
      },
    }
  );

  const resetForm = () => {
    setFormData({ firstName: "", lastName: "", phone: "", email: "", role: "helper", customRole: "" });
  };

  const formatPhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 10);
    if (digits.length === 0) return "";
    if (digits.length <= 3) return `(${digits}`;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  };

  const handlePhoneChange = (value: string) => {
    setFormData({ ...formData, phone: formatPhoneNumber(value) });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.firstName) {
      toast({ title: "Please enter a first name", variant: "destructive" });
      return;
    }
    const fullName = `${formData.firstName} ${formData.lastName}`.trim();
    const effectiveRole = formData.role === "other" && formData.customRole ? formData.customRole.toLowerCase() : formData.role;
    createMutation.mutate({ name: fullName, phone: formData.phone, email: formData.email, role: effectiveRole });
  };

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const getRoleColor = (role: string) => {
    const colors: Record<string, string> = {
      plumber: "from-blue-500 to-blue-600",
      electrician: "from-amber-500 to-amber-600",
      cleaner: "from-emerald-500 to-emerald-600",
      helper: "from-slate-500 to-slate-600",
    };
    return colors[role] || "from-purple-500 to-purple-600";
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "joined":
        return { label: "Active", color: "bg-emerald-500/10 text-emerald-600", icon: UserCheck };
      case "inactive":
        return { label: "Inactive", color: "bg-gray-500/10 text-gray-600", icon: UserX };
      default:
        return { label: "Invited", color: "bg-amber-500/10 text-amber-600", icon: Clock };
    }
  };

  const getInviteStatusBadge = (status: string) => {
    switch (status) {
      case "confirmed":
        return <Badge className="bg-emerald-500/10 text-emerald-600 border-0 text-xs"><CheckCircle2 className="h-3 w-3 mr-1" />Confirmed</Badge>;
      case "declined":
        return <Badge className="bg-red-500/10 text-red-600 border-0 text-xs"><XCircle className="h-3 w-3 mr-1" />Declined</Badge>;
      case "revoked":
        return <Badge className="bg-gray-500/10 text-gray-600 border-0 text-xs"><Link2Off className="h-3 w-3 mr-1" />Revoked</Badge>;
      case "expired":
        return <Badge className="bg-gray-500/10 text-gray-600 border-0 text-xs"><Clock className="h-3 w-3 mr-1" />Expired</Badge>;
      case "viewed":
        return <Badge className="bg-blue-500/10 text-blue-600 border-0 text-xs"><ExternalLink className="h-3 w-3 mr-1" />Viewed</Badge>;
      default:
        return <Badge className="bg-amber-500/10 text-amber-600 border-0 text-xs"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    }
  };

  const toggleExpand = (memberId: string) => {
    setExpandedMember(expandedMember === memberId ? null : memberId);
  };

  const copyInviteLink = (token: string) => {
    const baseUrl = window.location.origin;
    navigator.clipboard.writeText(`${baseUrl}/crew-portal/${token}`);
    toast({ title: "Link copied to clipboard" });
  };

  const renderMobileHeader = () => (
    <div className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-violet-600 text-primary-foreground px-4 pt-6 pb-8">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 -left-10 w-32 h-32 bg-violet-400/20 rounded-full blur-2xl" />
      </div>
      
      <div className="relative">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">My Crew</h1>
            <p className="text-sm text-primary-foreground/80">Manage your team members</p>
          </div>
          <Button 
            onClick={() => setIsDialogOpen(true)} 
            size="icon"
            className="bg-white/20 hover:bg-white/30 text-white"
            aria-label="Add crew member"
            data-testid="button-add-crew-header"
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/15 backdrop-blur rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-primary-foreground/80" />
              <span className="text-xs text-primary-foreground/80">Total</span>
            </div>
            <p className="text-2xl font-bold" data-testid="stat-total">{totalCount}</p>
          </div>
          <div className="bg-white/15 backdrop-blur rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <UserCheck className="h-4 w-4 text-primary-foreground/80" />
              <span className="text-xs text-primary-foreground/80">Active</span>
            </div>
            <p className="text-2xl font-bold" data-testid="stat-active">{activeCount}</p>
          </div>
          <div className="bg-white/15 backdrop-blur rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-primary-foreground/80" />
              <span className="text-xs text-primary-foreground/80">Invited</span>
            </div>
            <p className="text-2xl font-bold" data-testid="stat-invited">{invitedCount}</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderDesktopHeader = () => (
    <div className="border-b bg-background sticky top-0 z-[999]">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center flex-shrink-0">
              <Users className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Crew</h1>
              <p className="text-sm text-muted-foreground">Manage team members</p>
            </div>
          </div>
          <Button 
            onClick={() => setIsDialogOpen(true)}
            className="bg-gradient-to-r from-primary to-violet-600"
            data-testid="button-add-crew-header"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Crew
          </Button>
        </div>
      </div>
    </div>
  );

  const activeCount = crew.filter(m => m.status === "joined").length;
  const inactiveCount = crew.filter(m => m.status === "inactive").length;
  const invitedCount = crew.filter(m => m.status === "invited").length;
  const totalCount = crew.length;

  const filteredCrew = crew.filter((member) => {
    if (statusFilter !== "all" && member.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        member.name.toLowerCase().includes(q) ||
        (member.phone && member.phone.toLowerCase().includes(q)) ||
        (member.role && member.role.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const statusFilters = [
    { key: "all" as const, label: "All", count: totalCount },
    { key: "joined" as const, label: "Active", count: activeCount },
    { key: "invited" as const, label: "Invited", count: invitedCount },
    { key: "inactive" as const, label: "Inactive", count: inactiveCount },
  ];

  const getDesktopStatusBadge = (status: string) => {
    switch (status) {
      case "joined":
        return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0"><UserCheck className="h-3 w-3 mr-1" />Available</Badge>;
      case "inactive":
        return <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-0"><UserX className="h-3 w-3 mr-1" />Inactive</Badge>;
      default:
        return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0"><Clock className="h-3 w-3 mr-1" />Invited</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-full bg-background">
        <div className="bg-gradient-to-br from-primary via-primary to-violet-600 text-primary-foreground px-4 pt-6 pb-8">
          <div className="h-8 w-32 bg-white/20 rounded animate-pulse mb-4" />
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white/15 backdrop-blur rounded-2xl p-4 h-20 animate-pulse" />
            ))}
          </div>
        </div>
        <div className="flex-1 px-4 py-6 -mt-4 space-y-3">
          {[1, 2, 3].map(i => (
            <Card key={i} className="border-0 shadow-md">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-14 w-14 rounded-2xl bg-muted animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                    <div className="h-3 w-24 bg-muted animate-pulse rounded" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full bg-background" data-testid="page-crew">
      {isMobile ? renderMobileHeader() : renderDesktopHeader()}

      {/* Main Content */}
      <div className={`flex-1 ${isMobile ? "px-4 py-6 -mt-4" : "max-w-7xl mx-auto px-6 lg:px-8 py-8 w-full"}`}>
        {/* Desktop/Tablet: Summary Stats */}
        {!isMobile && crew.length > 0 && (
          <div className="grid grid-cols-4 gap-4 mb-6" data-testid="desktop-crew-stats">
            {[
              { label: "Total Crew", value: totalCount, icon: Users, color: "text-primary", bg: "bg-primary/10" },
              { label: "Active", value: activeCount, icon: UserCheck, color: "text-emerald-600", bg: "bg-emerald-100 dark:bg-emerald-900/30" },
              { label: "Invited", value: invitedCount, icon: Clock, color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-900/30" },
              { label: "Inactive", value: inactiveCount, icon: UserX, color: "text-gray-500", bg: "bg-gray-100 dark:bg-gray-800" },
            ].map((stat) => (
              <Card key={stat.label} className="border shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-xl ${stat.bg} flex items-center justify-center flex-shrink-0`}>
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold" data-testid={`desktop-stat-${stat.label.toLowerCase().replace(' ', '-')}`}>{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Desktop/Tablet: Search + Filters */}
        {!isMobile && crew.length > 0 && (
          <div className="mb-6 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search crew by name, phone, or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11 rounded-xl"
                data-testid="input-crew-search"
              />
            </div>
            <div className="flex items-center gap-2">
              {statusFilters.map((f) => (
                <Button
                  key={f.key}
                  variant={statusFilter === f.key ? "default" : "outline"}
                  size="sm"
                  className={`rounded-full text-xs ${statusFilter === f.key ? "" : "hover:bg-muted"}`}
                  onClick={() => setStatusFilter(f.key)}
                  data-testid={`filter-${f.key}`}
                >
                  {f.label} ({f.count})
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Add Crew Button */}
        <Button 
          onClick={() => setIsDialogOpen(true)}
          className="w-full mb-6 h-12 bg-gradient-to-r from-primary to-violet-600 shadow-lg"
          data-testid="button-add-crew"
        >
          <UserPlus className="h-5 w-5 mr-2" />
          Add Crew Member
        </Button>

        {crew.length === 0 ? (
          <Card className="border-0 shadow-md overflow-hidden">
            <CardContent className="py-12 text-center">
              <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-primary/20 to-violet-500/20 flex items-center justify-center mx-auto mb-6">
                <Users className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Build Your Team</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">
                Add crew members to assign them to jobs and send automatic notifications
              </p>
              <Button 
                onClick={() => setIsDialogOpen(true)} 
                className="bg-gradient-to-r from-primary to-violet-600"
                data-testid="button-invite-first"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Add Your First Crew Member
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Desktop/Tablet: No results */}
            {!isMobile && filteredCrew.length === 0 && (searchQuery || statusFilter !== "all") && (
              <Card className="border shadow-sm">
                <CardContent className="py-10 text-center">
                  <Search className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                  <h3 className="font-semibold mb-1">No crew members found</h3>
                  <p className="text-sm text-muted-foreground">Try adjusting your search or filters</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => { setSearchQuery(""); setStatusFilter("all"); }}
                    data-testid="button-clear-filters"
                  >
                    Clear Filters
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Crew List — mobile uses original crew array, desktop uses filtered */}
            <div className={isMobile ? "space-y-3" : "grid grid-cols-1 lg:grid-cols-2 gap-4"}>
              {(isMobile ? crew : filteredCrew).map((member) => {
                const statusConfig = getStatusConfig(member.status);
                const StatusIcon = statusConfig.icon;
                const isExpanded = expandedMember === member.id;
                
                return (
                  <Card 
                    key={member.id} 
                    className={`overflow-hidden transition-all duration-200 ${isMobile ? "border-0 shadow-md" : "border shadow-sm hover:shadow-md rounded-xl"}`}
                    data-testid={`card-crew-${member.id}`}
                  >
                    <Collapsible open={isExpanded} onOpenChange={() => toggleExpand(member.id)}>
                      <CardContent className="p-0">
                        <div className="flex items-stretch">
                          <div className={`w-1.5 bg-gradient-to-b ${getRoleColor(member.role)}`} />
                          
                          <div className="flex-1 p-4">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-14 w-14 rounded-2xl">
                                <AvatarFallback className={`bg-gradient-to-br ${getRoleColor(member.role)} text-white text-lg font-semibold rounded-2xl`}>
                                  {getInitials(member.name)}
                                </AvatarFallback>
                              </Avatar>
                              
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="font-semibold text-foreground truncate">{member.name}</h3>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge variant="secondary" className="text-xs capitalize border-0">
                                    {member.role}
                                  </Badge>
                                  {isMobile ? (
                                    <Badge variant="secondary" className={`text-xs border-0 ${statusConfig.color}`}>
                                      <StatusIcon className="h-3 w-3 mr-1" />
                                      {statusConfig.label}
                                    </Badge>
                                  ) : (
                                    getDesktopStatusBadge(member.status)
                                  )}
                                </div>
                                
                                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                  {member.phone && (
                                    <a 
                                      href={`tel:${member.phone}`} 
                                      className="flex items-center gap-1 hover:text-primary"
                                      aria-label={`Call ${member.name}`}
                                      data-testid={`link-phone-${member.id}`}
                                    >
                                      <Phone className="h-3 w-3" />
                                      {member.phone}
                                    </a>
                                  )}
                                  {member.email && (
                                    <a 
                                      href={`mailto:${member.email}`} 
                                      className="flex items-center gap-1 hover:text-primary truncate"
                                      aria-label={`Email ${member.name}`}
                                      data-testid={`link-email-${member.id}`}
                                    >
                                      <Mail className="h-3 w-3" />
                                      <span className="truncate max-w-[120px]">{member.email}</span>
                                    </a>
                                  )}
                                </div>

                                {/* Desktop/Tablet: Quick Action Buttons */}
                                {!isMobile && (
                                  <div className="flex items-center gap-2 mt-3">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-8 text-xs rounded-lg"
                                      onClick={() => toast({ title: "Assign job feature coming soon" })}
                                      data-testid={`button-assign-${member.id}`}
                                    >
                                      <ClipboardList className="h-3 w-3 mr-1" />
                                      Assign Job
                                    </Button>
                                    {member.email && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 text-xs rounded-lg"
                                        asChild
                                      >
                                        <a href={`mailto:${member.email}`} data-testid={`button-message-${member.id}`}>
                                          <MessageSquare className="h-3 w-3 mr-1" />
                                          Message
                                        </a>
                                      </Button>
                                    )}
                                    {member.phone && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 text-xs rounded-lg"
                                        asChild
                                      >
                                        <a href={`tel:${member.phone}`} data-testid={`button-call-${member.id}`}>
                                          <PhoneCall className="h-3 w-3 mr-1" />
                                          Call
                                        </a>
                                      </Button>
                                    )}
                                  </div>
                                )}
                              </div>
                              
                              <div className="flex items-center gap-1">
                                <CollapsibleTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9"
                                    aria-label={isExpanded ? "Collapse job assignments" : "Expand job assignments"}
                                    data-testid={`button-expand-${member.id}`}
                                  >
                                    {isExpanded ? (
                                      <ChevronUp className="h-5 w-5 text-muted-foreground" />
                                    ) : (
                                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                                    )}
                                  </Button>
                                </CollapsibleTrigger>
                                
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-9 w-9" 
                                      aria-label={`Actions for ${member.name}`}
                                      data-testid={`button-menu-${member.id}`}
                                    >
                                      <MoreVertical className="h-5 w-5 text-muted-foreground" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    {member.status === "invited" && (
                                      <DropdownMenuItem 
                                        onClick={() => updateMutation.mutate({ id: member.id, status: "joined" })}
                                        data-testid={`menu-join-${member.id}`}
                                      >
                                        <UserCheck className="h-4 w-4 mr-2" />
                                        Mark as Joined
                                      </DropdownMenuItem>
                                    )}
                                    {member.status === "joined" && (
                                      <DropdownMenuItem 
                                        onClick={() => updateMutation.mutate({ id: member.id, status: "inactive" })}
                                        data-testid={`menu-inactive-${member.id}`}
                                      >
                                        <UserX className="h-4 w-4 mr-2" />
                                        Mark as Inactive
                                      </DropdownMenuItem>
                                    )}
                                    {member.status === "inactive" && (
                                      <DropdownMenuItem 
                                        onClick={() => updateMutation.mutate({ id: member.id, status: "joined" })}
                                        data-testid={`menu-reactivate-${member.id}`}
                                      >
                                        <UserCheck className="h-4 w-4 mr-2" />
                                        Reactivate
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem 
                                      onClick={() => deleteMutation.mutate(member.id)}
                                      className="text-destructive focus:text-destructive"
                                      data-testid={`menu-remove-${member.id}`}
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Remove
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <CollapsibleContent>
                          <div className="border-t bg-muted/30 p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <Briefcase className="h-4 w-4 text-primary" />
                              <h4 className="text-sm font-medium">Job Assignments</h4>
                            </div>
                            
                            {crewInvites.length === 0 ? (
                              <div className="text-center py-6">
                                <Calendar className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                                <p className="text-sm text-muted-foreground">No jobs assigned yet</p>
                                <p className="text-xs text-muted-foreground/70 mt-1">
                                  Assign this crew member to a job to see their assignments here
                                </p>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {crewInvites.map((invite) => (
                                  <div 
                                    key={invite.id}
                                    className="flex items-center justify-between p-3 rounded-xl bg-background border"
                                    data-testid={`invite-${invite.id}`}
                                  >
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium truncate">
                                        {invite.jobTitle || `Job #${invite.jobId}`}
                                      </p>
                                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        {invite.jobDate ? new Date(invite.jobDate).toLocaleDateString('en-US', { 
                                          month: 'short', 
                                          day: 'numeric',
                                          year: 'numeric'
                                        }) : "Date TBD"}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {getInviteStatusBadge(invite.status)}
                                      {(invite.status === "pending" || invite.status === "viewed") && (
                                        <div className="flex gap-1">
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => copyInviteLink(invite.token)}
                                            aria-label="Copy invite link"
                                            data-testid={`button-copy-${invite.id}`}
                                          >
                                            <Copy className="h-4 w-4" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-destructive hover:text-destructive"
                                            onClick={() => revokeMutation.mutate(invite.id)}
                                            disabled={revokeMutation.isPending}
                                            aria-label="Revoke invite"
                                            data-testid={`button-revoke-${invite.id}`}
                                          >
                                            <Link2Off className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </CollapsibleContent>
                      </CardContent>
                    </Collapsible>
                  </Card>
                );
              })}
            </div>
          </>
        )}
        
        <div className={isMobile ? "h-6" : "h-8"} />
      </div>

      {/* Add Crew Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-add-crew">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Add Crew Member
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="firstName" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  First Name *
                </Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  placeholder="John"
                  className="h-11"
                  data-testid="input-crew-first-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Last Name
                </Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  placeholder="Doe"
                  className="h-11"
                  data-testid="input-crew-last-name"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Phone Number
              </Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder="(555) 000-0000"
                className="h-11"
                data-testid="input-crew-phone"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john@example.com"
                className="h-11"
                data-testid="input-crew-email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Role
              </Label>
              <Select
                value={formData.role}
                onValueChange={(v) => setFormData({ ...formData, role: v, customRole: "" })}
              >
                <SelectTrigger className="h-11" data-testid="select-crew-role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="plumber">Plumber</SelectItem>
                  <SelectItem value="electrician">Electrician</SelectItem>
                  <SelectItem value="cleaner">Cleaner</SelectItem>
                  <SelectItem value="helper">Helper</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.role === "other" && (
              <div className="space-y-2">
                <Label htmlFor="customRole" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Custom Role
                </Label>
                <Input
                  id="customRole"
                  value={formData.customRole}
                  onChange={(e) => setFormData({ ...formData, customRole: e.target.value })}
                  placeholder="e.g., Carpenter, HVAC Tech"
                  className="h-11"
                  data-testid="input-crew-custom-role"
                />
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsDialogOpen(false)}
                data-testid="button-cancel-crew"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createMutation.isPending} 
                className="bg-gradient-to-r from-primary to-violet-600"
                data-testid="button-save-crew"
              >
                {createMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <UserPlus className="h-4 w-4 mr-2" />
                )}
                Add Member
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
