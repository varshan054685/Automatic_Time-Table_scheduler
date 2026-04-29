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
import { Calendar, Mail, Lock, ArrowRight, Sparkles, Eye, EyeOff, Phone, User, Loader2, CheckCircle2, Shield, CheckCircle } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { motion, AnimatePresence } from "framer-motion";

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  // Registration: which verification method is selected
  const [verifyMethod, setVerifyMethod] = useState("email"); // "email" or "phone"
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
      phoneNumber: "",
      password: "",
      name: "",
      otp: "",
      resetIdentifier: "",
      resetOtp: "",
      newPassword: "",
    },
  });

  const email = form.watch("email");
  const phoneNumber = form.watch("phoneNumber");

  // Reset form and states when switching between login/register
  useEffect(() => {
    form.reset();
    setOtpSent(false);
    setOtpVerified(false);
    setCountdown(0);
    setOtpError(null);
    setVerifyMethod("email");
  }, [isRegister, form]);

  // Reset OTP state when switching verify method
  useEffect(() => {
    setOtpSent(false);
    setOtpVerified(false);
    setCountdown(0);
    setOtpError(null);
    form.setValue("otp", "");
  }, [verifyMethod, form]);

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
    const value = verifyMethod === "email" ? email : phoneNumber;
    if (!value) {
      setOtpError(`Please enter ${verifyMethod === "email" ? "an email address" : "a phone number"} first`);
      return;
    }
    setOtpError(null);

    try {
      await requestOtpMutation.mutateAsync({
        [verifyMethod === "email" ? "email" : "phoneNumber"]: value,
        type: verifyMethod,
      });
      setOtpSent(true);
      setCountdown(60);
    } catch (err) {
      // Error handled by mutation
    }
  };

  const handleVerifyOtp = async () => {
    const otpValue = form.getValues("otp");
    const value = verifyMethod === "email" ? email : phoneNumber;

    if (!otpValue || otpValue.length !== 6) {
      setOtpError("Please enter a valid 6-digit OTP");
      return;
    }
    setOtpError(null);

    try {
      await verifyOtpMutation.mutateAsync({
        [verifyMethod === "email" ? "email" : "phoneNumber"]: value,
        type: verifyMethod,
        otp: otpValue,
      });
      setOtpVerified(true);
    } catch (err) {
      // Error handled by mutation
    }
  };

  function onSubmit(values) {
    if (isForgotPassword && fpOtpVerified) {
      // Reset password
      resetPasswordMutation.mutate({
        identifier: values.resetIdentifier,
        otp: values.resetOtp,
        newPassword: values.newPassword,
      }, {
        onSuccess: () => {
          setIsForgotPassword(false);
          form.reset();
          setLocation("/");
        },
      });
    } else if (isRegister) {
      const registrationData = {
        password: values.password,
        name: values.name,
      };

      if (verifyMethod === "email") {
        registrationData.email = values.email;
        if (otpVerified) registrationData.emailOtp = values.otp;
      } else {
        registrationData.phoneNumber = values.phoneNumber;
        if (otpVerified) registrationData.phoneOtp = values.otp;
      }

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
    const identifier = form.getValues("resetIdentifier");
    if (!identifier) {
      setFpError("Please enter your email or phone number");
      return;
    }
    setFpError(null);

    try {
      await forgotPasswordMutation.mutateAsync({ identifier });
      setFpOtpSent(true);
      setFpCountdown(60);
    } catch (err) {
      // Error handled by mutation
    }
  };

  const handleForgotPasswordVerify = async () => {
    const identifier = form.getValues("resetIdentifier");
    const otpValue = form.getValues("resetOtp");

    if (!otpValue || otpValue.length !== 6) {
      setFpError("Please enter a valid 6-digit reset code");
      return;
    }
    setFpError(null);

    try {
      await verifyOtpMutation.mutateAsync({
        identifier: identifier,
        type: identifier.includes("@") ? "email" : "phone",
        otp: otpValue,
      });
      setFpOtpVerified(true);
    } catch (err) {
      // Error handled by mutation
    }
  };

  const isPending = loginMutation.isPending || registerMutation.isPending || requestOtpMutation.isPending || verifyOtpMutation.isPending || forgotPasswordMutation.isPending || resetPasswordMutation.isPending;
  const error = loginMutation.error || registerMutation.error || requestOtpMutation.error || verifyOtpMutation.error;

  // Show Google OAuth button when config hasn't explicitly disabled it (fixes first-load issue)
  const showGoogleButton = !isRegister && authConfig?.googleOAuthEnabled !== false;

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
              {isRegister ? "Register" : "Login"}
            </CardTitle>
            <CardDescription className="text-slate-400">
              {isRegister ? "Fill in your details to get started" : "Enter your credentials to continue"}
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
                            {/* Step 1: Enter email/phone and send OTP */}
                            <FormField
                              control={form.control}
                              name="resetIdentifier"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-slate-300 select-none cursor-default text-sm font-medium">Email or Phone Number</FormLabel>
                                  <FormControl>
                                    <div className="relative">
                                      <Mail className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
                                      <Input
                                        placeholder="you@example.com or +1234567890"
                                        {...field}
                                        className="h-12 pl-10 bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 rounded-xl transition-all"
                                      />
                                    </div>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            {/* OTP Section */}
                            {fpOtpSent && (
                              <div className="space-y-2">
                                <FormLabel className="text-slate-300 text-sm">Enter Reset Code</FormLabel>
                                <div className="flex items-center gap-2">
                                  <FormField
                                    control={form.control}
                                    name="resetOtp"
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
                                    onClick={handleForgotPasswordVerify}
                                    disabled={isPending}
                                    className="h-10 px-3 bg-white/5 border-white/10 text-white hover:bg-white/10"
                                  >
                                    {verifyOtpMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
                                  </Button>
                                </div>
                              </div>
                            )}

                            {fpError && (
                              <p className="text-xs text-red-400">{fpError}</p>
                            )}

                            <Button
                              type="button"
                              onClick={fpOtpSent ? handleForgotPasswordVerify : handleForgotPasswordRequest}
                              disabled={fpCountdown > 0 || isPending}
                              className="w-full h-11 text-base font-semibold bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 border-0"
                            >
                              {forgotPasswordMutation.isPending || verifyOtpMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : fpOtpSent ? (
                                "Verify Reset Code"
                              ) : fpCountdown > 0 ? (
                                `Resend in ${fpCountdown}s`
                              ) : (
                                "Send Reset Code"
                              )}
                            </Button>
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

                            <Button
                              type="submit"
                              disabled={resetPasswordMutation.isPending}
                              className="w-full h-11 text-base font-semibold bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 border-0"
                            >
                              {resetPasswordMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <span className="flex items-center gap-2">
                                  Reset Password <ArrowRight className="w-4 h-4" />
                                </span>
                              )}
                            </Button>
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

                        {/* Verification Method Selector */}
                        <div className="space-y-3">
                          <label className="text-sm font-medium text-slate-300 select-none cursor-default">
                            Verify with
                          </label>
                          <div className="grid grid-cols-2 gap-2 p-1 bg-white/5 rounded-xl border border-white/10">
                            <button
                              type="button"
                              onClick={() => setVerifyMethod("email")}
                              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                                verifyMethod === "email"
                                  ? "bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-md shadow-indigo-500/25"
                                  : "text-slate-400 hover:text-slate-300 hover:bg-white/5"
                              }`}
                            >
                              <Mail className="w-4 h-4" />
                              Email
                            </button>
                            <button
                              type="button"
                              onClick={() => setVerifyMethod("phone")}
                              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                                verifyMethod === "phone"
                                  ? "bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-md shadow-indigo-500/25"
                                  : "text-slate-400 hover:text-slate-300 hover:bg-white/5"
                              }`}
                            >
                              <Phone className="w-4 h-4" />
                              Phone
                            </button>
                          </div>
                        </div>

                        {/* Email or Phone Field (based on selection) */}
                        <AnimatePresence mode="wait">
                          {verifyMethod === "email" ? (
                            <motion.div
                              key="email-field"
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2 }}
                              className="space-y-3"
                            >
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
                            </motion.div>
                          ) : (
                            <motion.div
                              key="phone-field"
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2 }}
                              className="space-y-3"
                            >
                              <FormField
                                control={form.control}
                                name="phoneNumber"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-slate-300 select-none cursor-default text-sm font-medium">
                                      Phone Number
                                    </FormLabel>
                                    <FormControl>
                                      <div className="relative">
                                        <Phone className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
                                        <Input
                                          type="tel"
                                          placeholder="+91 9876543210"
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
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* OTP Verification Section */}
                        {!otpVerified ? (
                          <div className="space-y-3">
                            {otpSent && (
                              <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="space-y-3"
                              >
                                <div className="flex items-center gap-2 text-xs text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-3 py-2">
                                  <Shield className="w-3.5 h-3.5 shrink-0" />
                                  <span>
                                    OTP sent to your {verifyMethod === "email" ? "email" : "phone"}. Check and enter below.
                                  </span>
                                </div>
                                <FormField
                                  control={form.control}
                                  name="otp"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="text-slate-300 select-none cursor-default text-sm font-medium">
                                        Enter OTP
                                      </FormLabel>
                                      <FormControl>
                                        <div className="flex justify-center">
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
                                        </div>
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <Button
                                  type="button"
                                  onClick={handleVerifyOtp}
                                  disabled={isPending}
                                  className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white border-0 rounded-xl text-sm font-medium"
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
                                {verifyMethod === "email" ? "Email" : "Phone"} verified
                              </p>
                              <p className="text-xs text-emerald-400/70">
                                Your {verifyMethod === "email" ? "email address" : "phone number"} has been confirmed
                              </p>
                            </div>
                          </motion.div>
                        )}

                        {otpError && (
                          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{otpError}</p>
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
                                Email or Phone Number
                              </FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Mail className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
                                  <Input
                                    placeholder="you@example.com or +91 9876543210"
                                    {...field}
                                    className="h-12 pl-10 bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 rounded-xl transition-all"
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </>
                    )}

                    {/* Password Field (shared) */}
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
                                placeholder={isRegister ? "Min 6 characters" : "Enter your password"}
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

                    {/* Submit Button */}
                    <Button
                      type="submit"
                      className="w-full h-12 text-base font-semibold bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 border-0 rounded-xl shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all active:scale-[0.98]"
                      disabled={isPending || (isRegister && !otpVerified)}
                    >
                      {isPending ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <span className="flex items-center gap-2">
                          {isRegister ? "Create Account" : "Sign In"}
                          {isRegister ? <Sparkles className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                        </span>
                      )}
                    </Button>

                    {error && (
                      <motion.p
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-sm text-red-400 text-center bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2"
                      >
                        {error.message}
                      </motion.p>
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
              onClick={() => setIsRegister(!isRegister)}
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
              onClick={() => setIsForgotPassword(true)}
              className="text-sm text-slate-500 hover:text-indigo-400 transition-colors block w-full"
            >
              Forgot your password?
            </button>
          )}
          {isForgotPassword && (
            <button
              onClick={() => setIsForgotPassword(false)}
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
