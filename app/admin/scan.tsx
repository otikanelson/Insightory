import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import axios from "axios";
import { useAudioPlayer } from "expo-audio";
import { useCameraPermissions } from "expo-camera";
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
    View
} from "react-native";
import Toast from "react-native-toast-message";
import AdminSecurityPINWarning from "../../components/AdminSecurityPINWarning";
import { BarcodeScanner } from "../../components/BarcodeScanner";
import { ErrorBoundary } from "../../components/ErrorBoundary";
import { HelpTooltip } from "../../components/HelpTooltip";
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from "../../context/ThemeContext";
import { hasSecurityPIN } from "../../utils/securityPINCheck";

const { height, width } = Dimensions.get("window");

interface CartItem {
  _id: string;
  name: string;
  barcode: string;
  imageUrl?: string;
  totalQuantity: number;
  quantity: number; // quantity in cart
}

export default function AdminScanScreen() {
  console.log('🎬 [ADMIN-SCAN] Component mounting...');
  const router = useRouter();
  const { theme } = useTheme();
  const modalToast = useModalToast();
  const params = useLocalSearchParams();
  const [permission, requestPermission] = useCameraPermissions();
  console.log('📷 [ADMIN-SCAN] Camera permission state:', permission?.granted);

  // Initialize mode from params or default to sales
  const initialMode = (params.initialTab as "lookup" | "sales" | "register") || "sales";
  const [mode, setMode] = useState<"lookup" | "sales" | "register">(initialMode);

  // Scanner State
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [torch, setTorch] = useState(false);
  const [cameraKey, setCameraKey] = useState(0);
  const [lastScanTime, setLastScanTime] = useState(0);

  // Cart State (for sales mode)
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCartModal, setShowCartModal] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const mountedRef = useRef(false);

  // Security PIN Warning State
  const [securityPINWarningVisible, setSecurityPINWarningVisible] = useState(false);

  // Cart Icon Animation
  const cartBounceAnim = useRef(new Animated.Value(1)).current;
  const cartShakeAnim = useRef(new Animated.Value(0)).current;

  // Audio
  const scanBeep = useAudioPlayer(require("../../assets/sounds/beep.mp3"));

  // Check security PIN on mount
  useEffect(() => {
    console.log('🔐 [ADMIN-SCAN] Checking security PIN on mount...');
    checkSecurityPIN().catch(err => {
      console.error('❌ [ADMIN-SCAN] Failed to check security PIN:', err);
    });
  }, []);

  const checkSecurityPIN = async () => {
    try {
      console.log('🔐 [ADMIN-SCAN] Starting security PIN check...');
      // Check if user is authenticated as admin
      const userRole = await AsyncStorage.getItem('auth_user_role');
      console.log('👤 [ADMIN-SCAN] User role:', userRole);
      
      // Only check Security PIN for staff users
      if (userRole === 'staff') {
        const pinSet = await hasSecurityPIN();
        console.log('🔐 [ADMIN-SCAN] PIN check result for staff:', pinSet);
        if (!pinSet) {
          console.log('⚠️ [ADMIN-SCAN] No PIN found, showing warning');
          setSecurityPINWarningVisible(true);
        }
      } else {
        console.log('✅ [ADMIN-SCAN] Admin user - no PIN warning needed');
      }
      // Admin users don't need Security PIN prompt when already authenticated
    } catch (err) {
      console.error('❌ [ADMIN-SCAN] Error checking security PIN:', err);
    }
  };

  const handleNavigateToSettings = () => {
    setSecurityPINWarningVisible(false);
    router.push('/admin/settings');
  };

  // Reset on focus and clear cart if returning from completed sale
  useFocusEffect(
    React.useCallback(() => {
      console.log('👁️ [ADMIN-SCAN] Screen focused - resetting state...');
      try {
        mountedRef.current = true;
        setIsMounted(true);
        setCameraError(false);
        setScanned(false);
        setLoading(false);
        setTorch(false);
        setLastScanTime(0); // Reset debounce timer
        
        // Only increment camera key if there was an error or if explicitly needed
        // Don't increment on every focus to prevent unnecessary re-mounting
        
        // Clear cart if clearCart param is set
        if (params.clearCart === 'true') {
          console.log('🛒 [ADMIN-SCAN] Clearing cart...');
          setCart([]);
        }
      } catch (err) {
        console.error('❌ [ADMIN-SCAN] Error during focus effect:', err);
      }

      return () => {
        console.log('🧹 [ADMIN-SCAN] Screen unfocused - cleanup...');
        mountedRef.current = false;
        setIsMounted(false);
        setTorch(false);
      };
    }, [params.clearCart])
  );

  // Reset when mode changes
  useEffect(() => {
    console.log('🔄 [ADMIN-SCAN] Mode changed to:', mode);
    setScanned(false);
    setLoading(false);
    setLastScanTime(0); // Reset debounce timer
  }, [mode]);

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
    console.log('📸 [ADMIN-SCAN] Barcode scanned:', data, 'Mode:', mode);
    
    // Debounce rapid scans (prevent scanning same code within 2 seconds)
    const now = Date.now();
    if (now - lastScanTime < 2000) {
      console.log('⏭️ [ADMIN-SCAN] Scan ignored - too rapid');
      return;
    }
    
    if (scanned || loading) {
      console.log('⏭️ [ADMIN-SCAN] Scan ignored - already processing');
      return;
    }
    
    setLastScanTime(now);
    setScanned(true);
    setLoading(true);

    try {
      let response;
      try {
        console.log('🌐 [ADMIN-SCAN] Fetching registry data...');
        response = await axios.get(
          `${process.env.EXPO_PUBLIC_API_URL}/products/registry/lookup/${data}`,
          { timeout: 3000 }
        );
        console.log('✅ [ADMIN-SCAN] Registry response:', response.data.found ? 'FOUND' : 'NOT FOUND');
      } catch (apiError: any) {
        // Network error - show offline message
        console.error('❌ [ADMIN-SCAN] Registry lookup failed:', apiError.message);
        console.log('📡 [ADMIN-SCAN] App is offline');
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

      if (mode === "lookup") {
        console.log('🔍 [ADMIN-SCAN] LOOKUP mode processing...');
        // LOOKUP MODE: Navigate to product detail
        if (response.data.found) {
          // Product exists in registry - now find it in local inventory
          try {
            const localProductResponse = await axios.get(
              `${process.env.EXPO_PUBLIC_API_URL}/products/barcode/${data}`
            );
            
            if (localProductResponse.data.success && localProductResponse.data.product) {
              // Product found in local inventory
              scanBeep.play();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              // Turn off torch before navigation
              setTorch(false);
              router.push(`/admin/product/${localProductResponse.data.product._id}`);
            } else {
              // Product in registry but not in local stock
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              Toast.show({
                type: "info",
                text1: "Not In Stock",
                text2: `${response.data.productData.name} exists in registry but has no inventory`,
                visibilityTime: 4000,
              });
              setScanned(false);
            }
          } catch (localError) {
            console.error("Local product lookup error:", localError);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            Toast.show({
              type: "info",
              text1: "Not In Stock",
              text2: "Product exists in registry but has no inventory",
            });
            setScanned(false);
          }
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Toast.show({
            type: "info",
            text1: "Not Found",
            text2: "Product does not exist in registry",
          });
          setScanned(false);
        }
      } else if (mode === "register") {
        // REGISTER MODE: Add to inventory or register new product
        if (response.data.found) {
          // Product exists in registry - navigate to add-products with data
          const productData = response.data.productData;
          scanBeep.play();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          
          // Turn off torch before navigation
          setTorch(false);
          router.push({
            pathname: "/admin/add-products",
            params: {
              barcode: data,
              name: productData.name || "",
              category: productData.category || "",
              imageUrl: productData.imageUrl || "",
              isPerishable: String(productData.isPerishable || false),
              mode: "inventory",
              locked: "true",
              fromAdmin: "true" // Flag to prevent back button bypass
            }
          });
        } else {
          // Product NOT in registry - navigate to register new product
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          // Turn off torch before navigation
          setTorch(false);
          router.push({
            pathname: "/admin/add-products",
            params: {
              barcode: data,
              mode: "registry",
              fromAdmin: "true" // Flag to prevent back button bypass
            }
          });
        }
      } else {
        // SALES MODE: Add to cart
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
                  
                  scanBeep.play();
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
                
                scanBeep.play();
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
      }
    } catch (err) {
      console.error("Scan Error:", err);
      Toast.show({ type: "error", text1: "Scan Failed", text2: "Please try again" });
      setScanned(false);
    } finally {
      setLoading(false);
    }
  };

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

  const handleDone = () => {
    if (cart.length === 0) {
      modalToast.show({ type: "info", title: "Empty Cart", message: "Please scan items to add to cart" });
      return;
    }

    // Navigate to sales page with cart data - ensure we go to checkout tab
    setShowCartModal(false);
    router.push({
      pathname: "/admin/sales",
      params: {
        cartData: JSON.stringify(cart),
        tab: "checkout", // Explicitly set the tab
      },
    });
  };

  const getTotalItems = () => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  };

  // Handle camera permissions
  if (!permission) {
    console.log('⏳ [ADMIN-SCAN] Permission object is null/undefined - waiting...');
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ThemedText style={[styles.permissionText, { color: theme.text }]}>
          Requesting camera permission...
        </ThemedText>
      </View>
    );
  }

  if (!permission.granted) {
    console.log('🚫 [ADMIN-SCAN] Camera permission not granted');

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

  const modeColor = mode === "sales" ? "#00D1FF" : mode === "lookup" ? theme.primary : "#00FF00";

  console.log('🎨 [ADMIN-SCAN] Rendering scanner - cameraKey:', cameraKey, 'mode:', mode, 'cart items:', cart.length, 'isMounted:', isMounted);

  // CRITICAL: Don't render camera until component is fully mounted and permission is granted
  if (!mountedRef.current || !isMounted || !permission?.granted) {
    console.log('⏸️ [ADMIN-SCAN] Waiting for mount/permission - mounted:', mountedRef.current, 'isMounted:', isMounted, 'granted:', permission?.granted);
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
    console.log('💥 [ADMIN-SCAN] Camera error state - showing recovery UI');
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
              console.log('🔄 [ADMIN-SCAN] Retrying camera initialization...');
              setCameraError(false);
              setCameraKey(prev => {
                const newKey = prev + 1;
                console.log('🔑 [ADMIN-SCAN] Camera key updated for retry:', prev, '->', newKey);
                return newKey;
              });
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
      <BarcodeScanner
        cameraKey={cameraKey}
        onScan={handleBarCodeScanned}
        onClose={() => router.back()}
        loading={loading}
        torch={torch}
        setTorch={setTorch}
        tabColor={modeColor}
        onCameraError={() => {
          console.error('❌ [ADMIN-SCAN] Camera error callback triggered');
          setCameraError(true);
          Toast.show({
            type: 'error',
            text1: 'Camera Error',
            text2: 'Failed to initialize camera. Please try again.',
            visibilityTime: 5000,
          });
        }}
      >
        {/* TOP BAR - Tabs and Close */}
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.iconCircle}>
            <Ionicons name="close" size={28} color="#FFF" />
          </Pressable>

          <View style={styles.tabContainer}>
            <Pressable
              onPress={() => {
                setMode("sales");
                setScanned(false);
              }}
              style={[
                styles.tab,
                mode === "sales" && { backgroundColor: "#00D1FF" },
              ]}
            >
              <ThemedText style={[styles.tabText, mode === "sales" && { color: "#000" }]}>
                SALES
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => {
                setMode("register");
                setScanned(false);
              }}
              style={[
                styles.tab,
                mode === "register" && { backgroundColor: "#00FF00" },
              ]}
            >
              <ThemedText style={[styles.tabText, mode === "register" && { color: "#000" }]}>
                REGISTER
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => {
                setMode("lookup");
                setScanned(false);
              }}
              style={[
                styles.tab,
                mode === "lookup" && { backgroundColor: theme.primary },
              ]}
            >
              <ThemedText style={[styles.tabText, mode === "lookup" && { color: "#000" }]}>
                LOOKUP
              </ThemedText>
            </Pressable>
          </View>

          <Pressable
            onPress={() => setTorch(!torch)}
            style={[
              styles.iconCircle,
              torch && { backgroundColor: "rgba(255,255,255,0.4)" },
            ]}
          >
            <Ionicons name={torch ? "flash" : "flash-off"} size={24} color="#FFF" />
          </Pressable>
        </View>

        {/* BOTTOM BAR - Instructions and Cart Button */}
        <View style={styles.bottomBar}>
          <ThemedText style={styles.hintText}>
            {mode === "lookup" 
              ? "Scan to view product details" 
              : mode === "register"
              ? "Scan to register or add inventory"
              : "Scan items to add to cart"}
          </ThemedText>

          <View style={styles.bottomActions}>
            {mode === "sales" && (
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
            
            {mode === "register" && (
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
                    pathname: "/admin/add-products",
                    params: {
                      barcode: generatedBarcode,
                      mode: "manual",
                      hasBarcode: "false",
                      fromAdmin: "true" // Flag to prevent back button bypass
                    }
                  });
                }}
              >
                <ThemedText style={styles.manualBtnText}>Manual Entry</ThemedText>
              </Pressable>
            )}
            
            <HelpTooltip
              title="Admin Scanner Modes"
              content={[
                "SALES MODE: Process sales transactions. Scan products to add them to the cart, then complete the sale.",
                "LOOKUP MODE: Quickly find products in your inventory. Scan to view product details and stock levels.",
                "REGISTER MODE: Add new products or restock existing ones. Scan to register new items or add batches."
              ]}
              icon="help-circle"
              iconSize={24}
              iconColor="#FFF"
            />
          </View>
        </View>
      </BarcodeScanner>

      {/* CART MODAL */}
      <Modal visible={showCartModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <ThemedText style={[styles.modalTitle, { color: theme.text }]}>
                  Shopping Cart
                </ThemedText>
                <ThemedText style={[styles.modalSubtitle, { color: theme.subtext }]}>
                  {cart.length} {cart.length === 1 ? "item" : "items"} • {getTotalItems()} total units
                </ThemedText>
              </View>
              <Pressable
                onPress={() => setShowCartModal(false)}
                style={[styles.closeBtn, { backgroundColor: theme.background }]}
              >
                <Ionicons name="close" size={24} color={theme.text} />
              </Pressable>
            </View>

            {/* Cart Items List */}
            {cart.length === 0 ? (
              <View style={styles.emptyCart}>
                <Ionicons name="cart-outline" size={80} color={theme.subtext + "40"} />
                <ThemedText style={[styles.emptyText, { color: theme.subtext }]}>
                  Cart is empty
                </ThemedText>
                <ThemedText style={[styles.emptyHint, { color: theme.subtext }]}>
                  Scan products to add them
                </ThemedText>
              </View>
            ) : (
              <FlatList
                data={cart}
                keyExtractor={(item) => item._id}
                style={styles.cartList}
                contentContainerStyle={styles.cartListContent}
                renderItem={({ item }) => (
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
                          style={styles.productImage}
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
                    <View style={styles.qtyControls}>
                      <Pressable
                        style={[
                          styles.qtyBtn, 
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
                      <ThemedText style={[styles.qtyText, { color: theme.text }]}>
                        {item.quantity}
                      </ThemedText>
                      <Pressable
                        style={[
                          styles.qtyBtn, 
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
                      style={styles.removeBtn}
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
                style={[styles.doneButton, { backgroundColor: theme.primary }]}
                onPress={handleDone}
              >
                <Ionicons name="checkmark-circle" size={24} color="#FFF" />
                <ThemedText style={styles.doneButtonText}>
                  Proceed to Checkout ({getTotalItems()} items)
                </ThemedText>
              </Pressable>
            )}
          </View>
          <ModalToast toast={modalToast} />
        </View>
      </Modal>

      {/* SECURITY PIN WARNING MODAL */}
      <AdminSecurityPINWarning
        visible={securityPINWarningVisible}
        onClose={() => setSecurityPINWarningVisible(false)}
        onNavigateToSettings={handleNavigateToSettings}
      />
    </View>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  // Top Bar
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "90%",
    alignItems: "center",
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

  // Bottom Bar
  bottomBar: {
    alignItems: "center",
    width: "100%",
    position: "relative",
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
    paddingHorizontal: 25,
    borderRadius: 30,
    marginBottom: 10,
  },
  manualBtnText: { 
    color: "#000", 
    fontSize: 14 
  },
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

  // Permissions
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

  // Cart Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "flex-end",
  },
  modalContent: {
    height: height * 0.75,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    },
  modalSubtitle: {
    fontSize: 13,
    marginTop: 4,
  },
  closeBtn: {
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
  emptyText: {
    fontSize: 18,
    marginTop: 20,
  },
  emptyHint: {
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
  productImage: {
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
  qtyControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  qtyText: {
    fontSize: 16,
    minWidth: 30,
    textAlign: "center",
  },
  removeBtn: {
    padding: 8,
    marginLeft: 8,
  },

  // Done Button
  doneButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 12,
  },
  doneButtonText: {
    color: "#FFF",
    fontSize: 16,
    },
});
