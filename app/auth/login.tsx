import { AuthorLogin } from '@/components/AuthorLogin';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View
} from "react-native";
import { PinInput } from '../../components/PinInput';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

export default function LoginScreen() {
  const { theme } = useTheme();
  const { login, isAuthenticated, role: userRole } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  const [selectedRole, setSelectedRole] = useState<'admin' | 'staff' | null>(null);
  const [pinError, setPinError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showAuthorLogin, setShowAuthorLogin] = useState(false);
  const [pinKey, setPinKey] = useState(0);

  useEffect(() => {
    if (params.role === 'admin' || params.role === 'staff') {
      setSelectedRole(params.role);
    }
  }, [params.role]);

  useEffect(() => {
    if (isAuthenticated && userRole) {
      if (userRole === 'admin') router.replace('/admin/stats' as any);
      else router.replace('/(tabs)');
    }
  }, [isAuthenticated, userRole]);

  const handlePinComplete = async (pin: string) => {
    if (!selectedRole) return;
    setIsLoading(true);
    setPinError(false);
    const success = await login(pin, selectedRole);
    if (success) {
      if (selectedRole === 'admin') router.replace('/admin/stats' as any);
      else router.replace('/(tabs)');
    } else {
      setPinError(true);
      setIsLoading(false);
      setPinKey(prev => prev + 1);
    }
  };

  const handleRoleSelect = (role: 'admin' | 'staff') => {
    setSelectedRole(role);
    setPinError(false);
    setPinKey(prev => prev + 1);
  };

  const handleBack = () => {
    setSelectedRole(null);
    setPinError(false);
    setPinKey(prev => prev + 1);
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.topBar, { backgroundColor: theme.primary }]} />

          <View style={styles.content}>
            {!selectedRole ? (
              <>
                <View style={[styles.logoMark, { backgroundColor: theme.primaryLight }]}>
                  <Ionicons name="cube" size={36} color={theme.primary} />
                </View>
                <Text style={[styles.appName, { color: theme.primary }]}>StockQ</Text>
                <Text style={[styles.title, { color: theme.text }]}>Welcome back</Text>
                <Text style={[styles.subtitle, { color: theme.subtext }]}>
                  Choose your role to continue
                </Text>

                <View style={styles.roleButtons}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.roleCard,
                      { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.85 : 1 },
                    ]}
                    onPress={() => handleRoleSelect('admin')}
                  >
                    <View style={[styles.roleIconWrap, { backgroundColor: theme.primaryLight }]}>
                      <Ionicons name="shield-checkmark" size={26} color={theme.primary} />
                    </View>
                    <View style={styles.roleTextWrap}>
                      <Text style={[styles.roleTitle, { color: theme.text }]}>Admin</Text>
                      <Text style={[styles.roleDesc, { color: theme.subtext }]}>Full access to all features</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={theme.subtext} />
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [
                      styles.roleCard,
                      { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.85 : 1 },
                    ]}
                    onPress={() => handleRoleSelect('staff')}
                  >
                    <View style={[styles.roleIconWrap, { backgroundColor: '#F59E0B18' }]}>
                      <Ionicons name="people" size={26} color="#F59E0B" />
                    </View>
                    <View style={styles.roleTextWrap}>
                      <Text style={[styles.roleTitle, { color: theme.text }]}>Staff</Text>
                      <Text style={[styles.roleDesc, { color: theme.subtext }]}>Manage inventory and sales</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={theme.subtext} />
                  </Pressable>
                </View>

                <Pressable style={styles.setupRow} onPress={() => router.push('/auth/setup' as any)}>
                  <Text style={[styles.setupText, { color: theme.subtext }]}>First time? </Text>
                  <Text style={[styles.setupLink, { color: theme.primary }]}>Set up your account</Text>
                </Pressable>

                <Pressable style={styles.setupRow} onPress={() => router.push('/auth/staff-register' as any)}>
                  <Text style={[styles.setupText, { color: theme.subtext }]}>Staff member? </Text>
                  <Text style={[styles.setupLink, { color: theme.primary }]}>Join a store</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable style={styles.backBtn} onPress={handleBack}>
                  <View style={[styles.backBtnInner, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <Ionicons name="arrow-back" size={20} color={theme.text} />
                  </View>
                </Pressable>

                <View style={[styles.roleIconLarge, {
                  backgroundColor: selectedRole === 'admin' ? theme.primaryLight : '#F59E0B18'
                }]}>
                  <Ionicons
                    name={selectedRole === 'admin' ? 'shield-checkmark' : 'people'}
                    size={44}
                    color={selectedRole === 'admin' ? theme.primary : '#F59E0B'}
                  />
                </View>

                <Text style={[styles.title, { color: theme.text }]}>
                  {selectedRole === 'admin' ? 'Admin Login' : 'Staff Login'}
                </Text>
                <Text style={[styles.subtitle, { color: theme.subtext }]}>Enter your 4-digit PIN</Text>

                <View style={styles.pinContainer}>
                  <PinInput
                    key={pinKey}
                    onComplete={handlePinComplete}
                    error={pinError}
                    disabled={isLoading}
                    onClear={() => { setPinError(false); setPinKey(prev => prev + 1); }}
                  />
                  {pinError && (
                    <Text style={[styles.errorText, { color: theme.notification }]}>
                      Incorrect PIN. Please try again.
                    </Text>
                  )}
                </View>
              </>
            )}
          </View>

          {!selectedRole && (
            <View style={styles.footer}>
              <Pressable onPress={() => setShowAuthorLogin(true)}>
                <Text style={[styles.authorText, { color: theme.subtext }]}>Author</Text>
              </Pressable>
            </View>
          )}

          <AuthorLogin visible={showAuthorLogin} onClose={() => setShowAuthorLogin(false)} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { height: 5 },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 56,
    paddingBottom: 40,
    minHeight: 520,
  },
  logoMark: {
    width: 72,
    height: 72,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  appName: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 4,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 8, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, marginBottom: 36, textAlign: 'center' },
  roleButtons: { width: '100%', gap: 12, marginBottom: 28 },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 20,
    borderWidth: 1.5,
    gap: 14,
  },
  roleIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleTextWrap: { flex: 1 },
  roleTitle: { fontSize: 17, fontWeight: '700', marginBottom: 3 },
  roleDesc: { fontSize: 13 },
  setupRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  setupText: { fontSize: 14 },
  setupLink: { fontSize: 14, fontWeight: '700' },
  backBtn: { alignSelf: 'flex-start', marginBottom: 32 },
  backBtnInner: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleIconLarge: {
    width: 96,
    height: 96,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  pinContainer: { alignItems: 'center', gap: 16, marginTop: 8 },
  errorText: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  footer: { alignItems: 'center', paddingBottom: 32 },
  authorText: { fontSize: 12, opacity: 0.5 },
});
