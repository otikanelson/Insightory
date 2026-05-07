import { AuthorLogin } from '@/components/AuthorLogin';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View
} from "react-native";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { PinInput } from '../../components/PinInput';
import { ThemedText } from '../../components/ThemedText';
import { useSetupGuide } from '../../context/SetupGuideContext';
import { useTheme } from '../../context/ThemeContext';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

type SetupStep = 'welcome' | 'store-name' | 'admin-name' | 'login-pin' | 'security-pin' | 'complete';

export default function SetupScreen() {
  const { theme, isDark } = useTheme();
  const { showStep, isActive, startGuide } = useSetupGuide();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Start on welcome screen
  const [step, setStep] = useState<SetupStep>('welcome');

  // Auto-start guide when component mounts on welcome screen
  useEffect(() => {
    if (step === 'welcome') {
      // Small delay to ensure layout is ready
      const timer = setTimeout(() => {
        startGuide('admin'); // Start in admin mode by default
        showStep('welcome');
      }, 300);
      return () => clearTimeout(timer);
    }
  }, []);

  // Handle Android back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === 'welcome') {
        // Exit app on welcome screen
        BackHandler.exitApp();
        return true;
      } else {
        // Navigate back through steps
        handleBack();
        return true;
      }
    });

    return () => backHandler.remove();
  }, [step]);

  const goToStep = (s: SetupStep) => {
    setStep(s);
    if (isActive && s !== 'welcome') showStep(s);
  };

  // When user clicks "Create Store" from welcome, go to store-name
  const handleStartSetup = () => {
    goToStep('store-name');
  };
  const [storeName, setStoreName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminLoginPin, setAdminLoginPin] = useState('');
  const [adminSecurityPin, setAdminSecurityPin] = useState('');
  const [tempPin, setTempPin] = useState(''); // Temporary storage for confirmation
  const [pinError, setPinError] = useState(false);
  const [isFirstPin, setIsFirstPin] = useState(true);
  const [pinKey, setPinKey] = useState(0); // Key to force PinInput reset
  const [showAuthorLogin, setShowAuthorLogin] = useState(false);

  const handlePinComplete = async (pin: string) => {
    // Handle Login PIN step
    if (step === 'login-pin') {
      if (isFirstPin) {
        setTempPin(pin);
        setIsFirstPin(false);
        setPinError(false);
        setPinKey(prev => prev + 1); // Force PinInput to reset
      } else {
        if (pin === tempPin) {
          setAdminLoginPin(pin);
          setTempPin('');
          setIsFirstPin(true);
          setPinError(false);
          setPinKey(prev => prev + 1);
          goToStep('security-pin');
        } else {
          setPinError(true);
          setIsFirstPin(true);
          setTempPin('');
          setPinKey(prev => prev + 1);
        }
      }
      return;
    }

    // Handle Security PIN step
    if (step === 'security-pin') {
      if (isFirstPin) {
        setTempPin(pin);
        setIsFirstPin(false);
        setPinError(false);
        setPinKey(prev => prev + 1);
      } else {
        if (pin === tempPin) {
          setAdminSecurityPin(pin);
          
          // Validate that security PIN is different from login PIN
          if (pin === adminLoginPin) {
            setPinError(true);
            setIsFirstPin(true);
            setTempPin('');
            setPinKey(prev => prev + 1);
            Toast.show({
              type: 'error',
              text1: 'PIN Validation Error',
              text2: 'Security PIN must be different from Login PIN',
              visibilityTime: 3000,
            });
            return;
          }
          
          // Save admin credentials to backend and local storage
          try {
            console.log('=== ADMIN SETUP DEBUG ===');
            console.log('1. API_URL:', API_URL);
            console.log('2. Admin Name:', adminName);
            console.log('3. Login PIN:', '****');
            console.log('4. Security PIN:', '****');

            // Create admin user in backend with SEPARATE PINs
            console.log('5. Sending POST request to:', `${API_URL}/auth/setup`);
            const response = await axios.post(`${API_URL}/auth/setup`, {
              name: adminName || 'Admin',
              loginPin: adminLoginPin,
              securityPin: pin,
              storeName: storeName || 'My Store'
            });

            console.log('6. Response Status:', response.status);
            console.log('7. Response Data:', response.data);

            if (response.data.success) {
              const adminId = response.data.data.user.id;
              const storeId = response.data.data.user.storeId;
              const storeNameFromResponse = response.data.data.user.storeName;
              console.log('8. Admin ID from response:', adminId);
              console.log('9. Store ID from response:', storeId);

              // Save to local storage with SEPARATE PINs
              await AsyncStorage.multiSet([
                ['admin_login_pin', adminLoginPin],
                ['admin_security_pin', pin],
                ['admin_first_setup', 'completed'],
                ['onboarding_complete', 'true'], // Mark onboarding as complete
                ['auth_user_name', adminName || 'Admin'],
                ['auth_user_id', adminId],
                ['auth_user_role', 'admin'],
                ['auth_store_id', storeId || ''],
                ['auth_store_name', storeNameFromResponse || storeName || 'My Store']
              ]);
              console.log('10. Saved to AsyncStorage');

              Toast.show({
                type: 'success',
                text1: 'Store Created',
                text2: `${storeNameFromResponse || storeName} is ready!`,
              });

              goToStep('complete');
              console.log('11. Setup complete!');
            } else {
              console.error('11. Backend returned unsuccessful response:', response.data);
              throw new Error('Backend returned unsuccessful response');
            }
          } catch (error: any) {
            let errorMessage = 'Could not create admin account';
            let shouldFallbackToLocal = false;
            
            try {
              if (error.response) {
                // Server responded with error
                const status = error.response.status;
                const serverError = error.response.data?.error;
                
                if (status === 400) {
                  // Validation errors like duplicate PIN/store name - don't log
                  errorMessage = serverError || 'Invalid setup information';
                } else if (status >= 500) {
                  errorMessage = 'Server error - saving locally';
                  shouldFallbackToLocal = true;
                  console.error('Setup server error:', status);
                } else {
                  errorMessage = serverError || errorMessage;
                  shouldFallbackToLocal = true;
                }
              } else if (error.code === 'ECONNABORTED') {
                errorMessage = 'Connection timeout - saving locally';
                shouldFallbackToLocal = true;
              } else if (error.code === 'ERR_NETWORK' || !error.response) {
                errorMessage = 'Network error - saving locally';
                shouldFallbackToLocal = true;
              } else {
                errorMessage = error.message || errorMessage;
                shouldFallbackToLocal = true;
              }
            } catch (parseError) {
              // Silently handle parsing errors
              shouldFallbackToLocal = true;
            }

            // Fallback to local storage if appropriate
            if (shouldFallbackToLocal) {
              try {
                await AsyncStorage.multiSet([
                  ['admin_login_pin', adminLoginPin],
                  ['admin_security_pin', pin],
                  ['admin_first_setup', 'completed'],
                  ['onboarding_complete', 'true'], // Mark onboarding as complete
                  ['auth_user_name', adminName || 'Admin'],
                ]);

                Toast.show({
                  type: 'success',
                  text1: 'Admin Created',
                  text2: 'Account saved locally (offline mode)',
                });

                goToStep('complete');
              } catch (localError) {
                console.error('Local storage fallback failed:', localError);
                Toast.show({
                  type: 'error',
                  text1: 'Setup Failed',
                  text2: 'Could not save account',
                  visibilityTime: 4000,
                });
              }
            } else {
              Toast.show({
                type: 'error',
                text1: 'Setup Failed',
                text2: errorMessage,
                visibilityTime: 4000,
              });
            }
          }
        } else {
          setPinError(true);
          setIsFirstPin(true);
          setTempPin('');
          setPinKey(prev => prev + 1);
        }
      }
    }
  };

  const handleContinue = () => {
    if (step === 'welcome') {
      handleStartSetup();
    } else if (step === 'store-name') {
      if (!storeName.trim()) {
        Toast.show({
          type: 'error',
          text1: 'Store Name Required',
          text2: 'Please enter your store name',
        });
        return;
      }
      goToStep('admin-name');
    } else if (step === 'admin-name') {
      if (!adminName.trim()) {
        Toast.show({
          type: 'error',
          text1: 'Name Required',
          text2: 'Please enter your name',
        });
        return;
      }
      goToStep('login-pin');
    } else if (step === 'complete') {
      router.replace('/auth/login' as any);
    }
  };

  const handleBack = () => {
    if (step === 'store-name') {
      setStep('welcome');
      showStep('welcome');
    } else if (step === 'admin-name') {
      goToStep('store-name');
    } else if (step === 'login-pin') {
      goToStep('admin-name');
      setIsFirstPin(true);
      setTempPin('');
      setPinError(false);
      setPinKey(prev => prev + 1);
    } else if (step === 'security-pin') {
      goToStep('login-pin');
      setIsFirstPin(true);
      setTempPin('');
      setPinError(false);
      setPinKey(prev => prev + 1);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView 
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 20) }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={[styles.headerBar, { backgroundColor: theme.primary }]} />

          {/* Content */}
          <View style={styles.content}>
            {step !== 'welcome' && step !== 'complete' && (
              <Pressable style={styles.backBtn} onPress={handleBack}>
                <View style={[styles.backBtnInner, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Ionicons name="arrow-back" size={20} color={theme.text} />
                </View>
              </Pressable>
            )}

        {step === 'welcome' && (
          <>
            <Image 
              source={isDark ? require('../../assets/images/Logo.png') : require('../../assets/images/Logo_Light.png')} 
              style={[styles.logoMark, { width: 80, height: 80 }]} 
              contentFit="contain" 
            />
            <ThemedText style={[styles.title, { color: theme.text }]}>
              Welcome
            </ThemedText>
            <ThemedText style={[styles.subtitle, { color: theme.subtext }]}>
              Set up your admin account or join an existing store
            </ThemedText>

            <View style={styles.featureList}>
              <View style={styles.featureItem}> 
                <View style={[styles.featureIcon, { backgroundColor: theme.primary + '15' }]}>
                  <Ionicons name="shield-checkmark" size={24} color={theme.primary} />
                </View>
                <View style={styles.featureText}>
                  <ThemedText style={[styles.featureTitle, { color: theme.text }]}>
                    Secure Access
                  </ThemedText>
                  <ThemedText style={[styles.featureDesc, { color: theme.subtext }]}>
                    Protect your inventory with PIN authentication
                  </ThemedText>
                </View>
              </View>

              <View style={styles.featureItem}>
                <View style={[styles.featureIcon, { backgroundColor: theme.primary + '15' }]}>
                  <Ionicons name="people" size={24} color={theme.primary} />
                </View>
                <View style={styles.featureText}>
                  <ThemedText style={[styles.featureTitle, { color: theme.text }]}>
                    Staff Management
                  </ThemedText>
                  <ThemedText style={[styles.featureDesc, { color: theme.subtext }]}>
                    Add staff members with limited access
                  </ThemedText>
                </View>
              </View>

              <View style={styles.featureItem}>
                <View style={[styles.featureIcon, { backgroundColor: theme.primary + '15' }]}>
                  <Ionicons name="analytics" size={24} color={theme.primary} />
                </View>
                <View style={styles.featureText}>
                  <ThemedText style={[styles.featureTitle, { color: theme.text }]}>
                    Full Control
                  </ThemedText>
                  <ThemedText style={[styles.featureDesc, { color: theme.subtext }]}>
                    Access all features and settings
                  </ThemedText>
                </View>
              </View>
            </View>

            {/* Login Link */}
            <Pressable 
              style={styles.loginLink}
              onPress={() => router.push('/auth/login' as any)}
            >
              <ThemedText style={[styles.loginLinkText, { color: theme.subtext }]}>
                Already have an account?{' '}
                <ThemedText style={[styles.loginLinkBold, { color: theme.primary }]}>
                  Sign in
                </ThemedText>
              </ThemedText>
            </Pressable>

            {/* Author Login Link */}
            <Pressable 
              style={styles.authorLink}
              onPress={() => setShowAuthorLogin(true)}
            >
              <ThemedText style={[styles.authorLinkText, { color: theme.subtext + '80' }]}>
                Author
              </ThemedText>
            </Pressable>
          </>
        )}

        {step === 'store-name' && (
          <>
            <View style={[styles.iconCircle, { backgroundColor: theme.primary + '15' }]}>
              <Ionicons name="storefront" size={48} color={theme.primary} />
            </View>
            <ThemedText style={[styles.title, { color: theme.text }]}>
              Name Your Store
            </ThemedText>
            <ThemedText style={[styles.subtitle, { color: theme.subtext }]}>
              This will be your store's identity
            </ThemedText>

            <TextInput
              style={[
                styles.nameInput,
                { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface },
              ]}
              placeholder="Enter store name"
              placeholderTextColor={theme.subtext}
              value={storeName}
              onChangeText={setStoreName}
              autoFocus
            />
          </>
        )}

        {step === 'admin-name' && (
          <>
            <View style={[styles.iconCircle, { backgroundColor: theme.primary + '15' }]}>
              <Ionicons name="person" size={48} color={theme.primary} />
            </View>
            <ThemedText style={[styles.title, { color: theme.text }]}>
              What's your name?
            </ThemedText>
            <ThemedText style={[styles.subtitle, { color: theme.subtext }]}>
              This will be displayed in the app
            </ThemedText>

            <TextInput
              style={[
                styles.nameInput,
                { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface },
              ]}
              placeholder="Enter your name"
              placeholderTextColor={theme.subtext}
              value={adminName}
              onChangeText={setAdminName}
              autoFocus
            />
          </>
        )}

        {step === 'login-pin' && (
          <>
            <View style={[styles.iconCircle, { backgroundColor: theme.primary + '15' }]}>
              <Ionicons name="log-in" size={48} color={theme.primary} />
            </View>
            <ThemedText style={[styles.title, { color: theme.text }]}>
              {isFirstPin ? 'Create Login PIN' : 'Confirm Login PIN'}
            </ThemedText>
            <ThemedText style={[styles.subtitle, { color: theme.subtext }]}>
              {isFirstPin
                ? 'This PIN will be used to log into the app'
                : 'Enter your Login PIN again to confirm'}
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
                    setTempPin('');
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
          </>
        )}

        {step === 'security-pin' && (
          <>
            <View style={[styles.iconCircle, { backgroundColor: '#FF9500' + '15' }]}>
              <Ionicons name="shield-checkmark" size={48} color="#FF9500" />
            </View>
            <ThemedText style={[styles.title, { color: theme.text }]}>
              {isFirstPin ? 'Create Security PIN' : 'Confirm Security PIN'}
            </ThemedText>
            <ThemedText style={[styles.subtitle, { color: theme.subtext }]}>
              {isFirstPin
                ? 'This PIN protects sensitive operations like product registration and deletion'
                : 'Enter your Security PIN again to confirm'}
            </ThemedText>

            <View style={[styles.tipCard, { backgroundColor: '#FF9500' + '10', borderColor: '#FF9500', marginBottom: 20 }]}>
              <Ionicons name="information-circle" size={20} color="#FF9500" />
              <ThemedText style={[styles.tipText, { color: theme.text }]}>
                Security PIN must be different from Login PIN for better security
              </ThemedText>
            </View>

            <View style={styles.pinContainer}>
              <PinInput
                key={pinKey}
                onComplete={handlePinComplete}
                error={pinError}
                onClear={() => {
                  setPinError(false);
                  if (!isFirstPin) {
                    setIsFirstPin(true);
                    setTempPin('');
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
          </>
        )}

        {step === 'complete' && (
          <>
            <View style={[styles.iconCircle, { backgroundColor: '#34C759' + '15' }]}>
              <Ionicons name="checkmark-circle" size={64} color="#34C759" />
            </View>
            <ThemedText style={[styles.title, { color: theme.text }]}>
              All Set!
            </ThemedText>
            <ThemedText style={[styles.subtitle, { color: theme.subtext }]}>
              Your admin account has been created successfully
            </ThemedText>

            <View style={[styles.infoCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.infoRow}>
                <ThemedText style={[styles.infoLabel, { color: theme.subtext }]}>Store:</ThemedText>
                <ThemedText style={[styles.infoValue, { color: theme.text }]}>{storeName}</ThemedText>
              </View>
              <View style={styles.infoRow}>
                <ThemedText style={[styles.infoLabel, { color: theme.subtext }]}>Name:</ThemedText>
                <ThemedText style={[styles.infoValue, { color: theme.text }]}>{adminName}</ThemedText>
              </View>
              <View style={styles.infoRow}>
                <ThemedText style={[styles.infoLabel, { color: theme.subtext }]}>Role:</ThemedText>
                <ThemedText style={[styles.infoValue, { color: theme.text }]}>Admin</ThemedText>
              </View>
              <View style={styles.infoRow}>
                <ThemedText style={[styles.infoLabel, { color: theme.subtext }]}>PIN:</ThemedText>
                <ThemedText style={[styles.infoValue, { color: theme.text }]}>••••</ThemedText>
              </View>
            </View>

            <View style={[styles.tipCard, { backgroundColor: theme.primary + '10', borderColor: theme.primary }]}>
              <Ionicons name="information-circle" size={20} color={theme.primary} />
              <ThemedText style={[styles.tipText, { color: theme.text }]}>
                You can add staff members later from Admin Settings
              </ThemedText>
            </View>
          </>
        )}
      </View>

          {/* Footer Buttons */}
          {(step === 'welcome' || step === 'store-name' || step === 'admin-name' || step === 'complete') && (
            <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
              {step === 'welcome' ? (
                <>
                  <Pressable
                    style={[styles.continueButton, { backgroundColor: theme.primary }]}
                    onPress={handleStartSetup}
                  >
                    <ThemedText style={styles.continueText}>Create Store</ThemedText>
                    <Ionicons name="arrow-forward" size={20} color="#FFF" />
                  </Pressable>

                  <Pressable
                    style={[styles.joinStoreButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
                    onPress={() => {
                      startGuide('staff');
                      router.push('/auth/staff-register' as any);
                    }}
                  >
                    <Ionicons name="people" size={20} color={theme.primary} />
                    <ThemedText style={[styles.joinStoreText, { color: theme.text }]}>
                      Join Store
                    </ThemedText>
                  </Pressable>
                </>
              ) : (
                <Pressable
                  style={[styles.continueButton, { backgroundColor: theme.primary }]}
                  onPress={handleContinue}
                >
                  <ThemedText style={styles.continueText}>
                    {step === 'complete' ? 'Go to Login' : 'Continue'}
                  </ThemedText>
                  <Ionicons name="arrow-forward" size={20} color="#FFF" />
                </Pressable>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Author Login Modal */}
      <AuthorLogin visible={showAuthorLogin} onClose={() => setShowAuthorLogin(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  headerBar: {
    height: 4,
    width: '100%',
  },
  logoMark: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerCurve: {
    height: 150,
    borderBottomLeftRadius: 1000,
    borderBottomRightRadius: 1000,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 40,
    width: '130%',
    alignSelf: 'center',
  },
  headerTitle: {
    fontSize: 32,
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  backBtn: {
    alignSelf: 'flex-start',
    marginBottom: 32,
  },
  backBtnInner: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    marginBottom: 60,
    textAlign: 'center',
    lineHeight: 22,
  },
  featureList: {
    width: '100%',
    gap: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    marginBottom: 4,
  },
  featureDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  nameInput: {
    width: '100%',
    height: 55,
    borderWidth: 2,
    borderRadius: 15,
    paddingHorizontal: 20,
    fontSize: 16,
    },
  pinContainer: {
    alignItems: 'center',
    gap: 16,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  infoCard: {
    width: '100%',
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
    gap: 12,
    marginTop: 20,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 14,
    },
  infoValue: {
    fontSize: 16,
    },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 16,
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: 30,
    paddingBottom: 20,
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
  loginLink: {
    marginTop: 30,
    paddingVertical: 10,
  },
  loginLinkText: {
    fontSize: 15,
    textAlign: 'center',
  },
  loginLinkBold: {
    fontWeight: '600',
  },
  authorLink: {
    marginTop: 10,
  },
  authorLinkText: {
    fontSize: 12,
    textAlign: 'center',
    opacity: 0.5,
  },
  diagnosticsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 20,
  },
  diagnosticsText: {
    fontSize: 13,
  },
  joinStoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 2,
  },
  joinStoreText: {
    fontSize: 17,
  },
});

