import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster.tsx";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useUser } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { WorkspaceSetupDialog } from "@/components/WorkspaceSetupDialog";
import { Chatbot } from "@/components/Chatbot";
import { motion, AnimatePresence } from "framer-motion";

import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Departments from "@/pages/Departments";
import Classrooms from "@/pages/Classrooms";
import Faculty from "@/pages/Faculty";
import Timetable from "@/pages/Timetable";
import Subjects from "@/pages/Subjects";
import Sections from "@/pages/Sections";
import TimeSlots from "@/pages/TimeSlots";
import Settings from "@/pages/Settings";

function ProtectedRoute({ component: Component }) {
  const { user, isLoading } = useUser();
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <Loader2 className="animate-spin text-primary w-8 h-8" />
      </div>
    );
  }

  if (!user) {
    setLocation("/login");
    return null;
  }

  // Show workspace setup if user has no workspace
  if (!user.workspace) {
    return <WorkspaceSetupDialog />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="w-full h-full"
    >
      <Component />
    </motion.div>
  );
}

// PublicRoute - for pages like login that should redirect if already logged in
function PublicRoute({ component: Component }) {
  const { user, isLoading } = useUser();
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <Loader2 className="animate-spin text-primary w-8 h-8" />
      </div>
    );
  }

  // If user is logged in, redirect to home
  if (user) {
    setLocation("/");
    return null;
  }

  return <Component />;
}

function Router() {
  const [location] = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Switch location={location} key={location}>
        <Route path="/login">
          <PublicRoute component={Login} />
        </Route>

        <Route path="/">
          <ProtectedRoute component={Dashboard} />
        </Route>
        <Route path="/departments">
          <ProtectedRoute component={Departments} />
        </Route>
        <Route path="/classrooms">
          <ProtectedRoute component={Classrooms} />
        </Route>
        <Route path="/faculty">
          <ProtectedRoute component={Faculty} />
        </Route>
        <Route path="/timetable">
          <ProtectedRoute component={Timetable} />
        </Route>
        <Route path="/subjects">
          <ProtectedRoute component={Subjects} />
        </Route>
        <Route path="/sections">
          <ProtectedRoute component={Sections} />
        </Route>
        <Route path="/timeslots">
          <ProtectedRoute component={TimeSlots} />
        </Route>
        <Route path="/settings">
          <ProtectedRoute component={Settings} />
        </Route>

        <Route>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="h-screen w-full flex items-center justify-center text-2xl font-display font-bold"
          >
            404 Not Found
          </motion.div>
        </Route>
      </Switch>
    </AnimatePresence>
  );
}

// AppContent runs inside QueryClientProvider so useUser works correctly
function AppContent() {
  const { user, isLoading } = useUser();

  // Only show the chatbot when the user is fully authenticated with a workspace.
  // On the login page there's no session, so the /api/chatbot endpoint would
  // return 401 — no point rendering it at all.
  const showChatbot = !isLoading && !!user?.workspace;

  return (
    <>
      <Toaster />
      <Router />
      {showChatbot && <Chatbot />}
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppContent />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
