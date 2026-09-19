import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CalendarClock, Check, Loader2, X } from "lucide-react";
import { useTimeSlots } from "@/hooks/use-master-data";
import { useToast } from "@/hooks/use-toast";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function normalizeDay(day) {
  if (typeof day === "number") {
    if (day >= 1 && day <= 7) return DAYS[day - 1];
    if (day >= 0 && day < 7) return DAYS[day];
  }
  const s = String(day || "").trim();
  const found = DAYS.find((d) => d.toLowerCase() === s.toLowerCase());
  return found || s || "Monday";
}

/**
 * Teacher availability editor. Blocked periods are persisted in the
 * teacher_availability table and pruned from the CP-SAT model, so a blocked
 * period can never be scheduled (spec §8).
 *
 * Absence of a row means "available" — only explicit blocks are stored.
 */
export function AvailabilityDialog({ teacher, open, onOpenChange }) {
  const { data: timeSlots } = useTimeSlots();
  const { toast } = useToast();
  const [availability, setAvailability] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const teacherId = teacher?.id ?? null;
  const teacherName = teacher?.name ?? "this teacher";

  useEffect(() => {
    if (!open || !teacherId) return;
    let cancelled = false;
    setIsLoading(true);
    if (window?.api?.teachers?.getAvailability) {
      window.api.teachers
        .getAvailability(teacherId)
        .then((rows) => {
          if (!cancelled) setAvailability(rows ?? {});
        })
        .catch((err) =>
          toast({ title: "Could not load availability", description: err.message, variant: "destructive" }),
        )
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }
    return () => {
      cancelled = true;
    };
  }, [open, teacherId]);

  // One row per period label/time; each day column maps to its own slot id.
  const uniqueSlots = useMemo(() => {
    if (!timeSlots || !Array.isArray(timeSlots)) return [];
    const byKey = new Map();
    timeSlots.forEach((slot) => {
      if (!slot) return;
      const key = `${slot.label || ""}-${slot.startTime || ""}-${slot.endTime || ""}`;
      if (!byKey.has(key)) {
        byKey.set(key, {
          key,
          label: slot.label || "",
          startTime: slot.startTime || "",
          endTime: slot.endTime || "",
          idsByDay: {},
        });
      }
      const day = normalizeDay(slot.dayOfWeek);
      byKey.get(key).idsByDay[day] = slot.id;
    });
    return Array.from(byKey.values()).sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));
  }, [timeSlots]);

  const activeDays = useMemo(() => {
    const present = new Set((timeSlots ?? []).filter(Boolean).map((s) => normalizeDay(s.dayOfWeek)));
    const matched = DAYS.filter((day) => present.has(day));
    return matched.length > 0 ? matched : DAYS.slice(0, 5);
  }, [timeSlots]);

  const isAvailable = (slotId) => availability?.[slotId] !== 0;

  const toggleSlot = (slotId) =>
    setAvailability((prev) => ({ ...prev, [slotId]: prev?.[slotId] === 0 ? 1 : 0 }));

  const setAll = (available) => {
    const next = {};
    (timeSlots ?? []).filter(Boolean).forEach((slot) => {
      next[slot.id] = available ? 1 : 0;
    });
    setAvailability(next);
  };

  const totalSlots = (timeSlots ?? []).length;
  const availableCount = (timeSlots ?? []).filter((s) => isAvailable(s?.id)).length;

  const handleSave = async () => {
    if (!teacherId) return;
    setIsSaving(true);
    try {
      const on = [];
      const off = [];
      for (const slot of timeSlots ?? []) {
        if (!slot) continue;
        (isAvailable(slot.id) ? on : off).push(slot.id);
      }
      if (window?.api?.teachers?.setAvailability) {
        if (off.length > 0) await window.api.teachers.setAvailability(teacherId, off, false);
        if (on.length > 0) await window.api.teachers.setAvailability(teacherId, on, true);
      }
      toast({
        title: "Availability saved",
        description: `${teacherName} can be scheduled in ${on.length} of ${totalSlots} periods.`,
      });
      onOpenChange(false);
    } catch (err) {
      toast({ title: "Could not save availability", description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl rounded-2xl border border-slate-100 max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-display font-black flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-teal-600" />
            Availability — {teacherName}
          </DialogTitle>
          <DialogDescription>
            Click any period to block it. The generator will never place a class in a blocked
            period.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-teal-500" />
          </div>
        ) : uniqueSlots.length === 0 ? (
          <div className="py-12 text-center">
            <CalendarClock className="w-9 h-9 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 font-semibold text-sm">
              No time slots defined yet. Add time slots first.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs font-bold text-slate-500">
                {availableCount} of {totalSlots} periods available
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAll(true)}
                  className="h-8 px-3 rounded-lg text-xs font-bold border-slate-200"
                >
                  Clear all blocks
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAll(false)}
                  className="h-8 px-3 rounded-lg text-xs font-bold border-slate-200"
                >
                  Block everything
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left px-3 py-2 font-black uppercase tracking-wider text-[10px] text-slate-400">
                      Period
                    </th>
                    {activeDays.map((day) => (
                      <th
                        key={day}
                        className="px-2 py-2 font-black uppercase tracking-wider text-[10px] text-slate-400 text-center"
                      >
                        {day.slice(0, 3)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {uniqueSlots.map((slot) => (
                    <tr key={slot.key} className="border-t border-slate-50">
                      <td className="px-3 py-1.5">
                        <span className="font-bold text-slate-700">{slot.label}</span>
                        <span className="block text-[10px] text-slate-400 font-medium">
                          {slot.startTime}–{slot.endTime}
                        </span>
                      </td>
                      {activeDays.map((day) => {
                        const slotId = slot.idsByDay[day];
                        if (!slotId) {
                          return (
                            <td key={day} className="px-2 py-1.5 text-center text-slate-300">
                              ·
                            </td>
                          );
                        }
                        const available = isAvailable(slotId);
                        return (
                          <td key={day} className="px-1.5 py-1.5 text-center">
                            <button
                              type="button"
                              onClick={() => toggleSlot(slotId)}
                              aria-pressed={available}
                              aria-label={`${slot.label} on ${day} — ${available ? "available" : "blocked"}`}
                              className={`w-full h-8 rounded-lg flex items-center justify-center transition-all border ${
                                available
                                  ? "bg-teal-50 border-teal-200 text-teal-600 hover:bg-teal-100"
                                  : "bg-rose-50 border-rose-200 text-rose-500 hover:bg-rose-100"
                              }`}
                            >
                              {available ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="h-10 px-5 rounded-xl font-bold border-slate-200"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="h-10 px-5 rounded-xl font-bold premium-gradient shadow-lg shadow-teal-500/20"
              >
                {isSaving ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                ) : (
                  "Save availability"
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
