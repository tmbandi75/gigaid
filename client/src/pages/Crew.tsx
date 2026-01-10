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
import { Users, Plus, Trash2, Mail, Phone, UserCheck, UserX, Clock, Loader2 } from "lucide-react";
import type { CrewMember } from "@shared/schema";

export default function Crew() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    role: "helper" as string,
  });

  const { data: crew = [], isLoading } = useQuery<CrewMember[]>({
    queryKey: ["/api/crew"],
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => apiRequest("POST", "/api/crew", data),
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

  const resetForm = () => {
    setFormData({ name: "", phone: "", email: "", role: "helper" });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      toast({ title: "Please enter a name", variant: "destructive" });
      return;
    }
    createMutation.mutate(formData);
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
                        onClick={() => updateMutation.mutate({ id: member.id, status: "joined" })}
                        data-testid={`button-mark-joined-${member.id}`}
                      >
                        Mark Joined
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(member.id)}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-remove-${member.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
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
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter name"
                data-testid="input-crew-name"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(555) 000-0000"
                  data-testid="input-crew-phone"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select
                  value={formData.role}
                  onValueChange={(v) => setFormData({ ...formData, role: v })}
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
