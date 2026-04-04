import AdminSecurityPINWarning from "@/components/AdminSecurityPINWarning";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { HelpTooltip } from "@/components/HelpTooltip";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { useAudioPlayer } from "expo-audio";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Animated,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View
} from "react-native";
import Toast from "react-native-toast-message";
import { useTheme } from "../../context/ThemeContext";
import { hasSecurityPIN } from "../../utils/securityPINCheck";

export default function ScanScreen() {
  console.log('🎬 [SCAN] Component mounting...');
  const router = useRouter();
  const { initialTab } = useLocalSearchParams();
  const { theme } = useTheme();

  // Check feature access for scanning
  const scanAccess = useFeatureAccess('scanBarcodes');

  // Camera permissions
  const [permission, requestPermission] = useCameraPermissions();
  console.log('📷 [SCAN] Camera permission state:', permission?.granted);

  // Tab State
  const [tab, setTab] = useState<"lookup" | "registry">(
    (initialTab as any) || "registry"
  );

  // Logic State
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [torch, setTorch] = useState(false);
  const [confirmModal, setConfirmModal] = useState(false);
  const [pinModal, setPinModal] = useState(false);
  const [isNewProduct, setIsNewProduct] = useState(false);
  const [pendingData, setPendingData] = useState<any>(null);
  const [adminPin, setAdminPin] = useState("");
  const [rapidScanEnabled, setRapidScanEnabled] = useState(false);

  const [securityPINWarningVisible, setSecurityPINWarningVisible] = useState(false);
  const [checkingSecurityPIN, setCheckingSecurityPIN] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const [cameraError, setCameraError] = useState(false);

  // CRITICAL: Key to force camera remount when screen focuses
  const [cameraKey, setCameraKey] = useState(0);

  // Audio Players
  const BatchPlayer = useAudioPlayer(require("../../assets/sounds/beep.mp3"));
  const RegPlayer = useAudioPlayer(
    require("../../assets/sounds/beep-beep.mp3")
  );

  // Load rapid scan setting
  useEffect(() => {
    console.log('⚙️ [SCAN] Loading rapid scan setting...');
    loadRapidScanSetting().catch(err => {
      console.error('❌ [SCAN] Failed to load rapid scan setting:', err);
    });
  }, []);

  // Check security PIN on mount
  useEffect(() => {
    console.log('🔐 [SCAN] Checking security PIN on mount...');
    checkSecurityPIN().catch(err => {
      console.error('❌ [SCAN] Failed to check security PIN:', err);
      setCheckingSecurityPIN(false);
    });
  }, []);

  const checkSecurityPIN = async () => {
    console.log('🔐 Scanner - Starting security PIN check...');
    setCheckingSecurityPIN(true);
    const pinSet = await hasSecurityPIN();
    console.log('🔐 Scanner - PIN check result:', pinSet);
    if (!pinSet) {
      console.log('⚠️ Scanner - No PIN found, showing warning');
      setSecurityPINWarningVisible(true);
    } else {
      console.log('✅ Scanner - PIN found, NOT showing warning');
      setSecurityPINWarningVisible(false);
    }
    setCheckingSecurityPIN(false);
  };

  const loadRapidScanSetting = async () => {
    try {
      const enabled = await AsyncStorage.getItem('rapid_scan_enabled');
      setRapidScanEnabled(enabled === 'true');
    } catch (error) {
      console.error('Error loading rapid scan setting:', error);
    }
  };

  // Scanner animation
  const scanAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    console.log('🎬 [SCAN] Starting scan animation...');
    try {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(scanAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(scanAnim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
      
      return () => {
        console.log('🛑 [SCAN] Stopping scan animation...');
        animation.stop();
      };
    } catch (err) {
      console.error('❌ [SCAN] Animation error:', err);
    }
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      console.log('👁️ [SCAN] Screen focused - resetting state...');
      try {
        setIsMounted(true);
        setCameraError(false);
        // Reset all state when returning to scanner
        setScanned(false);
        setLoading(false);
        setConfirmModal(false);
        setPinModal(false);
        setPendingData(null);
        setAdminPin("");
        setTorch(false);

        // Force camera remount by changing key
        setCameraKey((prev) => {
          const newKey = prev + 1;
          console.log('🔑 [SCAN] Camera key updated:', prev, '->', newKey);
          return newKey;
        });
      } catch (err) {
        console.error('❌ [SCAN] Error during focus effect:', err);
      }

      return () => {
        console.log('🧹 [SCAN] Screen unfocused - cleanup...');
        setIsMounted(false);
        // Cleanup on unmount
        setTorch(false);
      };
    }, [])
  );

  // Additional safety: Reset when tab changes
  React.useEffect(() => {
    console.log('🔄 [SCAN] Tab changed to:', tab);
    setScanned(false);
    setLoading(false);
  }, [tab]);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    console.log('📸 [SCAN] Barcode scanned:', data);
    if (scanned || loading) {
      console.log('⏭️ [SCAN] Scan ignored - already processing');
      return;
    }
    setScanned(true);
    setLoading(true);

    // Add delay to allow camera to focus properly
    await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
    try {
      let response;
      try {
        console.log('🌐 [SCAN] Fetching registry data for barcode:', data);
        response = await axios.get(
          `${process.env.EXPO_PUBLIC_API_URL}/products/registry/lookup/${data}`,
          { timeout: 3000 }
        );
        console.log('✅ [SCAN] Registry response:', response.data.found ? 'FOUND' : 'NOT FOUND');
      } catch (apiError: any) {
        // Network error - show offline message
        console.error('❌ [SCAN] Registry lookup failed:', apiError.message);
        console.log('📡 [SCAN] App is offline');
        RegPlayer.play();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Toast.show({
          type: 'error',
          text1: 'Offline Mode',
          text2: 'Scanning requires internet connection',
          visibilityTime: 4000,
        });
        setScanned(false);
        setLoading(false);
        return;
      }

      // LOOKUP MODE: Navigate to existing product
      if (tab === "lookup") {
        console.log('🔍 [SCAN] LOOKUP mode processing...');
        if (response.data.found) {
          console.log('✅ [SCAN] Product found in registry, checking local inventory...');
          // Product exists in registry - now find it in local inventory
          const localProductResponse = await axios.get(
            `${process.env.EXPO_PUBLIC_API_URL}/products/barcode/${data}`
          );
          
          if (localProductResponse.data.success && localProductResponse.data.product) {
            // Product found in local inventory
            console.log('✅ [SCAN] Product found in local inventory, navigating...');
            BatchPlayer.play();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setScanned(false);
            // Turn off torch before navigation
            setTorch(false);
            router.replace(`/product/${localProductResponse.data.product._id}`);
          } else {
            // Product in registry but not in local stock
            console.log('⚠️ [SCAN] Product in registry but not in local stock');
            RegPlayer.play();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            Toast.show({
              type: "info",
              text1: "Not In Stock",
              text2: `${response.data.productData.name} is registered but has no inventory`,
            });
            setScanned(false);
          }
        } else {
          // Product not even in registry
          console.log('❌ [SCAN] Product not found in registry');
          RegPlayer.play();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Toast.show({
            type: "info",
            text1: "Not Found",
            text2: "Product does not exist in registry",
          });
          setScanned(false);
        }
        return;
      }

      // REGISTRY MODE: Register or Add Batch
      if (response.data.found) {
        console.log('✅ [SCAN] REGISTRY mode - product exists, preparing batch add...');
        // Product exists in registry - add batch
        BatchPlayer.play();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setIsNewProduct(false);
        
        // Store complete product data for auto-fill
        const productData = response.data.productData;
        const dataToPass = {
          barcode: data,
          name: productData.name || "",
          category: productData.category || "",
          imageUrl: productData.imageUrl || "",
          isPerishable: String(productData.isPerishable || false),
        };
        
        // RAPID SCAN MODE: Skip confirmation, go directly to add-products
        if (rapidScanEnabled) {
          console.log('⚡ [SCAN] Rapid scan enabled - navigating directly...');
          setScanned(false);
          // Turn off torch before navigation
          setTorch(false);
          router.push({
            pathname: "/add-products",
            params: { 
              ...dataToPass, 
              mode: "inventory", 
              locked: "true" 
            },
          });
        } else {
          // Normal mode: Show confirmation
          console.log('📋 [SCAN] Normal mode - showing confirmation...');
          setPendingData(dataToPass);
          setConfirmModal(true);
        }
      } else {
        // Product NOT in registry - need to register
        console.log('⚠️ [SCAN] REGISTRY mode - new product, needs registration...');
        RegPlayer.play();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setIsNewProduct(true);
        setPendingData({ barcode: data });
        
        // RAPID SCAN MODE: For new products, still need PIN (security requirement)
        // So we show confirmation even in rapid mode
        setConfirmModal(true);
      }
    } catch (err) {
      console.error("❌ [SCAN] Scan Error:", err);
      Toast.show({ type: "error", text1: "Scan Failed", text2: "Please try again" });
      setScanned(false);
    } finally {
      console.log('🏁 [SCAN] Scan processing complete');
      setLoading(false);
    }
  };

  // Handle confirmation modal "Proceed" button
  const handleModalProceed = () => {
    setConfirmModal(false);
    
    if (isNewProduct) {
      // Unknown product - prompt for admin PIN
      setPinModal(true);
    } else {
      // Known product - go to add-products in inventory mode
      setScanned(false);
      // Turn off torch before navigation
      setTorch(false);
      router.push({
        pathname: "/add-products",
        params: { 
          ...pendingData, 
          mode: "inventory", 
          locked: "true" 
        },
      });
    }
  };

  const handleModalCancel = () => {
    setConfirmModal(false);
    setScanned(false);
  };

  // Handle admin PIN submission for new product registration
  const handlePinSubmit = async () => {
    try {
      const storedPin = await AsyncStorage.getItem('admin_security_pin');
      
      if (!storedPin) {
        Toast.show({ 
          type: "error", 
          text1: "Security PIN Not Set",
          text2: "Please set up admin security PIN in settings first"
        });
        setPinModal(false);
        setAdminPin("");
        setScanned(false);
        return;
      }

      if (adminPin === storedPin) {
        // Correct PIN - update last auth time
        await AsyncStorage.setItem('admin_last_auth', Date.now().toString());
        
        setPinModal(false);
        setAdminPin("");
        setScanned(false);
        
        // Turn off torch before navigation
        setTorch(false);
        
        // Navigate to add-products in REGISTRY mode
        router.push({
          pathname: "/add-products",
          params: {
            barcode: pendingData.barcode,
            mode: "registry",
          },
        });
      } else {
        // Incorrect PIN
        Toast.show({
          type: "error",
          text1: "Access Denied",
          text2: "Incorrect Security PIN",
        });
        setAdminPin("");
      }
    } catch (error) {
      console.error("PIN verification error:", error);
      Toast.show({
        type: "error",
        text1: "Authentication Error",
        text2: "Could not verify PIN",
      });
      setPinModal(false);
      setAdminPin("");
      setScanned(false);
    }
  };

  const handlePinCancel = () => {
    setPinModal(false);
    setAdminPin("");
    setScanned(false);
  };

  const handleSecurityPINWarningClose = () => {
    setSecurityPINWarningVisible(false);
  };

  const handleNavigateToSettings = () => {
    setSecurityPINWarningVisible(false);
    router.push('/settings');
  };

  // Handle camera permissions
  if (!permission) {
    console.log('⏳ [SCAN] Permission object is null/undefined - waiting...');
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.permissionText, { color: theme.text }]}>
          Requesting camera permission...
        </Text>
      </View>
    );
  }

  if (!permission.granted) {
    console.log('🚫 [SCAN] Camera permission not granted');

    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={64} color={theme.subtext} />
          <Text style={[styles.permissionText, { color: theme.text }]}>
            Camera permission required
          </Text>
          <Pressable 
            style={[styles.permissionBtn, { backgroundColor: theme.primary }]} 
            onPress={requestPermission}
          >
            <Text style={styles.permissionBtnText}>Grant Permission</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const tabColor = tab === "lookup" ? theme.primary : "#00FF00";

  console.log('🎨 [SCAN] Rendering scanner - cameraKey:', cameraKey, 'tab:', tab, 'loading:', loading, 'isMounted:', isMounted);

  // Block access if in view-only mode
  if (isViewOnly) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.permissionContainer}>
          <View style={[styles.viewOnlyBlock, { backgroundColor: '#FF9500' + '15', borderColor: '#FF9500' }]}>
            <Ionicons name="eye-off" size={64} color="#FF9500" />
            <Text style={[styles.viewOnlyTitle, { color: theme.text }]}>
              Scanner Disabled
            </Text>
            <Text style={[styles.viewOnlyText, { color: theme.subtext }]}>
              You are in view-only mode. Scanning is not available.
            </Text>
            <Pressable
              style={[styles.goBackBtn, { backgroundColor: theme.primary }]}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={20} color="#FFF" />
              <Text style={styles.goBackText}>Go Back</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  // CRITICAL: Don't render camera until component is fully mounted and permission is granted
  if (!isMounted || !permission?.granted) {
    console.log('⏸️ [SCAN] Waiting for mount/permission - isMounted:', isMounted, 'granted:', permission?.granted);
    return (
      <ErrorBoundary>
        <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.permissionText, { color: theme.text, marginTop: 20 }]}>
            Initializing camera...
          </Text>
        </View>
      </ErrorBoundary>
    );
  }

  // Show error state if camera failed to mount
  if (cameraError) {
    console.log('💥 [SCAN] Camera error state - showing recovery UI');
    return (
      <ErrorBoundary>
        <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center', padding: 20 }]}>
          <Ionicons name="camera-off" size={64} color={theme.subtext} />
          <Text style={[styles.permissionText, { color: theme.text, marginTop: 20, textAlign: 'center' }]}>
            Camera failed to initialize
          </Text>
          <Pressable
            style={[styles.permissionBtn, { backgroundColor: theme.primary, marginTop: 20 }]}
            onPress={() => {
              console.log('🔄 [SCAN] Retrying camera initialization...');
              setCameraError(false);
              setCameraKey(prev => prev + 1);
            }}
          >
            <Text style={styles.permissionBtnText}>Retry</Text>
          </Pressable>
          <Pressable
            style={[styles.permissionBtn, { backgroundColor: '#444', marginTop: 10 }]}
            onPress={() => router.back()}
          >
            <Text style={styles.permissionBtnText}>Go Back</Text>
          </Pressable>
        </View>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <View style={styles.container}>
      {/* CAMERA VIEW */}
      <CameraView
        key={cameraKey}
        style={StyleSheet.absoluteFillObject}
        facing="back"
        enableTorch={torch}
        onBarcodeScanned={loading ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ["ean13", "upc_a", "code128", "qr"],
        }}
        onMountError={(error) => {
          console.error('❌ [SCAN] Camera mount error:', error);
          setCameraError(true);
          Toast.show({
            type: 'error',
            text1: 'Camera Error',
            text2: 'Failed to initialize camera. Please try again.',
            visibilityTime: 5000,
          });
        }}
      />

      {/* DARK OVERLAY WITH VIEWFINDER */}
      <View style={styles.overlay}>
        {/* TOP BAR WITH TABS */}
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.iconCircle}>
            <Ionicons name="close" size={28} color="#FFF" />
          </Pressable>

          <View style={styles.tabContainer}>
            <Pressable
              onPress={() => {
                setTab("lookup");
                setScanned(false);
              }}
              style={[
                styles.tab,
                tab === "lookup" && { backgroundColor: theme.primary },
              ]}
            >
              <Text
                style={[styles.tabText, tab === "lookup" && { color: "#000" }]}
              >
                LOOKUP
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setTab("registry");
                setScanned(false);
              }}
              style={[
                styles.tab,
                tab === "registry" && { backgroundColor: "#00FF00" },
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  tab === "registry" && { color: "#000" },
                ]}
              >
                REGISTRY
              </Text>
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              onPress={() => setTorch(!torch)}
              style={[
                styles.iconCircle,
                torch && { backgroundColor: "rgba(255,255,255,0.4)" },
              ]}
            >
              <Ionicons
                name={torch ? "flash" : "flash-off"}
                size={24}
                color="#FFF"
              />
            </Pressable>
          </View>
        </View>

        {/* VIEWFINDER */}
        <View style={styles.viewfinderContainer}>
          <View style={styles.viewfinder}>
            <Animated.View
              style={[
                styles.scanLine,
                {
                  backgroundColor: tabColor,
                  shadowColor: tabColor,
                  transform: [
                    {
                      translateY: scanAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 250],
                      }),
                    },
                  ],
                },
              ]}
            />
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
            {loading && (
              <View style={styles.loadingOverlay}>
                <Text style={styles.loadingText}>Processing...</Text>
              </View>
            )}
          </View>
        </View>

        {/* BOTTOM HINTS AND BUTTONS */}
        <View style={styles.bottomBar}>
          {rapidScanEnabled && (
            <View style={[styles.rapidScanBadge, { backgroundColor: '#00FF00' + '20', borderColor: '#00FF00' }]}>
              <Ionicons name="flash" size={16} color="#00FF00" />
              <Text style={[styles.rapidScanText, { color: '#00FF00' }]}>
                RAPID SCAN
              </Text>
            </View>
          )}
          <Text style={styles.hintText}>
            {tab === "lookup" ?
              "Scan to find a product"
            : rapidScanEnabled ? 
              "Rapid mode: Instant batch entry"
            : "Scan to Register or Add Batch"}
          </Text>
          <View style={styles.bottomActions}>
            {tab === "registry" && (
              <Pressable
                style={styles.manualBtn}
                onPress={() => {
                  // Generate unique barcode for manual entry
                  const timestamp = Date.now();
                  const random = Math.floor(Math.random() * 10000);
                  const generatedBarcode = `MAN-${timestamp}-${random}`;
                  
                  // Turn off torch before navigation
                  setTorch(false);
                  
                  router.push({
                    pathname: "/add-products",
                    params: {
                      barcode: generatedBarcode,
                      mode: "manual",
                      hasBarcode: "false"
                    }
                  });
                }}
              >
                <Text style={styles.manualBtnText}>Manual Entry</Text>
              </Pressable>
            )}
            <HelpTooltip
              title="Scanner Modes"
              content={[
                "LOOKUP MODE: Quickly find products already in your inventory. Scan to view product details and stock levels.",
                "REGISTRY MODE: Add new products or restock existing ones. Scan to register new items or add batches to existing products."
              ]}
              icon="help-circle"
              iconSize={24}
              iconColor="#FFF"
            />
          </View>
        </View>
      </View>

      {/* CONFIRMATION MODAL */}
      <Modal visible={confirmModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalContent, { backgroundColor: theme.surface }]}
          >
            <Ionicons
              name={isNewProduct ? "duplicate-outline" : "cube-outline"}
              size={40}
              color={theme.primary}
            />
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              {isNewProduct ? "Unknown Product" : "Product Identified"}
            </Text>
            <Text
              style={{
                color: theme.subtext,
                textAlign: "center",
                marginVertical: 15,
              }}
            >
              {isNewProduct ?
                "Barcode not in registry. Register it now?"
              : `Found: ${pendingData?.name}. Add batch?`}
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: "#444" }]}
                onPress={handleModalCancel}
              >
                <Text style={{ color: "#FFF" }}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: theme.primary }]}
                onPress={handleModalProceed}
              >
                <Text style={{ color: "#FFF", fontWeight: "700" }}>
                  Proceed
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ADMIN PIN MODAL */}
      <Modal visible={pinModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalContent, { backgroundColor: theme.surface }]}
          >
            <Ionicons
              name="shield-checkmark"
              size={32}
              color={theme.primary}
              style={{ marginBottom: 10 }}
            />
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Admin Authorization
            </Text>
            <Text
              style={{
                color: theme.subtext,
                textAlign: "center",
                marginBottom: 20,
              }}
            >
              Enter admin PIN to register new product
            </Text>
            <TextInput
              style={[
                styles.pinInput,
                { 
                  color: theme.text, 
                  borderColor: theme.border,
                  backgroundColor: theme.background,
                },
              ]}
              secureTextEntry
              keyboardType="numeric"
              maxLength={4}
              value={adminPin}
              onChangeText={setAdminPin}
              placeholder="Enter PIN"
              placeholderTextColor={theme.subtext}
              autoFocus
            />
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: "#444" }]}
                onPress={handlePinCancel}
              >
                <Text style={{ color: "#FFF" }}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: theme.primary }]}
                onPress={handlePinSubmit}
              >
                <Text style={{ color: "#FFF", fontWeight: "700" }}>
                  Confirm
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* SECURITY PIN WARNING MODAL */}
      <AdminSecurityPINWarning
        visible={securityPINWarningVisible}
        onClose={handleSecurityPINWarningClose}
        onNavigateToSettings={handleNavigateToSettings}
      />
    </View>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "90%",
    alignSelf: "center",
    alignItems: "center",
    paddingTop: 60,
    marginBottom: 20,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    padding: 4,
    flex: 1,
    marginHorizontal: 15,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 10,
  },
  tabText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    fontWeight: "800",
  },
  iconCircle: {
    width: 45,
    height: 45,
    borderRadius: 23,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  viewfinderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  viewfinder: {
    width: 280,
    height: 250,
    position: "relative",
    overflow: "hidden",
    borderRadius: 20,
  },
  scanLine: {
    height: 3,
    width: "100%",
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 5,
  },
  corner: {
    position: "absolute",
    width: 40,
    height: 40,
    borderColor: "#FFF",
    borderWidth: 5,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 20,
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 20,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 20,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 20,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
  },
  bottomBar: {
    paddingBottom: 60,
    alignItems: "center",
    width: "100%",
  },
  hintText: {
    color: "#FFF",
    marginBottom: 20,
    fontWeight: "600",
    textAlign: "center",
  },
  bottomActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
  },
  manualBtn: {
    backgroundColor: "#FFF",
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 30,
  },
  manualBtnText: { color: "#000", fontWeight: "800", fontSize: 14 },
  rapidScanBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 2,
    marginBottom: 10,
  },
  rapidScanText: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "80%",
    padding: 25,
    borderRadius: 30,
    alignItems: "center",
  },
  modalTitle: { fontSize: 20, fontWeight: "900", marginBottom: 5 },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 10,
    width: "100%",
  },
  modalBtn: { 
    padding: 16, 
    borderRadius: 15, 
    flex: 1, 
    alignItems: "center" 
  },
  pinInput: {
    width: "100%",
    height: 60,
    borderWidth: 1,
    borderRadius: 15,
    textAlign: "center",
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 15,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  permissionText: {
    fontSize: 16,
    marginVertical: 20,
    textAlign: "center",
  },
  permissionBtn: {
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 20,
    marginTop: 10,
  },
  permissionBtnText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
  },
  viewOnlyBlock: {
    padding: 40,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: 'center',
    width: '90%',
  },
  viewOnlyTitle: {
    fontSize: 22,
    fontWeight: '900',
    marginTop: 20,
    marginBottom: 10,
  },
  viewOnlyText: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  goBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 16,
  },
  goBackText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
