import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { type Express } from "express";
import session from "express-session";
import createMemoryStore from "memorystore";
import { storage } from "./storage";
import { z } from "zod";
import bcrypt from "bcrypt";
import { log } from "./index";
import { authLimiter } from "./rate-limit";

// Bcrypt cost factor
const BCRYPT_ROUNDS = 10;

// Session max age — 24 hours
const SESSION_MAX_AGE = 24 * 60 * 60 * 1000;

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

  passport.use(
    new LocalStrategy(
      { usernameField: "email" },
      async (email, password, done) => {
        try {
          const normalizedEmail = email.trim().toLowerCase();
          const user = await storage.getUserByEmail(normalizedEmail);
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

  // ─── Registration (rate limited) ───
  const registerSchema = z.object({
    email: z.string().email().max(255).trim().toLowerCase(),
    password: z.string().min(6).max(128),
    name: z.string().min(1).max(100).trim().optional(),
  }).strict();

  app.post("/api/auth/register", authLimiter, async (req, res, next) => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input: " + parsed.error.issues.map(i => i.message).join(", ") });
      }

      const existing = await storage.getUserByEmail(parsed.data.email);
      if (existing) {
        log(`REGISTER_FAILED email=${parsed.data.email} reason=duplicate IP=${req.ip}`, "security");
        return res.status(400).json({ message: "Email already registered" });
      }

      const hashedPassword = await bcrypt.hash(parsed.data.password, BCRYPT_ROUNDS);
      const user = await storage.createUser({
        email: parsed.data.email,
        password: hashedPassword,
        name: parsed.data.name || "Admin",
        role: "admin",
      });

      log(`REGISTER_SUCCESS email=${parsed.data.email} userId=${user.id} IP=${req.ip}`, "security");

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

  // ─── Login (rate limited) ───
  app.post("/api/auth/login", authLimiter, (req, res, next) => {
    passport.authenticate("local", (err: any, user: any) => {
      if (err) return next(err);
      if (!user) {
        log(`LOGIN_FAILED email=${req.body?.email || "unknown"} IP=${req.ip}`, "security");
        return res.status(401).json({ message: "Invalid email or password" });
      }
      req.login(user, async (err) => {
        if (err) return next(err);
        log(`LOGIN_SUCCESS email=${user.email} userId=${user.id} IP=${req.ip}`, "security");
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
}
