import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import axios from "axios";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    BackHandler,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    View
} from "react-native";
import Toast from "react-native-toast-message";
import AdminSecurityPINWarning from "../../components/AdminSecurityPINWarning";
import { HelpTooltip } from "../../components/HelpTooltip";
import { useTheme } from "../../context/ThemeContext";
import { useProducts } from "../../hooks/useProducts";
import { hasSecurityPIN } from "../../utils/securityPINCheck";

export default function AddProducts() {
  const { theme, isDark } = useTheme();

  const router = useRouter();
  const navigation: any = useNavigation();
  const params = useLocalSearchParams();
  const { products } = useProducts();

  const API_URL = `${process.env.EXPO_PUBLIC_API_URL}/products`;

  const [image, setImage] = useState<string | null>(null);
  const [isPerishable, setIsPerishable] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formModified, setFormModified] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [pendingNavAction, setPendingNavAction] = useState<any>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState("");
  const [existingProduct, setExistingProduct] = useState<any>(null);
  const [showSecurityPINWarning, setShowSecurityPINWarning] = useState(false);
  
  // Enhanced UX states
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [validFields, setValidFields] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [showModeHelp, setShowModeHelp] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [totalSteps] = useState(3);
  const [showFieldHelp, setShowFieldHelp] = useState<string | null>(null);
  const [highlightErrors, setHighlightErrors] = useState<string[]>([]); // For red flash effect
  const [showRefreshConfirm, setShowRefreshConfirm] = useState(false);
  const [showProductSelector, setShowProductSelector] = useState(false);
  const [registeredProducts, setRegisteredProducts] = useState<any[]>([]);
  const [productSearchQuery, setProductSearchQuery] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    quantity: "",
    expiryDate: "",
    manufacturerDate: "",
    category: "",
    price: "",
    barcode: "",
  });

  const mode = (params.mode as "registry" | "inventory" | "manual") || "manual";
  
  // Determine if fields should be locked
  // Lock when: 1) explicitly locked via params, OR 2) existingProduct is set (adding batch to registered product)
  const isLocked = useMemo(() => {
    return params.locked === "true" || Boolean(existingProduct);
  }, [params.locked, existingProduct]);
  
  // Smart detection: Check if barcode came from scanning vs manual entry
  const isScannedProduct = Boolean(params.barcode && params.barcode !== formData.barcode);
  const showGenerateButton = !isLocked && !isScannedProduct;

  // Admin-created categories - fetched from API
  const [adminCategories, setAdminCategories] = useState<string[]>([]);

  // Check for Admin Security PIN on mount
  useEffect(() => {
    const checkSecurityPIN = async () => {
      console.log('🔐 Admin Add-Products - Starting security PIN check...');
      // Check if user is authenticated as admin
      const userRole = await AsyncStorage.getItem('auth_user_role');
      console.log('🔐 Admin Add-Products - User role:', userRole);
      
      // Check Security PIN for ALL users (admin and staff)
      const hasPIN = await hasSecurityPIN();
      console.log('🔐 Admin Add-Products - PIN check result:', hasPIN);
      if (!hasPIN) {
        console.log('⚠️ Admin Add-Products - No PIN found, showing warning');
        setShowSecurityPINWarning(true);
      } else {
        console.log('✅ Admin Add-Products - PIN found, NOT showing warning');
      }
    };
    checkSecurityPIN();
  }, []);

  // Function to fetch categories
  const fetchCategories = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('auth_session_token');
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/categories`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      if (data.success) {
        setAdminCategories(data.data.map((cat: any) => cat.name).sort());
      } else {
        console.error('Failed to fetch categories:', data.error);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  }, []);

  // Fetch admin-created categories on mount and when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchCategories();
    }, [fetchCategories])
  );

  useEffect(() => {
    const loadProductData = async () => {
      if (params.barcode) {
        const barcode = params.barcode as string;
        setFormData((prev) => ({
          ...prev,
          barcode: barcode,
          name: (params.name as string) || "",
          category: (params.category as string) || "",
        }));

        if (params.isPerishable) {
          setIsPerishable(params.isPerishable === "true");
        }

        if (params.imageUrl && params.imageUrl !== "cube") {
          setImage(params.imageUrl as string);
        }

        if (mode === "inventory" && isLocked && params.name) {
          setExistingProduct({
            barcode: barcode,
            name: params.name as string,
            category: params.category as string,
            imageUrl: (params.imageUrl as string) || "",
            isPerishable: params.isPerishable === "true",
            batches: [],
          });
        } else {
          try {
            const response = await axios.get(
              `${API_URL}/registry/lookup/${barcode}`,
            );
            if (response.data.found) {
              const productData = response.data.productData;
              setExistingProduct(productData);
              
              // Auto-fill price logic:
              // 1. Use generic price if available
              // 2. Otherwise, fetch last batch price from inventory
              let priceToUse = productData.genericPrice ? String(productData.genericPrice) : "";
              
              if (!priceToUse) {
                // Fetch inventory products with this barcode to get last batch price
                try {
                  const inventoryResponse = await axios.get(`${API_URL}/barcode/${barcode}`);
                  if (inventoryResponse.data.success && inventoryResponse.data.product) {
                    const lastBatchPrice = inventoryResponse.data.product.price;
                    if (lastBatchPrice) {
                      priceToUse = String(lastBatchPrice);
                    }
                  }
                } catch (invErr) {
                  console.log("Could not fetch last batch price");
                }
              }
              
              if (!params.name) {
                setFormData((prev) => ({
                  ...prev,
                  name: productData.name || "",
                  category: productData.category || "",
                  price: priceToUse || prev.price,
                }));
              } else {
                // If name is provided but price isn't, still auto-fill price
                if (priceToUse && !formData.price) {
                  setFormData((prev) => ({
                    ...prev,
                    price: priceToUse,
                  }));
                }
              }
              if (!params.imageUrl && productData.imageUrl && productData.imageUrl !== "cube") {
                setImage(productData.imageUrl);
              }
              if (!params.isPerishable) {
                setIsPerishable(productData.isPerishable || false);
              }
            }
          } catch (err) {
            console.log("Lookup failed, using params data");
          }
        }
      }
    };
    loadProductData();
  }, [params.barcode, params.name, params.category, params.imageUrl, params.isPerishable, mode, isLocked]);

  useFocusEffect(
    useCallback(() => {
      // Always reset form when focusing without scan params
      // This ensures clean state when navigating back from scanner or after submission
      if (!params.barcode && !params.mode) {
        console.log('📝 Admin Add-Products - Resetting form (no params)');
        resetForm();
      } else if (params.barcode) {
        console.log('📝 Admin Add-Products - Has barcode param, keeping form data');
      }
      return () => {};
    }, [params.barcode, params.mode]),
  );

  // ADMIN-SPECIFIC: Always intercept back button to prevent navigation to staff pages
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        // Always redirect to admin inventory on back press
        if (formModified) {
          setShowExitModal(true);
          return true;
        }
        router.replace("/admin/inventory");
        return true;
      };
      const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
      return () => subscription.remove();
    }, [formModified]),
  );

  useEffect(() => {
    try {
      navigation.setOptions && navigation.setOptions({ headerLeft: () => null });
    } catch (e) {}

    const beforeRemoveListener = (e: any) => {
      if (!formModified) return;
      e.preventDefault();
      setPendingNavAction(e.data?.action ?? null);
      setShowExitModal(true);
    };

    const unsub = navigation.addListener?.("beforeRemove", beforeRemoveListener);
    const parent = navigation.getParent && navigation.getParent();
    let parentUnsub: any = null;
    if (parent && parent.addListener) {
      parentUnsub = parent.addListener("tabPress", (e: any) => {
        try { if (navigation.isFocused && !navigation.isFocused()) return; } catch (err) {}
        if (!formModified) return;
        e.preventDefault();
        setPendingNavAction(() => () => {
          try { parent.navigate(e.target); } catch (err) {}
        });
        setShowExitModal(true);
      });
    }
    return () => {
      if (unsub) unsub();
      if (parentUnsub) parentUnsub();
    };
  }, [navigation, formModified]);

  // Enhanced field validation with real-time feedback
  const validateField = (field: string, value: string) => {
    let result = { isValid: true, error: "" };
    
    switch (field) {
      case "name":
        if (!value.trim()) {
          result = { isValid: false, error: "Product name is required" };
        } else if (value.trim().length < 2) {
          result = { isValid: false, error: "Name must be at least 2 characters" };
        } else if (value.length > 100) {
          result = { isValid: false, error: "Name cannot exceed 100 characters" };
        }
        break;
      case "barcode":
        if (!value.trim()) {
          result = { isValid: false, error: "Barcode is required" };
        } else if (value.length < 8 || value.length > 20) {
          result = { isValid: false, error: "Invalid barcode format (8-20 characters)" };
        }
        break;
      case "category":
        if (!value.trim()) {
          result = { isValid: false, error: "Category is required" };
        } else if (value.length > 50) {
          result = { isValid: false, error: "Category cannot exceed 50 characters" };
        }
        break;
      case "quantity":
        const qtyNum = parseFloat(value);
        if (isNaN(qtyNum)) {
          result = { isValid: false, error: "Quantity must be a number" };
        } else if (qtyNum < 0) {
          result = { isValid: false, error: "Quantity cannot be negative" };
        } else if (qtyNum > 1000000) {
          result = { isValid: false, error: "Quantity exceeds maximum limit" };
        }
        break;
      case "price":
        const priceNum = parseFloat(value);
        if (isNaN(priceNum)) {
          result = { isValid: false, error: "Price must be a number" };
        } else if (priceNum < 0) {
          result = { isValid: false, error: "Price cannot be negative" };
        } else if (priceNum > 10000000) {
          result = { isValid: false, error: "Price exceeds maximum limit" };
        }
        break;
      case "expiryDate":
        if (isPerishable && !value.trim()) {
          result = { isValid: false, error: "Expiry date is required for perishable items" };
        } else if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
          result = { isValid: false, error: "Date must be in YYYY-MM-DD format" };
        } else if (value) {
          // Parse date components
          const [year, month, day] = value.split('-').map(Number);
          
          // Validate month range
          if (month < 1 || month > 12) {
            result = { isValid: false, error: "Invalid month (must be 01-12)" };
            break;
          }
          
          // Validate day range based on month
          const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
          
          // Check for leap year
          const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
          if (isLeapYear) {
            daysInMonth[1] = 29; // February has 29 days in leap year
          }
          
          // Validate day
          if (day < 1 || day > daysInMonth[month - 1]) {
            result = { isValid: false, error: `Invalid day for ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][month-1]} (max ${daysInMonth[month - 1]})` };
            break;
          }
          
          const expiryDate = new Date(value);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (isNaN(expiryDate.getTime())) {
            result = { isValid: false, error: "Invalid date" };
          } else if (expiryDate < today) {
            result = { isValid: false, error: "Expiry date cannot be in the past" };
          }
        }
        break;
      case "manufacturerDate":
        if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
          result = { isValid: false, error: "Date must be in YYYY-MM-DD format" };
        } else if (value) {
          const mfgDate = new Date(value);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (isNaN(mfgDate.getTime())) {
            result = { isValid: false, error: "Invalid date" };
          } else if (mfgDate > today) {
            result = { isValid: false, error: "Manufacturer date cannot be in the future" };
          }
        }
        break;
    }
    
    setFieldErrors(prev => ({
      ...prev,
      [field]: result.isValid ? "" : result.error
    }));
    
    if (result.isValid && value.trim()) {
      setValidFields(prev => [...prev.filter(f => f !== field), field]);
    } else {
      setValidFields(prev => prev.filter(f => f !== field));
    }
    
    return result.isValid;
  };

  const handleFieldChange = (field: string, value: string) => {
    // For name field, allow spaces while typing, only collapse multiple spaces
    // For other fields, keep the sanitization
    let sanitizedValue = value;
    if (field === 'name') {
      // Only collapse multiple consecutive spaces, don't trim while typing
      sanitizedValue = value.replace(/\s{2,}/g, ' ');
    } else {
      // For other fields, trim and collapse spaces
      sanitizedValue = value.trim().replace(/\s+/g, ' ');
    }
    
    setFormData((prev) => ({ ...prev, [field]: sanitizedValue }));
    setFormModified(true);
    
    // Real-time validation with debounce
    setTimeout(() => validateField(field, sanitizedValue), 300);
  };

  const resetForm = (showToast: boolean = false) => {
    setFormData({
      name: "",
      quantity: "",
      expiryDate: "",
      manufacturerDate: "",
      category: "",
      price: "",
      barcode: "",
    });
    setImage(null);
    setIsPerishable(false);
    setFormModified(false);
    setExistingProduct(null);
    setFieldErrors({});
    setValidFields([]);
    setHighlightErrors([]);
    setCurrentStep(1);
    setUploadProgress(0);
    setIsUploading(false);
    
    if (showToast) {
      Toast.show({
        type: "success",
        text1: "Form Reset",
        text2: "All fields cleared successfully",
      });
    }
  };

  const handleRefreshPress = () => {
    if (formModified) {
      setShowRefreshConfirm(true);
    } else {
      resetForm(true); // Show toast when explicitly refreshing
    }
  };

  // Generate barcode function
  const generateBarcode = () => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    const newBarcode = `GEN-${timestamp}-${random}`;
    
    setFormData((prev) => ({ ...prev, barcode: newBarcode }));
    setFormModified(true);
    
    Toast.show({
      type: "success",
      text1: "Barcode Generated",
      text2: newBarcode,
    });
  };

  const validateForm = (): { isValid: boolean; error?: string; field?: string } => {
    const cleanBarcode = formData.barcode.trim();
    const cleanName = formData.name.trim();
    const cleanCategory = formData.category.trim();
    const newErrors: string[] = [];
    const highlightFields: string[] = [];

    // Basic required fields
    if (!cleanBarcode) {
      newErrors.push("barcode");
      highlightFields.push("barcode");
    }
    if (!cleanName) {
      newErrors.push("name");
      highlightFields.push("name");
    }
    if (!cleanCategory) {
      newErrors.push("category");
      highlightFields.push("category");
    }

    // CRITICAL: Category validation - must exist in admin-created categories
    // Users cannot create custom categories - admin must create them first
    if (adminCategories.length === 0) {
      newErrors.push("category");
      highlightFields.push("category");
      setHighlightErrors(highlightFields);
      setTimeout(() => setHighlightErrors([]), 2000);
      return { 
        isValid: false, 
        error: "No categories available. Please ask admin to create categories first.", 
        field: "Category" 
      };
    }
    
    if (cleanCategory) {
      const categoryExists = adminCategories.some(
        cat => cat.toLowerCase() === cleanCategory.toLowerCase()
      );
      
      if (!categoryExists) {
        newErrors.push("category");
        highlightFields.push("category");
        setHighlightErrors(highlightFields);
        setTimeout(() => setHighlightErrors([]), 2000);
        return { 
          isValid: false, 
          error: `Category "${cleanCategory}" does not exist. Please select from available categories.`, 
          field: "Category" 
        };
      }
    }

    // Image validation - Image is now optional
    // No validation needed for image field

    // Inventory/Manual mode validations
    if (mode === "inventory" || mode === "manual") {
      // Quantity validation - must be > 0
      const qtyNum = Number(formData.quantity);
      if (!formData.quantity || isNaN(qtyNum) || qtyNum <= 0) {
        newErrors.push("quantity");
        highlightFields.push("quantity");
        if (qtyNum === 0) {
          setHighlightErrors(highlightFields);
          setTimeout(() => setHighlightErrors([]), 2000);
          return { isValid: false, error: "Quantity must be greater than 0", field: "Quantity" };
        }
      }
      
      // Price validation
      const priceNum = Number(formData.price);
      if (!formData.price || isNaN(priceNum) || priceNum < 0) {
        newErrors.push("price");
        highlightFields.push("price");
      }

      // Expiry date validation for perishable items
      if (isPerishable) {
        if (!formData.expiryDate) {
          newErrors.push("expiryDate");
          highlightFields.push("expiryDate");
        } else {
          const expiryDate = new Date(formData.expiryDate);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          // Check if date is valid
          if (isNaN(expiryDate.getTime())) {
            newErrors.push("expiryDate");
            highlightFields.push("expiryDate");
            setHighlightErrors(highlightFields);
            setTimeout(() => setHighlightErrors([]), 2000);
            return { isValid: false, error: "Invalid expiry date", field: "Expiry Date" };
          }
          
          // Check if date is not in the past
          if (expiryDate < today) {
            newErrors.push("expiryDate");
            highlightFields.push("expiryDate");
            setHighlightErrors(highlightFields);
            setTimeout(() => setHighlightErrors([]), 2000);
            return { isValid: false, error: "Expiry date cannot be in the past", field: "Expiry Date" };
          }
          
          // Check if date is not too far in the future (max 10 years)
          const maxDate = new Date();
          maxDate.setFullYear(maxDate.getFullYear() + 10);
          if (expiryDate > maxDate) {
            newErrors.push("expiryDate");
            highlightFields.push("expiryDate");
            setHighlightErrors(highlightFields);
            setTimeout(() => setHighlightErrors([]), 2000);
            return { isValid: false, error: "Expiry date too far in future (max 10 years)", field: "Expiry Date" };
          }
        }
      }
    }

    // Flash red highlights for missing fields
    if (highlightFields.length > 0) {
      setHighlightErrors(highlightFields);
      setTimeout(() => setHighlightErrors([]), 2000);
    }

    if (newErrors.length > 0) {
      return { isValid: false, error: "Please fill all required fields correctly", field: "Validation" };
    }

    // Category lock validation for existing products (inventory mode)
    if (mode === "inventory" && existingProduct) {
      const registeredCategory = (existingProduct.category || "").trim().toLowerCase();
      if (registeredCategory && cleanCategory.toLowerCase() !== registeredCategory) {
        setHighlightErrors(["category"]);
        setTimeout(() => setHighlightErrors([]), 2000);
        return { 
          isValid: false, 
          error: `Category is locked! Must be "${existingProduct.category}"`, 
          field: "Category" 
        };
      }
    }

    return { isValid: true };
  };

  const pickImage = async (useCamera: boolean) => {
    setShowPicker(false);
    
    try {
      // Request permissions
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Toast.show({ 
            type: "error", 
            text1: "Camera Permission Required", 
            text2: "Please enable camera access in Settings"
          });
          return;
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Toast.show({ 
            type: "error", 
            text1: "Photo Library Permission Required", 
            text2: "Please enable photo library access in Settings"
          });
          return;
        }
      }
      
      // Image picker options
      const options: ImagePicker.ImagePickerOptions = { 
        mediaTypes: ['images'],
        quality: 0.7,
        allowsEditing: true,
        aspect: [1, 1] as [number, number],
      };
      
      const result = useCamera 
        ? await ImagePicker.launchCameraAsync(options) 
        : await ImagePicker.launchImageLibraryAsync(options);
        
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const imageUri = result.assets[0].uri;
        setImage(imageUri);
        setFormModified(true);
        
        Toast.show({
          type: "success",
          text1: "Image Selected",
          text2: "Image will be uploaded when you save the product"
        });
      }
    } catch (error: any) {
      console.error('Image picker error:', error);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: error.message || "Could not access camera/photos"
      });
    }
  };

  const handleSave = async () => {
    const validation = validateForm();
    if (!validation.isValid) {
      return Toast.show({
        type: "error",
        text1: validation.field + " Error",
        text2: validation.error,
      });
    }

    const cleanBarcode = formData.barcode.trim();
    const cleanName = formData.name.trim();
    const cleanCategory = formData.category.trim();
    setIsSubmitting(true);

    try {
      /** 1. Handle Image Upload First **/
      let finalImageUrl = image;

      // If 'image' exists and starts with 'file://', it's a local picker URI
      if (image && image.startsWith("file://")) {
        setIsUploading(true);
        setUploadProgress(0);
        
        Toast.show({ 
          type: "info", 
          text1: "Uploading Image...", 
          text2: "Please wait" 
        });

        try {
          // Simulate upload progress
          const progressInterval = setInterval(() => {
            setUploadProgress(prev => {
              if (prev >= 90) {
                clearInterval(progressInterval);
                return 90;
              }
              return prev + 10;
            });
          }, 200);

          console.log('Starting image upload process...');
          console.log('Image URI:', image);

          // Use base64 data from ImagePicker if available
          let base64Data;
          
          // Check if we have base64 from ImagePicker
          const storedBase64 = (window as any).__imageBase64;
          if (storedBase64) {
            console.log('Using base64 from ImagePicker');
            // Construct data URL from base64
            base64Data = `data:image/jpeg;base64,${storedBase64}`;
            // Clean up
            delete (window as any).__imageBase64;
          } else {
            // Fallback to fetch/FileReader for web or if base64 not available
            console.log('Fetching image file for base64 conversion');
            try {
              const response = await fetch(image);
              if (!response.ok) {
                throw new Error(`Failed to fetch image: ${response.status}`);
              }

              const blob = await response.blob();
              console.log('Original blob size:', blob.size, 'type:', blob.type);

              // Check if image is too large (> 5MB original)
              if (blob.size > 5 * 1024 * 1024) {
                throw new Error('Image is too large. Please choose a smaller image or take a new photo with lower quality.');
              }

              const reader = new FileReader();
              
              const base64Promise = new Promise<string>((resolve, reject) => {
                reader.onloadend = () => {
                  console.log('FileReader completed');
                  const result = reader.result;
                  if (typeof result === 'string') {
                    resolve(result);
                  } else {
                    reject(new Error('Failed to read file as data URL'));
                  }
                };
                reader.onerror = (error) => {
                  console.error('FileReader error:', error);
                  reject(error);
                };
                reader.readAsDataURL(blob);
              });

              base64Data = await base64Promise;
              console.log('Base64 data length:', base64Data.length);
            } catch (error) {
              console.error('Image processing error:', error);
              throw error;
            }
          }

          // Check final size (base64 is ~33% larger than binary)
          const estimatedSize = (base64Data.length * 3) / 4;
          console.log('Estimated final size:', estimatedSize, 'bytes');

          if (estimatedSize > 10 * 1024 * 1024) { // 10MB limit
            throw new Error('Image is too large after processing. Please choose a smaller image.');
          }

          // Upload to backend using the correct endpoint
          console.log('Sending upload request to:', `${process.env.EXPO_PUBLIC_API_URL}/upload/image`);
          
          const uploadResponse = await axios.post(
            `${process.env.EXPO_PUBLIC_API_URL}/upload/image`, 
            {
              image: base64Data,
              folder: 'inventiease',
            },
            {
              headers: {
                'Content-Type': 'application/json',
              },
              timeout: 60000, // 60 second timeout for large images
              maxContentLength: 50 * 1024 * 1024, // 50MB max
              maxBodyLength: 50 * 1024 * 1024, // 50MB max
            }
          );

          clearInterval(progressInterval);
          setUploadProgress(100);

          console.log('Upload response:', uploadResponse.data);

          if (uploadResponse.data.success) {
            finalImageUrl = uploadResponse.data.imageUrl;
            Toast.show({ 
              type: "success", 
              text1: "Image Uploaded Successfully", 
              text2: "Saving product..." 
            });
          } else {
            throw new Error(uploadResponse.data.message || "Upload failed");
          }
        } catch (uploadError: any) {
          console.error("Image upload error details:", {
            message: uploadError.message,
            response: uploadError.response?.data,
            status: uploadError.response?.status,
            config: uploadError.config
          });

          let errorMessage = "Could not upload image. Please try again.";
          
          if (uploadError.response?.status === 413 || uploadError.message.includes('too large')) {
            errorMessage = "Image is too large. Please choose a smaller image or take a new photo.";
          } else if (uploadError.response?.status === 500) {
            errorMessage = "Server error during upload. Please check your internet connection and try again.";
          } else if (uploadError.response?.status === 400) {
            errorMessage = "Invalid image format. Please try a different image.";
          } else if (uploadError.code === 'ECONNABORTED') {
            errorMessage = "Upload timeout. Please check your internet connection.";
          } else if (uploadError.response?.data?.message) {
            errorMessage = uploadError.response.data.message;
          } else if (uploadError.message.includes('too large')) {
            errorMessage = uploadError.message;
          }

          Toast.show({
            type: "error",
            text1: "Upload Failed",
            text2: errorMessage,
          });
          setIsSubmitting(false);
          return;
        } finally {
          setIsUploading(false);
          setUploadProgress(0);
        }
      }

      /** 2. Proceed with Registry/Inventory logic using finalImageUrl **/
      if (mode === "registry") {
        await axios.post(`${API_URL}/registry/add`, {
          barcode: cleanBarcode,
          name: cleanName,
          category: cleanCategory,
          isPerishable: isPerishable,
          imageUrl: finalImageUrl || "cube", // Use "cube" as default placeholder
        });
        
        Toast.show({ type: "success", text1: "Product Registered" });
        resetForm();
        // ADMIN-SPECIFIC: Always redirect to admin inventory
        setTimeout(() => router.replace("/admin/inventory" as any), 800);
      } else {
        // ... (Your registry lookup logic remains the same)
        let productInRegistry = false;
        try {
          const lookupResponse = await axios.get(`${API_URL}/registry/lookup/${cleanBarcode}`);
          productInRegistry = lookupResponse.data.found;
        } catch (err) { productInRegistry = false; }

        if (!productInRegistry) {
          try {
            await axios.post(`${API_URL}/registry/add`, {
              barcode: cleanBarcode,
              name: cleanName,
              category: cleanCategory,
              isPerishable: isPerishable,
              imageUrl: finalImageUrl || "cube", // Use "cube" as default placeholder
            });
          } catch (registryError: any) {
            if (!registryError.response?.data?.message?.includes("already in registry")) throw registryError;
          }
        }

        // Add Batch with permanent image URL
        const imageToSave = finalImageUrl || existingProduct?.imageUrl || "cube";
        
        await axios.post(API_URL, {
          barcode: cleanBarcode,
          name: cleanName,
          category: cleanCategory,
          quantity: Number(formData.quantity),
          expiryDate: formData.expiryDate || undefined,
          manufacturerDate: formData.manufacturerDate || undefined,
          price: Number(formData.price) || 0,
          imageUrl: imageToSave,
          hasBarcode: params.hasBarcode !== "false",
          isPerishable: isPerishable,
        });

        Toast.show({ type: "success", text1: "Batch Added" });
        resetForm();
        // ADMIN-SPECIFIC: Always redirect to admin inventory
        setTimeout(() => router.replace("/admin/inventory" as any), 800);
      }
    } catch (err: any) {
      console.error("Save Error:", err);
      
      let errorMessage = "Please try again";
      
      // Handle specific error types
      if (err.response?.data?.error) {
        const errorText = err.response.data.error;
        
        // Duplicate key error (E11000)
        if (errorText.includes('E11000') || errorText.includes('duplicate key')) {
          if (errorText.includes('barcode')) {
            errorMessage = "A product with this barcode already exists in your inventory";
          } else if (errorText.includes('internalCode')) {
            errorMessage = "Database error. Please contact support or try again later";
          } else {
            errorMessage = "This product already exists in your inventory";
          }
        } else {
          errorMessage = errorText;
        }
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      Toast.show({ 
        type: "error", 
        text1: "Save Failed", 
        text2: errorMessage 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleScannerPress = () => {
    if (formModified) { setShowExitModal(true); } else { router.push("/admin/scan"); }
  };

  const handleCategorySelect = (category: string) => {
    setFormData((prev) => ({ ...prev, category }));
    setFormModified(true);
    setShowCategoryPicker(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.headerRow}>
            <View style={{ flex: 1, }}>
              <Text style={[styles.subtitle, { color: theme.primary }]}>
                {mode === "registry" ? "GLOBAL_REGISTRY_ENTRY" : "ADD_STOCK_TO_INVENTORY"}
              </Text>
              <Text style={[styles.title, { color: theme.text }]}>
                {mode === "registry" ? "REGISTER_PRODUCT" : "ADD_BATCH"}
              </Text>
            </View>
            
            {/* Action Buttons */}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {/* Refresh Button */}
              {(params.barcode || params.mode) && (
                <Pressable 
                  style={[styles.refreshBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
                  onPress={handleRefreshPress}
                >
                  <Ionicons name="refresh" size={20} color={theme.primary} />
                </Pressable>
              )}
              
              {/* Reset to Default Button */}
              {(params.barcode || params.mode) && (
                <Pressable 
                  style={[styles.refreshBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
                  onPress={() => {
                    if (formModified) {
                      setPendingNavAction(() => () => {
                        resetForm();
                        router.replace('/admin/add-products');
                      });
                      setShowExitModal(true);
                    } else {
                      resetForm();
                      router.replace('/admin/add-products');
                    }
                  }}
                >
                  <Ionicons name="home-outline" size={20} color={theme.primary} />
                </Pressable>
              )}
            </View>
          </View>

          {/* Enhanced Mode Selection with Help */}
          {!params.barcode && !params.mode && (
            <View style={styles.modeSelection}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>SELECT MODE</Text>
                <Pressable onPress={() => setShowModeHelp(true)}>
                  <Ionicons name="help-circle-outline" size={20} color={theme.primary} />
                </Pressable>
              </View>
              
              <View style={styles.modeButtons}>
                <Pressable
                  style={[
                    styles.modeBtn,
                    {
                      backgroundColor: mode === "registry" ? theme.primary : theme.surface,
                      borderColor: mode === "registry" ? theme.primary : theme.border,
                    },
                  ]}
                  onPress={() => {
                    if (formModified) {
                      setPendingNavAction(() => () => {
                        setFormData(prev => ({ ...prev, mode: "registry" }));
                        router.replace({
                          pathname: "/admin/add-products",
                          params: { mode: "registry" }
                        });
                      });
                      setShowExitModal(true);
                    } else {
                      setFormData(prev => ({ ...prev, mode: "registry" }));
                      router.replace({
                        pathname: "/admin/add-products",
                        params: { mode: "registry" }
                      });
                    }
                  }}
                >
                  <Ionicons 
                    name="library-outline" 
                    size={24} 
                    color={mode === "registry" ? "#fff" : theme.text} 
                  />
                  <Text style={{
                    color: mode === "registry" ? "#fff" : theme.text,
                    fontWeight: "700",
                    fontSize: 16,
                    marginTop: 8,
                  }}>
                    Register Product
                  </Text>
                  <Text style={{
                    color: mode === "registry" ? "#fff" : theme.subtext,
                    fontSize: 12,
                    textAlign: "center",
                    marginTop: 4,
                  }}>
                    Add to global database only
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.modeBtn,
                    {
                      backgroundColor: mode === "manual" ? theme.primary : theme.surface,
                      borderColor: mode === "manual" ? theme.primary : theme.border,
                    },
                  ]}
                  onPress={() => {
                    if (formModified) {
                      setPendingNavAction(() => () => {
                        setFormData(prev => ({ ...prev, mode: "manual" }));
                        router.replace({
                          pathname: "/admin/add-products",
                          params: { mode: "manual" }
                        });
                      });
                      setShowExitModal(true);
                    } else {
                      setFormData(prev => ({ ...prev, mode: "manual" }));
                      router.replace({
                        pathname: "/admin/add-products",
                        params: { mode: "manual" }
                      });
                    }
                  }}
                >
                  <Ionicons 
                    name="add-circle-outline" 
                    size={24} 
                    color={mode === "manual" ? "#fff" : theme.text} 
                  />
                  <Text style={{
                    color: mode === "manual" ? "#fff" : theme.text,
                    fontWeight: "700",
                    fontSize: 16,
                    marginTop: 8,
                  }}>
                    Add to Inventory
                  </Text>
                  <Text style={{
                    color: mode === "manual" ? "#fff" : theme.subtext,
                    fontSize: 12,
                    textAlign: "center",
                    marginTop: 4,
                  }}>
                    Register & add stock
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Progress Indicator */}
          {(params.barcode || params.mode) && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill, 
                    { 
                      width: `${(currentStep / totalSteps) * 100}%`,
                      backgroundColor: theme.primary 
                    }
                  ]} 
                />
              </View>
              <Text style={[styles.progressText, { color: theme.subtext }]}>
                Step {currentStep} of {totalSteps}
              </Text>
            </View>
          )}

          {existingProduct && mode === "inventory" && (
            <View style={[styles.infoCard, { backgroundColor: theme.primary + "15", borderColor: theme.primary }]}>
              <Ionicons name="information-circle" size={20} color={theme.primary} />
              <Text style={[styles.infoText, { color: theme.text }]}>
                Adding batch to: <Text style={{ fontWeight: "800" }}>{existingProduct.name}</Text>
              </Text>
            </View>
          )}

          <Pressable style={[styles.scanShortcut, { borderColor: theme.border }]} onPress={handleScannerPress}>
            <Ionicons name="barcode-outline" size={24} color={theme.primary} />
            <Text style={{ color: theme.text, fontWeight: "700", marginLeft: 10 }}>Smart Scanner</Text>
          </Pressable>

          {/* Manual Batch Addition for Registered Products */}
          {mode === "manual" && !params.barcode && (
            <Pressable 
              style={[styles.manualBatchBtn, { backgroundColor: theme.surface, borderColor: theme.border }]} 
              onPress={async () => {
                // Fetch registered products from registry
                try {
                  const response = await axios.get(`${API_URL}/registry/all`);
                  if (response.data.success) {
                    setRegisteredProducts(response.data.data);
                    setShowProductSelector(true);
                  }
                } catch (error) {
                  console.error('Error loading registered products:', error);
                  Toast.show({
                    type: "error",
                    text1: "Error",
                    text2: "Could not load registered products"
                  });
                }
              }}
            >
              <Ionicons name="cube-outline" size={24} color={theme.primary} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ color: theme.text, fontWeight: "700", fontSize: 15 }}>
                  Registered Products
                </Text>
                <Text style={{ color: theme.subtext, fontSize: 12, marginTop: 2 }}>
                  Select from your product registry
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.subtext} />
            </Pressable>
          )}

          <Text style={styles.sectionTitle}>PRODUCT IDENTITY</Text>

          {/* Enhanced Barcode Input with Validation */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Text style={[styles.label, { color: theme.subtext }]}>BARCODE / ID</Text>
              <Pressable style={{marginTop: 10}} onPress={() => setShowFieldHelp(showFieldHelp === 'barcode' ? null : 'barcode')}>
                <Ionicons name="help-circle-outline" size={16} color={theme.primary} />
              </Pressable>
            </View>
            
            {showFieldHelp === 'barcode' && (
              <View style={[styles.helpBox, { backgroundColor: theme.primary + '15', borderColor: theme.primary }]}>
                <Text style={[styles.helpText, { color: theme.text }]}>
                  Scan a barcode or generate one automatically. Barcodes help track products uniquely.
                </Text>
              </View>
            )}
            
            <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
              <View style={{ flex: 1 }}>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.surface,
                      borderWidth: 2,
                      borderColor: highlightErrors.includes('barcode')
                        ? theme.notification 
                        : fieldErrors.barcode 
                          ? theme.notification 
                          : validFields.includes('barcode') 
                            ? '#4CAF50' 
                            : theme.border,
                      color: theme.text,
                    },
                    isLocked && styles.locked,
                    highlightErrors.includes('barcode') && styles.errorHighlight,
                  ]}
                  value={formData.barcode}
                  editable={!isLocked}
                  placeholder={isScannedProduct ? "Scanned barcode" : "Scan or enter barcode"}
                  placeholderTextColor={theme.subtext}
                  onChangeText={(t) => handleFieldChange("barcode", t)}
                />
                {fieldErrors.barcode && (
                  <Text style={[styles.errorText, { color: theme.notification }]}>
                    {fieldErrors.barcode}
                  </Text>
                )}
                {validFields.includes('barcode') && (
                  <View style={styles.successRow}>
                    <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                    <Text style={[styles.successText, { color: '#4CAF50' }]}>
                      {isScannedProduct ? "Scanned successfully" : "Valid barcode"}
                    </Text>
                  </View>
                )}
              </View>
              
              {/* Smart Generate Button - Only show for manual entry */}
              {showGenerateButton && (
                <Pressable
                  style={[styles.generateBtn, { backgroundColor: theme.primary }]}
                  onPress={generateBarcode}
                >
                  <Ionicons name="pencil" size={20} color="#fff" />
                </Pressable>
              )}
            </View>
          </View>

          {/* Enhanced Photo Section */}
          <View style={styles.photoRow}>
            <View style={styles.photoBoxContainer}>
              <Pressable
                style={[
                  styles.photoBox,
                  {
                    backgroundColor: theme.surface,
                    borderColor: highlightErrors.includes('image')
                      ? theme.notification
                      : fieldErrors.image 
                        ? theme.notification 
                        : theme.border,
                    borderWidth: 2,
                  },
                  highlightErrors.includes('image') && styles.errorHighlight,
                ]}
                onPress={() => setShowPicker(true)}
                disabled={isUploading || isLocked}
              >
                {image ? (
                  <>
                    <Image source={{ uri: image }} style={styles.fullImg} />
                    {isLocked && (
                      <View style={styles.lockedOverlay}>
                        <Ionicons name="lock-closed" size={24} color="#FFF" />
                      </View>
                    )}
                  </>
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Ionicons name="camera" size={30} color={theme.subtext} />
                    <Text style={[styles.photoPlaceholderText, { color: theme.subtext }]}>
                      {isLocked ? "Locked" : "Tap to add"}
                    </Text>
                  </View>
                )}
                
                {isUploading && (
                  <View style={styles.uploadOverlay}>
                    <ActivityIndicator size="large" color={theme.primary} />
                    <Text style={styles.uploadText}>{uploadProgress}%</Text>
                    <View style={styles.uploadProgressBar}>
                      <View 
                        style={[
                          styles.uploadProgressFill, 
                          { 
                            width: `${uploadProgress}%`,
                            backgroundColor: theme.primary 
                          }
                        ]} 
                      />
                    </View>
                  </View>
                )}
              </Pressable>
              
              {image && !isUploading && !isLocked && (
                <Pressable 
                  style={styles.removePhoto} 
                  onPress={() => { 
                    setImage(null); 
                    setFormModified(true);
                    setFieldErrors(prev => ({ ...prev, image: "" }));
                  }}
                >
                  <Ionicons name="close-circle" size={24} color="#FF4444" />
                </Pressable>
              )}
            </View>
            
            <View style={{ flex: 1 }}>
              <View style={styles.labelRow}>
                <Text style={[styles.label, { marginTop: 0, color: theme.subtext }]}>PRODUCT IMAGE</Text>
                <Pressable style={{marginBottom: 10}} onPress={() => setShowFieldHelp(showFieldHelp === 'image' ? null : 'image')}>
                  <Ionicons name="help-circle-outline" size={16} color={theme.primary} />
                </Pressable>
              </View>
              
              {showFieldHelp === 'image' && (
                <View style={[styles.helpBox, { backgroundColor: theme.primary + '15', borderColor: theme.primary }]}>
                  <Text style={[styles.helpText, { color: theme.text }]}>
                    Add a clear photo of your product. This helps with identification and inventory management. If no image is provided, a default cube icon will be used.
                  </Text>
                </View>
              )}
              
              <View style={styles.imageRequirement}>
                <Ionicons 
                  name={image ? "checkmark-circle" : "cube-outline"} 
                  size={16} 
                  color={image ? "#4CAF50" : theme.subtext} 
                />
                <Text style={{ 
                  color: image ? "#4CAF50" : theme.subtext, 
                  fontSize: 12, 
                  marginLeft: 6 
                }}>
                  {image 
                    ? "Image added successfully"
                    : "default cube image will be used"
                  }
                </Text>
              </View>
            </View>
          </View>

          {/* Enhanced Product Name Input */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Text style={[styles.label, { color: theme.subtext }]}>PRODUCT NAME</Text>
              <Text style={[styles.required, { color: theme.notification }]}>*</Text>
            </View>
            
            <TextInput
              style={[
                styles.input,
                isLocked && styles.locked,
                {
                  backgroundColor: theme.surface,
                  borderColor: highlightErrors.includes('name')
                    ? theme.notification
                    : fieldErrors.name 
                      ? theme.notification 
                      : validFields.includes('name') 
                        ? '#4CAF50' 
                        : theme.border,
                  borderWidth: 2,
                  color: theme.text,
                },
                highlightErrors.includes('name') && styles.errorHighlight,
              ]}
              value={formData.name}
              editable={!isLocked}
              placeholder="Enter product name"
              placeholderTextColor={theme.subtext}
              onChangeText={(t) => handleFieldChange("name", t)}
              maxLength={100}
            />
            
            <View style={styles.inputFooter}>
              {fieldErrors.name && (
                <Text style={[styles.errorText, { color: theme.notification }]}>
                  {fieldErrors.name}
                </Text>
              )}
              {validFields.includes('name') && (
                <View style={styles.successRow}>
                  <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                  <Text style={[styles.successText, { color: '#4CAF50' }]}>Good name</Text>
                </View>
              )}
              <Text style={[styles.charCount, { color: theme.subtext }]}>
                {formData.name.length}/100
              </Text>
            </View>
          </View>

          {/* Enhanced Category Input */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Text style={[styles.label, { color: theme.subtext }]}>CATEGORY</Text>
              <Text style={[styles.required, { color: theme.notification }]}>*</Text>
              <HelpTooltip
                title="Product Categories"
                content={[
                  "Categories are created and managed by admin in Admin Settings.",
                  "You can only select from categories that admin has created.",
                  "If you need a new category, ask your admin to create it.",
                  "Categories help organize inventory and can have custom alert thresholds."
                ]}
                icon="help-circle-outline"
                iconSize={14}
                iconColor={theme.subtext}
                style={{ marginLeft: 6 }}
              />
              {(isLocked || (mode === "inventory" && existingProduct && existingProduct.category)) && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 8 }}>
                  <Ionicons name="lock-closed" size={14} color={theme.subtext} />
                  <Text style={{ color: theme.subtext, fontSize: 11, marginLeft: 4 }}>Locked</Text>
                </View>
              )}
            </View>
            
            <Pressable
              onPress={() => {
                // Disable category picker when locked or in inventory mode with existing product
                const isCategoryLocked = isLocked || (mode === "inventory" && existingProduct && Boolean(existingProduct.category));
                if (isCategoryLocked) {
                  return;
                }
                // Refresh categories before opening picker
                fetchCategories();
                setShowCategoryPicker(true);
              }}
              disabled={isLocked || Boolean(mode === "inventory" && existingProduct && existingProduct.category)}
              style={[
                styles.input,
                isLocked && styles.locked,
                {
                  backgroundColor: (isLocked || (mode === "inventory" && existingProduct && existingProduct.category)) 
                    ? theme.border + '40' // Semi-transparent to show disabled state
                    : theme.surface,
                  borderColor: highlightErrors.includes('category')
                    ? theme.notification
                    : fieldErrors.category 
                      ? theme.notification 
                      : validFields.includes('category') 
                        ? '#4CAF50' 
                        : theme.border,
                  borderWidth: 2,
                  justifyContent: "center",
                  flexDirection: "row",
                  alignItems: "center",
                  opacity: (isLocked || (mode === "inventory" && existingProduct && existingProduct.category)) ? 0.6 : 1,
                },
                highlightErrors.includes('category') && styles.errorHighlight,
              ]}
            >
              {(isLocked || (mode === "inventory" && existingProduct && existingProduct.category)) && (
                <Ionicons name="lock-closed" size={18} color={theme.subtext} style={{ marginRight: 8 }} />
              )}
              <Text style={{ 
                color: formData.category ? theme.text : theme.subtext,
                flex: 1,
              }}>
                {formData.category || "Select category"}
              </Text>
              {!(isLocked || (mode === "inventory" && existingProduct && existingProduct.category)) && (
                <Ionicons name="chevron-down" size={20} color={theme.subtext} />
              )}
            </Pressable>
            
            {fieldErrors.category && (
              <Text style={[styles.errorText, { color: theme.notification }]}>
                {fieldErrors.category}
              </Text>
            )}
            {validFields.includes('category') && (
              <View style={styles.successRow}>
                <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                <Text style={[styles.successText, { color: '#4CAF50' }]}>Category selected</Text>
              </View>
            )}
          </View>

          {mode === "registry" && (
            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontWeight: "700", fontSize: 15 }}>Perishable Item?</Text>
                <Text style={{ color: theme.subtext, fontSize: 12, marginTop: 2 }}>Requires expiry date tracking</Text>
              </View>
              <Switch
                value={isPerishable}
                onValueChange={(val) => { setIsPerishable(val); setFormModified(true); }}
                disabled={isLocked}
                trackColor={{ true: theme.primary }}
              />
            </View>
          )}

          {/* Show perishable toggle for manual mode too */}
          {mode === "manual" && (
            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontWeight: "700", fontSize: 15 }}>Perishable Item?</Text>
                <Text style={{ color: theme.subtext, fontSize: 12, marginTop: 2 }}>Requires expiry date tracking</Text>
              </View>
              <Switch
                value={isPerishable}
                onValueChange={(val) => { 
                  setIsPerishable(val); 
                  setFormModified(true);
                  if (!val) setFormData((prev) => ({ ...prev, expiryDate: "" }));
                }}
                disabled={isLocked}
                trackColor={{ true: theme.primary }}
              />
            </View>
          )}

          {(mode === "inventory" || mode === "manual") && (
            <View style={styles.batchSection}>
              <Text style={styles.sectionTitle}>BATCH DETAILS</Text>
              
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <View style={styles.labelRow}>
                    <Text style={[styles.label, { color: theme.subtext }]}>PRICE (₦)</Text>
                    <Text style={[styles.required, { color: theme.notification }]}>*</Text>
                  </View>
                  <TextInput
                    style={[
                      styles.input, 
                      { 
                        backgroundColor: theme.surface, 
                        borderColor: highlightErrors.includes('price')
                          ? theme.notification
                          : fieldErrors.price 
                            ? theme.notification 
                            : validFields.includes('price') 
                              ? '#4CAF50' 
                              : theme.border, 
                        borderWidth: 2, 
                        color: theme.text 
                      },
                      highlightErrors.includes('price') && styles.errorHighlight,
                    ]}
                    keyboardType="numeric"
                    placeholder="0.00"
                    value={formData.price}
                    onChangeText={(t) => handleFieldChange("price", t)}
                  />
                  {fieldErrors.price && (
                    <Text style={[styles.errorText, { color: theme.notification }]}>
                      {fieldErrors.price}
                    </Text>
                  )}
                </View>
                
                <View style={{ flex: 1 }}>
                  <View style={styles.labelRow}>
                    <Text style={[styles.label, { color: theme.subtext }]}>QUANTITY</Text>
                    <Text style={[styles.required, { color: theme.notification }]}>*</Text>
                  </View>
                  <TextInput
                    style={[
                      styles.input, 
                      { 
                        backgroundColor: theme.surface, 
                        borderColor: highlightErrors.includes('quantity')
                          ? theme.notification
                          : fieldErrors.quantity 
                            ? theme.notification 
                            : validFields.includes('quantity') 
                              ? '#4CAF50' 
                              : theme.border, 
                        borderWidth: 2, 
                        color: theme.text 
                      },
                      highlightErrors.includes('quantity') && styles.errorHighlight,
                    ]}
                    keyboardType="numeric"
                    placeholder="0"
                    value={formData.quantity}
                    onChangeText={(t) => handleFieldChange("quantity", t)}
                  />
                  {fieldErrors.quantity && (
                    <Text style={[styles.errorText, { color: theme.notification }]}>
                      {fieldErrors.quantity}
                    </Text>
                  )}
                </View>
                
                {isPerishable && (
                  <View style={{ flex: 1 }}>
                    <View style={styles.labelRow}>
                      <Text style={[styles.label, { color: theme.subtext }]}>EXPIRY</Text>
                      <Text style={[styles.required, { color: theme.notification }]}>*</Text>
                    </View>
                    <TextInput
                      style={[
                        styles.input, 
                        { 
                          backgroundColor: theme.surface, 
                          borderColor: highlightErrors.includes('expiryDate')
                            ? theme.notification
                            : fieldErrors.expiryDate 
                              ? theme.notification 
                              : validFields.includes('expiryDate') 
                                ? '#4CAF50' 
                                : theme.border, 
                          borderWidth: 2, 
                          color: theme.text 
                        },
                        highlightErrors.includes('expiryDate') && styles.errorHighlight,
                      ]}
                      value={formData.expiryDate}
                      placeholder="YYYY-MM-DD"
                      onChangeText={(t) => handleFieldChange("expiryDate", t)}
                    />
                    {fieldErrors.expiryDate && (
                      <Text style={[styles.errorText, { color: theme.notification }]}>
                        {fieldErrors.expiryDate}
                      </Text>
                    )}
                  </View>
                )}
              </View>

              {/* Manufacturer Date Input */}
              <View style={styles.inputGroup}>
                <View style={styles.labelRow}>
                  <Text style={[styles.label, { color: theme.subtext }]}>MANUFACTURER DATE</Text>
                  <Pressable style={{marginTop: 10}} onPress={() => setShowFieldHelp(showFieldHelp === 'manufacturerDate' ? null : 'manufacturerDate')}>
                    <Ionicons name="help-circle-outline" size={16} color={theme.primary} />
                  </Pressable>
                </View>
                
                {showFieldHelp === 'manufacturerDate' && (
                  <View style={[styles.helpBox, { backgroundColor: theme.primary + '15', borderColor: theme.primary }]}>
                    <Text style={[styles.helpText, { color: theme.text }]}>
                      The date when the product was manufactured. This helps track product age and shelf life. Cannot be in the future.
                    </Text>
                  </View>
                )}
                
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.surface,
                      borderColor: highlightErrors.includes('manufacturerDate')
                        ? theme.notification
                        : fieldErrors.manufacturerDate 
                          ? theme.notification 
                          : validFields.includes('manufacturerDate') 
                            ? '#4CAF50' 
                            : theme.border,
                      borderWidth: 2,
                      color: theme.text,
                    },
                    highlightErrors.includes('manufacturerDate') && styles.errorHighlight,
                  ]}
                  value={formData.manufacturerDate}
                  placeholder="YYYY-MM-DD (Optional)"
                  placeholderTextColor={theme.subtext}
                  onChangeText={(t) => handleFieldChange("manufacturerDate", t)}
                />
                
                {fieldErrors.manufacturerDate && (
                  <Text style={[styles.errorText, { color: theme.notification }]}>
                    {fieldErrors.manufacturerDate}
                  </Text>
                )}
                {validFields.includes('manufacturerDate') && (
                  <View style={styles.successRow}>
                    <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                    <Text style={[styles.successText, { color: '#4CAF50' }]}>Valid date</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Enhanced Submit Button */}
          <View style={styles.submitSection}>
            <Pressable
              style={[
                styles.completeBtn, 
                { 
                  backgroundColor: theme.primary,
                  opacity: (isSubmitting || isUploading) ? 0.6 : 1,
                },
                (isSubmitting || isUploading) && styles.disabledBtn
              ]}
              onPress={handleSave}
              disabled={isSubmitting || isUploading}
            >
              {(isSubmitting || isUploading) ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.completeBtnText}>
                    {isUploading ? "Uploading..." : "Saving..."}
                  </Text>
                </View>
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={22} color="#fff" />
                  <Text style={styles.completeBtnText}>
                    {mode === "registry" ? "Register Product" : "Add to Inventory"}
                  </Text>
                </>
              )}
            </Pressable>
            
            {/* Form Summary */}
            <View style={styles.formSummary}>
              <Text style={[styles.summaryText, { color: theme.subtext }]}>
                {validFields.length} of {mode === "registry" ? "3" : "5"} required fields completed
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Refresh Confirmation Modal */}
      <Modal visible={showRefreshConfirm} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <Ionicons name="refresh-circle" size={48} color={theme.primary} />
            <Text style={[styles.modalTitle, { color: theme.text }]}>Reset Form?</Text>
            <Text style={{ color: theme.subtext, textAlign: "center", marginBottom: 20 }}>
              This will clear all your current inputs. Are you sure you want to continue?
            </Text>
            <View style={styles.modalActions}>
              <Pressable style={[styles.modalBtn, { backgroundColor: theme.background }]} onPress={() => setShowRefreshConfirm(false)}>
                <Text style={{ color: theme.text, fontWeight: "600" }}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: theme.primary }]}
                onPress={() => {
                  setShowRefreshConfirm(false);
                  resetForm(true); // Show toast when user confirms reset
                }}
              >
                <Text style={{ color: "#FFF", fontWeight: "700" }}>Reset</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Mode Help Modal */}
      <Modal visible={showModeHelp} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.helpModal, { backgroundColor: theme.surface }]}>
            <View style={styles.helpModalHeader}>
              <Text style={[styles.helpModalTitle, { color: theme.text }]}>Mode Selection Help</Text>
              <Pressable onPress={() => setShowModeHelp(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </Pressable>
            </View>
            
            <ScrollView style={styles.helpModalContent}>
              <View style={styles.helpModeItem}>
                <Ionicons name="library-outline" size={24} color={theme.primary} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.helpModeTitle, { color: theme.text }]}>Register Product</Text>
                  <Text style={[styles.helpModeDesc, { color: theme.subtext }]}>
                    Adds the product to your global database for future use. No inventory is added.
                    Perfect for building your product catalog.
                  </Text>
                </View>
              </View>
              
              <View style={styles.helpModeItem}>
                <Ionicons name="add-circle-outline" size={24} color={theme.primary} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.helpModeTitle, { color: theme.text }]}>Add to Inventory</Text>
                  <Text style={[styles.helpModeDesc, { color: theme.subtext }]}>
                    Registers the product AND adds stock quantities. Use this when you want to 
                    track actual inventory levels.
                  </Text>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODALS REMAIN UNCHANGED BELOW */}
      <Modal visible={showPicker} transparent animationType="slide">
        <View style={styles.pickerOverlay}>
          <View style={[styles.pickerContent, { backgroundColor: theme.surface }]}>
            <Text style={[styles.pickerTitle, { color: theme.text }]}>Add Product Image</Text>
            <Pressable style={styles.pickerOpt} onPress={() => pickImage(true)}>
              <Ionicons name="camera" size={24} color={theme.primary} />
              <Text style={{ color: theme.text, marginLeft: 15, fontSize: 16 }}>Take Photo</Text>
            </Pressable>
            <Pressable style={styles.pickerOpt} onPress={() => pickImage(false)}>
              <Ionicons name="images" size={24} color={theme.primary} />
              <Text style={{ color: theme.text, marginLeft: 15, fontSize: 16 }}>Choose from Gallery</Text>
            </Pressable>
            <Pressable style={[styles.pickerOpt, { borderBottomWidth: 0 }]} onPress={() => setShowPicker(false)}>
              <Text style={{ color: "#FF4444", fontWeight: "700", fontSize: 16 }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={showCategoryPicker} transparent animationType="slide">
        <View style={styles.pickerOverlay}>
          <View style={[styles.categoryModal, { backgroundColor: theme.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.pickerTitle, { color: theme.text }]}>Select Category</Text>
              <Pressable onPress={() => {
                setShowCategoryPicker(false);
                setCategorySearchQuery("");
              }}>
                <Ionicons name="close" size={24} color={theme.text} />
              </Pressable>
            </View>
            
            {adminCategories.length === 0 ? (
              <View style={{ padding: 30, alignItems: 'center' }}>
                <Ionicons name="alert-circle-outline" size={64} color={theme.notification} />
                <Text style={{ color: theme.text, marginTop: 16, fontSize: 18, fontWeight: '700', textAlign: 'center' }}>
                  No Categories Available
                </Text>
                <Text style={{ color: theme.subtext, fontSize: 14, marginTop: 8, textAlign: 'center', lineHeight: 20 }}>
                  Please create product categories in Admin Settings before adding products.
                </Text>
                <Pressable
                  style={[styles.modalBtn, { backgroundColor: theme.primary, marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }]}
                  onPress={() => setShowCategoryPicker(false)}
                >
                  <Text style={{ color: "#FFF", fontWeight: "700" }}>Close</Text>
                </Pressable>
              </View>
            ) : (
              <>
                {/* Search Bar */}
                {adminCategories.length > 5 && (
                  <View style={{ paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.background, borderRadius: 12, paddingHorizontal: 12, height: 44 }}>
                      <Ionicons name="search" size={20} color={theme.subtext} />
                      <TextInput
                        style={{ flex: 1, marginLeft: 8, color: theme.text, fontSize: 15 }}
                        placeholder="Search categories..."
                        placeholderTextColor={theme.subtext}
                        value={categorySearchQuery}
                        onChangeText={setCategorySearchQuery}
                        autoCapitalize="none"
                      />
                      {categorySearchQuery.length > 0 && (
                        <Pressable onPress={() => setCategorySearchQuery("")}>
                          <Ionicons name="close-circle" size={20} color={theme.subtext} />
                        </Pressable>
                      )}
                    </View>
                  </View>
                )}
                
                <FlatList
                  data={adminCategories.filter(cat => 
                    cat.toLowerCase().includes(categorySearchQuery.toLowerCase())
                  )}
                  keyExtractor={(item) => item}
                  style={{ maxHeight: 400 }}
                  initialNumToRender={10}
                  maxToRenderPerBatch={10}
                  windowSize={5}
                  removeClippedSubviews={true}
                  getItemLayout={(data, index) => ({
                    length: 56,
                    offset: 56 * index,
                    index,
                  })}
                  ListEmptyComponent={
                    <View style={{ padding: 30, alignItems: 'center' }}>
                      <Ionicons name="search-outline" size={48} color={theme.subtext} />
                      <Text style={{ color: theme.text, marginTop: 12, fontSize: 16, fontWeight: '600' }}>
                        No categories found
                      </Text>
                      <Text style={{ color: theme.subtext, fontSize: 14, marginTop: 4 }}>
                        Try a different search term
                      </Text>
                    </View>
                  }
                  renderItem={({ item }) => (
                    <Pressable 
                      style={[
                        styles.categoryItem,
                        formData.category === item && { backgroundColor: theme.primary + '15' }
                      ]} 
                      onPress={() => {
                        handleCategorySelect(item);
                        setCategorySearchQuery("");
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <Ionicons 
                          name={formData.category === item ? "checkmark-circle" : "pricetag-outline"} 
                          size={20} 
                          color={formData.category === item ? theme.primary : theme.subtext} 
                        />
                        <Text style={{ 
                          color: formData.category === item ? theme.primary : theme.text, 
                          fontSize: 16,
                          marginLeft: 12,
                          fontWeight: formData.category === item ? '600' : '400'
                        }}>
                          {item}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color={theme.subtext} />
                    </Pressable>
                  )}
                />
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={showExitModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <Ionicons name="warning-outline" size={48} color={theme.notification} />
            <Text style={[styles.modalTitle, { color: theme.text }]}>Discard Changes?</Text>
            <View style={styles.modalActions}>
              <Pressable style={[styles.modalBtn, { backgroundColor: theme.background }]} onPress={() => setShowExitModal(false)}>
                <Text style={{ color: theme.text, fontWeight: "600" }}>Stay</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: theme.notification }]}
                onPress={() => {
                  setShowExitModal(false);
                  resetForm();
                  // ADMIN-SPECIFIC: Always redirect to admin inventory
                  router.replace("/admin/inventory");
                }}
              >
                <Text style={{ color: "#FFF", fontWeight: "700" }}>Discard</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Admin Security PIN Warning Modal */}
      <AdminSecurityPINWarning
        visible={showSecurityPINWarning}
        onClose={() => setShowSecurityPINWarning(false)}
        onNavigateToSettings={() => {
          setShowSecurityPINWarning(false);
          router.push('/admin/settings');
        }}
      />

      {/* Product Selector Modal for Manual Batch Addition */}
      <Modal visible={showProductSelector} transparent animationType="slide">
        <View style={styles.pickerOverlay}>
          <View style={[styles.categoryModal, { backgroundColor: theme.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.pickerTitle, { color: theme.text }]}>Select Product</Text>
              <Pressable onPress={() => {
                setShowProductSelector(false);
                setProductSearchQuery("");
              }}>
                <Ionicons name="close" size={24} color={theme.text} />
              </Pressable>
            </View>
            
            {/* Search Bar */}
            <View style={[styles.searchContainer, { backgroundColor: theme.background, borderColor: theme.border, margin: 16 }]}>
              <Ionicons name="search" size={18} color={theme.subtext} />
              <TextInput
                style={[styles.searchInput, { color: theme.text }]}
                placeholder="Search products..."
                placeholderTextColor={theme.subtext}
                value={productSearchQuery}
                onChangeText={setProductSearchQuery}
              />
            </View>
            
            {registeredProducts.length === 0 ? (
              <View style={{ padding: 30, alignItems: 'center' }}>
                <Ionicons name="cube-outline" size={64} color={theme.subtext} />
                <Text style={{ color: theme.text, marginTop: 16, fontSize: 18, fontWeight: '700', textAlign: 'center' }}>
                  No Registered Products
                </Text>
                <Text style={{ color: theme.subtext, fontSize: 14, marginTop: 8, textAlign: 'center', lineHeight: 20 }}>
                  Register products first before adding batches.
                </Text>
                <Pressable
                  style={[styles.modalBtn, { backgroundColor: theme.primary, marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }]}
                  onPress={() => setShowProductSelector(false)}
                >
                  <Text style={{ color: "#FFF", fontWeight: "700" }}>Close</Text>
                </Pressable>
              </View>
            ) : (
              <FlatList
                data={registeredProducts.filter(p => 
                  p.name.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
                  (p.barcode && p.barcode.includes(productSearchQuery)) ||
                  (p.category && p.category.toLowerCase().includes(productSearchQuery.toLowerCase()))
                )}
                keyExtractor={(item) => item._id || item.barcode}
                style={{ maxHeight: 500 }}
                renderItem={({ item }) => (
                  <Pressable 
                    style={[styles.productSelectorItem, { borderBottomColor: theme.border }]} 
                    onPress={() => {
                      // Pre-fill form with selected product data
                      setFormData({
                        barcode: item.barcode,
                        name: item.name,
                        category: item.category || "",
                        price: item.genericPrice ? String(item.genericPrice) : "",
                        quantity: "",
                        expiryDate: "",
                        manufacturerDate: "",
                      });
                      setIsPerishable(item.isPerishable || false);
                      if (item.imageUrl && item.imageUrl !== "cube") {
                        setImage(item.imageUrl);
                      }
                      setExistingProduct(item);
                      setFormModified(true);
                      setShowProductSelector(false);
                      setProductSearchQuery("");
                      
                      Toast.show({
                        type: "success",
                        text1: "Product Selected",
                        text2: `Adding batch for ${item.name}`
                      });
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      {item.imageUrl && item.imageUrl !== "cube" ? (
                        <Image 
                          source={{ uri: item.imageUrl }} 
                          style={{ width: 50, height: 50, borderRadius: 10, marginRight: 12 }}
                          resizeMode="contain"
                        />
                      ) : (
                        <View style={{ width: 50, height: 50, borderRadius: 10, backgroundColor: theme.border, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                          <Ionicons name="cube-outline" size={24} color={theme.subtext} />
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={{ 
                          color: theme.text, 
                          fontSize: 16,
                          fontWeight: '600',
                          marginBottom: 4
                        }}>
                          {item.name}
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <Text style={{ color: theme.subtext, fontSize: 12 }}>
                            {item.barcode}
                          </Text>
                          {item.category && (
                            <>
                              <Text style={{ color: theme.subtext, fontSize: 12 }}>•</Text>
                              <Text style={{ color: theme.subtext, fontSize: 12 }}>
                                {item.category}
                              </Text>
                            </>
                          )}
                        </View>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={theme.subtext} />
                  </Pressable>
                )}
                ListEmptyComponent={
                  <View style={{ padding: 30, alignItems: 'center' }}>
                    <Ionicons name="search-outline" size={48} color={theme.subtext} />
                    <Text style={{ color: theme.subtext, marginTop: 12, fontSize: 14 }}>
                      No products found
                    </Text>
                  </View>
                }
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 25, paddingTop: 50, paddingBottom: 100 },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 5,
  },
  refreshBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 5,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  title: { fontSize: 23, fontWeight: "900", letterSpacing: -1 },
  subtitle: { fontSize: 10, fontWeight: "900", letterSpacing: 2 },
  
  // Enhanced mode selection
  modeSelection: {
    marginBottom: 25,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  modeButtons: {
    flexDirection: "row",
    gap: 12,
  },
  modeBtn: {
    flex: 1,
    padding: 20,
    borderRadius: 15,
    borderWidth: 2,
    alignItems: "center",
    gap: 4,
  },
  
  // Progress indicator
  progressContainer: {
    marginBottom: 20,
    alignItems: "center",
  },
  progressBar: {
    width: "100%",
    height: 4,
    backgroundColor: "rgba(150,150,150,0.2)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    marginTop: 8,
    fontWeight: "600",
  },
  
  // Enhanced input groups
  inputGroup: {
    marginBottom: 20,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 6,
  },
  required: {
    fontSize: 16,
    fontWeight: "bold",
  },
  helpBox: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  helpText: {
    fontSize: 12,
    lineHeight: 16,
  },
  inputFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
  },
  successRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 4,
  },
  successText: {
    fontSize: 12,
    fontWeight: "500",
  },
  charCount: {
    fontSize: 11,
    marginLeft: "auto",
  },
  
  // Enhanced photo section
  photoPlaceholder: {
    alignItems: "center",
    gap: 4,
  },
  photoPlaceholderText: {
    fontSize: 11,
    fontWeight: "500",
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 20,
    gap: 8,
  },
  uploadText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  uploadProgressBar: {
    width: 60,
    height: 4,
    backgroundColor: "rgba(255,255,255,0.3)",
    borderRadius: 2,
    overflow: "hidden",
  },
  uploadProgressFill: {
    height: "100%",
    borderRadius: 2,
  },
  lockedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 20,
  },
  imageRequirement: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  
  // Enhanced batch section
  batchSection: {
    marginTop: 20,
  },
  
  // Enhanced submit section
  submitSection: {
    marginTop: 30,
    alignItems: "center",
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  disabledBtn: {
    transform: [{ scale: 0.98 }],
  },
  formSummary: {
    marginTop: 12,
    alignItems: "center",
  },
  summaryText: {
    fontSize: 12,
    fontWeight: "500",
  },
  
  // Help modal styles
  helpModal: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "70%",
    maxWidth: "100%",
    width: "100%",
    marginTop: "auto",
  },
  helpModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(150,150,150,0.1)",
  },
  helpModalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  helpModalContent: {
    padding: 20,
  },
  helpModeItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "rgba(150,150,150,0.05)",
  },
  helpModeTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  helpModeDesc: {
    fontSize: 14,
    lineHeight: 20,
  },
  
  // Existing styles
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 15,
  },
  infoText: { flex: 1, fontSize: 13, lineHeight: 18 },
  scanShortcut: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 15,
    borderRadius: 20,
    borderWidth: 1.5,
    marginBottom: 15,
  },
  manualBatchBtn: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 20,
    borderWidth: 1.5,
    marginBottom: 25,
  },
  sectionTitle: {
    textAlign: "center",
    fontSize: 10,
    color: "#888",
    letterSpacing: 2,
    fontWeight: "800",
    marginBottom: 20,
  },
  label: {
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 8,
    marginTop: 15,
  },
  input: {
    padding: 16,
    borderRadius: 15,
    fontSize: 14,
    fontWeight: "400",
  },
  errorHighlight: {
    borderColor: '#FF4444',
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    shadowColor: '#FF4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  locked: { opacity: 0.5 },
  row: { flexDirection: "row", gap: 12 },
  photoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
    marginTop: 10,
    marginBottom: 20,
  },
  photoBoxContainer: { position: "relative" },
  photoBox: {
    width: 90,
    height: 90,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  fullImg: { width: "100%", height: "100%" },
  removePhoto: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: "#FFF",
    borderRadius: 12,
    elevation: 5,
  },
  generateBtn: {
    width: 52,
    height: 52,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 15,
    padding: 16,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "rgba(150,150,150,0.2)",
  },
  completeBtn: {
    flexDirection: "row",
    gap: 10,
    padding: 18,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 200,
  },
  completeBtnText: {
    color: "#FFF",
    fontWeight: "800",
    fontSize: 16,
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  pickerContent: {
    padding: 25,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 20,
    textAlign: "center",
  },
  pickerOpt: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(150,150,150,0.1)",
  },
  categoryModal: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(150,150,150,0.1)",
  },
  categoryItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(150,150,150,0.05)",
  },
  productSelectorItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "85%",
    padding: 25,
    borderRadius: 30,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "900",
    marginTop: 15,
    marginBottom: 5,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
    width: "100%",
  },
  modalBtn: {
    flex: 1,
    padding: 16,
    borderRadius: 15,
    alignItems: "center",
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
});
