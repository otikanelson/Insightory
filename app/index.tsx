import { HelpTooltipIntroModal } from "@/components/HelpTooltipIntroModal";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AIOnboardingModal } from "../components/AIOnboardingModal";
import { ThemedText } from '../components/ThemedText';
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const HINTS = [
  { icon: "scan-outline",          text: "Scan a barcode to instantly look up or register a product." },
  { icon: "hourglass-outline",     text: "FEFO Queue shows which batches expire soonest — sell those first." },
  { icon: "notifications-outline", text: "Alerts fire automatically when stock runs low or items near expiry." },
  { icon: "analytics-outline",     text: "AI Insights predicts demand and flags high-risk products for you." },
  { icon: "cube-outline",          text: "Add a new batch to an existing product from the Add Stock screen." },
  { icon: "receipt-outline",       text: "Process a sale to automatically deduct stock via FEFO logic." },
  { icon: "shield-checkmark-outline", text: "Admins can restrict what each staff member can see or do." },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { role, logout } = useAuth();
  const insets = useSafeAreaInsets();

  const [showAIOnboarding, setShowAIOnboarding] = useState(false);
  const [showHelpTooltipIntro, setShowHelpTooltipIntro] = useState(false);
  const [activeHint, setActiveHint] = useState(0);

  const scrollRef = useRef<ScrollView>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    checkFirstLaunch();
  }, []);

  // Auto-scroll hints
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setActiveHint(prev => {
        const next = (prev + 1) % HINTS.length;
        scrollRef.current?.scrollTo({ x: next * SCREEN_WIDTH, animated: true });
        return next;
      });
    }, 3000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const checkFirstLaunch = async () => {
    try {
      const hasSeenOnboarding = await AsyncStorage.getItem('ai_onboarding_seen');
      const hasSeenHelpIntro = await AsyncStorage.getItem('help_tooltip_intro_seen');
      if (!hasSeenOnboarding) {
        setTimeout(() => setShowAIOnboarding(true), 1000);
      } else if (!hasSeenHelpIntro) {
        setTimeout(() => setShowHelpTooltipIntro(true), 1000);
      }
    } catch (error) {
      console.error('Error checking first launch:', error);
    }
  };

  const handleOnboardingClose = async () => {
    try {
      await AsyncStorage.setItem('ai_onboarding_seen', 'true');
      setShowAIOnboarding(false);
      const hasSeenHelpIntro = await AsyncStorage.getItem('help_tooltip_intro_seen');
      if (!hasSeenHelpIntro) setTimeout(() => setShowHelpTooltipIntro(true), 500);
    } catch (error) {
      console.error('Error saving onboarding status:', error);
    }
  };

  const handleHelpIntroClose = async () => {
    try {
      await AsyncStorage.setItem('help_tooltip_intro_seen', 'true');
      setShowHelpTooltipIntro(false);
    } catch (error) {
      console.error('Error saving help intro status:', error);
    }
  };

  const handleLearnMore = () => {
    setShowAIOnboarding(false);
    router.push("/ai-info" as any);
  };

  const handleViewInventory = () => {
    router.push(role === 'admin' ? "/admin/inventory" as any : "(tabs)/inventory" as any);
  };

  const handleAddProduct = () => {
    router.push(role === 'admin' ? "/admin/add-products" as any : "/(tabs)/add-products" as any);
  };

  const handleScanBarcode = () => {
    router.push(role === 'admin' ? "/admin/scan" as any : "/(tabs)/scan" as any);
  };

  const handleDashboard = () => {
    router.push(role === 'admin' ? "/admin/sales" as any : "/(tabs)/" as any);
  };

  const handleLogout = () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout? You'll need to enter your PIN again.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout",
          style: "destructive",
          onPress: async () => {
            await logout();
            router.replace('/auth/login' as any);
          }
        }
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>

        {/* Semicircular Header */}
        <View style={[styles.headerCurve, { backgroundColor: theme.header }]}>
          <ThemedText style={styles.headerTitle}>Insightory</ThemedText>
          <Pressable
            style={[styles.logoutBtn, { top: insets.top + 10 }]}
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={28} color={theme.primary} />
          </Pressable>
        </View>

        {/* Centered Content */}
        <View style={styles.centerContent}>
          <View style={[styles.logoMark, { backgroundColor: theme.primaryLight }]}>
            <Ionicons name="cube" size={48} color={theme.primary} />
          </View>
          <ThemedText style={[styles.appName, { color: theme.primary }]}>Insightory</ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.subtext }]}>
            Smart tracking for products & expiry dates
          </ThemedText>
        </View>

        {/* Hints Strip */}
        <View style={styles.hintsContainer}>
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            onMomentumScrollEnd={e => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
              setActiveHint(idx);
            }}
            onScrollBeginDrag={() => {
              if (timerRef.current) clearInterval(timerRef.current);
            }}
          >
            {HINTS.map((hint, i) => (
              <View key={i} style={[styles.hintCard, { width: SCREEN_WIDTH, backgroundColor: "transparent" }]}>
                <View style={[styles.hintInner, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <View style={[styles.hintIconBox, { backgroundColor: theme.primaryLight }]}>
                    <Ionicons name={hint.icon as any} size={14} color={theme.primary} />
                  </View>
                  <ThemedText style={[styles.hintText, { color: theme.subtext }]} numberOfLines={2}>
                    {hint.text}
                  </ThemedText>
                </View>
              </View>
            ))}
          </ScrollView>

          {/* Dot indicators */}
          <View style={styles.dots}>
            {HINTS.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  { backgroundColor: i === activeHint ? theme.primary : theme.border }
                ]}
              />
            ))}
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <Pressable
            style={[styles.primaryButton, { backgroundColor: theme.primary }]}
            onPress={handleViewInventory}
          >
            <ThemedText style={styles.primaryText}>View Inventory</ThemedText>
          </Pressable>

          <View style={styles.secondaryRow}>
            <Pressable
              style={[styles.secondaryButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
              onPress={handleAddProduct}
            >
              <Ionicons name="add-circle-outline" size={18} color={theme.text} />
              <ThemedText style={[styles.secondaryText, { color: theme.text }]}>Add Product</ThemedText>
            </Pressable>

            <Pressable
              style={[styles.secondaryButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
              onPress={handleDashboard}
            >
              <Ionicons name="grid-outline" size={18} color={theme.text} />
              <ThemedText style={[styles.secondaryText, { color: theme.text }]}>Dashboard</ThemedText>
            </Pressable>
          </View>

          <Pressable style={styles.ghostButton} onPress={handleScanBarcode}>
            <View style={styles.ghostBtncontent}>
              <Ionicons name="scan-outline" size={24} color={theme.primary} />
              <ThemedText style={[styles.ghostText, { color: theme.primary }]}>Scan Barcode</ThemedText>
            </View>
          </Pressable>
        </View>

        <AIOnboardingModal
          visible={showAIOnboarding}
          onClose={handleOnboardingClose}
          onLearnMore={handleLearnMore}
        />
        <HelpTooltipIntroModal
          visible={showHelpTooltipIntro}
          onClose={handleHelpIntroClose}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerCurve: {
    height: 150,
    borderBottomLeftRadius: 1000,
    borderBottomRightRadius: 1000,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 40,
    width: "130%",
    alignSelf: "center",
  },
  headerTitle: { fontSize: 30, color: "#FFFFFF", letterSpacing: 1 },
  logoutBtn: {
    position: "absolute",
    left: "14%",
    width: 38,
    height: 38,
    justifyContent: "center",
    alignItems: "center",
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  logoMark: {
    width: 100,
    height: 100,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  appName: { fontSize: 11, letterSpacing: 4, textTransform: 'uppercase', marginBottom: 8 },
  subtitle: { fontSize: 16, textAlign: "center", lineHeight: 24, marginBottom: 30 },

  // Hints
  hintsContainer: { marginBottom: 8 },
  hintCard: { paddingHorizontal: 24, justifyContent: "center" },
  hintInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  hintIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  hintText: { fontSize: 12, lineHeight: 17, flex: 1 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 5, marginTop: 8 },
  dot: { width: 5, height: 5, borderRadius: 3 },

  // Actions
  actions: { padding: 24, gap: 14, marginBottom: 40 },
  primaryButton: { paddingVertical: 15, borderRadius: 20, alignItems: "center" },
  primaryText: { color: "#FFFFFF", fontSize: 14 },
  secondaryRow: { flexDirection: "row", gap: 12 },
  secondaryButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 14,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  secondaryText: { fontSize: 14 },
  ghostButton: { paddingVertical: 10, alignItems: "center" },
  ghostBtncontent: { flexDirection: "row", gap: 10, alignItems: "center" },
  ghostText: { fontSize: 14 },
});
