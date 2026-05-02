import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLogin, useRegister, useRequestOtp, useVerifyOtp, useGoogleLogin, useAuthConfig, useForgotPassword, useResetPassword } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useLocation } from "wouter";
import { Calendar, Mail, Lock, ArrowRight, Sparkles, Eye, EyeOff, User, Loader2, CheckCircle2, Shield, CheckCircle } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { motion, AnimatePresence } from "framer-motion";

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [otpError, setOtpError] = useState(null);
  // Forgot password states
  const [fpOtpSent, setFpOtpSent] = useState(false);
  const [fpOtpVerified, setFpOtpVerified] = useState(false);
  const [fpCountdown, setFpCountdown] = useState(0);
  const [fpError, setFpError] = useState(null);

  const loginMutation = useLogin();
  const registerMutation = useRegister();
  const requestOtpMutation = useRequestOtp();
  const verifyOtpMutation = useVerifyOtp();
  const forgotPasswordMutation = useForgotPassword();
  const resetPasswordMutation = useResetPassword();
  const googleLogin = useGoogleLogin();
  const { config: authConfig, isLoading: isAuthConfigLoading } = useAuthConfig();
  const [, setLocation] = useLocation();

  const form = useForm({
    defaultValues: {
      identifier: "",
      email: "",
      password: "",
      confirmPassword: "",
      name: "",
      otp: "",
      resetIdentifier: "",
      resetOtp: "",
      newPassword: "",
      confirmNewPassword: "",
    },
  });

  const email = form.watch("email");

  // Reset form and states when switching between login/register
  useEffect(() => {
    form.reset();
    setOtpSent(false);
    setOtpVerified(false);
    setCountdown(0);
    setOtpError(null);
  }, [isRegister, form]);

  // Countdown timer for OTP resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Countdown timer for forgot password OTP
  useEffect(() => {
    if (fpCountdown > 0) {
      const timer = setTimeout(() => setFpCountdown(fpCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [fpCountdown]);

  // Reset forgot password state when entering/leaving forgot password mode
  useEffect(() => {
    if (!isForgotPassword) {
      setFpOtpSent(false);
      setFpOtpVerified(false);
      setFpCountdown(0);
      setFpError(null);
    }
  }, [isForgotPassword]);

  const handleRequestOtp = async () => {
    if (!email) {
      setOtpError("Please enter an email address first");
      return;
    }
    setOtpError(null);

    try {
      await requestOtpMutation.mutateAsync({
        email: email,
        type: "email",
      });
      setOtpSent(true);
      setCountdown(60);
    } catch (err) {
      // Error handled by mutation
    }
  };

  const handleVerifyOtp = async () => {
    const otpValue = form.getValues("otp");

    if (!otpValue || otpValue.length !== 6) {
      setOtpError("Please enter a valid 6-digit OTP");
      return;
    }

    try {
      await verifyOtpMutation.mutateAsync({
        email: email,
        type: "email",
        otp: otpValue,
      });
      setOtpVerified(true);
    } catch (err) {
      // Error handled by mutation
    }
  };

  function onSubmit(values) {
    if (isForgotPassword && fpOtpVerified) {
      // Validate passwords match
      if (values.newPassword !== values.confirmNewPassword) {
        form.setError("confirmNewPassword", { message: "Passwords do not match" });
        return;
      }
      // Reset password
      resetPasswordMutation.mutate({
        identifier: values.resetIdentifier,
        otp: values.resetOtp,
        newPassword: values.newPassword,
      }, {
        onSuccess: () => {
          // Auto-login with the new password
          loginMutation.mutate(
            { identifier: values.resetIdentifier, password: values.newPassword },
            { onSuccess: () => setLocation("/") }
          );
        },
      });
    } else if (isRegister) {
      // Validate passwords match
      if (values.password !== values.confirmPassword) {
        form.setError("confirmPassword", { message: "Passwords do not match" });
        return;
      }
      // Build registration data with email OTP
      const registrationData = {
        name: values.name,
        email: values.email,
        password: values.password,
      };
      if (otpVerified) registrationData.emailOtp = values.otp;

      registerMutation.mutate(registrationData, {
        onSuccess: () => setLocation("/"),
      });
    } else {
      loginMutation.mutate(
        { identifier: values.identifier, password: values.password },
        { onSuccess: () => setLocation("/") }
      );
    }
  }

  // Forgot password handlers
  const handleForgotPasswordRequest = async () => {
    const email = form.getValues("resetIdentifier");
    if (!email) {
      setFpError("Please enter your email address");
      return;
    }
    setFpError(null);

    try {
      await forgotPasswordMutation.mutateAsync({ identifier: email });
      setFpOtpSent(true);
      setFpCountdown(60);
    } catch (err) {
      // Error handled by mutation
    }
  };

  const handleForgotPasswordVerify = async () => {
    const email = form.getValues("resetIdentifier");
    const otpValue = form.getValues("resetOtp");

    if (!otpValue || otpValue.length !== 6) {
      setFpError("Please enter a valid 6-digit reset code");
      return;
    }
    setFpError(null);

    try {
      await verifyOtpMutation.mutateAsync({
        email: email,
        type: "email",
        otp: otpValue,
      });
      setFpOtpVerified(true);
    } catch (err) {
      // Error handled by mutation
    }
  };

  const isPending = loginMutation.isPending || registerMutation.isPending || requestOtpMutation.isPending || verifyOtpMutation.isPending || forgotPasswordMutation.isPending || resetPasswordMutation.isPending;
  const error = loginMutation.error || registerMutation.error || requestOtpMutation.error || verifyOtpMutation.error;

  // Show Google OAuth button when config hasn't explicitly disabled it and not in forgot password mode
  const showGoogleButton = !isRegister && !isForgotPassword && authConfig?.googleOAuthEnabled !== false;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
      {/* Animated background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-500/8 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-500/8 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/5 rounded-full blur-3xl" />
      </div>

      <motion.div
        className="w-full max-w-md relative z-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        {/* Logo & Header */}
        <div className="text-center mb-8 select-none cursor-default">
          <motion.div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white mb-4 shadow-lg shadow-indigo-500/25"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
          >
            <Calendar className="w-8 h-8" />
          </motion.div>
          <AnimatePresence mode="wait">
            <motion.div
              key={isRegister ? "register-header" : "login-header"}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              <h1 className="font-display text-3xl font-bold text-white">
                {isRegister ? "Create Account" : "Welcome Back"}
              </h1>
              <p className="text-slate-400 mt-2">
                {isRegister ? "Sign up to start scheduling" : "Sign in to manage the college schedule"}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        <Card className="border-0 shadow-2xl shadow-black/20 bg-white/5 backdrop-blur-xl border border-white/10">
          <CardHeader className="select-none cursor-default pb-4">
            <CardTitle className="text-white text-lg">
              {isForgotPassword ? "Reset Password" : isRegister ? "Register" : "Login"}
            </CardTitle>
            <CardDescription className="text-slate-400">
              {isForgotPassword ? "Enter your email to receive a reset code" : isRegister ? "Fill in your details to get started" : "Enter your credentials to continue"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AnimatePresence mode="wait">
              <motion.div
                key={isRegister ? "register-form" : "login-form"}
                initial={{ opacity: 0, x: isRegister ? 20 : -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: isRegister ? -20 : 20 }}
                transition={{ duration: 0.3 }}
              >
                {/* Google Sign In — Login only */}
                {showGoogleButton && (
                  <div className="mb-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={googleLogin}
                      disabled={isAuthConfigLoading}
                      className="w-full h-12 bg-white hover:bg-gray-50 text-gray-800 border-0 font-medium rounded-xl shadow-sm transition-all hover:shadow-md active:scale-[0.98]"
                    >
                      <svg className="w-5 h-5 mr-2.5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                      </svg>
                      Continue with Google
                    </Button>

                    <div className="relative my-5">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-white/10" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-slate-900/80 px-3 text-slate-500 tracking-wider">Or continue with</span>
                      </div>
                    </div>
                  </div>
                )}

                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    {isForgotPassword ? (
                      <>
                        {/* ── Forgot Password Form ── */}

                        {!fpOtpVerified ? (
                          <>
                            {/* Step 1: Enter email and send OTP */}
                            <FormField
                              control={form.control}
                              name="resetIdentifier"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-slate-300 select-none cursor-default text-sm font-medium">Email Address</FormLabel>
                                  <FormControl>
                                    <div className="relative">
                                      <Mail className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
                                      <Input
                                        placeholder="you@example.com"
                                        {...field}
                                        className="h-12 pl-10 bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 rounded-xl transition-all"
                                      />
                                    </div>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            {/* OTP Section - Enhanced */}
                            {fpOtpSent && (
                              <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="space-y-3"
                              >
                                <div className="flex items-center justify-between">
                                  <FormLabel className="text-slate-200 text-sm font-medium flex items-center gap-2">
                                    <Shield className="w-4 h-4 text-indigo-400" />
                                    Enter Verification Code
                                  </FormLabel>
                                  <span className="text-xs text-slate-400">
                                    {fpOtpVerified ? (
                                      <span className="text-green-400 flex items-center gap-1">
                                        <CheckCircle className="w-3 h-3" /> Verified
                                      </span>
                                    ) : (
                                      "6 digits"
                                    )}
                                  </span>
                                </div>
                                
                                <div className="flex items-center gap-3">
                                  <FormField
                                    control={form.control}
                                    name="resetOtp"
                                    render={({ field }) => (
                                      <FormItem className="flex-1">
                                        <FormControl>
                                          <InputOTP 
                                            maxLength={6} 
                                            {...field}
                                            className="gap-2"
                                            disabled={fpOtpVerified}
                                          >
                                            <InputOTPGroup className="gap-2">
                                              {[0, 1, 2, 3, 4, 5].map((index) => (
                                                <InputOTPSlot 
                                                  key={index}
                                                  index={index}
                                                  className="w-12 h-14 text-xl font-bold bg-white/10 border-white/20 text-white rounded-xl focus:bg-white/20 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/50 transition-all duration-200 data-[active=true]:bg-white/20 data-[active=true]:border-indigo-500 data-[active=true]:scale-105"
                                                />
                                              ))}
                                            </InputOTPGroup>
                                          </InputOTP>
                                        </FormControl>
                                        <FormMessage className="text-red-400 text-xs mt-1" />
                                      </FormItem>
                                    )}
                                  />
                                  {!fpOtpVerified && (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={handleForgotPasswordVerify}
                                      disabled={isPending || form.getValues("resetOtp")?.length !== 6}
                                      className="h-14 px-4 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border-indigo-500/50 text-white hover:from-indigo-500/30 hover:to-purple-500/30 hover:border-indigo-400 transition-all duration-200 rounded-xl"
                                    >
                                      {verifyOtpMutation.isPending ? (
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                      ) : (
                                        <>
                                          <CheckCircle2 className="h-4 w-4 mr-1" />
                                          Verify
                                        </>
                                      )}
                                    </Button>
                                  )}
                                </div>
                                
                                {fpCountdown > 0 && !fpOtpVerified && (
                                  <p className="text-xs text-slate-400 text-center">
                                    Resend available in <span className="text-indigo-400 font-medium">{fpCountdown}s</span>
                                  </p>
                                )}
                              </motion.div>
                            )}

                            {fpError && (
                              <motion.div 
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl"
                              >
                                <Shield className="w-4 h-4 text-red-400 flex-shrink-0" />
                                <p className="text-xs text-red-300">{fpError}</p>
                              </motion.div>
                            )}

                            <Button
                              type="button"
                              onClick={handleForgotPasswordRequest}
                              disabled={fpCountdown > 0 || isPending}
                              className="w-full h-11 text-base font-semibold bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 border-0"
                            >
                              {forgotPasswordMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : fpCountdown > 0 ? (
                                `Resend in ${fpCountdown}s`
                              ) : (
                                "Send Reset Code"
                              )}
                            </Button>
                            {fpOtpSent && !fpOtpVerified && (
                              <p className="text-xs text-amber-400/80 text-center">
                                Check your spam/junk folder if you don't see the email
                              </p>
                            )}
                          </>
                        ) : (
                          <>
                            {/* Step 2: Enter new password */}
                            <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                              <p className="text-sm text-green-400 flex items-center gap-2">
                                <CheckCircle className="w-4 h-4" />
                                Code verified! Enter your new password.
                              </p>
                            </div>

                            <FormField
                              control={form.control}
                              name="newPassword"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-slate-300 select-none cursor-default text-sm font-medium">New Password</FormLabel>
                                  <FormControl>
                                    <div className="relative">
                                      <Lock className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
                                      <Input
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Min 6 characters"
                                        {...field}
                                        className="h-12 pl-10 pr-10 bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 rounded-xl transition-all"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-3.5 text-slate-500 hover:text-slate-300 focus:outline-none"
                                      >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                      </button>
                                    </div>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="confirmNewPassword"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-slate-300 select-none cursor-default text-sm font-medium">Confirm New Password</FormLabel>
                                  <FormControl>
                                    <div className="relative">
                                      <Lock className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
                                      <Input
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Re-enter new password"
                                        {...field}
                                        className="h-12 pl-10 pr-10 bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 rounded-xl transition-all"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-3.5 text-slate-500 hover:text-slate-300 focus:outline-none"
                                      >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                      </button>
                                    </div>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                          </>
                        )}
                      </>
                    ) : isRegister ? (
                      <>
                        {/* ── Registration Form ── */}

                        {/* Full Name */}
                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-slate-300 select-none cursor-default text-sm font-medium">Full Name</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <User className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
                                  <Input
                                    placeholder="John Doe"
                                    {...field}
                                    className="h-12 pl-10 bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 rounded-xl transition-all"
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Email Field */}
                        <FormField
                          control={form.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-slate-300 select-none cursor-default text-sm font-medium">
                                Email Address
                              </FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Mail className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
                                  <Input
                                    type="email"
                                    placeholder="you@example.com"
                                    {...field}
                                    disabled={otpVerified}
                                    className="h-12 pl-10 bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 rounded-xl disabled:opacity-50 transition-all"
                                  />
                                  {otpVerified && (
                                    <CheckCircle2 className="absolute right-3 top-3.5 h-4 w-4 text-emerald-400" />
                                  )}
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* OTP Verification Section - Enhanced */}
                        {!otpVerified ? (
                          <div className="space-y-4">
                            {otpSent && (
                              <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="space-y-4"
                              >
                                <div className="flex items-center gap-2 p-3 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 rounded-xl">
                                  <div className="w-10 h-10 rounded-full bg-indigo-500/30 flex items-center justify-center flex-shrink-0">
                                    <Mail className="w-5 h-5 text-indigo-300" />
                                  </div>
                                  <div className="flex-1">
                                    <p className="text-sm text-white font-medium">OTP Sent!</p>
                                    <p className="text-xs text-indigo-200">
                                      Check your email inbox
                                    </p>
                                  </div>
                                </div>

                                <div className="space-y-3">
                                  <div className="flex items-center justify-between">
                                    <FormLabel className="text-slate-200 text-sm font-medium flex items-center gap-2">
                                      <Shield className="w-4 h-4 text-emerald-400" />
                                      Enter Verification Code
                                    </FormLabel>
                                    <span className="text-xs text-slate-400">6 digits</span>
                                  </div>
                                  
                                  <FormField
                                    control={form.control}
                                    name="otp"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormControl>
                                          <InputOTP 
                                            maxLength={6} 
                                            {...field}
                                            className="gap-3 justify-center"
                                          >
                                            <InputOTPGroup className="gap-3">
                                              {[0, 1, 2, 3, 4, 5].map((index) => (
                                                <InputOTPSlot 
                                                  key={index}
                                                  index={index}
                                                  className="w-14 h-16 text-2xl font-bold bg-white/10 border-2 border-white/20 text-white rounded-2xl focus:bg-white/20 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/30 transition-all duration-200 data-[active=true]:bg-white/20 data-[active=true]:border-emerald-500 data-[active=true]:scale-110 data-[active=true]:shadow-lg data-[active=true]:shadow-emerald-500/20"
                                                />
                                              ))}
                                            </InputOTPGroup>
                                          </InputOTP>
                                        </FormControl>
                                        <FormMessage className="text-red-400 text-sm mt-2 text-center" />
                                      </FormItem>
                                    )}
                                  />
                                </div>

                                <Button
                                  type="button"
                                  onClick={handleVerifyOtp}
                                  disabled={isPending || form.getValues("otp")?.length !== 6}
                                  className="w-full h-12 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white border-0 rounded-xl text-base font-semibold transition-all duration-200 disabled:opacity-50"
                                >
                                  {verifyOtpMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <span className="flex items-center gap-2">
                                      <Shield className="w-4 h-4" />
                                      Verify OTP
                                    </span>
                                  )}
                                </Button>
                              </motion.div>
                            )}

                            {!otpSent && (
                              <Button
                                type="button"
                                variant="outline"
                                onClick={handleRequestOtp}
                                disabled={isPending}
                                className="w-full h-10 bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white rounded-xl text-sm transition-all"
                              >
                                {requestOtpMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <span className="flex items-center gap-2">
                                    <Mail className="w-4 h-4" />
                                    Send Verification OTP
                                  </span>
                                )}
                              </Button>
                            )}

                            {otpSent && (
                              <p className="text-xs text-amber-400/80 text-center">
                                Check your spam/junk folder if you don't see the email
                              </p>
                            )}

                            {otpSent && countdown > 0 && (
                              <p className="text-xs text-slate-500 text-center">
                                Resend available in {countdown}s
                              </p>
                            )}
                            {otpSent && countdown === 0 && (
                              <button
                                type="button"
                                onClick={handleRequestOtp}
                                disabled={isPending}
                                className="w-full text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                              >
                                Resend OTP
                              </button>
                            )}
                          </div>
                        ) : (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex items-center gap-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3"
                          >
                            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-emerald-300">
                                Email verified
                              </p>
                              <p className="text-xs text-emerald-400/70">
                                Your email address has been confirmed
                              </p>
                            </div>
                          </motion.div>
                        )}

                        {otpError && (
                          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{otpError}</p>
                        )}

                        {/* Password Fields - Show after OTP verified for Register */}
                        {otpVerified && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-4"
                          >
                            <FormField
                              control={form.control}
                              name="password"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-slate-300 select-none cursor-default text-sm font-medium">Password</FormLabel>
                                  <FormControl>
                                    <div className="relative">
                                      <Lock className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
                                      <Input
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Min 6 characters"
                                        {...field}
                                        className="h-12 pl-10 pr-10 bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 rounded-xl transition-all"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-3.5 text-slate-500 hover:text-slate-300 focus:outline-none"
                                      >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                      </button>
                                    </div>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="confirmPassword"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-slate-300 select-none cursor-default text-sm font-medium">Confirm Password</FormLabel>
                                  <FormControl>
                                    <div className="relative">
                                      <Lock className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
                                      <Input
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Re-enter your password"
                                        {...field}
                                        className="h-12 pl-10 pr-10 bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 rounded-xl transition-all"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-3.5 text-slate-500 hover:text-slate-300 focus:outline-none"
                                      >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                      </button>
                                    </div>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </motion.div>
                        )}
                      </>
                    ) : (
                      <>
                        {/* ── Login Form ── */}
                        <FormField
                          control={form.control}
                          name="identifier"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-slate-300 select-none cursor-default text-sm font-medium">
                                Email Address
                              </FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Mail className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
                                  <Input
                                    placeholder="you@example.com"
                                    {...field}
                                    className="h-12 pl-10 bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 rounded-xl transition-all"
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Password Field - Login Only */}
                        <FormField
                          control={form.control}
                          name="password"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-slate-300 select-none cursor-default text-sm font-medium">Password</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Lock className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
                                  <Input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Enter your password"
                                    {...field}
                                    className="h-12 px-10 bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 rounded-xl transition-all"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-3.5 text-slate-500 hover:text-slate-300 focus:outline-none transition-colors"
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
                      </>
                    )}

                    {/* Submit Button - Only show for login, register, or forgot password after OTP verified */}
                    {(!isForgotPassword || (isForgotPassword && fpOtpVerified)) && (
                      <Button
                        type="submit"
                        className="w-full h-12 text-base font-semibold bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 border-0 rounded-xl shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all active:scale-[0.98]"
                        disabled={isPending || (isRegister && !otpVerified) || (isForgotPassword && !fpOtpVerified)}
                      >
                        {isPending ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <span className="flex items-center gap-2">
                            {isRegister ? "Create Account" : isForgotPassword ? "Reset Password" : "Sign In"}
                            {isRegister ? <Sparkles className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                          </span>
                        )}
                      </Button>
                    )}

                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 ${error.field ? "border-l-4 border-l-red-400" : "text-center"}`}
                      >
                        <p className="font-medium">{error.field && error.field === "identifier" ? "Account not found" : error.field === "password" ? "Incorrect password" : "Error"}</p>
                        <p className={error.field ? "text-xs mt-1 opacity-90" : ""}>{error.message}</p>
                      </motion.div>
                    )}
                  </form>
                </Form>
              </motion.div>
            </AnimatePresence>
          </CardContent>
        </Card>

        {/* Toggle Login/Register / Forgot Password */}
        <div className="text-center mt-6 space-y-2">
          {!isForgotPassword && (
            <button
              onClick={() => {
                setIsRegister(!isRegister);
                loginMutation.reset(); // Clear any login errors
              }}
              className="text-sm text-slate-400 hover:text-slate-300 transition-colors block w-full"
            >
              {isRegister ? (
                <>Already have an account? <span className="font-semibold text-indigo-400 hover:text-indigo-300 underline underline-offset-2">Sign In</span></>
              ) : (
                <>New user? <span className="font-semibold text-indigo-400 hover:text-indigo-300 underline underline-offset-2">Create Account</span></>
              )}
            </button>
          )}
          {!isRegister && !isForgotPassword && (
            <button
              onClick={() => {
                setIsForgotPassword(true);
                loginMutation.reset(); // Clear any login errors
              }}
              className="text-sm text-slate-500 hover:text-indigo-400 transition-colors block w-full"
            >
              Forgot your password?
            </button>
          )}
          {isForgotPassword && (
            <button
              onClick={() => {
                setIsForgotPassword(false);
                loginMutation.reset(); // Clear any login errors
              }}
              className="text-sm text-slate-400 hover:text-slate-300 transition-colors block w-full"
            >
              Remember your password? <span className="font-semibold text-indigo-400 hover:text-indigo-300 underline underline-offset-2">Sign In</span>
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
