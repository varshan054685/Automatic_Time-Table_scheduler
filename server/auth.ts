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
      { usernameField: "identifier" },
      async (identifier, password, done) => {
        try {
          let user;
          // Check if identifier is email or phone number
          if (identifier.includes("@")) {
            const normalizedEmail = identifier.trim().toLowerCase();
            user = await storage.getUserByEmail(normalizedEmail);
          } else {
            // Assume it's a phone number
            user = await storage.getUserByPhoneNumber(identifier.trim());
          }
          
          if (!user) return done(null, false);
          const valid = await bcrypt.compare(password, user.password);
          if (!valid) return done(null, false);
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
  const googleCallbackUrl = process.env.GOOGLE_CALLBACK_URL || "http://localhost:5000/api/auth/google/callback";

  if (googleClientId && googleClientSecret) {
    passport.use(
      "google",
      new GoogleStrategy(
        {
          clientID: googleClientId,
          clientSecret: googleClientSecret,
          callbackURL: googleCallbackUrl,
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

  async function sendEmailOtp(email: string, otp: string): Promise<void> {
    // In production, integrate with email service (SendGrid, AWS SES, etc.)
    // For now, just log the OTP
    log(`OTP_EMAIL to=${email} otp=${otp}`, "security");
    console.log(`[DEBUG] Email OTP for ${email}: ${otp}`);
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
      res.status(500).json({ message: "Failed to send OTP" });
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
      if (new Date() > new Date(storedOtp.expiresAt)) {
        return res.status(400).json({ message: "OTP has expired. Please request a new one." });
      }

      // Verify OTP
      if (storedOtp.otp !== otp) {
        return res.status(400).json({ message: "Invalid OTP" });
      }

      res.json({ verified: true, message: "OTP verified successfully" });
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
      if (email && emailOtp) {
        const storedEmailOtp = await storage.getLatestOtpForEmail(email.toLowerCase());
        if (!storedEmailOtp || storedEmailOtp.otp !== emailOtp || new Date() > new Date(storedEmailOtp.expiresAt)) {
          return res.status(400).json({ message: "Invalid or expired email OTP" });
        }
      }

      if (phoneNumber && phoneOtp) {
        const storedPhoneOtp = await storage.getLatestOtpForPhone(phoneNumber.trim());
        if (!storedPhoneOtp || storedPhoneOtp.otp !== phoneOtp || new Date() > new Date(storedPhoneOtp.expiresAt)) {
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

  // ─── Google OAuth Routes ───
  app.get("/api/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

  app.get("/api/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/login" }),
    async (req, res) => {
      const user = req.user as any;
      log(`GOOGLE_LOGIN_SUCCESS userId=${user?.id} IP=${req.ip}`, "security");
      const membership = await storage.getUserWorkspaceMembership(user.id);
      // Set user data in session and redirect to app
      res.redirect("/");
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

    passport.authenticate("local", (err: any, user: any) => {
      if (err) return next(err);
      if (!user) {
        log(`LOGIN_FAILED identifier=${req.body?.identifier || "unknown"} IP=${req.ip}`, "security");
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
