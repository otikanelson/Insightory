import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { AIStatusIndicator } from "../../components/AIStatusIndicator";
import { HelpTooltip } from "../../components/HelpTooltip";
import { ThemedText } from '../../components/ThemedText';
import { margin } from "../../constants/spacing";
import { useAdminTour } from "../../context/AdminTourContext";
import { useTheme } from "../../context/ThemeContext";

export default function AdminSettingsScreen() {
  const { theme, isDark, toggleTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { resetTour, startTour } = useAdminTour();

  const SettingRow = ({ icon, label, description, onPress, children }: any) => {
    const row = (
      <View style={[styles.settingRow, { borderBottomColor: theme.border }]}>
        <View style={styles.settingMain}>
          <View style={[styles.iconBox, { backgroundColor: theme.primary + "15" }]}>
            <Ionicons name={icon} size={20} color={theme.primary} />
          </View>
          <View style={styles.textStack}>
            <ThemedText style={[styles.settingLabel, { color: theme.text }]}>
              {label}
            </ThemedText>
            {description && (
              <ThemedText style={[styles.settingDesc, { color: theme.subtext }]}>
                {description}
              </ThemedText>
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


        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
          <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View>
                <ThemedText style={[styles.headerSub, { color: theme.primary }]}>
                  ADMIN_PANEL
                </ThemedText>
                <ThemedText style={[styles.headerTitle, { color: theme.text }]}>
                  SETTINGS
                </ThemedText>
              </View>
              <HelpTooltip
                style={{ marginTop: 20 }}
                title="Admin Settings"
                content={[
                  "Manage all admin settings from one place. Select a category to configure specific settings.",
                  "Security: Manage PINs, auto-logout, and access controls",
                  "Alerts & Categories: Add categories and Configure expiry alert levels and category alerts",
                  "Store: Update business information and details",
                  "Data: Manage profile, preferences, and data export"
                ]}
                icon="help-circle"
                iconSize={18}
                iconColor={theme.primary}
              />
            </View>
          </View>


          {/* APPEARANCE SECTION */}
          <View style={styles.section}>
            <ThemedText style={[styles.sectionTitle, { color: theme.primary }]}>
              APPEARANCE
            </ThemedText>
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

          {/* SETTINGS CATEGORIES */}
          <View style={styles.section}>
            <ThemedText style={[styles.sectionTitle, { color: theme.primary }]}>
              SETTINGS CATEGORIES
            </ThemedText>

            <SettingRow
              icon="person-circle"
              label="Profile"
              description="Personal information and account details"
              onPress={() => router.push('/admin/settings/profile')}
            >
              <Ionicons name="chevron-forward" size={20} color={theme.subtext} />
            </SettingRow>

            <SettingRow
              icon="shield-checkmark"
              label="Security"
              description="PIN management and access controls"
              onPress={() => router.push('/admin/settings/security')}
            >
              <Ionicons name="chevron-forward" size={20} color={theme.subtext} />
            </SettingRow>

            <SettingRow
              icon="notifications"
              label="Alerts & Categories"
              description="Add categories and Configure expiry alert levels"
              onPress={() => router.push('/admin/settings/alerts')}
            >
              <Ionicons name="chevron-forward" size={20} color={theme.subtext} />
            </SettingRow>

            <SettingRow
              icon="storefront"
              label="Store"
              description="Business information and details"
              onPress={() => router.push('/admin/settings/store')}
            >
              <Ionicons name="chevron-forward" size={20} color={theme.subtext} />
            </SettingRow>

            <SettingRow
              icon="cloud-download"
              label="Data"
              description="Backup and data export"
              onPress={() => router.push('/admin/settings/data')}
            >
              <Ionicons name="chevron-forward" size={20} color={theme.subtext} />
            </SettingRow>
          </View>

          {/* HELP & SUPPORT SECTION */}
          <View style={styles.section}>
            <ThemedText style={[styles.sectionTitle, { color: theme.primary }]}>
              HELP & SUPPORT
            </ThemedText>

            {/* AI Status Indicator */}
            <AIStatusIndicator onPress={() => router.push("/ai-info" as any)} />

            <SettingRow
              icon="help-circle-outline"
              label="Restart Admin Tour"
              description="View admin onboarding tour again"
              onPress={async () => {
                try {
                  resetTour();
                  Toast.show({
                    type: 'success',
                    text1: 'Tour Reset',
                    text2: 'Go to Admin Dashboard to see the tour again'
                  });
                  // Navigate to admin dashboard and start tour
                  router.push('../admin');
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

          <View style={{ height: 10 }} />

          <ThemedText style={styles.versionText}>
            Build v2.0.5 - Production Environment
          </ThemedText>

        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  header: { marginBottom: margin.section },
  headerSub: { fontSize: 11, letterSpacing: 2, opacity: 0.7 },
  headerTitle: { fontSize: 32, letterSpacing: -0.5, marginTop: 4 },
  section: { marginBottom: margin.section },
  sectionTitle: {
    fontSize: 11,
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
  settingLabel: { fontSize: 17, marginBottom: 2 },
  settingDesc: { fontSize: 13, marginTop: 2, opacity: 0.7 },
  versionText: {
    textAlign: "center",
    color: "#888",
    fontSize: 11,
    marginBottom: 10,
    letterSpacing: 1,
    opacity: 0.5,
  },
});

