import { useState } from "react";
import { useLocation } from "wouter";
import { Camera, ArrowRight, Loader2 } from "lucide-react";
import { useGetMe, useUpdateProfile, useUploadFile, getGetMeQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQueryClient } from "@tanstack/react-query";

export default function ProfileSetupPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useGetMe({ query: { retry: false } });
  
  const [username, setUsername] = useState("");
  const [dob, setDob] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const updateMutation = useUpdateProfile();
  const uploadMutation = useUploadFile();

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!user) {
    setLocation("/login");
    return null;
  }
  if (user.username && user.dateOfBirth) {
    setLocation("/");
    return null;
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setAvatarPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !dob) {
      toast({ title: "Incomplete", description: "Username and Date of Birth are required", variant: "destructive" });
      return;
    }

    try {
      let profilePictureUrl = user.profilePictureUrl || "";
      
      if (avatarFile) {
        const uploadRes = await uploadMutation.mutateAsync({ data: { file: avatarFile } });
        profilePictureUrl = uploadRes.url;
      }

      await updateMutation.mutateAsync({
        data: { username, dateOfBirth: dob, profilePictureUrl }
      });

      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      toast({ title: "Profile Complete", description: "Welcome to Sandesam!" });
      setLocation("/");
      
    } catch (err) {
      toast({ title: "Error", description: "Failed to update profile", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background relative">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -right-[10%] w-[70%] h-[70%] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute -bottom-[20%] -left-[10%] w-[60%] h-[60%] rounded-full bg-emerald-500/5 blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-md p-8 bg-card rounded-3xl shadow-2xl border border-border">
        <h2 className="text-3xl font-display font-bold text-center mb-2">Complete Profile</h2>
        <p className="text-center text-muted-foreground mb-8 text-sm">Just a few details before you start chatting.</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex justify-center mb-6">
            <div className="relative group cursor-pointer">
              <Avatar className="w-24 h-24 ring-4 ring-background shadow-xl">
                <AvatarImage src={avatarPreview || undefined} />
                <AvatarFallback className="text-2xl bg-muted text-muted-foreground">
                  {username ? username.substring(0,2).toUpperCase() : <Camera className="w-8 h-8 opacity-50" />}
                </AvatarFallback>
              </Avatar>
              <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                <Camera className="w-6 h-6 text-white" />
                <input type="file" className="hidden" accept="image/*" onChange={handleAvatarChange} />
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold ml-1">Username</label>
            <Input 
              placeholder="e.g. johndoe" 
              value={username} 
              onChange={e => setUsername(e.target.value)} 
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold ml-1">Date of Birth</label>
            <Input 
              type="date" 
              value={dob} 
              onChange={e => setDob(e.target.value)} 
              required
            />
            <p className="text-xs text-muted-foreground ml-1">Required for account recovery.</p>
          </div>

          <Button 
            type="submit" 
            variant="gradient" 
            className="w-full mt-4"
            disabled={updateMutation.isPending || uploadMutation.isPending}
          >
            {updateMutation.isPending ? "Saving..." : "Start Chatting"}
            <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
