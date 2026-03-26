import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLogin, useRegister } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useLocation } from "wouter";
import { Calendar, Mail, Lock, ArrowRight, Sparkles, Eye, EyeOff } from "lucide-react";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const loginMutation = useLogin();
  const registerMutation = useRegister();
  const [, setLocation] = useLocation();

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  // Reset form errors when switching modes
  useEffect(() => {
    form.clearErrors();
  }, [isRegister, form]);

  function onSubmit(values) {
    if (isRegister) {
      registerMutation.mutate(values, {
        onSuccess: () => setLocation("/"),
      });
    } else {
      loginMutation.mutate(values, {
        onSuccess: () => setLocation("/"),
      });
    }
  }

  const isPending = loginMutation.isPending || registerMutation.isPending;
  const error = loginMutation.error || registerMutation.error;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo & Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white mb-4 shadow-lg shadow-indigo-500/25">
            <Calendar className="w-8 h-8" />
          </div>
          <h1 className="font-display text-3xl font-bold text-white">
            {isRegister ? "Create Account" : "Welcome Back"}
          </h1>
          <p className="text-slate-400 mt-2">
            {isRegister ? "Sign up to start scheduling" : "Sign in to manage the college schedule"}
          </p>
        </div>

        <Card className="border-0 shadow-2xl shadow-black/20 bg-white/5 backdrop-blur-xl border border-white/10">
          <CardHeader>
            <CardTitle className="text-white">
              {isRegister ? "Register" : "Login"}
            </CardTitle>
            <CardDescription className="text-slate-400">
              {isRegister ? "Fill in your details to get started" : "Enter your credentials to continue"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-300">Email</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                          <Input 
                            placeholder="you@example.com" 
                            {...field} 
                            className="h-11 pl-10 bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:ring-indigo-500" 
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-300">Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                          <Input 
                            type={showPassword ? "text" : "password"} 
                            placeholder="Min 6 characters" 
                            {...field} 
                            className="h-11 px-10 bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:ring-indigo-500" 
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-3 text-slate-500 hover:text-slate-300 focus:outline-none"
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button 
                  type="submit" 
                  className="w-full h-11 text-base font-semibold bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 border-0" 
                  disabled={isPending}
                >
                  {isPending ? (
                    "Processing..."
                  ) : (
                    <span className="flex items-center gap-2">
                      {isRegister ? "Create Account" : "Sign In"} 
                      {isRegister ? <Sparkles className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                    </span>
                  )}
                </Button>
                {error && (
                  <p className="text-sm text-red-400 text-center mt-2">{error.message}</p>
                )}
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Toggle */}
        <div className="text-center mt-6">
          <button
            onClick={() => {
              setIsRegister(!isRegister);
              form.reset();
            }}
            className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            {isRegister ? (
              <>Already have an account? <span className="font-semibold underline">Sign In</span></>
            ) : (
              <>New user? <span className="font-semibold underline">Create Account</span></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
