import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useUpload } from "@/hooks/use-upload";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Camera, Loader2, User, Mail, Phone, Building2, MapPin, FileText, Sparkles } from "lucide-react";
import { PhoneInput } from "@/components/ui/phone-input";
import { BioEditor } from "@/components/settings/BioEditor";

interface UserProfile {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  photo: string | null;
  businessName: string | null;
  bio: string | null;
  services: string[] | null;
  serviceArea: string | null;
}

const profileFormSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  companyName: z.string().optional(),
  phone: z.string().optional(),
  bio: z.string().optional(),
  serviceArea: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileFormSchema>;

function parseStoredName(name: string | null): { firstName: string; lastName: string } {
  if (!name) return { firstName: "", lastName: "" };
  const parts = name.trim().split(" ");
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export default function Profile() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const { data: profile, isLoading } = useQuery<UserProfile>({
    queryKey: ["/api/profile"],
  });

  const { uploadFile, isUploading } = useUpload({
    onSuccess: async (response) => {
      setPhotoUrl(response.objectPath);
      await updateMutation.mutateAsync({ photo: response.objectPath });
    },
    onError: (error) => {
      toast({ title: "Failed to upload photo", variant: "destructive" });
    },
  });

  const parsedName = parseStoredName(profile?.name || null);

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      companyName: "",
      phone: "",
      bio: "",
      serviceArea: "",
    },
    values: profile ? {
      firstName: parsedName.firstName,
      lastName: parsedName.lastName,
      email: profile.email || "",
      companyName: profile.businessName || "",
      phone: profile.phone || "",
      bio: profile.bio || "",
      serviceArea: profile.serviceArea || "",
    } : undefined,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<{ name: string; email: string; phone: string; photo: string; businessName: string; bio: string; serviceArea: string }>) => {
      return apiRequest("PATCH", "/api/profile", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      toast({ title: "Profile updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update profile", variant: "destructive" });
    },
  });

  const onSubmit = (data: ProfileFormData) => {
    const fullName = `${data.firstName} ${data.lastName}`.trim();
    updateMutation.mutate({
      name: fullName,
      email: data.email || "",
      phone: data.phone || "",
      businessName: data.companyName || "",
      bio: data.bio || "",
      serviceArea: data.serviceArea || "",
    });
  };

  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast({ title: "Please select an image file", variant: "destructive" });
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: "Image must be less than 5MB", variant: "destructive" });
        return;
      }
      await uploadFile(file);
    }
  };

  const currentPhoto = photoUrl || profile?.photo;
  const displayName = profile?.name || "Gig Worker";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 text-white px-4 pt-6 pb-20">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full blur-3xl" />
          </div>
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/more")}
              className="mb-4 -ml-2 text-white/80 hover:text-white hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <h1 className="text-2xl font-bold">Profile</h1>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24" data-testid="page-profile">
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 text-white px-4 pt-6 pb-24">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 -left-10 w-32 h-32 bg-slate-400/10 rounded-full blur-2xl" />
        </div>
        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/more")}
            className="mb-4 -ml-2 text-white/80 hover:text-white hover:bg-white/10"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <h1 className="text-2xl font-bold">Profile</h1>
          <p className="text-slate-300/80 mt-1">Manage your personal information</p>
        </div>
      </div>

      <div className="px-4 -mt-16 relative z-10">
        <Card className="border-0 shadow-lg mb-6">
          <CardContent className="pt-6 flex flex-col items-center">
            <div className="relative mb-4">
              <Avatar className="h-28 w-28 ring-4 ring-background shadow-lg">
                {currentPhoto ? (
                  <AvatarImage src={currentPhoto} alt="Profile" />
                ) : null}
                <AvatarFallback className="bg-gradient-to-br from-primary to-violet-600 text-white text-3xl font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <Button
                size="icon"
                className="absolute bottom-0 right-0 h-10 w-10 rounded-full shadow-md bg-primary"
                onClick={handlePhotoClick}
                disabled={isUploading}
                data-testid="button-change-photo"
              >
                {isUploading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Camera className="h-5 w-5" />
                )}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
                data-testid="input-photo"
              />
            </div>
            <h2 className="font-semibold text-lg">{displayName}</h2>
            {profile?.businessName && (
              <p className="text-sm text-muted-foreground">{profile.businessName}</p>
            )}
            <Badge variant="secondary" className="mt-2">Free Plan</Badge>
          </CardContent>
        </Card>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Card className="border-0 shadow-md">
              <CardContent className="pt-6">
                <h3 className="font-medium mb-4 flex items-center gap-2 text-sm text-muted-foreground uppercase tracking-wide">
                  <User className="h-4 w-4" />
                  Personal Info
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="First"
                              {...field}
                              data-testid="input-first-name"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Last"
                              {...field}
                              data-testid="input-last-name"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                          Email
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="your@email.com"
                            {...field}
                            data-testid="input-email"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                          Phone Number
                        </FormLabel>
                        <FormControl>
                          <PhoneInput
                            id="phone"
                            value={field.value || ""}
                            onChange={field.onChange}
                            data-testid="input-phone"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md">
              <CardContent className="pt-6">
                <h3 className="font-medium mb-4 flex items-center gap-2 text-sm text-muted-foreground uppercase tracking-wide">
                  <Building2 className="h-4 w-4" />
                  Business Info
                </h3>
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="companyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Your Company Name"
                            {...field}
                            data-testid="input-company-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="serviceArea"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                          Service Area
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., Los Angeles, Orange County"
                            {...field}
                            data-testid="input-service-area"
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground mt-1">
                          Cities, neighborhoods, or regions you serve
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md">
              <CardContent className="pt-6">
                <h3 className="font-medium mb-4 flex items-center gap-2 text-sm text-muted-foreground uppercase tracking-wide">
                  <FileText className="h-4 w-4" />
                  About You
                </h3>
                <BioEditor
                  value={form.watch("bio") || ""}
                  onChange={(bio) => form.setValue("bio", bio)}
                  businessName={form.watch("companyName") || ""}
                  services={profile?.services || []}
                />
              </CardContent>
            </Card>

            <Button
              type="submit"
              className="w-full h-12 text-base"
              disabled={updateMutation.isPending}
              data-testid="button-save"
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
