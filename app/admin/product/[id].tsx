import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Dimensions,
    Image,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View
} from "react-native";
import Toast from "react-native-toast-message";
import { useTheme } from "../../../context/ThemeContext";
import { useAIPredictions } from "../../../hooks/useAIPredictions";
import { useImageUpload } from "../../../hooks/useImageUpload";
import { useProducts } from "../../../hooks/useProducts";

const { width } = Dimensions.get("window");

interface Batch {
  batchNumber: string;
  quantity: number;
  expiryDate: string;
  receivedDate?: string;
  price?: number;
}

// Helper functions for toast notifications with graceful error handling
const showSuccessToast = (title: string, message: string) => {
  Toast.show({
    type: "success",
    text1: title,
    text2: message,
    visibilityTime: 4000,
  });
};

const showErrorToast = (error: any, title: string, customMessage?: string) => {
  const status = error?.response?.status;
  const data = error?.response?.data;
  let errorMessage = customMessage || data?.message || error?.message || "An unexpected error occurred";
  
  // Make server errors more user-friendly
  if (status === 500) {
    errorMessage = "Something went wrong on our end. Please try again in a moment.";
  } else if (status === 503) {
    errorMessage = "Service temporarily unavailable. Please try again shortly.";
  } else if (status === 504) {
    errorMessage = "Request timed out. Please check your connection and try again.";
  } else if (status === 400 && data?.details?.storeNames) {
    // Product has inventory in other stores
    errorMessage = `Cannot delete: Active inventory in ${data.details.storeNames}. Remove stock or contact these stores.`;
  } else if (!status) {
    errorMessage = "Cannot connect to server. Please check your internet connection.";
  }
  
  Toast.show({
    type: "error",
    text1: title,
    text2: errorMessage,
    visibilityTime: 6000,
  });
};

