import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import {
  Building2,
  GraduationCap,
  BookOpen,
  Layers,
  Clock,
  DoorOpen,
  ChevronRight,
} from "lucide-react-native";
import { Screen, AppHeader, Card, SectionHeader, SyncStatus } from "@/components";
import { useMasterDataCounts } from "@/hooks/use-local-data";
import { useSession } from "@/hooks/use-session";
import { colors, typography } from "@/constants/theme";
import { ENTITY_ORDER, ENTITY_SPECS } from "@/constants/entities";

/**
 * Master Data hub. Every row opens the entity's list screen, which reads from
 * local SQLite and supports offline edits (owner) or change requests (viewer).
 */
export default function DataScreen() {
  const counts = useMasterDataCounts();
  const { session } = useSession();
  const router = useRouter();

  const iconFor = (icon: string) => {
    switch (icon) {
      case "building": return <Building2 size={18} color={colors.primary} />;
      case "faculty": return <GraduationCap size={18} color={colors.accent} />;
      case "book": return <BookOpen size={18} color={colors.warning} />;
      case "layers": return <Layers size={18} color={colors.primary} />;
      case "door": return <DoorOpen size={18} color={colors.success} />;
      default: return <Clock size={18} color={colors.inkSecondary} />;
    }
  };

  const countFor = (entity: string): number => {
    switch (entity) {
      case "department": return counts.departments;
      case "faculty": return counts.faculty;
      case "subject": return counts.subjects;
      case "section": return counts.sections;
      case "classroom": return counts.classrooms;
      case "time_slot": return counts.timeSlots;
      default: return 0;
    }
  };

  const tintFor = (entity: string): string => {
    switch (entity) {
      case "department": return colors.primarySoft;
      case "faculty": return colors.accentSoft;
      case "subject": return colors.warningSoft;
      case "section": return colors.primarySoft;
      case "classroom": return colors.successSoft;
      default: return "#F1F5F9";
    }
  };

  return (
    <Screen padded>
      <AppHeader title="Data" subtitle="Master data stored on this device" right={<SyncStatus />} />

      <SectionHeader
        title="Entities"
        subtitle={`Workspace: ${session?.workspace?.name ?? "—"}`}
      />

      <View className="gap-3">
        {ENTITY_ORDER.map((entity) => {
          const spec = ENTITY_SPECS[entity]!;
          return (
            <Pressable key={entity} onPress={() => router.push(`/data/${entity}`)}>
              <Card padded={false}>
                <View className="flex-row items-center gap-3 px-4 py-4">
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 12,
                      backgroundColor: tintFor(entity),
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {iconFor(spec.icon)}
                  </View>
                  <Text style={[typography.bodyMedium, { color: colors.ink, flex: 1 }]}>
                    {spec.title}
                  </Text>
                  <View
                    style={{
                      minWidth: 28,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: colors.canvas,
                      alignItems: "center",
                      justifyContent: "center",
                      paddingHorizontal: 8,
                    }}
                  >
                    <Text style={[typography.captionMedium, { color: colors.inkSecondary }]}>
                      {countFor(entity)}
                    </Text>
                  </View>
                  <ChevronRight size={16} color={colors.inkMuted} />
                </View>
              </Card>
            </Pressable>
          );
        })}
      </View>

      <Card className="mt-6">
        <View className="flex-row items-center gap-3">
          <Text style={[typography.caption, { color: colors.inkSecondary, flex: 1 }]}>
            Records are read from the device's local SQLite database. Owners can edit
            offline; viewer changes are sent as requests for the owner's approval.
          </Text>
        </View>
      </Card>
    </Screen>
  );
}
