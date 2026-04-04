import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from "react-native";
import Toast from 'react-native-toast-message';
import { PinInput } from '../../components/PinInput';
import { useTheme } from '../../context/ThemeContext';

type RegistrationStep = 'name' | 'permissions' | 'pin' | 'complete';

interface Permissions {
  viewInventory: boolean;
  addProducts: boolean;
  editProducts: boolean;
  deleteProducts: boolean;
  processSales: boolean;
  scanBarcodes: boolean;
  viewAnalytics: boolean;
  exportData: boolean;
  manageCategories: boolean;
}

export default function StaffRegisterScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  
  const [step, setStep] = useState<RegistrationStep>('name');
  const [staffName, setStaffName] = useState('');
  const [staffPin, setStaffPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [isFirstPin, setIsFirstPin] = useState(true);
  const [pinKey, setPinKey] = useState(0);
  
  // Permissions state
  const [permissions, setPermissions] = useState<Permissions>({
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

  const handlePinComplete = async (pin: string) => {
    if (isFirstPin) {
      setStaffPin(pin);
      setIsFirstPin(false);
      setPinError(false);
      setPinKey(prev => prev + 1);
    } else {
      if (pin === staffPin) {
        try {
          const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/api';
          const adminId = await AsyncStorage.getItem('auth_user_id');
          
          const requestData = {
            name: staffName,
            pin: pin,
            createdBy: adminId,
            permissions: permissions
          };
          
          const response = await axios.post(`${API_URL}/auth/staff`, requestData);

          if (response.data.success) {
            const staffId = response.data.data.user.id;
            
            await AsyncStorage.multiSet([
              ['auth_staff_pin', pin],
              ['auth_staff_id', staffId],
              ['auth_staff_name', staffName],
            ]);

            Toast.show({
              type: 'success',
              text1: 'Staff Added',
              text2: `${staffName} has been registered successfully`,
            });

            setStep('complete');
          } else {
            throw new Error('Backend returned unsuccessful response');
          }
        } catch (error: any) {
          let errorMessage = 'Could not create staff account';
          
          if (error.response) {
            const status = error.response.status;
            const serverError = error.response.data?.error;
            
            if (status === 401) {
              errorMessage = 'Authentication failed - please log in again';
            } else if (status === 403) {
              errorMessage = 'You do not have permission to add staff';
            } else if (status === 400) {
              errorMessage = serverError || 'Invalid staff information';
            } else if (status >= 500) {
              errorMessage = 'Server error - please try again later';
            } else {
              errorMessage = serverError || errorMessage;
            }
          }
          
          Toast.show({
            type: 'error',
            text1: 'Registration Failed',
            text2: errorMessage,
            visibilityTime: 4000,
          });
          
          setPinError(true);
          setIsFirstPin(true);
          setStaffPin('');
          setConfirmPin('');
          setPinKey(prev => prev + 1);
        }
      } else {
        setPinError(true);
        setIsFirstPin(true);
        setStaffPin('');
        setConfirmPin('');
        setPinKey(prev => prev + 1);
      }
    }
  };

  const handleContinue = () => {
    if (step === 'name') {
      if (!staffName.trim()) {
        Toast.show({
          type: 'error',
          text1: 'Name Required',
          text2: 'Please enter staff member name',
        });
        return;
      }
      setStep('permissions');
    } else if (step === 'permissions') {
      setStep('pin');
    } else if (step === 'complete') {
      router.replace('/admin/settings' as any);
    }
  };

  const handleBack = () => {
    if (step === 'permissions') {
      setStep('name');
    } else if (step === 'pin') {
      setStep('permissions');
      setIsFirstPin(true);
      setStaffPin('');
      setConfirmPin('');
      setPinError(false);
      setPinKey(prev => prev + 1);
    } else {
      router.replace('/admin/settings' as any);
    }
  };

  const togglePermission = (key: keyof Permissions) => {
    setPermissions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const permissionsList = [
    { key: 'viewInventory' as keyof Permissions, label: 'View Inventory', icon: 'eye-outline', description: 'View all products and stock levels' },
    { key: 'addProducts' as keyof Permissions, label: 'Add Products', icon: 'add-circle-outline', description: 'Add new products and batches' },
    { key: 'editProducts' as keyof Permissions, label: 'Edit Products', icon: 'create-outline', description: 'Modify product details and prices' },
    { key: 'deleteProducts' as keyof Permissions, label: 'Delete Products', icon: 'trash-outline', description: 'Remove products from inventory' },
    { key: 'processSales' as keyof Permissions, label: 'Process Sales', icon: 'cart-outline', description: 'Complete sales transactions' },
    { key: 'scanBarcodes' as keyof Permissions, label: 'Scan Barcodes', icon: 'scan-outline', description: 'Use barcode scanner' },
    { key: 'viewAnalytics' as keyof Permissions, label: 'View Analytics', icon: 'analytics-outline', description: 'Access sales reports and insights' },
    { key: 'exportData' as keyof Permissions, label: 'Export Data', icon: 'download-outline', description: 'Export inventory and sales data' },
    { key: 'manageCategories' as keyof Permissions, label: 'Manage Categories', icon: 'folder-outline', description: 'Add and edit product categories' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <KeyboardAvoidingView 
        style={[styles.container, { backgroundColor: theme.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Pressable style={styles.backButton} onPress={handleBack}>
              <Ionicons name="arrow-back" size={24} color={theme.primary} />
            </Pressable>
            <Text style={[styles.headerTitle, { color: theme.text }]}>
              Add Staff Member
            </Text>
          </View>

          {/* Content */}
          <View style={styles.content}>
            {step === 'name' && (
              <>
                <View style={[styles.iconCircle, { backgroundColor: theme.primary + '15' }]}>
                  <Ionicons name="person-add" size={48} color={theme.primary} />
                </View>
                <Text style={[styles.title, { color: theme.text }]}>
                  Staff Information
                </Text>
                <Text style={[styles.subtitle, { color: theme.subtext }]}>
                  Enter the name of the staff member
                </Text>

                <TextInput
                  style={[
                    styles.nameInput,
                    { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface },
                  ]}
                  placeholder="Staff member name"
                  placeholderTextColor={theme.subtext}
                  value={staffName}
                  onChangeText={setStaffName}
                  autoFocus
                />

                <View style={[styles.infoCard, { backgroundColor: theme.primary + '10', borderColor: theme.primary }]}>
                  <Ionicons name="information-circle" size={20} color={theme.primary} />
                  <Text style={[styles.infoText, { color: theme.text }]}>
                    You'll set specific permissions for this staff member in the next step.
                  </Text>
                </View>
              </>
            )}

            {step === 'permissions' && (
              <>
                <View style={[styles.iconCircle, { backgroundColor: theme.primary + '15' }]}>
                  <Ionicons name="shield-checkmark" size={48} color={theme.primary} />
                </View>
                <Text style={[styles.title, { color: theme.text }]}>
                  Set Permissions
                </Text>
                <Text style={[styles.subtitle, { color: theme.subtext }]}>
                  Choose what {staffName} can do
                </Text>

                <View style={styles.permissionsContainer}>
                  {permissionsList.map((perm) => (
                    <View
                      key={perm.key}
                      style={[
                        styles.permissionRow,
                        { backgroundColor: theme.surface, borderColor: theme.border }
                      ]}
                    >
                      <View style={[styles.permIconBox, { backgroundColor: theme.primary + '15' }]}>
                        <Ionicons name={perm.icon as any} size={20} color={theme.primary} />
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
                        value={permissions[perm.key]}
                        onValueChange={() => togglePermission(perm.key)}
                        trackColor={{ true: theme.primary, false: theme.border }}
                      />
                    </View>
                  ))}
                </View>
              </>
            )}

            {step === 'pin' && (
              <>
                <View style={[styles.iconCircle, { backgroundColor: theme.primary + '15' }]}>
                  <Ionicons name="key" size={48} color={theme.primary} />
                </View>
                <Text style={[styles.title, { color: theme.text }]}>
                  {isFirstPin ? 'Create Staff PIN' : 'Confirm PIN'}
                </Text>
                <Text style={[styles.subtitle, { color: theme.subtext }]}>
                  {isFirstPin
                    ? 'Choose a 4-digit PIN for this staff member'
                    : 'Enter the PIN again to confirm'}
                </Text>

                <View style={styles.pinContainer}>
                  <PinInput
                    key={pinKey}
                    onComplete={handlePinComplete}
                    error={pinError}
                    onClear={() => {
                      setPinError(false);
                      if (!isFirstPin) {
                        setIsFirstPin(true);
                        setStaffPin('');
                        setConfirmPin('');
                        setPinKey(prev => prev + 1);
                      }
                    }}
                  />
                  {pinError && (
                    <Text style={[styles.errorText, { color: theme.notification }]}>
                      PINs don't match. Please try again.
                    </Text>
                  )}
                </View>

                <View style={[styles.warningCard, { backgroundColor: '#FF9500' + '10', borderColor: '#FF9500' }]}>
                  <Ionicons name="warning" size={20} color="#FF9500" />
                  <Text style={[styles.warningText, { color: theme.text }]}>
                    Make sure to share this PIN securely with the staff member. It cannot be recovered if lost.
                  </Text>
                </View>
              </>
            )}

            {step === 'complete' && (
              <>
                <View style={[styles.iconCircle, { backgroundColor: '#34C759' + '15' }]}>
                  <Ionicons name="checkmark-circle" size={64} color="#34C759" />
                </View>
                <Text style={[styles.title, { color: theme.text }]}>
                  Staff Added!
                </Text>
                <Text style={[styles.subtitle, { color: theme.subtext }]}>
                  {staffName} can now log in with their PIN
                </Text>

                <View style={[styles.summaryCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { color: theme.subtext }]}>Name:</Text>
                    <Text style={[styles.summaryValue, { color: theme.text }]}>{staffName}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { color: theme.subtext }]}>Role:</Text>
                    <Text style={[styles.summaryValue, { color: theme.text }]}>Staff</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { color: theme.subtext }]}>PIN:</Text>
                    <Text style={[styles.summaryValue, { color: theme.text }]}>••••</Text>
                  </View>
                </View>

                <View style={[styles.permissionsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Text style={[styles.permissionsTitle, { color: theme.text }]}>
                    Assigned Permissions
                  </Text>
                  <View style={styles.permissionsList}>
                    {permissionsList.map((perm) => (
                      <View key={perm.key} style={styles.permissionItem}>
                        <Ionicons
                          name={permissions[perm.key] ? 'checkmark-circle' : 'close-circle'}
                          size={20}
                          color={permissions[perm.key] ? '#34C759' : '#FF3B30'}
                        />
                        <Text
                          style={[
                            styles.permissionText,
                            { color: permissions[perm.key] ? theme.text : theme.subtext }
                          ]}
                        >
                          {perm.label}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              </>
            )}
          </View>

          {/* Footer Button */}
          {(step === 'name' || step === 'permissions' || step === 'complete') && (
            <View style={styles.footer}>
              <Pressable
                style={[styles.continueButton, { backgroundColor: theme.primary }]}
                onPress={handleContinue}
              >
                <Text style={styles.continueText}>
                  {step === 'complete' ? 'Done' : 'Continue'}
                </Text>
                <Ionicons
                  name={step === 'complete' ? 'checkmark' : 'arrow-forward'}
                  size={20}
                  color="#FFF"
                />
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  backButton: {
    padding: 10,
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '900',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    marginBottom: 30,
    textAlign: 'center',
    lineHeight: 22,
  },
  nameInput: {
    width: '100%',
    height: 55,
    borderWidth: 2,
    borderRadius: 15,
    paddingHorizontal: 20,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 20,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    width: '100%',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  permissionsContainer: {
    width: '100%',
    gap: 12,
  },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  permIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  permTextBox: {
    flex: 1,
  },
  permLabel: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  permDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  pinContainer: {
    alignItems: 'center',
    gap: 16,
    marginBottom: 20,
  },
  errorText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    width: '100%',
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  summaryCard: {
    width: '100%',
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
    gap: 12,
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  permissionsCard: {
    width: '100%',
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
  },
  permissionsTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 16,
  },
  permissionsList: {
    gap: 12,
  },
  permissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  permissionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: 30,
    paddingVertical: 20,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
  },
  continueText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '800',
  },
});