export default function AdminProductDetails() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { theme, isDark } = useTheme();

  // Check feature access for edit and delete
  const editAccess = useFeatureAccess('editProducts');
  const deleteAccess = useFeatureAccess('deleteProducts');
  
  const { getProductById, refresh } = useProducts();
  const { prediction, loading: predictionLoading } = useAIPredictions({ 
    productId: id as string,
    enableWebSocket: true,
    autoFetch: true
  });

  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGlobalProduct, setIsGlobalProduct] = useState(false); // Track if this is a global registry product

  // Edit state
  const [editedName, setEditedName] = useState("");
  const [editedCategory, setEditedCategory] = useState("");
  const [editedImage, setEditedImage] = useState("");
  const [editedGenericPrice, setEditedGenericPrice] = useState("");
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [adminCategories, setAdminCategories] = useState<string[]>([]);
  // Initialize Cloudinary upload hook
  const { 
    uploadImage, 
    isUploading: isUploadingImage 
  } = useImageUpload(process.env.EXPO_PUBLIC_API_URL!);

  // Price edit modal
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [tempPrice, setTempPrice] = useState("");

  // Delete modals
  const [showDeleteWarning, setShowDeleteWarning] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [deletePin, setDeletePin] = useState("");

  useEffect(() => {
    loadProduct();
  }, [id]);

  // Fetch categories - refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      const fetchCategories = async () => {
        try {
          const response = await axios.get(`${process.env.EXPO_PUBLIC_API_URL}/categories`);
          if (response.data.success) {
            setAdminCategories(response.data.data.map((cat: any) => cat.name).sort());
          }
        } catch (error) {
          console.error('Error fetching categories:', error);
        }
      };
      fetchCategories();
    }, [])
  );

  const loadProduct = async () => {
    if (!id) return;
    
    try {
      // First try to get from inventory
      const data = await getProductById(id as string);
      
      if (data) {
        setProduct(data);
        setIsGlobalProduct(false);
        setEditedName(data.name);
        setEditedCategory(data.category || "");
        setEditedImage(data.imageUrl || "");
        setEditedGenericPrice(data.genericPrice?.toString() || "");
        setLoading(false);
        return;
      }
    } catch (error) {
      // Inventory lookup failed, will try global registry below
    }
    
    // If not in inventory, try global registry
    try {
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/products/registry/${id}`
      );
      
      if (response.data.success) {
        const globalData = response.data.data;
        setProduct({
          ...globalData,
          totalQuantity: 0,
          batches: [],
        });
        setIsGlobalProduct(true);
        setEditedName(globalData.name);
        setEditedCategory(globalData.category || "");
        setEditedImage(globalData.imageUrl || "");
        setEditedGenericPrice(globalData.genericPrice?.toString() || "");
      }
    } catch (error) {
      console.error("Error loading product from both inventory and registry:", error);
    }
    
    setLoading(false);
  };

  const handleImagePick = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Toast.show({
        type: "error",
        text1: "Permission Denied",
        text2: "Gallery access required",
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.5,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (!result.canceled) {
      setEditedImage(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    if (!editedName.trim()) {
      Toast.show({
        type: "error",
        text1: "Validation Error",
        text2: "Product name is required",
      });
      return;
    }

    if (!editedCategory.trim()) {
      Toast.show({
        type: "error",
        text1: "Validation Error",
        text2: "Category is required",
      });
      return;
    }

    setIsSaving(true);
    
    try {
      let finalImageUrl = editedImage;

      // If image is a local file (user changed it), upload to Cloudinary
      if (editedImage && editedImage.startsWith("file://")) {
        Toast.show({
          type: "info",
          text1: "Uploading Image...",
          text2: "Please wait",
        });

        // Temporarily set the image for upload
        const tempImageState = editedImage;
        
        // Create a temporary FileSystem read to pass to the hook
        // Since the hook needs the image in its state, we'll do a direct upload here
        try {
          const FileSystem = require('expo-file-system');
          const base64 = await FileSystem.readAsStringAsync(editedImage, {
            encoding: FileSystem.EncodingType.Base64,
          });

          const uploadResponse = await axios.post(
            `${process.env.EXPO_PUBLIC_API_URL}/upload/image`,
            {
              image: `data:image/jpeg;base64,${base64}`,
              folder: 'inventiease',
            }
          );

          if (uploadResponse.data.success) {
            finalImageUrl = uploadResponse.data.imageUrl;
            Toast.show({
              type: "success",
              text1: "Image Uploaded",
              text2: "Saving product...",
            });
          } else {
            throw new Error("Upload failed");
          }
        } catch (uploadError: any) {
          console.error("Image upload error:", uploadError);
          Toast.show({
            type: "error",
            text1: "Upload Failed",
            text2: "Could not upload image. Product not saved.",
          });
          setIsSaving(false);
          return;
        }
      }

      // Save product with final image URL (either Cloudinary or existing URL)
      // Use different endpoint based on whether it's a global product
      const endpoint = isGlobalProduct
        ? `${process.env.EXPO_PUBLIC_API_URL}/products/registry/${id}`
        : `${process.env.EXPO_PUBLIC_API_URL}/products/${id}`;
      
      // Build update payload - only include category if it's not empty
      const updatePayload: any = {
        name: editedName.trim(),
        imageUrl: finalImageUrl,
      };
      
      // Only include category if it has a value
      if (editedCategory && editedCategory.trim()) {
        updatePayload.category = editedCategory.trim();
      }
      
      await axios.patch(endpoint, updatePayload);

      showSuccessToast(
        isGlobalProduct ? "Global Product Updated" : "Product Updated",
        "Changes saved successfully"
      );

      setIsEditing(false);
      if (!isGlobalProduct) {
        await refresh();
      }
      await loadProduct();
    } catch (error: any) {
      console.error("Save error:", error);
      showErrorToast(error, "Update Failed");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePriceUpdate = async () => {
    const priceValue = parseFloat(tempPrice);

    if (isNaN(priceValue) || priceValue < 0) {
      Toast.show({
        type: "error",
        text1: "Invalid Price",
        text2: "Please enter a valid number",
      });
      return;
    }

    try {
      // Use different endpoint based on whether it's a global product
      const endpoint = isGlobalProduct
        ? `${process.env.EXPO_PUBLIC_API_URL}/products/registry/${id}`
        : `${process.env.EXPO_PUBLIC_API_URL}/products/${id}/generic-price`;
      
      // Use PATCH for global products, PUT for inventory products
      if (isGlobalProduct) {
        await axios.patch(endpoint, { genericPrice: priceValue });
      } else {
        await axios.put(endpoint, { genericPrice: priceValue });
      }

      setEditedGenericPrice(priceValue.toString());
      setShowPriceModal(false);
      setTempPrice("");

      showSuccessToast("Price Updated", `Generic price set to ₦${priceValue.toFixed(2)}`);

      await loadProduct();
    } catch (error: any) {
      console.error('Price update error:', error);
      showErrorToast(error, "Update Failed");
    }
  };

  const handleDelete = async () => {
    try {
      const requirePin = await AsyncStorage.getItem('admin_require_security_pin_delete');
      const hasPin = await AsyncStorage.getItem('admin_security_pin');
      
      console.log('Delete check - requirePin:', requirePin, 'hasPin:', hasPin ? 'SET' : 'NOT SET');
      
      // Only require PIN if setting is enabled AND a PIN is actually set
      if (requirePin === 'true' && hasPin && hasPin.length > 0) {
        console.log('Security PIN required - showing PIN modal');
        setShowDeleteWarning(false);
        setShowPinModal(true);
      } else {
        console.log('Security PIN not required - proceeding with delete');
        // If no PIN is set or setting is disabled, proceed with delete
        setShowDeleteWarning(false);
        await performDelete();
      }
    } catch (error) {
      console.error('Delete check error:', error);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Could not check security settings",
      });
    }
  };

  const performDelete = async () => {
    try {
      // Use different endpoint based on whether it's a global product
      const endpoint = isGlobalProduct
        ? `${process.env.EXPO_PUBLIC_API_URL}/products/registry/${id}`
        : `${process.env.EXPO_PUBLIC_API_URL}/products/${id}`;
      
      console.log(`Attempting to delete ${isGlobalProduct ? 'global' : 'inventory'} product at:`, endpoint);
      
      const response = await axios.delete(endpoint);
      
      console.log('Delete response:', response.data);

      showSuccessToast(
        isGlobalProduct ? "Global Product Deleted" : "Product Deleted",
        isGlobalProduct 
          ? "Product removed from global registry" 
          : "Product removed from inventory"
      );

      if (!isGlobalProduct) {
        await refresh();
      }
      router.back();
    } catch (error: any) {
      console.error('Delete error:', error);
      console.error('Error response:', error.response);
      console.error('Error data:', error.response?.data);
      
      showErrorToast(error, "Delete Failed");
    }
  };

  const handlePinSubmit = async () => {
    try {
      const storedPin = await AsyncStorage.getItem('admin_security_pin');
      
      if (deletePin === storedPin) {
        setShowPinModal(false);
        setDeletePin("");
        await performDelete();
      } else {
        Toast.show({
          type: "error",
          text1: "Access Denied",
          text2: "Incorrect Admin Security PIN",
        });
        setDeletePin("");
      }
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Authentication Error",
      });
    }
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

    const prices: number[] = batchesWithPrice.map((b: Batch) => b.price!);
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

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!product) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Ionicons name="cube-outline" size={80} color={theme.subtext} />
        <Text style={[styles.errorText, { color: theme.text }]}>
          Product Not Found
        </Text>
        <Pressable
          onPress={() => router.back()}
          style={[styles.button, { backgroundColor: theme.primary }]}
        >
          <Text style={styles.buttonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flex: 1, backgroundColor: theme.background }}>
      

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header with Back Button */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.push("../inventory")}
            style={[styles.headerBtn, { backgroundColor: theme.surface }]}
          >
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </Pressable>

          <View style={styles.headerActions}>
            {!isEditing ? (
              <>
                <DisabledButton
                  onPress={() => setIsEditing(true)}
                  disabled={!editAccess.isAllowed}
                  disabledReason={editAccess.reason}
                  isViewOnly={editAccess.isViewOnly}
                  style={[styles.headerBtn, { backgroundColor: theme.primary }]}
                >
                  <Ionicons name="create-outline" size={20} color="#FFF" />
                </DisabledButton>
                <DisabledButton
                  onPress={() => setShowDeleteWarning(true)}
                  disabled={!deleteAccess.isAllowed}
                  disabledReason={deleteAccess.reason}
                  isViewOnly={deleteAccess.isViewOnly}
                  style={[styles.headerBtn, { backgroundColor: "#FF3B30" }]}
                >
                  <Ionicons name="trash-outline" size={20} color="#FFF" />
                </DisabledButton>
              </>
            ) : (
              <>
                <Pressable
                  onPress={() => {
                    setIsEditing(false);
                    setEditedName(product.name);
                    setEditedCategory(product.category || "");
                    setEditedImage(product.imageUrl || "");
                  }}
                  style={[styles.headerBtn, { backgroundColor: theme.surface }]}
                >
                  <Ionicons name="close" size={20} color={theme.text} />
                </Pressable>
                <Pressable
                  onPress={handleSave}
                  disabled={isSaving || isUploadingImage}
                  style={[styles.saveBtn, { backgroundColor: theme.primary }]}
                >
                  {isSaving || isUploadingImage ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={18} color="#FFF" />
                      <Text style={styles.saveBtnText}>Save</Text>
                    </>
                  )}
                </Pressable>
              </>
            )}
          </View>
        </View>

        {/* Product Header Section */}
        <View style={[styles.productHeader, { backgroundColor: theme.surface }]}>
          {/* Compact Image Container */}
          <Pressable
            disabled={!isEditing}
            onPress={handleImagePick}
            style={[styles.imageContainer, { backgroundColor: theme.background }]}
          >
            {editedImage && editedImage !== "cube" ? (
              <Image
                source={{ uri: editedImage }}
                style={styles.productImage}
                resizeMode="contain"
              />
            ) : (
              <Ionicons name="cube-outline" size={60} color={theme.subtext} />
            )}
            {isEditing && (
              <View style={styles.imageEditBadge}>
                <Ionicons name="camera" size={14} color="#FFF" />
              </View>
            )}
          </Pressable>

          {/* Product Info */}
          <View style={styles.productInfo}>
            {isEditing ? (
              <>
                <TextInput
                  style={[
                    styles.editInput,
                    { color: theme.text, borderColor: theme.border, backgroundColor: theme.background },
                  ]}
                  value={editedName}
                  onChangeText={setEditedName}
                  placeholder="Product Name"
                  placeholderTextColor={theme.subtext}
                />
                <Pressable
                  onPress={() => setShowCategoryPicker(true)}
                  style={[
                    styles.editInputSmall,
                    { borderColor: theme.border, backgroundColor: theme.background, justifyContent: 'center' },
                  ]}
                >
                  <Text style={{ color: editedCategory ? theme.text : theme.subtext }}>
                    {editedCategory || "Select Category"}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={theme.subtext} style={{ position: 'absolute', right: 12 }} />
                </Pressable>
              </>
            ) : (
              <>
                <Text style={[styles.productName, { color: theme.text }]}>
                  {product.name}
                </Text>
                <View style={styles.metaRow}>
                  <View style={[styles.categoryBadge, { backgroundColor: theme.primary + "15" }]}>
                    <Text style={[styles.categoryText, { color: theme.primary }]} numberOfLines={1}>
                      {product.category || "Uncategorized"}
                    </Text>
                  </View>
                  {product.isPerishable && (
                    <View style={[styles.perishableBadge, { backgroundColor: "#FF9500" + "15" }]}>
                      <Ionicons name="timer-outline" size={10} color="#FF9500" />
                      <Text style={[styles.perishableText, { color: "#FF9500" }]}>
                        Perishable
                      </Text>
                    </View>
                  )}
                </View>
                <View style={styles.barcodeRow}>
                  <Ionicons name="barcode-outline" size={14} color={theme.subtext} />
                  <Text style={[styles.barcodeText, { color: theme.subtext }]}>
                    {product.barcode}
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Quick Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: theme.surface }]}>
            <Text style={[styles.statValue, { color: theme.primary }]}>
              {product.totalQuantity}
            </Text>
            <Text style={[styles.statLabel, { color: theme.subtext }]}>
              Total Units
            </Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: theme.surface }]}>
            <Text style={[styles.statValue, { color: theme.primary }]}>
              {product.batches?.length || 0}
            </Text>
            <Text style={[styles.statLabel, { color: theme.subtext }]}>
              Batches
            </Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: theme.surface }]}>
            <DisabledButton
              onPress={() => {
                setTempPrice(editedGenericPrice);
                setShowPriceModal(true);
              }}
              disabled={!editAccess.isAllowed}
              disabledReason={editAccess.reason}
              isViewOnly={editAccess.isViewOnly}
              style={styles.statPressable}
            >
              <Text style={[styles.statValue, { color: theme.primary }]}>
                {priceAnalytics?.genericPrice ? `₦${priceAnalytics.genericPrice.toFixed(0)}` : "N/A"}
              </Text>
              <Text style={[styles.statLabel, { color: theme.subtext }]}>
                Generic Price
              </Text>
              <Ionicons name="create-outline" size={12} color={theme.primary} style={styles.editIcon} />
            </DisabledButton>
          </View>
        </View>

        {/* Global Product Indicator */}
        {isGlobalProduct && (
          <View
            style={[
              styles.statusBanner,
              {
                backgroundColor: theme.primary + "15",
                borderColor: theme.primary,
                marginBottom: 15,
              },
            ]}
          >
            <Ionicons name="globe-outline" size={16} color={theme.primary} />
            <Text
              style={[
                styles.statusText,
                {
                  color: theme.primary,
                  marginLeft: 8,
                },
              ]}
            >
              GLOBAL REGISTRY PRODUCT (No Inventory)
            </Text>
          </View>
        )}

        {/* Status Banner */}
        <View
          style={[
            styles.statusBanner,
            {
              backgroundColor:
                product.totalQuantity === 0 ? "#FF3B30" + "15"
                : product.totalQuantity < 10 ? "#FF9500" + "15"
                : "#34C759" + "15",
              borderColor:
                product.totalQuantity === 0 ? "#FF3B30"
                : product.totalQuantity < 10 ? "#FF9500"
                : "#34C759",
            },
          ]}
        >
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor:
                  product.totalQuantity === 0 ? "#FF3B30"
                  : product.totalQuantity < 10 ? "#FF9500"
                  : "#34C759",
              },
            ]}
          />
          <Text
            style={[
              styles.statusText,
              {
                color:
                  product.totalQuantity === 0 ? "#FF3B30"
                  : product.totalQuantity < 10 ? "#FF9500"
                  : "#34C759",
              },
            ]}
          >
            {product.totalQuantity === 0 ? "OUT OF STOCK"
              : product.totalQuantity < 10 ? "LOW STOCK"
              : "IN STOCK"}
          </Text>
        </View>

        {/* AI Insights Section - Admin Only */}
        {!isGlobalProduct && prediction && (
          <View style={[styles.section, { backgroundColor: theme.surface }]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="analytics" size={18} color={theme.primary} />
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                AI Insights & Analytics
              </Text>
            </View>

            {/* Risk Score Meter */}
            <View style={[styles.riskMeter, { backgroundColor: theme.background }]}>
              <View style={styles.riskMeterHeader}>
                <Text style={[styles.riskMeterLabel, { color: theme.subtext }]}>
                  Risk Score
                </Text>
                <Text style={[styles.riskMeterValue, { 
                  color: prediction.metrics.riskScore >= 70 ? '#FF3B30' 
                    : prediction.metrics.riskScore >= 40 ? '#FF9500' 
                    : '#34C759' 
                }]}>
                  {prediction.metrics.riskScore}/100
                </Text>
              </View>
              <View style={[styles.riskMeterBar, { backgroundColor: theme.border }]}>
                <View 
                  style={[
                    styles.riskMeterFill, 
                    { 
                      width: `${prediction.metrics.riskScore}%`,
                      backgroundColor: prediction.metrics.riskScore >= 70 ? '#FF3B30' 
                        : prediction.metrics.riskScore >= 40 ? '#FF9500' 
                        : '#34C759'
                    }
                  ]} 
                />
              </View>
              <Text style={[styles.riskMeterDesc, { color: theme.subtext }]}>
                {prediction.metrics.riskScore >= 70 ? 'Critical - Immediate action required' 
                  : prediction.metrics.riskScore >= 40 ? 'Moderate - Monitor closely' 
                  : 'Low - Product is performing well'}
              </Text>
            </View>

            {/* Key Metrics Grid */}
            <View style={styles.analyticsRow}>
              <View style={[styles.analyticsCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
                <Ionicons name="speedometer-outline" size={24} color={theme.primary} />
                <Text style={[styles.analyticsLabel, { color: theme.subtext }]}>
                  Velocity
                </Text>
                <Text style={[styles.analyticsValue, { color: theme.text }]}>
                  {prediction.metrics.velocity.toFixed(1)}
                </Text>
                <Text style={[styles.analyticsSubtext, { color: theme.subtext }]}>
                  units/day
                </Text>
              </View>

              <View style={[styles.analyticsCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
                <Ionicons name="calendar-outline" size={24} color={theme.primary} />
                <Text style={[styles.analyticsLabel, { color: theme.subtext }]}>
                  Days to Stockout
                </Text>
                <Text style={[styles.analyticsValue, { 
                  color: prediction.metrics.daysUntilStockout <= 7 ? '#FF3B30' 
                    : prediction.metrics.daysUntilStockout <= 14 ? '#FF9500' 
                    : theme.text 
                }]}>
                  {prediction.metrics.daysUntilStockout}
                </Text>
                <Text style={[styles.analyticsSubtext, { color: theme.subtext }]}>
                  days left
                </Text>
              </View>

              <View style={[styles.analyticsCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
                <Ionicons name="trending-up-outline" size={24} color={theme.primary} />
                <Text style={[styles.analyticsLabel, { color: theme.subtext }]}>
                  Confidence
                </Text>
                <Text style={[styles.analyticsValue, { color: theme.text }]}>
                  {prediction.forecast.confidence === 'high' ? '90+' : prediction.forecast.confidence === 'medium' ? '70-89' : '50-69'}%
                </Text>
                <Text style={[styles.analyticsSubtext, { color: theme.subtext }]}>
                  {prediction.forecast.confidence}
                </Text>
              </View>
            </View>

            {/* Demand Forecast */}
            {prediction.forecast && (
              <>
                <Text style={[styles.subsectionTitle, { color: theme.text }]}>
                  Demand Forecast
                </Text>
                <View style={styles.predictionsGrid}>
                  <View style={styles.predictionItem}>
                    <Text style={[styles.predictionValue, { color: theme.primary }]}>
                      {prediction.forecast.next7Days}
                    </Text>
                    <Text style={[styles.predictionLabel, { color: theme.subtext }]}>
                      Next 7 Days
                    </Text>
                  </View>
                  <View style={styles.predictionItem}>
                    <Text style={[styles.predictionValue, { color: theme.primary }]}>
                      {prediction.forecast.next14Days}
                    </Text>
                    <Text style={[styles.predictionLabel, { color: theme.subtext }]}>
                      Next 14 Days
                    </Text>
                  </View>
                  <View style={styles.predictionItem}>
                    <Text style={[styles.predictionValue, { color: theme.primary }]}>
                      {prediction.forecast.next30Days}
                    </Text>
                    <Text style={[styles.predictionLabel, { color: theme.subtext }]}>
                      Next 30 Days
                    </Text>
                  </View>
                </View>
              </>
            )}

            {/* AI Recommendations */}
            {prediction.recommendations && prediction.recommendations.length > 0 && (
              <>
                <Text style={[styles.subsectionTitle, { color: theme.text }]}>
                  AI Recommendations
                </Text>
                {prediction.recommendations.map((rec: any, index: number) => (
                  <View 
                    key={index}
                    style={[
                      styles.alertBanner, 
                      { 
                        backgroundColor: rec.priority === 'high' ? '#FF3B30' + '10' 
                          : rec.priority === 'medium' ? '#FF9500' + '10' 
                          : theme.primary + '10',
                        borderColor: rec.priority === 'high' ? '#FF3B30' 
                          : rec.priority === 'medium' ? '#FF9500' 
                          : theme.primary
                      }
                    ]}
                  >
                    <Ionicons 
                      name={rec.priority === 'high' ? 'alert-circle' : 'information-circle'} 
                      size={14} 
                      color={rec.priority === 'high' ? '#FF3B30' 
                        : rec.priority === 'medium' ? '#FF9500' 
                        : theme.primary} 
                    />
                    <Text style={[
                      styles.alertText, 
                      { 
                        color: rec.priority === 'high' ? '#FF3B30' 
                          : rec.priority === 'medium' ? '#FF9500' 
                          : theme.primary,
                        flex: 1
                      }
                    ]}>
                      {rec.message}
                    </Text>
                  </View>
                ))}
              </>
            )}

            {/* Low Confidence Warning */}
            {prediction.forecast.confidence === 'low' && (
              <View style={[styles.alertBanner, { backgroundColor: '#FFD60A' + '10', borderColor: '#FFD60A' }]}>
                <Ionicons name="warning" size={14} color="#FFD60A" />
                <Text style={[styles.alertText, { color: '#FFD60A', flex: 1 }]}>
                  Low confidence prediction. More sales data needed for accurate forecasting.
                </Text>
              </View>
            )}
          </View>
        )}

        {predictionLoading && !isGlobalProduct && (
          <View style={[styles.section, { backgroundColor: theme.surface }]}>
            <ActivityIndicator size="small" color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.subtext }]}>
              Loading AI insights...
            </Text>
          </View>
        )}

        {/* Batch Timeline */}
        {product.batches && product.batches.length > 0 && (
          <View style={[styles.section, { backgroundColor: theme.surface }]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="layers-outline" size={18} color={theme.primary} />
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Batch Timeline ({product.batches.length})
              </Text>
            </View>

            <View style={styles.timeline}>
              {product.batches.map((batch: Batch, index: number) => (
                <View key={index} style={styles.timelineItem}>
                  <View style={[styles.timelineDot, { backgroundColor: theme.primary }]} />
                  {index < product.batches.length - 1 && (
                    <View style={[styles.timelineLine, { backgroundColor: theme.border }]} />
                  )}
                  
                  <View style={[styles.batchCard, { backgroundColor: theme.background }]}>
                    <View style={styles.batchHeader}>
                      <Text style={[styles.batchTitle, { color: theme.text }]}>
                        #{batch.batchNumber?.slice(-6) || "N/A"}
                      </Text>
                      <View style={[styles.qtyBadge, { backgroundColor: theme.primary + "15" }]}>
                        <Text style={[styles.qtyText, { color: theme.primary }]}>
                          {batch.quantity} units
                        </Text>
                      </View>
                    </View>

                    <View style={styles.batchDetails}>
                      {batch.expiryDate && batch.expiryDate !== "N/A" && (
                        <View style={styles.detailRow}>
                          <Ionicons name="calendar-outline" size={12} color={theme.subtext} />
                          <Text style={[styles.detailText, { color: theme.subtext }]}>
                            Expires: {new Date(batch.expiryDate).toLocaleDateString()}
                          </Text>
                        </View>
                      )}
                      {(batch as any).manufacturerDate && (batch as any).manufacturerDate !== "N/A" && (
                        <View style={styles.detailRow}>
                          <Ionicons name="construct-outline" size={12} color={theme.subtext} />
                          <Text style={[styles.detailText, { color: theme.subtext }]}>
                            Mfg: {new Date((batch as any).manufacturerDate).toLocaleDateString()}
                          </Text>
                        </View>
                      )}
                      {batch.price && batch.price > 0 && (
                        <View style={styles.detailRow}>
                          <Ionicons name="pricetag-outline" size={12} color={theme.subtext} />
                          <Text style={[styles.detailText, { color: theme.primary }]}>
                            ₦{batch.price.toFixed(2)}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Price Analytics Section */}
        {priceAnalytics && priceAnalytics.hasBatchPrices && (
          <View style={[styles.section, { backgroundColor: theme.surface }]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="pricetag-outline" size={18} color={theme.primary} />
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Price Analytics
              </Text>
            </View>

            <View style={styles.priceRow}>
              <Text style={[styles.priceLabel, { color: theme.subtext }]}>
                Average Batch Price
              </Text>
              <Text style={[styles.priceValue, { color: theme.text }]}>
                ₦{priceAnalytics.avgBatchPrice!.toFixed(2)}
              </Text>
            </View>

            <View style={styles.priceRow}>
              <Text style={[styles.priceLabel, { color: theme.subtext }]}>
                Price Range
              </Text>
              <Text style={[styles.priceValue, { color: theme.text }]}>
                ₦{priceAnalytics.minBatchPrice!.toFixed(2)} - ₦{priceAnalytics.maxBatchPrice!.toFixed(2)}
              </Text>
            </View>

            {priceAnalytics.priceVariance! > 0 && (
              <View style={[styles.alertBanner, { backgroundColor: "#FFD60A" + "10", borderColor: "#FFD60A" }]}>
                <Ionicons name="trending-up" size={14} color="#FFD60A" />
                <Text style={[styles.alertText, { color: "#FFD60A" }]}>
                  Variance: ₦{priceAnalytics.priceVariance!.toFixed(2)}
                </Text>
              </View>
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Price Edit Modal */}
      <Modal visible={showPriceModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <View style={[styles.modalIconBox, { backgroundColor: theme.primary + "15" }]}>
              <Ionicons name="pricetag" size={32} color={theme.primary} />
            </View>

            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Set Generic Price
            </Text>
            <Text style={[styles.modalDesc, { color: theme.subtext }]}>
              This price applies to the product across all batches
            </Text>

            <View style={styles.priceInputContainer}>
              <Text style={[styles.currencySymbol, { color: theme.text }]}>₦</Text>
              <TextInput
                style={[styles.priceInput, { color: theme.text, borderColor: theme.border }]}
                value={tempPrice}
                onChangeText={setTempPrice}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={theme.subtext}
              />
            </View>

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border }]}
                onPress={() => {
                  setShowPriceModal(false);
                  setTempPrice("");
                }}
              >
                <Text style={{ color: theme.text, fontWeight: "600" }}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: theme.primary }]}
                onPress={handlePriceUpdate}
              >
                <Text style={{ color: "#FFF", fontWeight: "700" }}>Update Price</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Warning Modal */}
      <Modal visible={showDeleteWarning} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <Ionicons name="warning-outline" size={48} color="#FF3B30" />
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Delete Product?
            </Text>
            <Text style={[styles.modalDesc, { color: theme.subtext }]}>
              This will permanently remove the product and all its batches. This action cannot be undone.
            </Text>

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border }]}
                onPress={() => setShowDeleteWarning(false)}
              >
                <Text style={{ color: theme.text, fontWeight: "600" }}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: "#FF3B30" }]}
                onPress={handleDelete}
              >
                <Text style={{ color: "#FFF", fontWeight: "700" }}>Delete</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* PIN Modal */}
      <Modal visible={showPinModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <View style={[styles.modalIconBox, { backgroundColor: theme.primary + "15" }]}>
              <Ionicons name="shield-checkmark" size={32} color={theme.primary} />
            </View>

            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Confirm Deletion
            </Text>
            <Text style={[styles.modalDesc, { color: theme.subtext }]}>
              Enter Admin Security PIN to authorize deletion
            </Text>

            <TextInput
              style={[styles.pinInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
              secureTextEntry
              keyboardType="numeric"
              maxLength={4}
              value={deletePin}
              onChangeText={setDeletePin}
              placeholder="Enter Admin Security PIN"
              placeholderTextColor={theme.subtext}
            />

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border }]}
                onPress={() => {
                  setShowPinModal(false);
                  setDeletePin("");
                }}
              >
                <Text style={{ color: theme.text, fontWeight: "600" }}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: "#FF3B30" }]}
                onPress={handlePinSubmit}
              >
                <Text style={{ color: "#FFF", fontWeight: "700" }}>Delete Product</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Category Picker Modal */}
      <Modal visible={showCategoryPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface, maxHeight: '70%' }]}>
            <View style={[styles.modalIconBox, { backgroundColor: theme.primary + "15" }]}>
              <Ionicons name="pricetags" size={32} color={theme.primary} />
            </View>

            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Select Category
            </Text>
            <Text style={[styles.modalDesc, { color: theme.subtext }]}>
              Choose from admin-created categories
            </Text>

            <ScrollView style={{ width: '100%', maxHeight: 300 }}>
              {adminCategories.map((category) => (
                <Pressable
                  key={category}
                  onPress={() => {
                    setEditedCategory(category);
                    setShowCategoryPicker(false);
                  }}
                  style={[
                    styles.categoryOption,
                    {
                      backgroundColor: editedCategory === category ? theme.primary + '15' : theme.background,
                      borderColor: editedCategory === category ? theme.primary : theme.border,
                    },
                  ]}
                >
                  <Text style={[styles.categoryOptionText, { color: editedCategory === category ? theme.primary : theme.text }]}>
                    {category}
                  </Text>
                  {editedCategory === category && (
                    <Ionicons name="checkmark-circle" size={20} color={theme.primary} />
                  )}
                </Pressable>
              ))}
            </ScrollView>

            <Pressable
              style={[styles.modalBtn, { backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border, marginTop: 15 }]}
              onPress={() => setShowCategoryPicker(false)}
            >
              <Text style={{ color: theme.text, fontWeight: "600" }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    fontSize: 20,
    fontWeight: "700",
    marginVertical: 20,
  },
  button: {
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 12,
  },
  buttonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
  },

  scrollContent: {
    paddingTop: 20,
    paddingBottom: 40,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 20,
  },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerActions: {
    flexDirection: "row",
    gap: 10,
  },

  productHeader: {
    flexDirection: "row",
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  imageContainer: {
    width: 100,
    height: 100,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
    position: "relative",
  },
  productImage: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
  },
  imageEditBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.7)",
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },

  productInfo: {
    flex: 1,
    justifyContent: "center",
  },
  productName: {
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 6,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    flex: 1,
    minWidth: 0, // Important for text truncation
  },
  categoryText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  perishableBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  perishableText: {
    fontSize: 10,
    fontWeight: "700",
  },
  barcodeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  barcodeText: {
    fontSize: 11,
    fontWeight: "600",
  },

  editInput: {
    fontSize: 16,
    fontWeight: "700",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  editInputSmall: {
    fontSize: 13,
    fontWeight: "600",
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
  },

  statsGrid: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  statPressable: {
    alignItems: "center",
    position: "relative",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center",
  },
  editIcon: {
    position: "absolute",
    top: -4,
    right: -4,
  },

  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 20,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  section: {
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
  },

  subsectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    marginTop: 16,
    marginBottom: 12,
  },

  loadingText: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 8,
  },

  riskMeter: {
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  riskMeterHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  riskMeterLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  riskMeterValue: {
    fontSize: 24,
    fontWeight: "900",
  },
  riskMeterBar: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 8,
  },
  riskMeterFill: {
    height: "100%",
    borderRadius: 4,
  },
  riskMeterDesc: {
    fontSize: 10,
    fontWeight: "600",
  },

  analyticsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  analyticsCard: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
  },
  analyticsLabel: {
    fontSize: 10,
    fontWeight: "600",
    marginTop: 6,
    marginBottom: 4,
  },
  analyticsValue: {
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 2,
  },
  analyticsSubtext: {
    fontSize: 9,
    fontWeight: "600",
  },

  predictionsGrid: {
    flexDirection: "row",
    marginBottom: 12,
  },
  predictionItem: {
    flex: 1,
    alignItems: "center",
  },
  predictionValue: {
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 4,
  },
  predictionLabel: {
    fontSize: 9,
    fontWeight: "600",
    textAlign: "center",
  },

  alertBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
  },
  alertText: {
    fontSize: 11,
    fontWeight: "700",
  },

  turnoverRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  turnoverInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  turnoverLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
  turnoverValue: {
    fontSize: 16,
    fontWeight: "900",
  },

  timeline: {
    position: "relative",
  },
  timelineItem: {
    flexDirection: "row",
    paddingBottom: 16,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
    marginTop: 4,
  },
  timelineLine: {
    position: "absolute",
    left: 5.5,
    top: 16,
    width: 1,
    bottom: 0,
  },
  batchCard: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
  },
  batchHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  batchTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  qtyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  qtyText: {
    fontSize: 10,
    fontWeight: "800",
  },
  batchDetails: {
    gap: 4,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  detailText: {
    fontSize: 11,
    fontWeight: "600",
  },

  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  priceLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  priceValue: {
    fontSize: 14,
    fontWeight: "900",
  },

  // Modal Styles
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
    borderRadius: 30,
    alignItems: "center",
  },
  modalIconBox: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 10,
    textAlign: "center",
  },
  modalDesc: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 25,
    lineHeight: 20,
  },
  priceInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginBottom: 20,
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: "900",
    marginRight: 10,
  },
  priceInput: {
    flex: 1,
    height: 60,
    borderWidth: 1,
    borderRadius: 15,
    paddingHorizontal: 20,
    textAlign: "center",
    fontSize: 24,
    fontWeight: "700",
  },
  pinInput: {
    width: "100%",
    height: 55,
    borderWidth: 1,
    borderRadius: 15,
    paddingHorizontal: 20,
    marginBottom: 15,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "600",
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 10,
    width: "100%",
  },
  modalBtn: {
    flex: 1,
    height: 50,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  
  // Save Button Styles
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 22,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  saveBtnText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "700",
  },
  
  // Category Picker Styles
  categoryOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  categoryOptionText: {
    fontSize: 14,
    fontWeight: "600",
  },
});