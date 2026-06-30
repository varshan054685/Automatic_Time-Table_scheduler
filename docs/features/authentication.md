# Authentication

## Purpose

Handles user registration, login, logout, email OTP verification, Google OAuth, and password reset. All sessions are server-side using express-session with a MemoryStore. Passwords are hashed with bcrypt (10 rounds). Sessions expire after 24 hours.

## Where to find it

The `/login` route renders the full-page `Login.jsx` component. There is no separate register page — registration is handled inside the same card via a mode toggle.

## Who can use it

Everyone (unauthenticated users). All auth endpoints are public but rate-limited.

## User Workflow

### Login
1. Navigate to the app URL. If unauthenticated, you are shown the Login page.
2. Enter your email address (or phone number) and password.
3. Click **Sign In**.
4. On success, you are redirected to the Dashboard (`/`).

### Register
1. On the Login page, click **Create Account**.
2. Enter your Full Name, Email Address.
3. Click **Send Verification OTP**. A 6-digit code is sent to your email via SendGrid (or SMTP fallback).
4. Enter the 6-digit OTP in the slot inputs.
5. Click **Verify OTP**.
6. After verification, password fields appear. Enter and confirm your password.
7. Click **Create Account** to complete registration.

### Google OAuth
1. Click **Continue with Google** (only visible if `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are configured in the server environment).
2. You are redirected to Google's OAuth consent screen.
3. After granting permission, you are redirected back and logged in automatically. If your Google email already has an account, it is linked. Otherwise, a new account is created.

### Forgot Password
1. Click **Forgot your password?** on the Login page.
2. Enter your email address and click **Send Reset Code**.
3. Enter the 6-digit code sent to your email.
4. Click **Verify Code**.
5. After verification, new password fields appear. Enter and confirm your new password.
6. Click **Reset Password**. You are automatically logged in.

## Buttons & Actions

- **Sign In** — Submits identifier + password to `POST /api/auth/login`.
- **Continue with Google** — Redirects to `GET /api/auth/google`.
- **Send Verification OTP** — Calls `POST /api/auth/request-otp` with type `email`.
- **Verify OTP** — Calls `POST /api/auth/verify-otp`.
- **Resend OTP** — Re-calls `POST /api/auth/request-otp`. Only available after the 60-second countdown expires.
- **Create Account** — Calls `POST /api/auth/register` with the OTP included.
- **Send Reset Code** — Calls `POST /api/auth/forgot-password`.
- **Verify Code** — Calls `POST /api/auth/verify-otp`.
- **Reset Password** — Calls `POST /api/auth/reset-password`, then auto-calls `POST /api/auth/login`.
- **Sign In / Create Account toggle** — Switches the form mode in state. Does not call any API.

## Validation Rules

| Field | Rules |
|---|---|
| Email | Valid email format, max 255 chars, case-insensitive |
| Password (register) | Min 6, max 128 characters |
| Password (login) | Min 1 character |
| Name | Min 1, max 100 characters |
| OTP | Exactly 6 digits |
| Phone number | 10–15 characters (if used) |

- The server checks common email domain typos (e.g. `gmial.com` → suggests `gmail.com`) and returns a specific error.
- You cannot register with an email that already exists.
- OTPs expire in exactly 5 minutes.
- Auth endpoints are rate-limited to **10 requests per 15 minutes per IP**.

## API

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/register` | Create a new account |
| POST | `/api/auth/login` | Email/phone + password login |
| POST | `/api/auth/request-otp` | Send a 6-digit OTP to email or phone |
| POST | `/api/auth/verify-otp` | Verify the OTP |
| POST | `/api/auth/forgot-password` | Request a password-reset OTP |
| POST | `/api/auth/reset-password` | Reset password using OTP |
| GET | `/api/auth/google` | Initiate Google OAuth flow |
| GET | `/api/auth/google/callback` | Google OAuth callback |
| POST | `/api/logout` | Destroy session and clear cookie |
| GET | `/api/user` | Fetch the currently authenticated user |
| GET | `/api/auth/config` | Check if Google OAuth is enabled |

## Database

| Table | Operation |
|---|---|
| `users` | INSERT on register, SELECT on login |
| `otp_verifications` | INSERT on OTP request, SELECT on verification, DELETE after successful use |

## Success Flow

- Login: Session cookie is set, user object (without password) + workspace membership is returned. Frontend caches this and redirects to `/`.
- Register: User is created, OTP record is deleted, user is immediately logged in (same session), redirected to `/`.
- Password reset: Password hash updated, OTP deleted, user is auto-logged in.

## Failure Cases

| Scenario | Error |
|---|---|
| Email not found | "We couldn't find an account with this email address." |
| Wrong password | "The password you entered is incorrect." |
| OTP expired | "OTP has expired (expired X minute(s) ago). Please request a new one." |
| OTP invalid | "Invalid OTP. Please check and try again." |
| Email already registered | "Email already registered" |
| Too many attempts | "Too many attempts. Please try again in 15 minutes." |
| Email domain typo | "Did you mean you@gmail.com?" |
| SendGrid not configured | OTP is logged to the server console — check server logs in development |

## Frequently Asked Questions

**Q: I didn't receive the OTP email.**
A: Check your spam/junk folder. The sender is `Time Table Scheduler`. In development, the OTP is always printed to the server console. If SendGrid is not configured, it will only appear there.

**Q: My OTP expired.**
A: OTPs last exactly 5 minutes. Click **Resend OTP** (available after 60 seconds) to get a new one.

**Q: Can I use Google and email/password for the same account?**
A: Yes. If you log in with Google using an email that already has a password-based account, the Google ID is linked to that account automatically.

**Q: I'm the owner — can I reset my password?**
A: Yes, use the Forgot Password flow. It works for all users regardless of role.

## Related Features

- [Workspaces](./workspaces.md) — After registering, you must create or join a workspace before accessing any data.
- [Roles & Permissions](./roles-and-permissions.md) — The workspace role is set at join time.
- [Settings / Profile](./settings.md) — Name and email can be updated after login.
