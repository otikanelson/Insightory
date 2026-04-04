import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View
} from "react-native";
import Toast from 'react-native-toast-message';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function ProfileScreen() {
  const { theme, isDark } = useTheme();

    const router = useRouter();
  const { user, role, logout } = useAuth();

  const [showPinModal, setShowPinModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePin, setDeletePin] = useState('');
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [isViewOnly, setIsViewOnly] = useState(false);
  const [adminName, setAdminName] = useState('');

  // Check if admin is impersonating on mount
  useEffect(() => {
    const checkImpersonation = async () => {
      const impersonationActive = await AsyncStorage.getItem('impersonation_active');
      const impersonationAdminName = await AsyncStorage.getItem('impersonation_admin_name');
      const viewOnlyMode = await AsyncStorage.getItem('impersonation_view_only');
      
      if (impersonationActive === 'true') {
        setIsImpersonating(true);
        setIsViewOnly(viewOnlyMode === 'true');
        setAdminName(impersonationAdminName || 'Admin');
      }
    };
    checkImpersonation();
  }, []);

  const handleDeleteAccount = async () => {
    try {
      if (!deletePin || deletePin.length !== 4) {
        Toast.show({
          type: 'error',
          text1: 'Invalid PIN',
          text2: 'Please enter your 4-digit PIN',
        });
        return;
      }

      // Get stored PIN
      const storedPin = await AsyncStorage.getItem('auth_staff_pin');
      
      if (deletePin !== storedPin) {
        Toast.show({
          type: 'error',
          text1: 'Authentication Failed',
          text2: 'Incorrect PIN',
        });
        return;
      }

      // Call backend to delete account
      const API_URL = process.env.EXPO_PUBLIC_API_URL;
      const token = await AsyncStorage.getItem('auth_session_token');
      
      const response = await fetch(`${API_URL}/auth/staff/account`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ pin: deletePin }),
      });

      const data = await response.json();

      if (data.success) {
        Toast.show({
          type: 'success',
          text1: 'Account Deleted',
          text2: 'Your account has been permanently deleted',
        });

        // Clear all local data
        await AsyncStorage.clear();

        // Navigate to setup
        setTimeout(() => {
          router.replace('/auth/setup' as any);
        }, 1500);
      } else {
        Toast.show({
          type: 'error',
          text1: 'Delete Failed',
          text2: data.error || 'Could not delete account',
        });
      }
    } catch (error) {
      console.error('Delete account error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Could not delete account',
      });
    }
  };

  const handleUpdatePin = async () => {
    try {
      // Validate new PIN format
      if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
        Toast.show({
          type: 'error',
          text1: 'Invalid PIN',
          text2: 'PIN must be exactly 4 digits',
        });
        return;
      }

      // Validate confirmation
      if (newPin !== confirmPin) {
        Toast.show({
          type: 'error',
          text1: 'PIN Mismatch',
          text2: 'New PIN and confirmation do not match',
        });
        return;
      }

      // Get stored PIN based on role
      const pinKey = role === 'admin' ? 'admin_pin' : 'auth_staff_pin';
      const storedPin = await AsyncStorage.getItem(pinKey);

      // Validate old PIN
      if (oldPin !== storedPin) {
        Toast.show({
          type: 'error',
          text1: 'Authentication Failed',
          text2: 'Current PIN is incorrect',
        });
        return;
      }

      // Update PIN
      await AsyncStorage.setItem(pinKey, newPin);

      Toast.show({
        type: 'success',
        text1: 'PIN Updated',
        text2: 'Your PIN has been changed successfully',
      });

      setShowPinModal(false);
      setOldPin('');
      setNewPin('');
      setConfirmPin('');
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Update Failed',
        text2: 'Could not update PIN',
      });
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/auth/setup' as any);
  };

  const handleBackToAdmin = async () => {
    try {
      // Restore admin session
      const adminId = await AsyncStorage.getItem('impersonation_admin_id');
      const adminName = await AsyncStorage.getItem('impersonation_admin_name');
      const adminStoreId = await AsyncStorage.getItem('impersonation_admin_store_id');
      const adminStoreName = await AsyncStorage.getItem('impersonation_admin_store_name');
      const adminToken = await AsyncStorage.getItem('impersonation_admin_token');

      if (!adminId || !adminToken) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Could not restore admin session',
        });
        return;
      }

      // Restore admin session
      await AsyncStorage.multiSet([
        ['auth_session_token', adminToken],
        ['auth_user_role', 'admin'],
        ['auth_user_id', adminId],
        ['auth_user_name', adminName || 'Admin'],
        ['auth_store_id', adminStoreId || ''],
        ['auth_store_name', adminStoreName || ''],
      ]);

      // Clear impersonation flags
      await AsyncStorage.multiRemove([
        'impersonation_active',
        'impersonation_view_only',
        'impersonation_admin_id',
        'impersonation_admin_name',
        'impersonation_admin_store_id',
        'impersonation_admin_store_name',
        'impersonation_admin_token',
      ]);

      Toast.show({
        type: 'success',
        text1: 'Returned to Admin',
        text2: `Welcome back, ${adminName}`,
      });

      // Navigate back to admin dashboard
      router.replace('/admin/stats' as any);
    } catch (error) {
      console.error('Error returning to admin:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Could not return to admin session',
      });
    }
  };

  const getRoleDisplay = () => {
    switch (role) {
      case 'admin':
        return 'Administrator';
      case 'staff':
        return 'Staff Member';
      default:
        return 'User';
    }
  };

  const getRoleColor = () => {
    switch (role) {
      case 'admin':
        return '#FF3B30';
      case 'staff':
        return '#007AFF';
      default:
        return theme.primary;
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flex: 1, backgroundColor: theme.background }}>
      

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Profile</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Profile Card */}
        <View style={[styles.profileCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={[styles.avatarContainer, { backgroundColor: getRoleColor() + '20' }]}>
            <Ionicons name="person" size={48} color={getRoleColor()} />
          </View>

          <Text style={[styles.userName, { color: theme.text }]}>{user?.name || 'User'}</Text>

          <View style={[styles.roleBadge, { backgroundColor: getRoleColor() + '20' }]}>
            <Ionicons name={role === 'admin' ? 'shield-checkmark' : 'person'} size={16} color={getRoleColor()} />
            <Text style={[styles.roleText, { color: getRoleColor() }]}>{getRoleDisplay()}</Text>
          </View>

          <Text style={[styles.userId, { color: theme.subtext }]}>ID: {user?.id || 'N/A'}</Text>
        </View>

        {/* Back to Admin Button (shown when impersonating) */}
        {isImpersonating && (
          <>
            {isViewOnly && (
              <View style={[styles.viewOnlyBanner, { backgroundColor: '#FF9500', borderColor: '#FF9500' }]}>
                <Ionicons name="eye-outline" size={22} color="#FFF" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.viewOnlyTitle}>VIEW-ONLY MODE</Text>
                  <Text style={styles.viewOnlyText}>You cannot perform any actions in this view</Text>
                </View>
              </View>
            )}
            <Pressable
              style={[styles.backToAdminBtn, { backgroundColor: theme.primary, borderColor: theme.primary }]}
              onPress={handleBackToAdmin}
            >
              <Ionicons name="arrow-back-circle" size={22} color="#FFF" />
              <View style={{ flex: 1 }}>
                <Text style={styles.backToAdminText}>Return to Admin Account</Text>
                <Text style={styles.backToAdminSubtext}>Currently viewing as {user?.name}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#FFF" />
            </Pressable>
          </>
        )}

        {/* Account Settings */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.primary }]}>ACCOUNT SETTINGS</Text>

          <Pressable
            style={[styles.settingRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => {
              if (user?.isViewOnly) {
                Toast.show({
                  type: 'info',
                  text1: 'View-Only Mode',
                  text2: 'You cannot change PIN in view-only mode',
                });
                return;
              }
              setShowPinModal(true);
            }}
          >
            <View style={[styles.iconBox, { backgroundColor: theme.primary + '15' }]}>
              <Ionicons name="key-outline" size={22} color={theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingLabel, { color: theme.text }]}>Change PIN</Text>
              <Text style={[styles.settingDesc, { color: theme.subtext }]}>Update your 4-digit access code</Text>
            </View>
            {user?.isViewOnly ? (
              <Ionicons name="lock-closed" size={20} color={theme.subtext} />
            ) : (
              <Ionicons name="chevron-forward" size={20} color={theme.subtext} />
            )}
          </Pressable>

          {role === 'admin' && (
            <Pressable
              style={[styles.settingRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
              onPress={() => router.push('/admin/settings' as any)}
            >
              <View style={[styles.iconBox, { backgroundColor: theme.primary + '15' }]}>
                <Ionicons name="settings-outline" size={22} color={theme.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingLabel, { color: theme.text }]}>Admin Settings</Text>
                <Text style={[styles.settingDesc, { color: theme.subtext }]}>Manage system configuration</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.subtext} />
            </Pressable>
          )}
        </View>

        {/* Permissions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.primary }]}>YOUR PERMISSIONS</Text>

          <View style={[styles.permissionsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {role === 'admin' ? (
              <>
                <PermissionItem icon="checkmark-circle" label="Full system access" granted theme={theme} />
                <PermissionItem icon="checkmark-circle" label="Manage inventory" granted theme={theme} />
                <PermissionItem icon="checkmark-circle" label="Process sales" granted theme={theme} />
                <PermissionItem icon="checkmark-circle" label="View analytics" granted theme={theme} />
                <PermissionItem icon="checkmark-circle" label="Manage staff" granted theme={theme} />
                <PermissionItem icon="checkmark-circle" label="System settings" granted theme={theme} />
              </>
            ) : (
              <>
                <PermissionItem icon="checkmark-circle" label="View inventory" granted theme={theme} />
                <PermissionItem icon="checkmark-circle" label="Add products" granted theme={theme} />
                <PermissionItem icon="checkmark-circle" label="Edit products" granted theme={theme} />
                <PermissionItem icon="checkmark-circle" label="Process sales" granted theme={theme} />
                <PermissionItem icon="checkmark-circle" label="Scan barcodes" granted theme={theme} />
                <PermissionItem icon="close-circle" label="Delete products" granted={false} theme={theme} />
                <PermissionItem icon="close-circle" label="Admin settings" granted={false} theme={theme} />
                <PermissionItem icon="close-circle" label="Manage staff" granted={false} theme={theme} />
              </>
            )}
          </View>
        </View>

        {/* Logout Button */}
        <Pressable style={[styles.logoutBtn, { borderColor: '#FF4444' }]} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color="#FF4444" />
          <Text style={styles.logoutText}>Logout from Store</Text>
        </Pressable>

        {/* Delete Account Button */}
        {role === 'staff' && !isImpersonating && (
          <Pressable 
            style={[styles.deleteBtn, { borderColor: '#FF3B30', backgroundColor: '#FF3B30' + '10' }]} 
            onPress={() => setShowDeleteModal(true)}
          >
            <Ionicons name="trash-outline" size={22} color="#FF3B30" />
            <Text style={[styles.deleteText, { color: '#FF3B30' }]}>Delete Account Permanently</Text>
          </Pressable>
        )}

        <View style={{ height: 50 }} />
      </ScrollView>

      {/* PIN Update Modal */}
      <Modal visible={showPinModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <View style={[styles.modalIconBox, { backgroundColor: theme.primary + '15' }]}>
              <Ionicons name="key" size={32} color={theme.primary} />
            </View>

            <Text style={[styles.modalTitle, { color: theme.text }]}>Update PIN</Text>
            <Text style={[styles.modalDesc, { color: theme.subtext }]}>
              Enter your current PIN and choose a new 4-digit code
            </Text>

            <TextInput
              style={[
                styles.pinInput,
                { color: theme.text, borderColor: theme.border, backgroundColor: theme.background },
              ]}
              placeholder="Current PIN"
              placeholderTextColor={theme.subtext}
              secureTextEntry
              keyboardType="numeric"
              maxLength={4}
              value={oldPin}
              onChangeText={setOldPin}
            />

            <TextInput
              style={[
                styles.pinInput,
                { color: theme.text, borderColor: theme.border, backgroundColor: theme.background },
              ]}
              placeholder="New PIN"
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
              placeholder="Confirm New PIN"
              placeholderTextColor={theme.subtext}
              secureTextEntry
              keyboardType="numeric"
              maxLength={4}
              value={confirmPin}
              onChangeText={setConfirmPin}
            />

            <View style={styles.modalActions}>
              <Pressable
                style={[
                  styles.modalBtn,
                  { backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border },
                ]}
                onPress={() => {
                  setShowPinModal(false);
                  setOldPin('');
                  setNewPin('');
                  setConfirmPin('');
                }}
              >
                <Text style={{ color: theme.text, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.modalBtn, { backgroundColor: theme.primary }]} onPress={handleUpdatePin}>
                <Text style={{ color: '#FFF', fontWeight: '700' }}>Update PIN</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Account Modal */}
      <Modal visible={showDeleteModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <View style={[styles.modalIconBox, { backgroundColor: '#FF3B30' + '15' }]}>
              <Ionicons name="warning" size={32} color="#FF3B30" />
            </View>

            <Text style={[styles.modalTitle, { color: theme.text }]}>Delete Account?</Text>
            <Text style={[styles.modalDesc, { color: theme.subtext }]}>
              This action cannot be undone. Your account and all associated data will be permanently deleted.
            </Text>

            <TextInput
              style={[
                styles.pinInput,
                { color: theme.text, borderColor: '#FF3B30', backgroundColor: theme.background },
              ]}
              placeholder="Enter your PIN to confirm"
              placeholderTextColor={theme.subtext}
              secureTextEntry
              keyboardType="numeric"
              maxLength={4}
              value={deletePin}
              onChangeText={setDeletePin}
            />

            <View style={styles.modalActions}>
              <Pressable
                style={[
                  styles.modalBtn,
                  { backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border },
                ]}
                onPress={() => {
                  setShowDeleteModal(false);
                  setDeletePin('');
                }}
              >
                <Text style={{ color: theme.text, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              <Pressable 
                style={[styles.modalBtn, { backgroundColor: '#FF3B30' }]} 
                onPress={handleDeleteAccount}
              >
                <Text style={{ color: '#FFF', fontWeight: '700' }}>Delete Forever</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
    </View>
  );
}

interface PermissionItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  granted: boolean;
  theme: any;
}

