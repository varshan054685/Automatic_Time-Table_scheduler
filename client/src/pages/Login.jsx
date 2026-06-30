import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useLogin, useRegister, useRequestOtp, useVerifyOtp,
  useGoogleLogin, useAuthConfig, useForgotPassword, useResetPassword,
} from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useLocation } from "wouter";
import {
  Mail, Lock, ArrowRight, Sparkles, Eye, EyeOff, User, Loader2,
  CheckCircle2, Shield, CheckCircle, Zap, CalendarDays, GraduationCap,
  Building2, Clock, LayoutGrid,
} from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { motion, AnimatePresence } from "framer-motion";

/* ── Reusable styled input for dark form ── */
const DarkInput = ({ icon: Icon, rightEl, ...props }) => (
  <div className="relative">
    {Icon && <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-teal-400/60 pointer-events-none" />}
    <input
      {...props}
      className={`dark-input w-full h-12 rounded-xl border border-white/10 text-white
        focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500/50
        transition-all duration-200 text-sm font-medium
        ${Icon ? "pl-10" : "pl-4"} ${rightEl ? "pr-10" : "pr-4"}
        ${props.disabled ? "opacity-50 cursor-not-allowed" : ""}
      `}
      style={{
        color: 'white',
        WebkitTextFillColor: 'white',
        background: 'rgba(255,255,255,0.07)',
        WebkitBoxShadow: '0 0 0px 1000px rgba(15,25,40,0.95) inset',
        caretColor: 'white',
      }}
    />
    {rightEl}
  </div>
);

/* ── OTP slot row ── */
const OtpRow = ({ field, disabled }) => (
  <InputOTP maxLength={6} {...field} disabled={disabled}>
    <InputOTPGroup className="gap-2 w-full justify-center">
      {[0,1,2,3,4,5].map(i => (
        <InputOTPSlot key={i} index={i}
          className="w-11 h-13 text-xl font-black bg-white/8 border-2 border-white/15 text-white rounded-xl
            focus:bg-white/14 focus:border-teal-400 focus:ring-2 focus:ring-teal-500/30
            data-[active=true]:border-teal-400 data-[active=true]:scale-110 data-[active=true]:bg-white/14
            transition-all duration-200"
          style={{ color: 'white', WebkitTextFillColor: 'white' }}
        />
      ))}
    </InputOTPGroup>
  </InputOTP>
);

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [otpError, setOtpError] = useState(null);
  const [fpOtpSent, setFpOtpSent] = useState(false);
  const [fpOtpVerified, setFpOtpVerified] = useState(false);
  const [fpCountdown, setFpCountdown] = useState(0);
  const [fpError, setFpError] = useState(null);

  const loginMutation        = useLogin();
  const registerMutation     = useRegister();
  const requestOtpMutation   = useRequestOtp();
  const verifyOtpMutation    = useVerifyOtp();
  const forgotPasswordMutation = useForgotPassword();
  const resetPasswordMutation  = useResetPassword();
  const googleLogin = useGoogleLogin();
  const { config: authConfig, isLoading: isAuthConfigLoading } = useAuthConfig();
  const [, setLocation] = useLocation();

  const form = useForm({
    defaultValues: {
      identifier: "", email: "", password: "", confirmPassword: "", name: "",
      otp: "", resetIdentifier: "", resetOtp: "", newPassword: "", confirmNewPassword: "",
    },
  });

  const email = form.watch("email");

  useEffect(() => {
    form.reset(); setOtpSent(false); setOtpVerified(false);
    setCountdown(0); setOtpError(null);
  }, [isRegister, form]);

  useEffect(() => {
    if (countdown > 0) { const t = setTimeout(() => setCountdown(c => c-1), 1000); return () => clearTimeout(t); }
  }, [countdown]);

  useEffect(() => {
    if (fpCountdown > 0) { const t = setTimeout(() => setFpCountdown(c => c-1), 1000); return () => clearTimeout(t); }
  }, [fpCountdown]);

  useEffect(() => {
    if (!isForgotPassword) { setFpOtpSent(false); setFpOtpVerified(false); setFpCountdown(0); setFpError(null); }
  }, [isForgotPassword]);

  const handleRequestOtp = async () => {
    if (!email) { setOtpError("Please enter an email address first"); return; }
    setOtpError(null);
    try { await requestOtpMutation.mutateAsync({ email, type: "email" }); setOtpSent(true); setCountdown(60); } catch {}
  };

  const handleVerifyOtp = async () => {
    const v = form.getValues("otp");
    if (!v || v.length !== 6) { setOtpError("Please enter a valid 6-digit OTP"); return; }
    try { await verifyOtpMutation.mutateAsync({ email, type: "email", otp: v }); setOtpVerified(true); } catch {}
  };

  const handleForgotPasswordRequest = async () => {
    const id = form.getValues("resetIdentifier");
    if (!id) { setFpError("Please enter your email address"); return; }
    setFpError(null);
    try { await forgotPasswordMutation.mutateAsync({ identifier: id }); setFpOtpSent(true); setFpCountdown(60); } catch {}
  };

  const handleForgotPasswordVerify = async () => {
    const id = form.getValues("resetIdentifier");
    const v  = form.getValues("resetOtp");
    if (!v || v.length !== 6) { setFpError("Please enter a valid 6-digit code"); return; }
    setFpError(null);
    try { await verifyOtpMutation.mutateAsync({ email: id, type: "email", otp: v }); setFpOtpVerified(true); } catch {}
  };

  function onSubmit(values) {
    if (isForgotPassword && fpOtpVerified) {
      if (values.newPassword !== values.confirmNewPassword) { form.setError("confirmNewPassword", { message: "Passwords do not match" }); return; }
      resetPasswordMutation.mutate({ identifier: values.resetIdentifier, otp: values.resetOtp, newPassword: values.newPassword }, {
        onSuccess: () => loginMutation.mutate({ identifier: values.resetIdentifier, password: values.newPassword }, { onSuccess: () => setLocation("/") }),
      });
    } else if (isRegister) {
      if (values.password !== values.confirmPassword) { form.setError("confirmPassword", { message: "Passwords do not match" }); return; }
      const data = { name: values.name, email: values.email, password: values.password };
      if (otpVerified) data.emailOtp = values.otp;
      registerMutation.mutate(data, { onSuccess: () => setLocation("/") });
    } else {
      loginMutation.mutate({ identifier: values.identifier, password: values.password }, { onSuccess: () => setLocation("/") });
    }
  }

  const isPending = loginMutation.isPending || registerMutation.isPending ||
    requestOtpMutation.isPending || verifyOtpMutation.isPending ||
    forgotPasswordMutation.isPending || resetPasswordMutation.isPending;
  const error = loginMutation.error || registerMutation.error ||
    requestOtpMutation.error || verifyOtpMutation.error;
  const showGoogleButton = !isRegister && !isForgotPassword && authConfig?.googleOAuthEnabled !== false;

  /* ── Page title helper ── */
  const pageTitle = isForgotPassword ? "Reset Password" : isRegister ? "Create Account" : "Welcome Back";
  const pageSubtitle = isForgotPassword
    ? "Enter your email to get a reset code"
    : isRegister ? "Join the AI Timetable Scheduler"
    : "Sign in to manage your schedules";

  /* ── Shared input class for dark theme ── */
  const inputCls = "h-12 rounded-xl border border-white/10 bg-white/6 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500/50 transition-all text-sm font-medium";

  return (
    <div className="min-h-screen relative overflow-hidden flex" style={{ background: "linear-gradient(135deg, #050d14 0%, #0a1929 50%, #050d14 100%)" }}>

      {/* ── Animated background ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Grid lines */}
        <div className="absolute inset-0 opacity-[0.07]" style={{
          backgroundImage: "linear-gradient(rgba(15,160,135,1) 1px, transparent 1px), linear-gradient(90deg, rgba(15,160,135,1) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 50%, black 30%, transparent 80%)",
        }} />
        {/* Teal glow top-left */}
        <motion.div animate={{ scale: [1, 1.15, 1], opacity: [0.18, 0.28, 0.18] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(15,160,135,0.35) 0%, transparent 70%)" }} />
        {/* Amber glow bottom-right */}
        <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.12, 0.2, 0.12] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(251,191,36,0.25) 0%, transparent 70%)" }} />
        {/* Cyan glow center */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] opacity-10 rounded-full"
          style={{ background: "radial-gradient(ellipse, rgba(8,145,178,0.4) 0%, transparent 70%)" }} />
      </div>

      {/* ── Main layout ── */}
      <div className="relative z-10 w-full flex">

        {/* ════ LEFT PANEL — branding ════ */}
        <div className="hidden lg:flex w-1/2 flex-col justify-between p-12 xl:p-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-teal-900/40"
              style={{ background: "linear-gradient(135deg,#0f9f87,#0891b2)" }}>
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="font-display font-black text-white text-lg">Timetable AI</span>
          </div>

          {/* Hero text */}
          <div className="space-y-8">
            <div>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest mb-5"
                  style={{ background: "rgba(15,160,135,0.15)", border: "1px solid rgba(15,160,135,0.3)", color: "#5eead4" }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                  AI-Powered Scheduling
                </span>
                <h1 className="text-4xl xl:text-5xl font-display font-black text-white leading-[1.1] tracking-tight">
                  Schedule smarter,<br />
                  <span style={{ background: "linear-gradient(135deg,#5eead4,#38bdf8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                    not harder.
                  </span>
                </h1>
                <p className="text-slate-400 mt-4 text-base leading-relaxed max-w-sm">
                  Automatically generate conflict-free academic timetables for your entire institution in seconds.
                </p>
              </motion.div>
            </div>

            {/* Feature cards */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="grid grid-cols-2 gap-3">
              {[
                { icon: GraduationCap, label: "Faculty Load",  desc: "Smart workload balancing",  color: "#5eead4" },
                { icon: Building2,     label: "Room Booking",  desc: "Zero scheduling conflicts",  color: "#38bdf8" },
                { icon: LayoutGrid,    label: "Multi-Section", desc: "Parallel class support",     color: "#a78bfa" },
                { icon: Clock,         label: "Time Slots",    desc: "Flexible period setup",      color: "#fb923c" },
              ].map(({ icon: Icon, label, desc, color }) => (
                <div key={label} className="p-4 rounded-2xl group hover:scale-[1.02] transition-transform cursor-default"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2.5"
                    style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
                    <Icon className="w-4 h-4" style={{ color }} />
                  </div>
                  <p className="text-white text-[13px] font-bold">{label}</p>
                  <p className="text-slate-500 text-[11px] mt-0.5">{desc}</p>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Footer */}
          <p className="text-slate-600 text-xs font-medium">
            © {new Date().getFullYear()} Timetable AI · Built for modern institutions
          </p>
        </div>

        {/* ════ RIGHT PANEL — auth form ════ */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12">
          <motion.div className="w-full max-w-[420px]"
            initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: "easeOut" }}>

            {/* Mobile logo */}
            <div className="lg:hidden flex items-center gap-2.5 mb-8">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: "linear-gradient(135deg,#0f9f87,#0891b2)" }}>
                <Zap className="w-4 h-4 text-white" />
              </div>
              <span className="font-display font-black text-white text-base">Timetable AI</span>
            </div>

            {/* Card */}
            <div className="rounded-2xl p-7 relative overflow-hidden"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", backdropFilter: "blur(20px)", boxShadow: "0 40px 80px -20px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)" }}>

              {/* Subtle inner glow */}
              <div className="absolute top-0 left-0 right-0 h-px"
                style={{ background: "linear-gradient(90deg, transparent, rgba(15,160,135,0.5), transparent)" }} />

              {/* Form header */}
              <AnimatePresence mode="wait">
                <motion.div key={pageTitle} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="mb-6">
                  <h2 className="text-[22px] font-display font-black text-white tracking-tight">{pageTitle}</h2>
                  <p className="text-slate-400 text-sm mt-1">{pageSubtitle}</p>
                </motion.div>
              </AnimatePresence>

              {/* Google button */}
              {showGoogleButton && (
                <div className="mb-5">
                  <button type="button" onClick={googleLogin} disabled={isAuthConfigLoading}
                    className="w-full h-11 flex items-center justify-center gap-2.5 rounded-xl font-semibold text-sm transition-all hover:scale-[1.01] active:scale-[0.99]"
                    style={{ background: "rgba(255,255,255,0.92)", color: "#1e293b" }}>
                    <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" style={{ width: 18, height: 18 }}>
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Continue with Google
                  </button>
                  <div className="relative my-5">
                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-white/8" /></div>
                    <div className="relative flex justify-center">
                      <span className="px-3 text-[11px] font-bold text-slate-500 uppercase tracking-widest"
                        style={{ background: "rgba(5,13,20,0.6)" }}>or continue with email</span>
                    </div>
                  </div>
                </div>
              )}

              {/* ── FORM ── */}
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3.5">
                  <AnimatePresence mode="wait">
                    <motion.div key={isRegister ? "reg" : isForgotPassword ? "fp" : "login"}
                      initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.22 }} className="space-y-3.5">

                      {/* ── FORGOT PASSWORD FLOW ── */}
                      {isForgotPassword && !fpOtpVerified && (
                        <>
                          <FormField control={form.control} name="resetIdentifier" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-bold text-slate-400 uppercase tracking-wider">Email Address</FormLabel>
                              <FormControl>
                                <DarkInput icon={Mail} type="email" placeholder="you@example.com" {...field} />
                              </FormControl>
                              <FormMessage className="text-rose-400 text-xs" />
                            </FormItem>
                          )} />

                          {fpOtpSent && (
                            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                  <Shield className="w-3.5 h-3.5 text-teal-400" /> Reset Code
                                </span>
                                <span className="text-[11px] text-slate-500">6 digits</span>
                              </div>
                              <FormField control={form.control} name="resetOtp" render={({ field }) => (
                                <FormItem>
                                  <FormControl><OtpRow field={field} disabled={fpOtpVerified} /></FormControl>
                                  <FormMessage className="text-rose-400 text-xs text-center mt-1" />
                                </FormItem>
                              )} />
                              {!fpOtpVerified && (
                                <button type="button" onClick={handleForgotPasswordVerify} disabled={isPending || form.getValues("resetOtp")?.length !== 6}
                                  className="w-full h-10 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-40"
                                  style={{ background: "rgba(15,160,135,0.15)", border: "1px solid rgba(15,160,135,0.3)" }}>
                                  {verifyOtpMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4 text-teal-400" /> Verify Code</>}
                                </button>
                              )}
                              {fpCountdown > 0 && <p className="text-[11px] text-slate-500 text-center">Resend in <span className="text-teal-400 font-bold">{fpCountdown}s</span></p>}
                            </motion.div>
                          )}

                          {fpError && (
                            <div className="p-3 rounded-xl text-xs text-rose-300 flex items-center gap-2"
                              style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                              <Shield className="w-3.5 h-3.5 text-rose-400 shrink-0" />{fpError}
                            </div>
                          )}

                          <button type="button" onClick={handleForgotPasswordRequest} disabled={fpCountdown > 0 || isPending}
                            className="w-full h-11 rounded-xl text-sm font-bold text-white transition-all hover:scale-[1.01] disabled:opacity-50 flex items-center justify-center gap-2"
                            style={{ background: "linear-gradient(135deg,#0f9f87,#0891b2)", boxShadow: "0 8px 24px -6px rgba(15,160,135,0.35)" }}>
                            {forgotPasswordMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : fpCountdown > 0 ? `Resend in ${fpCountdown}s` : "Send Reset Code"}
                          </button>

                          {fpOtpSent && !fpOtpVerified && <p className="text-[11px] text-amber-400/70 text-center">Check your spam folder if you don't see the email</p>}
                        </>
                      )}

                      {/* ── FORGOT PASSWORD — new password after OTP verified ── */}
                      {isForgotPassword && fpOtpVerified && (
                        <>
                          <div className="p-3 rounded-xl text-xs text-teal-300 flex items-center gap-2"
                            style={{ background: "rgba(15,160,135,0.1)", border: "1px solid rgba(15,160,135,0.25)" }}>
                            <CheckCircle className="w-4 h-4 text-teal-400 shrink-0" /> Code verified! Set your new password.
                          </div>
                          <FormField control={form.control} name="newPassword" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-bold text-slate-400 uppercase tracking-wider">New Password</FormLabel>
                              <FormControl>
                                <DarkInput icon={Lock} type={showPassword ? "text" : "password"} placeholder="Min 6 characters" {...field}
                                  rightEl={<button type="button" onClick={() => setShowPassword(p => !p)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-teal-400 transition-colors">{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>} />
                              </FormControl>
                              <FormMessage className="text-rose-400 text-xs" />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="confirmNewPassword" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-bold text-slate-400 uppercase tracking-wider">Confirm Password</FormLabel>
                              <FormControl>
                                <DarkInput icon={Lock} type={showPassword ? "text" : "password"} placeholder="Re-enter password" {...field}
                                  rightEl={<button type="button" onClick={() => setShowPassword(p => !p)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-teal-400 transition-colors">{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>} />
                              </FormControl>
                              <FormMessage className="text-rose-400 text-xs" />
                            </FormItem>
                          )} />
                        </>
                      )}

                      {/* ── REGISTER FLOW ── */}
                      {isRegister && (
                        <>
                          <FormField control={form.control} name="name" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-bold text-slate-400 uppercase tracking-wider">Full Name</FormLabel>
                              <FormControl><DarkInput icon={User} placeholder="John Doe" {...field} /></FormControl>
                              <FormMessage className="text-rose-400 text-xs" />
                            </FormItem>
                          )} />

                          <FormField control={form.control} name="email" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-bold text-slate-400 uppercase tracking-wider">Email Address</FormLabel>
                              <FormControl>
                                <DarkInput icon={Mail} type="email" placeholder="you@example.com" disabled={otpVerified}
                                  rightEl={otpVerified && <CheckCircle2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-teal-400" />} {...field} />
                              </FormControl>
                              <FormMessage className="text-rose-400 text-xs" />
                            </FormItem>
                          )} />

                          {/* OTP section */}
                          {!otpVerified ? (
                            <div className="space-y-3">
                              {otpSent && (
                                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                                  <div className="p-3 rounded-xl flex items-center gap-3"
                                    style={{ background: "rgba(15,160,135,0.08)", border: "1px solid rgba(15,160,135,0.2)" }}>
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                                      style={{ background: "rgba(15,160,135,0.15)" }}>
                                      <Mail className="w-4 h-4 text-teal-400" />
                                    </div>
                                    <div>
                                      <p className="text-sm font-bold text-white">OTP Sent!</p>
                                      <p className="text-[11px] text-teal-400/70">Check your email inbox</p>
                                    </div>
                                  </div>
                                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                    <Shield className="w-3.5 h-3.5 text-teal-400" /> Verification Code
                                  </span>
                                  <FormField control={form.control} name="otp" render={({ field }) => (
                                    <FormItem>
                                      <FormControl><OtpRow field={field} /></FormControl>
                                      <FormMessage className="text-rose-400 text-xs text-center mt-1" />
                                    </FormItem>
                                  )} />
                                  <button type="button" onClick={handleVerifyOtp} disabled={isPending || form.getValues("otp")?.length !== 6}
                                    className="w-full h-11 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-40"
                                    style={{ background: "linear-gradient(135deg,#059669,#0d9488)", boxShadow: "0 6px 20px -4px rgba(5,150,105,0.35)" }}>
                                    {verifyOtpMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Shield className="w-4 h-4" /> Verify OTP</>}
                                  </button>
                                  {countdown > 0
                                    ? <p className="text-[11px] text-slate-500 text-center">Resend in <span className="text-teal-400 font-bold">{countdown}s</span></p>
                                    : <button type="button" onClick={handleRequestOtp} disabled={isPending} className="w-full text-[11px] text-teal-500 hover:text-teal-400 transition-colors">Resend OTP</button>}
                                  <p className="text-[11px] text-amber-400/60 text-center">Check spam if you don't see the email</p>
                                </motion.div>
                              )}
                              {!otpSent && (
                                <button type="button" onClick={handleRequestOtp} disabled={isPending}
                                  className="w-full h-10 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
                                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#cbd5e1" }}>
                                  {requestOtpMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Mail className="w-4 h-4" /> Send Verification OTP</>}
                                </button>
                              )}
                              {otpError && <p className="text-[11px] text-rose-400 text-center">{otpError}</p>}
                            </div>
                          ) : (
                            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
                              className="flex items-center gap-2.5 p-3 rounded-xl"
                              style={{ background: "rgba(15,160,135,0.1)", border: "1px solid rgba(15,160,135,0.25)" }}>
                              <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                              <div><p className="text-sm font-bold text-teal-300">Email verified</p><p className="text-[11px] text-teal-400/60">Your address has been confirmed</p></div>
                            </motion.div>
                          )}

                          {/* Password fields — shown after OTP verified */}
                          {otpVerified && (
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3.5">
                              <FormField control={form.control} name="password" render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs font-bold text-slate-400 uppercase tracking-wider">Password</FormLabel>
                                  <FormControl>
                                    <DarkInput icon={Lock} type={showPassword ? "text" : "password"} placeholder="Min 6 characters" {...field}
                                      rightEl={<button type="button" onClick={() => setShowPassword(p => !p)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-teal-400 transition-colors">{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>} />
                                  </FormControl>
                                  <FormMessage className="text-rose-400 text-xs" />
                                </FormItem>
                              )} />
                              <FormField control={form.control} name="confirmPassword" render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs font-bold text-slate-400 uppercase tracking-wider">Confirm Password</FormLabel>
                                  <FormControl>
                                    <DarkInput icon={Lock} type={showPassword ? "text" : "password"} placeholder="Re-enter password" {...field}
                                      rightEl={<button type="button" onClick={() => setShowPassword(p => !p)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-teal-400 transition-colors">{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>} />
                                  </FormControl>
                                  <FormMessage className="text-rose-400 text-xs" />
                                </FormItem>
                              )} />
                            </motion.div>
                          )}
                        </>
                      )}

                      {/* ── LOGIN FLOW ── */}
                      {!isRegister && !isForgotPassword && (
                        <>
                          <FormField control={form.control} name="identifier" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-bold text-slate-400 uppercase tracking-wider">Email Address</FormLabel>
                              <FormControl>
                                <DarkInput icon={Mail} type="email" placeholder="you@example.com" {...field} />
                              </FormControl>
                              <FormMessage className="text-rose-400 text-xs" />
                            </FormItem>
                          )} />

                          <FormField control={form.control} name="password" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-bold text-slate-400 uppercase tracking-wider">Password</FormLabel>
                              <FormControl>
                                <DarkInput icon={Lock} type={showPassword ? "text" : "password"} placeholder="Enter your password" {...field}
                                  rightEl={<button type="button" onClick={() => setShowPassword(p => !p)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-teal-400 transition-colors">{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>} />
                              </FormControl>
                              <FormMessage className="text-rose-400 text-xs" />
                            </FormItem>
                          )} />
                        </>
                      )}

                    </motion.div>
                  </AnimatePresence>

                  {/* Submit */}
                  {(!isForgotPassword || fpOtpVerified) && (
                    <button type="submit" disabled={isPending || (isRegister && !otpVerified) || (isForgotPassword && !fpOtpVerified)}
                      className="w-full h-12 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 mt-1"
                      style={{ background: "linear-gradient(135deg,#0f9f87,#0891b2)", boxShadow: "0 8px 24px -6px rgba(15,160,135,0.35)" }}>
                      {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                        <>
                          {isRegister ? "Create Account" : isForgotPassword ? "Reset Password" : "Sign In"}
                          {isRegister ? <Sparkles className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                        </>
                      )}
                    </button>
                  )}

                  {error && (
                    <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                      className={`text-xs text-rose-300 rounded-xl px-3 py-2.5 mt-1 ${error.field ? "flex flex-col gap-0.5" : "text-center"}`}
                      style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                      <p className="font-bold">{error.field === "identifier" ? "Account not found" : error.field === "password" ? "Incorrect password" : "Error"}</p>
                      <p className={error.field ? "opacity-90" : ""}>{error.message}</p>
                    </motion.div>
                  )}
                </form>
              </Form>

              {/* Toggle links */}
              <div className="mt-6 space-y-2 text-center">
                {!isForgotPassword && (
                  <button type="button" onClick={() => { setIsRegister(r => !r); loginMutation.reset(); }}
                    className="text-sm text-slate-400 hover:text-slate-300 transition-colors block w-full">
                    {isRegister ? (
                      <>Already have an account? <span className="font-bold text-teal-400 hover:text-teal-300 underline underline-offset-2">Sign In</span></>
                    ) : (
                      <>New user? <span className="font-bold text-teal-400 hover:text-teal-300 underline underline-offset-2">Create Account</span></>
                    )}
                  </button>
                )}
                {!isRegister && !isForgotPassword && (
                  <button type="button" onClick={() => { setIsForgotPassword(true); loginMutation.reset(); }}
                    className="text-sm text-slate-500 hover:text-teal-400 transition-colors block w-full">
                    Forgot your password?
                  </button>
                )}
                {isForgotPassword && (
                  <button type="button" onClick={() => { setIsForgotPassword(false); loginMutation.reset(); }}
                    className="text-sm text-slate-400 hover:text-slate-300 transition-colors block w-full">
                    Remember your password? <span className="font-bold text-teal-400 hover:text-teal-300 underline underline-offset-2">Sign In</span>
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
