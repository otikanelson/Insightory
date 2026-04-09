import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import { useAudioPlayer } from "expo-audio";

import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    Modal,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View
} from "react-native";
import Toast from "react-native-toast-message";
import { AddProductModal } from "../../components/AddProductModal";
import { DisabledFeatureOverlay } from "../../components/DisabledFeatureOverlay";
import { HelpTooltip } from "../../components/HelpTooltip";
import { useTheme } from "../../context/ThemeContext";
import { useFeatureAccess } from "../../hooks/useFeatureAccess";
import { useProducts } from "../../hooks/useProducts";

const { width } = Dimensions.get("window");

interface SaleRecord {
  _id: string;
  productId: string;
  productName: string;
  batchNumber: string;
  quantitySold: number;
  price: number;
  totalAmount: number;
  saleDate: string;
  paymentMethod: string;
}

interface RevenueStats {
  today: number;
  week: number;
  month: number;
  totalSales: number;
}

export default function AdminSales() {
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const { products, refresh } = useProducts();
  const { cartData } = useLocalSearchParams();
  
  // Check feature access for processing sales
  const salesAccess = useFeatureAccess('processSales');

  // State - must be declared before any early returns
  const [cart, setCart] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showFefoModal, setShowFefoModal] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [activeTab, setActiveTab] = useState<"checkout" | "history">("checkout");
  
  // Sales History State
  const [salesHistory, setSalesHistory] = useState<SaleRecord[]>([]);
  const [revenueStats, setRevenueStats] = useState<RevenueStats>({
    today: 0,
    week: 0,
    month: 0,
    totalSales: 0
  });
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedSale, setSelectedSale] = useState<SaleRecord | null>(null);
  const [showSaleDetails, setShowSaleDetails] = useState(false);

  // Audio
  const scanBeep = useAudioPlayer(require("../../assets/sounds/beep.mp3"));

  // Define fetchSalesHistory before using it
  const fetchSalesHistory = async () => {
    setLoadingHistory(true);
    try {
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/analytics/all-sales?limit=100&days=365`
      );
      
      if (response.data.success) {
        // Handle both response formats
        const salesData = response.data.data?.sales || response.data.data || [];
        
        // Transform to match our SaleRecord interface
        const sales: SaleRecord[] = salesData.map((sale: any) => ({
          _id: sale._id,
          productId: sale.productId,
          productName: sale.productName,
          batchNumber: sale.batchNumber || 'N/A',
          quantitySold: sale.quantitySold || 0,
          price: sale.priceAtSale || 0,
          totalAmount: sale.totalAmount || 0,
          saleDate: sale.saleDate,
          paymentMethod: sale.paymentMethod || 'cash'
        }));
        
        setSalesHistory(sales);
        
        // Calculate revenue stats
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        
        const stats = {
          today: sales
            .filter(s => new Date(s.saleDate) >= todayStart)
            .reduce((sum, s) => sum + (s.totalAmount || 0), 0),
          week: sales
            .filter(s => new Date(s.saleDate) >= weekStart)
            .reduce((sum, s) => sum + (s.totalAmount || 0), 0),
          month: sales
            .filter(s => new Date(s.saleDate) >= monthStart)
            .reduce((sum, s) => sum + (s.totalAmount || 0), 0),
          totalSales: sales.length
        };
        
        setRevenueStats(stats);
        
        if (sales.length === 0) {
          Toast.show({
            type: 'info',
            text1: 'No Sales Yet',
            text2: 'Start selling to see your sales history'
          });
        }
      }
    } catch (error) {
      console.error('Error fetching sales history:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to Load',
        text2: 'Could not fetch sales history'
      });
    } finally {
      setLoadingHistory(false);
    }
  };
  
  // Refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (activeTab === "checkout") {
        refresh();
      } else if (activeTab === "history") {
        fetchSalesHistory();
      }
    }, [activeTab])
  );

  // Initialize cart from scanner if data is passed
  useEffect(() => {
    if (cartData && typeof cartData === 'string') {
      try {
        const parsedCart = JSON.parse(cartData);
        setCart(parsedCart);
        // Set active tab to checkout when cart data is passed
        setActiveTab("checkout");
        Toast.show({
          type: 'success',
          text1: 'Cart Loaded',
          text2: `${parsedCart.length} items ready for checkout`
        });
      } catch (error) {
        console.error('Error parsing cart data:', error);
      }
    }
  }, [cartData]);

  // Process FEFO Sale
  const finalizeSale = async () => {
    setIsSyncing(true);
    try {
      const saleData = cart.map((item) => {
        // Get price from the product - use genericPrice or average batch price
        const product = products.find(p => p._id === item._id);
        let price = 0;
        
        if (product) {
          if (product.genericPrice && product.genericPrice > 0) {
            price = product.genericPrice;
          } else if (product.batches && product.batches.length > 0) {
            // Calculate average price from batches with prices
            const batchesWithPrice = product.batches.filter(b => (b as any).price && (b as any).price > 0);
            if (batchesWithPrice.length > 0) {
              price = batchesWithPrice.reduce((sum, b) => sum + ((b as any).price || 0), 0) / batchesWithPrice.length;
            }
          }
        }

        return {
          productId: item._id,
          quantity: item.quantity,
          price: price,
          paymentMethod: 'cash' // Default payment method
        };
      });

      await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL}/products/process-sale`,
        { items: saleData }
      );

      setCart([]);
      setShowFefoModal(false);
      refresh();
      
      // Refresh sales history if on that tab
      if (activeTab === "history") {
        fetchSalesHistory();
      }
      
      Toast.show({
        type: "success",
        text1: "Transaction Complete",
        text2: "Inventory updated via FEFO logic",
      });
      
      // Navigate back to scanner with clear flag
      router.push({
        pathname: "/admin/scan",
        params: { clearCart: "true" }
      });
    } catch (err) {
      console.error("Sale Error:", err);
      Toast.show({
        type: "error",
        text1: "Transaction Failed",
        text2: "Could not process sale",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prevCart) =>
      prevCart.map((item) => {
        if (item._id === productId) {
          const newQty = Math.max(1, item.quantity + delta);
          const maxStock = item.totalQuantity || 999; // Fallback if totalQuantity is missing
          return {
            ...item,
            quantity: Math.min(newQty, maxStock),
          };
        }
        return item;
      })
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prevCart) => prevCart.filter((item) => item._id !== productId));
  };

  const formatCurrency = (amount: number | undefined) => {
    if (amount === undefined || amount === null) return '₦0';
    return `₦${amount.toLocaleString()}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    
    // Reset time to midnight for accurate day comparison
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const nowOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const diffTime = nowOnly.getTime() - dateOnly.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const renderSaleItem = ({ item }: { item: SaleRecord }) => (
    <Pressable
      style={[styles.saleCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
      onPress={() => {
        setSelectedSale(item);
        setShowSaleDetails(true);
      }}
    >
      <View style={styles.saleHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.saleName, { color: theme.text }]} numberOfLines={1}>
            {item.productName}
          </Text>
          <Text style={[styles.saleDate, { color: theme.subtext }]}>
            {formatDate(item.saleDate)}
          </Text>
        </View>
        <View style={styles.saleAmountContainer}>
          <Text style={[styles.saleAmount, { color: theme.primary }]}>
            {formatCurrency(item.totalAmount)}
          </Text>
          <Text style={[styles.saleQuantity, { color: theme.subtext }]}>
            {item.quantitySold} units
          </Text>
        </View>
      </View>
      <View style={styles.saleMeta}>
        <View style={[styles.saleBadge, { backgroundColor: theme.primary + "15" }]}>
          <Text style={[styles.saleBadgeText, { color: theme.primary }]}>
            {item.batchNumber || "N/A"}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={theme.subtext} />
      </View>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Show overlay if access is denied */}
      {!salesAccess.isAllowed ? (
        <DisabledFeatureOverlay reason={salesAccess.reason || 'Access denied'} />
      ) : (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
      

      {/* Technical Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View>
            <Text style={[styles.systemLabel, { color: theme.primary }]}>
              ADMIN//SALES_TERMINAL
            </Text>
            <Text style={[styles.title, { color: theme.text }]}>
              {activeTab === "checkout" ? "TRANSACTIONS" : "SALES_HISTORY"}
            </Text>
          </View>
          <HelpTooltip
            style={{marginTop: 20}}
            title="Admin Sales"
            content={[
              "Checkout Tab: Scan products to add them to the cart, adjust quantities, and complete transactions.",
              "FEFO Logic: All sales automatically use First-Expired-First-Out logic to deduct from batches closest to expiry, ensuring stock freshness.",
              "History Tab: View past sales with revenue stats (today, week, month), batch numbers, and transaction details.",
              "Revenue Stats: Track daily, weekly, and monthly sales performance to monitor business trends."
            ]}
            icon="help-circle"
            iconSize={18}
            iconColor={theme.primary}
          />
        </View>

        <View style={{ flexDirection: 'row', gap: 10, alignItems: "flex-end" }}>
          <Pressable
            onPress={() => router.push("/admin/settings")}
            style={[styles.settingsButton, { backgroundColor: theme.surface, borderColor: theme.primary }]}
          >
            <Ionicons name="settings-outline" size={18} color={theme.primary} />
          </Pressable>
          <Pressable
            onPress={() => router.push("/admin/scan")}
            style={[styles.scanButton, { backgroundColor: theme.primary }]}
          >
            <Ionicons name="scan" size={18} color="#FFF" />
          </Pressable>
        </View>
      </View>

      {/* Tab Switcher */}
      <View style={styles.tabContainer}>
        <Pressable
          onPress={() => setActiveTab("checkout")}
          style={[
            styles.tab,
            activeTab === "checkout" && { borderBottomColor: theme.primary },
          ]}
        >
          <Ionicons 
            name="cart-outline" 
            size={18} 
            color={activeTab === "checkout" ? theme.primary : theme.subtext} 
          />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === "checkout" ? theme.text : theme.subtext },
            ]}
          >
            Checkout
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab("history")}
          style={[
            styles.tab,
            activeTab === "history" && { borderBottomColor: theme.primary },
          ]}
        >
          <Ionicons 
            name="time-outline" 
            size={18} 
            color={activeTab === "history" ? theme.primary : theme.subtext} 
          />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === "history" ? theme.text : theme.subtext },
            ]}
          >
            History
          </Text>
        </Pressable>
      </View>

      {activeTab === "checkout" ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Sales Session Panel */}
          <View
            style={[
              styles.sessionPanel,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <View style={styles.panelHeader}>
              <View style={styles.statusRow}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: cart.length > 0 ? "#34C759" : theme.border },
                  ]}
                />
                <Text style={[styles.panelTitle, { color: theme.text }]}>
                  ACTIVE SESSION
                </Text>
              </View>
              <Text style={[styles.itemCount, { color: theme.subtext }]}>
                {cart.length} {cart.length === 1 ? "ITEM" : "ITEMS"}
              </Text>
            </View>

            {/* Product List - Professional Table Style */}
            {cart.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="cart-outline" size={64} color={theme.subtext + "40"} />
                <Text style={[styles.emptyText, { color: theme.subtext }]}>
                  NO ITEMS IN SESSION
                </Text>
                <Text style={[styles.emptyHint, { color: theme.subtext }]}>
                  Scan products or add manually to begin transaction
                </Text>
              </View>
            ) : (
              <View style={styles.productList}>
                {/* Table Header */}
                <View
                  style={[
                    styles.tableHeader,
                    { borderBottomColor: theme.border },
                  ]}
                >
                  <Text
                    style={[
                      styles.tableHeaderText,
                      { color: theme.subtext, flex: 1 },
                    ]}
                  >
                    PRODUCT
                  </Text>
                  <Text
                    style={[
                      styles.tableHeaderText,
                      { color: theme.subtext, width: 120, textAlign: "center" },
                    ]}
                  >
                    QUANTITY
                  </Text>
                  <Text
                    style={[
                      styles.tableHeaderText,
                      { color: theme.subtext, width: 40 },
                    ]}
                  >
                    {" "}
                  </Text>
                </View>

                {/* Product Rows */}
                {cart.map((item, index) => (
                  <View
                    key={item._id}
                    style={[
                      styles.productRow,
                      {
                        borderBottomColor: theme.border,
                        borderBottomWidth: index < cart.length - 1 ? 1 : 0,
                      },
                    ]}
                  >
                    {/* Product Info */}
                    <View style={styles.productInfo}>
                      <Text
                        style={[styles.productName, { color: theme.text }]}
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>
                      <Text style={[styles.productMeta, { color: theme.subtext }]}>
                        Available: {item.totalQuantity || 0} units
                      </Text>
                    </View>

                    {/* Quantity Controls */}
                    <View style={styles.quantityControls}>
                      <Pressable
                        style={[
                          styles.qtyButton,
                          { 
                            backgroundColor: theme.background,
                            borderWidth: 1,
                            borderColor: theme.border,
                          },
                        ]}
                        onPress={() => updateQuantity(item._id, -1)}
                      >
                        <Ionicons name="remove" size={16} color={theme.text} />
                      </Pressable>

                      <View style={styles.qtyDisplay}>
                        <Text style={[styles.qtyText, { color: theme.text }]}>
                          {item.quantity}
                        </Text>
                      </View>

                      <Pressable
                        style={[
                          styles.qtyButton,
                          { 
                            backgroundColor: theme.background,
                            borderWidth: 1,
                            borderColor: theme.border,
                          },
                        ]}
                        onPress={() => updateQuantity(item._id, 1)}
                      >
                        <Ionicons name="add" size={16} color={theme.text} />
                      </Pressable>
                    </View>

                    {/* Remove Button */}
                    <Pressable
                      style={styles.removeButton}
                      onPress={() => removeFromCart(item._id)}
                    >
                      <Ionicons name="close-circle" size={24} color="#FF3B30" />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            {/* Add Product Button - Always visible */}
            <Pressable
              style={[styles.addManualButton, { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, marginTop: cart.length > 0 ? 16 : 0 }]}
              onPress={() => {
                if (products.length > 0) {
                  setShowProductPicker(true);
                } else {
                  Toast.show({
                    type: 'error',
                    text1: 'No Products',
                    text2: 'Add products to inventory first'
                  });
                }
              }}
            >
              <Ionicons name="add-circle-outline" size={20} color={theme.primary} />
              <Text style={[styles.addManualButtonText, { color: theme.primary }]}>Add Product Manually</Text>
            </Pressable>

            {/* Complete Transaction Button */}
            {cart.length > 0 && (
              <Pressable
                style={[styles.completeButton, { backgroundColor: theme.primary }]}
                onPress={() => setShowFefoModal(true)}
              >
                <Ionicons name="checkmark-done" size={20} color="#FFF" />
                <Text style={styles.completeButtonText}>
                  COMPLETE TRANSACTION
                </Text>
              </Pressable>
            )}
          </View>

          {/* Info Panel */}
          <View
            style={[
              styles.infoPanel,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Ionicons name="information-circle-outline" size={20} color={theme.primary} />
            <Text style={[styles.infoText, { color: theme.subtext }]}>
              All sales use FEFO (First-Expired-First-Out) logic to automatically
              deduct from batches closest to expiry
            </Text>
          </View>
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>
          {/* Revenue Stats with Export Button */}
          <View style={styles.historyHeader}>
            <View style={styles.statsContainer}>
              <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.statLabel, { color: theme.subtext }]}>TODAY</Text>
                <Text style={[styles.statValue, { color: theme.primary }]}>
                  {formatCurrency(revenueStats.today)}
                </Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.statLabel, { color: theme.subtext }]}>THIS WEEK</Text>
                <Text style={[styles.statValue, { color: theme.primary }]}>
                  {formatCurrency(revenueStats.week)}
                </Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.statLabel, { color: theme.subtext }]}>THIS MONTH</Text>
                <Text style={[styles.statValue, { color: theme.primary }]}>
                  {formatCurrency(revenueStats.month)}
                </Text>
              </View>
            </View>
            
            {/* Export PDF Button */}
            <Pressable
              style={[styles.exportButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
              onPress={async () => {
                try {
                  // Generate PDF content as HTML
                  const htmlContent = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                      <meta charset="utf-8">
                      <title>Sales Report - ${new Date().toLocaleDateString()}</title>
                      <style>
                        body { font-family: Arial, sans-serif; padding: 20px; }
                        h1 { color: #4C6FFF; }
                        .stats { display: flex; gap: 20px; margin: 20px 0; }
                        .stat-card { border: 1px solid #ddd; padding: 15px; border-radius: 8px; flex: 1; }
                        .stat-label { font-size: 12px; color: #666; text-transform: uppercase; }
                        .stat-value { font-size: 24px; font-weight: bold; color: #4C6FFF; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
                        th { background-color: #f5f5f5; font-weight: bold; }
                        .footer { margin-top: 40px; text-align: center; color: #666; font-size: 12px; }
                      </style>
                    </head>
                    <body>
                      <h1>Sales Report</h1>
                      <p>Generated on: ${new Date().toLocaleString()}</p>
                      
                      <div class="stats">
                        <div class="stat-card">
                          <div class="stat-label">Today</div>
                          <div class="stat-value">${formatCurrency(revenueStats.today)}</div>
                        </div>
                        <div class="stat-card">
                          <div class="stat-label">This Week</div>
                          <div class="stat-value">${formatCurrency(revenueStats.week)}</div>
                        </div>
                        <div class="stat-card">
                          <div class="stat-label">This Month</div>
                          <div class="stat-value">${formatCurrency(revenueStats.month)}</div>
                        </div>
                      </div>
                      
                      <h2>Sales Transactions (${salesHistory.length} total)</h2>
                      <table>
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Product</th>
                            <th>Batch</th>
                            <th>Quantity</th>
                            <th>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${salesHistory.map(sale => `
                            <tr>
                              <td>${new Date(sale.saleDate).toLocaleDateString()}</td>
                              <td>${sale.productName}</td>
                              <td>${sale.batchNumber || 'N/A'}</td>
                              <td>${sale.quantitySold} units</td>
                              <td>${formatCurrency(sale.totalAmount)}</td>
                            </tr>
                          `).join('')}
                        </tbody>
                      </table>
                      
                      <div class="footer">
                        <p>Insightory Inventory Management System</p>
                        <p>This is an automatically generated report</p>
                      </div>
                    </body>
                    </html>
                  `;

                  // For web/desktop: Create a blob and download
                  if (Platform.OS === 'web') {
                    const blob = new Blob([htmlContent], { type: 'text/html' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `sales-report-${new Date().toISOString().split('T')[0]}.html`;
                    link.click();
                    URL.revokeObjectURL(url);
                    
                    Toast.show({
                      type: 'success',
                      text1: 'Report Downloaded',
                      text2: 'HTML report saved successfully'
                    });
                  } else {
                    // For mobile: Share the HTML content
                    Toast.show({
                      type: 'info',
                      text1: 'PDF Export',
                      text2: 'Generating report...'
                    });
                    
                    // Note: For full PDF support on mobile, you would need to install:
                    // expo-print and expo-sharing packages
                    // For now, we'll show a message
                    setTimeout(() => {
                      Toast.show({
                        type: 'info',
                        text1: 'Feature Coming Soon',
                        text2: 'PDF export for mobile is in development'
                      });
                    }, 1000);
                  }
                } catch (error) {
                  console.error('PDF export error:', error);
                  Toast.show({
                    type: 'error',
                    text1: 'Export Failed',
                    text2: 'Could not generate report'
                  });
                }
              }}
            >
              <Ionicons name="download-outline" size={18} color={theme.primary} />
              <Text style={[styles.exportButtonText, { color: theme.primary }]}>
                Export PDF
              </Text>
            </Pressable>
          </View>

          {/* Sales List */}
          {loadingHistory ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={[styles.loadingText, { color: theme.subtext }]}>
                Loading sales history...
              </Text>
            </View>
          ) : salesHistory.length === 0 ? (
            <View style={styles.emptyHistoryState}>
              <Ionicons name="receipt-outline" size={64} color={theme.subtext + "40"} />
              <Text style={[styles.emptyText, { color: theme.subtext }]}>
                NO SALES RECORDED
              </Text>
              <Text style={[styles.emptyHint, { color: theme.subtext }]}>
                Sales will appear here once transactions are completed
              </Text>
            </View>
          ) : (
            <FlatList
              data={salesHistory}
              renderItem={renderSaleItem}
              keyExtractor={(item) => item._id}
              contentContainerStyle={styles.salesListContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={loadingHistory}
                  onRefresh={fetchSalesHistory}
                  tintColor={theme.primary}
                />
              }
            />
          )}
        </View>
      )}

      {/* FEFO Confirmation Modal */}
      <Modal visible={showFefoModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalContent, { backgroundColor: theme.surface }]}
          >
            <Ionicons
              name="shield-checkmark-outline"
              size={64}
              color={theme.primary}
            />
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              CONFIRM TRANSACTION
            </Text>
            <Text style={[styles.modalText, { color: theme.subtext }]}>
              Inventory will be deducted using FEFO logic to ensure stock
              freshness. This action cannot be undone.
            </Text>

            {isSyncing ? (
              <ActivityIndicator
                size="large"
                color={theme.primary}
                style={{ marginVertical: 20 }}
              />
            ) : (
              <View style={styles.modalActions}>
                <Pressable
                  style={[
                    styles.modalButton,
                    { backgroundColor: theme.background, borderColor: theme.border },
                  ]}
                  onPress={() => setShowFefoModal(false)}
                >
                  <Text style={[styles.modalButtonText, { color: theme.text }]}>
                    Cancel
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.modalButton,
                    { backgroundColor: theme.primary },
                  ]}
                  onPress={finalizeSale}
                >
                  <Text
                    style={[styles.modalButtonText, { color: "#FFF" }]}
                  >
                    Complete Sale
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Product Picker Modal */}
      <AddProductModal
        visible={showProductPicker}
        products={products}
        onClose={() => setShowProductPicker(false)}
        onSelectProduct={(item) => {
          const existingItem = cart.find(c => c._id === item._id);
          if (existingItem) {
            Toast.show({
              type: 'info',
              text1: 'Already in Cart',
              text2: 'Adjust quantity in cart'
            });
          } else {
            setCart([...cart, { ...item, quantity: 1 }]);
            Toast.show({
              type: 'success',
              text1: 'Product Added',
              text2: item.name
            });
          }
          setShowProductPicker(false);
        }}
        emptyMessage="No products available"
      />

      {/* Sale Details Modal */}
      <Modal visible={showSaleDetails} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.detailsModalContent, { backgroundColor: theme.surface }]}>
            <View style={styles.detailsHeader}>
              <Text style={[styles.detailsTitle, { color: theme.text }]}>
                Sale Details
              </Text>
              <Pressable onPress={() => setShowSaleDetails(false)}>
                <Ionicons name="close" size={28} color={theme.text} />
              </Pressable>
            </View>

            {selectedSale && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: theme.subtext }]}>Product</Text>
                  <Text style={[styles.detailValue, { color: theme.text }]}>
                    {selectedSale.productName}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: theme.subtext }]}>Batch Number</Text>
                  <Text style={[styles.detailValue, { color: theme.text }]}>
                    {selectedSale.batchNumber || "N/A"}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: theme.subtext }]}>Quantity Sold</Text>
                  <Text style={[styles.detailValue, { color: theme.text }]}>
                    {selectedSale.quantitySold} units
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: theme.subtext }]}>Unit Price</Text>
                  <Text style={[styles.detailValue, { color: theme.text }]}>
                    {formatCurrency(selectedSale.price)}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: theme.subtext }]}>Total Amount</Text>
                  <Text style={[styles.detailValue, { color: theme.primary, fontWeight: "900" }]}>
                    {formatCurrency(selectedSale.totalAmount)}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: theme.subtext }]}>Payment Method</Text>
                  <Text style={[styles.detailValue, { color: theme.text }]}>
                    {selectedSale.paymentMethod.toUpperCase()}
                  </Text>
                </View>
                <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
                  <Text style={[styles.detailLabel, { color: theme.subtext }]}>Sale Date</Text>
                  <Text style={[styles.detailValue, { color: theme.text }]}>
                    {new Date(selectedSale.saleDate).toLocaleString()}
                  </Text>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
      </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  systemLabel: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  title: {
    fontSize: 23,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  scanButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },

  tabContainer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(150,150,150,0.1)",
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginRight: 10,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "800",
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 130,
  },

  sessionPanel: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  panelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(150,150,150,0.1)",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  panelTitle: {
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 1,
  },
  itemCount: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: "800",
    marginTop: 16,
    letterSpacing: 0.5,
  },
  emptyHint: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 6,
    textAlign: "center",
    marginBottom: 20,
  },
  addManualButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  addManualButtonText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "700",
  },

  productList: {},
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 12,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderStyle: "dashed",
  },
  tableHeaderText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },

  productRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
  },
  productInfo: {
    flex: 1,
    marginRight: 12,
  },
  productName: {
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  productMeta: {
    fontSize: 11,
    fontWeight: "600",
  },

  quantityControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    width: 120,
  },
  qtyButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  qtyDisplay: {
    flex: 1,
    alignItems: "center",
  },
  qtyText: {
    fontSize: 16,
    fontWeight: "900",
    fontFamily: "monospace",
  },

  removeButton: {
    width: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  completeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  completeButtonText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0.5,
  },

  infoPanel: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
  },

  // Sales History Styles
  historyHeader: {
    paddingHorizontal: 20,
  },
  statsContainer: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 15,
  },
  statCard: {
    flex: 1,
    padding: 8,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 13,
    fontWeight: "900",
  },
  exportButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  exportButtonText: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    fontWeight: "600",
  },

  emptyHistoryState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },

  salesListContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  saleCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  saleHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  saleName: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 4,
  },
  saleDate: {
    fontSize: 12,
    fontWeight: "600",
  },
  saleAmountContainer: {
    alignItems: "flex-end",
  },
  saleAmount: {
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 2,
  },
  saleQuantity: {
    fontSize: 11,
    fontWeight: "600",
  },
  saleMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  saleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  saleBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    maxWidth: 400,
    padding: 30,
    borderRadius: 24,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "900",
    marginTop: 16,
    marginBottom: 10,
    letterSpacing: 1,
  },
  modalText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  // Sale Details Modal
  detailsModalContent: {
    width: "100%",
    maxWidth: 500,
    maxHeight: "80%",
    padding: 24,
    borderRadius: 24,
  },
  detailsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(150,150,150,0.1)",
  },
  detailsTitle: {
    fontSize: 22,
    fontWeight: "900",
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(150,150,150,0.1)",
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "800",
    textAlign: "right",
    flex: 1,
    marginLeft: 16,
  },
});