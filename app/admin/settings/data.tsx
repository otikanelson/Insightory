import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from "expo-router";
import * as Sharing from 'expo-sharing';
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    View
} from "react-native";
import Toast from "react-native-toast-message";
import { useTheme } from "../../../context/ThemeContext";
import { useFeatureAccess } from "../../../hooks/useFeatureAccess";

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/api';

export default function DataSettingsScreen() {
  const { theme, isDark } = useTheme();
  const router = useRouter();
  
  // Check feature access for exporting data
  const exportAccess = useFeatureAccess('exportData');

  // Data Management State
  const [enableBackup, setEnableBackup] = useState(false);
  const [lastBackupDate, setLastBackupDate] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const backupEnabled = await AsyncStorage.getItem('admin_auto_backup');
      const lastBackup = await AsyncStorage.getItem('last_backup_date');
      
      if (backupEnabled !== null) setEnableBackup(backupEnabled === 'true');
      if (lastBackup) setLastBackupDate(lastBackup);
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handleAutoBackupToggle = async (value: boolean) => {
    setEnableBackup(value);
    try {
      await AsyncStorage.setItem('admin_auto_backup', value.toString());
      
      if (value) {
        // Schedule next backup for 7 days from now
        const nextBackupDate = new Date();
        nextBackupDate.setDate(nextBackupDate.getDate() + 7);
        await AsyncStorage.setItem('next_backup_date', nextBackupDate.toISOString());
        
        // Perform initial backup when enabled
        await performBackup();
      } else {
        // Clear scheduled backup
        await AsyncStorage.removeItem('next_backup_date');
      }
      
      Toast.show({
        type: 'success',
        text1: 'Setting Updated',
        text2: `Auto-backup ${value ? 'enabled - backs up every 7 days' : 'disabled'}`
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Update Failed',
        text2: 'Please try again'
      });
    }
  };

  const performBackup = async () => {
    try {
      // Fetch all data
      const [productsRes, salesRes, predictionsRes] = await Promise.all([
        axios.get(`${API_URL}/products`),
        axios.get(`${API_URL}/analytics/sales-trends?days=365`),
        axios.get(`${API_URL}/analytics/dashboard`)
      ]);
      
      if (productsRes.data.success) {
        const products = productsRes.data.data;
        const salesData = salesRes.data.success ? salesRes.data.data : null;
        const analyticsData = predictionsRes.data.success ? predictionsRes.data.data : null;
        
        // Create comprehensive backup object
        const backup = {
          timestamp: new Date().toISOString(),
          version: '2.0',
          type: 'full_backup',
          data: {
            products: products,
            productCount: products.length,
            salesHistory: salesData,
            aiInsights: analyticsData,
            inventorySnapshot: {
              totalProducts: products.length,
              totalQuantity: products.reduce((sum: number, p: any) => sum + (p.totalQuantity || 0), 0),
              perishableCount: products.filter((p: any) => p.isPerishable).length,
              categories: [...new Set(products.map((p: any) => p.category))].length
            }
          }
        };
        
        const backupJson = JSON.stringify(backup, null, 2);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
        const filename = `inventease_backup_${timestamp}.json`;
        
        if (Platform.OS === 'web') {
          // Web: Download backup
          const blob = new Blob([backupJson], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          link.click();
          URL.revokeObjectURL(url);
          
          Toast.show({
            type: 'success',
            text1: 'Backup Complete',
            text2: `${products.length} products backed up`
          });
        } else {
          // Mobile: Save backup to device
          const fileUri = FileSystem.documentDirectory + filename;
          await FileSystem.writeAsStringAsync(fileUri, backupJson);
          
          // Store backup metadata
          const backupDate = new Date().toISOString();
          await AsyncStorage.setItem('last_backup_date', backupDate);
          await AsyncStorage.setItem('last_backup_file', fileUri);
          setLastBackupDate(backupDate);
          
          // Share the backup file
          const isAvailable = await Sharing.isAvailableAsync();
          if (isAvailable) {
            await Sharing.shareAsync(fileUri, {
              mimeType: 'application/json',
              dialogTitle: 'Backup Complete - Save or Share',
              UTI: 'public.json'
            });
          }
          
          Toast.show({
            type: 'success',
            text1: 'Backup Complete',
            text2: `${products.length} products + sales + AI insights backed up`
          });
        }
        
        // Schedule next backup if auto-backup is enabled
        if (enableBackup) {
          const nextBackupDate = new Date();
          nextBackupDate.setDate(nextBackupDate.getDate() + 7);
          await AsyncStorage.setItem('next_backup_date', nextBackupDate.toISOString());
        }
      }
    } catch (error) {
      console.error('Backup error:', error);
      Toast.show({
        type: 'error',
        text1: 'Backup Failed',
        text2: 'Please try again'
      });
    }
  };

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const response = await axios.get(`${API_URL}/products`);
      
      if (response.data.success) {
        const products = response.data.data;
        
        // Convert to CSV format
        const headers = ['Name', 'Category', 'Barcode', 'Total Quantity', 'Is Perishable', 'Batch Number', 'Batch Quantity', 'Expiry Date', 'Price'];
        const rows: string[][] = [];
        
        products.forEach((product: any) => {
          if (product.batches && product.batches.length > 0) {
            product.batches.forEach((batch: any) => {
              rows.push([
                product.name || '',
                product.category || '',
                product.barcode || '',
                String(product.totalQuantity || 0),
                product.isPerishable ? 'Yes' : 'No',
                batch.batchNumber || '',
                String(batch.quantity || 0),
                batch.expiryDate ? new Date(batch.expiryDate).toLocaleDateString() : '',
                batch.price ? String(batch.price) : ''
              ]);
            });
          } else {
            rows.push([
              product.name || '',
              product.category || '',
              product.barcode || '',
              String(product.totalQuantity || 0),
              product.isPerishable ? 'Yes' : 'No',
              '',
              '',
              '',
              ''
            ]);
          }
        });
        
        const csvContent = [
          headers.join(','),
          ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');
        
        // Save to device storage
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `inventory_export_${timestamp}.csv`;
        
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
            text2: `${products.length} products exported`
          });
        } else {
          // Mobile: Save and share file
          const fileUri = FileSystem.documentDirectory + filename;
          await FileSystem.writeAsStringAsync(fileUri, csvContent);
          
          // Check if sharing is available
          const isAvailable = await Sharing.isAvailableAsync();
          if (isAvailable) {
            await Sharing.shareAsync(fileUri, {
              mimeType: 'text/csv',
              dialogTitle: 'Export Inventory Data',
              UTI: 'public.comma-separated-values-text'
            });
            
            Toast.show({
              type: 'success',
              text1: 'Export Complete',
              text2: `${products.length} products exported`
            });
          } else {
            Toast.show({
              type: 'success',
              text1: 'Export Saved',
              text2: `File saved to ${fileUri}`
            });
          }
        }
      }
    } catch (error) {
      console.error('Export error:', error);
      Toast.show({
        type: 'error',
        text1: 'Export Failed',
        text2: 'Please try again'
      });
    } finally {
      setIsExporting(false);
    }
  };

  const SettingRow = ({ icon, label, description, onPress, children, isLast }: any) => {
    const row = (
      <View style={[styles.settingRow, !isLast && { borderBottomColor: theme.border, borderBottomWidth: 1 }]}>
        <View style={styles.settingMain}>
          <View style={[styles.iconBox, { backgroundColor: theme.primary + "15" }]}>
            <Ionicons name={icon} size={20} color={theme.primary} />
          </View>
          <View style={styles.textStack}>
            <Text style={[styles.settingLabel, { color: theme.text }]}>
              {label}
            </Text>
            {description && (
              <Text style={[styles.settingDesc, { color: theme.subtext }]}>
                {description}
              </Text>
            )}
          </View>
        </View>
        {children}
      </View>
    );

    if (onPress) {
      return (
        <Pressable onPress={onPress} android_ripple={{ color: theme.primary + "25" }}>
          {row}
        </Pressable>
      );
    }

    return row;
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flex: 1, backgroundColor: theme.background }}>
      

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header with Back Button */}
        <View style={styles.header}>
          <Pressable 
            onPress={() => router.push('/admin/settings')}
            style={[styles.backButton, { backgroundColor: theme.surface }]}
          >
            <Ionicons name="arrow-back" size={24} color={theme.primary} />
          </Pressable>
          <View>
            <Text style={[styles.headerSub, { color: theme.primary }]}>
              ADMIN_SETTINGS
            </Text>
            <Text style={[styles.headerTitle, { color: theme.text }]}>
              DATA
            </Text>
          </View>
        </View>

        {/* DATA MANAGEMENT SECTION */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.primary, marginBottom: 15 }]}>
            DATA EXPORT
          </Text>

          <View style={[styles.settingsContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <SettingRow
              icon="cloud-upload-outline"
              label="Auto Backup"
              description={
                enableBackup 
                  ? (lastBackupDate 
                      ? `Last: ${new Date(lastBackupDate).toLocaleDateString()}` 
                      : "Backs up every 7 days")
                  : "Enable automatic backups"
              }
            >
              <Switch
                value={enableBackup}
                onValueChange={handleAutoBackupToggle}
                trackColor={{ true: theme.primary }}
              />
            </SettingRow>

            {!enableBackup && (
              <DisabledButton
                onPress={performBackup}
                disabled={!exportAccess.isAllowed}
                disabledReason={exportAccess.reason}
                isViewOnly={exportAccess.isViewOnly}
                style={{ width: '100%' }}
              >
                <SettingRow
                  icon="save-outline"
                  label="Backup Now"
                  description="Create manual backup"
                >
                  <Ionicons name="chevron-forward" size={20} color={theme.subtext} />
                </SettingRow>
              </DisabledButton>
            )}

            <DisabledButton
              onPress={handleExportData}
              disabled={!exportAccess.isAllowed}
              disabledReason={exportAccess.reason}
              isViewOnly={exportAccess.isViewOnly}
              style={{ width: '100%' }}
            >
              <SettingRow
                icon="download-outline"
                label="Export Inventory CSV"
                description="Download inventory as CSV"
                isLast
              >
                {isExporting ? (
                  <ActivityIndicator size="small" color={theme.primary} />
                ) : (
                  <Ionicons name="chevron-forward" size={20} color={theme.subtext} />
                )}
              </SettingRow>
            </DisabledButton>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  header: { 
    marginTop: 70, 
    marginBottom: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerSub: { fontSize: 10, fontWeight: "900", letterSpacing: 2 },
  headerTitle: { fontSize: 25, fontWeight: "900", letterSpacing: -1 },
  section: { marginBottom: 50 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  settingsContainer: {
    borderRadius: 20,
    borderWidth: 2,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  settingMain: { flexDirection: "row", alignItems: "center", flex: 1 },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  textStack: { flex: 1 },
  settingLabel: { fontSize: 16, fontWeight: "600" },
  settingDesc: { fontSize: 12, marginTop: 2 },
});
