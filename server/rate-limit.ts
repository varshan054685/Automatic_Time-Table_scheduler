import rateLimit from "express-rate-limit";
import { log } from "./index";

/**
 * Rate limiter for authentication endpoints (login, register).
 * 5 attempts per 15 minutes per IP.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts. Please try again in 15 minutes." },
  handler: (req, res, _next, options) => {
    log(`RATE_LIMIT auth endpoint hit by IP=${req.ip} path=${req.path}`, "security");
    res.status(429).json(options.message);
  },
});

/**
 * Rate limiter for general API endpoints.
 * 100 requests per 15 minutes per IP.
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Please slow down." },
  handler: (req, res, _next, options) => {
    log(`RATE_LIMIT API hit by IP=${req.ip} path=${req.path}`, "security");
    res.status(429).json(options.message);
  },
});

/**
 * Rate limiter for timetable generation (expensive CPU operation).
 * 3 requests per 15 minutes per IP.
 */
export const generationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Timetable generation rate limit reached. Please wait before generating again." },
  handler: (req, res, _next, options) => {
    log(`RATE_LIMIT generation hit by IP=${req.ip} path=${req.path}`, "security");
    res.status(429).json(options.message);
  },
});
