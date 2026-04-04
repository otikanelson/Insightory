import { ProductCard } from "@/components/ProductCard";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import Toast from "react-native-toast-message";
import { HelpTooltip } from "../../components/HelpTooltip";
import { useTheme } from "../../context/ThemeContext";
import { useProducts } from "../../hooks/useProducts";

export default function AdminInventory() {
  const router = useRouter();
  const { theme, isDark } = useTheme();

    const { products, loading, refresh } = useProducts();

  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<"name" | "totalQuantity" | "risk" | "velocity">("name");
  const [displayMode, setDisplayMode] = useState<"card" | "list" | "rect">("card");
  const [activeTab, setActiveTab] = useState<"registry" | "inventory">("inventory");
  const [globalProducts, setGlobalProducts] = useState<any[]>([]);
  const [loadingGlobal, setLoadingGlobal] = useState(false);
  const [analytics, setAnalytics] = useState<Record<string, { velocity: number; riskScore: number }>>({});

  // Refresh inventory when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      // Always force refresh when screen comes into focus
      if (activeTab === "inventory") {
        refresh();
        fetchAnalytics();
      } else {
        fetchGlobalProducts();
      }
    }, [activeTab])
  );
  
  // Separate analytics fetch function
  const fetchAnalytics = async () => {
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
  };

  // Fetch analytics for inventory products
  useEffect(() => {
    if (activeTab === "inventory" && products.length > 0) {
      fetchAnalytics();
    }
  }, [activeTab]);

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
    const fields: Array<"name" | "totalQuantity" | "risk" | "velocity"> = ["name", "totalQuantity", "risk", "velocity"];
    const currentIndex = fields.indexOf(sortField);
    const nextIndex = (currentIndex + 1) % fields.length;
    setSortField(fields[nextIndex]);
  };

  // Fetch global registry products
  const fetchGlobalProducts = async () => {
    setLoadingGlobal(true);
    try {
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/products/registry/all`
      );
      setGlobalProducts(response.data.data || []);
    } catch (error) {
      console.error("Failed to fetch global products:", error);
      Toast.show({
        type: "error",
        text1: "Fetch Failed",
        text2: "Could not load global registry",
      });
    } finally {
      setLoadingGlobal(false);
    }
  };

  React.useEffect(() => {
    if (activeTab === "registry") {
      fetchGlobalProducts();
    }
  }, [activeTab]);

  const currentProducts = activeTab === "inventory" ? products : globalProducts;
  const currentLoading = activeTab === "inventory" ? loading : loadingGlobal;

  const filteredProducts = useMemo(() => {
    return currentProducts.filter((p) => {
      const searchLower = searchQuery.toLowerCase();
      return (
        p.name.toLowerCase().includes(searchLower) ||
        (p.barcode && p.barcode.includes(searchQuery)) ||
        (p.category && p.category.toLowerCase().includes(searchLower))
      );
    });
  }, [currentProducts, searchQuery]);

  const sortedProducts = useMemo(() => {
    return [...filteredProducts].sort((a, b) => {
      if (sortField === "risk" && activeTab === "inventory") {
        const riskA = analytics[a._id]?.riskScore || 0;
        const riskB = analytics[b._id]?.riskScore || 0;
        return riskB - riskA;
      } else if (sortField === "velocity" && activeTab === "inventory") {
        const velA = analytics[a._id]?.velocity || 0;
        const velB = analytics[b._id]?.velocity || 0;
        return velB - velA;
      } else if (sortField === "name") {
        return a.name.localeCompare(b.name);
      } else {
        return (b.totalQuantity || 0) - (a.totalQuantity || 0);
      }
    });
  }, [filteredProducts, sortField, analytics, activeTab]);

  const handleRefresh = async () => {
    if (activeTab === "inventory") {
      await refresh();
      await fetchAnalytics();
    } else {
      await fetchGlobalProducts();
    }
  };

  // FIXED: Handle navigation based on tab
  const handleProductPress = async (item: any) => {
    if (activeTab === "inventory") {
      // Local inventory - navigate directly with product ID
      router.push({
        pathname: "/admin/product/[id]",
        params: { id: item._id },
      });
    } else {
      // Global registry - check if product exists in local inventory first
      try {
        const localProduct = products.find((p) => p.barcode === item.barcode);
        
        if (localProduct) {
          // Product exists in local inventory - navigate to it
          router.push({
            pathname: "/admin/product/[id]",
            params: { id: localProduct._id },
          });
        } else {
          // Product NOT in local inventory - navigate to global product detail page
          router.push({
            pathname: "/admin/product/[id]",
            params: { id: item._id }, // Use global product ID
          });
        }
      } catch (error) {
        console.error("Error checking product:", error);
        Toast.show({
          type: "error",
          text1: "Error",
          text2: "Could not verify product status",
        });
      }
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <View style={styles.container}>
        <View style={styles.topSection}>
          <Text style={[styles.subtitle, { color: theme.primary }]}>
            ADMIN PANEL
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={[styles.title, { color: theme.text }]}>
              Inventory
            </Text>
            <HelpTooltip
              style={{marginBottom: 20}}
              title="Admin Inventory"
              content={[
                "Inventory Stock: View and manage products currently in your local inventory with stock levels and AI insights.",
                "Global Registry: Browse all products ever registered in the system, including items not currently in stock.",
                "AI Metrics: Risk scores predict waste likelihood, velocity shows sales speed (units/day).",
                "Status Badges: 'In Stock' means product exists locally, 'No Stock' means it's only in the registry."
              ]}
              icon="help-circle"
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
                placeholder="Search products..."
                placeholderTextColor={theme.subtext}
                style={[styles.searchInput, { color: theme.text }]}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/admin/scan",
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

          {/* TABS */}
          <View style={styles.tabContainer}>
            <Pressable
              onPress={() => setActiveTab("inventory")}
              style={[
                styles.tab,
                activeTab === "inventory" && {
                  borderBottomColor: theme.primary,
                },
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  {
                    color:
                      activeTab === "inventory" ? theme.text : theme.subtext,
                  },
                ]}
              >
                Inventory Stock
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab("registry")}
              style={[
                styles.tab,
                activeTab === "registry" && {
                  borderBottomColor: theme.primary,
                },
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  {
                    color:
                      activeTab === "registry" ? theme.text : theme.subtext,
                  },
                ]}
              >
                Global Registry
              </Text>
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
          keyExtractor={(item) => item._id || item.barcode}
          contentContainerStyle={styles.listPadding}
          numColumns={displayMode === "rect" ? 2 : 1}
          key={displayMode === "rect" ? "grid" : "list"}
          columnWrapperStyle={displayMode === "rect" ? styles.columnWrapper : undefined}
          refreshControl={
            <RefreshControl
              refreshing={currentLoading}
              onRefresh={handleRefresh}
              tintColor={theme.primary}
            />
          }
          renderItem={({ item }) => {
            // Check if registry item exists in local inventory
            const inLocalInventory = activeTab === "registry" 
              ? products.some((p) => p.barcode === item.barcode)
              : true;

            // Get analytics data (only for inventory tab)
            const productAnalytics = activeTab === "inventory" ? analytics[item._id] : null;
            const riskScore = productAnalytics?.riskScore || 0;
            const velocity = productAnalytics?.velocity || 0;
            const riskColor = getRiskColor(riskScore);
            const velocityIndicator = getVelocityIndicator(velocity);

            if (displayMode === "list") {
              return (
                <Pressable
                  onPress={() => handleProductPress(item)}
                  style={[styles.listItem, { borderBottomColor: theme.border }]}
                >
                  {/* Risk Dot */}
                  {riskColor && riskScore > 30 && activeTab === "inventory" && (
                    <View style={[styles.listRiskDot, { backgroundColor: riskColor }]} />
                  )}
                  
                  <View style={{ flex: 2, marginLeft: riskColor && riskScore > 30 && activeTab === "inventory" ? 8 : 0 }}>
                    <View style={styles.listNameRow}>
                      <Text
                        style={[styles.listName, { color: theme.text }]}
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>
                      {/* Velocity Indicator */}
                      {velocityIndicator && activeTab === "inventory" && (
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
                    {sortField === "risk" && activeTab === "inventory" ? (
                      productAnalytics && riskScore > 0 ? (
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
                      ) : (
                        <Text
                          style={[
                            styles.listQty,
                            {
                              color: theme.subtext,
                            },
                          ]}
                        >
                          —
                        </Text>
                      )
                    ) : sortField === "velocity" && activeTab === "inventory" ? (
                      productAnalytics && velocity > 0 ? (
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
                              color: theme.subtext,
                            },
                          ]}
                        >
                          —
                        </Text>
                      )
                    ) : (
                      <Text
                        style={[
                          styles.listQty,
                          {
                            color:
                              activeTab === "inventory" &&
                              (item.totalQuantity || 0) < 10
                                ? theme.notification
                                : theme.text,
                          },
                        ]}
                      >
                        {activeTab === "inventory"
                          ? `${item.totalQuantity || 0} units`
                          : inLocalInventory 
                          ? `${products.find((p) => p.barcode === item.barcode)?.totalQuantity || 0} units`
                          : "—"}
                      </Text>
                    )}
                  </View>
                </Pressable>
              );
            }
            
            if (displayMode === "rect") {
              // Rectangular card view (like dashboard)
              // Only show ProductCard for inventory tab with analytics
              if (activeTab === "inventory") {
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
              
              // For registry tab, show a simple card without analytics
              return (
                <ProductCard 
                  item={item}
                  prediction={null}
                  sortField="name"
                />
              );
            }

            return (
              <Pressable
                onPress={() => handleProductPress(item)}
                style={[
                  styles.itemCard,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
              >
                {/* Risk Dot */}
                {riskColor && riskScore > 30 && activeTab === "inventory" && (
                  <View style={[styles.riskDot, { backgroundColor: riskColor }]} />
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
                    <View style={styles.nameRow}>
                      <Text
                        style={[styles.name, { color: theme.text }]}
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>
                      {/* Velocity Indicator */}
                      {velocityIndicator && activeTab === "inventory" && (
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
                    {activeTab === "registry" && (
                      <View style={styles.statusRow}>
                        {inLocalInventory ? (
                          <View style={[styles.statusBadge, { backgroundColor: theme.primary + "20" }]}>
                            <Ionicons name="checkmark-circle" size={12} color={theme.primary} />
                            <Text style={[styles.statusText, { color: theme.primary }]}>
                              In Stock
                            </Text>
                          </View>
                        ) : (
                          <View style={[styles.statusBadge, { backgroundColor: "#FF9500" + "20" }]}>
                            <Ionicons name="alert-circle" size={12} color="#FF9500" />
                            <Text style={[styles.statusText, { color: "#FF9500" }]}>
                              No Stock
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                  <View style={styles.qtyBox}>
                    {sortField === "risk" && activeTab === "inventory" ? (
                      productAnalytics && riskScore > 0 ? (
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
                      ) : (
                        <>
                          <Text
                            style={[
                              styles.qtyValue,
                              {
                                color: theme.subtext,
                              },
                            ]}
                          >
                            —
                          </Text>
                          <Text style={[styles.qtyLabel, { color: theme.subtext }]}>
                            RISK
                          </Text>
                        </>
                      )
                    ) : sortField === "velocity" && activeTab === "inventory" ? (
                      productAnalytics && velocity > 0 ? (
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
                                color: theme.subtext,
                              },
                            ]}
                          >
                            —
                          </Text>
                          <Text style={[styles.qtyLabel, { color: theme.subtext }]}>
                            /DAY
                          </Text>
                        </>
                      )
                    ) : (
                      <>
                        <Text
                          style={[
                            styles.qtyValue,
                            {
                              color:
                                activeTab === "inventory" &&
                                (item.totalQuantity || 0) < 10
                                  ? theme.notification
                                  : theme.primary,
                            },
                          ]}
                        >
                          {activeTab === "inventory"
                            ? item.totalQuantity || 0
                            : inLocalInventory 
                            ? products.find((p) => p.barcode === item.barcode)?.totalQuantity || 0
                            : "—"}
                        </Text>
                        <Text style={[styles.qtyLabel, { color: theme.subtext }]}>
                          {activeTab === "inventory" ? "QTY" : "REG"}
                        </Text>
                      </>
                    )}
                  </View>
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons
                name="archive-outline"
                size={48}
                color={theme.subtext}
              />
              <Text style={[styles.emptyText, { color: theme.subtext }]}>
                No products found
              </Text>
            </View>
          }
        />
      </View>
    </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60 },
  topSection: { paddingHorizontal: 20, marginBottom: 10 },
  subtitle: { fontSize: 10, fontWeight: "900", letterSpacing: 2 },
  title: { fontSize: 25, fontWeight: "900", letterSpacing: -1, marginBottom: 20 },
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
  tabContainer: {
    flexDirection: "row",
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(150,150,150,0.1)",
  },
  tab: {
    paddingVertical: 10,
    marginRight: 20,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabText: { fontSize: 14, fontWeight: "800" },
  countRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  countText: { fontSize: 13, fontWeight: "600" },
  sortLabel: { fontSize: 11, fontWeight: "800" },
  listPadding: { paddingHorizontal: 20, paddingBottom: 100 },
  itemCard: { 
    borderRadius: 20, 
    borderWidth: 1, 
    marginBottom: 12, 
    padding: 16,
    position: 'relative',
  },
  riskDot: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    zIndex: 10,
  },
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
  image: { width: "100%", height: "100%", borderRadius: 12 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: { fontSize: 16, fontWeight: "800" },
  category: { fontSize: 12, fontWeight: "600", marginTop: 2 },
  statusRow: {
    flexDirection: "row",
    marginTop: 6,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  qtyBox: { alignItems: "center", minWidth: 40 },
  qtyValue: { fontSize: 20, fontWeight: "900" },
  qtyLabel: { fontSize: 9, fontWeight: "700" },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: "600",
  },
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
  columnWrapper: {
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
});