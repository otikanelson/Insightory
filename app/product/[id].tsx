import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View
} from "react-native";
import { PredictionCard } from "../../components/PredictionCard";
import { useTheme } from "../../context/ThemeContext";
import { useAIPredictions } from "../../hooks/useAIPredictions";
import { useProducts } from "../../hooks/useProducts";

interface Batch {
  batchNumber: string;
  quantity: number;
  expiryDate: string;
  receivedDate?: string;
  price?: number;
}

export default function ProductDetails() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { theme, isDark } = useTheme();

  const { getProductById } = useProducts();
  const { prediction, loading: predictionLoading } = useAIPredictions({ 
    productId: id as string,
    enableWebSocket: true,
    autoFetch: true
  });

  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProduct();
  }, [id]);

  const loadProduct = async () => {
    setLoading(true);
    const data = await getProductById(id as string);
    setProduct(data);
    setLoading(false);
  };

  // Price analytics
  const priceAnalytics = useMemo(() => {
    if (!product) return null;

    const genericPrice = product.genericPrice || null;
    const batches = product.batches || [];
    
    const batchesWithPrice = batches.filter((b: Batch) => b.price && b.price > 0);
    
    if (batchesWithPrice.length === 0) {
      return {
        genericPrice,
        hasBatchPrices: false,
        avgBatchPrice: null,
        minBatchPrice: null,
        maxBatchPrice: null,
      };
    }

    const prices = batchesWithPrice.map((b: Batch) => b.price!);
    const avgBatchPrice = prices.reduce((sum: number, p: number) => sum + p, 0) / prices.length;
    const minBatchPrice = Math.min(...prices);
    const maxBatchPrice = Math.max(...prices);

    return {
      genericPrice,
      hasBatchPrices: true,
      avgBatchPrice,
      minBatchPrice,
      maxBatchPrice,
      priceVariance: maxBatchPrice - minBatchPrice,
    };
  }, [product]);

  // Expiry analytics
  const expiryAnalytics = useMemo(() => {
    if (!product || !product.batches) return null;

    const now = new Date();
    const batches = product.batches;

    const expiringSoon = batches.filter((b: Batch) => {
      const expiry = new Date(b.expiryDate);
      const daysUntilExpiry = Math.ceil(
        (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      return daysUntilExpiry > 0 && daysUntilExpiry <= 30;
    });

    const expired = batches.filter((b: Batch) => {
      const expiry = new Date(b.expiryDate);
      return expiry < now;
    });

    return {
      expiringSoonCount: expiringSoon.length,
      expiredCount: expired.length,
      totalBatches: batches.length,
    };
  }, [product]);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.text }]}>Loading product...</Text>
        </View>
      </View>
    );
  }

  if (!product) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={theme.subtext} />
          <Text style={[styles.errorText, { color: theme.text }]}>Product not found</Text>
        </View>
      </View>
    );
  }

  const stockStatus =
    product.totalQuantity === 0
      ? "Out of Stock"
      : product.totalQuantity < 10
        ? "Low Stock"
        : "In Stock";

  const stockColor =
    product.totalQuantity === 0
      ? "#EF4444"
      : product.totalQuantity < 10
        ? "#F59E0B"
        : "#10B981";

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={[styles.backButton, { backgroundColor: theme.surface }]}
          >
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </Pressable>
          
          <View style={styles.headerInfo}>
            <Text style={[styles.headerLabel, { color: theme.primary }]}>
              PRODUCT DETAILS
            </Text>
            <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
              {product.name}
            </Text>
          </View>
        </View>

        {/* Wide Product Image */}
        <View style={[styles.imageContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Image
            source={
              product.imageUrl
                ? { uri: product.imageUrl }
                : require("../../assets/images/icon.png")
            }
            style={styles.productImage}
            resizeMode="stretch"
          />
        </View>

        {/* Product Info Card */}
        <View style={[styles.infoCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.infoHeader}>
            <View style={styles.infoMain}>
              <Text style={[styles.productCategory, { color: theme.primary }]}>
                {product.category}
              </Text>
              <View style={[styles.statusBadge, { backgroundColor: stockColor + '20', borderColor: stockColor }]}>
                <Ionicons name="alert-circle" size={14} color={stockColor} />
                <Text style={[styles.statusText, { color: stockColor }]}>
                  {stockStatus}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Ionicons name="cube-outline" size={24} color={theme.primary} />
              <Text style={[styles.statValue, { color: theme.text }]}>
                {product.totalQuantity}
              </Text>
              <Text style={[styles.statLabel, { color: theme.subtext }]}>
                In Stock
              </Text>
            </View>

            <View style={styles.statItem}>
              <Ionicons name="barcode-outline" size={24} color={theme.primary} />
              <Text style={[styles.statValue, { color: theme.text }]} numberOfLines={1}>
                {product.barcode || "N/A"}
              </Text>
              <Text style={[styles.statLabel, { color: theme.subtext }]}>
                Barcode
              </Text>
            </View>

            <View style={styles.statItem}>
              <Ionicons name="layers-outline" size={24} color={theme.primary} />
              <Text style={[styles.statValue, { color: theme.text }]}>
                {product.batches?.length || 0}
              </Text>
              <Text style={[styles.statLabel, { color: theme.subtext }]}>
                Batches
              </Text>
            </View>
          </View>
        </View>

        {/* AI Prediction Card - Simplified for Users */}
        <PredictionCard 
          prediction={prediction} 
          loading={predictionLoading}
        />

        {/* Price Information */}
        {priceAnalytics && (priceAnalytics.genericPrice || priceAnalytics.hasBatchPrices) && (
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.cardTitle, { color: theme.primary }]}>
              PRICE INFORMATION
            </Text>

            {priceAnalytics.genericPrice && (
              <View style={styles.priceRow}>
                <View style={styles.priceInfo}>
                  <Ionicons name="cash-outline" size={20} color={theme.subtext} />
                  <Text style={[styles.priceLabel, { color: theme.subtext }]}>
                    Generic Price
                  </Text>
                </View>
                <Text style={[styles.priceValue, { color: theme.text }]}>
                  ${priceAnalytics.genericPrice.toFixed(2)}
                </Text>
              </View>
            )}

            {priceAnalytics.hasBatchPrices && (
              <>
                <View style={styles.priceRow}>
                  <View style={styles.priceInfo}>
                    <Ionicons name="trending-up-outline" size={20} color={theme.subtext} />
                    <Text style={[styles.priceLabel, { color: theme.subtext }]}>
                      Avg Batch Price
                    </Text>
                  </View>
                  <Text style={[styles.priceValue, { color: theme.text }]}>
                    ${priceAnalytics.avgBatchPrice?.toFixed(2)}
                  </Text>
                </View>
                <View style={styles.priceRow}>
                  <View style={styles.priceInfo}>
                    <Ionicons name="swap-horizontal-outline" size={20} color={theme.subtext} />
                    <Text style={[styles.priceLabel, { color: theme.subtext }]}>
                      Price Range
                    </Text>
                  </View>
                  <Text style={[styles.priceValue, { color: theme.text }]}>
                    ${priceAnalytics.minBatchPrice?.toFixed(2)} - $
                    {priceAnalytics.maxBatchPrice?.toFixed(2)}
                  </Text>
                </View>
              </>
            )}
          </View>
        )}

        {/* Expiry Analytics */}
        {product.isPerishable && expiryAnalytics && (
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.cardTitle, { color: theme.primary }]}>
              EXPIRY STATUS
            </Text>

            <View style={styles.expiryGrid}>
              <View style={styles.expiryItem}>
                <View style={[styles.expiryIcon, { backgroundColor: '#F59E0B' + '20' }]}>
                  <Ionicons name="time-outline" size={24} color="#F59E0B" />
                </View>
                <Text style={[styles.expiryCount, { color: "#F59E0B" }]}>
                  {expiryAnalytics.expiringSoonCount}
                </Text>
                <Text style={[styles.expiryLabel, { color: theme.subtext }]}>
                  Expiring Soon
                </Text>
              </View>

              <View style={styles.expiryItem}>
                <View style={[styles.expiryIcon, { backgroundColor: '#EF4444' + '20' }]}>
                  <Ionicons name="alert-circle-outline" size={24} color="#EF4444" />
                </View>
                <Text style={[styles.expiryCount, { color: "#EF4444" }]}>
                  {expiryAnalytics.expiredCount}
                </Text>
                <Text style={[styles.expiryLabel, { color: theme.subtext }]}>
                  Expired
                </Text>
              </View>

              <View style={styles.expiryItem}>
                <View style={[styles.expiryIcon, { backgroundColor: theme.primary + '20' }]}>
                  <Ionicons name="checkmark-circle-outline" size={24} color={theme.primary} />
                </View>
                <Text style={[styles.expiryCount, { color: theme.primary }]}>
                  {expiryAnalytics.totalBatches}
                </Text>
                <Text style={[styles.expiryLabel, { color: theme.subtext }]}>
                  Total Batches
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Batches */}
        {product.batches && product.batches.length > 0 && (
          <View style={styles.batchesSection}>
            <Text style={[styles.cardTitle, { color: theme.primary }]}>
              BATCH INVENTORY ({product.batches.length})
            </Text>

            {product.batches.map((batch: Batch, index: number) => {
              const expiryDate = new Date(batch.expiryDate);
              const now = new Date();
              const daysUntilExpiry = Math.ceil(
                (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
              );

              const isExpired = daysUntilExpiry < 0;
              const isExpiringSoon = daysUntilExpiry > 0 && daysUntilExpiry <= 30;

              const expiryColor = isExpired
                ? "#EF4444"
                : isExpiringSoon
                  ? "#F59E0B"
                  : "#10B981";

              return (
                <View
                  key={index}
                  style={[
                    styles.batchItem,
                    { 
                      backgroundColor: theme.surface,
                      borderColor: theme.border,
                      borderLeftColor: expiryColor,
                    },
                  ]}
                >
                  <View style={styles.batchHeader}>
                    <View style={styles.batchInfo}>
                      <Text style={[styles.batchNumber, { color: theme.text }]}>
                        {batch.batchNumber}
                      </Text>
                      <Text style={[styles.batchQuantity, { color: theme.primary }]}>
                        {batch.quantity} units
                      </Text>
                    </View>
                    
                    {batch.price && (
                      <Text style={[styles.batchPrice, { color: theme.text }]}>
                        ${batch.price.toFixed(2)}
                      </Text>
                    )}
                  </View>

                  <View style={styles.batchDetails}>
                    <View style={styles.batchDetail}>
                      <Ionicons name="calendar-outline" size={16} color={theme.subtext} />
                      <Text style={[styles.batchDetailText, { color: theme.subtext }]}>
                        Expires: {expiryDate.toLocaleDateString()}
                      </Text>
                    </View>

                    {(batch as any).manufacturerDate && (
                      <View style={styles.batchDetail}>
                        <Ionicons name="construct-outline" size={16} color={theme.subtext} />
                        <Text style={[styles.batchDetailText, { color: theme.subtext }]}>
                          Mfg: {new Date((batch as any).manufacturerDate).toLocaleDateString()}
                        </Text>
                      </View>
                    )}

                    <View style={styles.batchDetail}>
                      <Ionicons name="alert-circle-outline" size={16} color={expiryColor} />
                      <Text style={[styles.batchDetailText, { color: expiryColor }]}>
                        {isExpired
                          ? "Expired"
                          : isExpiringSoon
                            ? `${daysUntilExpiry} days left`
                            : "Good condition"}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: "600",
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  
  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 25,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  headerInfo: {
    flex: 1,
  },
  headerLabel: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 2,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  
  // Wide Image Container
  imageContainer: {
    width: "100%",
    height: 250,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 20,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  productImage: {
    width: "100%",
    height: "100%",
    borderRadius: 10,
  },
  
  // Info Card
  infoCard: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 20,
  },
  infoHeader: {
    marginBottom: 20,
  },
  infoMain: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  productCategory: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  statsGrid: {
    flexDirection: "row",
    gap: 15,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "900",
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center",
  },
  
  // Cards
  card: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.5,
    marginBottom: 15,
  },
  
  // Price Rows
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(150,150,150,0.1)",
  },
  priceInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  priceLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  priceValue: {
    fontSize: 16,
    fontWeight: "800",
  },
  
  // Expiry Grid
  expiryGrid: {
    flexDirection: "row",
    gap: 15,
  },
  expiryItem: {
    flex: 1,
    alignItems: "center",
  },
  expiryIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  expiryCount: {
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 4,
  },
  expiryLabel: {
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
  },
  
  // Batches Section
  batchesSection: {
    marginBottom: 20,
  },
  batchItem: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderLeftWidth: 4,
    marginTop: 12,
  },
  batchHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  batchInfo: {
    flex: 1,
  },
  batchNumber: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 4,
  },
  batchQuantity: {
    fontSize: 13,
    fontWeight: "700",
  },
  batchPrice: {
    fontSize: 18,
    fontWeight: "900",
  },
  batchDetails: {
    gap: 8,
  },
  batchDetail: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  batchDetailText: {
    fontSize: 13,
    fontWeight: "600",
  },
});
