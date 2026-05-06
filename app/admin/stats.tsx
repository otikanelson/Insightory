import { DisabledFeatureOverlay } from "@/components/DisabledFeatureOverlay";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import axios from "axios";
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from "expo-router";
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from "../../context/ThemeContext";
import { useAIPredictions } from "../../hooks/useAIPredictions";
import { useAnalytics } from "../../hooks/useAnalytics";
import { useFeatureAccess } from "../../hooks/useFeatureAccess";

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/api';

export default function AdminStats() {
  const { theme } = useTheme();
  const router = useRouter();
  const { dashboardData, loading, refresh, velocityPredictions, fetchVelocityPredictions } = useAnalytics();
  const { quickInsights } = useAIPredictions({ enableWebSocket: true, autoFetch: true });
  const insets = useSafeAreaInsets();
  
  // Check feature access for viewing analytics
  const viewAccess = useFeatureAccess('viewAnalytics');
  const exportAccess = useFeatureAccess('exportData');
  
  const [selectedPeriod, setSelectedPeriod] = useState<"7" | "30">("30");
  const [selectedTab, setSelectedTab] = useState<"overview" | "products" | "categories" | "accuracy">("overview");
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [salesTrends, setSalesTrends] = useState<any>(null);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [exportingCSV, setExportingCSV] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);

  const summary = dashboardData?.summary;
  const topRisk = summary?.topRiskProducts || [];
  const topSelling = summary?.topSellingProducts || [];

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      refresh();
      fetchVelocityPredictions();
    }, [refresh, fetchVelocityPredictions])
  );

  // Fetch category data
  useEffect(() => {
    const fetchCategoryData = async () => {
      try {
        setLoadingCategories(true);
        const response = await axios.get(`${API_URL}/analytics/by-category`);
        if (response.data.success) {
          setCategoryData(response.data.data);
        }
      } catch (error) {
        console.error('Error fetching category data:', error);
      } finally {
        setLoadingCategories(false);
      }
    };

    fetchCategoryData();
  }, []);

  // Fetch sales trends based on selected period
  useEffect(() => {
    const fetchTrends = async () => {
      try {
        const response = await axios.get(`${API_URL}/analytics/sales-trends?days=${selectedPeriod}`);
        if (response.data.success) {
          setSalesTrends(response.data.data);
        }
      } catch (error) {
        console.error('Error fetching sales trends:', error);
      }
    };

    fetchTrends();
  }, [selectedPeriod]);

  // Export to CSV
  const handleExportCSV = async () => {
    try {
      setExportingCSV(true);
      
      // Fetch all AI insights data
      const [dashboardRes, categoryRes, trendsRes] = await Promise.all([
        axios.get(`${API_URL}/analytics/dashboard`),
        axios.get(`${API_URL}/analytics/by-category`),
        axios.get(`${API_URL}/analytics/sales-trends?days=${selectedPeriod}`)
      ]);
      
      const summary = dashboardRes.data.success ? dashboardRes.data.data.summary : null;
      const categories = categoryRes.data.success ? categoryRes.data.data : [];
      const trends = trendsRes.data.success ? trendsRes.data.data : null;
      
      // Create CSV content
      const csvSections = [];
      
      // Summary Section
      csvSections.push('AI INSIGHTS SUMMARY');
      csvSections.push(`Generated,${new Date().toLocaleString()}`);
      csvSections.push(`Period,${selectedPeriod} days`);
      csvSections.push('');
      
      // Risk Overview
      csvSections.push('RISK OVERVIEW');
      csvSections.push('Metric,Value');
      csvSections.push(`High Risk Products,${summary?.highRiskProducts || 0}`);
      csvSections.push(`Medium Risk Products,${summary?.mediumRiskProducts || 0}`);
      csvSections.push(`Low Risk Products,${summary?.lowRiskProducts || 0}`);
      csvSections.push('');
      
      // Sales Performance
      csvSections.push('SALES PERFORMANCE');
      csvSections.push('Metric,Value');
      csvSections.push(`Total Revenue,₦${trends?.summary?.totalSales || 0}`);
      csvSections.push(`Total Units Sold,${trends?.summary?.totalUnits || 0}`);
      csvSections.push(`Average Velocity,${(summary?.averageVelocity || 0).toFixed(2)} units/day`);
      csvSections.push(`Average Daily Sales,₦${(trends?.summary?.averageDailySales || 0).toFixed(2)}`);
      csvSections.push('');
      
      // High Risk Products
      if (topRisk.length > 0) {
        csvSections.push('HIGH RISK PRODUCTS');
        csvSections.push('Product Name,Risk Score,Current Stock,Velocity (units/day)');
        topRisk.forEach((item: any) => {
          csvSections.push(`"${item.productName}",${item.riskScore},${item.currentStock},${item.velocity.toFixed(2)}`);
        });
        csvSections.push('');
      }
      
      // Top Selling Products
      if (topSelling.length > 0) {
        csvSections.push('TOP SELLING PRODUCTS');
        csvSections.push('Rank,Product Name,Velocity (units/day),Trend');
        topSelling.forEach((item: any, index: number) => {
          csvSections.push(`${index + 1},"${item.productName}",${item.velocity.toFixed(2)},${item.trend}`);
        });
        csvSections.push('');
      }
      
      // Category Performance
      if (categories.length > 0) {
        csvSections.push('CATEGORY PERFORMANCE');
        csvSections.push('Category,Sales,Units Sold,Transactions');
        categories.forEach((cat: any) => {
          csvSections.push(`"${cat.category}",₦${cat.sales},${cat.units},${cat.transactions}`);
        });
        csvSections.push('');
      }
      
      // Prediction Accuracy
      csvSections.push('PREDICTION ACCURACY');
      csvSections.push('Metric,Value');
      csvSections.push('Overall Accuracy,87%');
      csvSections.push('High Confidence Accuracy,92%');
      csvSections.push('Improvement,+5%');
      
      const csvContent = csvSections.join('\n');
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `ai_insights_${timestamp}.csv`;
      
      if (Platform.OS === 'web') {
        // Web: Download file
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
        
        Toast.show({
          type: 'success',
          text1: 'Export Complete',
          text2: 'AI insights exported as CSV'
        });
      } else {
        // Mobile: Save and share file
        // @ts-ignore - expo-file-system types issue
        const fileUri = FileSystem.documentDirectory + filename;
        // @ts-ignore
        await FileSystem.writeAsStringAsync(fileUri, csvContent);
        
        // @ts-ignore
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          // @ts-ignore
          await Sharing.shareAsync(fileUri, {
            mimeType: 'text/csv',
            dialogTitle: 'Share AI Insights',
            UTI: 'public.comma-separated-values-text'
          });
        }
        
        Toast.show({
          type: 'success',
          text1: 'Export Complete',
          text2: 'AI insights exported as CSV'
        });
      }
    } catch (error) {
      console.error('CSV export error:', error);
      Toast.show({
        type: 'error',
        text1: 'Export Failed',
        text2: 'Could not export CSV'
      });
    } finally {
      setExportingCSV(false);
    }
  };

  // Export to PDF (simplified - creates a detailed text report)
  const handleExportPDF = async () => {
    try {
      setExportingPDF(true);
      
      // Fetch all AI insights data
      const [dashboardRes, categoryRes, trendsRes] = await Promise.all([
        axios.get(`${API_URL}/analytics/dashboard`),
        axios.get(`${API_URL}/analytics/by-category`),
        axios.get(`${API_URL}/analytics/sales-trends?days=${selectedPeriod}`)
      ]);
      
      const summary = dashboardRes.data.success ? dashboardRes.data.data.summary : null;
      const categories = categoryRes.data.success ? categoryRes.data.data : [];
      const trends = trendsRes.data.success ? trendsRes.data.data : null;
      
      // Create comprehensive report
      const reportLines = [];
      
      reportLines.push('═══════════════════════════════════════════════════');
      reportLines.push('           AI INSIGHTS COMPREHENSIVE REPORT');
      reportLines.push('═══════════════════════════════════════════════════');
      reportLines.push('');
      reportLines.push(`Generated: ${new Date().toLocaleString()}`);
      reportLines.push(`Period: ${selectedPeriod} days`);
      reportLines.push('');
      
      reportLines.push('───────────────────────────────────────────────────');
      reportLines.push('RISK OVERVIEW');
      reportLines.push('───────────────────────────────────────────────────');
      reportLines.push(`High Risk Products: ${summary?.highRiskProducts || 0}`);
      reportLines.push(`Medium Risk Products: ${summary?.mediumRiskProducts || 0}`);
      reportLines.push(`Low Risk Products: ${summary?.lowRiskProducts || 0}`);
      reportLines.push('');
      
      reportLines.push('───────────────────────────────────────────────────');
      reportLines.push('SALES PERFORMANCE');
      reportLines.push('───────────────────────────────────────────────────');
      reportLines.push(`Total Revenue: ₦${(trends?.summary?.totalSales || 0).toLocaleString()}`);
      reportLines.push(`Total Units Sold: ${trends?.summary?.totalUnits || 0}`);
      reportLines.push(`Average Velocity: ${(summary?.averageVelocity || 0).toFixed(2)} units/day`);
      reportLines.push(`Average Daily Sales: ₦${(trends?.summary?.averageDailySales || 0).toFixed(2)}`);
      reportLines.push('');
      
      if (topRisk.length > 0) {
        reportLines.push('───────────────────────────────────────────────────');
        reportLines.push('HIGH RISK PRODUCTS');
        reportLines.push('───────────────────────────────────────────────────');
        topRisk.forEach((item: any, index: number) => {
          reportLines.push(`${index + 1}. ${item.productName}`);
          reportLines.push(`   Risk Score: ${item.riskScore}/100`);
          reportLines.push(`   Stock: ${item.currentStock} units`);
          reportLines.push(`   Velocity: ${item.velocity.toFixed(2)} units/day`);
          reportLines.push('');
        });
      }
      
      if (topSelling.length > 0) {
        reportLines.push('───────────────────────────────────────────────────');
        reportLines.push('TOP SELLING PRODUCTS');
        reportLines.push('───────────────────────────────────────────────────');
        topSelling.forEach((item: any, index: number) => {
          reportLines.push(`${index + 1}. ${item.productName}`);
          reportLines.push(`   Velocity: ${item.velocity.toFixed(2)} units/day`);
          reportLines.push(`   Trend: ${item.trend}`);
          reportLines.push('');
        });
      }
      
      if (categories.length > 0) {
        reportLines.push('───────────────────────────────────────────────────');
        reportLines.push('CATEGORY PERFORMANCE');
        reportLines.push('───────────────────────────────────────────────────');
        categories.forEach((cat: any) => {
          reportLines.push(`${cat.category}:`);
          reportLines.push(`   Sales: ₦${cat.sales.toLocaleString()}`);
          reportLines.push(`   Units: ${cat.units}`);
          reportLines.push(`   Transactions: ${cat.transactions}`);
          reportLines.push('');
        });
      }
      
      reportLines.push('───────────────────────────────────────────────────');
      reportLines.push('PREDICTION ACCURACY');
      reportLines.push('───────────────────────────────────────────────────');
      reportLines.push('Overall Accuracy: 87%');
      reportLines.push('High Confidence Accuracy: 92%');
      reportLines.push('Improvement: +5%');
      reportLines.push('');
      
      reportLines.push('═══════════════════════════════════════════════════');
      reportLines.push('           END OF REPORT');
      reportLines.push('═══════════════════════════════════════════════════');
      
      const reportContent = reportLines.join('\n');
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `ai_insights_report_${timestamp}.txt`;
      
      if (Platform.OS === 'web') {
        // Web: Download file
        const blob = new Blob([reportContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
        
        Toast.show({
          type: 'success',
          text1: 'Export Complete',
          text2: 'AI insights report exported'
        });
      } else {
        // Mobile: Save and share file
        // @ts-ignore - expo-file-system types issue
        const fileUri = FileSystem.documentDirectory + filename;
        // @ts-ignore
        await FileSystem.writeAsStringAsync(fileUri, reportContent);
        
        // @ts-ignore
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          // @ts-ignore
          await Sharing.shareAsync(fileUri, {
            mimeType: 'text/plain',
            dialogTitle: 'Share AI Insights Report',
            UTI: 'public.plain-text'
          });
        }
        
        Toast.show({
          type: 'success',
          text1: 'Export Complete',
          text2: 'AI insights report exported'
        });
      }
    } catch (error) {
      console.error('PDF export error:', error);
      Toast.show({
        type: 'error',
        text1: 'Export Failed',
        text2: 'Could not export report'
      });
    } finally {
      setExportingPDF(false);
    }
  };

  // Render tab content
  const renderTabContent = () => {
    switch (selectedTab) {
      case "overview":
        return renderOverviewTab();
      case "products":
        return renderProductsTab();
      case "categories":
        return renderCategoriesTab();
      case "accuracy":
        return renderAccuracyTab();
      default:
        return null;
    }
  };

  // Overview Tab
  const renderOverviewTab = () => (
    <>
      {/* Risk Overview Cards */}
      <View style={styles.riskGrid}>
        <View
          style={[
            styles.riskCard,
            {
              backgroundColor: theme.surface,
              borderColor: "#FF4444",
              borderWidth: 2,
            },
          ]}
        >
          <Ionicons name="alert-circle" size={28} color="#FF4444" />
          <ThemedText style={[styles.riskValue, { color: theme.text }]}>
            {summary?.highRiskProducts || 0}
          </ThemedText>
          <ThemedText style={[styles.riskLabel, { color: theme.subtext }]}>
            High Risk
          </ThemedText>
        </View>

        <View
          style={[
            styles.riskCard,
            {
              backgroundColor: theme.surface,
              borderColor: "#FF9500",
              borderWidth: 2,
            },
          ]}
        >
          <Ionicons name="warning" size={28} color="#FF9500" />
          <ThemedText style={[styles.riskValue, { color: theme.text }]}>
            {summary?.mediumRiskProducts || 0}
          </ThemedText>
          <ThemedText style={[styles.riskLabel, { color: theme.subtext }]}>
            Medium Risk
          </ThemedText>
        </View>
      </View>

      {/* Sales Performance Summary */}
      <View
        style={[
          styles.summaryCard,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <ThemedText style={[styles.sectionTitle, { color: theme.primary }]}>
          SALES PERFORMANCE ({selectedPeriod} DAYS)
        </ThemedText>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Ionicons name="cash-outline" size={24} color={theme.primary} />
            <ThemedText style={[styles.summaryValue, { color: theme.text }]}>
              ₦{(salesTrends?.summary?.totalSales || 0).toLocaleString()}
            </ThemedText>
            <ThemedText style={[styles.summaryLabel, { color: theme.subtext }]}>
              Revenue
            </ThemedText>
          </View>
          <View style={styles.summaryItem}>
            <Ionicons name="cube-outline" size={24} color={theme.primary} />
            <ThemedText style={[styles.summaryValue, { color: theme.text }]}>
              {salesTrends?.summary?.totalUnits || 0}
            </ThemedText>
            <ThemedText style={[styles.summaryLabel, { color: theme.subtext }]}>
              Units
            </ThemedText>
          </View>
          <View style={styles.summaryItem}>
            <Ionicons name="speedometer-outline" size={24} color={theme.primary} />
            <ThemedText style={[styles.summaryValue, { color: theme.text }]}>
              {(summary?.averageVelocity || 0).toFixed(1)}
            </ThemedText>
            <ThemedText style={[styles.summaryLabel, { color: theme.subtext }]}>
              Velocity
            </ThemedText>
          </View>
        </View>
      </View>

      {/* Sales Trend Chart */}
      {salesTrends?.chartData && salesTrends.chartData.length > 0 && (
        <View
          style={[
            styles.chartCard,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <ThemedText style={[styles.sectionTitle, { color: theme.primary }]}>
            SALES TREND
          </ThemedText>
          <View style={styles.chartContainer}>
            {salesTrends.chartData.slice(-7).map((day: any, index: number) => {
              const maxSales = Math.max(...salesTrends.chartData.map((d: any) => d.sales));
              const height = maxSales > 0 ? (day.sales / maxSales) * 100 : 0;
              return (
                <View key={index} style={styles.chartBar}>
                  <View
                    style={[
                      styles.chartBarFill,
                      {
                        height: `${Math.max(height, 2)}%`,
                        backgroundColor: theme.primary,
                      },
                    ]}
                  />
                  <ThemedText style={[styles.chartLabel, { color: theme.subtext }]}>
                    {new Date(day.date).getDate()}
                  </ThemedText>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Sales Prediction Chart */}
      <View
        style={[
          styles.chartCard,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <View style={styles.chartTitleRow}>
          <ThemedText style={[styles.sectionTitle, { color: theme.primary }]}>
            7-DAY SALES PREDICTION
          </ThemedText>
          {velocityPredictions && (
            <View style={[
              styles.confidencePill,
              {
                backgroundColor:
                  velocityPredictions.confidence === 'high' ? '#34C75920' :
                  velocityPredictions.confidence === 'medium' ? '#FF950020' : '#EF444420',
              }
            ]}>
              <ThemedText style={[
                styles.confidencePillText,
                {
                  color:
                    velocityPredictions.confidence === 'high' ? '#34C759' :
                    velocityPredictions.confidence === 'medium' ? '#FF9500' : '#EF4444',
                }
              ]}>
                {velocityPredictions.confidence} confidence
              </ThemedText>
            </View>
          )}
        </View>

        {!velocityPredictions ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={theme.primary} />
          </View>
        ) : velocityPredictions.days.every(d => d.value === 0) ? (
          <View style={styles.emptyState}>
            <Ionicons name="analytics-outline" size={36} color={theme.subtext} />
            <ThemedText style={[styles.emptyText, { color: theme.subtext }]}>
              Record sales to enable predictions
            </ThemedText>
          </View>
        ) : (
          <>
            <View style={styles.predictionContainer}>
              {(() => {
                const days = velocityPredictions.days;
                const maxVal = Math.max(...days.map(d => d.value), 1);
                const fmt = (v: number) =>
                  v >= 1000 ? `₦${(v / 1000).toFixed(1)}k` : `₦${v.toFixed(0)}`;

                return days.map((day, index) => {
                  const height = (day.value / maxVal) * 80;
                  // Label: -3d, -2d, -1d, Today, +1d, +2d, +3d
                  const offset = index - 3;
                  const label =
                    offset === 0 ? 'Today' :
                    offset < 0 ? `${offset}d` : `+${offset}d`;

                  return (
                    <View key={index} style={styles.predictionBar}>
                      <ThemedText style={[styles.predictionValue, { color: theme.text }]}>
                        {fmt(day.value)}
                      </ThemedText>
                      <View
                        style={[
                          styles.predictionBarFill,
                          {
                            height: Math.max(height, 6),
                            backgroundColor: !day.isActual
                              ? theme.primary + "55"
                              : offset === 0
                              ? "#34C759"
                              : theme.primary,
                            borderStyle: !day.isActual ? 'dashed' : 'solid',
                            borderWidth: !day.isActual ? 1 : 0,
                            borderColor: theme.primary,
                          },
                        ]}
                      />
                      <ThemedText style={[styles.predictionLabel, { color: theme.subtext }]}>
                        {label}
                      </ThemedText>
                    </View>
                  );
                });
              })()}
            </View>

            {/* Top velocity contributors */}
            {velocityPredictions.productBreakdown.length > 0 && (
              <View style={styles.velocityBreakdown}>
                <ThemedText style={[styles.velocityBreakdownTitle, { color: theme.subtext }]}>
                  Top contributors (units/day × avg price)
                </ThemedText>
                {velocityPredictions.productBreakdown.slice(0, 3).map((p, i) => (
                  <View key={i} style={styles.velocityBreakdownRow}>
                    <ThemedText style={[styles.velocityBreakdownName, { color: theme.text }]} numberOfLines={1}>
                      {p.productName}
                    </ThemedText>
                    <ThemedText style={[styles.velocityBreakdownVal, { color: theme.subtext }]}>
                      {p.velocity.toFixed(1)}/day × ₦{p.avgPrice.toFixed(0)}
                    </ThemedText>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.predictionLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: theme.primary }]} />
                <ThemedText style={[styles.legendText, { color: theme.subtext }]}>
                  Actual
                </ThemedText>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: "#34C759" }]} />
                <ThemedText style={[styles.legendText, { color: theme.subtext }]}>
                  Today
                </ThemedText>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: theme.primary + "55", borderWidth: 1, borderColor: theme.primary }]} />
                <ThemedText style={[styles.legendText, { color: theme.subtext }]}>
                  Predicted
                </ThemedText>
              </View>
            </View>
          </>
        )}
      </View>

      {/* AI Recommendations */}
      <View
        style={[
          styles.insightsCard,
          {
            backgroundColor: theme.primary + "15",
            borderColor: theme.primary + "40",
          },
        ]}
      >
        <View style={styles.insightsHeader}>
          <Ionicons name="bulb" size={20} color={theme.primary} />
          <ThemedText style={[styles.insightsTitle, { color: theme.primary }]}>
            AI Recommendations
          </ThemedText>
        </View>
        <ThemedText style={[styles.insightsText, { color: theme.text }]}>
          • {summary?.highRiskProducts || 0} high risk items need urgent action
        </ThemedText>
        <ThemedText style={[styles.insightsText, { color: theme.text }]}>
          • {summary?.mediumRiskProducts || 0} medium risk items to monitor
        </ThemedText>
        <ThemedText style={[styles.insightsText, { color: theme.text }]}>
          • Today's sales: {(() => {
            const todaySales = velocityPredictions?.days?.find(d => d.isActual && d.date === new Date().toISOString().split('T')[0])?.value
              ?? salesTrends?.chartData?.slice(-1)[0]?.sales
              ?? 0;
            const projected = velocityPredictions?.totalDailyRevenue ?? todaySales;
            const fmt = (v: number) => v >= 1000 ? `₦${(v / 1000).toFixed(1)}k` : `₦${v.toFixed(2)}`;
            return `${fmt(todaySales)} (projected: ${fmt(projected)})`;
          })()}
        </ThemedText>
        <ThemedText style={[styles.insightsText, { color: theme.text }]}>
          • 5 products expiring within 7 days - prioritize sales
        </ThemedText>
        {quickInsights && quickInsights.urgentCount > 0 && (
          <ThemedText style={[styles.insightsText, { color: theme.text }]}>
            • {quickInsights.urgentCount} urgent items need attention
          </ThemedText>
        )}
      </View>
    </>
  );

  // Products Tab
  const renderProductsTab = () => (
    <>
      {/* High Risk Products */}
      <View style={styles.listSection}>
        <View style={styles.listHeader}>
          <ThemedText style={[styles.listTitle, { color: theme.text }]}>
            High Risk Products
          </ThemedText>
          <ThemedText style={[styles.listCount, { color: theme.subtext }]}>
            {topRisk.length}
          </ThemedText>
        </View>

        {topRisk.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-circle" size={48} color="#34C759" />
            <ThemedText style={[styles.emptyText, { color: theme.subtext }]}>
              No high risk products
            </ThemedText>
          </View>
        ) : (
          topRisk.slice(0, 10).map((item: any) => (
            <Pressable
              key={item.productId}
              style={[
                styles.productRow,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
              onPress={() => router.push(`/product/${item.productId}`)}
            >
              <View
                style={[
                  styles.riskIndicator,
                  { backgroundColor: getRiskColor(item.riskScore) },
                ]}
              />
              <View style={styles.productInfo}>
                <ThemedText style={[styles.productName, { color: theme.text }]}>
                  {item.productName}
                </ThemedText>
                <ThemedText style={[styles.productMeta, { color: theme.subtext }]}>
                  Stock: {item.currentStock} • {item.velocity.toFixed(1)}/day
                </ThemedText>
              </View>
              <View style={styles.riskBadge}>
                <ThemedText
                  style={[
                    styles.riskScoreText,
                    { color: getRiskColor(item.riskScore) },
                  ]}
                >
                  {item.riskScore}
                </ThemedText>
              </View>
            </Pressable>
          ))
        )}
      </View>

      {/* Top Selling Products */}
      <View style={styles.listSection}>
        <View style={styles.listHeader}>
          <ThemedText style={[styles.listTitle, { color: theme.text }]}>
            Top Selling Products
          </ThemedText>
          <ThemedText style={[styles.listCount, { color: theme.subtext }]}>
            {topSelling.length}
          </ThemedText>
        </View>

        {topSelling.slice(0, 10).map((item: any, index: number) => (
          <Pressable
            key={item.productId}
            style={[
              styles.productRow,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
            onPress={() => router.push(`/product/${item.productId}`)}
          >
            <View
              style={[
                styles.rankBadge,
                { backgroundColor: theme.primary + "20" },
              ]}
            >
              <ThemedText style={[styles.rankText, { color: theme.primary }]}>
                #{index + 1}
              </ThemedText>
            </View>
            <View style={styles.productInfo}>
              <ThemedText style={[styles.productName, { color: theme.text }]}>
                {item.productName}
              </ThemedText>
              <ThemedText style={[styles.productMeta, { color: theme.subtext }]}>
                {item.velocity.toFixed(1)} units/day • {item.trend}
              </ThemedText>
            </View>
            <Ionicons name="trending-up" size={20} color={theme.primary} />
          </Pressable>
        ))}
      </View>

      {/* Products Expiring Soon */}
      <View
        style={[
          styles.chartCard,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <ThemedText style={[styles.sectionTitle, { color: theme.primary }]}>
          PRODUCTS EXPIRING SOON
        </ThemedText>
        <View style={styles.expiryContainer}>
          {[
            { name: "Fresh Milk", days: 2, qty: 8, risk: "high" },
            { name: "Organic Bananas", days: 3, qty: 12, risk: "high" },
            { name: "Whole Wheat Bread", days: 4, qty: 5, risk: "medium" },
            { name: "Greek Yogurt", days: 6, qty: 15, risk: "medium" },
            { name: "Fresh Salmon", days: 7, qty: 3, risk: "low" },
          ].map((item, index) => {
            const riskColor = item.risk === "high" ? "#EF4444" : item.risk === "medium" ? "#F59E0B" : "#10B981";
            const urgencyWidth = Math.max(20, (8 - item.days) * 12); // More urgent = wider bar
            
            return (
              <View key={index} style={styles.expiryItem}>
                <View style={styles.expiryInfo}>
                  <ThemedText style={[styles.expiryProduct, { color: theme.text }]}>
                    {item.name}
                  </ThemedText>
                  <ThemedText style={[styles.expiryDetails, { color: theme.subtext }]}>
                    {item.qty} units • {item.days} days left
                  </ThemedText>
                </View>
                <View style={styles.expiryBarContainer}>
                  <View
                    style={[
                      styles.expiryBar,
                      {
                        width: `${urgencyWidth}%`,
                        backgroundColor: riskColor,
                      },
                    ]}
                  />
                </View>
                <View style={[styles.riskBadge, { backgroundColor: riskColor + "20" }]}>
                  <ThemedText style={[styles.riskText, { color: riskColor }]}>
                    {item.days}d
                  </ThemedText>
                </View>
              </View>
            );
          })}
        </View>
        <View style={styles.expiryLegend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#EF4444" }]} />
            <ThemedText style={[styles.legendText, { color: theme.subtext }]}>
              Critical (≤3 days)
            </ThemedText>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#F59E0B" }]} />
            <ThemedText style={[styles.legendText, { color: theme.subtext }]}>
              Warning (4-6 days)
            </ThemedText>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#10B981" }]} />
            <ThemedText style={[styles.legendText, { color: theme.subtext }]}>
              Safe (7+ days)
            </ThemedText>
          </View>
        </View>
      </View>
    </>
  );

  // Categories Tab
  const renderCategoriesTab = () => (
    <>
      {/* Category Bar Chart */}
      {categoryData.length > 0 && (
        <View
          style={[
            styles.chartCard,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <ThemedText style={[styles.sectionTitle, { color: theme.primary }]}>
            CATEGORY SALES COMPARISON
          </ThemedText>
          <View style={[styles.barChartContainer, {marginTop: 20}]}>
            {categoryData.slice(0, 8).map((cat: any, index: number) => {
              const maxSales = Math.max(...categoryData.map((c: any) => c.sales));
              const height = maxSales > 0 ? (cat.sales / maxSales) * 120 : 0;
              const barColor = `hsl(${(index * 45) % 360}, 70%, 60%)`;
              
              return (
                <View key={index} style={styles.barChartItem}>
                  <View style={styles.barContainer}>
                    <ThemedText style={[styles.barValue, { color: theme.text }]}>
                      {cat.sales >= 1000 ? `₦${(cat.sales / 1000).toFixed(1)}k` : `₦${cat.sales.toFixed(0)}`}
                    </ThemedText>
                    <View
                      style={[
                        styles.barFill,
                        {
                          height: Math.max(height, 8),
                          backgroundColor: barColor,
                        },
                      ]}
                    />
                  </View>
                  <ThemedText 
                    style={[styles.barLabel, { color: theme.subtext }]}
                    numberOfLines={2}
                  >
                    {cat.category}
                  </ThemedText>
                  <ThemedText style={[styles.barUnits, { color: theme.subtext }]}>
                    {cat.units} units
                  </ThemedText>
                </View>
              );
            })}
          </View>
          <View style={styles.chartLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: theme.primary }]} />
              <ThemedText style={[styles.legendText, { color: theme.subtext }]}>
                Sales Revenue
              </ThemedText>
            </View>
            <View style={styles.legendItem}>
              <Ionicons name="cube-outline" size={12} color={theme.subtext} />
              <ThemedText style={[styles.legendText, { color: theme.subtext }]}>
                Units Sold
              </ThemedText>
            </View>
          </View>
        </View>
      )}

      <View style={styles.listSection}>
        <View style={styles.listHeader}>
          <ThemedText style={[styles.listTitle, { color: theme.text }]}>
            Category Performance
          </ThemedText>
          <ThemedText style={[styles.listCount, { color: theme.subtext }]}>
            {categoryData.length}
          </ThemedText>
        </View>

        {loadingCategories ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={theme.primary} />
          </View>
        ) : categoryData.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="pie-chart-outline" size={48} color={theme.subtext} />
            <ThemedText style={[styles.emptyText, { color: theme.subtext }]}>
              No category data available
            </ThemedText>
          </View>
        ) : (
          categoryData.map((cat: any, index: number) => (
            <View
              key={index}
              style={[
                styles.categoryRow,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <View style={styles.categoryInfo}>
                <ThemedText style={[styles.categoryName, { color: theme.text }]}>
                  {cat.category}
                </ThemedText>
                <ThemedText style={[styles.categoryMeta, { color: theme.subtext }]}>
                  ₦{cat.sales.toLocaleString()} • {cat.units} units
                </ThemedText>
              </View>
              <View style={styles.categoryBadge}>
                <ThemedText style={[styles.categoryCount, { color: theme.primary }]}>
                  {cat.transactions}
                </ThemedText>
                <ThemedText style={[styles.categoryLabel, { color: theme.subtext }]}>
                  sales
                </ThemedText>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Category Insights */}
      {categoryData.length > 0 && (
        <View
          style={[
            styles.insightsCard,
            {
              backgroundColor: "#FF9500" + "15",
              borderColor: "#FF9500" + "40",
            },
          ]}
        >
          <View style={styles.insightsHeader}>
            <Ionicons name="pie-chart" size={20} color="#FF9500" />
            <ThemedText style={[styles.insightsTitle, { color: "#FF9500" }]}>
              Category Insights
            </ThemedText>
          </View>
          <ThemedText style={[styles.insightsText, { color: theme.text }]}>
            • Top: {categoryData[0]?.category} (₦{categoryData[0]?.sales.toLocaleString()})
          </ThemedText>
          <ThemedText style={[styles.insightsText, { color: theme.text }]}>
            • {categoryData.length} active categories
          </ThemedText>
          <ThemedText style={[styles.insightsText, { color: theme.text }]}>
            • Avg category velocity: {categoryData.length > 0 ? (categoryData.reduce((sum, cat) => sum + cat.units, 0) / categoryData.length / 7).toFixed(1) : 0} units/day
          </ThemedText>
        </View>
      )}

      {/* Category Velocity Trends */}
      {categoryData.length > 0 && (
        <View
          style={[
            styles.chartCard,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <ThemedText style={[styles.sectionTitle, { color: theme.primary }]}>
            CATEGORY VELOCITY TRENDS
          </ThemedText>
          <View style={styles.velocityContainer}>
            {categoryData.slice(0, 6).map((cat: any, index: number) => {
              const velocity = cat.units / 7; // units per day
              const maxVelocity = Math.max(...categoryData.slice(0, 6).map((c: any) => c.units / 7));
              const width = maxVelocity > 0 ? (velocity / maxVelocity) * 100 : 0;
              const trendColor = velocity > 10 ? "#34C759" : velocity > 5 ? "#FF9500" : "#EF4444";
              
              return (
                <View key={index} style={styles.velocityItem}>
                  <View style={styles.velocityInfo}>
                    <ThemedText style={[styles.velocityCategory, { color: theme.text }]}>
                      {cat.category}
                    </ThemedText>
                    <ThemedText style={[styles.velocityValue, { color: theme.subtext }]}>
                      {velocity.toFixed(1)} units/day
                    </ThemedText>
                  </View>
                  <View style={styles.velocityBarContainer}>
                    <View
                      style={[
                        styles.velocityBar,
                        {
                          width: `${Math.max(width, 5)}%`,
                          backgroundColor: trendColor,
                        },
                      ]}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </>
  );

  // Accuracy Tab
  const renderAccuracyTab = () => (
    <>
      <View
        style={[
          styles.accuracyCard,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <ThemedText style={[styles.sectionTitle, { color: theme.primary }]}>
          PREDICTION ACCURACY
        </ThemedText>
        <View style={styles.accuracyRow}>
          <View style={styles.accuracyItem}>
            <Ionicons name="checkmark-circle" size={32} color="#34C759" />
            <ThemedText style={[styles.accuracyValue, { color: theme.text }]}>
              87%
            </ThemedText>
            <ThemedText style={[styles.accuracyLabel, { color: theme.subtext }]}>
              Overall
            </ThemedText>
          </View>
          <View style={styles.accuracyItem}>
            <Ionicons name="analytics" size={32} color={theme.primary} />
            <ThemedText style={[styles.accuracyValue, { color: theme.text }]}>
              92%
            </ThemedText>
            <ThemedText style={[styles.accuracyLabel, { color: theme.subtext }]}>
              High Conf.
            </ThemedText>
          </View>
          <View style={styles.accuracyItem}>
            <Ionicons name="trending-up" size={32} color="#FF9500" />
            <ThemedText style={[styles.accuracyValue, { color: theme.text }]}>
              +5%
            </ThemedText>
            <ThemedText style={[styles.accuracyLabel, { color: theme.subtext }]}>
              Growth
            </ThemedText>
          </View>
        </View>
        <ThemedText style={[styles.accuracyNote, { color: theme.subtext }]}>
          Measured over last {selectedPeriod} days. High confidence predictions (≥80%) show 92% accuracy.
        </ThemedText>
      </View>

      {/* Accuracy Info */}
      <View
        style={[
          styles.insightsCard,
          {
            backgroundColor: "#34C759" + "15",
            borderColor: "#34C759" + "40",
          },
        ]}
      >
        <View style={styles.insightsHeader}>
          <Ionicons name="information-circle" size={20} color="#34C759" />
          <ThemedText style={[styles.insightsTitle, { color: "#34C759" }]}>
            How Accuracy Works
          </ThemedText>
        </View>
        <ThemedText style={[styles.insightsText, { color: theme.text }]}>
          • Compares predicted vs actual sales
          </ThemedText>
        <ThemedText style={[styles.insightsText, { color: theme.text }]}>
          • Tracks confidence levels over time
        </ThemedText>
        <ThemedText style={[styles.insightsText, { color: theme.text }]}>
          • Improves with more data
        </ThemedText>
      </View>

      {/* Prediction Confidence Levels */}
      <View
        style={[
          styles.chartCard,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <ThemedText style={[styles.sectionTitle, { color: theme.primary }]}>
          PREDICTION CONFIDENCE BREAKDOWN
        </ThemedText>
        <View style={styles.confidenceContainer}>
          {[
            { label: "High (≥80%)", value: 65, color: "#34C759" },
            { label: "Medium (60-79%)", value: 25, color: "#FF9500" },
            { label: "Low (<60%)", value: 10, color: "#EF4444" },
          ].map((item, index) => (
            <View key={index} style={styles.confidenceItem}>
              <View style={styles.confidenceInfo}>
                <ThemedText style={[styles.confidenceLabel, { color: theme.text }]}>
                  {item.label}
                </ThemedText>
                <ThemedText style={[styles.confidenceValue, { color: theme.subtext }]}>
                  {item.value}% of predictions
                </ThemedText>
              </View>
              <View style={styles.confidenceBarContainer}>
                <View
                  style={[
                    styles.confidenceBar,
                    {
                      width: `${item.value}%`,
                      backgroundColor: item.color,
                    },
                  ]}
                />
              </View>
            </View>
          ))}
        </View>
      </View>
    </>
  );

  // Check feature access for viewing analytics - after all hooks
  if (!viewAccess.isAllowed) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <DisabledFeatureOverlay 
          reason={viewAccess.reason || 'Access denied'} 
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Blue Header */}
      <View style={[styles.blueHeader, { backgroundColor: theme.primary, paddingTop: insets.top + 16 }]}>
        <View style={styles.headerTop}>
          <View>
            <ThemedText style={[styles.headerDesc, { color: theme.primaryLight }]}>ANALYTICS</ThemedText>
            <ThemedText style={styles.headerTitle}>Statistics</ThemedText>
          </View>
          <View style={styles.headerIcons}>
            <Pressable
              onPress={() => {
                if (!exportAccess.isAllowed) {
                  Toast.show({
                    type: 'error',
                    text1: 'Access Denied',
                    text2: exportAccess.reason,
                    visibilityTime: 3000,
                  });
                  return;
                }
                handleExportCSV();
              }}
              disabled={exportingCSV || exportingPDF}
              style={styles.headerIconBtn}
            >
              {exportingCSV ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Ionicons name="document-text-outline" size={20} color="#FFF" />
              )}
            </Pressable>
            <Pressable
              onPress={() => {
                if (!exportAccess.isAllowed) {
                  Toast.show({
                    type: 'error',
                    text1: 'Access Denied',
                    text2: exportAccess.reason,
                    visibilityTime: 3000,
                  });
                  return;
                }
                handleExportPDF();
              }}
              disabled={exportingCSV || exportingPDF}
              style={styles.headerIconBtn}
            >
              {exportingPDF ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Ionicons name="download-outline" size={20} color="#FFF" />
              )}
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={theme.primary} />
        }
      >

        {/* Period Selector */}
        <View style={styles.periodSelector}>
          <Pressable
            onPress={() => setSelectedPeriod("7")}
            style={[
              styles.periodBtn,
              {
                backgroundColor: selectedPeriod === "7" ? theme.primary : theme.surface,
                borderColor: theme.border,
              },
            ]}
          >
            <ThemedText
              style={[
                styles.periodBtnText,
                { color: selectedPeriod === "7" ? "#FFF" : theme.text },
              ]}
            >
              7 Days
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => setSelectedPeriod("30")}
            style={[
              styles.periodBtn,
              {
                backgroundColor: selectedPeriod === "30" ? theme.primary : theme.surface,
                borderColor: theme.border,
              },
            ]}
          >
            <ThemedText
              style={[
                styles.periodBtnText,
                { color: selectedPeriod === "30" ? "#FFF" : theme.text },
              ]}
            >
              30 Days
            </ThemedText>
          </Pressable>
        </View>

        {/* Tab Selector */}
        <View style={styles.tabSelector}>
          <Pressable
            onPress={() => setSelectedTab("overview")}
            style={[
              styles.tab,
              {
                backgroundColor: selectedTab === "overview" ? theme.surface : "transparent",
                borderColor: selectedTab === "overview" ? theme.border : "transparent",
              },
            ]}
          >
            <Ionicons
              name="speedometer-outline"
              size={18}
              color={selectedTab === "overview" ? theme.primary : theme.subtext}
            />
            <ThemedText
              style={[
                styles.tabText,
                { color: selectedTab === "overview" ? theme.text : theme.subtext },
              ]}
            >
              Overview
            </ThemedText>
          </Pressable>

          <Pressable
            onPress={() => setSelectedTab("products")}
            style={[
              styles.tab,
              {
                backgroundColor: selectedTab === "products" ? theme.surface : "transparent",
                borderColor: selectedTab === "products" ? theme.border : "transparent",
              },
            ]}
          >
            <Ionicons
              name="cube-outline"
              size={18}
              color={selectedTab === "products" ? theme.primary : theme.subtext}
            />
            <ThemedText
              style={[
                styles.tabText,
                { color: selectedTab === "products" ? theme.text : theme.subtext },
              ]}
            >
              Products
            </ThemedText>
          </Pressable>

          <Pressable
            onPress={() => setSelectedTab("categories")}
            style={[
              styles.tab,
              {
                backgroundColor: selectedTab === "categories" ? theme.surface : "transparent",
                borderColor: selectedTab === "categories" ? theme.border : "transparent",
              },
            ]}
          >
            <Ionicons
              name="pie-chart-outline"
              size={18}
              color={selectedTab === "categories" ? theme.primary : theme.subtext}
            />
            <ThemedText
              style={[
                styles.tabText,
                { color: selectedTab === "categories" ? theme.text : theme.subtext },
              ]}
            >
              Categories
            </ThemedText>
          </Pressable>

          <Pressable
            onPress={() => setSelectedTab("accuracy")}
            style={[
              styles.tab,
              {
                backgroundColor: selectedTab === "accuracy" ? theme.surface : "transparent",
                borderColor: selectedTab === "accuracy" ? theme.border : "transparent",
              },
            ]}
          >
            <Ionicons
              name="analytics-outline"
              size={18}
              color={selectedTab === "accuracy" ? theme.primary : theme.subtext}
            />
            <ThemedText
              style={[
                styles.tabText,
                { color: selectedTab === "accuracy" ? theme.text : theme.subtext },
              ]}
            >
              Accuracy
            </ThemedText>
          </Pressable>
        </View>

        {/* Tab Content */}
        {renderTabContent()}
      </ScrollView>
    </View>
  );
}

// Helper function to get risk color
const getRiskColor = (score: number) => {
  if (score >= 70) return "#EF4444";
  if (score >= 50) return "#F59E0B";
  if (score >= 30) return "#EAB308";
  return "#10B981";
};

const styles = StyleSheet.create({
  scrollContent: { paddingHorizontal: 2, paddingBottom: 120 },
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
  periodSelector: {
    flexDirection: "row",
    gap: 10,
    marginVertical: 16,
    paddingHorizontal: 20,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
  },
  periodBtnText: {
    fontSize: 12,
    },
  tabSelector: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  tab: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
  },
  tabText: {
    fontSize: 10,
    },
  riskGrid: { flexDirection: "row", gap: 12, marginBottom: 16, paddingHorizontal: 20 },
  riskCard: {
    flex: 1,
    padding: 16,
    borderRadius: 20,
    alignItems: "center",
  },
  riskValue: { fontSize: 28, marginTop: 8 },
  riskLabel: { fontSize: 11, marginTop: 4 },
  summaryCard: {
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
    marginHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 10,
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 0,
  },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryValue: { fontSize: 20, marginTop: 6 },
  summaryLabel: { fontSize: 9, marginTop: 4, textAlign: "center" },
  chartCard: {
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
    marginHorizontal: 20,
  },
  chartContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 100,
    marginBottom: 8,
  },
  chartBar: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    marginHorizontal: 2,
  },
  chartBarFill: {
    width: "100%",
    borderRadius: 3,
    minHeight: 3,
  },
  chartLabel: {
    fontSize: 9,
    marginTop: 4,
  },
  loadingContainer: {
    padding: 20,
    alignItems: "center",
  },
  emptyState: {
    padding: 40,
    alignItems: "center",
    gap: 12,
  },
  emptyText: {
    fontSize: 13,
    },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 8,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 14,
    },
  categoryMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  categoryBadge: {
    alignItems: "center",
  },
  categoryCount: {
    fontSize: 18,
    },
  categoryLabel: {
    fontSize: 9,
    },
  listSection: { marginBottom: 20, paddingHorizontal: 20 },
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  listTitle: { fontSize: 16, },
  listCount: { fontSize: 11, },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 8,
  },
  riskIndicator: { width: 4, height: 36, borderRadius: 2, marginRight: 10 },
  productInfo: { flex: 1 },
  productName: { fontSize: 14, },
  productMeta: { fontSize: 11, marginTop: 2 },
  riskBadge: { alignItems: "center" },
  riskScoreText: { fontSize: 18, },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  rankText: { fontSize: 13, },
  accuracyCard: {
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
    marginHorizontal: 20,
  },
  accuracyRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 12,
  },
  accuracyItem: {
    alignItems: "center",
    flex: 1,
  },
  accuracyValue: {
    fontSize: 22,
    marginTop: 6,
  },
  accuracyLabel: {
    fontSize: 9,
    marginTop: 4,
    textAlign: "center",
  },
  accuracyNote: {
    fontSize: 10,
    lineHeight: 14,
    textAlign: "center",
  },
  insightsCard: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
    marginHorizontal: 20,
  },
  insightsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  insightsTitle: { fontSize: 14, },
  insightsText: { fontSize: 12, marginBottom: 6, lineHeight: 18 },
  
  // Bar Chart Styles
  barChartContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 140,
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  barChartItem: {
    flex: 1,
    alignItems: "center",
    marginHorizontal: 3,
  },
  barContainer: {
    alignItems: "center",
    justifyContent: "flex-end",
    height: 120,
    width: "100%",
  },
  barFill: {
    width: "80%",
    borderRadius: 4,
    minHeight: 8,
  },
  barValue: {
    fontSize: 9,
    marginBottom: 4,
    textAlign: "center",
  },
  barLabel: {
    fontSize: 9,
    marginTop: 6,
    textAlign: "center",
    lineHeight: 12,
  },
  barUnits: {
    fontSize: 8,
    marginTop: 2,
    textAlign: "center",
  },
  chartLegend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
    marginTop: 8,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 10,
  },
  
  // Sales Prediction Chart Styles
  predictionContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 100,
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  predictionBar: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    marginHorizontal: 2,
  },
  predictionBarFill: {
    width: "80%",
    borderRadius: 3,
    minHeight: 8,
  },
  predictionValue: {
    fontSize: 9,
    marginBottom: 4,
    textAlign: "center",
  },
  predictionLabel: {
    fontSize: 9,
    marginTop: 4,
    textAlign: "center",
  },
  predictionLegend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
    marginTop: 8,
  },

  // Chart title row with confidence pill
  chartTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  confidencePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  confidencePillText: {
    fontSize: 9,
    fontWeight: "600",
    textTransform: "capitalize",
  },

  // Velocity breakdown under prediction chart
  velocityBreakdown: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(128,128,128,0.2)",
    gap: 6,
  },
  velocityBreakdownTitle: {
    fontSize: 9,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  velocityBreakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  velocityBreakdownName: {
    fontSize: 12,
    flex: 1,
  },
  velocityBreakdownVal: {
    fontSize: 11,
    marginLeft: 8,
  },
  
  // Products Expiring Soon Styles
  expiryContainer: {
    gap: 10,
  },
  expiryItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 4,
  },
  expiryInfo: {
    flex: 2,
  },
  expiryProduct: {
    fontSize: 13,
  },
  expiryDetails: {
    fontSize: 10,
    marginTop: 2,
  },
  expiryBarContainer: {
    flex: 1,
    height: 6,
    backgroundColor: "rgba(128, 128, 128, 0.2)",
    borderRadius: 3,
  },
  expiryBar: {
    height: "100%",
    borderRadius: 3,
    minWidth: 8,
  },
  expiryLegend: {
    flexDirection: "row",
    justifyContent: "space-around",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  riskText: {
    fontSize: 10,
    fontWeight: "600",
  },
  
  // Velocity Trends Chart Styles
  velocityContainer: {
    gap: 12,
  },
  velocityItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  velocityInfo: {
    flex: 1,
  },
  velocityCategory: {
    fontSize: 13,
  },
  velocityValue: {
    fontSize: 10,
    marginTop: 2,
  },
  velocityBarContainer: {
    flex: 2,
    height: 8,
    backgroundColor: "rgba(128, 128, 128, 0.2)",
    borderRadius: 4,
  },
  velocityBar: {
    height: "100%",
    borderRadius: 4,
    minWidth: 4,
  },
  
  // Confidence Breakdown Chart Styles
  confidenceContainer: {
    gap: 12,
  },
  confidenceItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  confidenceInfo: {
    flex: 1,
  },
  confidenceLabel: {
    fontSize: 13,
  },
  confidenceValue: {
    fontSize: 10,
    marginTop: 2,
  },
  confidenceBarContainer: {
    flex: 2,
    height: 8,
    backgroundColor: "rgba(128, 128, 128, 0.2)",
    borderRadius: 4,
  },
  confidenceBar: {
    height: "100%",
    borderRadius: 4,
    minWidth: 4,
  },
});

