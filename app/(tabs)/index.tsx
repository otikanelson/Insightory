import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import { Href, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Image,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    View
} from "react-native";
import Toast from "react-native-toast-message";
import { AIInsightsBadge } from "../../components/AIInsightsBadge";
import { HelpTooltip } from "../../components/HelpTooltip";
import { ProductCard, ProductCardSkeleton } from "../../components/ProductCard";
import { useTheme } from "../../context/ThemeContext";
import { useAIPredictions } from "../../hooks/useAIPredictions";
import { useAlerts } from "../../hooks/useAlerts";
import { useProducts } from "../../hooks/useProducts";
import { Prediction } from "../../types/ai-predictions";

const RecentlySoldCard = ({ item, isBatchView = false }: { item: any; isBatchView?: boolean }) => {
  const { theme } = useTheme();
  const router = useRouter();
  const [isLoaded, setIsLoaded] = useState(false);

  if (!item || !item.name) return null;

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffDays = Math.ceil(Math.abs(now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) return "Yesterday";
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString();
    } catch { return "Recently"; }
  };

  const handlePress = () => {
    try {
      const productId = isBatchView ? item.productId : item._id;
      router.push(`/product/${productId}/sales` as Href);
    } catch {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Could not open product details' });
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
    >
      <View style={styles.topLabels}>
        <View style={[styles.pill, { backgroundColor: theme.primaryLight }]}>
          <Ionicons name="trending-down" size={9} color={theme.primary} />
          <Text style={[styles.pillText, { color: theme.primary }]}>SOLD</Text>
        </View>
        <View style={[styles.pill, { backgroundColor: theme.accent }]}>
          <Ionicons name="time-outline" size={9} color={theme.subtext} />
          <Text style={[styles.pillText, { color: theme.subtext }]}>
            {formatDate(isBatchView ? item.saleDate : item.lastSaleDate)}
          </Text>
        </View>
      </View>

      <View style={[styles.imageWrapper, { backgroundColor: theme.accent }]}>
        {!isLoaded && <Ionicons name="cube-outline" size={36} color={theme.border} />}
        {item.imageUrl && item.imageUrl !== "cube" && (
          <Image
            source={{ uri: item.imageUrl }}
            style={[styles.image, { opacity: isLoaded ? 1 : 0 }]}
            onLoad={() => setIsLoaded(true)}
            onError={() => setIsLoaded(false)}
            resizeMode="contain"
          />
        )}
      </View>

      <View style={styles.footer}>
        <View style={{ flex: 1 }}>
          {isBatchView ? (
            <>
              <Text style={[styles.quantityLabel, { color: theme.primary }]}>
                {item.quantitySold || 0} units · ₦{item.totalAmount?.toLocaleString() || 0}
              </Text>
              <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>{item.name}</Text>
              {item.batchNumber && item.batchNumber !== 'N/A' && (
                <Text style={[styles.batchLabel, { color: theme.subtext }]} numberOfLines={1}>
                  Batch: {item.batchNumber.slice(-6)}
                </Text>
              )}
            </>
          ) : (
            <>
              <Text style={[styles.quantityLabel, { color: theme.primary }]}>
                {item.totalSold || 0} sold · ₦{item.totalRevenue?.toLocaleString() || 0}
              </Text>
              <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>{item.name}</Text>
            </>
          )}
        </View>
      </View>
    </Pressable>
  );
};

