import { useSetupGuide } from '@/context/SetupGuideContext';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View
} from "react-native";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { PinInput } from '../../components/PinInput';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '../../context/ThemeContext';

type RegistrationStep = 'store-verify' | 'name' | 'permissions' | 'pin' | 'complete';

interface Permissions {
  viewProducts: boolean;
  scanProducts: boolean;
  registerProducts: boolean;
  addProducts: boolean;
  processSales: boolean;
}

export default function StaffRegisterScreen() {
  const { theme } = useTheme();
  const { showStep, isActive, startGuide } = useSetupGuide();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [step, setStep] = useState<RegistrationStep>('store-verify');

  // Auto-start guide when component mounts
  useEffect(() => {
    // Small delay to ensure layout is ready
    const timer = setTimeout(() => {
      startGuide('staff');
      showStep('store-verify');
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  // Handle Android back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === 'store-verify') {
        // Go back to setup page
        router.back();
        return true;
      } else {
        // Navigate back through steps
        handleBack();
        return true;
      }
    });

    return () => backHandler.remove();
  }, [step]);

  const goToStep = (s: RegistrationStep) => {
    setStep(s);
    if (isActive) showStep(s);
  };
  const [storeName, setStoreName] = useState('');
  const [adminLoginPin, setAdminLoginPin] = useState('');
  const [adminPinKey, setAdminPinKey] = useState(0);
  const [verifyingStore, setVerifyingStore] = useState(false);
  const [staffName, setStaffName] = useState('');
  const [staffPin, setStaffPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [isFirstPin, setIsFirstPin] = useState(true);
  const [pinKey, setPinKey] = useState(0);
  
  // Permissions state
  const [permissions, setPermissions] = useState<Permissions>({
    viewProducts: true,
    scanProducts: true,
    registerProducts: true,
    addProducts: true,
    processSales: true,
  });

  const handlePinComplete = async (pin: string) => {
    if (isFirstPin) {
      setStaffPin(pin);
      setIsFirstPin(false);
      setPinError(false);
      setPinKey(prev => prev + 1);
    } else {
      if (pin === staffPin) {
        // Validate PIN strength (basic check)
        if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
          setPinError(true);
          setIsFirstPin(true);
          setStaffPin('');
          setPinKey(prev => prev + 1);
          Toast.show({
            type: 'error',
            text1: 'Invalid PIN',
            text2: 'PIN must be exactly 4 digits',
            visibilityTime: 3000,
          });
          return;
        }

        try {
          const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/api';
          
          const requestData = {
            name: staffName,
            pin: pin,
            storeName: storeName.trim(),
            adminLoginPin: adminLoginPin,
            permissions: permissions
          };
          
          const response = await axios.post(`${API_URL}/auth/staff/join`, requestData);

          if (response.data.success) {
            const staffId = response.data.data.user.id;
            const staffStoreId = response.data.data.user.storeId;
            
            await AsyncStorage.multiSet([
              ['auth_staff_pin', pin],
              ['auth_staff_id', staffId],
              ['auth_staff_name', staffName],
              ['auth_store_id', staffStoreId ? staffStoreId.toString() : ''],
            ]);

            Toast.show({
              type: 'success',
              text1: 'Staff Added',
              text2: `${staffName} has been registered successfully`,
            });

            goToStep('complete');
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
          setPinKey(prev => prev + 1);
        }
      } else {
        setPinError(true);
        setIsFirstPin(true);
        setStaffPin('');
        setPinKey(prev => prev + 1);
      }
    }
  };

  const handleContinue = () => {
    if (step === 'store-verify') {
      if (!storeName.trim()) {
        Toast.show({ type: 'error', text1: 'Store Name Required', text2: 'Please enter the store name' });
        return;
      }
      // admin PIN is collected via PinInput, handled in handleAdminPinComplete
    } else if (step === 'name') {
      if (!staffName.trim()) {
        Toast.show({
          type: 'error',
          text1: 'Name Required',
          text2: 'Please enter staff member name',
        });
        return;
      }
      goToStep('permissions');
    } else if (step === 'permissions') {
      goToStep('pin');
    } else if (step === 'complete') {
      router.replace('/auth/login' as any);
    }
  };

  const handleAdminPinComplete = async (pin: string) => {
    if (!storeName.trim()) {
      Toast.show({ type: 'error', text1: 'Store Name Required', text2: 'Enter the store name first' });
      setAdminPinKey(prev => prev + 1);
      return;
    }
    setVerifyingStore(true);
    try {
      const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/api';
      // Verify store + admin PIN combo exists
      const response = await axios.post(`${API_URL}/auth/staff/verify-store`, {
        storeName: storeName.trim(),
        adminLoginPin: pin,
      });
      if (response.data.success) {
        setAdminLoginPin(pin);
        goToStep('name');
      } else {
        Toast.show({ type: 'error', text1: 'Verification Failed', text2: response.data.error || 'Invalid store or admin PIN' });
        setAdminPinKey(prev => prev + 1);
      }
    } catch (error: any) {
      const msg = error.response?.data?.error || 'Invalid store name or admin PIN';
      Toast.show({ type: 'error', text1: 'Verification Failed', text2: msg });
      setAdminPinKey(prev => prev + 1);
    } finally {
      setVerifyingStore(false);
    }
  };

  const handleBack = () => {
    if (step === 'store-verify') {
      router.back(); // Go back to setup page
    } else if (step === 'name') {
      setStep('store-verify');
      setAdminLoginPin('');
      setAdminPinKey(prev => prev + 1);
      showStep('store-verify');
    } else if (step === 'pin') {
      goToStep('permissions');
      setIsFirstPin(true);
      setStaffPin('');
      setPinError(false);
      setPinKey(prev => prev + 1);
    } else if (step === 'permissions') {
      goToStep('name');
    } else {
      router.replace('/auth/login' as any);
    }
  };

  const togglePermission = (key: keyof Permissions) => {
    if (key === 'viewProducts') return; // compulsory

    if (key === 'addProducts' && permissions.addProducts) {
      setPermissions(prev => ({ ...prev, addProducts: false, registerProducts: false }));
      return;
    }
    if (key === 'registerProducts' && !permissions.registerProducts && !permissions.addProducts) {
      setPermissions(prev => ({ ...prev, registerProducts: true, addProducts: true }));
      return;
    }
    setPermissions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const permissionsList = [
    { key: 'viewProducts' as keyof Permissions, label: 'View Products', icon: 'eye-outline', description: 'View all products and stock levels', isCompulsory: true },
    { key: 'scanProducts' as keyof Permissions, label: 'Scan Products', icon: 'scan-outline', description: 'Access barcode scanner functionality' },
    { key: 'registerProducts' as keyof Permissions, label: 'Register Products', icon: 'add-circle-outline', description: 'Register new products after scanning' },
    { key: 'addProducts' as keyof Permissions, label: 'Add Products', icon: 'cube-outline', description: 'Add inventory to existing products' },
    { key: 'processSales' as keyof Permissions, label: 'Process Sales', icon: 'cart-outline', description: 'Complete sales transactions' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <KeyboardAvoidingView 
        style={[styles.container, { backgroundColor: theme.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: Math.max(insets.top, 20) }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Pressable style={styles.backButton} onPress={handleBack}>
              <Ionicons name="arrow-back" size={24} color={theme.primary} />
            </Pressable>
            <ThemedText style={[styles.headerTitle, { color: theme.text }]}>
              Add Staff Member
            </ThemedText>
          </View>

          {/* Content */}
          <View style={styles.content}>
            {step === 'store-verify' && (
              <>
                <View style={[styles.iconCircle, { backgroundColor: theme.primary + '15' }]}>
                  <Ionicons name="storefront" size={48} color={theme.primary} />
                </View>
                <ThemedText style={[styles.title, { color: theme.text }]}>Join a Store</ThemedText>
                <ThemedText style={[styles.subtitle, { color: theme.subtext }]}>
                  Enter the store name and the admin's login PIN to verify access
                </ThemedText>

                <TextInput
                  style={[styles.nameInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface }]}
                  placeholder="Store name"
                  placeholderTextColor={theme.subtext}
                  value={storeName}
                  onChangeText={setStoreName}
                  autoFocus
                />

                <ThemedText style={[styles.subtitle, { color: theme.subtext, marginBottom: 12, marginTop: 8 }]}>
                  Admin login PIN
                </ThemedText>

                <View style={styles.pinContainer}>
                  <PinInput
                    key={adminPinKey}
                    onComplete={handleAdminPinComplete}
                    error={false}
                    disabled={verifyingStore}
                    onClear={() => setAdminPinKey(prev => prev + 1)}
                  />
                  {verifyingStore && (
                    <ThemedText style={[styles.errorText, { color: theme.primary }]}>Verifying...</ThemedText>
                  )}
                </View>
              </>
            )}

            {step === 'name' && (
              <>
                <View style={[styles.iconCircle, { backgroundColor: theme.primary + '15' }]}>
                  <Ionicons name="person-add" size={48} color={theme.primary} />
                </View>
                <ThemedText style={[styles.title, { color: theme.text }]}>
                  Staff Information
                </ThemedText>
                <ThemedText style={[styles.subtitle, { color: theme.subtext }]}>
                  Enter the name of the staff member
                </ThemedText>

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
                  <ThemedText style={[styles.infoText, { color: theme.text }]}>
                    You'll set specific permissions for this staff member in the next step.
                  </ThemedText>
                </View>
              </>
            )}

            {step === 'permissions' && (
              <>
                <View style={[styles.iconCircle, { backgroundColor: theme.primary + '15' }]}>
                  <Ionicons name="shield-checkmark" size={48} color={theme.primary} />
                </View>
                <ThemedText style={[styles.title, { color: theme.text }]}>
                  Set Permissions
                </ThemedText>
                <ThemedText style={[styles.subtitle, { color: theme.subtext }]}>
                  Choose what {staffName} can do
                </ThemedText>

                <View style={styles.permissionsContainer}>
                  {permissionsList.map((perm) => (
                    <View
                      key={perm.key}
                      style={[
                        styles.permissionRow,
                        { backgroundColor: theme.surface, borderColor: theme.border, opacity: perm.isCompulsory ? 0.7 : 1 }
                      ]}
                    >
                      <View style={[styles.permIconBox, { backgroundColor: theme.primary + '15' }]}>
                        <Ionicons name={perm.icon as any} size={20} color={theme.primary} />
                      </View>
                      <View style={styles.permTextBox}>
                        <ThemedText style={[styles.permLabel, { color: theme.text }]}>
                          {perm.label}
                        </ThemedText>
                        <ThemedText style={[styles.permDesc, { color: theme.subtext }]}>
                          {perm.description}
                        </ThemedText>
                      </View>
                      <Switch
                        value={permissions[perm.key]}
                        onValueChange={() => togglePermission(perm.key)}
                        trackColor={{ true: theme.primary, false: theme.border }}
                        disabled={perm.isCompulsory}
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
                <ThemedText style={[styles.title, { color: theme.text }]}>
                  {isFirstPin ? 'Create Staff Log in PIN' : 'Confirm PIN'}
                </ThemedText>
                <ThemedText style={[styles.subtitle, { color: theme.subtext }]}>
                  {isFirstPin
                    ? 'Choose a 4-digit PIN for this staff member'
                    : 'Enter the PIN again to confirm'}
                </ThemedText>

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
                        setPinKey(prev => prev + 1);
                      }
                    }}
                  />
                  {pinError && (
                    <ThemedText style={[styles.errorText, { color: theme.notification }]}>
                      PINs don't match. Please try again.
                    </ThemedText>
                  )}
                </View>

                <View style={[styles.warningCard, { backgroundColor: '#FF9500' + '10', borderColor: '#FF9500' }]}>
                  <Ionicons name="warning" size={20} color="#FF9500" />
                  <ThemedText style={[styles.warningText, { color: theme.text }]}>
                    Make sure to share this PIN securely with the staff member. It cannot be recovered if lost.
                  </ThemedText>
                </View>
              </>
            )}

            {step === 'complete' && (
              <>
                <View style={[styles.iconCircle, { backgroundColor: '#34C759' + '15' }]}>
                  <Ionicons name="checkmark-circle" size={64} color="#34C759" />
                </View>
                <ThemedText style={[styles.title, { color: theme.text }]}>
                  Staff Added!
                </ThemedText>
                <ThemedText style={[styles.subtitle, { color: theme.subtext }]}>
                  {staffName} can now log in with their PIN
                </ThemedText>

                <View style={[styles.summaryCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <View style={styles.summaryRow}>
                    <ThemedText style={[styles.summaryLabel, { color: theme.subtext }]}>Name:</ThemedText>
                    <ThemedText style={[styles.summaryValue, { color: theme.text }]}>{staffName}</ThemedText>
                  </View>
                  <View style={styles.summaryRow}>
                    <ThemedText style={[styles.summaryLabel, { color: theme.subtext }]}>Role:</ThemedText>
                    <ThemedText style={[styles.summaryValue, { color: theme.text }]}>Staff</ThemedText>
                  </View>
                  <View style={styles.summaryRow}>
                    <ThemedText style={[styles.summaryLabel, { color: theme.subtext }]}>PIN:</ThemedText>
                    <ThemedText style={[styles.summaryValue, { color: theme.text }]}>••••</ThemedText>
                  </View>
                </View>

                <View style={[styles.permissionsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <ThemedText style={[styles.permissionsTitle, { color: theme.text }]}>
                    Assigned Permissions
                  </ThemedText>
                  <View style={styles.permissionsList}>
                    {permissionsList.map((perm) => (
                      <View key={perm.key} style={styles.permissionItem}>
                        <Ionicons
                          name={permissions[perm.key] ? 'checkmark-circle' : 'close-circle'}
                          size={20}
                          color={permissions[perm.key] ? '#34C759' : '#FF3B30'}
                        />
                        <ThemedText
                          style={[
                            styles.permissionText,
                            { color: permissions[perm.key] ? theme.text : theme.subtext }
                          ]}
                        >
                          {perm.label}
                        </ThemedText>
                      </View>
                    ))}
                  </View>
                </View>
              </>
            )}
          </View>

          {/* Footer Button */}
          {(step === 'name' || step === 'permissions' || step === 'complete') && (
            <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
              <Pressable
                style={[styles.continueButton, { backgroundColor: theme.primary }]}
                onPress={handleContinue}
              >
                <ThemedText style={styles.continueText}>
                  {step === 'complete' ? 'Done' : 'Continue'}
                </ThemedText>
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
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 30,
    marginTop: 20,
  },
  backButton: {
    padding: 10,
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 24,
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
    },
  summaryValue: {
    fontSize: 16,
    },
  permissionsCard: {
    width: '100%',
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
  },
  permissionsTitle: {
    fontSize: 16,
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
    },
});

