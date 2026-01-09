import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { ArrowLeft, Camera, Loader2 } from "lucide-react";

interface UserProfile {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  photo: string | null;
}

const countryCodes = [
  { value: "+1", label: "+1 (US/CA)" },
  { value: "+44", label: "+44 (UK)" },
  { value: "+61", label: "+61 (AU)" },
  { value: "+49", label: "+49 (DE)" },
  { value: "+33", label: "+33 (FR)" },
  { value: "+34", label: "+34 (ES)" },
  { value: "+39", label: "+39 (IT)" },
  { value: "+81", label: "+81 (JP)" },
  { value: "+86", label: "+86 (CN)" },
  { value: "+91", label: "+91 (IN)" },
  { value: "+52", label: "+52 (MX)" },
  { value: "+55", label: "+55 (BR)" },
];

const profileFormSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  countryCode: z.string().optional(),
  phoneNumber: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileFormSchema>;

function parseStoredName(name: string | null): { firstName: string; lastName: string } {
  if (!name) return { firstName: "", lastName: "" };
  const parts = name.trim().split(" ");
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function parseStoredPhone(phone: string | null): { countryCode: string; phoneNumber: string } {
  if (!phone) return { countryCode: "+1", phoneNumber: "" };
  for (const code of countryCodes) {
    if (phone.startsWith(code.value)) {
      return { countryCode: code.value, phoneNumber: phone.slice(code.value.length).trim() };
    }
  }
  return { countryCode: "+1", phoneNumber: phone };
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
  const parsedPhone = parseStoredPhone(profile?.phone || null);

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      countryCode: "+1",
      phoneNumber: "",
    },
    values: profile ? {
      firstName: parsedName.firstName,
      lastName: parsedName.lastName,
      email: profile.email || "",
      countryCode: parsedPhone.countryCode,
      phoneNumber: parsedPhone.phoneNumber,
    } : undefined,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<{ name: string; email: string; phone: string; photo: string }>) => {
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
    const fullPhone = data.phoneNumber ? `${data.countryCode} ${data.phoneNumber}`.trim() : "";
    updateMutation.mutate({
      name: fullName,
      email: data.email || "",
      phone: fullPhone,
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
      <div className="flex flex-col min-h-full">
        <TopBar title="Profile" showActions={false} />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full" data-testid="page-profile">
      <TopBar title="Profile" showActions={false} />

      <div className="px-4 py-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/more")}
          className="mb-4 -ml-2"
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>

        <Card className="mb-6">
          <CardContent className="pt-6 flex flex-col items-center">
            <div className="relative mb-4">
              <Avatar className="h-24 w-24">
                {currentPhoto ? (
                  <AvatarImage src={currentPhoto} alt="Profile" />
                ) : null}
                <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <Button
                size="icon"
                variant="secondary"
                className="absolute bottom-0 right-0 h-8 w-8 rounded-full"
                onClick={handlePhotoClick}
                disabled={isUploading}
                data-testid="button-change-photo"
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
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
            <p className="text-sm text-muted-foreground">
              Tap the camera icon to change your photo
            </p>
          </CardContent>
        </Card>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardContent className="pt-6 space-y-4">
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
                      <FormLabel>Email</FormLabel>
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

                <div>
                  <FormLabel className="mb-2 block">Phone Number</FormLabel>
                  <div className="grid grid-cols-[100px_1fr] gap-2">
                    <FormField
                      control={form.control}
                      name="countryCode"
                      render={({ field }) => (
                        <FormItem>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-country-code">
                                <SelectValue placeholder="+1" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {countryCodes.map((code) => (
                                <SelectItem key={code.value} value={code.value}>
                                  {code.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="phoneNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              type="tel"
                              placeholder="555-123-4567"
                              {...field}
                              data-testid="input-phone-number"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Button
              type="submit"
              className="w-full"
              disabled={updateMutation.isPending}
              data-testid="button-save"
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
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
