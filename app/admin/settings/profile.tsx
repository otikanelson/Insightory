import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    View
} from "react-native";
import Toast from 'react-native-toast-message';
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
    viewInventory?: boolean;
    addProducts?: boolean;
    editProducts?: boolean;
    deleteProducts?: boolean;
    processSales?: boolean;
    scanBarcodes?: boolean;
    viewAnalytics?: boolean;
    exportData?: boolean;
    manageCategories?: boolean;
  };
}

export default function AdminProfileScreen() {
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const { user, role, logout } = useAuth();

  const [showPinModal, setShowPinModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteSecurityPin, setDeleteSecurityPin] = useState('');
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  
  // Staff deletion state
  const [showDeleteStaffModal, setShowDeleteStaffModal] = useState(false);
  const [staffToDelete, setStaffToDelete] = useState<StaffMember | null>(null);
  const [deletingStaff, setDeletingStaff] = useState(false);
  
  // Staff edit permissions state
  const [showEditPermissionsModal, setShowEditPermissionsModal] = useState(false);
  const [staffToEdit, setStaffToEdit] = useState<StaffMember | null>(null);
  const [editPermissions, setEditPermissions] = useState({
    viewInventory: true,
    addProducts: true,
    editProducts: true,
    deleteProducts: false,
    processSales: true,
    scanBarcodes: true,
    viewAnalytics: false,
    exportData: false,
    manageCategories: false,
  });
  const [savingPermissions, setSavingPermissions] = useState(false);

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

  const handleEditPermissions = (staff: StaffMember) => {
    setStaffToEdit(staff);
    setEditPermissions(staff.permissions || {
      viewInventory: true,
      addProducts: true,
      editProducts: true,
      deleteProducts: false,
      processSales: true,
      scanBarcodes: true,
      viewAnalytics: false,
      exportData: false,
      manageCategories: false,
    });
    setShowEditPermissionsModal(true);
  };

  const toggleEditPermission = (key: keyof typeof editPermissions) => {
    setEditPermissions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const savePermissions = async () => {
    if (!staffToEdit) return;

    setSavingPermissions(true);
    try {
      const response = await axios.patch(
        `${process.env.EXPO_PUBLIC_API_URL}/auth/staff/${staffToEdit._id}/permissions`,
        { permissions: editPermissions }
      );

      if (response.data.success) {
        showSuccessToast("Permissions Updated", `${staffToEdit.name}'s permissions have been updated`);
        await fetchStaffMembers();
        setShowEditPermissionsModal(false);
        setStaffToEdit(null);
      } else {
        throw new Error(response.data.error || 'Failed to update permissions');
      }
    } catch (error: any) {
      console.error('Error updating permissions:', error);
      showErrorToast(error, "Update Failed");
    } finally {
      setSavingPermissions(false);
    }
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

  const handleImpersonateStaff = async (staff: StaffMember) => {
    try {
      console.log('🎭 Impersonating staff:', staff.name);
      
      // Store admin session before impersonating
      const adminUserId = await AsyncStorage.getItem('auth_user_id');
      const adminUserName = await AsyncStorage.getItem('auth_user_name');
      const adminStoreId = await AsyncStorage.getItem('auth_store_id');
      const adminStoreName = await AsyncStorage.getItem('auth_store_name');
      const adminSessionToken = await AsyncStorage.getItem('auth_session_token');
      
      const response = await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL}/auth/staff/${staff._id}/impersonate`
      );

      if (response.data.success) {
        const { user: staffUser, sessionToken } = response.data.data;
        
        // Store admin session for later restoration
        await AsyncStorage.multiSet([
          ['impersonation_active', 'true'],
          ['impersonation_view_only', 'true'], // SET VIEW-ONLY FLAG
          ['impersonation_admin_id', adminUserId || ''],
          ['impersonation_admin_name', adminUserName || ''],
          ['impersonation_admin_store_id', adminStoreId || ''],
          ['impersonation_admin_store_name', adminStoreName || ''],
          ['impersonation_admin_token', adminSessionToken || ''],
        ]);
        
        // Save the new staff session
        await AsyncStorage.multiSet([
          ['auth_session_token', sessionToken],
          ['auth_user_role', staffUser.role],
          ['auth_user_id', staffUser.id],
          ['auth_user_name', staffUser.name],
          ['auth_store_id', staffUser.storeId || ''],
          ['auth_store_name', staffUser.storeName || ''],
        ]);
        
        showSuccessToast("View-Only Mode", `Now viewing as ${staff.name} (read-only)`);
        
        // Navigate to staff dashboard (tabs)
        router.replace('/(tabs)');
      } else {
        throw new Error(response.data.error || 'Failed to impersonate staff');
      }
    } catch (error: any) {
      console.error('Error impersonating staff:', error);
      showErrorToast(error, "Impersonation Failed");
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

      // Get stored Login PIN
      const storedPin = await AsyncStorage.getItem('admin_login_pin');

      // Validate old PIN
      if (oldPin !== storedPin) {
        Toast.show({
          type: 'error',
          text1: 'Authentication Failed',
          text2: 'Current PIN is incorrect',
        });
        return;
      }

      // Update Login PIN
      await AsyncStorage.setItem('admin_login_pin', newPin);

      Toast.show({
        type: 'success',
        text1: 'Login PIN Updated',
        text2: 'Your Login PIN has been changed successfully',
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

  const handleLogout = async () => {
    await logout();
    router.replace('/auth/setup' as any);
  };

  const handleDeleteAccount = async () => {
    try {
      if (!deleteSecurityPin || deleteSecurityPin.length !== 4) {
        Toast.show({
          type: 'error',
          text1: 'Invalid PIN',
          text2: 'Please enter your 4-digit Security PIN',
        });
        return;
      }

      // Get stored Security PIN
      const storedSecurityPin = await AsyncStorage.getItem('admin_security_pin');
      
      if (deleteSecurityPin !== storedSecurityPin) {
        Toast.show({
          type: 'error',
          text1: 'Authentication Failed',
          text2: 'Incorrect Security PIN',
        });
        return;
      }

      // Call backend to delete account
      const API_URL = process.env.EXPO_PUBLIC_API_URL;
      const token = await AsyncStorage.getItem('auth_session_token');
      
      const response = await fetch(`${API_URL}/auth/admin/account`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ pin: deleteSecurityPin }),
      });

      const data = await response.json();

      if (data.success) {
        Toast.show({
          type: 'success',
          text1: 'Account Deleted',
          text2: 'Your account, store, and all data have been permanently deleted',
        });

        // Clear all local data
        await AsyncStorage.clear();

        // Navigate to setup
        setTimeout(() => {
          router.replace('/auth/setup' as any);
        }, 2000);
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

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flex: 1, backgroundColor: theme.background }}>
      

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.push('/admin/settings')} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Profile</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Profile Card */}
        <View style={[styles.profileCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={[styles.avatarContainer, { backgroundColor: '#FF3B30' + '20' }]}>
            <Ionicons name="person" size={48} color="#FF3B30" />
          </View>

          <Text style={[styles.userName, { color: theme.text }]}>
            {user?.name || 'User'}
          </Text>

          <View style={[styles.roleBadge, { backgroundColor: '#FF3B30' + '20' }]}>
            <Ionicons name="shield-checkmark" size={16} color="#FF3B30" />
            <Text style={[styles.roleText, { color: '#FF3B30' }]}>Administrator</Text>
          </View>

          <Text style={[styles.userId, { color: theme.subtext }]}>
            ID: {user?.id || 'N/A'}
          </Text>
          
          <View style={[styles.storeInfo, { backgroundColor: theme.primary + '10', borderColor: theme.primary + '30' }]}>
            <Ionicons name="storefront" size={16} color={theme.primary} />
            <Text style={[styles.storeText, { color: theme.text }]}>
              {user?.storeName || 'Store'}
            </Text>
          </View>
        </View>

        {/* Account Settings */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.primary }]}>ACCOUNT SETTINGS</Text>

          <Pressable
            style={[styles.settingRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => setShowPinModal(true)}
          >
            <View style={[styles.iconBox, { backgroundColor: theme.primary + '15' }]}>
              <Ionicons name="key-outline" size={22} color={theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingLabel, { color: theme.text }]}>Change Login PIN</Text>
              <Text style={[styles.settingDesc, { color: theme.subtext }]}>Update your 4-digit login code</Text>
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
              <Text style={[styles.settingLabel, { color: theme.text }]}>Security Settings</Text>
              <Text style={[styles.settingDesc, { color: theme.subtext }]}>Manage Security PIN and access controls</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.subtext} />
          </Pressable>
        </View>

        {/* Permissions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.primary }]}>ADMIN PERMISSIONS</Text>

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
            <Text style={[styles.sectionTitle, { color: theme.primary }]}>STAFF MEMBERS</Text>
            <Pressable
              onPress={() => router.push('/auth/staff-register')}
              style={[styles.addStaffBtn, { backgroundColor: theme.primary }]}
            >
              <Ionicons name="person-add" size={18} color="#FFF" />
              <Text style={styles.addStaffBtnText}>Add Staff</Text>
            </Pressable>
          </View>

          {loadingStaff ? (
            <View style={[styles.settingRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <ActivityIndicator size="small" color={theme.primary} />
              <Text style={[styles.settingDesc, { color: theme.subtext, marginLeft: 12 }]}>
                Loading staff members...
              </Text>
            </View>
          ) : staffMembers.length > 0 ? (
            staffMembers.map((staff) => (
              <Pressable
                key={staff._id}
                onPress={() => handleImpersonateStaff(staff)}
                style={[styles.staffCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
              >
                <View style={[styles.staffAvatar, { backgroundColor: '#007AFF' + '20' }]}>
                  <Ionicons name="person" size={20} color="#007AFF" />
                </View>
                
                <View style={{ flex: 1 }}>
                  <Text style={[styles.staffName, { color: theme.text }]}>{staff.name}</Text>
                  <View style={styles.staffMeta}>
                    <View style={[styles.staffRoleBadge, { backgroundColor: '#007AFF' + '15' }]}>
                      <Text style={[styles.staffRoleText, { color: '#007AFF' }]}>Staff</Text>
                    </View>
                    {staff.lastLogin && (
                      <Text style={[styles.staffLastLogin, { color: theme.subtext }]}>
                        Last login: {new Date(staff.lastLogin).toLocaleDateString()}
                      </Text>
                    )}
                  </View>
                  <Text style={[styles.tapToLogin, { color: theme.primary }]}>
                    Tap to login as {staff.name}
                  </Text>
                </View>

                <View style={styles.staffActions}>
                  <View style={[styles.staffStatusDot, { backgroundColor: staff.isActive ? '#34C759' : '#FF3B30' }]} />
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      handleEditPermissions(staff);
                    }}
                    style={[styles.editStaffBtn, { backgroundColor: theme.primary + '15' }]}
                  >
                    <Ionicons name="settings-outline" size={16} color={theme.primary} />
                  </Pressable>
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      handleDeleteStaff(staff);
                    }}
                    style={[styles.deleteStaffBtn, { backgroundColor: '#FF3B30' + '15' }]}
                  >
                    <Ionicons name="trash-outline" size={16} color="#FF3B30" />
                  </Pressable>
                </View>
              </Pressable>
            ))
          ) : (
            <View style={[styles.emptyState, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Ionicons name="people-outline" size={40} color={theme.subtext} />
              <Text style={[styles.emptyStateText, { color: theme.subtext }]}>
                No staff members yet
              </Text>
              <Text style={[styles.emptyStateDesc, { color: theme.subtext }]}>
                Staff members will appear here once added
              </Text>
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
          <Text style={styles.logoutText}>Logout from Admin</Text>
        </Pressable>

        {/* Delete Account Button */}
        <Pressable 
          style={[styles.deleteBtn, { borderColor: '#FF3B30', backgroundColor: '#FF3B30' + '10' }]} 
          onPress={() => setShowDeleteModal(true)}
        >
          <Ionicons name="trash-outline" size={22} color="#FF3B30" />
          <Text style={[styles.deleteText, { color: '#FF3B30' }]}>Delete Account & Store Permanently</Text>
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

            <Text style={[styles.modalTitle, { color: theme.text }]}>Update Login PIN</Text>
            <Text style={[styles.modalDesc, { color: theme.subtext }]}>
              Enter your current Login PIN and choose a new 4-digit code
            </Text>

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
                <Text style={{ color: theme.text, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.modalBtn, { backgroundColor: theme.primary }]} onPress={handleUpdatePin}>
                <Text style={{ color: '#FFF', fontWeight: '700' }}>Update PIN</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Staff Confirmation Modal */}
      <Modal visible={showDeleteStaffModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <View style={[styles.modalIconBox, { backgroundColor: '#FF3B30' + '15' }]}>
              <Ionicons name="warning" size={32} color="#FF3B30" />
            </View>

            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Delete Staff Member?
            </Text>
            <Text style={[styles.modalDesc, { color: theme.subtext }]}>
              Are you sure you want to remove {staffToDelete?.name}? This action cannot be undone.
            </Text>

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
                <Text style={{ color: theme.text, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: '#FF3B30' }]}
                onPress={confirmDeleteStaff}
                disabled={deletingStaff}
              >
                {deletingStaff ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={{ color: '#FFF', fontWeight: '700' }}>Delete</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Permissions Modal */}
      <Modal visible={showEditPermissionsModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContentLarge, { backgroundColor: theme.surface }]}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalIconBox, { backgroundColor: theme.primary + '15' }]}>
                <Ionicons name="shield-checkmark" size={28} color={theme.primary} />
              </View>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                Edit Permissions
              </Text>
              <Text style={[styles.modalDesc, { color: theme.subtext }]}>
                Manage what {staffToEdit?.name} can do
              </Text>
            </View>

            <ScrollView style={styles.permissionsScroll} showsVerticalScrollIndicator={false}>
              {[
                { key: 'viewInventory', label: 'View Inventory', icon: 'eye-outline', description: 'View all products and stock levels' },
                { key: 'addProducts', label: 'Add Products', icon: 'add-circle-outline', description: 'Add new products and batches' },
                { key: 'editProducts', label: 'Edit Products', icon: 'create-outline', description: 'Modify product details and prices' },
                { key: 'deleteProducts', label: 'Delete Products', icon: 'trash-outline', description: 'Remove products from inventory' },
                { key: 'processSales', label: 'Process Sales', icon: 'cart-outline', description: 'Complete sales transactions' },
                { key: 'scanBarcodes', label: 'Scan Barcodes', icon: 'scan-outline', description: 'Use barcode scanner' },
                { key: 'viewAnalytics', label: 'View Analytics', icon: 'analytics-outline', description: 'Access sales reports and insights' },
                { key: 'exportData', label: 'Export Data', icon: 'download-outline', description: 'Export inventory and sales data' },
                { key: 'manageCategories', label: 'Manage Categories', icon: 'folder-outline', description: 'Add and edit product categories' },
              ].map((perm) => (
                <View
                  key={perm.key}
                  style={[
                    styles.permissionEditRow,
                    { backgroundColor: theme.background, borderColor: theme.border }
                  ]}
                >
                  <View style={[styles.permIconBox, { backgroundColor: theme.primary + '15' }]}>
                    <Ionicons name={perm.icon as any} size={18} color={theme.primary} />
                  </View>
                  <View style={styles.permTextBox}>
                    <Text style={[styles.permLabel, { color: theme.text }]}>
                      {perm.label}
                    </Text>
                    <Text style={[styles.permDesc, { color: theme.subtext }]}>
                      {perm.description}
                    </Text>
                  </View>
                  <Switch
                    value={editPermissions[perm.key as keyof typeof editPermissions]}
                    onValueChange={() => toggleEditPermission(perm.key as keyof typeof editPermissions)}
                    trackColor={{ true: theme.primary, false: theme.border }}
                  />
                </View>
              ))}
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable
                style={[
                  styles.modalBtn,
                  { backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border },
                ]}
                onPress={() => {
                  setShowEditPermissionsModal(false);
                  setStaffToEdit(null);
                }}
                disabled={savingPermissions}
              >
                <Text style={{ color: theme.text, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: theme.primary }]}
                onPress={savePermissions}
                disabled={savingPermissions}
              >
                {savingPermissions ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={{ color: '#FFF', fontWeight: '700' }}>Save Changes</Text>
                )}
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

            <Text style={[styles.modalTitle, { color: theme.text }]}>Delete Account & Store?</Text>
            <Text style={[styles.modalDesc, { color: theme.subtext }]}>
              This will permanently delete your admin account, store, all staff members, and all inventory data. This action cannot be undone.
            </Text>

            <View style={[styles.warningBox, { backgroundColor: '#FF3B30' + '10', borderColor: '#FF3B30' }]}>
              <Ionicons name="alert-circle" size={18} color="#FF3B30" />
              <Text style={[styles.warningText, { color: theme.text }]}>
                All staff accounts and inventory will be deleted
              </Text>
            </View>

            <TextInput
              style={[
                styles.pinInput,
                { color: theme.text, borderColor: '#FF3B30', backgroundColor: theme.background },
              ]}
              placeholder="Enter Security PIN to confirm"
              placeholderTextColor={theme.subtext}
              secureTextEntry
              keyboardType="numeric"
              maxLength={4}
              value={deleteSecurityPin}
              onChangeText={setDeleteSecurityPin}
            />

            <View style={styles.modalActions}>
              <Pressable
                style={[
                  styles.modalBtn,
                  { backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border },
                ]}
                onPress={() => {
                  setShowDeleteModal(false);
                  setDeleteSecurityPin('');
                }}
              >
                <Text style={{ color: theme.text, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              <Pressable 
                style={[styles.modalBtn, { backgroundColor: '#FF3B30' }]} 
                onPress={handleDeleteAccount}
              >
                <Text style={{ color: '#FFF', fontWeight: '700' }}>Delete Everything</Text>
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
    fontWeight: '700',
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
    fontWeight: '800',
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
    fontWeight: '700',
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
  staffCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  staffAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  staffName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  staffMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  staffRoleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  staffRoleText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  tapToLogin: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  staffLastLogin: {
    fontSize: 11,
    fontWeight: '600',
  },
  staffStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  staffActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  editStaffBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteStaffBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    padding: 40,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 6,
  },
  emptyStateDesc: {
    fontSize: 12,
    fontWeight: '500',
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
    fontWeight: '600',
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
  modalContentLarge: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    padding: 30,
    borderRadius: 30,
  },
  modalHeader: {
    alignItems: 'center',
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
    fontWeight: '700',
    marginBottom: 2,
  },
  permDesc: {
    fontSize: 11,
    lineHeight: 14,
  },
});
