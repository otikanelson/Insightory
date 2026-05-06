import { ProductCard } from "@/components/ProductCard";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { Product, useProducts } from "@/hooks/useProducts";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import axios from "axios";
import { Href, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedText } from '../../components/ThemedText';

export default function InventoryScreen() {
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const { products, loading, refresh } = useProducts();
  const { role } = useAuth();
  const insets = useSafeAreaInsets();
  
  // Check feature access for viewing inventory
  const viewAccess = useFeatureAccess('viewProducts');
  
  // Note: Staff can always view the inventory page, but some features may be disabled based on permissions

  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<keyof Product | "risk" | "velocity">("name");
  const [displayMode, setDisplayMode] = useState<"card" | "list" | "rect">("rect");
  const [analytics, setAnalytics] = useState<Record<string, { velocity: number; riskScore: number }>>({});

  // Refresh inventory when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      // Always force refresh when screen comes into focus
      refresh();
    }, [refresh])
  );
  
  // Separate analytics fetch function
  const fetchAnalytics = useCallback(async () => {
    try {
      console.log('Fetching analytics from:', `${process.env.EXPO_PUBLIC_API_URL}/analytics/dashboard`);
      const response = await axios.get(`${process.env.EXPO_PUBLIC_API_URL}/analytics/dashboard`);
      console.log('Analytics response:', response.data);
      if (response.data.success) {
        const analyticsMap: Record<string, { velocity: number; riskScore: number }> = {};
        response.data.data.productAnalytics.forEach((item: any) => {
          analyticsMap[item.productId] = {
            velocity: item.velocity,
            riskScore: item.riskScore
          };
        });
        console.log('Analytics map:', analyticsMap);
        setAnalytics(analyticsMap);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  }, []);

  // Fetch analytics for all products
  useEffect(() => {
    if (products.length > 0) {
      fetchAnalytics();
    }
  }, [products.length, fetchAnalytics]);

  // Helper functions
  const getRiskColor = (riskScore: number) => {
    if (riskScore >= 70) return '#FF3B30';
    if (riskScore >= 50) return '#FF9500';
    if (riskScore >= 30) return '#FFCC00';
    return null;
  };

  const getVelocityIndicator = (velocity: number) => {
    if (velocity > 5) return { icon: 'flash' as const, color: '#34C759' };
    if (velocity < 0.5) return { icon: 'hourglass' as const, color: '#FF9500' };
    return null;
  };

  const cycleSortField = () => {
    const fields: Array<keyof Product | "risk" | "velocity"> = ["name", "totalQuantity", "risk", "velocity"];
    const currentIndex = fields.indexOf(sortField);
    const nextIndex = (currentIndex + 1) % fields.length;
    setSortField(fields[nextIndex]);
  };

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const searchLower = searchQuery.toLowerCase();
      return (
        p.name.toLowerCase().includes(searchLower) ||
        (p.category && p.category.toLowerCase().includes(searchLower)) ||
        (p.barcode && p.barcode.includes(searchQuery))
      );
    });
  }, [products, searchQuery]);

  const sortedProducts = useMemo(() => {
    return [...filteredProducts].sort((a, b) => {
      if (sortField === "risk") {
        const riskA = analytics[a._id]?.riskScore || 0;
        const riskB = analytics[b._id]?.riskScore || 0;
        return riskB - riskA; // Highest risk first
      } else if (sortField === "velocity") {
        const velA = analytics[a._id]?.velocity || 0;
        const velB = analytics[b._id]?.velocity || 0;
        return velB - velA; // Highest velocity first
      } else {
        const valA = (a[sortField] || "").toString().toLowerCase();
        const valB = (b[sortField] || "").toString().toLowerCase();
        return valA.localeCompare(valB);
      }
    });
  }, [filteredProducts, sortField, analytics]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.primary }}>
      {/* Blue Header */}
      <View style={[styles.blueHeader, { backgroundColor: theme.primary, paddingTop: insets.top + 16 }]}>
        <View style={styles.headerTop}>
          <View>
            <ThemedText style={[styles.headerDesc, { color: theme.primaryLight }]}>MANAGE_STOCK</ThemedText>
            <ThemedText style={styles.headerTitle}>Inventory List</ThemedText>
          </View>
          <View style={styles.headerIcons}>
            <Pressable style={styles.headerIconBtn} onPress={cycleSortField}>
              <Ionicons
                name={sortField === "risk" ? "alert-circle" : sortField === "velocity" ? "speedometer" : "document"}
                size={20}
                color="#FFF"
              />
            </Pressable>
            <Pressable
              style={styles.headerIconBtn}
              onPress={() => {
                const modes: Array<"card" | "list" | "rect"> = ["card", "list", "rect"];
                const nextIndex = (modes.indexOf(displayMode) + 1) % modes.length;
                setDisplayMode(modes[nextIndex]);
              }}
            >
              <Ionicons
                name={displayMode === "card" ? "list" : displayMode === "list" ? "grid-outline" : "grid"}
                size={20}
                color="#FFF"
              />
            </Pressable>
          </View>
        </View>
      </View>

      {/* Search Bar and Filters */}
      <View style={[styles.filterSection, { backgroundColor: theme.background }]}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color="#999" style={{ marginLeft: 4 }} />
          <TextInput
            placeholder="Search the products"
            placeholderTextColor="#999"
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <Pressable
            onPress={() => router.push({ pathname: "/scan", params: { initialTab: "lookup" } })}
            style={styles.barcodeBtn}
          >
            <Ionicons name="barcode-outline" size={22} color={theme.primary} />
          </Pressable>
        </View>

        {/* Category Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillsRow}
        >
          <Pressable
            onPress={() => setSearchQuery("")}
            style={[styles.pill, searchQuery === "" && styles.pillActive]}
          >
            <ThemedText style={[styles.pillText, searchQuery === "" && styles.pillTextActive]}>
              All ({products.length})
            </ThemedText>
          </Pressable>
          {Array.from(new Set(products.map(p => p.category || "Uncategorized"))).slice(0, 6).map((cat) => (
            <Pressable
              key={cat}
              onPress={() => setSearchQuery(cat)}
              style={[styles.pill, searchQuery === cat && styles.pillActive]}
            >
              <ThemedText style={[styles.pillText, searchQuery === cat && styles.pillTextActive]}>
                {cat} ({products.filter(p => (p.category || "Uncategorized") === cat).length})
              </ThemedText>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* List */}
      <View style={[styles.listContainer, { backgroundColor: theme.background }]}>
        <FlatList
          data={sortedProducts}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listPadding}
          numColumns={displayMode === "rect" ? 2 : 1}
          key={displayMode === "rect" ? "grid" : "list"}
          columnWrapperStyle={displayMode === "rect" ? styles.columnWrapper : undefined}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={async () => { await refresh(); await fetchAnalytics(); }}
              tintColor={theme.primary}
            />
          }
          renderItem={({ item, index }) => {
            const productAnalytics = analytics[item._id];
            const riskScore = productAnalytics?.riskScore || 0;
            const velocity = productAnalytics?.velocity || 0;
            const riskColor = getRiskColor(riskScore);
            const velocityIndicator = getVelocityIndicator(velocity);

            if (displayMode === "list") {
              return (
                <Pressable
                  onPress={() => router.push(`/product/${item._id}` as Href)}
                  style={[styles.listItem, { borderBottomColor: theme.border }]}
                >
                  {riskColor && riskScore > 30 && (
                    <View style={[styles.listRiskDot, { backgroundColor: riskColor }]} />
                  )}
                  <View style={{ flex: 2, marginLeft: riskColor && riskScore > 30 ? 8 : 0 }}>
                    <View style={styles.listNameRow}>
                      <ThemedText style={[styles.listName, { color: theme.text }]} numberOfLines={1}>
                        {item.name}
                      </ThemedText>
                      {velocityIndicator && (
                        <Ionicons name={velocityIndicator.icon} size={12} color={velocityIndicator.color} style={{ marginLeft: 6 }} />
                      )}
                    </View>
                    <ThemedText style={[styles.listSubtitle, { color: theme.subtext }]}>
                      {item.barcode || "No SKU"}
                    </ThemedText>
                  </View>
                  <View style={styles.listPill}>
                    <ThemedText style={[styles.listCategory, { color: theme.subtext }]}>
                      {item.category || "General"}
                    </ThemedText>
                  </View>
                  <View style={{ flex: 1, alignItems: "flex-end" }}>
                    <ThemedText style={[styles.listQty, { color: item.totalQuantity < 10 ? theme.notification : theme.text }]}>
                      {item.totalQuantity} units
                    </ThemedText>
                  </View>
                </Pressable>
              );
            }

            if (displayMode === "rect") {
              const prediction = productAnalytics ? { metrics: { riskScore, velocity } } : null;
              return <ProductCard item={item} prediction={prediction as any} sortField={sortField as any} />;
            }

            // Card mode — horizontal layout
            return (
              <Pressable
                onPress={() => router.push(`/product/${item._id}` as Href)}
                style={[styles.horizontalCard, { backgroundColor: theme.surface }]}
              >
                {riskColor && riskScore > 30 && (
                  <View style={[styles.cardRiskDot, { backgroundColor: riskColor }]} />
                )}
                
                {/* Image Section */}
                <View style={[styles.horizontalImageBox, { backgroundColor: theme.background }]}>
                  {item.imageUrl && item.imageUrl !== "cube" && item.imageUrl !== "" ? (
                    <Image source={{ uri: item.imageUrl }} style={styles.horizontalImage} resizeMode="contain" />
                  ) : (
                    <Ionicons name="cube-outline" size={32} color={theme.subtext + "60"} />
                  )}
                </View>

                {/* Content Section */}
                <View style={styles.horizontalContent}>
                  <ThemedText style={[styles.horizontalName, { color: theme.text }]} numberOfLines={1}>
                    {item.name}
                  </ThemedText>
                  <ThemedText style={[styles.horizontalCategory, { color: theme.subtext }]} numberOfLines={1}>
                    {item.category || "General"}
                  </ThemedText>
                </View>

                {/* Quantity Section */}
                <View style={styles.horizontalQtyBox}>
                  <ThemedText style={[styles.horizontalQty, { color: theme.text }]}>
                    {item.totalQuantity}
                  </ThemedText>
                  <ThemedText style={[styles.horizontalQtyLabel, { color: theme.subtext }]}>
                    QTY
                  </ThemedText>
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="archive-outline" size={48} color={theme.subtext} />
              <ThemedText style={[styles.emptyText, { color: theme.subtext }]}>No products found</ThemedText>
            </View>
          }
        />
      </View>

      {/* Floating Add Button */}
      <Pressable
        onPress={() => router.push("/(tabs)/add-products" as Href)}
        style={[styles.fab, { backgroundColor: theme.primary }]}
      >
        <Ionicons name="add" size={30} color="#FFF" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  blueHeader: {
    paddingTop: 55,
    paddingHorizontal: 20,
    paddingBottom: 10,
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
  filterSection: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    borderRadius: 30,
    paddingHorizontal: 14,
    height: 48,
    marginBottom: 14,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#333",
  },
  barcodeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
  },
  pillsRow: {
    flexDirection: "row",
    gap: 8,
    paddingBottom: 4,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(150,150,150,0.1)",
    borderWidth: 1.5,
    borderColor: "rgba(150,150,150,0.2)",
  },
  pillActive: {
    backgroundColor: "#1a6fd4",
    borderColor: "#1a6fd4",
  },
  pillText: {
    fontSize: 13,
    fontWeight: "700",
    color: "rgba(100,100,100,0.8)",
  },
  pillTextActive: {
    color: "#FFF",
  },
  listContainer: {
    flex: 1,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  listPadding: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 120 },
  columnWrapper: { justifyContent: "space-between", paddingHorizontal: 0 },

  // New card design
  productCard: {
    borderRadius: 16,
    padding: 12,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardNumberBadge: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  cardNumber: {
    fontSize: 12,
    fontWeight: "700",
  },
  cardPrice: {
    fontSize: 13,
    fontWeight: "800",
  },
  cardImageBox: {
    width: "100%",
    height: 110,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
    overflow: "hidden",
  },
  cardImage: {
    width: "100%",
    height: "100%",
  },
  cardName: {
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 3,
  },
  cardBarcode: {
    fontSize: 11,
    marginBottom: 2,
  },
  cardMeta: {
    fontSize: 11,
  },
  cardRiskDot: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    zIndex: 10,
  },

  // List mode
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  listRiskDot: { width: 8, height: 8, borderRadius: 4 },
  listNameRow: { flexDirection: "row", alignItems: "center" },
  listName: { fontSize: 14, fontWeight: "700" },
  listSubtitle: { fontSize: 11, marginTop: 2 },
  listPill: {
    backgroundColor: "rgba(150,150,150,0.1)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginHorizontal: 8,
  },
  listCategory: { fontSize: 10 },
  listQty: { fontSize: 13, fontWeight: "700" },

  emptyContainer: { alignItems: "center", paddingVertical: 60 },
  emptyText: { marginTop: 12, fontSize: 14 },

  // FAB
  fab: {
    position: "absolute",
    bottom: 10,
    right: 24,
    width: 58,
    height: 58,
    borderRadius: 29,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },

  // Horizontal card layout
  horizontalCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  horizontalImageBox: {
    width: 80,
    height: 80,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    flexShrink: 0,
  },
  horizontalImage: {
    width: "100%",
    height: "100%",
  },
  horizontalContent: {
    flex: 1,
    justifyContent: "center",
  },
  horizontalName: {
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 4,
  },
  horizontalCategory: {
    fontSize: 12,
  },
  horizontalQtyBox: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 50,
  },
  horizontalQty: {
    fontSize: 18,
    fontWeight: "900",
  },
  horizontalQtyLabel: {
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2,
  },
});
