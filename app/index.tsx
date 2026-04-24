import { HelpTooltipIntroModal } from "@/components/HelpTooltipIntroModal";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Pressable,
  StyleSheet,
  View
} from "react-native";
import { AIOnboardingModal } from "../components/AIOnboardingModal";
import { ThemedText } from '../components/ThemedText';
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

export default function WelcomeScreen() {
  const router = useRouter();
  const { theme, isDark } = useTheme();

    const { role } = useAuth();
  const [showAIOnboarding, setShowAIOnboarding] = useState(false);
  const [showHelpTooltipIntro, setShowHelpTooltipIntro] = useState(false);

  useEffect(() => {
    checkFirstLaunch();
  }, []);

  const checkFirstLaunch = async () => {
    try {
      const hasSeenOnboarding = await AsyncStorage.getItem('ai_onboarding_seen');
      const hasSeenHelpIntro = await AsyncStorage.getItem('help_tooltip_intro_seen');
      
      if (!hasSeenOnboarding) {
        // Show AI onboarding after a short delay
        setTimeout(() => {
          setShowAIOnboarding(true);
        }, 1000);
      } else if (!hasSeenHelpIntro) {
        // If AI onboarding was already seen but help intro wasn't, show help intro
        setTimeout(() => {
          setShowHelpTooltipIntro(true);
        }, 1000);
      }
    } catch (error) {
      console.error('Error checking first launch:', error);
    }
  };

  const handleOnboardingClose = async () => {
    try {
      await AsyncStorage.setItem('ai_onboarding_seen', 'true');
      setShowAIOnboarding(false);
      
      // Check if user has seen help tooltip intro
      const hasSeenHelpIntro = await AsyncStorage.getItem('help_tooltip_intro_seen');
      if (!hasSeenHelpIntro) {
        // Show help tooltip intro after a short delay
        setTimeout(() => {
          setShowHelpTooltipIntro(true);
        }, 500);
      }
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

  // Role-based navigation helpers
  const handleViewInventory = () => {
    if (role === 'admin') {
      router.push("/admin/inventory" as any);
    } else {
      router.push("(tabs)/inventory" as any);
    }
  };

  const handleAddProduct = () => {
    if (role === 'admin') {
      router.push("/admin/add-products" as any);
    } else {
      router.push("/(tabs)/add-products" as any);
    }
  };

  const handleScanBarcode = () => {
    if (role === 'admin') {
      router.push("/admin/scan" as any);
    } else {
      router.push("/(tabs)/scan" as any);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Semicircular Header */}
      <View style={[styles.headerCurve, { backgroundColor: theme.header }]}>
        <ThemedText style={styles.headerTitle}>Insightory</ThemedText>
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

      {/* Action Buttons */}
      <View style={styles.actions}>
        <Pressable
          style={[styles.primaryButton, { backgroundColor: theme.primary }]}
          onPress={handleViewInventory}
        >
          <ThemedText style={styles.primaryText}>View Inventory</ThemedText>
        </Pressable>

        <Pressable
          style={[
            styles.secondaryButton,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
          ]}
          onPress={handleAddProduct}
        >
          <ThemedText style={[styles.secondaryText, { color: theme.text }]}>
            Add Product
          </ThemedText>
        </Pressable>

        <Pressable
          style={styles.ghostButton}
          onPress={handleScanBarcode}
        >
          <View style={styles.ghostBtncontent}>
            <Ionicons name="scan-outline" size={24} color={theme.primary} />
            <ThemedText style={[styles.ghostText, { color: theme.primary }]}>
              Scan Barcode
            </ThemedText>
          </View>
        </Pressable>
      </View>

      {/* AI Onboarding Modal */}
      <AIOnboardingModal
        visible={showAIOnboarding}
        onClose={handleOnboardingClose}
        onLearnMore={handleLearnMore}
      />

      {/* Help Tooltip Introduction Modal */}
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
  headerTitle: {
    fontSize: 30,
    color: "#FFFFFF",
    letterSpacing: 1,
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
  appName: {
    fontSize: 11,
    letterSpacing: 4,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 30,
  },
  actions: { padding: 24, gap: 14, marginBottom: 40 },
  primaryButton: {
    paddingVertical: 15,
    borderRadius: 20,
    alignItems: "center",
  },
  primaryText: { color: "#FFFFFF", fontSize: 14, },
  secondaryButton: {
    paddingVertical: 15,
    borderRadius: 20,
    alignItems: "center",
    borderWidth: 1.5,
  },
  secondaryText: { fontSize: 14, },
  ghostButton: { paddingVertical: 10, alignItems: "center" },
  ghostBtncontent: { flexDirection: "row", gap: 10, alignItems: "center" },
  ghostText: { fontSize: 14, },
});

