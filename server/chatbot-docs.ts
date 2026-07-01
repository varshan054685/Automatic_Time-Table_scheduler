import { readFileSync } from "fs";
import { join } from "path";

// ─── Doc registry ─────────────────────────────────────────────────────────────
// Each entry maps a documentation file to a set of topic keywords used for
// relevance scoring. Keywords are matched against the user's query to decide
// which subset of docs to include in the Gemini context window.
// ─────────────────────────────────────────────────────────────────────────────

interface DocEntry {
    file: string;
    keywords: string[];
    content: string; // loaded at startup
}

const DOC_DEFINITIONS: Omit<DocEntry, "content">[] = [
    {
        file: "docs/features/authentication.md",
        keywords: [
            "login", "logout", "register", "sign in", "sign up", "password",
            "otp", "verification", "google oauth", "forgot password", "reset password",
            "account", "email", "session", "auth",
        ],
    },
    {
        file: "docs/features/workspaces.md",
        keywords: [
            "workspace", "create workspace", "join workspace", "invite", "referral code",
            "admin code", "observer code", "team", "leave workspace", "delete workspace",
            "workspace name", "academic year", "members",
        ],
    },
    {
        file: "docs/features/roles-and-permissions.md",
        keywords: [
            "role", "owner", "viewer", "admin", "observer", "permission", "access",
            "who can", "403", "forbidden", "change request", "middleware",
        ],
    },
    {
        file: "docs/features/departments.md",
        keywords: [
            "department", "departments", "dept", "add department", "edit department",
            "delete department", "department code", "department name",
        ],
    },
    {
        file: "docs/features/classrooms.md",
        keywords: [
            "classroom", "classrooms", "room", "rooms", "lecture hall", "lab room",
            "capacity", "room number", "add classroom", "room type",
        ],
    },
    {
        file: "docs/features/faculty.md",
        keywords: [
            "faculty", "teacher", "professor", "staff", "instructor", "add faculty",
            "faculty code", "faculty name", "import faculty", "excel import", "availability",
        ],
    },
    {
        file: "docs/features/sections.md",
        keywords: [
            "section", "sections", "cohort", "class group", "student group",
            "semester", "year", "add section", "cs-a", "batch",
        ],
    },
    {
        file: "docs/features/subjects.md",
        keywords: [
            "subject", "subjects", "course", "courses", "weekly hours", "lab", "lecture",
            "default faculty", "target section", "import subjects", "subject code",
            "subject type", "practical",
        ],
    },
    {
        file: "docs/features/time-slots.md",
        keywords: [
            "time slot", "timeslot", "timeslots", "period", "break", "lunch", "morning",
            "afternoon", "schedule period", "hh:mm", "day of week", "add time slot",
        ],
    },
    {
        file: "docs/features/timetable-generation.md",
        keywords: [
            "generate", "generation", "timetable", "schedule", "regenerate", "regenerate all",
            "or-tools", "cp-sat", "solver", "algorithm", "constraints", "conflict",
            "constraints too strict", "job", "progress", "atomic", "queue", "section failed",
            "no classrooms", "no subjects", "rate limit generation", "hard constraint",
            "soft constraint", "lab block",
        ],
    },
    {
        file: "docs/features/exports.md",
        keywords: [
            "export", "print", "pdf", "timetable grid", "view timetable", "section view",
            "faculty view", "whole department", "print timetable", "course legend",
            "filter", "department dropdown", "class dropdown", "stats bar", "conflicts",
        ],
    },
    {
        file: "docs/features/change-requests.md",
        keywords: [
            "change request", "change requests", "approve", "reject", "pending request",
            "viewer request", "request sent to admin", "edit request", "delete request",
        ],
    },
    {
        file: "docs/features/settings.md",
        keywords: [
            "settings", "profile", "update profile", "workspace settings", "invite link",
            "referral", "remove member", "delete account", "leave", "danger zone",
            "academic year", "workspace health", "workspace analytics",
        ],
    },
    {
        file: "docs/project-knowledge.md",
        keywords: [
            "architecture", "tech stack", "technology", "database schema", "api endpoints",
            "backend", "frontend", "react", "node", "python", "fastapi", "drizzle",
            "postgresql", "overview", "how it works", "built with",
        ],
    },
    {
        file: "docs/user-guide.md",
        keywords: [
            "get started", "beginner", "how to start", "setup", "first time", "guide",
            "step by step", "workflow", "checklist", "complete setup", "full walkthrough",
        ],
    },
];

// ─── Load all docs at startup ─────────────────────────────────────────────────

const ROOT = join(process.cwd());

export const DOCS: DocEntry[] = DOC_DEFINITIONS.map((def) => ({
    ...def,
    content: readFileSync(join(ROOT, def.file), "utf-8"),
}));

// ─── Relevance scoring ────────────────────────────────────────────────────────

/**
 * Score a doc entry against the full conversation text.
 * Returns a numeric score — higher is more relevant.
 */
function scoreDoc(doc: DocEntry, queryLower: string): number {
    let score = 0;
    for (const kw of doc.keywords) {
        // Exact substring match
        if (queryLower.includes(kw)) {
            // Longer keywords are more specific → reward them more
            score += 1 + kw.split(" ").length;
        }
    }
    return score;
}

// ─── Public retrieval function ────────────────────────────────────────────────

/**
 * Given the user's latest message plus recent conversation history,
 * return the most relevant documentation sections as a single string
 * ready to be injected into the Gemini prompt.
 *
 * @param userMessage   The current user message
 * @param historyText   Concatenated recent messages for context (optional)
 * @param topN          How many docs to include (default 3)
 */
export function retrieveRelevantDocs(
    userMessage: string,
    historyText = "",
    topN = 3,
): string {
    const queryLower = (userMessage + " " + historyText).toLowerCase();

    const scored = DOCS.map((doc) => ({
        doc,
        score: scoreDoc(doc, queryLower),
    })).sort((a, b) => b.score - a.score);

    // Always include the user guide if the query looks like a setup/start question
    const isSetupQuery = /\b(start|begin|setup|first|new|workflow|checklist|how do i)\b/.test(queryLower);

    const selected: DocEntry[] = [];
    for (const { doc, score } of scored) {
        if (selected.length >= topN) break;
        // Include docs with at least one keyword match, or force-include user guide
        if (score > 0 || (isSetupQuery && doc.file.includes("user-guide"))) {
            selected.push(doc);
        }
    }

    // Fallback: if nothing matched at all, return the user guide + project overview
    if (selected.length === 0) {
        const fallback = DOCS.filter(
            (d) => d.file.includes("user-guide") || d.file.includes("project-knowledge"),
        );
        return fallback.map((d) => formatDoc(d)).join("\n\n");
    }

    return selected.map((d) => formatDoc(d)).join("\n\n");
}

function formatDoc(doc: DocEntry): string {
    const label = doc.file.replace("docs/", "").replace(".md", "").toUpperCase();
    // Cap each doc at 3000 chars to keep total context under ~10KB per request.
    // Free-tier Gemini has strict per-minute token limits — the top of each doc
    // contains the purpose, workflow steps, and key rules which are most useful.
    const MAX_CHARS = 3000;
    const content = doc.content.length > MAX_CHARS
        ? doc.content.slice(0, MAX_CHARS) + "\n\n[...content truncated]"
        : doc.content;
    return `=== DOCUMENTATION: ${label} ===\n${content}\n=== END: ${label} ===`;
}
