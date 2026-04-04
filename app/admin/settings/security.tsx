import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from "react-native";
import Toast from "react-native-toast-message";
import { useTheme } from "../../../context/ThemeContext";

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/api';

export default function SecuritySettingsScreen() {
  const { theme, isDark } = useTheme();
  const router = useRouter();

  // Login PIN Update State
  const [showLoginPinModal, setShowLoginPinModal] = useState(false);
  const [oldLoginPin, setOldLoginPin] = useState("");
  const [newLoginPin, setNewLoginPin] = useState("");
  const [confirmLoginPin, setConfirmLoginPin] = useState("");

  // Security PIN Update State
  const [showSecurityPinModal, setShowSecurityPinModal] = useState(false);
  const [showRemoveSecurityPinModal, setShowRemoveSecurityPinModal] = useState(false);
  const [oldSecurityPin, setOldSecurityPin] = useState("");
  const [newSecurityPin, setNewSecurityPin] = useState("");
  const [confirmSecurityPin, setConfirmSecurityPin] = useState("");
  const [removeSecurityPinConfirm, setRemoveSecurityPinConfirm] = useState("");

  // Security Settings State
  const [autoLogout, setAutoLogout] = useState(true);
  const [autoLogoutTime, setAutoLogoutTime] = useState(30); // minutes
  const [requireSecurityPinForDelete, setRequireSecurityPinForDelete] = useState(true);
  const [hasLoginPin, setHasLoginPin] = useState(false);
  const [hasSecurityPin, setHasSecurityPin] = useState(false);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const loginPin = await AsyncStorage.getItem('admin_login_pin');
      const securityPin = await AsyncStorage.getItem('admin_security_pin');
      const pinRequired = await AsyncStorage.getItem('admin_require_security_pin_delete');
      const logoutEnabled = await AsyncStorage.getItem('admin_auto_logout');
      const logoutTime = await AsyncStorage.getItem('admin_auto_logout_time');
      
      setHasLoginPin(!!loginPin);
      setHasSecurityPin(!!securityPin);
      if (pinRequired !== null) setRequireSecurityPinForDelete(pinRequired === 'true');
      if (logoutEnabled !== null) setAutoLogout(logoutEnabled === 'true');
      if (logoutTime !== null) setAutoLogoutTime(parseInt(logoutTime));
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handleRequireSecurityPinToggle = async (value: boolean) => {
    setRequireSecurityPinForDelete(value);
    try {
      await AsyncStorage.setItem('admin_require_security_pin_delete', value.toString());
      Toast.show({
        type: 'success',
        text1: 'Setting Updated',
        text2: `Admin Security PIN ${value ? 'required' : 'not required'} for deletions`
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Update Failed',
        text2: 'Please try again'
      });
    }
  };

  const handleAutoLogoutToggle = async (value: boolean) => {
    setAutoLogout(value);
    try {
      await AsyncStorage.setItem('admin_auto_logout', value.toString());
      Toast.show({
        type: 'success',
        text1: 'Setting Updated',
        text2: `Auto-logout ${value ? 'enabled' : 'disabled'}`
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Update Failed',
        text2: 'Please try again'
      });
    }
  };

  const handleAutoLogoutTimeChange = async (minutes: number) => {
    setAutoLogoutTime(minutes);
    try {
      await AsyncStorage.setItem('admin_auto_logout_time', minutes.toString());
      Toast.show({
        type: 'success',
        text1: 'Timeout Updated',
        text2: `Auto-logout set to ${minutes} minutes`
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Update Failed',
        text2: 'Please try again'
      });
    }
  };

  const handleLoginPinUpdate = async () => {
    try {
      // Get stored Login PIN
      const storedPin = await AsyncStorage.getItem('admin_login_pin');
      
      if (!storedPin) {
        Toast.show({
          type: 'error',
          text1: 'No Login PIN Set',
          text2: 'Please set up your Login PIN first'
        });
        return;
      }
      
      // Validate old PIN
      if (oldLoginPin !== storedPin) {
        Toast.show({
          type: 'error',
          text1: 'Authentication Failed',
          text2: 'Current Login PIN is incorrect'
        });
        return;
      }

      // Validate new PIN format
      if (newLoginPin.length !== 4 || !/^\d{4}$/.test(newLoginPin)) {
        Toast.show({
          type: 'error',
          text1: 'Invalid PIN',
          text2: 'Login PIN must be exactly 4 digits'
        });
        return;
      }

      // Validate confirmation
      if (newLoginPin !== confirmLoginPin) {
        Toast.show({
          type: 'error',
          text1: 'PIN Mismatch',
          text2: 'New PIN and confirmation do not match'
        });
        return;
      }

      // Update local storage
      await AsyncStorage.setItem('admin_login_pin', newLoginPin);
      
      Toast.show({
        type: 'success',
        text1: 'Login PIN Updated',
        text2: 'Your Login PIN has been changed successfully'
      });

      setShowLoginPinModal(false);
      setOldLoginPin("");
      setNewLoginPin("");
      setConfirmLoginPin("");
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Update Failed',
        text2: 'Please try again'
      });
    }
  };

  const handleSecurityPinFirstTimeSetup = async () => {
    try {
      // Validate PIN format
      if (newSecurityPin.length !== 4 || !/^\d{4}$/.test(newSecurityPin)) {
        Toast.show({
          type: 'error',
          text1: 'Invalid PIN',
          text2: 'Security PIN must be exactly 4 digits'
        });
        return;
      }

      // Validate confirmation
      if (newSecurityPin !== confirmSecurityPin) {
        Toast.show({
          type: 'error',
          text1: 'PIN Mismatch',
          text2: 'PINs do not match'
        });
        return;
      }

      // Store Security PIN locally
      await AsyncStorage.setItem('admin_security_pin', newSecurityPin);
      
      setHasSecurityPin(true);
      
      Toast.show({
        type: 'success',
        text1: 'Security PIN Created',
        text2: 'Admin Security PIN has been set successfully'
      });

      setShowSecurityPinModal(false);
      setOldSecurityPin("");
      setNewSecurityPin("");
      setConfirmSecurityPin("");
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Setup Failed',
        text2: 'Please try again'
      });
    }
  };

  const handleSecurityPinUpdate = async () => {
    try {
      // Get stored Security PIN
      const storedPin = await AsyncStorage.getItem('admin_security_pin');
      
      if (!storedPin) {
        Toast.show({
          type: 'error',
          text1: 'No Security PIN Set',
          text2: 'Please set up your Admin Security PIN first'
        });
        return;
      }
      
      // Validate old PIN
      if (oldSecurityPin !== storedPin) {
        Toast.show({
          type: 'error',
          text1: 'Authentication Failed',
          text2: 'Current Security PIN is incorrect'
        });
        return;
      }

      // Validate new PIN format
      if (newSecurityPin.length !== 4 || !/^\d{4}$/.test(newSecurityPin)) {
        Toast.show({
          type: 'error',
          text1: 'Invalid PIN',
          text2: 'Security PIN must be exactly 4 digits'
        });
        return;
      }

      // Validate confirmation
      if (newSecurityPin !== confirmSecurityPin) {
        Toast.show({
          type: 'error',
          text1: 'PIN Mismatch',
          text2: 'New PIN and confirmation do not match'
        });
        return;
      }

      // Update local storage
      await AsyncStorage.setItem('admin_security_pin', newSecurityPin);
      
      Toast.show({
        type: 'success',
        text1: 'Security PIN Updated',
        text2: 'Admin Security PIN has been changed successfully'
      });

      setShowSecurityPinModal(false);
      setOldSecurityPin("");
      setNewSecurityPin("");
      setConfirmSecurityPin("");
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Update Failed',
        text2: 'Please try again'
      });
    }
  };

  const handleRemoveSecurityPin = async () => {
    try {
      const storedPin = await AsyncStorage.getItem('admin_security_pin');
      
      if (!storedPin) {
        Toast.show({
          type: 'error',
          text1: 'No Security PIN Set',
          text2: 'There is no Admin Security PIN to remove'
        });
        setShowRemoveSecurityPinModal(false);
        return;
      }

      if (removeSecurityPinConfirm !== storedPin) {
        Toast.show({
          type: 'error',
          text1: 'Authentication Failed',
          text2: 'Incorrect PIN'
        });
        return;
      }

      // Remove PIN from storage
      await AsyncStorage.removeItem('admin_security_pin');
      
      setHasSecurityPin(false);
      
      Toast.show({
        type: 'success',
        text1: 'Security PIN Removed',
        text2: 'Sensitive operations are now unrestricted'
      });

      setShowRemoveSecurityPinModal(false);
      setRemoveSecurityPinConfirm("");
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Removal Failed',
        text2: 'Please try again'
      });
    }
  };

  const SettingRow = ({ icon, label, description, onPress, children }: any) => {
    const row = (
      <View style={[styles.settingRow, { borderBottomColor: theme.border }]}>
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
              SECURITY
            </Text>
          </View>
        </View>

        {/* LOGIN PIN MANAGEMENT SECTION */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.primary }]}>
              LOGIN PIN MANAGEMENT
            </Text>
            {hasLoginPin && (
              <View style={[styles.statusBadge, { backgroundColor: '#34C759' + '15', borderColor: '#34C759' }]}>
                <Ionicons name="checkmark-circle" size={14} color="#34C759" />
                <Text style={[styles.statusBadgeText, { color: '#34C759' }]}>
                  CONFIGURED
                </Text>
              </View>
            )}
          </View>

          <SettingRow
            icon="log-in-outline"
            label="Update Login PIN"
            description="Used to log into your admin account"
            onPress={() => setShowLoginPinModal(true)}
          >
            <Ionicons name="chevron-forward" size={20} color={theme.subtext} />
          </SettingRow>

          <View style={[styles.infoBanner, { backgroundColor: theme.primary + '10', borderColor: theme.primary + '30' }]}>
            <Ionicons name="information-circle-outline" size={20} color={theme.primary} />
            <Text style={[styles.infoText, { color: theme.text }]}>
              Your Login PIN is used to authenticate and access your admin account. It's different from the Security PIN used for sensitive operations.
            </Text>
          </View>
        </View>

        {/* ADMIN PIN MANAGEMENT SECTION */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.primary }]}>
              ADMIN PIN MANAGEMENT
            </Text>
            {!hasSecurityPin && (
              <View style={[styles.statusBadge, { backgroundColor: '#FF9500' + '15', borderColor: '#FF9500' }]}>
                <Ionicons name="alert-circle" size={14} color="#FF9500" />
                <Text style={[styles.statusBadgeText, { color: '#FF9500' }]}>
                  NOT SET
                </Text>
              </View>
            )}
            {hasSecurityPin && (
              <View style={[styles.statusBadge, { backgroundColor: '#34C759' + '15', borderColor: '#34C759' }]}>
                <Ionicons name="shield-checkmark" size={14} color="#34C759" />
                <Text style={[styles.statusBadgeText, { color: '#34C759' }]}>
                  PROTECTED
                </Text>
              </View>
            )}
          </View>

          <SettingRow
            icon="shield-outline"
            label={hasSecurityPin ? "Update Admin Security PIN" : "Set Admin Security PIN"}
            description="Required for registering products and deleting items"
            onPress={() => setShowSecurityPinModal(true)}
          >
            <Ionicons name="chevron-forward" size={20} color={theme.subtext} />
          </SettingRow>

          {hasSecurityPin && (
            <SettingRow
              icon="lock-open-outline"
              label="Remove Security PIN"
              description="Disable PIN protection for sensitive operations"
              onPress={() => setShowRemoveSecurityPinModal(true)}
            >
              <Ionicons name="chevron-forward" size={20} color={theme.subtext} />
            </SettingRow>
          )}

          {!hasSecurityPin && (
            <View style={[styles.warningBanner, { backgroundColor: '#FF9500' + '15', borderColor: '#FF9500' }]}>
              <Ionicons name="warning-outline" size={20} color="#FF9500" />
              <Text style={[styles.warningText, { color: '#FF9500' }]}>
                No Admin Security PIN set. Anyone can register products and perform sensitive operations.
              </Text>
            </View>
          )}
        </View>

        {/* SESSION MANAGEMENT SECTION */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.primary, marginBottom: 15 }]}>
            SESSION MANAGEMENT
          </Text>

          <SettingRow
            icon="shield-checkmark-outline"
            label="Require Admin Security PIN for Delete"
            description="Ask for Security PIN before deleting products"
          >
            <Switch
              value={requireSecurityPinForDelete}
              onValueChange={handleRequireSecurityPinToggle}
              trackColor={{ true: theme.primary }}
              disabled={!hasSecurityPin}
            />
          </SettingRow>

          <SettingRow
            icon="time-outline"
            label="Auto-Logout"
            description={`End session after ${autoLogoutTime} minutes of inactivity`}
          >
            <Switch
              value={autoLogout}
              onValueChange={handleAutoLogoutToggle}
              trackColor={{ true: theme.primary }}
            />
          </SettingRow>

          {autoLogout && (
            <View style={[styles.timeoutSelector, { backgroundColor: theme.background, borderColor: theme.border }]}>
              <Text style={[styles.timeoutLabel, { color: theme.text }]}>Auto-logout Time</Text>
              <View style={styles.timeoutButtons}>
                <Pressable
                  style={[
                    styles.timeoutBtn,
                    { backgroundColor: autoLogoutTime === 30 ? theme.primary : theme.surface, borderColor: theme.border }
                  ]}
                  onPress={() => handleAutoLogoutTimeChange(30)}
                >
                  <Text style={[styles.timeoutBtnText, { color: autoLogoutTime === 30 ? '#FFF' : theme.text }]}>
                    30 min
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.timeoutBtn,
                    { backgroundColor: autoLogoutTime === 45 ? theme.primary : theme.surface, borderColor: theme.border }
                  ]}
                  onPress={() => handleAutoLogoutTimeChange(45)}
                >
                  <Text style={[styles.timeoutBtnText, { color: autoLogoutTime === 45 ? '#FFF' : theme.text }]}>
                    45 min
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.timeoutBtn,
                    { backgroundColor: autoLogoutTime === 60 ? theme.primary : theme.surface, borderColor: theme.border }
                  ]}
                  onPress={() => handleAutoLogoutTimeChange(60)}
                >
                  <Text style={[styles.timeoutBtnText, { color: autoLogoutTime === 60 ? '#FFF' : theme.text }]}>
                    60 min
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* LOGIN PIN UPDATE MODAL */}
      <Modal visible={showLoginPinModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <View style={[styles.modalIconBox, { backgroundColor: theme.primary + "15" }]}>
              <Ionicons name="log-in" size={32} color={theme.primary} />
            </View>

            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Update Login PIN
            </Text>
            <Text style={[styles.modalDesc, { color: theme.subtext }]}>
              Enter your current Login PIN and choose a new 4-digit code.
            </Text>

            <TextInput
              style={[styles.pinInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
              placeholder="Current Login PIN"
              placeholderTextColor={theme.subtext}
              secureTextEntry
              keyboardType="numeric"
              maxLength={4}
              value={oldLoginPin}
              onChangeText={setOldLoginPin}
            />

            <TextInput
              style={[styles.pinInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
              placeholder="New Login PIN"
              placeholderTextColor={theme.subtext}
              secureTextEntry
              keyboardType="numeric"
              maxLength={4}
              value={newLoginPin}
              onChangeText={setNewLoginPin}
            />

            <TextInput
              style={[styles.pinInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
              placeholder="Confirm New PIN"
              placeholderTextColor={theme.subtext}
              secureTextEntry
              keyboardType="numeric"
              maxLength={4}
              value={confirmLoginPin}
              onChangeText={setConfirmLoginPin}
            />

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border }]}
                onPress={() => {
                  setShowLoginPinModal(false);
                  setOldLoginPin("");
                  setNewLoginPin("");
                  setConfirmLoginPin("");
                }}
              >
                <Text style={{ color: theme.text, fontWeight: "600" }}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: theme.primary }]}
                onPress={handleLoginPinUpdate}
              >
                <Text style={{ color: "#FFF", fontWeight: "700" }}>UPDATE PIN</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* SECURITY PIN UPDATE MODAL */}
      <Modal visible={showSecurityPinModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <View style={[styles.modalIconBox, { backgroundColor: theme.primary + "15" }]}>
              <Ionicons name="key" size={32} color={theme.primary} />
            </View>

            <Text style={[styles.modalTitle, { color: theme.text }]}>
              {hasSecurityPin ? "Update Admin Security PIN" : "Set Admin Security PIN"}
            </Text>
            <Text style={[styles.modalDesc, { color: theme.subtext }]}>
              {hasSecurityPin 
                ? "Enter current Security PIN and choose a new 4-digit code."
                : "Create a 4-digit Security PIN for sensitive operations like registering products."
              }
            </Text>

            {hasSecurityPin && (
              <TextInput
                style={[styles.pinInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
                placeholder="Current Security PIN"
                placeholderTextColor={theme.subtext}
                secureTextEntry
                keyboardType="numeric"
                maxLength={4}
                value={oldSecurityPin}
                onChangeText={setOldSecurityPin}
              />
            )}

            <TextInput
              style={[styles.pinInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
              placeholder={hasSecurityPin ? "New Security PIN" : "Enter Security PIN"}
              placeholderTextColor={theme.subtext}
              secureTextEntry
              keyboardType="numeric"
              maxLength={4}
              value={newSecurityPin}
              onChangeText={setNewSecurityPin}
            />

            <TextInput
              style={[styles.pinInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
              placeholder="Confirm Security PIN"
              placeholderTextColor={theme.subtext}
              secureTextEntry
              keyboardType="numeric"
              maxLength={4}
              value={confirmSecurityPin}
              onChangeText={setConfirmSecurityPin}
            />

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border }]}
                onPress={() => {
                  setShowSecurityPinModal(false);
                  setOldSecurityPin("");
                  setNewSecurityPin("");
                  setConfirmSecurityPin("");
                }}
              >
                <Text style={{ color: theme.text, fontWeight: "600" }}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: theme.primary }]}
                onPress={hasSecurityPin ? handleSecurityPinUpdate : handleSecurityPinFirstTimeSetup}
              >
                <Text style={{ color: "#FFF", fontWeight: "700" }}>
                  {hasSecurityPin ? "UPDATE PIN" : "CREATE PIN"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* REMOVE SECURITY PIN MODAL */}
      <Modal visible={showRemoveSecurityPinModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <View style={[styles.modalIconBox, { backgroundColor: '#FF4444' + "15" }]}>
              <Ionicons name="warning" size={32} color="#FF4444" />
            </View>

            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Remove Admin Security PIN
            </Text>
            <Text style={[styles.modalDesc, { color: theme.subtext }]}>
              Warning: Removing the Security PIN allows unrestricted access to sensitive operations.
            </Text>

            <TextInput
              style={[styles.pinInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
              placeholder="Enter Current Security PIN to Confirm"
              placeholderTextColor={theme.subtext}
              secureTextEntry
              keyboardType="numeric"
              maxLength={4}
              value={removeSecurityPinConfirm}
              onChangeText={setRemoveSecurityPinConfirm}
            />

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border }]}
                onPress={() => {
                  setShowRemoveSecurityPinModal(false);
                  setRemoveSecurityPinConfirm("");
                }}
              >
                <Text style={{ color: theme.text, fontWeight: "600" }}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: '#FF4444' }]}
                onPress={handleRemoveSecurityPin}
              >
                <Text style={{ color: "#FFF", fontWeight: "700" }}>Remove PIN</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    borderBottomWidth: 1,
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
  timeoutSelector: {
    marginTop: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  timeoutLabel: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 12,
  },
  timeoutButtons: {
    flexDirection: "row",
    gap: 10,
  },
  timeoutBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
  },
  timeoutBtnText: {
    fontSize: 13,
    fontWeight: "700",
  },
  warningBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 12,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
  },
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
  modalTitle: { fontSize: 22, fontWeight: "900", marginBottom: 10, textAlign: "center" },
  modalDesc: { fontSize: 14, textAlign: "center", marginBottom: 25, lineHeight: 20 },
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
  modalActions: { flexDirection: "row", gap: 12, marginTop: 10, width: "100%" },
  modalBtn: {
    flex: 1,
    height: 50,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },
});
