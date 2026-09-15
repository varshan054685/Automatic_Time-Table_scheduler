import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Cloud, Activity, AlertTriangle, CheckCircle2 } from "lucide-react-native";
import {
  Screen,
  AppHeader,
  Card,
  Button,
  SyncStatus,
  EmptyState,
} from "@/components";
import { colors, typography } from "@/constants/theme";
import { useSession } from "@/hooks/use-session";
import { useDepartments, useSections } from "@/hooks/use-local-data";
import { startGeneration, pollGenerationUntilDone, GenerationJobInfo } from "@/services/generation";
import { validateTimetable } from "@/services/timetable-validation";
import { useSyncEngine } from "@/hooks/use-sync";
import { useQueryClient } from "@tanstack/react-query";

export default function GenerateScreen() {
  const router = useRouter();
  const { session, isOwner } = useSession();
  const { data: departments } = useDepartments();
  const { data: sections } = useSections();
  const { sync } = useSyncEngine();
  const queryClient = useQueryClient();

  const [departmentId, setDepartmentId] = useState<number | null>(null);
  const [semester, setSemester] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [job, setJob] = useState<GenerationJobInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const workspaceId = session?.workspace?.id ?? 0;
  const health = validateTimetable(workspaceId);

  const handleGenerate = async () => {
    if (!departmentId) {
      setError("Select a department first.");
      return;
    }
    setRunning(true);
    setError(null);
    setJob(null);
    try {
      const { jobId } = await startGeneration({ departmentId, semester: semester ?? undefined });
      const final = await pollGenerationUntilDone(jobId, (j) => setJob(j));
      setJob(final);
      if (final.status === "completed" || final.status === "partial") {
        await sync();
        await queryClient.invalidateQueries({ queryKey: ["local"] });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <Screen padded>
      <AppHeader
        title="Generate timetable"
        subtitle="Cloud solver (OR-Tools) optimizes the schedule"
        right={<SyncStatus />}
      />

      <ScrollView showsVerticalScrollIndicator={false}>
        {!isOwner ? (
          <Card className="mb-4">
            <View className="flex-row items-center gap-3">
              <Cloud size={18} color={colors.inkMuted} />
              <Text style={[typography.caption, { color: colors.inkSecondary, flex: 1 }]}>
                Only workspace owners can generate timetables.
              </Text>
            </View>
          </Card>
        ) : null}

        {/* Department picker */}
        <Text style={[typography.label, { color: colors.inkMuted, letterSpacing: 0.6, marginBottom: 8 }]}>
          DEPARTMENT
        </Text>
        <View className="flex-row flex-wrap gap-2 mb-4">
          {departments?.map((d) => (
            <Pressable
              key={String(d.id)}
              onPress={() => setDepartmentId(Number((d as { serverId?: number }).serverId ?? d.id))}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: departmentId === Number((d as { serverId?: number }).serverId ?? d.id) ? colors.primary : colors.surface,
                borderWidth: 1,
                borderColor: departmentId === Number((d as { serverId?: number }).serverId ?? d.id) ? colors.primary : colors.line,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "700", color: departmentId === Number((d as { serverId?: number }).serverId ?? d.id) ? colors.white : colors.inkSecondary }}>
                {(d as { name?: string }).name}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={[typography.label, { color: colors.inkMuted, letterSpacing: 0.6, marginBottom: 8 }]}>
          SEMESTER {semester ? `— ${semester}` : "(all semesters)"}
        </Text>
        <View className="flex-row flex-wrap gap-2 mb-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
            <Pressable
              key={s}
              onPress={() => setSemester(semester === s ? null : s)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: semester === s ? colors.primary : colors.surface,
                borderWidth: 1,
                borderColor: semester === s ? colors.primary : colors.line,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "700", color: semester === s ? colors.white : colors.inkSecondary }}>
                {s}
              </Text>
            </Pressable>
          ))}
        </View>

        {isOwner ? (
          <Button
            label={running ? "Generating…" : "Generate timetable"}
            onPress={() => void handleGenerate()}
            loading={running}
            disabled={running}
            fullWidth
          />
        ) : null}

        {error ? (
          <Text style={[typography.caption, { color: colors.danger, marginTop: 8 }]}>{error}</Text>
        ) : null}

        {/* Job status */}
        {job ? (
          <Card className="mt-5">
            <View className="flex-row items-center gap-3 mb-2">
              {job.status === "completed" ? (
                <CheckCircle2 size={20} color={colors.success} />
              ) : job.status === "failed" || job.status === "partial" ? (
                <AlertTriangle size={20} color={colors.warning} />
              ) : (
                <Activity size={20} color={colors.primary} />
              )}
              <Text style={[typography.h3, { color: colors.ink, textTransform: "capitalize" }]}>
                {job.status}
              </Text>
            </View>
            <Text style={[typography.caption, { color: colors.inkSecondary }]}>
              {job.completedSections}/{job.totalSections} sections completed
              {job.failedSections ? ` · ${job.failedSections} failed` : ""}
            </Text>
            {job.error ? (
              <Text style={[typography.caption, { color: colors.danger, marginTop: 4 }]}>{job.error}</Text>
            ) : null}
          </Card>
        ) : null}

        {/* Offline validation status */}
        <Card className="mt-5">
          <View className="flex-row items-center gap-3 mb-2">
            <AlertTriangle size={18} color={health.healthy ? colors.success : colors.warning} />
            <Text style={[typography.h3, { color: colors.ink }]}>Offline validation</Text>
          </View>
          <Text style={[typography.caption, { color: colors.inkSecondary }]}>
            {health.healthy
              ? "No conflicts detected in the locally stored timetable."
              : `${health.conflicts.length} conflict(s) detected in the locally stored timetable.`}
          </Text>
          <View className="mt-3">
            <Button
              label="View conflicts"
              variant="outline"
              onPress={() => router.push("/(tabs)/timetable")}
            />
          </View>
        </Card>

        {sections && sections.length === 0 ? (
          <View className="mt-6">
            <EmptyState
              title="No sections yet"
              message="Add sections and other master data before generating."
            />
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
