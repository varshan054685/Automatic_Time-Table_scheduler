import { useState, useMemo } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Loader2, Download, RefreshCw } from "lucide-react";
import { useTimetable, useGenerateTimetable } from "@/hooks/use-timetable";
import { useDepartments, useSections, useTimeSlots } from "@/hooks/use-master-data";
import { useToast } from "@/hooks/use-toast";

export default function TimetablePage() {
  const [selectedDept, setSelectedDept] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const { toast } = useToast();
  
  const { data: departments } = useDepartments();
  const { data: sections } = useSections();
  const { data: timeSlots } = useTimeSlots();
  
  const filteredSections = sections?.filter(s => 
    !selectedDept || s.departmentId.toString() === selectedDept
  );

  const { data: timetable, isLoading: isLoadingTimetable } = useTimetable({
    sectionId: selectedSection
  });

  const generateMutation = useGenerateTimetable();

  const handleGenerate = () => {
    if (!selectedDept) {
      toast({ title: "Error", description: "Please select a department first", variant: "destructive" });
      return;
    }

    const semester = prompt("Enter semester number (e.g. 1, 2, 3):", "1");
    if (semester === null) return;

    generateMutation.mutate({
      departmentId: parseInt(selectedDept),
      semester: parseInt(semester)
    }, {
      onSuccess: (data) => {
        toast({ title: "Success", description: data.message });
      },
      onError: (err) => {
        toast({ title: "Failed", description: err.message, variant: "destructive" });
      }
    });
  };

  const getEntry = (day, slotId) => {
    return timetable?.find(t => 
      t.timeSlotId === slotId && 
      t.timeSlot.dayOfWeek === day
    );
  };

  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  
  const uniqueSlots = useMemo(() => {
    if (!timeSlots) return [];
    
    const slotsByTime = new Map();
    timeSlots.forEach(slot => {
      const key = `${slot.label}-${slot.startTime}-${slot.endTime}`;
      if (!slotsByTime.has(key)) {
        slotsByTime.set(key, {
          label: slot.label,
          startTime: slot.startTime,
          endTime: slot.endTime,
          idsByDay: {}
        });
      }
      slotsByTime.get(key).idsByDay[slot.dayOfWeek] = slot.id;
    });

    return Array.from(slotsByTime.values()).sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [timeSlots]);

  const activeDays = days.filter(day => 
    timeSlots?.some(slot => slot.dayOfWeek === day)
  );

  const formatTime = (time24) => {
    if (!time24) return "";
    const [h, m] = time24.split(":");
    const hNum = parseInt(h);
    const ampm = hNum >= 12 ? 'PM' : 'AM';
    const h12 = hNum % 12 || 12;
    return `${h12}:${m} ${ampm}`;
  };

  return (
    <div className="flex min-h-screen bg-slate-50/50">
      <Sidebar />
      <main className="flex-1 lg:ml-64 p-4 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6 pt-12 lg:pt-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-display font-bold text-slate-900">Timetable</h1>
              <p className="text-slate-500 mt-1">Generate and view weekly schedules.</p>
            </div>
            <div className="flex gap-2">
               <Button variant="outline" className="gap-2">
                 <Download className="w-4 h-4" /> Export PDF
               </Button>
            </div>
          </div>

          <Card className="p-6 bg-white shadow-sm border-slate-100">
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="space-y-2 flex-1">
                <label className="text-sm font-medium">Department</label>
                <Select value={selectedDept} onValueChange={setSelectedDept}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments?.map(d => (
                      <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 flex-1">
                <label className="text-sm font-medium">Section/Class (View Only)</label>
                <Select value={selectedSection} onValueChange={setSelectedSection}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Class to View" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredSections?.map(s => (
                      <SelectItem key={s.id} value={s.id.toString()}>{s.name} (Sem {s.semester})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button 
                onClick={handleGenerate} 
                disabled={!selectedDept || generateMutation.isPending}
                className="bg-primary hover:bg-primary/90 text-white min-w-[140px]"
              >
                {generateMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
                ) : (
                  <><RefreshCw className="w-4 h-4 mr-2" /> Generate New</>
                )}
              </Button>
            </div>
          </Card>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {!selectedSection ? (
              <div className="p-12 text-center text-slate-500">
                <p>Select a class section above to view its timetable</p>
              </div>
            ) : isLoadingTimetable ? (
              <div className="p-12 flex justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700 w-32 border-r border-slate-200">Day / Time</th>
                      {uniqueSlots.map((slot, idx) => (
                        <th key={idx} className="px-4 py-3 text-center font-semibold text-slate-700 min-w-[160px] border-r border-slate-200 last:border-0">
                          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">{slot.label}</div>
                          <div>{formatTime(slot.startTime)} - {formatTime(slot.endTime)}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeDays.map(day => (
                      <tr key={day} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="px-4 py-4 font-medium text-slate-700 bg-slate-50/30 border-r border-slate-200">
                          {day}
                        </td>
                        {uniqueSlots.map((slot, idx) => {
                          const slotIdForDay = slot.idsByDay[day];
                          const entry = slotIdForDay ? getEntry(day, slotIdForDay) : null;
                          return (
                            <td key={idx} className="px-4 py-4 border-r border-slate-200 last:border-0 relative group">
                              {entry ? (
                                <div className="text-center">
                                  <div className="font-bold text-primary mb-1">{entry.subject.name}</div>
                                  <div className="text-xs text-slate-500">{entry.faculty.name}</div>
                                  <div className="text-xs text-slate-400 mt-1 px-2 py-0.5 rounded-full bg-slate-100 inline-block">
                                    Room {entry.classroom.roomNumber}
                                  </div>
                                </div>
                              ) : (
                                <div className="text-center text-slate-300 italic text-xs">- Free -</div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
