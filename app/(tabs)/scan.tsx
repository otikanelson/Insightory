import AdminSecurityPINWarning from "@/components/AdminSecurityPINWarning";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { HelpTooltip } from "@/components/HelpTooltip";
import { ModalToast, useModalToast } from "@/components/ModalToast";
import { useAuth } from "@/context/AuthContext";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import axios from "axios";
import { useAudioPlayer } from "expo-audio";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    FlatList,
    Image,
    Modal,
    Pressable,
    StyleSheet,
    TextInput,
    View
} from "react-native";
import Toast from "react-native-toast-message";
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from "../../context/ThemeContext";
import { hasSecurityPIN } from "../../utils/securityPINCheck";

const { height } = Dimensions.get("window");

interface CartItem {
  _id: string;
  name: string;
  barcode: string;
  imageUrl?: string;
  totalQuantity: number;
  quantity: number; // quantity in cart
}

export default function ScanScreen() {
  console.log('🎬 [SCAN] Component mounting...');
  const router = useRouter();
  const params = useLocalSearchParams();
  const { initialTab } = params;
  const { theme } = useTheme();
  const { role, user } = useAuth();
  const modalToast = useModalToast();

  // Check feature access for scanning and other permissions
  const scanAccess = useFeatureAccess('scanProducts');
  const registerAccess = useFeatureAccess('registerProducts');
  const addAccess = useFeatureAccess('addProducts');
  const salesAccess = useFeatureAccess('processSales');

  // Camera permissions
  const [permission, requestPermission] = useCameraPermissions();
  console.log('📷 [SCAN] Camera permission state:', permission?.granted);

  // Tab State
  const [tab, setTab] = useState<"lookup" | "registry" | "sales">(
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

  // Permission modal states
  const [showRegisterPermissionModal, setShowRegisterPermissionModal] = useState(false);
  const [showAddPermissionModal, setShowAddPermissionModal] = useState(false);

  // Cart State (for sales mode)
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCartModal, setShowCartModal] = useState(false);

  const [securityPINWarningVisible, setSecurityPINWarningVisible] = useState(false);
  const [checkingSecurityPIN, setCheckingSecurityPIN] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const [cameraError, setCameraError] = useState(false);

  // CRITICAL: Key to force camera remount when screen focuses
  const [cameraKey, setCameraKey] = useState(0);

  // Cart Icon Animation
  const cartBounceAnim = useRef(new Animated.Value(1)).current;
  const cartShakeAnim = useRef(new Animated.Value(0)).current;

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

        // Clear cart if clearCart param is set
        if (params.clearCart === 'true') {
          console.log('🛒 [SCAN] Clearing cart...');
          setCart([]);
        }

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
    }, [params.clearCart])
  );

  // Additional safety: Reset when tab changes
  React.useEffect(() => {
    console.log('🔄 [SCAN] Tab changed to:', tab);
    setScanned(false);
    setLoading(false);
  }, [tab]);

  // Trigger cart bounce animation
  const animateCartIcon = () => {
    // Bounce effect
    Animated.sequence([
      Animated.timing(cartBounceAnim, {
        toValue: 1.3,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(cartBounceAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();

    // Shake effect
    Animated.sequence([
      Animated.timing(cartShakeAnim, {
        toValue: 10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(cartShakeAnim, {
        toValue: -10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(cartShakeAnim, {
        toValue: 10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(cartShakeAnim, {
        toValue: 0,
        duration: 50,
        useNativeDriver: true,
      }),
    ]).start();
  };

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

      // SALES MODE: Add to cart
      if (tab === "sales") {
        console.log('💰 [SCAN] SALES mode processing...');
        
        // Check if user has permission to process sales
        if (!salesAccess.isAllowed && role !== 'admin') {
          console.log('❌ [SCAN] No permission to process sales');
          RegPlayer.play();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Toast.show({
            type: "error",
            text1: "Permission Denied",
            text2: "You don't have permission to process sales",
            visibilityTime: 3000,
          });
          setScanned(false);
          setLoading(false);
          return;
        }
        
        if (response.data.found) {
          // First, get the product from local inventory to get accurate stock info
          try {
            const localProductResponse = await axios.get(
              `${process.env.EXPO_PUBLIC_API_URL}/products/barcode/${data}`
            );
            
            if (localProductResponse.data.success && localProductResponse.data.product) {
              const product = localProductResponse.data.product;

              // Check if product has stock
              if (product.totalQuantity === 0) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                Toast.show({
                  type: "error",
                  text1: "Out of Stock",
                  text2: `${product.name} is not available`,
                });
                setScanned(false);
                return;
              }

              // Check if already in cart
              const existingIndex = cart.findIndex((item) => item._id === product._id);

              if (existingIndex !== -1) {
                // Already in cart - increment quantity
                const updatedCart = [...cart];
                const currentQty = updatedCart[existingIndex].quantity;

                if (currentQty < product.totalQuantity) {
                  updatedCart[existingIndex].quantity += 1;
                  setCart(updatedCart);
                  
                  BatchPlayer.play();
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  animateCartIcon();
                  
                  Toast.show({
                    type: "success",
                    text1: "Quantity Updated",
                    text2: `${product.name} x${updatedCart[existingIndex].quantity}`,
                  });
                } else {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                  Toast.show({
                    type: "info",
                    text1: "Maximum Quantity",
                    text2: `Only ${product.totalQuantity} units available`,
                  });
                }
              } else {
                // Add new item to cart
                const newItem: CartItem = {
                  _id: product._id,
                  name: product.name,
                  barcode: product.barcode,
                  imageUrl: product.imageUrl,
                  totalQuantity: product.totalQuantity,
                  quantity: 1,
                };

                setCart([...cart, newItem]);
                
                BatchPlayer.play();
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                animateCartIcon();
                
                Toast.show({
                  type: "success",
                  text1: "Added to Cart",
                  text2: product.name,
                });
              }

              setScanned(false);
            } else {
              // Product in registry but not in local stock
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              Toast.show({
                type: "info",
                text1: "Not In Stock",
                text2: `${response.data.productData.name} exists in registry but has no inventory`,
              });
              setScanned(false);
            }
          } catch (localError) {
            console.error("Local product lookup error for sales:", localError);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Toast.show({
              type: "error",
              text1: "Not In Stock",
              text2: "Product exists in registry but has no inventory",
            });
            setScanned(false);
          }
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Toast.show({
            type: "error",
            text1: "Not Found",
            text2: "Product not in inventory",
          });
          setScanned(false);
        }
        return;
      }

      // REGISTRY MODE: Register or Add Batch
      if (response.data.found) {
        console.log('✅ [SCAN] REGISTRY mode - product exists, preparing batch add...');
        
        // Check if user has permission to add products
        if (!addAccess.isAllowed && role !== 'admin') {
          console.log('❌ [SCAN] No permission to add products');
          RegPlayer.play();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setShowAddPermissionModal(true);
          setScanned(false);
          setLoading(false);
          return;
        }
        
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
        
        // Check if user has permission to register products
        if (!registerAccess.isAllowed && role !== 'admin') {
          console.log('❌ [SCAN] No permission to register products');
          RegPlayer.play();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setShowRegisterPermissionModal(true);
          setScanned(false);
          setLoading(false);
          return;
        }
        
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
      // Get storeId — prefer context (always fresh), fall back to AsyncStorage
      const rawStoreId = user?.storeId || await AsyncStorage.getItem('auth_store_id');
      const storeId = rawStoreId ? rawStoreId.toString() : null;

      if (!storeId) {
        modalToast.show({ type: "error", title: "Store Not Found", message: "Could not identify store. Please log out and log back in." });
        setPinModal(false);
        setAdminPin("");
        setScanned(false);
        return;
      }

      // Verify against backend — authoritative source, works even if local cache is stale
      const response = await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL}/auth/verify-admin-security-pin`,
        { pin: adminPin, storeId }
      );

      if (response.data.success) {
        await AsyncStorage.setItem('admin_last_auth', Date.now().toString());
        setPinModal(false);
        setAdminPin("");
        setScanned(false);
        setTorch(false);
        router.push({ pathname: "/add-products", params: { barcode: pendingData.barcode, mode: "registry" } });
      } else {
        modalToast.show({ type: "error", title: "Access Denied", message: "Incorrect Security PIN" });
        setAdminPin("");
      }
    } catch (error: any) {
      const status = error?.response?.status;
      const serverMsg = error?.response?.data?.error;
      console.error("PIN verification error — status:", status, "message:", serverMsg, "raw:", error?.message);

      if (status === 401) {
        modalToast.show({ type: "error", title: "Access Denied", message: "Incorrect Security PIN" });
        setAdminPin("");
      } else if (status === 404) {
        modalToast.show({ type: "error", title: "Security PIN Not Set", message: "Please set up admin security PIN in settings first" });
        setPinModal(false);
        setAdminPin("");
        setScanned(false);
      } else if (status === 400) {
        modalToast.show({ type: "error", title: "Invalid Request", message: serverMsg || "Missing PIN or store ID" });
        setPinModal(false);
        setAdminPin("");
        setScanned(false);
      } else {
        modalToast.show({ type: "error", title: "Authentication Error", message: serverMsg || "Could not verify PIN. Check your connection." });
        setPinModal(false);
        setAdminPin("");
        setScanned(false);
      }
    }
  };

  const handlePinCancel = () => {
    setPinModal(false);
    setAdminPin("");
    setScanned(false);
  };

  // Cart management functions
  const updateCartQuantity = (productId: string, delta: number) => {
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
    modalToast.show({ type: "info", title: "Item Removed", message: "Product removed from cart" });
  };

  const getTotalItems = () => cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleCartDone = () => {
    if (cart.length === 0) {
      modalToast.show({ type: "info", title: "Empty Cart", message: "Please scan items to add to cart" });
      return;
    }
    setShowCartModal(false);
    router.push({ pathname: "/admin/sales", params: { cartData: JSON.stringify(cart), tab: "checkout" } });
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
        <ThemedText style={[styles.permissionText, { color: theme.text }]}>
          Requesting camera permission...
        </ThemedText>
      </View>
    );
  }

  if (!permission.granted) {
    console.log('🚫 [SCAN] Camera permission not granted');

    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={64} color={theme.subtext} />
          <ThemedText style={[styles.permissionText, { color: theme.text }]}>
            Camera permission required
          </ThemedText>
          <Pressable 
            style={[styles.permissionBtn, { backgroundColor: theme.primary }]} 
            onPress={requestPermission}
          >
            <ThemedText style={styles.permissionBtnText}>Grant Permission</ThemedText>
          </Pressable>
        </View>
      </View>
    );
  }

  const tabColor = tab === "lookup" ? theme.primary : tab === "sales" ? "#00D1FF" : "#00FF00";

  console.log('🎨 [SCAN] Rendering scanner - cameraKey:', cameraKey, 'tab:', tab, 'loading:', loading, 'isMounted:', isMounted);

  // If scan permission is denied, show restricted access
  if (!scanAccess.isAllowed) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </Pressable>
          <ThemedText style={[styles.headerTitle, { color: theme.text }]}>Scanner</ThemedText>
          <View style={{ width: 40 }} />
        </View>
        
        <View style={styles.restrictedContainer}>
          <View style={[styles.restrictedIcon, { backgroundColor: '#FF3B30' + '20' }]}>
            <Ionicons name="scan-outline" size={48} color="#FF3B30" />
          </View>
          <ThemedText style={[styles.restrictedTitle, { color: theme.text }]}>
            Scanner Access Restricted
          </ThemedText>
          <ThemedText style={[styles.restrictedMessage, { color: theme.subtext }]}>
            {scanAccess.reason || 'You do not have permission to access the scanner'}
          </ThemedText>
          <ThemedText style={[styles.restrictedNote, { color: theme.subtext }]}>
            Contact your administrator to enable scanner permissions.
          </ThemedText>
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
          <ThemedText style={[styles.permissionText, { color: theme.text, marginTop: 20 }]}>
            Initializing camera...
          </ThemedText>
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
          <Ionicons name="camera-outline" size={64} color={theme.subtext} />
          <ThemedText style={[styles.permissionText, { color: theme.text, marginTop: 20, textAlign: 'center' }]}>
            Camera failed to initialize
          </ThemedText>
          <Pressable
            style={[styles.permissionBtn, { backgroundColor: theme.primary, marginTop: 20 }]}
            onPress={() => {
              console.log('🔄 [SCAN] Retrying camera initialization...');
              setCameraError(false);
              setCameraKey(prev => prev + 1);
            }}
          >
            <ThemedText style={styles.permissionBtnText}>Retry</ThemedText>
          </Pressable>
          <Pressable
            style={[styles.permissionBtn, { backgroundColor: '#444', marginTop: 10 }]}
            onPress={() => router.back()}
          >
            <ThemedText style={styles.permissionBtnText}>Go Back</ThemedText>
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
                <ThemedText
                  style={[styles.tabText, tab === "lookup" && { color: "#000" }]}
                >
                  LOOKUP
                </ThemedText>
              </Pressable>
              
              {/* Only show sales tab if user has permission */}
              {(salesAccess.isAllowed || role === 'admin') && (
                <Pressable
                  onPress={() => {
                    setTab("sales");
                    setScanned(false);
                  }}
                  style={[
                    styles.tab,
                    tab === "sales" && { backgroundColor: "#00D1FF" },
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.tabText,
                      tab === "sales" && { color: "#000" },
                    ]}
                  >
                    SALES
                  </ThemedText>
                </Pressable>
              )}
              
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
                <ThemedText
                  style={[
                    styles.tabText,
                    tab === "registry" && { color: "#000" },
                  ]}
                >
                  REGISTRY
                </ThemedText>
              </Pressable>
            </View>

            <View style={{ flexDirection: 'row', gap: 8 }}>
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
                <ThemedText style={styles.loadingText}>Processing...</ThemedText>
              </View>
            )}
          </View>
        </View>

        {/* BOTTOM HINTS AND BUTTONS */}
        <View style={styles.bottomBar}>
          {rapidScanEnabled && (
            <View style={[styles.rapidScanBadge, { backgroundColor: '#00FF00' + '20', borderColor: '#00FF00' }]}>
              <Ionicons name="flash" size={16} color="#00FF00" />
              <ThemedText style={[styles.rapidScanText, { color: '#00FF00' }]}>
                RAPID SCAN
              </ThemedText>
            </View>
          )}
          <ThemedText style={styles.hintText}>
            {tab === "lookup" ?
              "Scan to find a product"
            : tab === "sales" ?
              "Scan items to add to cart"
            : rapidScanEnabled ? 
              "Rapid mode: Instant batch entry"
            : "Scan to Register or Add Batch"}
          </ThemedText>
          <View style={styles.bottomActions}>
            {tab === "sales" && (
              <Animated.View
                style={{
                  transform: [
                    { scale: cartBounceAnim },
                    { translateX: cartShakeAnim },
                  ],
                }}
              >
                <Pressable
                  style={[styles.cartButton, { backgroundColor: theme.primary }]}
                  onPress={() => setShowCartModal(true)}
                >
                  <Ionicons name="cart" size={24} color="#FFF" />
                  {cart.length > 0 && (
                    <View style={styles.cartBadge}>
                      <ThemedText style={styles.cartBadgeText}>{getTotalItems()}</ThemedText>
                    </View>
                  )}
                </Pressable>
              </Animated.View>
            )}
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
                <ThemedText style={styles.manualBtnText}>Manual Entry</ThemedText>
              </Pressable>
            )}
            <HelpTooltip
              title="Scanner Modes"
              content={[
                "LOOKUP MODE: Quickly find products already in your inventory. Scan to view product details and stock levels.",
                "SALES MODE: Process sales transactions. Scan products to add them to the cart, then complete the sale.",
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
            <ThemedText style={[styles.modalTitle, { color: theme.text }]}>
              {isNewProduct ? "Unknown Product" : "Product Identified"}
            </ThemedText>
            <ThemedText
              style={{
                color: theme.subtext,
                textAlign: "center",
                marginVertical: 15,
              }}
            >
              {isNewProduct ?
                "Barcode not in registry. Register it now?"
              : `Found: ${pendingData?.name}. Add batch?`}
            </ThemedText>
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: "#444" }]}
                onPress={handleModalCancel}
              >
                <ThemedText style={{ color: "#FFF" }}>Cancel</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: theme.primary }]}
                onPress={handleModalProceed}
              >
                <ThemedText style={{ color: "#FFF", }}>
                  Proceed
                </ThemedText>
              </Pressable>
            </View>
          </View>
          <ModalToast toast={modalToast} />
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
            <ThemedText style={[styles.modalTitle, { color: theme.text }]}>
              Admin Authorization
            </ThemedText>
            <ThemedText
              style={{
                color: theme.subtext,
                textAlign: "center",
                marginBottom: 20,
              }}
            >
              Enter the admin's <ThemedText style={{ color: theme.primary, fontWeight: "700" }}>Security PIN</ThemedText> to register a new product.{"\n"}
              <ThemedText style={{ fontSize: 11 }}>This is different from the login PIN.</ThemedText>
            </ThemedText>
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
                <ThemedText style={{ color: "#FFF" }}>Cancel</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: theme.primary }]}
                onPress={handlePinSubmit}
              >
                <ThemedText style={{ color: "#FFF", }}>
                  Confirm
                </ThemedText>
              </Pressable>
            </View>
          </View>
          <ModalToast toast={modalToast} />
        </View>
      </Modal>

      {/* SECURITY PIN WARNING MODAL */}
      <AdminSecurityPINWarning
        visible={securityPINWarningVisible}
        onClose={handleSecurityPINWarningClose}
        onNavigateToSettings={handleNavigateToSettings}
      />

      {/* CART MODAL */}
      <Modal visible={showCartModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.cartModalContent, { backgroundColor: theme.surface }]}>
            {/* Modal Header */}
            <View style={styles.cartModalHeader}>
              <View>
                <ThemedText style={[styles.cartModalTitle, { color: theme.text }]}>
                  Shopping Cart
                </ThemedText>
                <ThemedText style={[styles.cartModalSubtitle, { color: theme.subtext }]}>
                  {cart.length} {cart.length === 1 ? "item" : "items"} • {getTotalItems()} total units
                </ThemedText>
              </View>
              <Pressable
                onPress={() => setShowCartModal(false)}
                style={[styles.cartCloseBtn, { backgroundColor: theme.background }]}
              >
                <Ionicons name="close" size={24} color={theme.text} />
              </Pressable>
            </View>

            {/* Cart Items List */}
            {cart.length === 0 ? (
              <View style={styles.emptyCart}>
                <Ionicons name="cart-outline" size={80} color={theme.subtext + "40"} />
                <ThemedText style={[styles.emptyCartText, { color: theme.subtext }]}>
                  Cart is empty
                </ThemedText>
                <ThemedText style={[styles.emptyCartHint, { color: theme.subtext }]}>
                  Scan products to add them
                </ThemedText>
              </View>
            ) : (
              <FlatList
                data={cart}
                keyExtractor={(item: CartItem) => item._id}
                style={styles.cartList}
                contentContainerStyle={styles.cartListContent}
                renderItem={({ item }: { item: CartItem }) => (
                  <View
                    style={[
                      styles.cartItem,
                      { backgroundColor: theme.background, borderColor: theme.border },
                    ]}
                  >
                    {/* Product Image */}
                    <View style={[styles.cartItemImage, { backgroundColor: theme.surface }]}>
                      {item.imageUrl && item.imageUrl !== "cube" ? (
                        <Image
                          source={{ uri: item.imageUrl }}
                          style={styles.cartProductImage}
                        />
                      ) : (
                        <Ionicons name="cube-outline" size={32} color={theme.subtext} />
                      )}
                    </View>

                    {/* Product Info */}
                    <View style={styles.cartItemInfo}>
                      <ThemedText style={[styles.cartItemName, { color: theme.text }]} numberOfLines={1}>
                        {item.name}
                      </ThemedText>
                      <ThemedText style={[styles.cartItemMeta, { color: theme.subtext }]}>
                        Stock: {item.totalQuantity} units
                      </ThemedText>
                    </View>

                    {/* Quantity Controls */}
                    <View style={styles.cartQtyControls}>
                      <Pressable
                        style={[
                          styles.cartQtyBtn, 
                          { 
                            backgroundColor: theme.surface,
                            borderWidth: 1,
                            borderColor: theme.border,
                          }
                        ]}
                        onPress={() => updateCartQuantity(item._id, -1)}
                      >
                        <Ionicons name="remove" size={16} color={theme.text} />
                      </Pressable>
                      <ThemedText style={[styles.cartQtyText, { color: theme.text }]}>
                        {item.quantity}
                      </ThemedText>
                      <Pressable
                        style={[
                          styles.cartQtyBtn, 
                          { 
                            backgroundColor: theme.surface,
                            borderWidth: 1,
                            borderColor: theme.border,
                          }
                        ]}
                        onPress={() => updateCartQuantity(item._id, 1)}
                      >
                        <Ionicons name="add" size={16} color={theme.text} />
                      </Pressable>
                    </View>

                    {/* Remove Button */}
                    <Pressable
                      style={styles.cartRemoveBtn}
                      onPress={() => removeFromCart(item._id)}
                    >
                      <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                    </Pressable>
                  </View>
                )}
              />
            )}

            {/* Done Button */}
            {cart.length > 0 && (
              <Pressable
                style={[styles.cartDoneButton, { backgroundColor: theme.primary }]}
                onPress={handleCartDone}
              >
                <Ionicons name="checkmark-circle" size={24} color="#FFF" />
                <ThemedText style={styles.cartDoneButtonText}>
                  Proceed to Checkout ({getTotalItems()} items)
                </ThemedText>
              </Pressable>
            )}
          </View>
          <ModalToast toast={modalToast} />
        </View>
      </Modal>

      {/* REGISTER PERMISSION MODAL */}
      <Modal visible={showRegisterPermissionModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <View style={[styles.iconBox, { backgroundColor: '#FF3B30' + '15' }]}>
              <Ionicons name="lock-closed" size={32} color="#FF3B30" />
            </View>
            <ThemedText style={[styles.modalTitle, { color: theme.text }]}>
              Permission Denied
            </ThemedText>
            <ThemedText style={[styles.modalDesc, { color: theme.subtext }]}>
              You do not have permission to register products. Contact your administrator to enable this permission.
            </ThemedText>
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: theme.primary }]}
                onPress={() => setShowRegisterPermissionModal(false)}
              >
                <ThemedText style={{ color: '#FFF', }}>OK</ThemedText>
              </Pressable>
            </View>
          </View>
          <ModalToast toast={modalToast} />
        </View>
      </Modal>

      {/* ADD PERMISSION MODAL */}
      <Modal visible={showAddPermissionModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <View style={[styles.iconBox, { backgroundColor: '#FF3B30' + '15' }]}>
              <Ionicons name="lock-closed" size={32} color="#FF3B30" />
            </View>
            <ThemedText style={[styles.modalTitle, { color: theme.text }]}>
              Permission Denied
            </ThemedText>
            <ThemedText style={[styles.modalDesc, { color: theme.subtext }]}>
              You do not have permission to add inventory. Contact your administrator to enable this permission.
            </ThemedText>
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: theme.primary }]}
                onPress={() => setShowAddPermissionModal(false)}
              >
                <ThemedText style={{ color: '#FFF', }}>OK</ThemedText>
              </Pressable>
            </View>
          </View>
          <ModalToast toast={modalToast} />
        </View>
      </Modal>

    </View>
    </ErrorBoundary>
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
  headerTitleLarge: {
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
    },
  bottomBar: {
    paddingBottom: 60,
    alignItems: "center",
    width: "100%",
  },
  hintText: {
    color: "#FFF",
    marginBottom: 20,
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
  manualBtnText: { color: "#000", fontSize: 14 },
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
  modalTitle: { fontSize: 20, marginBottom: 5 },
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
    },
  restrictedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  restrictedIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  restrictedTitle: {
    fontSize: 20,
    marginBottom: 12,
    textAlign: 'center',
  },
  restrictedMessage: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  restrictedNote: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
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
    },

  // Cart Button Styles
  cartButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    position: "relative",
    marginBottom: 10,
  },
  cartBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: "#FF3B30",
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFF",
  },
  cartBadgeText: {
    color: "#FFF",
    fontSize: 11,
    },

  // Cart Modal Styles
  cartModalContent: {
    height: height * 0.75,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 20,
  },
  cartModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  cartModalTitle: {
    fontSize: 24,
    },
  cartModalSubtitle: {
    fontSize: 13,
    marginTop: 4,
  },
  cartCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },

  // Empty Cart
  emptyCart: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyCartText: {
    fontSize: 18,
    marginTop: 20,
  },
  emptyCartHint: {
    fontSize: 14,
    marginTop: 8,
  },

  // Cart List
  cartList: {
    flex: 1,
  },
  cartListContent: {
    paddingBottom: 20,
  },
  cartItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  cartItemImage: {
    width: 50,
    height: 50,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  cartProductImage: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
  },
  cartItemInfo: {
    flex: 1,
    marginRight: 12,
  },
  cartItemName: {
    fontSize: 15,
    marginBottom: 4,
  },
  cartItemMeta: {
    fontSize: 12,
    },
  cartQtyControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  cartQtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  cartQtyText: {
    fontSize: 16,
    minWidth: 30,
    textAlign: "center",
  },
  cartRemoveBtn: {
    padding: 8,
    marginLeft: 8,
  },

  // Done Button
  cartDoneButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 12,
  },
  cartDoneButtonText: {
    color: "#FFF",
    fontSize: 16,
    },

  // Missing styles for restricted access and modals
  modalDesc: {
    fontSize: 14,
    textAlign: 'center',
    marginVertical: 15,
    lineHeight: 20,
  },
  iconBox: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    },
});

