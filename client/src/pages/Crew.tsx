import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Users, Plus, Trash2, Mail, Phone, UserCheck, UserX, Clock, Loader2, ChevronDown, ChevronUp, Briefcase, CheckCircle2, XCircle, Link2Off, ExternalLink } from "lucide-react";
import type { CrewMember } from "@shared/schema";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    role: "helper" as string,
    customRole: "",
  });

  const { data: crew = [], isLoading } = useQuery<CrewMember[]>({
    queryKey: ["/api/crew"],
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; phone: string; email: string; role: string }) => apiRequest("POST", "/api/crew", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crew"] });
      setIsDialogOpen(false);
      resetForm();
      toast({ title: "Crew member invited" });
    },
    onError: () => {
      toast({ title: "Failed to invite crew member", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/crew/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crew"] });
      toast({ title: "Crew member updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/crew/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crew"] });
      toast({ title: "Crew member removed" });
    },
  });

  const { data: crewInvites = [] } = useQuery<CrewInvite[]>({
    queryKey: ["/api/crew", expandedMember, "invites"],
    queryFn: async () => {
      if (!expandedMember) return [];
      const res = await fetch(`/api/crew/${expandedMember}/invites`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!expandedMember,
  });

  const revokeMutation = useMutation({
    mutationFn: (inviteId: string) => apiRequest("POST", `/api/crew-invites/${inviteId}/revoke`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crew", expandedMember, "invites"] });
      toast({ title: "Invite revoked successfully" });
    },
    onError: () => {
      toast({ title: "Failed to revoke invite", variant: "destructive" });
    },
  });

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "invited":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Invited</Badge>;
      case "joined":
        return <Badge className="bg-green-500"><UserCheck className="h-3 w-3 mr-1" />Joined</Badge>;
      case "inactive":
        return <Badge variant="outline"><UserX className="h-3 w-3 mr-1" />Inactive</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getRoleBadge = (role: string) => {
    const roleColors: Record<string, string> = {
      plumber: "bg-blue-500",
      electrician: "bg-yellow-500",
      cleaner: "bg-green-500",
      helper: "bg-gray-500",
      other: "bg-purple-500",
    };
    return (
      <Badge className={roleColors[role] || "bg-gray-500"}>
        {role.charAt(0).toUpperCase() + role.slice(1)}
      </Badge>
    );
  };

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const getInviteStatusBadge = (status: string) => {
    switch (status) {
      case "confirmed":
        return <Badge className="bg-emerald-500/10 text-emerald-600 text-xs"><CheckCircle2 className="h-3 w-3 mr-1" />Confirmed</Badge>;
      case "declined":
        return <Badge className="bg-red-500/10 text-red-600 text-xs"><XCircle className="h-3 w-3 mr-1" />Declined</Badge>;
      case "revoked":
        return <Badge className="bg-gray-500/10 text-gray-600 text-xs"><Link2Off className="h-3 w-3 mr-1" />Revoked</Badge>;
      case "expired":
        return <Badge className="bg-gray-500/10 text-gray-600 text-xs"><Clock className="h-3 w-3 mr-1" />Expired</Badge>;
      case "viewed":
        return <Badge className="bg-blue-500/10 text-blue-600 text-xs"><ExternalLink className="h-3 w-3 mr-1" />Viewed</Badge>;
      default:
        return <Badge className="bg-amber-500/10 text-amber-600 text-xs"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    }
  };

  const toggleExpand = (memberId: string) => {
    setExpandedMember(expandedMember === memberId ? null : memberId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 pb-24 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Crew</h1>
        <Button onClick={() => setIsDialogOpen(true)} data-testid="button-invite-crew">
          <Plus className="h-4 w-4 mr-1" />
          Invite
        </Button>
      </div>

      {crew.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-medium mb-2">No crew members yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Invite team members to help with your jobs
            </p>
            <Button onClick={() => setIsDialogOpen(true)} data-testid="button-invite-first">
              Invite Your First Crew Member
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {crew.map((member) => (
            <Card key={member.id} data-testid={`card-crew-${member.id}`}>
              <Collapsible open={expandedMember === member.id} onOpenChange={() => toggleExpand(member.id)}>
                <CardContent className="py-4">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{member.name}</span>
                        {getRoleBadge(member.role)}
                        {getStatusBadge(member.status)}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                        {member.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {member.phone}
                          </span>
                        )}
                        {member.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {member.email}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {member.status === "invited" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateMutation.mutate({ id: member.id, status: "joined" });
                          }}
                          data-testid={`button-mark-joined-${member.id}`}
                        >
                          Mark Joined
                        </Button>
                      )}
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          data-testid={`button-expand-${member.id}`}
                        >
                          {expandedMember === member.id ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteMutation.mutate(member.id);
                        }}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-remove-${member.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  
                  <CollapsibleContent className="mt-4 pt-4 border-t">
                    <div className="space-y-3">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                        <Briefcase className="h-3 w-3" />
                        Job Assignments
                      </p>
                      {crewInvites.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-2">No job assignments yet</p>
                      ) : (
                        <div className="space-y-2">
                          {crewInvites.map((invite) => (
                            <div 
                              key={invite.id}
                              className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                              data-testid={`invite-${invite.id}`}
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {invite.jobTitle || `Job #${invite.jobId}`}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {invite.jobDate ? new Date(invite.jobDate).toLocaleDateString() : "Date TBD"}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                {getInviteStatusBadge(invite.status)}
                                {(invite.status === "pending" || invite.status === "viewed") && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => revokeMutation.mutate(invite.id)}
                                    disabled={revokeMutation.isPending}
                                    className="text-destructive hover:text-destructive"
                                    data-testid={`button-revoke-${invite.id}`}
                                  >
                                    <Link2Off className="h-4 w-4" />
                                  </Button>
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
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent data-testid="dialog-invite-crew">
          <DialogHeader>
            <DialogTitle>Invite Crew Member</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  placeholder="First name"
                  data-testid="input-crew-first-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  placeholder="Last name"
                  data-testid="input-crew-last-name"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  placeholder="(555) 000-0000"
                  data-testid="input-crew-phone"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select
                  value={formData.role}
                  onValueChange={(v) => setFormData({ ...formData, role: v, customRole: "" })}
                >
                  <SelectTrigger data-testid="select-crew-role">
                    <SelectValue />
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
            </div>

            {formData.role === "other" && (
              <div className="space-y-2">
                <Label htmlFor="customRole">Custom Role</Label>
                <Input
                  id="customRole"
                  value={formData.customRole}
                  onChange={(e) => setFormData({ ...formData, customRole: e.target.value })}
                  placeholder="Enter role (e.g., Carpenter, HVAC)"
                  data-testid="input-crew-custom-role"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@example.com"
                data-testid="input-crew-email"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending} data-testid="button-send-invite">
                {createMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : null}
                Send Invite
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
