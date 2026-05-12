/**
 * Professional inline SVG Logo component for the Timetable Scheduler.
 * Renders a calendar-grid + checkmark design using the brand's indigo/purple gradient.
 */
export function Logo({ className = "w-8 h-8", ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 40 40"
      fill="none"
      className={className}
      {...props}
    >
      <defs>
        <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4F46E5" />
          <stop offset="50%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#7C3AED" />
        </linearGradient>
        <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#818CF8" />
          <stop offset="100%" stopColor="#A78BFA" />
        </linearGradient>
      </defs>
      {/* Main calendar body */}
      <rect x="4" y="6" width="32" height="30" rx="4" fill="url(#logoGrad)" />
      {/* Top bar */}
      <rect x="4" y="6" width="32" height="8" rx="4" fill="url(#logoGrad)" />
      <rect x="4" y="10" width="32" height="4" fill="url(#logoGrad)" />
      {/* Calendar pins */}
      <rect x="12" y="3" width="3" height="8" rx="1.5" fill="white" opacity="0.9" />
      <rect x="25" y="3" width="3" height="8" rx="1.5" fill="white" opacity="0.9" />
      {/* Grid cells - Row 1 */}
      <rect x="8" y="17" width="7" height="5" rx="1" fill="white" opacity="0.95" />
      <rect x="16.5" y="17" width="7" height="5" rx="1" fill="url(#accentGrad)" opacity="0.6" />
      <rect x="25" y="17" width="7" height="5" rx="1" fill="white" opacity="0.95" />
      {/* Grid cells - Row 2 */}
      <rect x="8" y="24" width="7" height="5" rx="1" fill="url(#accentGrad)" opacity="0.6" />
      <rect x="16.5" y="24" width="7" height="5" rx="1" fill="white" opacity="0.95" />
      <rect x="25" y="24" width="7" height="5" rx="1" fill="url(#accentGrad)" opacity="0.6" />
      {/* Check badge */}
      <circle cx="34" cy="8" r="5" fill="#10B981" />
      <path
        d="M31.5 8 L33 9.5 L36.5 6.5"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
