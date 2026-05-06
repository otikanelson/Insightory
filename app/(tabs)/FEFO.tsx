import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from "../../context/ThemeContext";
import { useAIPredictions } from "../../hooks/useAIPredictions";
import { useProducts } from "../../hooks/useProducts";
import { Prediction } from "../../types/ai-predictions";

export default function FEFOScreen() {
  const { theme } = useTheme();
  const { products, loading, refresh } = useProducts();
  const { fetchBatchPredictions } = useAIPredictions({ enableWebSocket: false, autoFetch: false });
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  // Note: Staff can always view the FEFO page, but some features may be disabled based on permissions

  // State to toggle view mode and sort mode
  const [viewByProduct, setViewByProduct] = useState(false);
  const [sortByAI, setSortByAI] = useState(false);
  const [predictions, setPredictions] = useState<Record<string, Prediction>>({});
  const [loadingPredictions, setLoadingPredictions] = useState(false);

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  // Helper function to format time remaining in a readable way
  const formatTimeRemaining = (days: number): string => {
    if (days < 0) return 'EXPIRED';
    
    // Less than 14 days: show in days
    if (days < 14) {
      return `${days}d_REMAINING`;
    }
    
    // Less than 60 days: show in weeks
    if (days < 60) {
      const weeks = Math.floor(days / 7);
      return `${weeks}w_REMAINING`;
    }
    
    // Less than 365 days: show in months
    if (days < 365) {
      const months = Math.floor(days / 30);
      return `${months}mo_REMAINING`;
    }
    
    // 365 days or more: show in years
    const years = Math.floor(days / 365);
    const remainingMonths = Math.floor((days % 365) / 30);
    if (remainingMonths > 0) {
      return `${years}y ${remainingMonths}mo_REMAINING`;
    }
    return `${years}y_REMAINING`;
  };

  // Fetch predictions for all perishable products
  useEffect(() => {
    const fetchPredictions = async () => {
      if (sortByAI && products.length > 0) {
        setLoadingPredictions(true);
        const perishableProducts = products.filter(p => p.isPerishable);
        const productIds = perishableProducts.map(p => p._id);
        
        if (productIds.length > 0) {
          try {
            const batchPredictions = await fetchBatchPredictions(productIds);
            const predictionsMap: Record<string, Prediction> = {};
            batchPredictions.forEach((pred: Prediction) => {
              if (pred.productId) {
                predictionsMap[pred.productId] = pred;
              }
            });
            setPredictions(predictionsMap);
          } catch (error) {
            console.error('Error fetching predictions:', error);
          }
        }
        setLoadingPredictions(false);
      }
    };
    fetchPredictions();
  }, [sortByAI, products, fetchBatchPredictions]);

  /** 
   * FEFO Technical Logic: Flattening Batches into a Priority Queue
   **/
  const priorityQueue = useMemo(() => {
    const queue: any[] = [];

    products.forEach((product) => {
      if (
        product.isPerishable &&
        product.batches &&
        product.batches.length > 0
      ) {
        const productBatches = product.batches.map((batch) => {
          const daysLeft = Math.ceil(
            (new Date(batch.expiryDate).getTime() - new Date().getTime()) /
              (1000 * 60 * 60 * 24),
          );
          
          // Get prediction data for this product
          const prediction = predictions[product._id];
          const riskScore = prediction?.metrics?.riskScore || 0;
          
          return {
            ...batch,
            parentName: product.name,
            parentId: product._id,
            daysLeft,
            category: product.category,
            totalStock: product.totalQuantity,
            riskScore,
            prediction,
          };
        });

        if (viewByProduct) {
          // Find the batch with earliest expiry for this product
          const earliestBatch = productBatches.reduce((prev, curr) =>
            prev.daysLeft < curr.daysLeft ? prev : curr,
          );
          queue.push(earliestBatch);
        } else {
          // Push all batches normally
          queue.push(...productBatches);
        }
      }
    });

    // Sort by AI risk or expiry date
    if (sortByAI) {
      // Sort by risk score (highest first), then by days left as tiebreaker
      return queue.sort((a, b) => {
        if (b.riskScore !== a.riskScore) {
          return b.riskScore - a.riskScore;
        }
        return a.daysLeft - b.daysLeft;
      });
    } else {
      // Sort by days left (earliest first)
      return queue.sort((a, b) => a.daysLeft - b.daysLeft);
    }
  }, [products, viewByProduct, sortByAI, predictions]);

  const getStatusColor = (days: number) => {
    if (days < 0) return "#FF4444"; // Expired (Red)
    if (days < 7) return "#ff6a00ff"; // Critical (Dark Orange)
    if (days < 30) return "#FFD700"; // Warning (Yellow/Gold)
    return "#4CAF50"; // Stable (Green)
  };

  const getRiskColor = (riskScore: number) => {
    if (riskScore >= 70) return '#FF3B30'; // Red
    if (riskScore >= 50) return '#FF9500'; // Orange
    if (riskScore >= 30) return '#FFCC00'; // Yellow
    return '#34C759'; // Green
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Blue Header */}
      <View style={[styles.blueHeader, { backgroundColor: theme.primary, paddingTop: insets.top + 16 }]}>
        <View style={styles.headerTop}>
          <View>
            <ThemedText style={[styles.headerDesc, { color: theme.primaryLight }]}>EXPIRY_MANAGEMENT</ThemedText>
            <ThemedText style={styles.headerTitle}>Priority Queue</ThemedText>
          </View>
          <View style={styles.headerIcons}>
            <Pressable
              style={styles.headerIconBtn}
              onPress={() => setSortByAI(!sortByAI)}
            >
              <Ionicons
                name={sortByAI ? 'sparkles' : 'sparkles-outline'}
                size={20}
                color="#FFF"
              />
            </Pressable>
            <Pressable
              style={styles.headerIconBtn}
              onPress={() => setViewByProduct(!viewByProduct)}
            >
              <Ionicons
                name={viewByProduct ? "copy" : "copy-outline"}
                size={20}
                color="#FFF"
              />
            </Pressable>
          </View>
        </View>
      </View>

      {/* Filter Section */}
      <View style={[styles.filterSection, { backgroundColor: theme.background }]}>
        <View style={styles.controlsRow}>
          <Pressable
            onPress={() => setSortByAI(!sortByAI)}
            style={[
              styles.filterToggle,
              {
                borderColor: sortByAI ? '#FF9500' : theme.primary,
                backgroundColor: sortByAI ? '#FF9500' : 'transparent',
              },
            ]}
          >
            <Ionicons
              name={sortByAI ? 'sparkles' : 'sparkles-outline'}
              size={10}
              color={sortByAI ? '#FFF' : theme.primary}
            />
            <ThemedText
              style={[
                styles.filterToggleText,
                { color: sortByAI ? '#FFF' : theme.text },
              ]}
            >
              {sortByAI ? 'AI_RISK' : 'EXPIRY'}
            </ThemedText>
          </Pressable>

          <Pressable
            onPress={() => setViewByProduct(!viewByProduct)}
            style={[
              styles.filterToggle,
              {
                borderColor: theme.primary,
                backgroundColor:
                  viewByProduct ? theme.primary : "transparent",
              },
            ]}
          >
            <Ionicons
              name={viewByProduct ? "copy" : "copy-outline"}
              size={10}
              color={viewByProduct ? "#FFF" : theme.primary}
            />
            <ThemedText
              style={[
                styles.filterToggleText,
                { color: viewByProduct ? "#FFF" : theme.text },
              ]}
            >
              {viewByProduct ? "BY_PRODUCT" : "BY_BATCH"}
            </ThemedText>
          </Pressable>
        </View>

        <View style={[styles.statsStrip, { borderColor: theme.border }]}>
          <ThemedText style={[styles.statsText, { color: theme.subtext }]}>
            MONITORING{" "}
            <ThemedText style={{ color: theme.text, }}>
              {priorityQueue.length}
            </ThemedText>{" "}
            {viewByProduct ? "UNIQUE_ITEMS" : "ACTIVE_BATCHES"}
          </ThemedText>
        </View>
      </View>

      <FlatList
        data={priorityQueue}
        keyExtractor={(item, idx) => (item._id || item.batchNumber) + idx}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refresh}
            tintColor={theme.primary}
          />
        }
        contentContainerStyle={styles.list}
        renderItem={({ item, index }) => {
          const statusColor = sortByAI ? getRiskColor(item.riskScore) : getStatusColor(item.daysLeft);

          return (
            <Pressable
              onPress={() => router.push(`/product/${item.parentId}`)}
              style={[
                styles.technicalRow,
                { 
                  backgroundColor: theme.surface, 
                  borderColor: theme.border,
                },
              ]}
            >
              <View
                style={[styles.indicator, { backgroundColor: statusColor }]}
              />

              <View style={styles.mainInfo}>
                <View style={styles.topLine}>
                  <View style={styles.batchIdContainer}>
                    <ThemedText style={[styles.batchId, { color: theme.subtext }]}>
                      {viewByProduct ?
                        "SOONEST_EXPIRY"
                      : `BATCH_#${item.batchNumber?.slice(-7).toUpperCase() || "MANUAL"}`
                      }
                    </ThemedText>
                  </View>
                  <View style={styles.rightInfo}>
                    {sortByAI && item.riskScore > 0 ? (
                      <>
                        <ThemedText style={[styles.daysCounter, { color: statusColor }]}>
                          RISK_{item.riskScore}/100
                        </ThemedText>
                        <ThemedText style={[styles.priorityScore, { color: theme.subtext }]}>
                          {formatTimeRemaining(item.daysLeft)}
                        </ThemedText>
                      </>
                    ) : (
                      <ThemedText style={[styles.daysCounter, { color: statusColor }]}>
                        {formatTimeRemaining(item.daysLeft)}
                      </ThemedText>
                    )}
                  </View>
                </View>

                <ThemedText
                  style={[styles.name, { color: theme.text }]}
                  numberOfLines={1}
                >
                  {item.parentName.toUpperCase()}
                </ThemedText>

                <View style={styles.bottomLine}>
                  <View style={styles.tag}>
                    <Ionicons
                      name="cube-outline"
                      size={10}
                      color={theme.primary}
                    />
                    <ThemedText style={[styles.tagText, { color: theme.subtext }]}>
                      {viewByProduct ? "Multi-Batch" : `${item.quantity} units`}
                    </ThemedText>
                  </View>
                  <View style={styles.tag}>
                    <Ionicons
                      name="calendar-outline"
                      size={10}
                      color={theme.primary}
                    />
                    <ThemedText style={[styles.tagText, { color: theme.subtext }]}>
                      {new Date(item.expiryDate).toLocaleDateString()}
                    </ThemedText>
                  </View>
                  {sortByAI && item.prediction?.recommendations?.[0] && (
                    <View style={[styles.riskBadge, { backgroundColor: statusColor }]}>
                      <ThemedText style={styles.riskBadgeText}>
                        {item.prediction.recommendations[0].priority.toUpperCase()}
                      </ThemedText>
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.rankContainer}>
                <ThemedText style={[styles.rankText, { color: theme.border }]}>
                  {index + 1}
                </ThemedText>
                {loadingPredictions && sortByAI && (
                  <ActivityIndicator size="small" color={theme.primary} style={{ marginTop: 4 }} />
                )}
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          !loading ?
            <View style={styles.emptyContainer}>
              <Ionicons
                name="shield-checkmark-outline"
                size={48}
                color={theme.subtext + "40"}
              />
              <ThemedText style={[styles.emptyText, { color: theme.subtext }]}>
                ALL_SYSTEMS_STABLE
              </ThemedText>
              <ThemedText
                style={{ color: theme.subtext, fontSize: 12, marginTop: 5 }}
              >
                No expiring items detected in current registry
              </ThemedText>
            </View>
          : null
        }
      />
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
  filterSection: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  controlsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  filterToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  filterToggleText: {
    fontSize: 12,
    fontWeight: "700",
  },
  statsStrip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(150,150,150,0.2)",
  },
  statsText: {
    fontSize: 12,
    fontWeight: "600",
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 120,
  },
  technicalRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  indicator: {
    width: 4,
    height: "100%",
    borderRadius: 2,
    minHeight: 80,
  },
  mainInfo: {
    flex: 1,
  },
  topLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  batchIdContainer: {
    flex: 1,
  },
  batchId: {
    fontSize: 11,
    fontWeight: "600",
  },
  rightInfo: {
    alignItems: "flex-end",
  },
  daysCounter: {
    fontSize: 14,
    fontWeight: "900",
  },
  priorityScore: {
    fontSize: 11,
    marginTop: 2,
  },
  name: {
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 8,
  },
  bottomLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "rgba(150,150,150,0.1)",
  },
  tagText: {
    fontSize: 10,
    fontWeight: "600",
  },
  riskBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  riskBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFF",
  },
  rankContainer: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 40,
  },
  rankText: {
    fontSize: 16,
    fontWeight: "900",
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: "600",
  },
});
