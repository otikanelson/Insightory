import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { Href, useRouter } from "expo-router";
import { useCallback } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedText } from "../../components/ThemedText";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { useAlerts } from "../../hooks/useAlerts";
import { useProducts } from "../../hooks/useProducts";

const CARD_COLORS = {
  inventory: { bg: "#E8F4FF", icon: "#3B82F6" },
  scan:      { bg: "#E8FFF4", icon: "#10B981" },
  add:       { bg: "#F3E8FF", icon: "#8B5CF6" },
  fefo:      { bg: "#FFF3E8", icon: "#F59E0B" },
};

const CARD_COLORS_DARK = {
  inventory: { bg: "#1A2744", icon: "#60A5FA" },
  scan:      { bg: "#0F2A1E", icon: "#34D399" },
  add:       { bg: "#1E1040", icon: "#A78BFA" },
  fefo:      { bg: "#2A1A08", icon: "#FBBF24" },
};

export default function DashboardScreen() {
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const { user, role, isAuthenticated, loading: authLoading } = useAuth();
  const insets = useSafeAreaInsets();

  const { inventoryStats, loading: productsLoading, refresh: refreshProducts } = useProducts();
  const { summary, loading: alertsLoading, refresh: refreshAlerts } = useAlerts();

  const isLoading = productsLoading || alertsLoading;

  useFocusEffect(
    useCallback(() => {
      // Only fetch data if user is authenticated
      if (isAuthenticated) {
        refreshProducts();
        refreshAlerts();
      }
    }, [refreshProducts, refreshAlerts, isAuthenticated])
  );

  const onRefresh = useCallback(async () => {
    if (isAuthenticated) {
      await Promise.all([refreshProducts(), refreshAlerts()]);
    }
  }, [refreshProducts, refreshAlerts, isAuthenticated]);

  const cards = isDark ? CARD_COLORS_DARK : CARD_COLORS;
  const urgentAlerts = (summary?.expired ?? 0) + (summary?.critical ?? 0);
  const totalAlerts = summary?.total ?? 0;

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  const firstName = user?.name?.split(" ")[0] ?? "there";

  // Show loading state if authentication is still loading
  if (authLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }}>
        <ThemedText style={{ color: theme.subtext }}>Loading...</ThemedText>
      </View>
    );
  }

  // Show loading state if not authenticated yet
  if (!isAuthenticated) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }}>
        <ThemedText style={{ color: theme.subtext }}>Please log in to continue</ThemedText>
      </View>
    );
  }

  const operationCards = [
    {
      key: "inventory",
      label: "Inventory",
      subtitle: `${inventoryStats?.totalSkus ?? 0} SKUs`,
      icon: "cube-outline" as const,
      href: "/(tabs)/inventory" as Href,
      colors: cards.inventory,
    },
    {
      key: "scan",
      label: "Scanner",
      subtitle: "Scan & register",
      icon: "scan-outline" as const,
      href: "/(tabs)/scan" as Href,
      colors: cards.scan,
    },
    {
      key: "add",
      label: "Add Stock",
      subtitle: "New batch entry",
      icon: "add-circle-outline" as const,
      href: "/(tabs)/add-products" as Href,
      colors: cards.add,
    },
    {
      key: "fefo",
      label: "FEFO Queue",
      subtitle: "Expiry priority",
      icon: "hourglass-outline" as const,
      href: "/(tabs)/FEFO" as Href,
      colors: cards.fefo,
    },
  ];

  const quickRows = [
    {
      key: "alerts",
      label: "Alerts",
      desc: totalAlerts > 0
        ? `${totalAlerts} active${urgentAlerts > 0 ? ` - ${urgentAlerts} urgent` : ""}`
        : "No active alerts",
      icon: "notifications-outline" as const,
      iconBg: urgentAlerts > 0 ? "#FF4444" : theme.primary,
      badge: urgentAlerts > 0 ? urgentAlerts : undefined,
      href: "/alerts" as Href,
    },
    {
      key: "lowstock",
      label: "Low Stock",
      desc: `${inventoryStats?.lowStockCount ?? 0} items below threshold`,
      icon: "warning-outline" as const,
      iconBg: (inventoryStats?.lowStockCount ?? 0) > 0 ? "#F59E0B" : theme.primary,
      badge: (inventoryStats?.lowStockCount ?? 0) > 0 ? inventoryStats?.lowStockCount : undefined,
      href: "/(tabs)/inventory" as Href,
    },
    {
      key: "profile",
      label: "Profile",
      desc: role === "admin" ? "Administrator" : "Staff Member",
      icon: "person-outline" as const,
      iconBg: theme.primary,
      badge: undefined,
      href: "/profile" as Href,
    },
    {
      key: "settings",
      label: "Settings",
      desc: "App preferences",
      icon: "settings-outline" as const,
      iconBg: theme.primary,
      badge: undefined,
      href: "/settings" as Href,
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 20, paddingBottom: 100 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
      >
        <View style={styles.header}>
          <View>
            <ThemedText style={[styles.greeting, { color: theme.subtext }]}>
              {getGreeting()},
            </ThemedText>
            <ThemedText style={[styles.name, { color: theme.text }]}>
              {firstName}
            </ThemedText>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => router.push("/settings")}
              style={[styles.settingsBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <Ionicons name="settings-outline" size={20} color={theme.text} />
            </Pressable>
            <Pressable
              onPress={() => router.push("/profile")}
              style={[styles.avatar, { backgroundColor: theme.primaryLight }]}
            >
              <ThemedText style={[styles.avatarLetter, { color: theme.primary }]}>
                {firstName[0]?.toUpperCase() ?? "U"}
              </ThemedText>
            </Pressable>
          </View>
        </View>

        <View style={[styles.statsStrip, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <StatPill label="SKUs" value={inventoryStats?.totalSkus ?? 0} icon="layers-outline" theme={theme} />
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <StatPill label="Units" value={inventoryStats?.totalUnits ?? 0} icon="cube-outline" theme={theme} />
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <StatPill label="Expiring" value={inventoryStats?.expiringSoonCount ?? 0} icon="time-outline" theme={theme} highlight={(inventoryStats?.expiringSoonCount ?? 0) > 0} />
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <StatPill label="Out of Stock" value={inventoryStats?.outOfStockCount ?? 0} icon="close-circle-outline" theme={theme} highlight={(inventoryStats?.outOfStockCount ?? 0) > 0} />
        </View>

        <ThemedText style={[styles.sectionLabel, { color: theme.subtext }]}>
          OPERATIONS
        </ThemedText>

        <View style={styles.cardGrid}>
          {operationCards.map((card) => (
            <Pressable
              key={card.key}
              style={[styles.opCard, { backgroundColor: card.colors.bg }]}
              onPress={() => router.push(card.href)}
            >
              <View style={[styles.opIconBox, { backgroundColor: card.colors.icon + "22" }]}>
                <Ionicons name={card.icon} size={28} color={card.colors.icon} />
              </View>
              <ThemedText style={[styles.opLabel, { color: isDark ? "#F0F2FF" : "#0D0F1A" }]}>
                {card.label}
              </ThemedText>
              <ThemedText style={[styles.opSubtitle, { color: isDark ? "#8892B0" : "#6B7280" }]}>
                {card.subtitle}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        <ThemedText style={[styles.sectionLabel, { color: theme.subtext }]}>
          QUICK ACCESS
        </ThemedText>

        <View style={[styles.listCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {quickRows.map((row, idx) => (
            <Pressable
              key={row.key}
              style={[
                styles.listRow,
                idx < quickRows.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border },
              ]}
              onPress={() => router.push(row.href)}
            >
              <View style={[styles.rowIconBox, { backgroundColor: row.iconBg + "18" }]}>
                <Ionicons name={row.icon} size={20} color={row.iconBg} />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={[styles.rowLabel, { color: theme.text }]}>{row.label}</ThemedText>
                <ThemedText style={[styles.rowDesc, { color: theme.subtext }]}>{row.desc}</ThemedText>
              </View>
              {row.badge ? (
                <View style={[styles.badge, { backgroundColor: row.iconBg }]}>
                  <ThemedText style={styles.badgeText}>{row.badge}</ThemedText>
                </View>
              ) : (
                <Ionicons name="chevron-forward" size={18} color={theme.subtext} />
              )}
            </Pressable>
          ))}
        </View>

        {role === "admin" && (
          <>
            <ThemedText style={[styles.sectionLabel, { color: theme.subtext }]}>
              ADMIN
            </ThemedText>
            <View style={[styles.listCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              {([
                { key: "sales", label: "Sales", desc: "Process & review transactions", icon: "receipt-outline" as const, href: "/admin/sales" as Href },
                { key: "stats", label: "AI Insights", desc: "Analytics & predictions", icon: "analytics-outline" as const, href: "/admin/stats" as Href },
                { key: "adminsettings", label: "Admin Settings", desc: "Store, staff & security", icon: "shield-checkmark-outline" as const, href: "/admin/settings" as Href },
              ]).map((row, idx, arr) => (
                <Pressable
                  key={row.key}
                  style={[
                    styles.listRow,
                    idx < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border },
                  ]}
                  onPress={() => router.push(row.href)}
                >
                  <View style={[styles.rowIconBox, { backgroundColor: theme.primaryLight }]}>
                    <Ionicons name={row.icon} size={20} color={theme.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={[styles.rowLabel, { color: theme.text }]}>{row.label}</ThemedText>
                    <ThemedText style={[styles.rowDesc, { color: theme.subtext }]}>{row.desc}</ThemedText>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={theme.subtext} />
                </Pressable>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

interface StatPillProps {
  label: string;
  value: number;
  icon: keyof typeof Ionicons.glyphMap;
  theme: any;
  highlight?: boolean;
}

function StatPill({ label, value, icon, theme, highlight }: StatPillProps) {
  return (
    <View style={styles.statPill}>
      <Ionicons name={icon} size={14} color={highlight ? "#F59E0B" : theme.subtext} />
      <ThemedText style={[styles.statValue, { color: highlight ? "#F59E0B" : theme.text }]}>
        {value}
      </ThemedText>
      <ThemedText style={[styles.statLabel, { color: theme.subtext }]}>{label}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  greeting: { fontSize: 14, marginBottom: 2 },
  name: { fontSize: 28, letterSpacing: -0.5 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  settingsBtn: { width: 42, height: 42, borderRadius: 12, borderWidth: 1, justifyContent: "center", alignItems: "center" },
  avatar: { width: 46, height: 46, borderRadius: 23, justifyContent: "center", alignItems: "center" },
  avatarLetter: { fontSize: 18 },
  statsStrip: { flexDirection: "row", borderRadius: 18, borderWidth: 1, paddingVertical: 14, paddingHorizontal: 8, marginBottom: 28, alignItems: "center" },
  statPill: { flex: 1, alignItems: "center", gap: 3 },
  statValue: { fontSize: 18 },
  statLabel: { fontSize: 9, textAlign: "center" },
  statDivider: { width: 1, height: 36, borderRadius: 1 },
  sectionLabel: { fontSize: 11, letterSpacing: 1.8, marginBottom: 12 },
  cardGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 28 },
  opCard: { width: "47.5%", borderRadius: 20, padding: 18, minHeight: 130, justifyContent: "flex-end" },
  opIconBox: { width: 52, height: 52, borderRadius: 14, justifyContent: "center", alignItems: "center", marginBottom: 14 },
  opLabel: { fontSize: 16, marginBottom: 4 },
  opSubtitle: { fontSize: 12 },
  listCard: { borderRadius: 20, borderWidth: 1, overflow: "hidden", marginBottom: 28 },
  listRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 14 },
  rowIconBox: { width: 42, height: 42, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  rowLabel: { fontSize: 15, marginBottom: 2 },
  rowDesc: { fontSize: 12 },
  badge: { minWidth: 22, height: 22, borderRadius: 11, justifyContent: "center", alignItems: "center", paddingHorizontal: 6 },
  badgeText: { color: "#FFF", fontSize: 11 },
});