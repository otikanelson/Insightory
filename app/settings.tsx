import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    View
} from "react-native";
import Toast from "react-native-toast-message";
import { AIStatusIndicator } from "../components/AIStatusIndicator";
import { margin } from "../constants/spacing";
import { useTheme } from "../context/ThemeContext";
import { useTour } from "../context/TourContext";

export default function SettingsScreen() {
  const { theme, isDark, toggleTheme } = useTheme();
    const router = useRouter();
  const { resetTour, startTour } = useTour();

  const SettingRow = ({ icon, label, children, description, onPress, style }: any) => {
    const row = (
      <View style={[styles.settingRow, { borderBottomColor: theme.border }, style]}>
        <View style={styles.settingMain}>
          <View
            style={[styles.iconBox, { backgroundColor: theme.primary + "15" }]}
          >
            <Ionicons name={icon} size={20} color={theme.primary} />
          </View>
          <View style={styles.textStack}>
            <Text style={[styles.settingLabel, { color: theme.text }]}>
              {label}
            </Text>
            {description && (
              <Text style={[styles.settingDesc, { color: theme.subtext }]}>
                {description}
              </Text>
            )}
          </View>
        </View>
        {children}
      </View>
    );

    if (onPress) {
      return (
        <Pressable onPress={onPress} android_ripple={{ color: theme.primary + "25" }}>
          {row}
        </Pressable>
      );
    }

    return row;
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flex: 1, backgroundColor: theme.background }}>
      

      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={[styles.headerSub, { color: theme.primary }]}>
            SYSTEM_CONFIGURATION
          </Text>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            SETTINGS
          </Text>
        </View>

      {/* APPEARANCE SECTION */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.primary }]}>
          APPEARANCE
        </Text>
        <SettingRow
          icon="moon-outline"
          label="Dark Mode"
          description="Toggle light/dark theme"
        >
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ true: theme.primary }}
          />
        </SettingRow>
      </View>

      {/* ADMINISTRATION SECTION */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.primary }]}>
          ADMINISTRATION
        </Text>
        <SettingRow
          icon="person-circle-outline"
          label="My Profile"
          description="View account details"
          onPress={() => router.push('/profile' as any)}
          style={{ marginBottom: 16 }}
        >
          <Ionicons name="chevron-forward" size={20} color={theme.subtext} />
        </SettingRow>
      </View>

      {/* HELP & SUPPORT SECTION */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.primary }]}>
          HELP & SUPPORT
        </Text>
        
        {/* AI Status Indicator */}
        <AIStatusIndicator onPress={() => router.push("/ai-info" as any)} />
        

        
        <SettingRow
          icon="help-circle-outline"
          label="Restart App Tour"
          description="View onboarding tour again"
          onPress={async () => {
            try {
              resetTour();
              Toast.show({
                type: 'success',
                text1: 'Tour Reset',
                text2: 'Go to Dashboard to see the tour again'
              });
              // Navigate to dashboard and start tour
              router.push('/');
              setTimeout(() => {
                startTour();
              }, 500);
            } catch (error) {
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Could not reset tour'
              });
            }
          }}
        >
          <Ionicons name="chevron-forward" size={20} color={theme.subtext} />
        </SettingRow>
      </View>

      {/* DANGER ZONE */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: '#FF3B30' }]}>
          DANGER ZONE
        </Text>
        <SettingRow
          icon="trash-outline"
          label="Delete Account"
          description="Permanently delete your account and data"
          onPress={() => router.push('/profile?showDeleteModal=true' as any)}
          style={{ borderBottomWidth: 0 }}
        >
          <Ionicons name="chevron-forward" size={20} color="#FF3B30" />
        </SettingRow>
      </View>

      <View style={{ height: 10 }} />

        <Text style={styles.versionText}>
          Build v2.0.5 - Production Environment
        </Text>
      </ScrollView>
    </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  header: { marginTop: 70, marginBottom: margin.section },
  headerSub: { fontSize: 11, fontWeight: "900", letterSpacing: 2, opacity: 0.7 },
  headerTitle: { fontSize: 32, fontWeight: "900", letterSpacing: -0.5, marginTop: 4 },
  section: { marginBottom: margin.section },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2,
    marginBottom: 16,
    opacity: 0.6,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 18,
    borderBottomWidth: 1,
  },
  settingMain: { flexDirection: "row", alignItems: "center", flex: 1 },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  textStack: { flex: 1 },
  settingLabel: { fontSize: 17, fontWeight: "700", marginBottom: 2 },
  settingDesc: { fontSize: 13, marginTop: 2, opacity: 0.7 },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  adminBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  versionText: {
    textAlign: "center",
    color: "#888",
    fontSize: 11,
    marginBottom: 100,
    letterSpacing: 1,
    opacity: 0.5,
  },
});