export default function Dashboard() {
  const router = useRouter();
  const { theme } = useTheme();
  const { products, recentlySold, loading, refresh, inventoryStats } = useProducts();
  const { fetchBatchPredictions } = useAIPredictions({ enableWebSocket: false, autoFetch: false });
  const { summary: alertSummary } = useAlerts();

  const [activeTab, setActiveTab] = useState<"stocked" | "sold">("stocked");
  const [displayLimit, setDisplayLimit] = useState(6);
  const [viewByProduct, setViewByProduct] = useState(true);
  const [recentlySoldBatches, setRecentlySoldBatches] = useState<any[]>([]);
  const [predictions, setPredictions] = useState<Record<string, Prediction>>({});

  useEffect(() => {
    const fetchBatchSales = async () => {
      if (!viewByProduct && activeTab === "sold") {
        try {
          const response = await axios.get(
            `${process.env.EXPO_PUBLIC_API_URL}/analytics/recently-sold-batches?limit=20`
          );
          if (response.data.success) setRecentlySoldBatches(response.data.data || []);
        } catch {
          setRecentlySoldBatches([]);
        }
      }
    };
    fetchBatchSales();
  }, [viewByProduct, activeTab]);

  const fefoItems = useMemo(() => {
    return products
      .map((p) => {
        const earliest = p.batches?.reduce((earliest: Date | null, b) => {
          if (!b?.expiryDate || b.expiryDate === "N/A") return earliest;
          const d = new Date(b.expiryDate);
          return !earliest || d < earliest ? d : earliest;
        }, null);
        return { product: p, earliest };
      })
      .filter(({ product, earliest }) => product.isPerishable && earliest)
      .sort((a, b) => a.earliest!.getTime() - b.earliest!.getTime())
      .slice(0, 3)
      .map(({ product }) => product);
  }, [products]);

  const visibleData = useMemo(() => {
    let baseData;
    if (activeTab === "stocked") {
      baseData = [...products].sort(
        (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
      );
    } else {
      baseData = viewByProduct ? recentlySold : recentlySoldBatches;
    }
    return baseData.slice(0, displayLimit);
  }, [products, recentlySold, recentlySoldBatches, activeTab, displayLimit, viewByProduct]);

  useEffect(() => {
    const fetchPredictionsForVisible = async () => {
      if (activeTab === "stocked" && visibleData.length > 0 && !loading) {
        const productIds = visibleData.map((p: any) => p._id).filter(Boolean);
        if (productIds.length > 0) {
          try {
            const batchPredictions = await fetchBatchPredictions(productIds);
            const predictionsMap: Record<string, Prediction> = {};
            batchPredictions.forEach((pred: Prediction) => {
              if (pred.productId) predictionsMap[pred.productId] = pred;
            });
            setPredictions(predictionsMap);
          } catch {}
        }
      }
    };
    fetchPredictionsForVisible();
  }, [visibleData, activeTab, loading]);

  const handleLoadMore = () => {
    const maxLength = activeTab === "stocked"
      ? products.length
      : viewByProduct ? recentlySold.length : recentlySoldBatches.length;
    if (displayLimit < maxLength) setDisplayLimit(prev => prev + 6);
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <FlatList
        data={loading ? Array(6).fill({}) : visibleData}
        numColumns={2}
        columnWrapperStyle={styles.row}
        keyExtractor={(item, index) => loading ? `skeleton-${index}` : item._id}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={theme.primary} />
        }
        contentContainerStyle={styles.listPadding}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.headerContainer}>
            {/* TOP BAR */}
            <View style={styles.header}>
              <View>
                <Text style={[styles.greet, { color: theme.primary }]}>STAFF DASHBOARD</Text>
                <Text style={[styles.title, { color: theme.text }]}>StockQ</Text>
              </View>
              <View style={styles.headerRight}>
                <Pressable
                  onPress={() => router.push("/alerts")}
                  style={[styles.iconBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
                >
                  <Ionicons name="notifications-outline" size={20} color={theme.text} />
                  {alertSummary && alertSummary.total > 0 && (
                    <View style={[styles.dot, { backgroundColor: theme.notification }]} />
                  )}
                </Pressable>
                <Pressable
                  onPress={() => router.push("/settings" as any)}
                  style={[styles.iconBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
                >
                  <Ionicons name="settings-outline" size={20} color={theme.text} />
                </Pressable>
              </View>
            </View>

            {/* STATS HUD */}
            <View style={styles.statsRow}>
              <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 0 }]}>
                Inventory Stats
              </Text>
              <HelpTooltip
                title="Dashboard Stats"
                content={[
                  "Total Records: Total product units across all batches.",
                  "Expiring Soon: Products expiring within your alert threshold.",
                  "Low Stock: Products below minimum stock level.",
                  "Urgent Items: Products needing immediate attention."
                ]}
                icon="help-circle-outline"
                iconSize={16}
                iconColor={theme.primary}
              />
            </View>

            <View style={styles.statGrid}>
              <View style={[styles.mainStat, { backgroundColor: theme.primary }]}>
                <Text style={styles.statLabelMain}>TOTAL RECORDS</Text>
                <Text style={styles.statValueMain}>{inventoryStats.totalUnits}</Text>
              </View>
              <View style={styles.smallStatsCol}>
                <View style={[styles.smallStat, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Text style={[styles.smallStatVal, { color: theme.text }]}>{inventoryStats.expiringSoonCount}</Text>
                  <Text style={[styles.smallStatLabel, { color: theme.subtext }]}>EXPIRING</Text>
                </View>
                <View style={[styles.smallStat, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Text style={[styles.smallStatVal, { color: theme.text }]}>{inventoryStats.lowStockCount}</Text>
                  <Text style={[styles.smallStatLabel, { color: theme.subtext }]}>LOW STOCK</Text>
                </View>
              </View>
            </View>

            {/* AI INSIGHTS */}
            <AIInsightsBadge />

            {/* QUICK ACTIONS */}
            <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 14 }]}>
              Quick Actions
            </Text>
            <View style={styles.actionGrid}>
              {[
                { label: 'Scan', icon: 'scan-outline', color: '#5B4FE8', bg: '#5B4FE818',
                  onPress: () => router.push({ pathname: "/scan", params: { initialTab: "registry" } }) },
                { label: 'Search', icon: 'search-outline', color: '#F59E0B', bg: '#F59E0B18',
                  onPress: () => router.push("/inventory") },
                { label: 'Add', icon: 'add-circle-outline', color: '#10B981', bg: '#10B98118',
                  onPress: () => router.push("/add-products") },
                { label: 'Queue', icon: 'hourglass-outline', color: '#EF4444', bg: '#EF444418',
                  onPress: () => router.push("/FEFO") },
              ].map((action) => (
                <Pressable
                  key={action.label}
                  onPress={action.onPress}
                  style={({ pressed }) => [
                    styles.actionCard,
                    { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.8 : 1 },
                  ]}
                >
                  <View style={[styles.actionIcon, { backgroundColor: action.bg }]}>
                    <Ionicons name={action.icon as any} size={20} color={action.color} />
                  </View>
                  <Text style={[styles.actionText, { color: theme.text }]}>{action.label}</Text>
                </Pressable>
              ))}
            </View>

            {/* PRIORITY QUEUE */}
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Priority Queue</Text>
              <Pressable onPress={() => router.push("/FEFO")}>
                <Text style={{ color: theme.primary, fontWeight: '700', fontSize: 13 }}>See all</Text>
              </Pressable>
            </View>

            {fefoItems.length > 0 ? (
              fefoItems.map((item) => (
                <Pressable
                  key={item._id}
                  onPress={() => router.push(`/product/${item._id}` as Href)}
                  style={[styles.fefoItem, { backgroundColor: theme.surface, borderColor: theme.border }]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={[styles.indicator, { backgroundColor: theme.notification }]} />
                    <Text style={{ color: theme.text, fontWeight: '700', fontSize: 14 }}>{item.name}</Text>
                  </View>
                  <View style={[styles.expiryBadge, { backgroundColor: theme.notification + '18' }]}>
                    <Text style={{ color: theme.notification, fontSize: 12, fontWeight: '700' }}>
                      {new Date(item.batches?.[0]?.expiryDate || '').toLocaleDateString()}
                    </Text>
                  </View>
                </Pressable>
              ))
            ) : (
              <View style={[styles.emptyFefo, { borderColor: theme.border }]}>
                <Ionicons name="checkmark-circle-outline" size={20} color={theme.subtext} />
                <Text style={{ color: theme.subtext, marginLeft: 8 }}>No urgent items</Text>
              </View>
            )}

            {/* ACTIVITY TABS */}
            <View style={styles.tabContainer}>
              <Pressable
                onPress={() => { setActiveTab("stocked"); setDisplayLimit(6); }}
                style={[styles.tab, activeTab === "stocked" && { borderBottomColor: theme.primary }]}
              >
                <Text style={[styles.tabText, { color: activeTab === "stocked" ? theme.text : theme.subtext }]}>
                  Recently Stocked
                </Text>
              </Pressable>
              <Pressable
                onPress={() => { setActiveTab("sold"); setDisplayLimit(6); }}
                style={[styles.tab, activeTab === "sold" && { borderBottomColor: theme.primary }]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={[styles.tabText, { color: activeTab === "sold" ? theme.text : theme.subtext }]}>
                    Recently Sold
                  </Text>
                  {activeTab === "sold" && (
                    <Pressable
                      onPress={() => { setViewByProduct(!viewByProduct); setDisplayLimit(6); }}
                      style={[styles.inlineToggle, {
                        backgroundColor: viewByProduct ? theme.primaryLight : theme.primary,
                        borderColor: theme.primary,
                      }]}
                    >
                      <Text style={[styles.inlineToggleText, { color: viewByProduct ? theme.primary : '#FFF' }]}>
                        {viewByProduct ? 'BY PRODUCT' : 'BY BATCH'}
                      </Text>
                    </Pressable>
                  )}
                </View>
              </Pressable>
            </View>
          </View>
        }
        renderItem={({ item }) =>
          loading ? (
            <ProductCardSkeleton />
          ) : activeTab === "sold" ? (
            <RecentlySoldCard item={item} isBatchView={!viewByProduct} />
          ) : (
            <ProductCard item={item} prediction={predictions[item._id] || null} />
          )
        }
        ListEmptyComponent={
          !loading && activeTab === "sold" ? (
            <View style={styles.emptyState}>
              <Ionicons name="cart-outline" size={56} color={theme.subtext + '40'} />
              <Text style={[styles.emptyText, { color: theme.subtext }]}>No Sales Yet</Text>
              <Text style={[styles.emptyHint, { color: theme.subtext }]}>
                Sales will appear here once you complete transactions
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={(() => {
          const maxLength = activeTab === "stocked"
            ? products.length
            : viewByProduct ? recentlySold.length : recentlySoldBatches.length;
          return displayLimit < maxLength && !loading ? (
            <ActivityIndicator style={{ marginVertical: 20 }} color={theme.primary} />
          ) : null;
        })()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  listPadding: { paddingHorizontal: 20, paddingBottom: 120 },
  headerContainer: { paddingTop: 60, marginBottom: 10 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerRight: { flexDirection: 'row', gap: 10 },
  greet: { fontSize: 10, fontWeight: '800', letterSpacing: 2, marginBottom: 2 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  iconBtn: {
    height: 42,
    width: 42,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  dot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  statGrid: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  mainStat: {
    flex: 1.2,
    borderRadius: 22,
    paddingHorizontal: 20,
    justifyContent: 'center',
    minHeight: 108,
  },
  statLabelMain: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '700', marginBottom: 4 },
  statValueMain: { color: '#FFF', fontSize: 34, fontWeight: '800' },
  smallStatsCol: { flex: 1, gap: 10 },
  smallStat: {
    flex: 1,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    justifyContent: 'center',
  },
  smallStatVal: { fontSize: 18, fontWeight: '800' },
  smallStatLabel: { fontSize: 9, fontWeight: '700', marginTop: 2 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitle: { fontSize: 17, fontWeight: '800' },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  actionCard: {
    flex: 1,
    height: 58,
    minWidth: '47%',
    maxWidth: '48%',
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionText: { fontSize: 13, fontWeight: '700' },
  fefoItem: {
    padding: 14,
    borderRadius: 16,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
  },
  indicator: { width: 4, height: 18, borderRadius: 2 },
  expiryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  emptyFefo: {
    padding: 18,
    borderRadius: 16,
    borderStyle: 'dashed',
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  tabContainer: {
    flexDirection: 'row',
    marginTop: 20,
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150,150,150,0.1)',
  },
  tab: {
    paddingVertical: 10,
    marginRight: 20,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: { fontSize: 14, fontWeight: '700' },
  inlineToggle: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  inlineToggleText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  row: { justifyContent: 'space-between' },
  // Recently Sold Card
  card: {
    width: '48%',
    borderRadius: 24,
    borderWidth: 1,
    padding: 10,
    marginBottom: 16,
  },
  topLabels: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 8,
  },
  pillText: { fontSize: 8, fontWeight: '700', textTransform: 'uppercase' },
  imageWrapper: {
    width: '100%',
    height: 130,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  image: { width: '85%', height: '85%', borderRadius: 18 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 2,
  },
  quantityLabel: { fontSize: 11, fontWeight: '500', marginBottom: 2 },
  name: { fontSize: 14, fontWeight: '800' },
  batchLabel: { fontSize: 10, fontWeight: '600', marginTop: 2 },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyText: { fontSize: 17, fontWeight: '800', marginTop: 14, marginBottom: 8 },
  emptyHint: { fontSize: 14, fontWeight: '500', textAlign: 'center', lineHeight: 20 },
});
