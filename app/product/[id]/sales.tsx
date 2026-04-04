import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Image,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View
} from "react-native";
import { useTheme } from "../../../context/ThemeContext";

interface SaleRecord {
  _id: string;
  productName: string;
  category: string;
  quantitySold: number;
  priceAtSale: number;
  totalAmount: number;
  saleDate: string;
  paymentMethod: string;
}

interface Product {
  _id: string;
  name: string;
  category: string;
  imageUrl: string;
  totalQuantity: number;
  batches: any[];
}

export default function ProductSalesDetails() {
  const { theme, isDark } = useTheme();

  const router = useRouter();
  const { id } = useLocalSearchParams();
  
  const [product, setProduct] = useState<Product | null>(null);
  const [salesHistory, setSalesHistory] = useState<SaleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch product details
      const productResponse = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/products/${id}`
      );
      setProduct(productResponse.data.data);

      // Fetch sales history for this product
      try {
        const salesResponse = await axios.get(
          `${process.env.EXPO_PUBLIC_API_URL}/analytics/product-sales/${id}`
        );
        setSalesHistory(salesResponse.data.data || []);
      } catch (salesError: any) {
        console.error("Error fetching sales data:", salesError);
        // If sales endpoint fails (e.g., MongoDB not connected), just show empty sales
        setSalesHistory([]);
      }
      
    } catch (error) {
      console.error("Error fetching product data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getTotalSales = () => {
    return salesHistory.reduce((sum, sale) => sum + sale.totalAmount, 0);
  };

  const getTotalUnitsSold = () => {
    return salesHistory.reduce((sum, sale) => sum + sale.quantitySold, 0);
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.text }]}>Loading sales data...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={[styles.backBtn, { backgroundColor: theme.surface }]}
          >
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </Pressable>
          
          <View style={styles.headerInfo}>
            <Text style={[styles.headerLabel, { color: theme.primary }]}>
              SALES_ANALYTICS
            </Text>
            <Text style={[styles.headerTitle, { color: theme.text }]}>
              Sales History
            </Text>
          </View>
        </View>

        {/* Product Info Card */}
        {product && (
          <View
            style={[
              styles.productCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <View style={styles.productHeader}>
              <View style={[styles.productImage, { backgroundColor: theme.background }]}>
                {product.imageUrl && product.imageUrl !== "cube" ? (
                  <Image
                    source={{ uri: product.imageUrl }}
                    style={styles.productImg}
                  />
                ) : (
                  <Ionicons name="cube-outline" size={32} color={theme.subtext} />
                )}
              </View>
              
              <View style={styles.productInfo}>
                <Text style={[styles.productName, { color: theme.text }]}>
                  {product.name}
                </Text>
                <Text style={[styles.productCategory, { color: theme.subtext }]}>
                  {product.category}
                </Text>
                <Text style={[styles.productStock, { color: theme.primary }]}>
                  Current Stock: {product.totalQuantity} units
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Sales Summary */}
        <View
          style={[
            styles.summaryCard,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.primary }]}>
            SALES SUMMARY
          </Text>
          
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Ionicons name="cash-outline" size={24} color={theme.primary} />
              <Text style={[styles.summaryValue, { color: theme.text }]}>
                ₦{getTotalSales().toLocaleString()}
              </Text>
              <Text style={[styles.summaryLabel, { color: theme.subtext }]}>
                Total Revenue
              </Text>
            </View>
            
            <View style={styles.summaryItem}>
              <Ionicons name="cube-outline" size={24} color={theme.primary} />
              <Text style={[styles.summaryValue, { color: theme.text }]}>
                {getTotalUnitsSold()}
              </Text>
              <Text style={[styles.summaryLabel, { color: theme.subtext }]}>
                Units Sold
              </Text>
            </View>
            
            <View style={styles.summaryItem}>
              <Ionicons name="receipt-outline" size={24} color={theme.primary} />
              <Text style={[styles.summaryValue, { color: theme.text }]}>
                {salesHistory.length}
              </Text>
              <Text style={[styles.summaryLabel, { color: theme.subtext }]}>
                Transactions
              </Text>
            </View>
          </View>
        </View>

        {/* Sales History */}
        <View style={styles.historySection}>
          <Text style={[styles.sectionTitle, { color: theme.primary }]}>
            TRANSACTION HISTORY
          </Text>
          
          {salesHistory.length === 0 ? (
            <View
              style={[
                styles.emptyState,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <Ionicons name="receipt-outline" size={64} color={theme.subtext + "40"} />
              <Text style={[styles.emptyText, { color: theme.subtext }]}>
                No sales recorded yet
              </Text>
              <Text style={[styles.emptyHint, { color: theme.subtext }]}>
                Sales will appear here once transactions are made
              </Text>
            </View>
          ) : (
            salesHistory.map((sale, index) => (
              <View
                key={sale._id}
                style={[
                  styles.saleItem,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
              >
                <View style={styles.saleHeader}>
                  <View style={styles.saleInfo}>
                    <Text style={[styles.saleDate, { color: theme.text }]}>
                      {formatDate(sale.saleDate)}
                    </Text>
                    <Text style={[styles.saleMethod, { color: theme.subtext }]}>
                      Payment: {sale.paymentMethod.toUpperCase()}
                    </Text>
                  </View>
                  
                  <View style={styles.saleAmount}>
                    <Text style={[styles.salePrice, { color: theme.primary }]}>
                      ₦{sale.totalAmount.toLocaleString()}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.saleDetails}>
                  <View style={styles.saleMetric}>
                    <Ionicons name="cube-outline" size={16} color={theme.subtext} />
                    <Text style={[styles.saleMetricText, { color: theme.subtext }]}>
                      {sale.quantitySold} units
                    </Text>
                  </View>
                  
                  <View style={styles.saleMetric}>
                    <Ionicons name="pricetag-outline" size={16} color={theme.subtext} />
                    <Text style={[styles.saleMetricText, { color: theme.subtext }]}>
                      ₦{sale.priceAtSale.toFixed(2)} per unit
                    </Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
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
  
  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 25,
  },
  backBtn: {
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
  
  // Product Card
  productCard: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 20,
  },
  productHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  productImg: {
    width: "100%",
    height: "100%",
    borderRadius: 15,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 4,
  },
  productCategory: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  productStock: {
    fontSize: 12,
    fontWeight: "700",
  },
  
  // Summary Card
  summaryCard: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.5,
    marginBottom: 15,
  },
  summaryGrid: {
    flexDirection: "row",
    gap: 15,
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: "900",
    marginTop: 8,
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center",
  },
  
  // History Section
  historySection: {
    marginBottom: 20,
  },
  emptyState: {
    padding: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "800",
    marginTop: 16,
  },
  emptyHint: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
    textAlign: "center",
  },
  
  // Sale Items
  saleItem: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  saleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  saleInfo: {
    flex: 1,
  },
  saleDate: {
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 4,
  },
  saleMethod: {
    fontSize: 12,
    fontWeight: "600",
  },
  saleAmount: {
    alignItems: "flex-end",
  },
  salePrice: {
    fontSize: 18,
    fontWeight: "900",
  },
  saleDetails: {
    flexDirection: "row",
    gap: 20,
  },
  saleMetric: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  saleMetricText: {
    fontSize: 12,
    fontWeight: "600",
  },
});