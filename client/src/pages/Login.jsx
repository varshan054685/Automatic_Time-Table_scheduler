import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLogin, useRegister, useRequestOtp, useVerifyOtp, useGoogleLogin, useAuthConfig } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useLocation } from "wouter";
import { Calendar, Mail, Lock, ArrowRight, Sparkles, Eye, EyeOff, Phone, User, Loader2 } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [emailOtpVerified, setEmailOtpVerified] = useState(false);
  const [phoneOtpVerified, setPhoneOtpVerified] = useState(false);
  const [emailCountdown, setEmailCountdown] = useState(0);
  const [phoneCountdown, setPhoneCountdown] = useState(0);
  const [emailError, setEmailError] = useState(null);
  const [phoneError, setPhoneError] = useState(null);

  const loginMutation = useLogin();
  const registerMutation = useRegister();
  const requestOtpMutation = useRequestOtp();
  const verifyOtpMutation = useVerifyOtp();
  const googleLogin = useGoogleLogin();
  const { config: authConfig } = useAuthConfig();
  const [, setLocation] = useLocation();

  const form = useForm({
    defaultValues: {
      identifier: "",
      email: "",
      phoneNumber: "",
      password: "",
      name: "",
      emailOtp: "",
      phoneOtp: "",
    },
  });

  const email = form.watch("email");
  const phoneNumber = form.watch("phoneNumber");

  // Reset form and states when switching modes
  useEffect(() => {
    form.reset();
    setEmailOtpSent(false);
    setPhoneOtpSent(false);
    setEmailOtpVerified(false);
    setPhoneOtpVerified(false);
    setEmailCountdown(0);
    setPhoneCountdown(0);
    setEmailError(null);
    setPhoneError(null);
  }, [isRegister, form]);

  // Countdown timer for OTP resend
  useEffect(() => {
    if (emailCountdown > 0) {
      const timer = setTimeout(() => setEmailCountdown(emailCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [emailCountdown]);

  useEffect(() => {
    if (phoneCountdown > 0) {
      const timer = setTimeout(() => setPhoneCountdown(phoneCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [phoneCountdown]);

  const handleRequestOtp = async (type) => {
    const value = type === "email" ? email : phoneNumber;
    if (!value) {
      const errorMsg = `Please enter ${type === "email" ? "an email" : "a phone number"} first`;
      if (type === "email") setEmailError(errorMsg);
      else setPhoneError(errorMsg);
      return;
    }

    if (type === "email") setEmailError(null);
    else setPhoneError(null);

    try {
      await requestOtpMutation.mutateAsync({
        [type === "email" ? "email" : "phoneNumber"]: value,
        type,
      });

      if (type === "email") {
        setEmailOtpSent(true);
        setEmailCountdown(60);
      } else {
        setPhoneOtpSent(true);
        setPhoneCountdown(60);
      }
    } catch (err) {
      // Error is handled by mutation
    }
  };

  const handleVerifyOtp = async (type) => {
    const otpValue = form.getValues(type === "email" ? "emailOtp" : "phoneOtp");
    const value = type === "email" ? email : phoneNumber;

    if (!otpValue || otpValue.length !== 6) {
      const errorMsg = "Please enter a valid 6-digit OTP";
      if (type === "email") setEmailError(errorMsg);
      else setPhoneError(errorMsg);
      return;
    }

    if (type === "email") setEmailError(null);
    else setPhoneError(null);

    try {
      await verifyOtpMutation.mutateAsync({
        [type === "email" ? "email" : "phoneNumber"]: value,
        type,
        otp: otpValue,
      });

      if (type === "email") {
        setEmailOtpVerified(true);
      } else {
        setPhoneOtpVerified(true);
      }
    } catch (err) {
      // Error is handled by mutation
    }
  };

  function onSubmit(values) {
    if (isRegister) {
      // For registration, we need to include the verified OTPs
      const registrationData = {
        email: values.email || undefined,
        phoneNumber: values.phoneNumber || undefined,
        password: values.password,
        name: values.name,
        emailOtp: emailOtpVerified ? values.emailOtp : undefined,
        phoneOtp: phoneOtpVerified ? values.phoneOtp : undefined,
      };

      // Remove undefined values
      Object.keys(registrationData).forEach(key => {
        if (registrationData[key] === undefined) delete registrationData[key];
      });

      registerMutation.mutate(registrationData, {
        onSuccess: () => setLocation("/"),
      });
    } else {
      // For login, use identifier (email or phone)
      loginMutation.mutate(
        { identifier: values.identifier, password: values.password },
        { onSuccess: () => setLocation("/") }
      );
    }
  }

  const isPending = loginMutation.isPending || registerMutation.isPending || requestOtpMutation.isPending || verifyOtpMutation.isPending;
  const error = loginMutation.error || registerMutation.error || requestOtpMutation.error || verifyOtpMutation.error;

  // Check if both required OTPs are verified (if applicable)
  const canRegister = () => {
    if (!isRegister) return true;
    const emailRequired = !!email;
    const phoneRequired = !!phoneNumber;
    if (emailRequired && !emailOtpVerified) return false;
    if (phoneRequired && !phoneOtpVerified) return false;
    return true;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo & Header */}
        <div className="text-center mb-8 select-none cursor-default">
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
          <CardHeader className="select-none cursor-default">
            <CardTitle className="text-white">
              {isRegister ? "Register" : "Login"}
            </CardTitle>
            <CardDescription className="text-slate-400">
              {isRegister ? "Fill in your details to get started" : "Enter your credentials to continue"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Google Sign In Button - only show on login and when configured */}
            {!isRegister && authConfig?.googleOAuthEnabled && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={googleLogin}
                  className="w-full h-11 bg-white hover:bg-gray-100 text-gray-900 border-0 mb-4 font-medium"
                >
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Continue with Google
                </Button>

                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-white/10" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-slate-900/50 px-2 text-slate-400">Or continue with</span>
                  </div>
                </div>
              </>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {isRegister ? (
                  <>
                    {/* Registration Form */}
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-300 select-none cursor-default">Full Name</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <User className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                              <Input
                                placeholder="John Doe"
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
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-300 select-none cursor-default">
                            Email (Optional)
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                              <Input
                                type="email"
                                placeholder="you@example.com"
                                {...field}
                                disabled={emailOtpVerified}
                                className="h-11 pl-10 bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:ring-indigo-500 disabled:opacity-50"
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Email OTP Section */}
                    {email && !emailOtpVerified && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <FormField
                            control={form.control}
                            name="emailOtp"
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormControl>
                                  <InputOTP maxLength={6} {...field}>
                                    <InputOTPGroup>
                                      <InputOTPSlot index={0} />
                                      <InputOTPSlot index={1} />
                                      <InputOTPSlot index={2} />
                                      <InputOTPSlot index={3} />
                                      <InputOTPSlot index={4} />
                                      <InputOTPSlot index={5} />
                                    </InputOTPGroup>
                                  </InputOTP>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => emailOtpSent ? handleVerifyOtp("email") : handleRequestOtp("email")}
                            disabled={emailCountdown > 0 || isPending}
                            className="h-10 px-3 bg-white/5 border-white/10 text-white hover:bg-white/10"
                          >
                            {requestOtpMutation.isPending && emailOtpSent ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : emailOtpSent ? (
                              "Verify"
                            ) : emailCountdown > 0 ? (
                              `${emailCountdown}s`
                            ) : (
                              "Send OTP"
                            )}
                          </Button>
                        </div>
                        {emailOtpVerified && (
                          <p className="text-xs text-green-400">Email verified successfully</p>
                        )}
                      </div>
                    )}

                    {emailOtpVerified && (
                      <p className="text-xs text-green-400 flex items-center gap-1">
                        <span className="inline-block w-2 h-2 bg-green-400 rounded-full"></span>
                        Email verified
                      </p>
                    )}
                    {emailError && (
                      <p className="text-xs text-red-400">{emailError}</p>
                    )}

                    <FormField
                      control={form.control}
                      name="phoneNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-300 select-none cursor-default">
                            Phone Number (Optional)
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Phone className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                              <Input
                                type="tel"
                                placeholder="+1234567890"
                                {...field}
                                disabled={phoneOtpVerified}
                                className="h-11 pl-10 bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:ring-indigo-500 disabled:opacity-50"
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Phone OTP Section */}
                    {phoneNumber && !phoneOtpVerified && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <FormField
                            control={form.control}
                            name="phoneOtp"
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormControl>
                                  <InputOTP maxLength={6} {...field}>
                                    <InputOTPGroup>
                                      <InputOTPSlot index={0} />
                                      <InputOTPSlot index={1} />
                                      <InputOTPSlot index={2} />
                                      <InputOTPSlot index={3} />
                                      <InputOTPSlot index={4} />
                                      <InputOTPSlot index={5} />
                                    </InputOTPGroup>
                                  </InputOTP>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => phoneOtpSent ? handleVerifyOtp("phone") : handleRequestOtp("phone")}
                            disabled={phoneCountdown > 0 || isPending}
                            className="h-10 px-3 bg-white/5 border-white/10 text-white hover:bg-white/10"
                          >
                            {requestOtpMutation.isPending && phoneOtpSent ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : phoneOtpSent ? (
                              "Verify"
                            ) : phoneCountdown > 0 ? (
                              `${phoneCountdown}s`
                            ) : (
                              "Send OTP"
                            )}
                          </Button>
                        </div>
                      </div>
                    )}

                    {phoneOtpVerified && (
                      <p className="text-xs text-green-400 flex items-center gap-1">
                        <span className="inline-block w-2 h-2 bg-green-400 rounded-full"></span>
                        Phone verified
                      </p>
                    )}
                    {phoneError && (
                      <p className="text-xs text-red-400">{phoneError}</p>
                    )}

                    <p className="text-xs text-slate-400">
                      * You must provide at least email or phone number and verify it with OTP
                    </p>
                  </>
                ) : (
                  <>
                    {/* Login Form */}
                    <FormField
                      control={form.control}
                      name="identifier"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-300 select-none cursor-default">
                            Email or Phone Number
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                              <Input
                                placeholder="you@example.com or +1234567890"
                                {...field}
                                className="h-11 pl-10 bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:ring-indigo-500"
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-300 select-none cursor-default">Password</FormLabel>
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
                  disabled={isPending || (isRegister && !canRegister())}
                >
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
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
