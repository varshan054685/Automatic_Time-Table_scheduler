import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { type Express } from "express";
import session from "express-session";
import createMemoryStore from "memorystore";
import { storage } from "./storage";
import { z } from "zod";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { log } from "./index";
import { authLimiter } from "./rate-limit";
import nodemailer from "nodemailer";
import sgMail from "@sendgrid/mail";

// Bcrypt cost factor
const BCRYPT_ROUNDS = 10;

// Session max age — 24 hours
const SESSION_MAX_AGE = 24 * 60 * 60 * 1000;

// OTP expiry time — 5 minutes
const OTP_EXPIRY_MINUTES = 5;

export function setupAuth(app: Express) {
  // ─── Security: Require SESSION_SECRET — never use a hardcoded fallback ───
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret || sessionSecret.length < 32) {
    throw new Error(
      "SESSION_SECRET must be set and at least 32 characters. " +
      "Generate one with: node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\""
    );
  }

  const MemoryStore = createMemoryStore(session);
  const isProduction = app.get("env") === "production";

  const sessionSettings: session.SessionOptions = {
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: SESSION_MAX_AGE,
      httpOnly: true,           // Prevent client-side JS from reading the cookie
      sameSite: isProduction ? "none" : "lax", // "none" required for cross-site cookies in production
      secure: isProduction,     // HTTPS only in production
    },
    store: new MemoryStore({
      checkPeriod: SESSION_MAX_AGE,
    }),
  };

  if (isProduction) {
    app.set("trust proxy", 1);
  }

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // ─── Local Strategy (Email or Phone + Password) ───
  passport.use(
    "local",
    new LocalStrategy(
      { usernameField: "identifier", passReqToCallback: true },
      async (req, identifier, password, done) => {
        try {
          let user;
          const isEmail = identifier.includes("@");
          // Check if identifier is email or phone number
          if (isEmail) {
            const normalizedEmail = identifier.trim().toLowerCase();
            user = await storage.getUserByEmail(normalizedEmail);
          } else {
            // Assume it's a phone number
            user = await storage.getUserByPhoneNumber(identifier.trim());
          }
          
          if (!user) {
            // User not found - return specific error info
            const errorInfo = { 
              message: isEmail 
                ? "We couldn't find an account with this email address. Please check your email or sign up."
                : "We couldn't find an account with this phone number. Please check your number or sign up.",
              field: "identifier"
            };
            return done(null, false, errorInfo);
          }
          
          const valid = await bcrypt.compare(password, user.password);
          if (!valid) {
            // Password incorrect - return specific error info
            const errorInfo = { 
              message: "The password you entered is incorrect. Please try again or use 'Forgot Password' to reset it.",
              field: "password"
            };
            return done(null, false, errorInfo);
          }
          
          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    )
  );

  // ─── Google OAuth Strategy ───
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  // In development, use frontend port (5173) so cookie is set on correct origin
  // Vite proxy will forward /api requests to backend (5000)
  const callbackURL = process.env.GOOGLE_CALLBACK_URL || (process.env.NODE_ENV === "production" 
    ? "https://automatic-time-table-scheduler-node.onrender.com/api/auth/google/callback"
    : "http://localhost:5173/api/auth/google/callback");

  if (googleClientId && googleClientSecret) {
    passport.use(
      "google",
      new GoogleStrategy(
        {
          clientID: googleClientId,
          clientSecret: googleClientSecret,
          callbackURL: callbackURL,
        },
        async (accessToken: string, refreshToken: string, profile: any, done: any) => {
          try {
            const email = profile.emails?.[0]?.value;
            const googleId = profile.id;
            
            if (!email) {
              return done(null, false);
            }
            
            // Check if user exists by Google ID
            let user = await storage.getUserByGoogleId(googleId);
            
            if (!user) {
              // Check if user exists by email
              const existingUser = await storage.getUserByEmail(email);
              
              if (existingUser) {
                // Link Google account to existing user
                user = await storage.updateUser(existingUser.id, { googleId });
              } else {
                // Create new user with Google
                user = await storage.createUser({
                  email: email.toLowerCase(),
                  name: profile.displayName || "User",
                  googleId: googleId,
                  password: await bcrypt.hash(crypto.randomBytes(32).toString("hex"), BCRYPT_ROUNDS),
                  role: "admin",
                  isVerified: true,
                });
              }
            }
            
            return done(null, user);
          } catch (err) {
            return done(err);
          }
        }
      )
    );
  }

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) {
        return done(null, false);
      }
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  // ─── OTP Helper Functions ───
  function generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
  }

  // Common email domains for validation
  const VALID_EMAIL_DOMAINS = new Set([
    "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com",
    "protonmail.com", "aol.com", "mail.com", "yandex.com", "zoho.com",
    "live.com", "msn.com", "qq.com", "163.com", "126.com",
    "foxmail.com", "yeah.net", "gmx.com", "mail.ru", "bk.ru",
    "inbox.ru", "list.ru", "rediffmail.com", "hotmail.co.uk",
    "yahoo.co.uk", "yahoo.co.in", "outlook.co.uk", "live.co.uk"
  ]);

  // Common typos in email domains
  const DOMAIN_TYPOS: Record<string, string> = {
    "gmial.com": "gmail.com",
    "gmal.com": "gmail.com",
    "gmail.co": "gmail.com",
    "gamil.com": "gmail.com",
    "gnail.com": "gmail.com",
    "gmaill.com": "gmail.com",
    "yahooo.com": "yahoo.com",
    "yaho.com": "yahoo.com",
    "yahoo.co": "yahoo.com",
    "yahoomail.com": "yahoo.com",
    "hotmial.com": "hotmail.com",
    "hotmal.com": "hotmail.com",
    "hotmail.co": "hotmail.com",
    "outlok.com": "outlook.com",
    "outlook.co": "outlook.com",
    "icloud.co": "icloud.com",
    "icould.com": "icloud.com",
  };

  async function validateEmailDomain(email: string): Promise<{ valid: boolean; error?: string; suggestion?: string }> {
    const parts = email.toLowerCase().split("@");
    if (parts.length !== 2) {
      return { valid: false, error: "Invalid email format" };
    }

    const domain = parts[1];

    // Check for common typos
    if (DOMAIN_TYPOS[domain]) {
      return {
        valid: false,
        error: `Did you mean ${parts[0]}@${DOMAIN_TYPOS[domain]}?`,
        suggestion: `${parts[0]}@${DOMAIN_TYPOS[domain]}`
      };
    }

    // Check if domain is in valid list (basic check)
    if (!VALID_EMAIL_DOMAINS.has(domain)) {
      // For custom domains, we'll accept them but log a warning
      // In production, you might want to do DNS MX record validation here
      console.log(`[WARN] Uncommon email domain: ${domain}`);
    }

    return { valid: true };
  }

  // Email transporter (configured if SMTP settings are provided)
  const emailTransporter = (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || "587"),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      })
    : null;

  async function sendEmailOtp(email: string, otp: string): Promise<void> {
    // Validate email domain first
    const validation = await validateEmailDomain(email);
    if (!validation.valid) {
      throw new Error(validation.error || "Invalid email domain");
    }

    // Log what we're sending (MUST be backend URL, not frontend)
    log(`GOOGLE_OAUTH_CALLBACK URL=${callbackURL}`, "security");
    console.log(`[GOOGLE_OAUTH] Using callback URL: ${callbackURL}`);
    if (callbackURL.includes("5173") || callbackURL.includes("5174")) {
      console.error(`[GOOGLE_OAUTH ERROR] callbackURL contains frontend port! This will fail. URL: ${callbackURL}`);
    }
    console.log(`[DEBUG] Email OTP for ${email}: ${otp} (expires in ${OTP_EXPIRY_MINUTES} minutes)`);

    // Send via SendGrid if API key is configured
    if (process.env.SENDGRID_API_KEY && process.env.SENDGRID_API_KEY.startsWith("SG.")) {
      try {
        const fromEmail = process.env.SENDGRID_FROM || "varshanrio05@gmail.com";
        console.log(`[SENDGRID_DEBUG] Attempting to send OTP to ${email} from ${fromEmail}`);
        console.log(`[SENDGRID_DEBUG] API Key configured: ${process.env.SENDGRID_API_KEY?.substring(0, 10)}...`);

        sgMail.setApiKey(process.env.SENDGRID_API_KEY);
        const [response] = await sgMail.send({
          from: `Time Table Scheduler <${fromEmail}>`,
          to: email,
          subject: "Your Verification Code",
          text: `Your OTP for Time Table Scheduler registration is: ${otp}\n\nThis code will expire in ${OTP_EXPIRY_MINUTES} minutes.\n\nIf you didn't request this code, please ignore this email.`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #333;">Time Table Scheduler - Verification Code</h2>
              <p>Your OTP for registration is:</p>
              <div style="background: #f5f5f5; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; border-radius: 8px; margin: 20px 0;">
                ${otp}
              </div>
              <p>This code will expire in <strong>${OTP_EXPIRY_MINUTES} minutes</strong>.</p>
              <p style="color: #666; font-size: 12px;">If you didn't request this code, please ignore this email.</p>
            </div>
          `,
        });
        console.log(`[SENDGRID_SUCCESS] OTP sent to ${email}. Status: ${response?.statusCode}`);
        return; // Exit after successful SendGrid send
      } catch (err: any) {
        console.error(`[SENDGRID_FAILED] Failed to send OTP to ${email}:`, err.message);
        if (err.response) {
          console.error(`[SENDGRID_ERROR] Response body:`, JSON.stringify(err.response.body, null, 2));
          // Check for specific SendGrid errors
          const errors = err.response.body?.errors;
          if (errors && errors.length > 0) {
            for (const error of errors) {
              console.error(`[SENDGRID_ERROR_DETAIL] ${error.field}: ${error.message}`);
            }
          }
        }
        // In production, log OTP to console as fallback for testing
        if (process.env.NODE_ENV === "production") {
          console.log(`[OTP_FALLBACK] Email: ${email}, OTP: ${otp}`);
          console.log(`[OTP_FALLBACK] The above OTP would have been sent to ${email}`);
          console.log(`[OTP_FALLBACK] To fix SendGrid: 1) Verify sender email in SendGrid, 2) Authenticate your domain, or 3) Check API key permissions`);
        }
        // Throw error so user knows email failed
        throw new Error(`Failed to send email: ${err.message}. Please check your SendGrid configuration.`);
      }
    } else {
      console.log(`[SENDGRID_DEBUG] SendGrid not configured. API Key present: ${!!process.env.SENDGRID_API_KEY}`);
    }

    // Send actual email if SMTP is configured (fallback)
    if (emailTransporter) {
      try {
        await emailTransporter.sendMail({
          from: process.env.SMTP_FROM || `"Time Table Scheduler" <${process.env.SMTP_USER}>`,
          to: email,
          subject: "Your Verification Code",
          text: `Your OTP for Time Table Scheduler registration is: ${otp}\n\nThis code will expire in ${OTP_EXPIRY_MINUTES} minutes.\n\nIf you didn't request this code, please ignore this email.`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #333;">Time Table Scheduler - Verification Code</h2>
              <p>Your OTP for registration is:</p>
              <div style="background: #f5f5f5; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; border-radius: 8px; margin: 20px 0;">
                ${otp}
              </div>
              <p>This code will expire in <strong>${OTP_EXPIRY_MINUTES} minutes</strong>.</p>
              <p style="color: #666; font-size: 12px;">If you didn't request this code, please ignore this email.</p>
            </div>
          `,
        });
        console.log(`[EMAIL_SENT] OTP sent to ${email}`);
      } catch (err: any) {
        console.error(`[EMAIL_FAILED] Failed to send OTP to ${email}:`, err.message);
        // Don't throw - user can still see OTP in terminal for development
      }
    }
  }

  async function sendPhoneOtp(phoneNumber: string, otp: string): Promise<void> {
    // In production, integrate with SMS service (Twilio, etc.)
    // For now, just log the OTP
    log(`OTP_SMS to=${phoneNumber} otp=${otp}`, "security");
    console.log(`[DEBUG] SMS OTP for ${phoneNumber}: ${otp}`);
  }

  // ─── Profile Update ───
  const profileSchema = z.object({
    name: z.string().min(1).max(100).trim().optional(),
    email: z.string().email().max(255).trim().toLowerCase().optional(),
    phoneNumber: z.string().max(20).trim().optional(),
    avatar: z.string().optional(),
  }).strict();

  app.patch("/api/auth/profile", async (req, res, next) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const parsed = profileSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input: " + parsed.error.issues.map(i => i.message).join(", ") });
      }

      // If changing email, check uniqueness
      if (parsed.data.email) {
        const existing = await storage.getUserByEmail(parsed.data.email);
        if (existing && existing.id !== (req.user as any).id) {
          return res.status(400).json({ message: "Email already in use" });
        }
      }

      const user = await storage.updateUser((req.user as any).id, parsed.data);
      const { password: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (err: any) {
      next(err);
    }
  });

  // ─── OTP Request (for registration) ───
  const requestOtpSchema = z.object({
    email: z.string().email().optional(),
    phoneNumber: z.string().min(10).max(15).optional(),
    type: z.enum(["email", "phone"]),
  }).refine((data) => {
    if (data.type === "email") return !!data.email;
    if (data.type === "phone") return !!data.phoneNumber;
    return false;
  }, { message: "Email or phone number is required based on type" });

  app.post("/api/auth/request-otp", authLimiter, async (req, res) => {
    try {
      const parsed = requestOtpSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input: " + parsed.error.issues.map(i => i.message).join(", ") });
      }

      const { email, phoneNumber, type } = parsed.data;
      const otp = generateOtp();
      const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

      await storage.createOtpVerification({
        email: email?.toLowerCase(),
        phoneNumber: phoneNumber?.trim(),
        otp,
        type,
        expiresAt,
      });

      // Send OTP via appropriate channel
      if (type === "email" && email) {
        await sendEmailOtp(email, otp);
      } else if (type === "phone" && phoneNumber) {
        await sendPhoneOtp(phoneNumber, otp);
      }

      res.json({ message: "OTP sent successfully", expiresIn: OTP_EXPIRY_MINUTES * 60 });
    } catch (err: any) {
      console.error("OTP request error:", err.message);
      // Show specific error message to user (e.g., email domain validation)
      res.status(400).json({ message: err.message || "Failed to send OTP" });
    }
  });

  // ─── OTP Verification ───
  const verifyOtpSchema = z.object({
    email: z.string().email().optional(),
    phoneNumber: z.string().min(10).max(15).optional(),
    type: z.enum(["email", "phone"]),
    otp: z.string().length(6),
  }).refine((data) => {
    if (data.type === "email") return !!data.email;
    if (data.type === "phone") return !!data.phoneNumber;
    return false;
  }, { message: "Email or phone number is required based on type" });

  app.post("/api/auth/verify-otp", authLimiter, async (req, res) => {
    try {
      const parsed = verifyOtpSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input: " + parsed.error.issues.map(i => i.message).join(", ") });
      }

      const { email, phoneNumber, type, otp } = parsed.data;

      // Get latest OTP for the identifier
      let storedOtp;
      if (type === "email" && email) {
        storedOtp = await storage.getLatestOtpForEmail(email.toLowerCase());
      } else if (type === "phone" && phoneNumber) {
        storedOtp = await storage.getLatestOtpForPhone(phoneNumber.trim());
      }

      if (!storedOtp) {
        return res.status(400).json({ message: "No OTP found. Please request a new one." });
      }

      // Check if OTP has expired
      const now = new Date();
      const expiryTime = new Date(storedOtp.expiresAt);
      if (now > expiryTime) {
        const expiredMinutes = Math.floor((now.getTime() - expiryTime.getTime()) / 60000);
        return res.status(400).json({
          message: `OTP has expired (expired ${expiredMinutes} minute(s) ago). Please request a new one.`,
          expired: true,
          expiredAt: storedOtp.expiresAt
        });
      }

      // Calculate remaining time for debugging
      const remainingMs = expiryTime.getTime() - now.getTime();
      const remainingMinutes = Math.floor(remainingMs / 60000);
      const remainingSeconds = Math.floor((remainingMs % 60000) / 1000);
      console.log(`[DEBUG] OTP verification: ${remainingMinutes}m ${remainingSeconds}s remaining`);

      // Verify OTP
      if (storedOtp.otp !== otp) {
        return res.status(400).json({ message: "Invalid OTP. Please check and try again." });
      }

      // Don't delete OTP here - registration will verify it again and then delete it
      // This allows the user to complete registration after verification

      res.json({
        verified: true,
        message: "OTP verified successfully",
        expiresIn: remainingMinutes * 60 + remainingSeconds
      });
    } catch (err: any) {
      console.error("OTP verification error:", err.message);
      res.status(500).json({ message: "OTP verification failed" });
    }
  });

  // ─── Registration (rate limited) ───
  const registerSchema = z.object({
    email: z.string().email().max(255).trim().toLowerCase().optional(),
    phoneNumber: z.string().min(10).max(15).trim().optional(),
    password: z.string().min(6).max(128),
    name: z.string().min(1).max(100).trim().optional(),
    emailOtp: z.string().length(6).optional(),
    phoneOtp: z.string().length(6).optional(),
  }).refine((data) => data.email || data.phoneNumber, {
    message: "Either email or phone number is required",
  });

  app.post("/api/auth/register", authLimiter, async (req, res, next) => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input: " + parsed.error.issues.map(i => i.message).join(", ") });
      }

      const { email, phoneNumber, password, name, emailOtp, phoneOtp } = parsed.data;

      // Check for duplicates
      if (email) {
        const existingEmail = await storage.getUserByEmail(email);
        if (existingEmail) {
          log(`REGISTER_FAILED email=${email} reason=duplicate IP=${req.ip}`, "security");
          return res.status(400).json({ message: "Email already registered" });
        }
      }

      if (phoneNumber) {
        const existingPhone = await storage.getUserByPhoneNumber(phoneNumber);
        if (existingPhone) {
          log(`REGISTER_FAILED phone=${phoneNumber} reason=duplicate IP=${req.ip}`, "security");
          return res.status(400).json({ message: "Phone number already registered" });
        }
      }

      // Verify OTPs for registration
      let storedEmailOtpRecord, storedPhoneOtpRecord;

      if (email && emailOtp) {
        storedEmailOtpRecord = await storage.getLatestOtpForEmail(email.toLowerCase());
        console.log(`[REG_DEBUG] Email OTP lookup for ${email}:`, {
          found: !!storedEmailOtpRecord,
          storedOtp: storedEmailOtpRecord?.otp,
          providedOtp: emailOtp,
          match: storedEmailOtpRecord?.otp === emailOtp,
          expired: storedEmailOtpRecord ? new Date() > new Date(storedEmailOtpRecord.expiresAt) : null,
          expiresAt: storedEmailOtpRecord?.expiresAt
        });
        if (!storedEmailOtpRecord || storedEmailOtpRecord.otp !== emailOtp || new Date() > new Date(storedEmailOtpRecord.expiresAt)) {
          return res.status(400).json({ message: "Invalid or expired email OTP" });
        }
      }

      if (phoneNumber && phoneOtp) {
        storedPhoneOtpRecord = await storage.getLatestOtpForPhone(phoneNumber.trim());
        console.log(`[REG_DEBUG] Phone OTP lookup for ${phoneNumber}:`, {
          found: !!storedPhoneOtpRecord,
          storedOtp: storedPhoneOtpRecord?.otp,
          providedOtp: phoneOtp,
          match: storedPhoneOtpRecord?.otp === phoneOtp,
          expired: storedPhoneOtpRecord ? new Date() > new Date(storedPhoneOtpRecord.expiresAt) : null
        });
        if (!storedPhoneOtpRecord || storedPhoneOtpRecord.otp !== phoneOtp || new Date() > new Date(storedPhoneOtpRecord.expiresAt)) {
          return res.status(400).json({ message: "Invalid or expired phone OTP" });
        }
      }

      const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
      const user = await storage.createUser({
        email: email?.toLowerCase(),
        phoneNumber: phoneNumber?.trim(),
        password: hashedPassword,
        name: name || "Admin",
        role: "admin",
        isVerified: !!(email && emailOtp) || !!(phoneNumber && phoneOtp),
      });

      log(`REGISTER_SUCCESS userId=${user.id} IP=${req.ip}`, "security");

      // Delete OTPs after successful registration to prevent reuse
      if (storedEmailOtpRecord?.id) {
        await storage.deleteOtpById(storedEmailOtpRecord.id);
      }
      if (storedPhoneOtpRecord?.id) {
        await storage.deleteOtpById(storedPhoneOtpRecord.id);
      }

      req.login(user, async (err) => {
        if (err) return next(err);
        const membership = await storage.getUserWorkspaceMembership(user.id);
        const { password: _, ...safeUser } = user;
        res.status(201).json({ ...safeUser, workspace: membership || null });
      });
    } catch (err: any) {
      console.error("Registration error:", err.message);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  // ─── Forgot Password ───
  const forgotPasswordSchema = z.object({
    identifier: z.string().min(1), // email or phone number
  });

  app.post("/api/auth/forgot-password", authLimiter, async (req, res) => {
    try {
      const parsed = forgotPasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input" });
      }

      const { identifier } = parsed.data;

      // Determine if identifier is email or phone
      const isEmail = identifier.includes("@");
      let user;

      if (isEmail) {
        user = await storage.getUserByEmail(identifier.toLowerCase());
      } else {
        user = await storage.getUserByPhoneNumber(identifier.trim());
      }

      if (!user) {
        // Don't reveal if user exists or not (security best practice)
        return res.json({ message: "If an account exists, a reset code has been sent." });
      }

      // Generate OTP for password reset
      const otp = generateOtp();
      const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

      await storage.createOtpVerification({
        email: isEmail ? identifier.toLowerCase() : undefined,
        phoneNumber: !isEmail ? identifier.trim() : undefined,
        otp,
        type: isEmail ? "email" : "phone",
        expiresAt,
      });

      // Send OTP
      if (isEmail) {
        await sendEmailOtp(identifier, otp);
      } else {
        await sendPhoneOtp(identifier, otp);
      }

      res.json({ message: "If an account exists, a reset code has been sent." });
    } catch (err: any) {
      console.error("Forgot password error:", err.message);
      res.status(500).json({ message: "Failed to process request" });
    }
  });

  // ─── Reset Password ───
  const resetPasswordSchema = z.object({
    identifier: z.string().min(1),
    otp: z.string().length(6),
    newPassword: z.string().min(6).max(128),
  });

  app.post("/api/auth/reset-password", authLimiter, async (req, res) => {
    try {
      const parsed = resetPasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input: " + parsed.error.issues.map(i => i.message).join(", ") });
      }

      const { identifier, otp, newPassword } = parsed.data;

      // Determine if identifier is email or phone
      const isEmail = identifier.includes("@");

      // Get latest OTP
      let storedOtp;
      if (isEmail) {
        storedOtp = await storage.getLatestOtpForEmail(identifier.toLowerCase());
      } else {
        storedOtp = await storage.getLatestOtpForPhone(identifier.trim());
      }

      if (!storedOtp) {
        return res.status(400).json({ message: "No reset code found. Please request a new one." });
      }

      // Check if OTP has expired
      if (new Date() > new Date(storedOtp.expiresAt)) {
        return res.status(400).json({ message: "Reset code has expired. Please request a new one." });
      }

      // Verify OTP
      if (storedOtp.otp !== otp) {
        return res.status(400).json({ message: "Invalid reset code" });
      }

      // Find user
      let user;
      if (isEmail) {
        user = await storage.getUserByEmail(identifier.toLowerCase());
      } else {
        user = await storage.getUserByPhoneNumber(identifier.trim());
      }

      if (!user) {
        return res.status(400).json({ message: "User not found" });
      }

      // Update password
      const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
      await storage.updateUserPassword(user.id, hashedPassword);

      // Delete the used OTP
      if (storedOtp.id) {
        await storage.deleteOtpById(storedOtp.id);
      }

      log(`PASSWORD_RESET userId=${user.id} IP=${req.ip}`, "security");
      res.json({ message: "Password reset successfully. You can now log in with your new password." });
    } catch (err: any) {
      console.error("Reset password error:", err.message);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  // ─── Google OAuth Routes ───
  app.get("/api/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

  app.get("/api/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/login" }),
    async (req, res) => {
      const user = req.user as any;
      log(`GOOGLE_LOGIN_SUCCESS userId=${user?.id} IP=${req.ip}`, "security");
      const membership = await storage.getUserWorkspaceMembership(user.id);
      // In development, redirect to the Vite dev server (5173).
      // In production, use FRONTEND_URL env var to redirect to Vercel frontend
      const frontendUrl = process.env.NODE_ENV === "development"
        ? "http://localhost:5173/"
        : (process.env.FRONTEND_URL || "/");
      res.redirect(frontendUrl);
    }
  );

  // ─── Login (rate limited) ───
  const loginSchema = z.object({
    identifier: z.string().min(1),
    password: z.string().min(1),
  });

  app.post("/api/auth/login", authLimiter, (req, res, next) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input" });
    }

    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user) {
        log(`LOGIN_FAILED identifier=${req.body?.identifier || "unknown"} IP=${req.ip}`, "security");
        // Return specific error message if available
        if (info && info.message) {
          return res.status(401).json({ 
            message: info.message,
            field: info.field 
          });
        }
        return res.status(401).json({ message: "Invalid credentials" });
      }
      req.login(user, async (err) => {
        if (err) return next(err);
        log(`LOGIN_SUCCESS userId=${user.id} IP=${req.ip}`, "security");
        const membership = await storage.getUserWorkspaceMembership(user.id);
        const { password: _, ...safeUser } = user;
        res.status(200).json({ ...safeUser, workspace: membership || null });
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    const userId = (req.user as any)?.id;
    req.logout((err) => {
      if (err) return next(err);
      // Destroy the session entirely
      req.session.destroy((err) => {
        if (err) log(`LOGOUT_ERROR userId=${userId} err=${err.message}`, "security");
        res.clearCookie("connect.sid");
        res.sendStatus(200);
      });
    });
  });

  app.get("/api/user", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as any;
    const membership = await storage.getUserWorkspaceMembership(user.id);
    const { password: _, ...safeUser } = user;
    res.json({
      ...safeUser,
      workspace: membership || null,
    });
  });

  // Expose whether Google OAuth is configured (no sensitive data)
  app.get("/api/auth/config", (req, res) => {
    res.json({
      googleOAuthEnabled: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET &&
        process.env.GOOGLE_CLIENT_ID !== "your-google-client-id.apps.googleusercontent.com"),
    });
  });
}
