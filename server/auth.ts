import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { type Express } from "express";
import session from "express-session";
import createMemoryStore from "memorystore";
import { storage } from "./storage";
import { z } from "zod";
import bcrypt from "bcryptjs";

export function setupAuth(app: Express) {
  const MemoryStore = createMemoryStore(session);
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "r3pl1t_s3cr3t",
    resave: false,
    saveUninitialized: false,
    cookie: {},
    store: new MemoryStore({
      checkPeriod: 86400000,
    }),
  };

  if (app.get("env") === "production") {
    app.set("trust proxy", 1);
    sessionSettings.cookie = { secure: true };
  }

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(
      { usernameField: "email" },
      async (email, password, done) => {
        try {
          const user = await storage.getUserByEmail(email);
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
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  // Register
  app.patch("/api/auth/profile", async (req, res, next) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const { name, email, phone } = req.body;
      const user = await storage.updateUser((req.user as any).id, { name, email, phone });
      res.json(user);
    } catch (err: any) {
      next(err);
    }
  });

  app.post("/api/auth/register", async (req, res, next) => {
    try {
      const schema = z.object({
        email: z.string().email(),
        password: z.string().min(6),
        name: z.string().optional(),
      });
      const result = schema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid input: " + result.error.issues.map(i => i.message).join(", ") });
      }

      const existing = await storage.getUserByEmail(result.data.email);
      if (existing) {
        return res.status(400).json({ message: "Email already registered" });
      }

      const hashedPassword = await bcrypt.hash(result.data.password, 10);
      const user = await storage.createUser({
        email: result.data.email,
        password: hashedPassword,
        name: result.data.name,
        role: "staff",
      });

      req.login(user, async (err) => {
        if (err) return next(err);
        const membership = await storage.getUserWorkspaceMembership(user.id);
        const { password: _, ...safeUser } = user;
        res.status(201).json({ ...safeUser, workspace: membership || null });
      });
    } catch (err) {
      next(err);
    }
  });

  // Login
  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ message: "Invalid email or password" });
      req.login(user, async (err) => {
        if (err) return next(err);
        const membership = await storage.getUserWorkspaceMembership(user.id);
        const { password: _, ...safeUser } = user;
        res.status(200).json({ ...safeUser, workspace: membership || null });
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as any;
    // Attach workspace info
    const membership = await storage.getUserWorkspaceMembership(user.id);
    const { password: _, ...safeUser } = user;
    res.json({
      ...safeUser,
      workspace: membership || null,
    });
  });
}
