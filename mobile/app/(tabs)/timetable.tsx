import { useMemo, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { CalendarDays, AlertTriangle, Users } from "lucide-react-native";
import {
  Screen,
  AppHeader,
  Card,
  SearchInput,
  EmptyState,
  SyncStatus,
  StatusBadge,
} from "@/components";
import { colors, typography } from "@/constants/theme";
import { useSession } from "@/hooks/use-session";
import { useTimetableEntries, useSections, useTimeSlots, useFaculty, useClassrooms, useSubjects } from "@/hooks/use-local-data";
import { validateTimetable } from "@/services/timetable-validation";
import { TimetableEntry } from "@/types";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function TimetableScreen() {
  const { session } = useSession();
  const workspaceId = session?.workspace?.id ?? 0;

  const { data: sections } = useSections();
  const { data: entries } = useTimetableEntries();
  const { data: timeSlots } = useTimeSlots();
  const { data: faculty } = useFaculty();
  const { data: classrooms } = useClassrooms();
  const { data: subjects } = useSubjects();

  const [selectedSectionId, setSelectedSectionId] = useState<number | null>(null);
  const todayIndex = new Date().getDay();
  const [day, setDay] = useState<string>(todayIndex === 0 ? "Monday" : DAYS[todayIndex - 1] ?? "Monday");
  const [query, setQuery] = useState("");

  const section = sections?.find((s) => Number(s.id) === selectedSectionId) ?? sections?.[0];
  const selectedServerSectionId = section ? Number((section as { serverId?: number }).serverId ?? section.id) : null;

  // Timetable entries reference SERVER ids (as stored by the sync engine),
  // while local master-data rows carry a local id + serverId. Key lookups by
  // serverId so cross-references resolve correctly.
  type Slotted = { id?: number | null; serverId?: number | null; dayOfWeek?: string; startTime?: string; endTime?: string; label?: string };
  type Named = { id?: number | null; serverId?: number | null; name?: string; code?: string; roomNumber?: string };
  const byId = <T extends { id?: number | null; serverId?: number | null }>(rows: T[] | undefined): Map<number, T> => {
    const m = new Map<number, T>();
    for (const r of rows ?? []) {
      const key = r.serverId ?? r.id;
      if (key != null) m.set(Number(key), r);
    }
    return m;
  };

  const slotMap = byId(timeSlots as Slotted[]);
  const facultyMap = byId(faculty as Named[]);
  const roomMap = byId(classrooms as Named[]);
  const subjectMap = byId(subjects as Named[]);

  const dayEntries = useMemo(() => {
    const sectionId = selectedServerSectionId;
    const filtered = (entries ?? []).filter((e) => {
      if (sectionId) {
        const sectionField = e.sectionId ?? (e.section ? Number((e.section as { id?: number }).id) : null);
        if (sectionField !== sectionId) return false;
      }
      const slot = slotMap.get(Number(e.timeSlotId));
      if (day !== "All days" && slot?.dayOfWeek !== day) return false;
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        const subj = subjectMap.get(Number(e.subjectId));
        const fac = facultyMap.get(Number(e.facultyId));
        const room = roomMap.get(Number(e.classroomId));
        const haystack = [subj?.name, subj?.code, fac?.name, room?.roomNumber].join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    return filtered.sort((a, b) => {
      const ta = slotMap.get(Number(a.timeSlotId))?.startTime ?? "";
      const tb = slotMap.get(Number(b.timeSlotId))?.startTime ?? "";
      return ta.localeCompare(tb);
    });
  }, [entries, selectedServerSectionId, day, query, slotMap, facultyMap, roomMap, subjectMap]);

  const health = useMemo(
    () => validateTimetable(workspaceId, section ? { sectionId: selectedServerSectionId ?? undefined } : undefined),
    [workspaceId, section, selectedServerSectionId],
  );

  const renderHeader = () => (
    <View>
      {/* Section picker */}
      <View className="mb-3">
        {sections && sections.length > 1 ? (
          <View className="flex-row flex-wrap gap-2 mb-4">
            {sections.slice(0, 12).map((s) => (
              <Pressable
                key={String(s.id)}
                onPress={() => setSelectedSectionId(Number(s.id))}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: Number(s.id) === Number(section?.id) ? colors.primary : colors.surface,
                  borderWidth: 1,
                  borderColor: Number(s.id) === Number(section?.id) ? colors.primary : colors.line,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: Number(s.id) === Number(section?.id) ? colors.white : colors.inkSecondary,
                  }}
                >
                  {s.name}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      {/* Day selector */}
      <View className="flex-row mb-3" style={{ gap: 6 }}>
        <DayChip label="All" active={day === "All days"} onPress={() => setDay("All days")} />
        {DAYS.slice(0, 5).map((d) => (
          <DayChip key={d} label={d.slice(0, 3)} active={day === d} onPress={() => setDay(d)} />
        ))}
      </View>

      <SearchInput value={query} onChangeText={setQuery} placeholder="Search subject, faculty, room…" containerStyle={{ marginBottom: 16 }} />

      {/* Health indicator */}
      {health.totalEntries > 0 ? (
        <Card className="mb-4" padded={false}>
          <View className="flex-row items-center gap-3 px-4 py-3">
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: health.healthy ? colors.successSoft : colors.dangerSoft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {health.healthy ? (
                <Text style={{ fontSize: 16, fontWeight: "800", color: colors.success }}>✓</Text>
              ) : (
                <AlertTriangle size={18} color={colors.danger} />
              )}
            </View>
            <View className="flex-1">
              <Text style={[typography.bodyMedium, { color: colors.ink }]}>
                {health.healthy ? "No conflicts detected" : `${health.conflicts.length} conflict(s) found`}
              </Text>
              <Text style={[typography.caption, { color: colors.inkSecondary }]}>
                Validated locally on this device
              </Text>
            </View>
          </View>
        </Card>
      ) : null}

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <Text style={[typography.label, { color: colors.inkMuted, letterSpacing: 0.6 }]}>
          {day === "All days" ? "WEEKLY SCHEDULE" : day.toUpperCase()}
        </Text>
        {section ? (
          <View className="flex-row items-center gap-1.5">
            <Users size={13} color={colors.inkMuted} />
            <Text style={{ fontSize: 12, fontWeight: "700", color: colors.inkSecondary }}>
              {section.name}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );

  return (
    <Screen padded={false}>
      <AppHeader title="Timetable" subtitle="Weekly schedules, day by day" right={<SyncStatus />} />
      <FlatList
        data={dayEntries}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={renderHeader()}
        contentContainerStyle={{ padding: 16, paddingBottom: 96 }}
        ListEmptyComponent={
          <EmptyState
            icon={<CalendarDays size={26} color={colors.primary} />}
            title={entries && entries.length > 0 ? "Nothing this day" : "No timetable yet"}
            message={
              entries && entries.length > 0
                ? "Try another day or search differently."
                : "Generate a timetable online, or wait for the workspace owner to do it."
            }
          />
        }
        renderItem={({ item }) => (
          <TimetableCard
            entry={item}
            slotLabel={slotLabel(item, slotMap)}
            facultyName={facultyMap.get(Number(item.facultyId))?.name ?? "—"}
            subjectName={subjectMap.get(Number(item.subjectId))?.name ?? "—"}
            subjectCode={subjectMap.get(Number(item.subjectId))?.code}
            room={roomMap.get(Number(item.classroomId))?.roomNumber ?? "—"}
          />
        )}
      />
    </Screen>
  );
}

function DayChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: active ? colors.primary : colors.surface,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.line,
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: "700", color: active ? colors.white : colors.inkSecondary }}>
        {label}
      </Text>
    </Pressable>
  );
}

function slotLabel(
  entry: TimetableEntry,
  slotMap: Map<number, { label?: string; startTime?: string; endTime?: string }>,
): string {
  const slot = slotMap.get(Number(entry.timeSlotId));
  if (!slot) return `Period ${entry.timeSlotId}`;
  return `${slot.startTime ?? ""} – ${slot.endTime ?? ""} · ${slot.label ?? ""}`.trim();
}

function TimetableCard({
  entry,
  slotLabel,
  facultyName,
  subjectName,
  subjectCode,
  room,
}: {
  entry: TimetableEntry;
  slotLabel: string;
  facultyName: string;
  subjectName: string;
  room: string;
  subjectCode?: string;
}) {
  return (
    <Card className="mb-2.5" padded={false}>
      <View className="px-4 py-3.5">
        <Text style={{ fontSize: 12, fontWeight: "700", color: colors.primary, marginBottom: 2 }}>
          {slotLabel}
        </Text>
        <Text style={[typography.h3, { color: colors.ink }]} numberOfLines={1}>
          {subjectName}
          {subjectCode ? ` (${subjectCode})` : ""}
        </Text>
        <View className="flex-row mt-1.5">
          <View className="flex-1">
            <Text style={[typography.caption, { color: colors.inkSecondary }]}>
              Faculty: <Text style={{ color: colors.ink }}>{facultyName}</Text>
            </Text>
            <Text style={[typography.caption, { color: colors.inkSecondary, marginTop: 1 }]}>
              Room: <Text style={{ color: colors.ink }}>{room}</Text>
            </Text>
          </View>
          {entry.section ? (
            <View style={{ alignItems: "flex-end" }}>
              <StatusBadge
                label={String((entry.section as { name?: string }).name ?? "—")}
                tone="neutral"
              />
            </View>
          ) : null}
        </View>
      </View>
    </Card>
  );
}
