import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { createServer } from "http";
import cors from "cors";
import helmet from "helmet";
import "dotenv/config";
import { apiLimiter } from "./rate-limit";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// ─── Security: Trust proxy (required behind Render/Vercel load balancers) ───
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// ─── Security: Helmet — sets security headers (CSP, X-Frame-Options, HSTS, etc.) ───
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === "production" ? undefined : false,
}));

// ─── CORS configuration ───
app.use(cors({
  origin: process.env.CORS_ORIGIN,
  credentials: true
}));
// ─── Security: Body size limit — prevent DoS via oversized payloads ───
app.use(
  express.json({
    limit: "1mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: "1mb" }));

// ─── Security: General API rate limiting ───
app.use("/api/", apiLimiter);



export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

// ─── Request logging middleware ───
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;

      // Log response body for non-200 responses (don't log sensitive data for 200s)
      if (capturedJsonResponse && res.statusCode >= 400) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      // Security: log auth failures with IP
      if (res.statusCode === 401 || res.statusCode === 403) {
        logLine += ` IP=${req.ip}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  // ─── Security: Global error handler — never leak internal details in production ───
  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;

    // Log the full error server-side
    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    // In production, return generic message for 500s to avoid leaking stack traces / DB info
    const message = status === 500 && process.env.NODE_ENV === "production"
      ? "Internal Server Error"
      : err.message || "Internal Server Error";

    return res.status(status).json({ message });
  });



  // ALWAYS serve the app on the port specified in the environment variable PORT
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