const PermissionItem: React.FC<PermissionItemProps> = ({ icon, label, granted, theme }) => (
  <View style={styles.permissionItem}>
    <Ionicons name={icon} size={18} color={granted ? '#34C759' : '#FF3B30'} />
    <Text style={[styles.permissionLabel, { color: granted ? theme.text : theme.subtext }]}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 60,
    marginBottom: 30,
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
    fontWeight: '900',
  },
  profileCard: {
    padding: 30,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: 'center',
    marginBottom: 30,
  },
  viewOnlyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 20,
    borderWidth: 2,
    marginBottom: 16,
    gap: 12,
  },
  viewOnlyTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 2,
  },
  viewOnlyText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontWeight: '600',
  },
  backToAdminBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 20,
    borderWidth: 2,
    marginBottom: 30,
    gap: 12,
  },
  backToAdminText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
  },
  backToAdminSubtext: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  userName: {
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 10,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 10,
  },
  roleText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  userId: {
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 15,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  settingDesc: {
    fontSize: 12,
    fontWeight: '500',
  },
  permissionsCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  permissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  permissionLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 16,
    borderRadius: 20,
    borderWidth: 2,
    marginTop: 10,
  },
  logoutText: {
    color: '#FF4444',
    fontWeight: '900',
    fontSize: 14,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 16,
    borderRadius: 20,
    borderWidth: 2,
    marginTop: 12,
  },
  deleteText: {
    fontWeight: '900',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    padding: 30,
    borderRadius: 30,
    alignItems: 'center',
  },
  modalIconBox: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 10,
    textAlign: 'center',
  },
  modalDesc: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 25,
    lineHeight: 20,
  },
  pinInput: {
    width: '100%',
    height: 55,
    borderWidth: 1,
    borderRadius: 15,
    paddingHorizontal: 20,
    marginBottom: 15,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
    width: '100%',
  },
  modalBtn: {
    flex: 1,
    height: 50,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
