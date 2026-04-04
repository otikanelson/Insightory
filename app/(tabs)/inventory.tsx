import { DisabledFeatureOverlay } from "@/components/DisabledFeatureOverlay";
import { HelpTooltip } from "@/components/HelpTooltip";
import { ProductCard } from "@/components/ProductCard";
import { useTheme } from "@/context/ThemeContext";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { Product, useProducts } from "@/hooks/useProducts";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import { Href, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    FlatList,
    Image,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    View
} from "react-native";

export default function InventoryScreen() {
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const { products, loading, refresh } = useProducts();
  
  // Check feature access for viewing inventory
  const viewAccess = useFeatureAccess('viewInventory');
  
  // Show overlay if access is denied
  if (!viewAccess.isAllowed) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <DisabledFeatureOverlay 
          reason={viewAccess.reason || 'Access denied'} 
          isViewOnly={viewAccess.isViewOnly}
        />
      </View>
    );
  }

  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<keyof Product | "risk" | "velocity">("name");
  const [displayMode, setDisplayMode] = useState<"card" | "list" | "rect">("card");
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
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={styles.container}>
        <View style={styles.topSection}>
          <Text style={[styles.subtitle, { color: theme.primary }]}>STOCK MANAGEMENT</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={[styles.title, { color: theme.text }]}>Inventory</Text>
            <HelpTooltip
              title="Inventory Management"
              content={[
                "Search: Find products by name, category, or barcode. Use the barcode icon to scan and search.",
                "Sort Options: Cycle through NAME, QUANTITY, RISK (AI-predicted waste risk), and VELOCITY (sales speed).",
                "View Modes: Switch between card view (detailed) and list view (compact).",
                "Risk Indicators: Red dots show high-risk items. Flash icon = fast-moving, hourglass = slow-moving."
              ]}
              icon="help-circle-outline"
              iconSize={18}
              iconColor={theme.primary}
            />
          </View>

          <View style={styles.searchRow}>
            <View
              style={[
                styles.searchBar,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <Ionicons name="search" size={18} color={theme.subtext} />
              <TextInput
                placeholder="Search inventory..."
                placeholderTextColor={theme.subtext}
                style={[styles.searchInput, { color: theme.text }]}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/scan",
                    params: { initialTab: "lookup" },
                  })
                }
                style={styles.barcodeIcon}
              >
                <Ionicons
                  name="barcode-outline"
                  size={24}
                  color={theme.primary}
                />
              </Pressable>
            </View>

            <Pressable
              style={[
                styles.sortBtn,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
              onPress={cycleSortField}
            >
              <Ionicons 
                name={
                  sortField === "risk" ? "alert-circle" :
                  sortField === "velocity" ? "speedometer" :
                  "swap-vertical"
                } 
                size={20} 
                color={theme.primary} 
              />
            </Pressable>

            <Pressable
              style={[
                styles.sortBtn,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
              onPress={() => {
                const modes: Array<"card" | "list" | "rect"> = ["card", "list", "rect"];
                const currentIndex = modes.indexOf(displayMode);
                const nextIndex = (currentIndex + 1) % modes.length;
                setDisplayMode(modes[nextIndex]);
              }}
            >
              <Ionicons
                name={displayMode === "card" ? "list" : displayMode === "list" ? "grid-outline" : "grid"}
                size={20}
                color={theme.primary}
              />
            </Pressable>
          </View>

          <View style={styles.countRow}>
            <Text style={{ color: theme.text, fontWeight: "800" }}>
              <Text style={[styles.countText, { color: theme.subtext }]}>
                {sortedProducts.length}
              </Text>{" "}
              Products
            </Text>
            <Text style={[styles.sortLabel, { color: theme.primary }]}>
              Sort: {sortField.toUpperCase()}
            </Text>
          </View>
        </View>

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
              onRefresh={async () => {
                await refresh();
                await fetchAnalytics();
              }}
              tintColor={theme.primary}
            />
          }
          renderItem={({ item }) => {
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
                  {/* Risk Dot */}
                  {riskColor && riskScore > 30 && (
                    <View style={[styles.listRiskDot, { backgroundColor: riskColor }]} />
                  )}
                  
                  <View style={{ flex: 2, marginLeft: riskColor && riskScore > 30 ? 8 : 0 }}>
                    <View style={styles.listNameRow}>
                      <Text
                        style={[styles.listName, { color: theme.text }]}
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>
                      {/* Velocity Indicator */}
                      {velocityIndicator && (
                        <Ionicons 
                          name={velocityIndicator.icon} 
                          size={12} 
                          color={velocityIndicator.color}
                          style={{ marginLeft: 6 }}
                        />
                      )}
                    </View>
                    <Text
                      style={[styles.listSubtitle, { color: theme.subtext }]}
                    >
                      {item.barcode || "No SKU"}
                    </Text>
                  </View>
                  <View style={styles.listPill}>
                    <Text
                      style={[styles.listCategory, { color: theme.subtext }]}
                    >
                      {item.category || "General"}
                    </Text>
                  </View>
                  <View style={{ flex: 1, alignItems: "flex-end" }}>
                    {sortField === "risk" && productAnalytics ? (
                      <Text
                        style={[
                          styles.listQty,
                          {
                            color: riskColor || theme.text,
                          },
                        ]}
                      >
                        Risk: {Math.round(riskScore)}
                      </Text>
                    ) : sortField === "velocity" && productAnalytics ? (
                      <Text
                        style={[
                          styles.listQty,
                          {
                            color: velocityIndicator?.color || theme.text,
                          },
                        ]}
                      >
                        {velocity.toFixed(1)}/day
                      </Text>
                    ) : (
                      <Text
                        style={[
                          styles.listQty,
                          {
                            color:
                              item.totalQuantity < 10
                                ? theme.notification
                                : theme.text,
                          },
                        ]}
                      >
                        {item.totalQuantity} units
                      </Text>
                    )}
                  </View>
                </Pressable>
              );
            }
            
            if (displayMode === "rect") {
              // Rectangular card view (like dashboard)
              const prediction = productAnalytics ? {
                metrics: {
                  riskScore,
                  velocity
                }
              } : null;
              
              return (
                <ProductCard 
                  item={item}
                  prediction={prediction as any}
                  sortField={sortField as any}
                />
              );
            }
            
            return (
              <Pressable
                onPress={() => router.push(`/product/${item._id}` as Href)}
                style={[
                  styles.itemCard,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
              >
                {/* Risk Dot - Card Mode */}
                {riskColor && riskScore > 30 && (
                  <View style={[styles.cardRiskDot, { backgroundColor: riskColor }]} />
                )}
                
                <View style={styles.cardMain}>
                  <View style={styles.imageContainer}>
                    {item.imageUrl && item.imageUrl !== "cube" && item.imageUrl !== "" ? (
                      <Image
                        source={{ uri: item.imageUrl }}
                        style={styles.image}
                        resizeMode="contain"
                      />
                    ) : (
                      <Ionicons
                        name="cube-outline"
                        size={30}
                        color={isDark ? "#ffffff20" : "#00000010"}
                      />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.cardNameRow}>
                      <Text
                        style={[styles.name, { color: theme.text }]}
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>
                      {/* Velocity Indicator */}
                      {velocityIndicator && (
                        <Ionicons 
                          name={velocityIndicator.icon} 
                          size={14} 
                          color={velocityIndicator.color}
                          style={{ marginLeft: 6 }}
                        />
                      )}
                    </View>
                    <Text style={[styles.category, { color: theme.subtext }]}>
                      {item.category || "General"}
                    </Text>
                  </View>
                  <View style={styles.qtyBox}>
                    {sortField === "risk" && productAnalytics ? (
                      <>
                        <Text
                          style={[
                            styles.qtyValue,
                            {
                              color: riskColor || theme.primary,
                            },
                          ]}
                        >
                          {Math.round(riskScore)}
                        </Text>
                        <Text style={[styles.qtyLabel, { color: theme.subtext }]}>
                          RISK
                        </Text>
                      </>
                    ) : sortField === "velocity" && productAnalytics ? (
                      <>
                        <Text
                          style={[
                            styles.qtyValue,
                            {
                              color: velocityIndicator?.color || theme.primary,
                            },
                          ]}
                        >
                          {velocity.toFixed(1)}
                        </Text>
                        <Text style={[styles.qtyLabel, { color: theme.subtext }]}>
                          /DAY
                        </Text>
                      </>
                    ) : (
                      <>
                        <Text
                          style={[
                            styles.qtyValue,
                            {
                              color:
                                item.totalQuantity < 10
                                  ? theme.notification
                                  : theme.primary,
                            },
                          ]}
                        >
                          {item.totalQuantity}
                        </Text>
                        <Text style={[styles.qtyLabel, { color: theme.subtext }]}>
                          QTY
                        </Text>
                      </>
                    )}
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60 },
  topSection: { paddingHorizontal: 20, marginBottom: 10 },
  subtitle: { fontSize: 10, fontWeight: '700', letterSpacing: 2 },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  searchRow: { flexDirection: "row", gap: 10, marginBottom: 15 },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    height: 50,
    borderRadius: 16,
    borderWidth: 1,
  },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 13 },
  barcodeIcon: {
    paddingLeft: 10,
    borderLeftWidth: 1,
    borderLeftColor: "rgba(150,150,150,0.2)",
  },
  sortBtn: {
    width: 45,
    height: 50,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  countRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  countText: { fontSize: 13, fontWeight: "600" },
  sortLabel: { fontSize: 11, fontWeight: "800" },
  listPadding: { paddingHorizontal: 20, paddingBottom: 100 },
  itemCard: { borderRadius: 20, borderWidth: 1, marginBottom: 12, padding: 16 },
  cardMain: { flexDirection: "row", alignItems: "center" },
  imageContainer: {
    width: 60,
    height: 60,
    borderRadius: 12,
    marginRight: 12,
    backgroundColor: "#e6e6e620",
    justifyContent: "center",
    alignItems: "center",
  },
  image: { width: "100%", height: "100%" },
  name: { fontSize: 16, fontWeight: "800" },
  category: { fontSize: 12, fontWeight: "600" },
  qtyBox: { alignItems: "center", minWidth: 40 },
  qtyValue: { fontSize: 20, fontWeight: "900" },
  qtyLabel: { fontSize: 9, fontWeight: "700" },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    borderBottomWidth: 1,
    position: 'relative',
  },
  listRiskDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  listNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  listName: { fontSize: 14, fontWeight: "700" },
  listSubtitle: { fontSize: 11 },
  listPill: {
    backgroundColor: "#f0f0f010",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  listCategory: { fontSize: 10, fontWeight: "700" },
  listQty: { fontSize: 14, fontWeight: "800" },
  cardRiskDot: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    zIndex: 10,
  },
  cardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  columnWrapper: {
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
});