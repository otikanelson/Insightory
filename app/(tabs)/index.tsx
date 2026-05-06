import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import axios from "axios";
import { Href, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  ImageBackground,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedText } from "../../components/ThemedText";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { useAIPredictions } from "../../hooks/useAIPredictions";
import { useAlerts } from "../../hooks/useAlerts";
import { useAnalytics } from "../../hooks/useAnalytics";
import { useProducts } from "../../hooks/useProducts";

interface SalesStats {
  today: number;
  week: number;
  totalSales: number;
}

interface SaleRecord {
  _id: string;
  productName: string;
  quantitySold: number;
  totalAmount: number;
  saleDate: string;
  soldBy?: {
    userId: string;
    role: 'admin' | 'staff';
  };
}

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
  const { dashboardData, loading: analyticsLoading, refresh: refreshAnalytics } = useAnalytics();
  const { quickInsights, loading: aiLoading } = useAIPredictions({ enableWebSocket: true, autoFetch: true });

  // Sales permission check
  const salesAccess = useFeatureAccess('processSales');

  const isLoading = productsLoading || alertsLoading || analyticsLoading;

  // AI Insights dropdown state - default to collapsed if no data
  const hasAIData = dashboardData?.summary || quickInsights;
  const [aiInsightsExpanded, setAiInsightsExpanded] = useState(false);

  // Sales section state
  const [salesExpanded, setSalesExpanded] = useState(false);
  const [salesStats, setSalesStats] = useState<SalesStats>({ today: 0, week: 0, totalSales: 0 });
  const [recentSales, setRecentSales] = useState<SaleRecord[]>([]);
  const [loadingSales, setLoadingSales] = useState(false);

  const fetchSalesData = useCallback(async () => {
    if (!salesExpanded || !salesAccess.isAllowed) return;
    setLoadingSales(true);
    try {
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/analytics/all-sales?limit=5&days=30`
      );
      if (response.data.success) {
        const salesData: SaleRecord[] = response.data.data?.sales || response.data.data || [];
        setRecentSales(salesData.slice(0, 5));
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        setSalesStats({
          today: salesData.filter(s => new Date(s.saleDate) >= todayStart).reduce((sum, s) => sum + (s.totalAmount || 0), 0),
          week: salesData.filter(s => new Date(s.saleDate) >= weekStart).reduce((sum, s) => sum + (s.totalAmount || 0), 0),
          totalSales: salesData.length,
        });
      }
    } catch (error) {
      console.error('Error fetching sales data:', error);
    } finally {
      setLoadingSales(false);
    }
  }, [salesExpanded, salesAccess.isAllowed]);

  useEffect(() => {
    fetchSalesData();
  }, [fetchSalesData]);

  const formatSaleDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffDays = Math.floor(Math.abs(now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 0) return "Today";
      if (diffDays === 1) return "Yesterday";
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString();
    } catch {
      return "Recently";
    }
  };

  useFocusEffect(
    useCallback(() => {
      // Only fetch data if user is authenticated
      if (isAuthenticated) {
        refreshProducts();
        refreshAlerts();
        refreshAnalytics();
      }
    }, [refreshProducts, refreshAlerts, refreshAnalytics, isAuthenticated])
  );

  const onRefresh = useCallback(async () => {
    if (isAuthenticated) {
      await Promise.all([refreshProducts(), refreshAlerts(), refreshAnalytics()]);
    }
  }, [refreshProducts, refreshAlerts, refreshAnalytics, isAuthenticated]);

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
      // Warehouse shelves with organized stock
      image: "https://images.unsplash.com/photo-1553413077-190dd305871c?w=400&q=80",
    },
    {
      key: "scan",
      label: "Scanner",
      subtitle: "Scan & register",
      icon: "scan-outline" as const,
      href: "/(tabs)/scan" as Href,
      colors: cards.scan,
      // Barcode scanning / logistics
      image: "https://plus.unsplash.com/premium_photo-1661933130869-eba2d7e28332?q=80&w=870&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    },
    {
      key: "add",
      label: "Add Stock",
      subtitle: "New batch entry",
      icon: "add-circle-outline" as const,
      href: "/(tabs)/add-products" as Href,
      colors: cards.add,
      // Stacking / adding boxes to shelves
      image: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=400&q=80",
    },
    {
      key: "fefo",
      label: "FEFO Queue",
      subtitle: "Expiry priority",
      icon: "hourglass-outline" as const,
      href: "/(tabs)/FEFO" as Href,
      colors: cards.fefo,
      // Hourglass / time / expiry concept
      image: "https://images.unsplash.com/photo-1501139083538-0139583c060f?w=400&q=80",
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
      {/* Blue Header */}
      <View style={[styles.blueHeader, { backgroundColor: theme.primary, paddingTop: insets.top + 16 }]}>
        <View style={styles.headerTop}>
          <View>
            <ThemedText style={[styles.headerDesc, { color: theme.primaryLight }]}>DASHBOARD</ThemedText>
            <ThemedText style={styles.headerTitle}>Overview</ThemedText>
          </View>
          <View style={styles.headerIcons}>
            <Pressable
              onPress={() => router.push("/alerts")}
              style={styles.headerIconBtn}
            >
              <Ionicons name="notifications-outline" size={20} color="#FFF" />
            </Pressable>
            <Pressable
              onPress={() => router.push("/settings")}
              style={styles.headerIconBtn}
            >
              <Ionicons name="settings-outline" size={20} color="#FFF" />
            </Pressable>
            <Pressable
              onPress={() => router.push("/profile")}
              style={styles.headerIconBtn}
            >
              <Ionicons name="person-outline" size={20} color="#FFF" />
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: 20, paddingBottom: 40 },
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
              style={styles.opCard}
              onPress={() => router.push(card.href)}
            >
              <ImageBackground
                source={{ uri: card.image }}
                style={styles.opCardBg}
                imageStyle={[styles.opCardImage, { opacity: 4.38 }]}
              >
                {/* Card color wash over the image */}
                <View style={[styles.opCardOverlay, { backgroundColor: card.colors.bg }]} />
                {/* Content sits on top */}
                <View style={styles.opCardContent}>
                  <View style={[styles.opIconBox, { backgroundColor: card.colors.icon + "22" }]}>
                    <Ionicons name={card.icon} size={26} color={card.colors.icon} />
                  </View>
                  <ThemedText style={[styles.opLabel, { color: isDark ? "#F0F2FF" : "#0D0F1A" }]}>
                    {card.label}
                  </ThemedText>
                  <ThemedText style={[styles.opSubtitle, { color: isDark ? "#8892B0" : "#6B7280" }]}>
                    {card.subtitle}
                  </ThemedText>
                </View>
              </ImageBackground>
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

        {/* Sales Section - only visible if staff has processSales permission */}
        {salesAccess.isAllowed && (
          <>
            <ThemedText style={[styles.sectionLabel, { color: theme.subtext }]}>
              SALES
            </ThemedText>

            <View style={[styles.listCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Pressable
                style={styles.listRow}
                onPress={() => setSalesExpanded(!salesExpanded)}
              >
                <View style={[styles.rowIconBox, { backgroundColor: "#10B981" + "18" }]}>
                  <Ionicons name="receipt-outline" size={20} color="#10B981" />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText style={[styles.rowLabel, { color: theme.text }]}>
                    Sales Overview
                  </ThemedText>
                  <ThemedText style={[styles.rowDesc, { color: theme.subtext }]}>
                    {salesStats.totalSales > 0
                      ? `${salesStats.totalSales} transactions · ₦${salesStats.today.toLocaleString()} today`
                      : "Tap to view sales data"}
                  </ThemedText>
                </View>
                <Ionicons
                  name={salesExpanded ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={theme.subtext}
                />
              </Pressable>

              {salesExpanded && (
                <View style={[styles.salesContent, { borderTopColor: theme.border }]}>
                  {loadingSales ? (
                    <View style={styles.salesLoading}>
                      <ActivityIndicator size="small" color={theme.primary} />
                      <ThemedText style={[styles.salesLoadingText, { color: theme.subtext }]}>
                        Loading sales data...
                      </ThemedText>
                    </View>
                  ) : (
                    <>
                      {/* Sales Stats */}
                      <View style={styles.salesStatsRow}>
                        <View style={[styles.salesStatCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
                          <ThemedText style={[styles.salesStatValue, { color: theme.primary }]}>
                            ₦{salesStats.today.toLocaleString()}
                          </ThemedText>
                          <ThemedText style={[styles.salesStatLabel, { color: theme.subtext }]}>TODAY</ThemedText>
                        </View>
                        <View style={[styles.salesStatCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
                          <ThemedText style={[styles.salesStatValue, { color: theme.primary }]}>
                            ₦{salesStats.week.toLocaleString()}
                          </ThemedText>
                          <ThemedText style={[styles.salesStatLabel, { color: theme.subtext }]}>THIS WEEK</ThemedText>
                        </View>
                        <View style={[styles.salesStatCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
                          <ThemedText style={[styles.salesStatValue, { color: theme.primary }]}>
                            {salesStats.totalSales}
                          </ThemedText>
                          <ThemedText style={[styles.salesStatLabel, { color: theme.subtext }]}>TOTAL</ThemedText>
                        </View>
                      </View>

                      {/* Recent Sales */}
                      {recentSales.length > 0 ? (
                        <View style={styles.salesList}>
                          <ThemedText style={[styles.salesSubtitle, { color: theme.subtext }]}>
                            RECENT TRANSACTIONS
                          </ThemedText>
                          {recentSales.map((sale, index) => (
                            <View
                              key={sale._id || index}
                              style={[
                                styles.salesItem,
                                {
                                  borderBottomColor: theme.border,
                                  borderBottomWidth: index < recentSales.length - 1 ? 1 : 0,
                                },
                              ]}
                            >
                              <View style={{ flex: 1 }}>
                                <View style={styles.salesItemNameRow}>
                                  <ThemedText style={[styles.salesItemName, { color: theme.text }]} numberOfLines={1}>
                                    {sale.productName}
                                  </ThemedText>
                                  {sale.soldBy?.role === 'admin' && (
                                    <View style={[styles.adminBadge, { backgroundColor: theme.primary + "18" }]}>
                                      <ThemedText style={[styles.adminBadgeText, { color: theme.primary }]}>
                                        ADMIN
                                      </ThemedText>
                                    </View>
                                  )}
                                </View>
                                <ThemedText style={[styles.salesItemDate, { color: theme.subtext }]}>
                                  {formatSaleDate(sale.saleDate)} · {sale.quantitySold} units
                                </ThemedText>
                              </View>
                              <ThemedText style={[styles.salesItemAmount, { color: "#10B981" }]}>
                                ₦{(sale.totalAmount || 0).toLocaleString()}
                              </ThemedText>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <View style={styles.salesEmpty}>
                          <Ionicons name="receipt-outline" size={32} color={theme.subtext + "40"} />
                          <ThemedText style={[styles.salesEmptyText, { color: theme.subtext }]}>
                            No sales recorded yet
                          </ThemedText>
                        </View>
                      )}
                    </>
                  )}
                </View>
              )}
            </View>
          </>
        )}

        {/* AI Insights Section */}
        <ThemedText style={[styles.sectionLabel, { color: theme.subtext }]}>
          AI INSIGHTS
        </ThemedText>

        <View style={[styles.listCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Pressable
            style={styles.listRow}
            onPress={() => setAiInsightsExpanded(!aiInsightsExpanded)}
          >
            <View style={[styles.rowIconBox, { backgroundColor: theme.primary + "18" }]}>
              <Ionicons name="analytics-outline" size={20} color={theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={[styles.rowLabel, { color: theme.text }]}>
                Analytics Overview
              </ThemedText>
              <ThemedText style={[styles.rowDesc, { color: theme.subtext }]}>
                {dashboardData?.summary ? 
                  `${dashboardData.summary.highRiskProducts || 0} high risk • ${dashboardData.summary.topSellingProducts?.length || 0} trending` :
                  "No data available"
                }
              </ThemedText>
            </View>
            <Ionicons 
              name={aiInsightsExpanded ? "chevron-up" : "chevron-down"} 
              size={18} 
              color={theme.subtext} 
            />
          </Pressable>

          {aiInsightsExpanded && (
            <View style={[styles.aiInsightsContent, { borderTopColor: theme.border }]}>
              {/* Risk Overview */}
              <View style={styles.aiSection}>
                <ThemedText style={[styles.aiSectionTitle, { color: theme.text }]}>
                  Risk Analysis
                </ThemedText>
                <View style={styles.aiMetricsRow}>
                  <AIMetricCard
                    label="High Risk"
                    value={dashboardData?.summary?.highRiskProducts || 0}
                    color="#FF4444"
                    icon="alert-circle"
                    theme={theme}
                  />
                  <AIMetricCard
                    label="Medium Risk"
                    value={dashboardData?.summary?.mediumRiskProducts || 0}
                    color="#FF9500"
                    icon="warning"
                    theme={theme}
                  />
                  <AIMetricCard
                    label="Low Risk"
                    value={dashboardData?.summary?.lowRiskProducts || 0}
                    color="#34C759"
                    icon="checkmark-circle"
                    theme={theme}
                  />
                </View>
              </View>

              {/* Sales Performance */}
              <View style={styles.aiSection}>
                <ThemedText style={[styles.aiSectionTitle, { color: theme.text }]}>
                  Sales Performance
                </ThemedText>
                <View style={styles.aiMetricsRow}>
                  <AIMetricCard
                    label="Total Sales"
                    value={`₦${(dashboardData?.summary?.totalSales || 0).toLocaleString()}`}
                    color={theme.primary}
                    icon="cash"
                    theme={theme}
                  />
                  <AIMetricCard
                    label="Units Sold"
                    value={dashboardData?.summary?.totalUnitsSold || 0}
                    color={theme.primary}
                    icon="cube"
                    theme={theme}
                  />
                  <AIMetricCard
                    label="Avg Velocity"
                    value={`${(dashboardData?.summary?.averageVelocity || 0).toFixed(1)}/day`}
                    color={theme.primary}
                    icon="speedometer"
                    theme={theme}
                  />
                </View>
              </View>

              {/* Quick Insights */}
              {quickInsights && (
                <View style={styles.aiSection}>
                  <ThemedText style={[styles.aiSectionTitle, { color: theme.text }]}>
                    AI Recommendations
                  </ThemedText>
                  <View style={[styles.aiRecommendations, { backgroundColor: theme.primary + "10", borderColor: theme.primary + "30" }]}>
                    <View style={styles.aiRecommendationRow}>
                      <Ionicons name="bulb" size={16} color={theme.primary} />
                      <ThemedText style={[styles.aiRecommendationText, { color: theme.text }]}>
                        {quickInsights.urgentCount > 0 
                          ? `${quickInsights.urgentCount} items need urgent attention`
                          : "All products are performing well"
                        }
                      </ThemedText>
                    </View>
                    {quickInsights.criticalItems?.length > 0 && (
                      <View style={styles.aiRecommendationRow}>
                        <Ionicons name="trending-up" size={16} color={theme.primary} />
                        <ThemedText style={[styles.aiRecommendationText, { color: theme.text }]}>
                          {quickInsights.criticalItems.length} critical items analyzed
                        </ThemedText>
                      </View>
                    )}
                <ThemedText style={[styles.aiViewMoreText, { color: theme.primary}]}>View Full AI Reports as Admin</ThemedText>
                  </View>
                </View>
              )}
            </View>
          )}
        </View>

        {/* AI Info Section */}
        <View style={[styles.aiInfoSection, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.aiInfoHeader}>
            <Ionicons name="information-circle" size={20} color={theme.primary} />
            <ThemedText style={[styles.aiInfoTitle, { color: theme.text }]}>
              About AI Predictions
            </ThemedText>
          </View>
          
          <ThemedText style={[styles.aiInfoText, { color: theme.subtext }]}>
            Insightory uses AI to analyze your sales patterns and predict demand, risk scores, and optimal inventory levels. 
            The system learns from your transaction history to provide accurate forecasts and actionable recommendations.
          </ThemedText>

          <View style={styles.aiInfoFeatures}>
            <View style={styles.aiInfoFeature}>
              <Ionicons name="trending-up" size={14} color={theme.primary} />
              <ThemedText style={[styles.aiInfoFeatureText, { color: theme.subtext }]}>
                Demand forecasting (7-30 days)
              </ThemedText>
            </View>
            <View style={styles.aiInfoFeature}>
              <Ionicons name="alert-circle" size={14} color={theme.primary} />
              <ThemedText style={[styles.aiInfoFeatureText, { color: theme.subtext }]}>
                Risk scoring for waste prevention
              </ThemedText>
            </View>
            <View style={styles.aiInfoFeature}>
              <Ionicons name="bulb" size={14} color={theme.primary} />
              <ThemedText style={[styles.aiInfoFeatureText, { color: theme.subtext }]}>
                Smart recommendations & alerts
              </ThemedText>
            </View>
          </View>

          <Pressable
            style={[styles.aiInfoLearnMore, { borderColor: theme.border }]}
            onPress={() => router.push("/ai-info" as Href)}
          >
            <ThemedText style={[styles.aiInfoLearnMoreText, { color: theme.primary }]}>
              Learn More About AI Predictions
            </ThemedText>
            <Ionicons name="arrow-forward" size={14} color={theme.primary} />
          </Pressable>
        </View>
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

interface AIMetricCardProps {
  label: string;
  value: string | number;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  theme: any;
}

function AIMetricCard({ label, value, color, icon, theme }: AIMetricCardProps) {
  return (
    <View style={[styles.aiMetricCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
      <View style={[styles.aiMetricIcon, { backgroundColor: color + "20" }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <ThemedText style={[styles.aiMetricValue, { color: theme.text }]}>
        {value}
      </ThemedText>
      <ThemedText style={[styles.aiMetricLabel, { color: theme.subtext }]}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  blueHeader: {
    paddingTop: 55,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerDesc: {
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: "900",
  },
  headerTitle: {
    fontSize: 25,
    fontWeight: 500,
    letterSpacing: -1
  },
  headerIcons: {
    flexDirection: "row",
    gap: 10,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
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
  opCard: { width: "47.5%", borderRadius: 20, overflow: "hidden", minHeight: 150 },
  opCardBg: { flex: 1, minHeight: 150, justifyContent: "flex-end" },
  opCardImage: { borderRadius: 20 },
  opCardOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    opacity: 0.92,
  },
  opCardContent: { padding: 16 },
  opIconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center", marginBottom: 10 },
  opLabel: { fontSize: 16, marginBottom: 3 },
  opSubtitle: { fontSize: 12 },
  listCard: { borderRadius: 20, borderWidth: 1, overflow: "hidden", marginBottom: 28 },
  listRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 14 },
  rowIconBox: { width: 42, height: 42, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  rowLabel: { fontSize: 15, marginBottom: 2 },
  rowDesc: { fontSize: 12 },
  badge: { minWidth: 22, height: 22, borderRadius: 11, justifyContent: "center", alignItems: "center", paddingHorizontal: 6 },
  badgeText: { color: "#FFF", fontSize: 11 },

  // AI Insights styles
  aiInsightsContent: { paddingTop: 16, borderTopWidth: 1 },
  aiSection: { marginBottom: 20, padding: 10, },
  aiSectionTitle: { fontSize: 14, marginBottom: 12, letterSpacing: 0.3 },
  aiMetricsRow: { flexDirection: "row", gap: 8 },
  aiMetricCard: { flex: 1, padding: 12, borderRadius: 12, borderWidth: 1, alignItems: "center", minHeight: 80 },
  aiMetricIcon: { width: 32, height: 32, borderRadius: 8, justifyContent: "center", alignItems: "center", marginBottom: 8 },
  aiMetricValue: { fontSize: 16, marginBottom: 2 },
  aiMetricLabel: { fontSize: 10, textAlign: "center" },
  aiRecommendations: { padding: 12, borderRadius: 12, borderWidth: 1 },
  aiRecommendationRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  aiRecommendationText: { fontSize: 13, flex: 1 },
  aiViewMoreText: { fontSize: 13, alignItems: 'center' },

  // AI Info section styles
  aiInfoSection: { padding: 16, borderRadius: 16, borderWidth: 1 },
  aiInfoHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  aiInfoTitle: { fontSize: 15 },
  aiInfoText: { fontSize: 13, lineHeight: 20, marginBottom: 16 },
  aiInfoFeatures: { gap: 8, marginBottom: 16 },
  aiInfoFeature: { flexDirection: "row", alignItems: "center", gap: 8 },
  aiInfoFeatureText: { fontSize: 12 },
  aiInfoLearnMore: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, padding: 12, borderRadius: 10, borderWidth: 1 },
  aiInfoLearnMoreText: { fontSize: 13 },

  // Sales section styles
  salesContent: { borderTopWidth: 1, paddingTop: 12, paddingBottom: 8 },
  salesLoading: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 20 },
  salesLoadingText: { fontSize: 13 },
  salesStatsRow: { flexDirection: "row", gap: 8, paddingHorizontal: 12, marginBottom: 12 },
  salesStatCard: { flex: 1, padding: 10, borderRadius: 12, borderWidth: 1, alignItems: "center" },
  salesStatValue: { fontSize: 15, marginBottom: 2 },
  salesStatLabel: { fontSize: 9, letterSpacing: 0.5 },
  salesList: { paddingHorizontal: 12, paddingBottom: 4 },
  salesSubtitle: { fontSize: 10, letterSpacing: 1.5, marginBottom: 10 },
  salesItem: { flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 12 },
  salesItemNameRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  salesItemName: { fontSize: 14, flexShrink: 1 },
  adminBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  adminBadgeText: { fontSize: 9, fontWeight: "800" as const, letterSpacing: 0.5 },
  salesItemDate: { fontSize: 12 },
  salesItemAmount: { fontSize: 15 },
  salesEmpty: { alignItems: "center", paddingVertical: 24, gap: 8 },
  salesEmptyText: { fontSize: 13 },
});