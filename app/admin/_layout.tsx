import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Tabs, useFocusEffect, useRouter } from "expo-router";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View
} from "react-native";
import Toast from "react-native-toast-message";
import { AdminTourOverlay } from "../../components/AdminTourOverlay";
import { AdminTourProvider } from "../../context/AdminTourContext";
import { useTheme } from "../../context/ThemeContext";

export default function AdminLayout() {
  const { theme } = useTheme();
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [pin, setPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [loading, setLoading] = useState(true);
  const [hasPin, setHasPin] = useState(false);
  const [autoLogoutEnabled, setAutoLogoutEnabled] = useState(true);
  const [autoLogoutTime, setAutoLogoutTime] = useState(30);

  // Check authentication on mount and when screen focuses
  useFocusEffect(
    React.useCallback(() => {
      checkAuth();
    }, [])
  );

  const checkAuth = async () => {
    try {
      const userRole = await AsyncStorage.getItem("auth_user_role");
      
      // SECURITY: Block staff from accessing admin dashboard entirely
      if (userRole === 'staff') {
        Toast.show({
          type: "error",
          text1: "Access Denied",
          text2: "Staff cannot access admin dashboard. Ask admin to use impersonation.",
          visibilityTime: 4000,
        });
        router.replace("/(tabs)");
        return;
      }

      const storedPin = await AsyncStorage.getItem("admin_security_pin");
      const lastAuth = await AsyncStorage.getItem("admin_last_auth");
      const logoutEnabled = await AsyncStorage.getItem("admin_auto_logout");
      const logoutTime = await AsyncStorage.getItem("admin_auto_logout_time");

      // Load settings
      setAutoLogoutEnabled(logoutEnabled !== "false");
      setAutoLogoutTime(logoutTime ? parseInt(logoutTime) : 30);

      // If no Security PIN exists, allow entry but show setup prompt
      if (!storedPin) {
        setHasPin(false);
        setIsAuthenticated(true);
        setShowSetupModal(true);
        setLoading(false);
        return;
      }

      setHasPin(true);

      // Check if we have a recent auth session
      if (lastAuth) {
        const elapsed = Date.now() - parseInt(lastAuth);
        const timeoutMs = (logoutTime ? parseInt(logoutTime) : 30) * 60 * 1000;

        // If auto-logout is enabled and session is valid, authenticate
        if ((logoutEnabled === "false" || elapsed < timeoutMs)) {
          setIsAuthenticated(true);
          setLoading(false);
          return;
        }
      }

      // Need authentication
      setIsAuthenticated(false);
      setShowPinModal(true);
      setLoading(false);
    } catch (error) {
      console.error("Auth check error:", error);
      setIsAuthenticated(false);
      setShowPinModal(true);
      setLoading(false);
    }
  };

  const handlePinSubmit = async () => {
    try {
      // Only admin users can access this dashboard
      const storedPin = await AsyncStorage.getItem("admin_security_pin");
      
      if (pin === storedPin) {
        await AsyncStorage.setItem("admin_last_auth", Date.now().toString());
        setIsAuthenticated(true);
        setShowPinModal(false);
        setPin("");
      } else {
        Toast.show({
          type: "error",
          text1: "Access Denied",
          text2: "Incorrect Security PIN",
        });
        setPin("");
      }
    } catch (error) {
      console.error('PIN Submit Error:', error);
      Toast.show({
        type: "error",
        text1: "Authentication Error",
        text2: "Could not verify PIN",
      });
    }
  };

  const handleFirstTimeSetup = async () => {
    try {
      // Validate PIN format
      if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
        Toast.show({
          type: "error",
          text1: "Invalid PIN",
          text2: "PIN must be exactly 4 digits",
        });
        return;
      }

      // Validate confirmation
      if (newPin !== confirmPin) {
        Toast.show({
          type: "error",
          text1: "PIN Mismatch",
          text2: "PINs do not match",
        });
        return;
      }

      // Store new Security PIN
      await AsyncStorage.setItem("admin_security_pin", newPin);
      await AsyncStorage.setItem("admin_first_setup", "completed");
      await AsyncStorage.setItem("admin_last_auth", Date.now().toString());

      setHasPin(true);
      setShowSetupModal(false);
      setNewPin("");
      setConfirmPin("");

      Toast.show({
        type: "success",
        text1: "Security PIN Created",
        text2: "Admin dashboard is now secured",
      });
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Setup Failed",
        text2: "Could not save Security PIN",
      });
    }
  };

  const handleSkipSetup = () => {
    setShowSetupModal(false);
    Toast.show({
      type: "info",
      text1: "Setup Skipped",
      text2: "Please set your PIN in Settings for security",
    });
  };

  const handleCancel = () => {
    setShowPinModal(false);
    setPin("");
    router.replace("/(tabs)");
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!isAuthenticated && hasPin) {
    return (
      <Modal visible={showPinModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <View style={[styles.iconBox, { backgroundColor: theme.primary + "15" }]}>
              <Ionicons name="shield-checkmark" size={40} color={theme.primary} />
            </View>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Admin Access Required
            </Text>
            <Text style={[styles.modalSubtext, { color: theme.subtext }]}>
              Enter the admin Security PIN to continue
            </Text>
            <TextInput
              style={[
                styles.pinInput,
                { color: theme.text, borderColor: theme.border, backgroundColor: theme.background },
              ]}
              secureTextEntry
              keyboardType="numeric"
              maxLength={4}
              value={pin}
              onChangeText={setPin}
              placeholder="Admin Security PIN"
              placeholderTextColor={theme.subtext}
              autoFocus
            />
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border }]}
                onPress={handleCancel}
              >
                <Text style={{ color: theme.text, fontWeight: "600" }}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: theme.primary }]}
                onPress={handlePinSubmit}
              >
                <Text style={{ color: "#FFF", fontWeight: "700" }}>Verify PIN</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <AdminTourProvider>
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: theme.primary,
            tabBarInactiveTintColor: theme.subtext,
            tabBarHideOnKeyboard: true,
            tabBarLabelStyle: {
              fontSize: 10,
              fontWeight: "700",
              letterSpacing: 0.3,
            },
            tabBarStyle: {
              backgroundColor: theme.tabSurface,
              borderTopWidth: 1,
              borderTopColor: theme.border,
              height: 68,
              paddingBottom: 10,
              paddingTop: 8,
              elevation: 0,
              shadowOpacity: 0,
            },
          }}
        >
        <Tabs.Screen
          name="sales"
          options={{
            title: "SALES",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "cart" : "cart-outline"}
                size={22}
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="inventory"
          options={{
            title: "INVENTORY",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "cube" : "cube-outline"}
                size={22}
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="scan"
          options={{
            title: "Scan",
            tabBarStyle: { display: "none" },
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "scan" : "scan-outline"}
                size={22}
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="add-products"
          options={{
            title: "ADD",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "add-circle" : "add-circle-outline"}
                size={22}
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="stats"
          options={{
            title: "STATS",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "stats-chart" : "stats-chart-outline"}
                size={22}
                color={color}
              />
            ),
          }}
        />

      {/* Settings hidden from Tab Bar but accessible via button */}
        <Tabs.Screen
          name="settings"
          options={{
            href: null,
          }}
        />

      {/* Detail page hidden from Tab Bar */}
        <Tabs.Screen
          name="product/[id]"
          options={{
            href: null,
          }}
        />
        
        {/* Settings sub-pages hidden from Tab Bar */}
        <Tabs.Screen
          name="settings/profile"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="settings/security"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="settings/alerts"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="settings/store"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="settings/data"
          options={{
            href: null,
          }}
        />
      </Tabs>

      <AdminTourOverlay />

      {/* First-Time PIN Setup Modal */}
      <Modal visible={showSetupModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <View style={[styles.iconBox, { backgroundColor: theme.primary + "15" }]}>
              <Ionicons name="shield-checkmark" size={40} color={theme.primary} />
            </View>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Set Security PIN
            </Text>
            <Text style={[styles.modalSubtext, { color: theme.subtext }]}>
              Create a 4-digit Security PIN for sensitive admin operations
            </Text>

            <TextInput
              style={[
                styles.pinInput,
                { color: theme.text, borderColor: theme.border, backgroundColor: theme.background },
              ]}
              placeholder="Create PIN"
              placeholderTextColor={theme.subtext}
              secureTextEntry
              keyboardType="numeric"
              maxLength={4}
              value={newPin}
              onChangeText={setNewPin}
            />

            <TextInput
              style={[
                styles.pinInput,
                { color: theme.text, borderColor: theme.border, backgroundColor: theme.background },
              ]}
              placeholder="Confirm PIN"
              placeholderTextColor={theme.subtext}
              secureTextEntry
              keyboardType="numeric"
              maxLength={4}
              value={confirmPin}
              onChangeText={setConfirmPin}
            />

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border }]}
                onPress={handleSkipSetup}
              >
                <Text style={{ color: theme.text, fontWeight: "600" }}>Skip</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: theme.primary }]}
                onPress={handleFirstTimeSetup}
              >
                <Text style={{ color: "#FFF", fontWeight: "700" }}>Create PIN</Text>
              </Pressable>
            </View>

            <Text style={[styles.warningText, { color: theme.subtext }]}>
              ⚠️ You can set this up later in Settings
            </Text>
          </View>
        </View>
      </Modal>
      </View>
    </AdminTourProvider>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.90)",
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
  iconBox: {
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
  modalSubtext: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 25,
    lineHeight: 20,
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
  warningText: {
    fontSize: 12,
    marginTop: 15,
    textAlign: "center",
    fontWeight: "600",
  },
});