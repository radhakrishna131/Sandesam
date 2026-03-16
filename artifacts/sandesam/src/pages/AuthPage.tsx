import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { MessageSquare, ArrowRight, Lock, Phone } from "lucide-react";
import { useLogin, useSignup, useVerifyDob, useResetPassword, getGetMeQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const loginSchema = z.object({
  phoneNumber: z.string().min(5, "Phone number is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const forgotStep1Schema = z.object({ phoneNumber: z.string().min(5) });
const forgotStep2Schema = z.object({ dateOfBirth: z.string().min(1) });
const forgotStep3Schema = z.object({ newPassword: z.string().min(6) });

type AuthMode = "login" | "signup" | "forgot";

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<AuthMode>("login");
  const [forgotStep, setForgotStep] = useState<1 | 2 | 3>(1);
  const [forgotPhone, setForgotPhone] = useState("");
  const [resetToken, setResetToken] = useState("");

  const loginMutation = useLogin({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        if (data.profileComplete) {
          setLocation("/");
        } else {
          setLocation("/setup-profile");
        }
      },
      onError: (error: any) => {
        toast({
          title: "Login Failed",
          description: error.error || "Invalid credentials",
          variant: "destructive"
        });
      }
    }
  });

  const signupMutation = useSignup({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        setLocation("/setup-profile");
      },
      onError: (error: any) => {
        toast({
          title: "Signup Failed",
          description: error.error || "Phone number may already be in use",
          variant: "destructive"
        });
      }
    }
  });

  const verifyDobMutation = useVerifyDob();
  const resetPasswordMutation = useResetPassword();

  const { register: registerAuth, handleSubmit: handleAuthSubmit, formState: { errors: authErrors } } = useForm({
    resolver: zodResolver(loginSchema)
  });

  const onAuthSubmit = (data: any) => {
    if (mode === "login") {
      loginMutation.mutate({ data });
    } else {
      signupMutation.mutate({ data });
    }
  };

  const onForgotStep1 = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const phone = fd.get("phoneNumber") as string;
    if (phone) {
      setForgotPhone(phone);
      setForgotStep(2);
    }
  };

  const onForgotStep2 = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const dob = fd.get("dateOfBirth") as string;
    if (dob) {
      verifyDobMutation.mutate(
        { data: { phoneNumber: forgotPhone, dateOfBirth: dob } },
        {
          onSuccess: (data) => {
            setResetToken(data.resetToken);
            setForgotStep(3);
          },
          onError: () => {
            toast({ title: "Verification Failed", description: "Date of birth does not match.", variant: "destructive" });
          }
        }
      );
    }
  };

  const onForgotStep3 = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const pwd = fd.get("newPassword") as string;
    if (pwd) {
      resetPasswordMutation.mutate(
        { data: { resetToken, newPassword: pwd } },
        {
          onSuccess: () => {
            toast({ title: "Password Reset", description: "You can now login with your new password." });
            setMode("login");
            setForgotStep(1);
          },
          onError: () => {
            toast({ title: "Reset Failed", description: "Something went wrong.", variant: "destructive" });
          }
        }
      );
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <img 
          src={`${import.meta.env.BASE_URL}images/auth-bg.png`} 
          alt="Background" 
          className="w-full h-full object-cover opacity-20 dark:opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent"></div>
      </div>

      <div className="relative z-10 w-full max-w-md px-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-teal-600 rounded-2xl flex items-center justify-center shadow-xl shadow-teal-500/20 mb-4 transform rotate-12 hover:rotate-0 transition-all duration-300">
            <MessageSquare className="text-white w-8 h-8 -rotate-12 hover:rotate-0 transition-all" />
          </div>
          <h1 className="text-4xl font-display font-bold tracking-tight text-foreground">Sandesam</h1>
          <p className="text-muted-foreground mt-2 font-medium">
            {mode === "login" ? "Welcome back." : mode === "signup" ? "Create an account." : "Reset your password."}
          </p>
        </div>

        <div className="bg-card/50 backdrop-blur-2xl border border-white/10 dark:border-white/5 rounded-3xl p-8 shadow-2xl">
          {mode !== "forgot" ? (
            <form onSubmit={handleAuthSubmit(onAuthSubmit)} className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground/80 ml-1">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input 
                    {...registerAuth("phoneNumber")} 
                    placeholder="+1 234 567 8900" 
                    className="pl-12"
                  />
                </div>
                {authErrors.phoneNumber && <p className="text-xs text-destructive ml-1">{authErrors.phoneNumber.message as string}</p>}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-sm font-semibold text-foreground/80">Password</label>
                  {mode === "login" && (
                    <button type="button" onClick={() => setMode("forgot")} className="text-xs font-semibold text-primary hover:underline">
                      Forgot?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input 
                    type="password"
                    {...registerAuth("password")} 
                    placeholder="••••••••" 
                    className="pl-12"
                  />
                </div>
                {authErrors.password && <p className="text-xs text-destructive ml-1">{authErrors.password.message as string}</p>}
              </div>

              <Button 
                type="submit" 
                variant="gradient" 
                className="w-full mt-6"
                disabled={loginMutation.isPending || signupMutation.isPending}
              >
                {mode === "login" ? "Sign In" : "Create Account"}
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </form>
          ) : (
            <div className="space-y-5">
              {forgotStep === 1 && (
                <form onSubmit={onForgotStep1} className="space-y-5 animate-in fade-in zoom-in-95">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground/80 ml-1">Enter your phone number</label>
                    <Input name="phoneNumber" placeholder="Phone Number" required />
                  </div>
                  <Button type="submit" variant="gradient" className="w-full">Continue</Button>
                </form>
              )}
              {forgotStep === 2 && (
                <form onSubmit={onForgotStep2} className="space-y-5 animate-in fade-in slide-in-from-right-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground/80 ml-1">Verify Date of Birth</label>
                    <Input name="dateOfBirth" type="date" required />
                    <p className="text-xs text-muted-foreground ml-1">To verify it's you, enter your registered DOB.</p>
                  </div>
                  <Button type="submit" variant="gradient" className="w-full" disabled={verifyDobMutation.isPending}>
                    {verifyDobMutation.isPending ? "Verifying..." : "Verify"}
                  </Button>
                </form>
              )}
              {forgotStep === 3 && (
                <form onSubmit={onForgotStep3} className="space-y-5 animate-in fade-in slide-in-from-right-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground/80 ml-1">New Password</label>
                    <Input name="newPassword" type="password" placeholder="New Password" required minLength={6} />
                  </div>
                  <Button type="submit" variant="gradient" className="w-full" disabled={resetPasswordMutation.isPending}>
                    Reset Password
                  </Button>
                </form>
              )}
            </div>
          )}

          {/* Toggle Mode */}
          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground">
              {mode === "login" ? "Don't have an account?" : "Already have an account?"}
              <button 
                type="button"
                onClick={() => {
                  setMode(mode === "login" ? "signup" : "login");
                  setForgotStep(1);
                }}
                className="ml-2 font-bold text-foreground hover:text-primary transition-colors"
              >
                {mode === "login" ? "Sign Up" : "Sign In"}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
