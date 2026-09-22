import { Router, Switch, Route, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster.tsx";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useUser } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import Dashboard from "@/pages/Dashboard";
import Departments from "@/pages/Departments";
import Classrooms from "@/pages/Classrooms";
import Faculty from "@/pages/Faculty";
import Timetable from "@/pages/Timetable";
import Subjects from "@/pages/Subjects";
import Sections from "@/pages/Sections";
import TimeSlots from "@/pages/TimeSlots";
import History from "@/pages/History";
import Reports from "@/pages/Reports";
import Settings from "@/pages/Settings";
import { UpdateBanner } from "@/components/update/UpdateBanner";


/**
 * Offline desktop routing. No login gate and no workspace-setup dialog —
 * the local institution is auto-created on first launch (spec §5/§6).
 * Page components and their visual design are unchanged.
 */
function ProtectedRoute({ component: Component }) {
  const { isLoading } = useUser();

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <Loader2 className="animate-spin text-primary w-8 h-8" />
      </div>
    );
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

function AppRouter() {
  const [location] = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Switch location={location} key={location}>
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
        <Route path="/history">
          <ProtectedRoute component={History} />
        </Route>
        <Route path="/reports">
          <ProtectedRoute component={Reports} />
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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <UpdateBanner />
        <Router hook={useHashLocation}>
          <AppRouter />
        </Router>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

