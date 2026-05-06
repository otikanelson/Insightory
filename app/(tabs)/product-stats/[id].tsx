import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import axios from "axios";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedText } from "../../../components/ThemedText";
import { useTheme } from "../../../context/ThemeContext";
import { useAIPredictions } from "../../../hooks/useAIPredictions";
import { useProducts } from "../../../hooks/useProducts";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000/api";

interface SaleRecord {
  _id: string;
  quantitySold: number;
  totalAmount: number;
  saleDate: string;
  batchNumber: string;
  priceAtSale: number;
}

interface Batch {
  batchNumber: string;
  quantity: number;
  expiryDate: string;
  price?: number;
}

export default function ProductStatsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { getProductById } = useProducts();

  const { prediction, loading: predictionLoading } = useAIPredictions({
    productId: id,
    enableWebSocket: false,
    autoFetch: true,
  });

  const [product, setProduct] = useState<any>(null);
  const [loadingProduct, setLoadingProduct] = useState(true);
  const [salesHistory, setSalesHistory] = useState<SaleRecord[]>([]);
  const [loadingSales, setLoadingSales] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadProduct = useCallback(async () => {
    if (!id) return;
    setLoadingProduct(true);
    const data = await getProductById(id);
    setProduct(data);
    setLoadingProduct(false);
  }, [id]);

  const loadSales = useCallback(async () => {
    if (!id) return;
    setLoadingSales(true);
    try {
      const res = await axios.get(`${API_URL}/analytics/product-sales/${id}?limit=20`);
      if (res.data.success) setSalesHistory(res.data.data);
    } catch (e) {
      console.error("Error fetching product sales:", e);
    } finally {
      setLoadingSales(false);
    }
  }, [id]);

  useEffect(() => {
    loadProduct();
    loadSales();
  }, [loadProduct, loadSales]);

  useFocusEffect(useCallback(() => {
    loadProduct();
    loadSales();
  }, [loadProduct, loadSales]));

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadProduct(), loadSales()]);
    setRefreshing(false);
  };

  // ── Derived stats ──────────────────────────────────────────────
  const salesStats = useMemo(() => {
    if (!salesHistory.length) return null;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    return {
      totalRevenue: salesHistory.reduce((s, r) => s + r.totalAmount, 0),
      totalUnits: salesHistory.reduce((s, r) => s + r.quantitySold, 0),
      today: salesHistory.filter(r => new Date(r.saleDate) >= todayStart).reduce((s, r) => s + r.totalAmount, 0),
      week: salesHistory.filter(r => new Date(r.saleDate) >= weekStart).reduce((s, r) => s + r.totalAmount, 0),
      month: salesHistory.filter(r => new Date(r.saleDate) >= monthStart).reduce((s, r) => s + r.totalAmount, 0),
      count: salesHistory.length,
    };
  }, [salesHistory]);

  const expiryStats = useMemo(() => {
    if (!product?.batches) return null;
    const now = new Date();
    let expired = 0, critical = 0, warning = 0, safe = 0;
    product.batches.forEach((b: Batch) => {
      const days = Math.ceil((new Date(b.expiryDate).getTime() - now.getTime()) / 86400000);
      if (days < 0) expired++;
      else if (days < 7) critical++;
      else if (days < 30) warning++;
      else safe++;
    });
    return { expired, critical, warning, safe, total: product.batches.length };
  }, [product]);

  const riskScore = prediction?.metrics?.riskScore ?? 0;
  const velocity = prediction?.metrics?.velocity ?? 0;

  const getRiskColor = (score: number) => {
    if (score >= 70) return "#FF3B30";
    if (score >= 50) return "#FF9500";
    if (score >= 30) return "#FFCC00";
    return "#34C759";
  };

  const getRiskLabel = (score: number) => {
    if (score >= 70) return "HIGH RISK";
    if (score >= 50) return "MEDIUM RISK";
    if (score >= 30) return "LOW RISK";
    return "STABLE";
  };

  const formatDate = (d: string) => {
    const date = new Date(d);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 86400000);
    if (diff === 0) return "Today";
    if (diff === 1) return "Yesterday";
    if (diff < 7) return `${diff}d ago`;
    return date.toLocaleDateString();
  };

  if (loadingProduct) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!product) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <Ionicons name="alert-circle-outline" size={48} color={theme.subtext} />
        <ThemedText style={[styles.emptyText, { color: theme.subtext }]}>Product not found</ThemedText>
      </View>
    );
  }

  const riskColor = getRiskColor(riskScore);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.primary, paddingTop: insets.top + 16 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#FFF" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <ThemedText style={[styles.headerLabel, { color: theme.primaryLight }]}>PRODUCT STATS</ThemedText>
          <ThemedText style={styles.headerTitle} numberOfLines={1}>{product.name}</ThemedText>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >

        {/* ── AI Risk Banner ── */}
        <View style={[styles.riskBanner, { backgroundColor: riskColor + "18", borderColor: riskColor + "40" }]}>
          <View style={[styles.riskIconBox, { backgroundColor: riskColor + "25" }]}>
            <Ionicons name="analytics" size={22} color={riskColor} />
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText style={[styles.riskLabel, { color: riskColor }]}>{getRiskLabel(riskScore)}</ThemedText>
            <ThemedText style={[styles.riskSub, { color: theme.subtext }]}>
              Risk score: {riskScore}/100 · Velocity: {velocity.toFixed(1)} units/day
            </ThemedText>
          </View>
          {predictionLoading && <ActivityIndicator size="small" color={riskColor} />}
        </View>

        {/* ── AI Metrics Row ── */}
        <View style={styles.metricsRow}>
          {[
            { label: "Risk Score", value: `${riskScore}`, unit: "/100", color: riskColor, icon: "alert-circle" as const },
            { label: "Velocity", value: velocity.toFixed(1), unit: "/day", color: theme.primary, icon: "speedometer" as const },
            { label: "Days Left", value: prediction?.metrics?.daysUntilExpiry != null ? `${prediction.metrics.daysUntilExpiry}` : "—", unit: "days", color: "#F59E0B", icon: "time" as const },
          ].map((m, i) => (
            <View key={i} style={[styles.metricCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={[styles.metricIcon, { backgroundColor: m.color + "18" }]}>
                <Ionicons name={m.icon} size={16} color={m.color} />
              </View>
              <ThemedText style={[styles.metricValue, { color: theme.text }]}>{m.value}</ThemedText>
              <ThemedText style={[styles.metricUnit, { color: theme.subtext }]}>{m.unit}</ThemedText>
              <ThemedText style={[styles.metricLabel, { color: theme.subtext }]}>{m.label}</ThemedText>
            </View>
          ))}
        </View>

        {/* ── AI Recommendation ── */}
        {prediction?.recommendations && prediction.recommendations.length > 0 && (
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <ThemedText style={[styles.cardTitle, { color: theme.primary }]}>AI RECOMMENDATIONS</ThemedText>
            {prediction.recommendations.slice(0, 3).map((rec: any, i: number) => (
              <View key={i} style={[styles.recRow, i > 0 && { borderTopWidth: 1, borderTopColor: theme.border }]}>
                <View style={[styles.recDot, { backgroundColor: rec.priority === "high" ? "#FF3B30" : rec.priority === "medium" ? "#FF9500" : "#34C759" }]} />
                <View style={{ flex: 1 }}>
                  <ThemedText style={[styles.recTitle, { color: theme.text }]}>{rec.action}</ThemedText>
                  {rec.reason && (
                    <ThemedText style={[styles.recReason, { color: theme.subtext }]}>{rec.reason}</ThemedText>
                  )}
                </View>
                <View style={[styles.recPriorityBadge, { backgroundColor: rec.priority === "high" ? "#FF3B3018" : rec.priority === "medium" ? "#FF950018" : "#34C75918" }]}>
                  <ThemedText style={[styles.recPriorityText, { color: rec.priority === "high" ? "#FF3B30" : rec.priority === "medium" ? "#FF9500" : "#34C759" }]}>
                    {rec.priority?.toUpperCase()}
                  </ThemedText>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ── Expiry Status ── */}
        {expiryStats && (
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <ThemedText style={[styles.cardTitle, { color: theme.primary }]}>EXPIRY STATUS</ThemedText>
            <View style={styles.expiryRow}>
              {[
                { label: "Expired", count: expiryStats.expired, color: "#FF3B30" },
                { label: "Critical", count: expiryStats.critical, color: "#FF6A00" },
                { label: "Warning", count: expiryStats.warning, color: "#FFD700" },
                { label: "Safe", count: expiryStats.safe, color: "#34C759" },
              ].map((e, i) => (
                <View key={i} style={[styles.expiryCell, { borderColor: e.color + "40", backgroundColor: e.color + "10" }]}>
                  <ThemedText style={[styles.expiryCellCount, { color: e.color }]}>{e.count}</ThemedText>
                  <ThemedText style={[styles.expiryCellLabel, { color: theme.subtext }]}>{e.label}</ThemedText>
                </View>
              ))}
            </View>

            {/* Batch list */}
            {product.batches.map((b: Batch, i: number) => {
              const days = Math.ceil((new Date(b.expiryDate).getTime() - Date.now()) / 86400000);
              const color = days < 0 ? "#FF3B30" : days < 7 ? "#FF6A00" : days < 30 ? "#FFD700" : "#34C759";
              return (
                <View key={i} style={[styles.batchRow, { borderLeftColor: color, borderColor: theme.border }]}>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={[styles.batchNum, { color: theme.text }]}>{b.batchNumber}</ThemedText>
                    <ThemedText style={[styles.batchExpiry, { color: theme.subtext }]}>
                      Expires {new Date(b.expiryDate).toLocaleDateString()}
                    </ThemedText>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <ThemedText style={[styles.batchQty, { color: theme.text }]}>{b.quantity} units</ThemedText>
                    <ThemedText style={[styles.batchDays, { color }]}>
                      {days < 0 ? "EXPIRED" : `${days}d left`}
                    </ThemedText>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Sales Stats ── */}
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <ThemedText style={[styles.cardTitle, { color: theme.primary }]}>SALES PERFORMANCE</ThemedText>
          {loadingSales ? (
            <ActivityIndicator color={theme.primary} style={{ marginVertical: 20 }} />
          ) : salesStats ? (
            <>
              <View style={styles.salesStatsRow}>
                {[
                  { label: "TODAY", value: `₦${salesStats.today.toLocaleString()}` },
                  { label: "THIS WEEK", value: `₦${salesStats.week.toLocaleString()}` },
                  { label: "THIS MONTH", value: `₦${salesStats.month.toLocaleString()}` },
                ].map((s, i) => (
                  <View key={i} style={[styles.salesStatCell, { backgroundColor: theme.background, borderColor: theme.border }]}>
                    <ThemedText style={[styles.salesStatValue, { color: theme.primary }]}>{s.value}</ThemedText>
                    <ThemedText style={[styles.salesStatLabel, { color: theme.subtext }]}>{s.label}</ThemedText>
                  </View>
                ))}
              </View>

              <View style={[styles.salesTotals, { borderTopColor: theme.border }]}>
                <View style={styles.salesTotal}>
                  <ThemedText style={[styles.salesTotalValue, { color: theme.text }]}>{salesStats.totalUnits}</ThemedText>
                  <ThemedText style={[styles.salesTotalLabel, { color: theme.subtext }]}>Total Units Sold</ThemedText>
                </View>
                <View style={[styles.salesTotalDivider, { backgroundColor: theme.border }]} />
                <View style={styles.salesTotal}>
                  <ThemedText style={[styles.salesTotalValue, { color: theme.text }]}>₦{salesStats.totalRevenue.toLocaleString()}</ThemedText>
                  <ThemedText style={[styles.salesTotalLabel, { color: theme.subtext }]}>Total Revenue</ThemedText>
                </View>
              </View>

              {/* Recent transactions */}
              <ThemedText style={[styles.recentTitle, { color: theme.subtext }]}>RECENT TRANSACTIONS</ThemedText>
              {salesHistory.slice(0, 8).map((s, i) => (
                <View key={s._id} style={[styles.txRow, i > 0 && { borderTopWidth: 1, borderTopColor: theme.border }]}>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={[styles.txBatch, { color: theme.subtext }]}>
                      Batch {s.batchNumber?.slice(-6) || "—"}
                    </ThemedText>
                    <ThemedText style={[styles.txDate, { color: theme.subtext }]}>{formatDate(s.saleDate)}</ThemedText>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <ThemedText style={[styles.txAmount, { color: "#10B981" }]}>₦{s.totalAmount.toLocaleString()}</ThemedText>
                    <ThemedText style={[styles.txUnits, { color: theme.subtext }]}>{s.quantitySold} units</ThemedText>
                  </View>
                </View>
              ))}
            </>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={32} color={theme.subtext + "40"} />
              <ThemedText style={[styles.emptyText, { color: theme.subtext }]}>No sales recorded yet</ThemedText>
            </View>
          )}
        </View>

        {/* ── Stock Info ── */}
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <ThemedText style={[styles.cardTitle, { color: theme.primary }]}>STOCK INFO</ThemedText>
          {[
            { label: "Total Quantity", value: `${product.totalQuantity} units`, icon: "cube-outline" as const },
            { label: "Batches", value: `${product.batches?.length ?? 0}`, icon: "layers-outline" as const },
            { label: "Category", value: product.category || "General", icon: "pricetag-outline" as const },
            { label: "Barcode", value: product.barcode || "N/A", icon: "barcode-outline" as const },
          ].map((row, i, arr) => (
            <View key={i} style={[styles.infoRow, i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
              <View style={[styles.infoIcon, { backgroundColor: theme.primaryLight }]}>
                <Ionicons name={row.icon} size={16} color={theme.primary} />
              </View>
              <ThemedText style={[styles.infoLabel, { color: theme.subtext }]}>{row.label}</ThemedText>
              <ThemedText style={[styles.infoValue, { color: theme.text }]}>{row.value}</ThemedText>
            </View>
          ))}
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  emptyText: { fontSize: 14 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 14,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerLabel: { fontSize: 10, letterSpacing: 2, fontWeight: "900" },
  headerTitle: { fontSize: 22, fontWeight: "700", color: "#FFF", letterSpacing: -0.5 },

  scroll: { padding: 16, paddingBottom: 60 },

  // Risk banner
  riskBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 14,
  },
  riskIconBox: { width: 42, height: 42, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  riskLabel: { fontSize: 13, fontWeight: "800", letterSpacing: 0.5 },
  riskSub: { fontSize: 12, marginTop: 2 },

  // Metrics
  metricsRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  metricCard: { flex: 1, padding: 12, borderRadius: 14, borderWidth: 1, alignItems: "center" },
  metricIcon: { width: 32, height: 32, borderRadius: 8, justifyContent: "center", alignItems: "center", marginBottom: 6 },
  metricValue: { fontSize: 18, fontWeight: "800" },
  metricUnit: { fontSize: 10, marginTop: 1 },
  metricLabel: { fontSize: 10, textAlign: "center", marginTop: 4 },

  // Card
  card: { borderRadius: 18, borderWidth: 1, padding: 16, marginBottom: 14 },
  cardTitle: { fontSize: 11, fontWeight: "900", letterSpacing: 1.5, marginBottom: 14 },

  // Recommendations
  recRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 10 },
  recDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5, flexShrink: 0 },
  recTitle: { fontSize: 13, fontWeight: "700", marginBottom: 2 },
  recReason: { fontSize: 12, lineHeight: 17 },
  recPriorityBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, alignSelf: "flex-start" },
  recPriorityText: { fontSize: 9, fontWeight: "800" },

  // Expiry
  expiryRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  expiryCell: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  expiryCellCount: { fontSize: 20, fontWeight: "900" },
  expiryCellLabel: { fontSize: 10, marginTop: 2 },
  batchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingLeft: 10,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 8,
    gap: 8,
  },
  batchNum: { fontSize: 13, fontWeight: "700" },
  batchExpiry: { fontSize: 11, marginTop: 2 },
  batchQty: { fontSize: 13, fontWeight: "700" },
  batchDays: { fontSize: 11, fontWeight: "700", marginTop: 2 },

  // Sales
  salesStatsRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  salesStatCell: { flex: 1, alignItems: "center", padding: 10, borderRadius: 12, borderWidth: 1 },
  salesStatValue: { fontSize: 13, fontWeight: "800" },
  salesStatLabel: { fontSize: 9, marginTop: 2, letterSpacing: 0.3 },
  salesTotals: { flexDirection: "row", borderTopWidth: 1, paddingTop: 14, marginBottom: 14 },
  salesTotal: { flex: 1, alignItems: "center" },
  salesTotalDivider: { width: 1, marginHorizontal: 8 },
  salesTotalValue: { fontSize: 16, fontWeight: "800" },
  salesTotalLabel: { fontSize: 11, marginTop: 3 },
  recentTitle: { fontSize: 10, letterSpacing: 1.5, marginBottom: 8 },
  txRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  txBatch: { fontSize: 13, fontWeight: "600" },
  txDate: { fontSize: 11, marginTop: 2 },
  txAmount: { fontSize: 14, fontWeight: "700" },
  txUnits: { fontSize: 11, marginTop: 2 },
  emptyState: { alignItems: "center", paddingVertical: 24, gap: 8 },

  // Stock info
  infoRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 12 },
  infoIcon: { width: 34, height: 34, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  infoLabel: { flex: 1, fontSize: 13 },
  infoValue: { fontSize: 13, fontWeight: "700" },
});
