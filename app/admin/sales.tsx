import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import { useAudioPlayer } from "expo-audio";
import { ThemedText } from '../../components/ThemedText';

import { useAuth } from "@/context/AuthContext";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    Modal,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { AddProductModal } from "../../components/AddProductModal";
import { DisabledFeatureOverlay } from "../../components/DisabledFeatureOverlay";
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
  const insets = useSafeAreaInsets();

  const salesAccess = useFeatureAccess('processSales');

  const [cart, setCart] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showFefoModal, setShowFefoModal] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [activeTab, setActiveTab] = useState<"dashboard" | "checkout" | "history">("dashboard");
  const { user, role, isAuthenticated, loading: authLoading } = useAuth();
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
  const firstName = user?.name?.split(" ")[0] ?? "there";

  const scanBeep = useAudioPlayer(require("../../assets/sounds/beep.mp3"));

  const fetchSalesHistory = async () => {
    setLoadingHistory(true);
    try {
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/analytics/all-sales?limit=100&days=365`
      );
      if (response.data.success) {
        const salesData = response.data.data?.sales || response.data.data || [];
        const sales: SaleRecord[] = salesData.map((sale: any) => ({
          _id: sale._id,
          productId: sale.productId,
          productName: sale.productName,
          batchNumber: sale.batchNumber || 'N/A',
          quantitySold: Number(sale.quantitySold) || 0,
          price: Number(sale.priceAtSale) || 0,
          totalAmount: Number(sale.totalAmount) || 0,
          saleDate: sale.saleDate,
          paymentMethod: sale.paymentMethod || 'cash'
        }));
        setSalesHistory(sales);
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const stats = {
          today: sales.filter(s => new Date(s.saleDate) >= todayStart).reduce((sum, s) => sum + (s.totalAmount || 0), 0),
          week: sales.filter(s => new Date(s.saleDate) >= weekStart).reduce((sum, s) => sum + (s.totalAmount || 0), 0),
          month: sales.filter(s => new Date(s.saleDate) >= monthStart).reduce((sum, s) => sum + (s.totalAmount || 0), 0),
          totalSales: sales.length
        };
        setRevenueStats(stats);
      }
    } catch (error) {
      console.error('Error fetching sales history:', error);
      Toast.show({ type: 'error', text1: 'Failed to Load', text2: 'Could not fetch sales history' });
    } finally {
      setLoadingHistory(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      refresh();
      fetchSalesHistory();
    }, [])
  );

  useEffect(() => {
    if (cartData && typeof cartData === 'string') {
      try {
        const parsedCart = JSON.parse(cartData);
        setCart(parsedCart);
        setActiveTab("checkout");
        Toast.show({ type: 'success', text1: 'Cart Loaded', text2: `${parsedCart.length} items ready for checkout` });
      } catch (error) {
        console.error('Error parsing cart data:', error);
      }
    }
  }, [cartData]);

  const finalizeSale = async () => {
    setIsSyncing(true);
    try {
      const saleData = cart.map((item) => {
        const product = products.find(p => p._id === item._id);
        let price = 0;
        if (product) {
          if (product.genericPrice && product.genericPrice > 0) {
            price = product.genericPrice;
          } else if (product.batches && product.batches.length > 0) {
            const batchesWithPrice = product.batches.filter(b => (b as any).price && (b as any).price > 0);
            if (batchesWithPrice.length > 0) {
              price = batchesWithPrice.reduce((sum, b) => sum + ((b as any).price || 0), 0) / batchesWithPrice.length;
            }
          }
        }
        return { productId: item._id, quantity: item.quantity, price, paymentMethod: 'cash' };
      });
      await axios.post(`${process.env.EXPO_PUBLIC_API_URL}/products/process-sale`, { items: saleData });
      setCart([]);
      setShowFefoModal(false);
      refresh();
      fetchSalesHistory();
      Toast.show({ type: "success", text1: "Transaction Complete", text2: "Inventory updated via FEFO logic" });
      router.push({ pathname: "/admin/scan", params: { clearCart: "true" } });
    } catch (err) {
      console.error("Sale Error:", err);
      Toast.show({ type: "error", text1: "Transaction Failed", text2: "Could not process sale" });
    } finally {
      setIsSyncing(false);
    }
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prevCart) =>
      prevCart.map((item) => {
        if (item._id === productId) {
          const newQty = Math.max(1, item.quantity + delta);
          const maxStock = item.totalQuantity || 999;
          return { ...item, quantity: Math.min(newQty, maxStock) };
        }
        return item;
      })
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prevCart) => prevCart.filter((item) => item._id !== productId));
  };

  const formatCurrency = (amount: number | undefined) => {
    if (amount === undefined || amount === null || isNaN(amount)) return '₦0';
    return `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  };

  const formatCurrencyShort = (amount: number) => {
    if (amount >= 1_000_000) return `₦${(amount / 1_000_000).toFixed(1)}M`;
    if (amount >= 1_000) return `₦${(amount / 1_000).toFixed(1)}K`;
    return `₦${amount.toFixed(0)}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const nowOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = Math.floor((nowOnly.getTime() - dateOnly.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
  };

  // Build last-7-days bar chart data from salesHistory
  const getWeeklyChartData = () => {
    const days: { label: string; value: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const end = new Date(start.getTime() + 86400000);
      const total = salesHistory
        .filter(s => { const sd = new Date(s.saleDate); return sd >= start && sd < end; })
        .reduce((sum, s) => sum + s.totalAmount, 0);
      days.push({ label: i === 0 ? 'Today' : d.toLocaleDateString('en-NG', { weekday: 'short' }), value: total });
    }
    return days;
  };

  const renderSaleItem = ({ item }: { item: SaleRecord }) => (
    <Pressable
      style={[styles.saleCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
      onPress={() => { setSelectedSale(item); setShowSaleDetails(true); }}
    >
      <View style={styles.saleCardLeft}>
        <View style={[styles.saleIconBox, { backgroundColor: theme.primary + "18" }]}>
          <Ionicons name="receipt-outline" size={18} color={theme.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <ThemedText style={[styles.saleName, { color: theme.text }]} numberOfLines={1}>
            {item.productName}
          </ThemedText>
          <ThemedText style={[styles.saleDate, { color: theme.subtext }]}>
            {formatDate(item.saleDate)} · {item.quantitySold} units
          </ThemedText>
        </View>
      </View>
      <View style={styles.saleCardRight}>
        <ThemedText style={[styles.saleAmount, { color: theme.primary }]}>
          {formatCurrency(item.totalAmount)}
        </ThemedText>
        <Ionicons name="chevron-forward" size={14} color={theme.subtext} />
      </View>
    </Pressable>
  );

  // ─── Dashboard Tab ───────────────────────────────────────────────────────────
  const renderDashboard = () => {
    const chartData = getWeeklyChartData();
    const maxVal = Math.max(...chartData.map(d => d.value), 1);
    const recentSales = salesHistory.slice(0, 5);

    return (
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loadingHistory} onRefresh={fetchSalesHistory} tintColor={theme.primary} />}
      >
        {/* Greeting */}
        <View style={styles.greetingRow}>
          <View>
            <ThemedText style={[styles.greetingName, { color: theme.text }]}>
              Hey, {firstName} 👋
            </ThemedText>
            <ThemedText style={[styles.greetingSubtitle, { color: theme.subtext }]}>
              Here's your sales overview
            </ThemedText>
          </View>
          <Pressable
            style={[styles.newSaleBtn, { backgroundColor: theme.primary }]}
            onPress={() => setActiveTab("checkout")}
          >
            <Ionicons name="add" size={16} color="#FFF" />
            <ThemedText style={styles.newSaleBtnText}>New Sale</ThemedText>
          </Pressable>
        </View>

        {/* KPI Cards Row 1 */}
        <View style={styles.kpiRow}>
          <View style={[styles.kpiCardLarge, { backgroundColor: theme.primary }]}>
            <View style={styles.kpiCardHeader}>
              <View style={[styles.kpiIconBox, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
                <Ionicons name="today-outline" size={18} color="#FFF" />
              </View>
              <ThemedText style={styles.kpiLabelWhite}>TODAY</ThemedText>
            </View>
            <ThemedText style={styles.kpiValueWhiteLarge}>
              {formatCurrencyShort(revenueStats.today)}
            </ThemedText>
            <ThemedText style={styles.kpiSubWhite}>
              {salesHistory.filter(s => {
                const d = new Date(s.saleDate);
                const today = new Date();
                return d.getDate() === today.getDate() && d.getMonth() === today.getMonth();
              }).length} transactions
            </ThemedText>
          </View>

          <View style={styles.kpiColumnRight}>
            <View style={[styles.kpiCardSmall, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.kpiCardHeader}>
                <View style={[styles.kpiIconBox, { backgroundColor: "#34C75918" }]}>
                  <Ionicons name="calendar-outline" size={15} color="#34C759" />
                </View>
                <ThemedText style={[styles.kpiLabelSmall, { color: theme.subtext }]}>WEEK</ThemedText>
              </View>
              <ThemedText style={[styles.kpiValueSmall, { color: theme.text }]}>
                {formatCurrencyShort(revenueStats.week)}
              </ThemedText>
            </View>
            <View style={[styles.kpiCardSmall, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.kpiCardHeader}>
                <View style={[styles.kpiIconBox, { backgroundColor: "#FF950018" }]}>
                  <Ionicons name="stats-chart-outline" size={15} color="#FF9500" />
                </View>
                <ThemedText style={[styles.kpiLabelSmall, { color: theme.subtext }]}>MONTH</ThemedText>
              </View>
              <ThemedText style={[styles.kpiValueSmall, { color: theme.text }]}>
                {formatCurrencyShort(revenueStats.month)}
              </ThemedText>
            </View>
          </View>
        </View>

        {/* Total Transactions Card */}
        <View style={[styles.totalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.totalCardLeft}>
            <View style={[styles.kpiIconBox, { backgroundColor: theme.primary + "18" }]}>
              <Ionicons name="receipt-outline" size={18} color={theme.primary} />
            </View>
            <View>
              <ThemedText style={[styles.totalLabel, { color: theme.subtext }]}>TOTAL TRANSACTIONS</ThemedText>
              <ThemedText style={[styles.totalValue, { color: theme.text }]}>{revenueStats.totalSales}</ThemedText>
            </View>
          </View>
          <Pressable
            style={[styles.viewAllBtn, { borderColor: theme.border }]}
            onPress={() => setActiveTab("history")}
          >
            <ThemedText style={[styles.viewAllText, { color: theme.primary }]}>View All</ThemedText>
            <Ionicons name="arrow-forward" size={14} color={theme.primary} />
          </Pressable>
        </View>

        {/* 7-Day Bar Chart */}
        <View style={[styles.chartCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.chartCardHeader}>
            <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>7-Day Revenue</ThemedText>
            <ThemedText style={[styles.chartTotal, { color: theme.subtext }]}>
              {formatCurrencyShort(revenueStats.week)} this week
            </ThemedText>
          </View>
          <View style={styles.barChart}>
            {chartData.map((day, i) => {
              const barHeight = maxVal > 0 ? Math.max((day.value / maxVal) * 90, day.value > 0 ? 6 : 2) : 2;
              const isToday = i === 6;
              return (
                <View key={i} style={styles.barColumn}>
                  <ThemedText style={[styles.barValue, { color: isToday ? theme.primary : theme.subtext }]}>
                    {day.value > 0 ? formatCurrencyShort(day.value) : ''}
                  </ThemedText>
                  <View style={styles.barWrapper}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: barHeight,
                          backgroundColor: isToday ? theme.primary : theme.primary + "40",
                          borderRadius: 4,
                        },
                      ]}
                    />
                  </View>
                  <ThemedText style={[styles.barLabel, { color: isToday ? theme.primary : theme.subtext }]}>
                    {day.label}
                  </ThemedText>
                </View>
              );
            })}
          </View>
        </View>

        {/* Quick Actions */}
        <ThemedText style={[styles.sectionTitle, { color: theme.text, marginBottom: 12 }]}>Quick Actions</ThemedText>
        <View style={styles.actionGrid}>
          <Pressable
            style={[styles.actionTile, { backgroundColor: theme.primary }]}
            onPress={() => router.push("/admin/scan")}
          >
            <View style={[styles.actionTileIcon, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
              <Ionicons name="scan" size={22} color="#FFF" />
            </View>
            <ThemedText style={styles.actionTileTextWhite}>Scan & Sell</ThemedText>
            <ThemedText style={styles.actionTileSubWhite}>Barcode scanner</ThemedText>
          </Pressable>

          <Pressable
            style={[styles.actionTile, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]}
            onPress={() => {
              if (products.length > 0) {
                setShowProductPicker(true);
                setActiveTab("checkout");
              } else {
                Toast.show({ type: 'error', text1: 'No Products', text2: 'Add products to inventory first' });
              }
            }}
          >
            <View style={[styles.actionTileIcon, { backgroundColor: "#34C75918" }]}>
              <Ionicons name="add-circle-outline" size={22} color="#34C759" />
            </View>
            <ThemedText style={[styles.actionTileText, { color: theme.text }]}>Manual Sale</ThemedText>
            <ThemedText style={[styles.actionTileSub, { color: theme.subtext }]}>Add products</ThemedText>
          </Pressable>

          <Pressable
            style={[styles.actionTile, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]}
            onPress={() => setActiveTab("history")}
          >
            <View style={[styles.actionTileIcon, { backgroundColor: "#FF950018" }]}>
              <Ionicons name="time-outline" size={22} color="#FF9500" />
            </View>
            <ThemedText style={[styles.actionTileText, { color: theme.text }]}>History</ThemedText>
            <ThemedText style={[styles.actionTileSub, { color: theme.subtext }]}>All transactions</ThemedText>
          </Pressable>

          <Pressable
            style={[styles.actionTile, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]}
            onPress={() => router.push("/admin/stats")}
          >
            <View style={[styles.actionTileIcon, { backgroundColor: theme.primary + "18" }]}>
              <Ionicons name="analytics-outline" size={22} color={theme.primary} />
            </View>
            <ThemedText style={[styles.actionTileText, { color: theme.text }]}>Analytics</ThemedText>
            <ThemedText style={[styles.actionTileSub, { color: theme.subtext }]}>AI insights</ThemedText>
          </Pressable>
        </View>

        {/* Recent Transactions */}
        <View style={styles.recentHeader}>
          <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>Recent Transactions</ThemedText>
          {salesHistory.length > 5 && (
            <Pressable onPress={() => setActiveTab("history")}>
              <ThemedText style={[styles.seeAllText, { color: theme.primary }]}>See all</ThemedText>
            </Pressable>
          )}
        </View>

        {loadingHistory ? (
          <View style={styles.miniLoader}>
            <ActivityIndicator size="small" color={theme.primary} />
          </View>
        ) : recentSales.length === 0 ? (
          <View style={[styles.emptyRecentCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Ionicons name="receipt-outline" size={36} color={theme.subtext + "50"} />
            <ThemedText style={[styles.emptyRecentText, { color: theme.subtext }]}>No transactions yet</ThemedText>
            <ThemedText style={[styles.emptyRecentHint, { color: theme.subtext }]}>
              Complete a sale to see it here
            </ThemedText>
          </View>
        ) : (
          recentSales.map(item => (
            <Pressable
              key={item._id}
              style={[styles.saleCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
              onPress={() => { setSelectedSale(item); setShowSaleDetails(true); }}
            >
              <View style={styles.saleCardLeft}>
                <View style={[styles.saleIconBox, { backgroundColor: theme.primary + "18" }]}>
                  <Ionicons name="receipt-outline" size={18} color={theme.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText style={[styles.saleName, { color: theme.text }]} numberOfLines={1}>
                    {item.productName}
                  </ThemedText>
                  <ThemedText style={[styles.saleDate, { color: theme.subtext }]}>
                    {formatDate(item.saleDate)} · {item.quantitySold} units
                  </ThemedText>
                </View>
              </View>
              <View style={styles.saleCardRight}>
                <ThemedText style={[styles.saleAmount, { color: theme.primary }]}>
                  {formatCurrency(item.totalAmount)}
                </ThemedText>
                <Ionicons name="chevron-forward" size={14} color={theme.subtext} />
              </View>
            </Pressable>
          ))
        )}

        {/* FEFO Info */}
        <View style={[styles.infoPanel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="information-circle-outline" size={18} color={theme.primary} />
          <ThemedText style={[styles.infoText, { color: theme.subtext }]}>
            All sales use FEFO logic — batches closest to expiry are deducted first.
          </ThemedText>
        </View>
      </ScrollView>
    );
  };

  // ─── Checkout Tab ─────────────────────────────────────────────────────────────
  const renderCheckout = () => (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.checkoutHeader}>
        <ThemedText style={[styles.checkoutTitle, { color: theme.text }]}>New Transaction</ThemedText>
        <ThemedText style={[styles.checkoutSubtitle, { color: theme.subtext }]}>
          Add products to complete a sale
        </ThemedText>
      </View>

      {/* Quick Add Buttons */}
      <View style={styles.checkoutActions}>
        <Pressable
          style={[styles.checkoutActionBtn, { backgroundColor: theme.primary }]}
          onPress={() => router.push("/admin/scan")}
        >
          <Ionicons name="scan" size={20} color="#FFF" />
          <ThemedText style={styles.checkoutActionTextWhite}>Scan Barcode</ThemedText>
        </Pressable>
        <Pressable
          style={[styles.checkoutActionBtn, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]}
          onPress={() => {
            if (products.length > 0) {
              setShowProductPicker(true);
            } else {
              Toast.show({ type: 'error', text1: 'No Products', text2: 'Add products to inventory first' });
            }
          }}
        >
          <Ionicons name="search-outline" size={20} color={theme.primary} />
          <ThemedText style={[styles.checkoutActionText, { color: theme.primary }]}>Browse Products</ThemedText>
        </Pressable>
      </View>

      {/* Cart Panel */}
      <View style={[styles.sessionPanel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.panelHeader}>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: cart.length > 0 ? "#34C759" : theme.border }]} />
            <ThemedText style={[styles.panelTitle, { color: theme.text }]}>CART</ThemedText>
          </View>
          <ThemedText style={[styles.itemCount, { color: theme.subtext }]}>
            {cart.length} {cart.length === 1 ? "ITEM" : "ITEMS"}
          </ThemedText>
        </View>

        {cart.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="cart-outline" size={56} color={theme.subtext + "40"} />
            <ThemedText style={[styles.emptyText, { color: theme.subtext }]}>Cart is empty</ThemedText>
            <ThemedText style={[styles.emptyHint, { color: theme.subtext }]}>
              Scan or browse products to add them
            </ThemedText>
          </View>
        ) : (
          <View style={styles.productList}>
            <View style={[styles.tableHeader, { borderBottomColor: theme.border }]}>
              <ThemedText style={[styles.tableHeaderText, { color: theme.subtext, flex: 1 }]}>PRODUCT</ThemedText>
              <ThemedText style={[styles.tableHeaderText, { color: theme.subtext, width: 120, textAlign: "center" }]}>QTY</ThemedText>
              <ThemedText style={[styles.tableHeaderText, { color: theme.subtext, width: 40 }]}> </ThemedText>
            </View>
            {cart.map((item, index) => (
              <View
                key={item._id}
                style={[styles.productRow, { borderBottomColor: theme.border, borderBottomWidth: index < cart.length - 1 ? 1 : 0 }]}
              >
                <View style={styles.productInfo}>
                  <ThemedText style={[styles.productName, { color: theme.text }]} numberOfLines={1}>{item.name}</ThemedText>
                  <ThemedText style={[styles.productMeta, { color: theme.subtext }]}>
                    Stock: {item.totalQuantity || 0}
                  </ThemedText>
                </View>
                <View style={styles.quantityControls}>
                  <Pressable
                    style={[styles.qtyButton, { backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border }]}
                    onPress={() => updateQuantity(item._id, -1)}
                  >
                    <Ionicons name="remove" size={16} color={theme.text} />
                  </Pressable>
                  <View style={styles.qtyDisplay}>
                    <ThemedText style={[styles.qtyText, { color: theme.text }]}>{item.quantity}</ThemedText>
                  </View>
                  <Pressable
                    style={[styles.qtyButton, { backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border }]}
                    onPress={() => updateQuantity(item._id, 1)}
                  >
                    <Ionicons name="add" size={16} color={theme.text} />
                  </Pressable>
                </View>
                <Pressable style={styles.removeButton} onPress={() => removeFromCart(item._id)}>
                  <Ionicons name="close-circle" size={24} color="#FF3B30" />
                </Pressable>
              </View>
            ))}
          </View>
        )}

        <Pressable
          style={[styles.addManualButton, { backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border, marginTop: cart.length > 0 ? 16 : 0 }]}
          onPress={() => {
            if (products.length > 0) {
              setShowProductPicker(true);
            } else {
              Toast.show({ type: 'error', text1: 'No Products', text2: 'Add products to inventory first' });
            }
          }}
        >
          <Ionicons name="add-circle-outline" size={20} color={theme.primary} />
          <ThemedText style={[styles.addManualButtonText, { color: theme.primary }]}>Add Product</ThemedText>
        </Pressable>

        {cart.length > 0 && (
          <Pressable
            style={[styles.completeButton, { backgroundColor: theme.primary }]}
            onPress={() => setShowFefoModal(true)}
          >
            <Ionicons name="checkmark-done" size={20} color="#FFF" />
            <ThemedText style={styles.completeButtonText}>COMPLETE TRANSACTION</ThemedText>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );

  // ─── History Tab ──────────────────────────────────────────────────────────────
  const renderHistory = () => (
    <View style={{ flex: 1 }}>
      {/* Stats Strip */}
      <View style={[styles.historyStatsStrip, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <View style={styles.historyStatItem}>
          <ThemedText style={[styles.historyStatValue, { color: theme.primary }]}>
            {formatCurrencyShort(revenueStats.today)}
          </ThemedText>
          <ThemedText style={[styles.historyStatLabel, { color: theme.subtext }]}>Today</ThemedText>
        </View>
        <View style={[styles.historyStatDivider, { backgroundColor: theme.border }]} />
        <View style={styles.historyStatItem}>
          <ThemedText style={[styles.historyStatValue, { color: theme.text }]}>
            {formatCurrencyShort(revenueStats.week)}
          </ThemedText>
          <ThemedText style={[styles.historyStatLabel, { color: theme.subtext }]}>This Week</ThemedText>
        </View>
        <View style={[styles.historyStatDivider, { backgroundColor: theme.border }]} />
        <View style={styles.historyStatItem}>
          <ThemedText style={[styles.historyStatValue, { color: theme.text }]}>
            {formatCurrencyShort(revenueStats.month)}
          </ThemedText>
          <ThemedText style={[styles.historyStatLabel, { color: theme.subtext }]}>This Month</ThemedText>
        </View>
        <View style={[styles.historyStatDivider, { backgroundColor: theme.border }]} />
        <View style={styles.historyStatItem}>
          <ThemedText style={[styles.historyStatValue, { color: theme.text }]}>
            {revenueStats.totalSales}
          </ThemedText>
          <ThemedText style={[styles.historyStatLabel, { color: theme.subtext }]}>Total</ThemedText>
        </View>
      </View>

      {loadingHistory ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <ThemedText style={[styles.loadingText, { color: theme.subtext }]}>Loading history...</ThemedText>
        </View>
      ) : salesHistory.length === 0 ? (
        <View style={styles.emptyHistoryState}>
          <Ionicons name="receipt-outline" size={64} color={theme.subtext + "40"} />
          <ThemedText style={[styles.emptyText, { color: theme.subtext }]}>No sales recorded</ThemedText>
          <ThemedText style={[styles.emptyHint, { color: theme.subtext }]}>
            Completed transactions will appear here
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={salesHistory}
          renderItem={renderSaleItem}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.salesListContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={loadingHistory} onRefresh={fetchSalesHistory} tintColor={theme.primary} />
          }
        />
      )}
    </View>
  );

  // ─── Main Render ──────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {!salesAccess.isAllowed ? (
        <DisabledFeatureOverlay reason={salesAccess.reason || 'Access denied'} />
      ) : (
        <View style={{ flex: 1, backgroundColor: theme.background }}>

          {/* Header */}
          <View style={[styles.header, { backgroundColor: theme.primary, paddingTop: insets.top + 12 }]}>
            <View style={styles.headerTop}>
              <View>
                <ThemedText style={[styles.headerEyebrow, { color: "rgba(255,255,255,0.65)" }]}>
                  SALES DASHBOARD
                </ThemedText>
                <ThemedText style={styles.headerTitle}>
                  {activeTab === "dashboard" ? "Overview" : activeTab === "checkout" ? "New Sale" : "History"}
                </ThemedText>
              </View>
              <Pressable style={styles.headerIconBtn} onPress={() => router.push("/admin/settings")}>
                <Ionicons name="settings-outline" size={20} color="#FFF" />
              </Pressable>
            </View>

            {/* Tab Pills */}
            <View style={styles.tabPills}>
              {(["dashboard", "checkout", "history"] as const).map((tab) => (
                <Pressable
                  key={tab}
                  style={[
                    styles.tabPill,
                    activeTab === tab && styles.tabPillActive,
                  ]}
                  onPress={() => setActiveTab(tab)}
                >
                  <Ionicons
                    name={tab === "dashboard" ? "grid-outline" : tab === "checkout" ? "cart-outline" : "time-outline"}
                    size={14}
                    color={activeTab === tab ? theme.primary : "rgba(255,255,255,0.7)"}
                  />
                  <ThemedText
                    style={[
                      styles.tabPillText,
                      { color: activeTab === tab ? theme.primary : "rgba(255,255,255,0.7)" },
                    ]}
                  >
                    {tab === "dashboard" ? "Dashboard" : tab === "checkout" ? "Checkout" : "History"}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Tab Content */}
          {activeTab === "dashboard" && renderDashboard()}
          {activeTab === "checkout" && renderCheckout()}
          {activeTab === "history" && renderHistory()}

          {/* FEFO Confirmation Modal */}
          <Modal visible={showFefoModal} transparent animationType="fade">
            <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
                <View style={[styles.modalIconBox, { backgroundColor: theme.primary + "18" }]}>
                  <Ionicons name="shield-checkmark-outline" size={36} color={theme.primary} />
                </View>
                <ThemedText style={[styles.modalTitle, { color: theme.text }]}>Confirm Transaction</ThemedText>
                <ThemedText style={[styles.modalText, { color: theme.subtext }]}>
                  Inventory will be deducted using FEFO logic. This cannot be undone.
                </ThemedText>
                {isSyncing ? (
                  <ActivityIndicator size="large" color={theme.primary} style={{ marginVertical: 20 }} />
                ) : (
                  <View style={styles.modalActions}>
                    <Pressable
                      style={[styles.modalButton, { backgroundColor: theme.background, borderColor: theme.border }]}
                      onPress={() => setShowFefoModal(false)}
                    >
                      <ThemedText style={[styles.modalButtonText, { color: theme.text }]}>Cancel</ThemedText>
                    </Pressable>
                    <Pressable
                      style={[styles.modalButton, { backgroundColor: theme.primary }]}
                      onPress={finalizeSale}
                    >
                      <ThemedText style={[styles.modalButtonText, { color: "#FFF" }]}>Complete Sale</ThemedText>
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
                Toast.show({ type: 'info', text1: 'Already in Cart', text2: 'Adjust quantity in cart' });
              } else {
                setCart([...cart, { ...item, quantity: 1 }]);
                Toast.show({ type: 'success', text1: 'Product Added', text2: item.name });
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
                  <ThemedText style={[styles.detailsTitle, { color: theme.text }]}>Sale Details</ThemedText>
                  <Pressable onPress={() => setShowSaleDetails(false)}>
                    <Ionicons name="close" size={28} color={theme.text} />
                  </Pressable>
                </View>
                {selectedSale && (
                  <ScrollView showsVerticalScrollIndicator={false}>
                    {[
                      { label: "Product", value: selectedSale.productName },
                      { label: "Batch Number", value: selectedSale.batchNumber || "N/A" },
                      { label: "Quantity Sold", value: `${selectedSale.quantitySold} units` },
                      { label: "Unit Price", value: formatCurrency(selectedSale.price) },
                      { label: "Total Amount", value: formatCurrency(selectedSale.totalAmount), highlight: true },
                      { label: "Payment Method", value: selectedSale.paymentMethod.toUpperCase() },
                      { label: "Sale Date", value: new Date(selectedSale.saleDate).toLocaleString() },
                    ].map((row, i, arr) => (
                      <View key={row.label} style={[styles.detailRow, { borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: theme.border + "60" }]}>
                        <ThemedText style={[styles.detailLabel, { color: theme.subtext }]}>{row.label}</ThemedText>
                        <ThemedText style={[styles.detailValue, { color: row.highlight ? theme.primary : theme.text }]}>
                          {row.value}
                        </ThemedText>
                      </View>
                    ))}
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
  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    paddingHorizontal: 20,
    paddingBottom: 0,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  headerEyebrow: {
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: "700",
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "600",
    color: "#FFF",
    letterSpacing: -0.5,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },

  // ── Tab Pills ────────────────────────────────────────────────────────────────
  tabPills: {
    flexDirection: "row",
    gap: 8,
    paddingBottom: 16,
  },
  tabPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  tabPillActive: {
    backgroundColor: "#FFF",
  },
  tabPillText: {
    fontSize: 13,
    fontWeight: "600",
  },

  // ── Scroll Content ───────────────────────────────────────────────────────────
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 130,
  },

  // ── Dashboard ────────────────────────────────────────────────────────────────
  greetingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  greetingName: {
    fontSize: 20,
    fontWeight: "600",
    letterSpacing: -0.3,
  },
  greetingSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  newSaleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
  },
  newSaleBtnText: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "600",
  },

  // KPI Cards
  kpiRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  kpiCardLarge: {
    flex: 1.3,
    borderRadius: 20,
    padding: 18,
    justifyContent: "space-between",
    minHeight: 140,
  },
  kpiColumnRight: {
    flex: 1,
    gap: 12,
  },
  kpiCardSmall: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
  },
  kpiCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  kpiIconBox: {
    width: 30,
    height: 30,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  kpiLabelWhite: {
    fontSize: 10,
    letterSpacing: 1.5,
    color: "rgba(255,255,255,0.7)",
    fontWeight: "700",
  },
  kpiLabelSmall: {
    fontSize: 9,
    letterSpacing: 1.2,
    fontWeight: "700",
  },
  kpiValueWhiteLarge: {
    fontSize: 30,
    fontWeight: "700",
    color: "#FFF",
    letterSpacing: -1,
  },
  kpiSubWhite: {
    fontSize: 11,
    color: "rgba(255,255,255,0.65)",
    marginTop: 4,
  },
  kpiValueSmall: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.5,
  },

  // Total Card
  totalCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  totalCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  totalLabel: {
    fontSize: 10,
    letterSpacing: 1,
    fontWeight: "700",
    marginBottom: 2,
  },
  totalValue: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  viewAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: "600",
  },

  // Bar Chart
  chartCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    marginBottom: 24,
  },
  chartCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  chartTotal: {
    fontSize: 12,
  },
  barChart: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 130,
    gap: 6,
  },
  barColumn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    height: "100%",
  },
  barValue: {
    fontSize: 8,
    marginBottom: 4,
    textAlign: "center",
  },
  barWrapper: {
    flex: 1,
    justifyContent: "flex-end",
    width: "100%",
    alignItems: "center",
  },
  bar: {
    width: "80%",
    minHeight: 2,
  },
  barLabel: {
    fontSize: 9,
    marginTop: 6,
    textAlign: "center",
  },

  // Action Grid
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24,
  },
  actionTile: {
    width: (width - 52) / 2,
    borderRadius: 18,
    padding: 16,
    gap: 6,
  },
  actionTileIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  actionTileTextWhite: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "600",
  },
  actionTileSubWhite: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 12,
  },
  actionTileText: {
    fontSize: 15,
    fontWeight: "600",
  },
  actionTileSub: {
    fontSize: 12,
  },

  // Recent
  recentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: "600",
  },
  miniLoader: {
    paddingVertical: 24,
    alignItems: "center",
  },
  emptyRecentCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 32,
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  emptyRecentText: {
    fontSize: 15,
    fontWeight: "500",
  },
  emptyRecentHint: {
    fontSize: 12,
    textAlign: "center",
  },

  // Sale Card
  saleCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  saleCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  saleIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  saleCardRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  saleName: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 2,
  },
  saleDate: {
    fontSize: 11,
  },
  saleAmount: {
    fontSize: 15,
    fontWeight: "700",
  },

  // Info Panel
  infoPanel: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },

  // ── Checkout ─────────────────────────────────────────────────────────────────
  checkoutHeader: {
    marginBottom: 16,
  },
  checkoutTitle: {
    fontSize: 20,
    fontWeight: "600",
    letterSpacing: -0.3,
  },
  checkoutSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  checkoutActions: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  checkoutActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  checkoutActionTextWhite: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "600",
  },
  checkoutActionText: {
    fontSize: 14,
    fontWeight: "600",
  },

  // Session Panel
  sessionPanel: {
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 16,
  },
  panelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(150,150,150,0.1)",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  panelTitle: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1,
  },
  itemCount: {
    fontSize: 11,
    letterSpacing: 0.5,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 48,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: "500",
  },
  emptyHint: {
    fontSize: 12,
    textAlign: "center",
  },
  addManualButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  addManualButtonText: {
    fontSize: 14,
    fontWeight: "500",
  },
  productList: {},
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 10,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderStyle: "dashed",
  },
  tableHeaderText: {
    fontSize: 10,
    letterSpacing: 1,
    fontWeight: "700",
  },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
  },
  productInfo: {
    flex: 1,
    marginRight: 12,
  },
  productName: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 3,
  },
  productMeta: {
    fontSize: 11,
  },
  quantityControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    width: 110,
  },
  qtyButton: {
    width: 30,
    height: 30,
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
    fontWeight: "600",
  },
  removeButton: {
    width: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  completeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 16,
  },
  completeButtonText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  // ── History ──────────────────────────────────────────────────────────────────
  historyStatsStrip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    marginBottom: 4,
  },
  historyStatItem: {
    flex: 1,
    alignItems: "center",
  },
  historyStatValue: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  historyStatLabel: {
    fontSize: 10,
    marginTop: 2,
    letterSpacing: 0.3,
  },
  historyStatDivider: {
    width: 1,
    height: 28,
    marginHorizontal: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  emptyHistoryState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
    gap: 10,
  },
  salesListContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 100,
  },

  // ── Modals ───────────────────────────────────────────────────────────────────
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
    padding: 28,
    borderRadius: 24,
    alignItems: "center",
  },
  modalIconBox: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 8,
    letterSpacing: -0.3,
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
    fontWeight: "600",
  },
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
    marginBottom: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(150,150,150,0.1)",
  },
  detailsTitle: {
    fontSize: 20,
    fontWeight: "600",
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
  },
  detailLabel: {
    fontSize: 14,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "500",
    textAlign: "right",
    flex: 1,
    marginLeft: 16,
  },
});
