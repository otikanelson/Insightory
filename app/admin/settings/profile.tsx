import { ConfirmationModal } from '@/components/ConfirmationModal';
import { ModalToast, useModalToast } from '@/components/ModalToast';
import { PinResetModal } from '@/components/PinResetModal';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from "@react-navigation/native";
import axios from 'axios';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedText } from '../../../components/ThemedText';
import { useAuth } from '../../../context/AuthContext';
import { useTheme } from '../../../context/ThemeContext';
import { showErrorToast, showSuccessToast } from '../../../utils/errorHandler';

interface StaffMember {
  _id: string;
  name: string;
  role: string;
  lastLogin: string | null;
  isActive: boolean;
  createdAt: string;
  permissions?: {
    viewProducts?: boolean;      // Default: true, compulsory
    scanProducts?: boolean;      // Default: true
    registerProducts?: boolean;  // Default: true
    addProducts?: boolean;       // Default: true
    processSales?: boolean;      // Default: true
  };
}

export default function AdminProfileScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { user, role, logout } = useAuth();
  const insets = useSafeAreaInsets();

  const modalToast = useModalToast();
  const [showPinModal, setShowPinModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showPinResetModal, setShowPinResetModal] = useState(false);
  const [deleteSecurityPin, setDeleteSecurityPin] = useState('');
  const [storeNameConfirmation, setStoreNameConfirmation] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  
  // Staff deletion state
  const [showDeleteStaffModal, setShowDeleteStaffModal] = useState(false);
  const [staffToDelete, setStaffToDelete] = useState<StaffMember | null>(null);
  const [deletingStaff, setDeletingStaff] = useState(false);
  
  // Staff monitoring state
  const [showStaffMonitoringModal, setShowStaffMonitoringModal] = useState(false);
  const [staffToMonitor, setStaffToMonitor] = useState<StaffMember | null>(null);

  useEffect(() => {
    if (role === 'admin') {
      fetchStaffMembers();
    }
  }, [role]);

  // Refresh staff list when screen comes into focus (e.g., after adding a new staff member)
  useFocusEffect(
    useCallback(() => {
      if (role === 'admin') {
        fetchStaffMembers();
      }
    }, [role])
  );

  const fetchStaffMembers = async () => {
    setLoadingStaff(true);
    try {
      const response = await axios.get(`${process.env.EXPO_PUBLIC_API_URL}/auth/staff`);
      if (response.data.success) {
        setStaffMembers(response.data.data);
      }
    } catch (error: any) {
      console.error('Error fetching staff:', error);
      // Silently fail - staff list is optional
    } finally {
      setLoadingStaff(false);
    }
  };

  const handleDeleteStaff = (staff: StaffMember) => {
    setStaffToDelete(staff);
    setShowDeleteStaffModal(true);
  };

  const handleMonitorStaff = (staff: StaffMember) => {
    setStaffToMonitor(staff);
    setShowStaffMonitoringModal(true);
  };

  const confirmDeleteStaff = async () => {
    if (!staffToDelete) return;

    setDeletingStaff(true);
    try {
      const response = await axios.delete(
        `${process.env.EXPO_PUBLIC_API_URL}/auth/staff/${staffToDelete._id}`
      );

      if (response.data.success) {
        showSuccessToast("Staff Deleted", `${staffToDelete.name} has been removed`);

        // Refresh staff list
        await fetchStaffMembers();
        
        setShowDeleteStaffModal(false);
        setStaffToDelete(null);
      } else {
        throw new Error(response.data.error || 'Failed to delete staff');
      }
    } catch (error: any) {
      console.error('Error deleting staff:', error);
      showErrorToast(error, "Delete Failed");
    } finally {
      setDeletingStaff(false);
    }
  };

  const handleUpdatePin = async () => {
    try {
      if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
        modalToast.show({ type: 'error', title: 'Invalid PIN', message: 'PIN must be exactly 4 digits' });
        return;
      }
      if (newPin !== confirmPin) {
        modalToast.show({ type: 'error', title: 'PIN Mismatch', message: 'New PIN and confirmation do not match' });
        return;
      }
      const storedPin = await AsyncStorage.getItem('admin_login_pin');
      if (!storedPin) {
        modalToast.show({ type: 'error', title: 'Session Expired', message: 'Log out and log back in, then try again' });
        return;
      }
      if (oldPin !== storedPin) {
        modalToast.show({ type: 'error', title: 'Incorrect PIN', message: 'Current PIN is incorrect' });
        return;
      }
      await AsyncStorage.setItem('admin_login_pin', newPin);
      await AsyncStorage.removeItem('admin_pin');
      modalToast.show({ type: 'success', title: 'Login PIN Updated', message: 'Your Login PIN has been changed' });
      setTimeout(() => {
        setShowPinModal(false);
        setOldPin(''); setNewPin(''); setConfirmPin('');
      }, 1200);
    } catch (error) {
      modalToast.show({ type: 'error', title: 'Update Failed', message: 'Could not update PIN' });
    }
  };

  const handleLogout = async () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = async () => {
    await logout();
    setShowLogoutModal(false);
    router.replace('/auth/setup' as any);
  };

  const handleDeleteAccount = async () => {
    setShowDeleteModal(true);
  };

  const confirmDeleteAccount = async () => {
    try {
      setIsDeleting(true);
      if (!deleteSecurityPin || deleteSecurityPin.length !== 4) {
        modalToast.show({ type: 'error', title: 'Invalid PIN', message: 'Please enter your 4-digit Security PIN' });
        setIsDeleting(false); return;
      }
      const storedSecurityPin = await AsyncStorage.getItem('admin_security_pin');
      if (!storedSecurityPin) {
        modalToast.show({ type: 'error', title: 'No Security PIN', message: 'Please set up your Security PIN first' });
        setIsDeleting(false); return;
      }
      if (deleteSecurityPin !== storedSecurityPin) {
        modalToast.show({ type: 'error', title: 'Incorrect PIN', message: 'Incorrect Security PIN' });
        setIsDeleting(false); return;
      }
      const API_URL = process.env.EXPO_PUBLIC_API_URL;
      const token = await AsyncStorage.getItem('auth_session_token');
      const response = await fetch(`${API_URL}/auth/admin/account`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ pin: deleteSecurityPin }),
      });
      const data = await response.json();
      if (data.success) {
        modalToast.show({ type: 'success', title: 'Account Deleted', message: 'Your account and store have been permanently deleted' });
        await AsyncStorage.clear();
        setTimeout(() => router.replace('/auth/setup' as any), 2000);
      } else {
        modalToast.show({ type: 'error', title: 'Delete Failed', message: data.error || 'Could not delete account' });
      }
    } catch (error) {
      console.error('Delete account error:', error);
      modalToast.show({ type: 'error', title: 'Error', message: 'Could not delete account' });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <View style={{ flex: 1, backgroundColor: theme.background }}>
        

        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
            <Pressable onPress={() => router.push('/admin/settings')} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={theme.text} />
            </Pressable>
            <ThemedText style={[styles.headerTitle, { color: theme.text }]}>Profile</ThemedText>
          <View style={{ width: 40 }} />
        </View>

        {/* Profile Card */}
        <View style={[styles.profileCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={[styles.avatarContainer, { backgroundColor: '#FF3B30' + '20' }]}>
            <Ionicons name="person" size={48} color="#FF3B30" />
          </View>

          <ThemedText style={[styles.userName, { color: theme.text }]}>
            {user?.name || 'User'}
          </ThemedText>

          <View style={[styles.roleBadge, { backgroundColor: '#FF3B30' + '20' }]}>
            <Ionicons name="shield-checkmark" size={16} color="#FF3B30" />
            <ThemedText style={[styles.roleText, { color: '#FF3B30' }]}>Administrator</ThemedText>
          </View>

          <ThemedText style={[styles.userId, { color: theme.subtext }]}>
            ID: {user?.id || 'N/A'}
          </ThemedText>
          
          <View style={[styles.storeInfo, { backgroundColor: theme.primary + '10', borderColor: theme.primary + '30' }]}>
            <Ionicons name="storefront" size={16} color={theme.primary} />
            <ThemedText style={[styles.storeText, { color: theme.text }]}>
              {user?.storeName || 'Store'}
            </ThemedText>
          </View>
        </View>

        {/* Account Settings */}
        <View style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: theme.primary }]}>ACCOUNT SETTINGS</ThemedText>

          <Pressable
            style={[styles.settingRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => setShowPinModal(true)}
          >
            <View style={[styles.iconBox, { backgroundColor: theme.primary + '15' }]}>
              <Ionicons name="key-outline" size={22} color={theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={[styles.settingLabel, { color: theme.text }]}>Change Login PIN</ThemedText>
              <ThemedText style={[styles.settingDesc, { color: theme.subtext }]}>Update your 4-digit login code</ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.subtext} />
          </Pressable>

          <Pressable
            style={[styles.settingRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => router.push('/admin/settings/security' as any)}
          >
            <View style={[styles.iconBox, { backgroundColor: theme.primary + '15' }]}>
              <Ionicons name="shield-checkmark-outline" size={22} color={theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={[styles.settingLabel, { color: theme.text }]}>Security Settings</ThemedText>
              <ThemedText style={[styles.settingDesc, { color: theme.subtext }]}>Manage Security PIN and access controls</ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.subtext} />
          </Pressable>
        </View>

        {/* Permissions */}
        <View style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: theme.primary }]}>ADMIN PERMISSIONS</ThemedText>

          <View style={[styles.permissionsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <PermissionItem icon="checkmark-circle" label="Full system access" granted theme={theme} />
            <PermissionItem icon="checkmark-circle" label="Manage inventory" granted theme={theme} />
            <PermissionItem icon="checkmark-circle" label="Process sales" granted theme={theme} />
            <PermissionItem icon="checkmark-circle" label="View analytics" granted theme={theme} />
            <PermissionItem icon="checkmark-circle" label="Manage staff" granted theme={theme} />
            <PermissionItem icon="checkmark-circle" label="System settings" granted theme={theme} />
          </View>
        </View>

        {/* Staff Management Section - Only for admin users */}
        {role === 'admin' && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={[styles.sectionTitle, { color: theme.primary }]}>STAFF MEMBERS</ThemedText>
            <Pressable
              onPress={() => router.push('/auth/staff-register')}
              style={[styles.addStaffBtn, { backgroundColor: theme.primary }]}
            >
              <Ionicons name="person-add" size={18} color="#FFF" />
              <ThemedText style={styles.addStaffBtnText}>Add Staff</ThemedText>
            </Pressable>
          </View>

          {loadingStaff ? (
            <View style={[styles.settingRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <ActivityIndicator size="small" color={theme.primary} />
              <ThemedText style={[styles.settingDesc, { color: theme.subtext, marginLeft: 12 }]}>
                Loading staff members...
              </ThemedText>
            </View>
          ) : staffMembers.length > 0 ? (
            staffMembers.map((staff) => (
              <View key={staff._id} style={[styles.staffCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={styles.staffMainInfo}>
                  <View style={[styles.staffAvatar, { backgroundColor: '#007AFF' + '20' }]}>
                    <Ionicons name="person" size={24} color="#007AFF" />
                  </View>
                  
                  <View style={styles.staffDetails}>
                    <ThemedText style={[styles.staffName, { color: theme.text }]}>{staff.name}</ThemedText>
                    <View style={styles.staffMetaRow}>
                      <View style={[styles.staffRoleBadge, { backgroundColor: '#007AFF' + '15' }]}>
                        <ThemedText style={[styles.staffRoleText, { color: '#007AFF' }]}>Staff Member</ThemedText>
                      </View>
                      <View style={[
                        styles.staffStatusBadge, 
                        { backgroundColor: staff.isActive ? '#34C759' + '15' : '#FF3B30' + '15' }
                      ]}>
                        <View style={[
                          styles.statusDot, 
                          { backgroundColor: staff.isActive ? '#34C759' : '#FF3B30' }
                        ]} />
                        <ThemedText style={[
                          styles.staffStatusText, 
                          { color: staff.isActive ? '#34C759' : '#FF3B30' }
                        ]}>
                          {staff.isActive ? 'Active' : 'Inactive'}
                        </ThemedText>
                      </View>
                    </View>
                    {staff.lastLogin && (
                      <ThemedText style={[styles.staffLastLogin, { color: theme.subtext }]}>
                        Last login: {new Date(staff.lastLogin).toLocaleDateString()}
                      </ThemedText>
                    )}
                  </View>
                </View>

                <View style={styles.staffActions}>
                  <Pressable
                    onPress={() => router.push(`/admin/staff/${staff._id}/permissions` as any)}
                    style={[styles.actionButton, styles.permissionsBtn, { backgroundColor: theme.primary + '15' }]}
                  >
                    <Ionicons name="settings-outline" size={18} color={theme.primary} />
                    <ThemedText style={[styles.actionButtonText, { color: theme.primary }]}>Permissions</ThemedText>
                  </Pressable>
                  
                  <Pressable
                    onPress={() => handleMonitorStaff(staff)}
                    style={[styles.actionButton, styles.monitorBtn, { backgroundColor: '#FF9500' + '15' }]}
                  >
                    <Ionicons name="analytics-outline" size={18} color="#FF9500" />
                    <ThemedText style={[styles.actionButtonText, { color: '#FF9500' }]}>Monitor</ThemedText>
                  </Pressable>
                  
                  <Pressable
                    onPress={() => handleDeleteStaff(staff)}
                    style={[styles.actionButton, styles.staffDeleteBtn, { backgroundColor: '#FF3B30' + '15' }]}
                  >
                    <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                    <ThemedText style={[styles.actionButtonText, { color: '#FF3B30' }]}>Delete</ThemedText>
                  </Pressable>
                </View>
              </View>
            ))
          ) : (
            <View style={[styles.emptyState, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Ionicons name="people-outline" size={40} color={theme.subtext} />
              <ThemedText style={[styles.emptyStateText, { color: theme.subtext }]}>
                No staff members yet
              </ThemedText>
              <ThemedText style={[styles.emptyStateDesc, { color: theme.subtext }]}>
                Staff members will appear here once added
              </ThemedText>
            </View>
          )}
        </View>
        )}

        {/* Logout Button */}
        <Pressable 
          style={[styles.logoutBtn, { borderColor: '#FF4444' }]} 
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={22} color="#FF4444" />
          <ThemedText style={styles.logoutText}>Logout from Admin</ThemedText>
        </Pressable>

        {/* Delete Account Button */}
        <Pressable 
          style={[styles.deleteAccountBtn, { borderColor: '#FF3B30', backgroundColor: '#FF3B30' + '10' }]} 
          onPress={handleDeleteAccount}
        >
          <Ionicons name="trash-outline" size={22} color="#FF3B30" />
          <ThemedText style={[styles.deleteAccountText, { color: '#FF3B30' }]}>Delete Account & Store Permanently</ThemedText>
        </Pressable>

        <View style={{ height: 50 }} />
      </ScrollView>

      {/* PIN Update Modal */}
      <Modal visible={showPinModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <View style={[styles.modalIconBox, { backgroundColor: theme.primary + '15' }]}>
              <Ionicons name="key" size={32} color={theme.primary} />
            </View>

            <ThemedText style={[styles.modalTitle, { color: theme.text }]}>Update Login PIN</ThemedText>
            <ThemedText style={[styles.modalDesc, { color: theme.subtext }]}>
              Enter your current Login PIN and choose a new 4-digit code
            </ThemedText>

            <TextInput
              style={[
                styles.pinInput,
                { color: theme.text, borderColor: theme.border, backgroundColor: theme.background },
              ]}
              placeholder="Current Login PIN"
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
              placeholder="New Login PIN"
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
                <ThemedText style={{ color: theme.text, }}>Cancel</ThemedText>
              </Pressable>
              <Pressable style={[styles.modalBtn, { backgroundColor: theme.primary }]} onPress={handleUpdatePin}>
                <ThemedText style={{ color: '#FFF', }}>Update PIN</ThemedText>
              </Pressable>
            </View>
          </View>
          <ModalToast toast={modalToast} />
        </View>
      </Modal>

      {/* Delete Staff Confirmation Modal */}
      <Modal visible={showDeleteStaffModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <View style={[styles.modalIconBox, { backgroundColor: '#FF3B30' + '15' }]}>
              <Ionicons name="warning" size={32} color="#FF3B30" />
            </View>

            <ThemedText style={[styles.modalTitle, { color: theme.text }]}>
              Delete Staff Member?
            </ThemedText>
            <ThemedText style={[styles.modalDesc, { color: theme.subtext }]}>
              Are you sure you want to remove {staffToDelete?.name}? This action cannot be undone.
            </ThemedText>

            <View style={styles.modalActions}>
              <Pressable
                style={[
                  styles.modalBtn,
                  { backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border },
                ]}
                onPress={() => {
                  setShowDeleteStaffModal(false);
                  setStaffToDelete(null);
                }}
                disabled={deletingStaff}
              >
                <ThemedText style={{ color: theme.text, }}>Cancel</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: '#FF3B30' }]}
                onPress={confirmDeleteStaff}
                disabled={deletingStaff}
              >
                {deletingStaff ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <ThemedText style={{ color: '#FFF', }}>Delete</ThemedText>
                )}
              </Pressable>
            </View>
          </View>
          <ModalToast toast={modalToast} />
        </View>
      </Modal>

      {/* Logout Confirmation Modal */}
      <ConfirmationModal
        visible={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={confirmLogout}
        title="Logout from Admin"
        message="Are you sure you want to logout? You'll need to enter your PIN again to access the admin panel."
        confirmText="Logout"
        type="warning"
      />

      {/* Delete Account Confirmation Modal */}
      <ConfirmationModal
        visible={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setDeleteSecurityPin('');
          setStoreNameConfirmation('');
        }}
        onConfirm={confirmDeleteAccount}
        title="Delete Account & Store"
        message="This will permanently delete your admin account, store, all staff members, and all inventory data. This action cannot be undone."
        confirmText="Delete Everything"
        type="danger"
        requireStoreNameConfirmation={true}
        storeName={user?.storeName || 'Store'}
        onStoreNameChange={setStoreNameConfirmation}
        storeNameValue={storeNameConfirmation}
        requirePinConfirmation={true}
        onPinChange={setDeleteSecurityPin}
        pinValue={deleteSecurityPin}
        pinPlaceholder="Security PIN"
        isLoading={isDeleting}
      />

      {/* PIN Reset Modal */}
      <PinResetModal
        visible={showPinResetModal}
        onClose={() => setShowPinResetModal(false)}
        onSuccess={() => {
          setShowPinResetModal(false);
        }}
      />

      {/* Staff Monitoring Modal - Inline Implementation */}
      <Modal visible={showStaffMonitoringModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={[styles.modalTitle, { color: theme.text }]}>
                Staff Monitoring
              </ThemedText>
              <Pressable onPress={() => {
                setShowStaffMonitoringModal(false);
                setStaffToMonitor(null);
              }} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={theme.subtext} />
              </Pressable>
            </View>
            
            {staffToMonitor && (
              <View style={styles.staffInfo}>
                <ThemedText style={[styles.staffName, { color: theme.text }]}>
                  {staffToMonitor.name}
                </ThemedText>
                <ThemedText style={[styles.staffStatus, { color: staffToMonitor.isActive ? '#34C759' : '#FF3B30' }]}>
                  Status: {staffToMonitor.isActive ? 'Active' : 'Inactive'}
                </ThemedText>
                <ThemedText style={[styles.infoText, { color: theme.subtext }]}>
                  This feature allows you to monitor staff activity without accessing their account directly.
                </ThemedText>
              </View>
            )}
          </View>
          <ModalToast toast={modalToast} />
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
    <ThemedText style={[styles.permissionLabel, { color: granted ? theme.text : theme.subtext }]}>{label}</ThemedText>
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
    },
  profileCard: {
    padding: 30,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: 'center',
    marginBottom: 30,
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
    letterSpacing: 0.5,
  },
  userId: {
    fontSize: 12,
    marginBottom: 10,
  },
  storeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  storeText: {
    fontSize: 12,
    },
  section: {
    marginBottom: 30,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 12,
    letterSpacing: 1.5,
  },
  addStaffBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  addStaffBtnText: {
    color: '#FFF',
    fontSize: 13,
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
    marginBottom: 2,
  },
  settingDesc: {
    fontSize: 12,
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
    },
  staffCard: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
  },
  staffMainInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  staffAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  staffDetails: {
    flex: 1,
  },
  staffName: {
    fontSize: 18,
    marginBottom: 8,
  },
  staffMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 6,
  },
  staffRoleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  staffRoleText: {
    fontSize: 11,
    textTransform: 'uppercase',
  },
  staffStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  staffStatusText: {
    fontSize: 11,
    },
  staffLastLogin: {
    fontSize: 12,
    },
  staffActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  actionButtonText: {
    fontSize: 10,
    },
  permissionsBtn: {
    // Specific styles for permissions button if needed
  },
  monitorBtn: {
    // Specific styles for monitor button if needed
  },
  staffDeleteBtn: {
    // Specific styles for staff delete button if needed
  },
  emptyState: {
    padding: 40,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    marginTop: 16,
    marginBottom: 6,
  },
  emptyStateDesc: {
    fontSize: 12,
    textAlign: 'center',
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
    marginBottom: 20,
  },
  logoutText: {
    color: '#FF4444',
    fontSize: 14,
  },
  deleteAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 16,
    borderRadius: 20,
    borderWidth: 2,
    marginTop: 12,
  },
  deleteAccountText: {
    fontSize: 14,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
    width: '100%',
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
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
    fontSize: 15,
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
  modalContentLarge: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    padding: 30,
    borderRadius: 30,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  permissionsScroll: {
    maxHeight: 400,
    marginBottom: 20,
  },
  permissionEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    gap: 12,
  },
  permIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  permTextBox: {
    flex: 1,
  },
  permLabel: {
    fontSize: 14,
    marginBottom: 2,
  },
  permDesc: {
    fontSize: 11,
    lineHeight: 14,
  },
  // Staff Monitoring Modal Styles
  closeButton: {
    padding: 8,
  },
  staffInfo: {
    paddingVertical: 10,
  },
  staffStatus: {
    fontSize: 14,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
  },
});

