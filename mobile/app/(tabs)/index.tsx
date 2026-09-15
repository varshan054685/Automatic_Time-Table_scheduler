import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import {
  CalendarDays,
  ClipboardList,
  Database,
  GraduationCap,
  Building2,
  Wand2,
  AlertTriangle,
} from "lucide-react-native";
import { Screen, AppHeader, Card, Button, SyncStatus, StatusBadge } from "@/components";
import { useSession } from "@/hooks/use-session";
import { useDbStats, useConflictCount } from "@/hooks/use-local-data";
import { colors, typography } from "@/constants/theme";

import { useEffect } from "react";

export default function HomeScreen() {
  const router = useRouter();
  const { session, isOwner } = useSession();
  const { data: stats } = useDbStats();
  const { data: conflictCount = 0 } = useConflictCount();

  // Signed in but no workspace yet — take the user to workspace setup.
  useEffect(() => {
    if (session && (!session.workspace || !session.workspace.id)) {
      router.replace("/workspace-setup");
    }
  }, [session, router]);

  const firstName = session?.user?.name?.split(" ")[0] ?? "there";
  const workspaceName = session?.workspace?.name;

  return (
    <Screen scroll padded>
      <AppHeader title="Home" subtitle="Your workspace at a glance" right={<SyncStatus />} />

      {/* Greeting */}
      <View className="mb-4">
        <Text style={[typography.h2, { color: colors.ink, letterSpacing: -0.4 }]}>
          Good day, {firstName}
        </Text>
        <Text style={[typography.caption, { color: colors.inkSecondary, marginTop: 2 }]}>
          Here's what's happening in your timetable workspace.
        </Text>
      </View>

      {/* Workspace card */}
      {workspaceName ? (
        <Card className="mb-4">
          <View className="flex-row items-center gap-3">
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                backgroundColor: colors.primarySoft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Building2 size={20} color={colors.primary} />
            </View>
            <View className="flex-1">
              <Text style={[typography.h3, { color: colors.ink }]} numberOfLines={1}>
                {workspaceName}
              </Text>
              <View className="flex-row items-center gap-2 mt-1">
                <StatusBadge
                  label={isOwner ? "Owner" : "Viewer"}
                  tone={isOwner ? "info" : "neutral"}
                />
                {session?.workspace?.academicYear ? (
                  <Text style={{ fontSize: 11, fontWeight: "600", color: colors.inkMuted }}>
                    {session.workspace.academicYear}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>
        </Card>
      ) : null}

      {/* Offline availability */}
      <Card className="mb-6">
        <View className="flex-row items-center gap-3">
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: colors.successSoft,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <GraduationCap size={20} color={colors.success} />
          </View>
          <View className="flex-1">
            <Text style={[typography.bodyMedium, { color: colors.ink }]}>Offline access available</Text>
            <Text style={[typography.caption, { color: colors.inkSecondary, marginTop: 1 }]}>
              Your synchronized data works without an internet connection.
            </Text>
          </View>
        </View>
      </Card>

      {/* Quick actions */}
      <Text style={[typography.label, { color: colors.inkMuted, letterSpacing: 0.6, marginBottom: 10 }]}>
        QUICK ACTIONS
      </Text>
      <View className="flex-row flex-wrap gap-3 mb-4">
        <QuickAction
          icon={<CalendarDays size={20} color={colors.primary} />}
          label="Timetable"
          onPress={() => router.push("/(tabs)/timetable")}
        />
        <QuickAction
          icon={<ClipboardList size={20} color={colors.accent} />}
          label="Requests"
          onPress={() => router.push("/(tabs)/requests")}
        />
        {isOwner ? (
          <QuickAction
            icon={<Wand2 size={20} color={colors.warning} />}
            label="Generate"
            onPress={() => router.push("/generate")}
          />
        ) : null}
        <QuickAction
          icon={<Database size={20} color={colors.inkSecondary} />}
          label="Master data"
          onPress={() => router.push("/(tabs)/data")}
        />
      </View>

      {/* Conflicts banner */}
      {conflictCount > 0 ? (
        <Pressable
          onPress={() => router.push("/conflicts")}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            backgroundColor: colors.dangerSoft,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.danger,
            padding: 12,
            marginBottom: 16,
          }}
        >
          <AlertTriangle size={18} color={colors.danger} />
          <Text style={[typography.captionMedium, { color: colors.danger, flex: 1 }]}>
            {conflictCount} change{conflictCount > 1 ? "s" : ""} need a sync decision
          </Text>
        </Pressable>
      ) : null}

      {/* Local database summary */}
      <Card padded>
        <Text style={[typography.label, { color: colors.inkMuted, letterSpacing: 0.6, marginBottom: 10 }]}>
          LOCAL DATABASE
        </Text>
        <View className="flex-row justify-between">
          <DbStat label="Departments" value={stats?.departmentCount ?? 0} />
          <DbStat label="Faculty" value={stats?.facultyCount ?? 0} />
          <DbStat label="Subjects" value={stats?.subjectCount ?? 0} />
          <DbStat label="Sections" value={stats?.sectionCount ?? 0} />
        </View>
        <View className="flex-row justify-between mt-3">
          <DbStat label="Rooms" value={stats?.classroomCount ?? 0} />
          <DbStat label="Time slots" value={stats?.timeSlotCount ?? 0} />
          <DbStat label="Entries" value={stats?.timetableEntryCount ?? 0} />
          <DbStat label="Pending" value={stats?.pendingOpCount ?? 0} />
        </View>
      </Card>

      <View className="mt-8">
        <Button
          label="Open timetable"
          onPress={() => router.push("/(tabs)/timetable")}
          variant="secondary"
          fullWidth
        />
      </View>
    </Screen>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        backgroundColor: colors.surface,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.line,
        paddingHorizontal: 14,
        paddingVertical: 12,
      }}
    >
      {icon}
      <Text style={[typography.bodyMedium, { color: colors.ink }]}>{label}</Text>
    </Pressable>
  );
}

function DbStat({ label, value }: { label: string; value: number }) {
  return (
    <View className="items-center">
      <Text style={[typography.h3, { color: colors.ink }]}>{value}</Text>
      <Text style={{ fontSize: 10, fontWeight: "700", color: colors.inkMuted, marginTop: 2 }}>
        {label}
      </Text>
    </View>
  );
}
