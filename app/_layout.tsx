import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Toast from 'react-native-toast-message';
import { toastConfig } from '../components/CustomToast';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { SetupGuideOverlay } from '../components/SetupGuideOverlay';
import { SplashScreenAnimation } from '../components/SplashScreenAnimation';
import { TourOverlay } from '../components/TourOverlay';
import { AppReadyProvider, useAppReady } from '../context/AppReadyContext';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { SetupGuideProvider } from '../context/SetupGuideContext';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { TourProvider } from '../context/TourContext';
import { useFonts } from '../hooks/useFonts';
import '../utils/axiosConfig';


// Suppress console warnings in production
if (__DEV__ === false) {
  const originalWarn = console.warn;
  const originalError = console.error;
  
  console.warn = (...args) => {
    const message = args[0];
    // Suppress WebSocket and transform warnings
    if (
      typeof message === 'string' &&
      (message.includes('WebSocket') ||
       message.includes('socket.io') ||
       message.includes('transform') ||
       message.includes('deprecated'))
    ) {
      return;
    }
    originalWarn.apply(console, args);
  };
  
  console.error = (...args) => {
    const message = args[0];
    // Suppress non-critical WebSocket errors
    if (
      typeof message === 'string' &&
      (message.includes('WebSocket connection error') ||
       message.includes('socket.io'))
    ) {
      return;
    }
    originalError.apply(console, args);
  };
}

function RootLayoutNav() {
  const { isAuthenticated, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [isFirstTime, setIsFirstTime] = useState<boolean | null>(null);
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  
  // Use ref to track navigation without causing re-renders
  const hasNavigatedRef = useRef(false);
  const lastSegmentRef = useRef('');

  useEffect(() => {
    checkFirstTimeSetup();
  }, []);

  const checkFirstTimeSetup = async () => {
    try {
      // One-time cleanup: clear stale author session data if no valid session token exists
      const sessionToken = await AsyncStorage.getItem('auth_session_token');
      const isAuthor = await AsyncStorage.getItem('auth_is_author');
      if (isAuthor === 'true' && !sessionToken) {
        await AsyncStorage.removeItem('auth_is_author');
      }

      // Check if user has ever completed setup OR onboarding
      // If either is true, they're a recurring user
      const setupComplete = await AsyncStorage.getItem('admin_first_setup');
      const onboardingDone = await AsyncStorage.getItem('onboarding_complete');
      
      // MIGRATION: If user has completed setup but onboarding_complete is not set, set it now
      // This handles users who logged in before we added the onboarding_complete flag
      if (setupComplete && !onboardingDone) {
        console.log('🔄 [MIGRATION] Setting onboarding_complete for existing user');
        await AsyncStorage.setItem('onboarding_complete', 'true');
      }
      
      // Re-read after potential migration
      const onboardingDoneAfterMigration = await AsyncStorage.getItem('onboarding_complete');
      
      console.log('🔍 [NAVIGATION] Checking first-time status:');
      console.log('  - admin_first_setup:', setupComplete);
      console.log('  - onboarding_complete:', onboardingDoneAfterMigration);
      
      // User is first time ONLY if both setup and onboarding are not complete
      const isRecurringUser = !!(setupComplete || onboardingDoneAfterMigration);
      
      console.log('  - isRecurringUser:', isRecurringUser);
      console.log('  - isFirstTime:', !isRecurringUser);
      
      setIsFirstTime(!isRecurringUser);
      setOnboardingComplete(!!onboardingDoneAfterMigration);
    } catch (error) {
      console.error('Error checking first time setup:', error);
      setIsFirstTime(true);
      setOnboardingComplete(false);
    }
  };

  // Reset navigation flag when segments change (user manually navigated)
  useEffect(() => {
    const currentSegment = segments.join('/');
    if (currentSegment !== lastSegmentRef.current) {
      lastSegmentRef.current = currentSegment;
      hasNavigatedRef.current = false;
    }
  }, [segments.join('/')]);

  useEffect(() => {
    if (loading || isFirstTime === null || onboardingComplete === null || hasNavigatedRef.current) return;

    const inAuthGroup = segments[0] === 'auth';
    const inAuthorGroup = segments[0] === 'author';
    const inOnboardingGroup = segments[0] === 'onboarding';
    const isStaffRegister = segments[1] === 'staff-register';

    console.log('🧭 [NAVIGATION] Navigation check:');
    console.log('  - isAuthenticated:', isAuthenticated);
    console.log('  - isFirstTime:', isFirstTime);
    console.log('  - onboardingComplete:', onboardingComplete);
    console.log('  - current segment:', segments[0]);

    // CRITICAL: First-time users ONLY see onboarding
    // If isFirstTime is false, user has used the app before and should NEVER see onboarding
    if (!isAuthenticated && isFirstTime && !onboardingComplete && !inOnboardingGroup && !inAuthorGroup && !inAuthGroup) {
      console.log('  → Redirecting to onboarding (first-time user)');
      hasNavigatedRef.current = true;
      router.replace('/onboarding' as any);
      return;
    }

    // Check if user is author - also verify they have a valid session token
    const checkAuthorStatus = async () => {
      const isAuthor = await AsyncStorage.getItem('auth_is_author');
      const sessionToken = await AsyncStorage.getItem('auth_session_token');
      // Only treat as author if both flags are set AND there's a valid session
      return isAuthor === 'true' && !!sessionToken;
    };

    // Check user role for navigation
    const checkUserRole = async () => {
      const userRole = await AsyncStorage.getItem('auth_user_role');
      return userRole;
    };

    checkAuthorStatus().then((isAuthor) => {
      // Authors bypass all first-time setup checks
      if (isAuthor) {
        // Only redirect if not already in author group
        if (!inAuthorGroup) {
          hasNavigatedRef.current = true;
          router.replace('/author/dashboard' as any);
        }
        return;
      }

      // If we're in auth group but had stale author flag, clear it
      if (inAuthGroup) {
        AsyncStorage.removeItem('auth_is_author').catch(() => {});
      }

      // Regular user flow (admin/staff)
      // Priority 1: If authenticated, ensure they're in the app (not auth screens)
      if (isAuthenticated) {
        console.log('  → User is authenticated');
        if (inAuthGroup && !isStaffRegister) {
          // Authenticated but in auth screens - redirect based on role
          console.log('  → In auth group, redirecting to app');
          checkUserRole().then((role) => {
            hasNavigatedRef.current = true;
            if (role === 'admin') {
              console.log('  → Redirecting admin to /admin/sales');
              router.replace('/admin/sales' as any);
            } else {
              console.log('  → Redirecting staff to /(tabs)');
              router.replace('/(tabs)');
            }
          });
        } else {
          console.log('  → Already in app, no redirect needed');
        }
        return;
      }

      // Priority 2: Not authenticated - check if first time or returning user
      // CRITICAL: Don't redirect if already in auth/onboarding screens (let user navigate freely)
      console.log('  → User is NOT authenticated');
      if (!inAuthGroup && !inAuthorGroup && !inOnboardingGroup) {
        if (isFirstTime) {
          // First time user - redirect to setup
          console.log('  → First-time user, redirecting to /auth/setup');
          hasNavigatedRef.current = true;
          router.replace('/auth/setup' as any);
        } else {
          // Returning user not authenticated - redirect to login
          console.log('  → Recurring user, redirecting to /auth/login');
          hasNavigatedRef.current = true;
          router.replace('/auth/login' as any);
        }
      } else {
        console.log('  → Already in auth/onboarding, no redirect');
      }
      // If already in auth/onboarding screens, don't interfere - let user navigate
    });
  }, [isAuthenticated, segments, loading, isFirstTime, onboardingComplete]);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="product/[id]" />
        <Stack.Screen name="auth/login" />
        <Stack.Screen name="auth/setup" />
        <Stack.Screen name="auth/staff-register" />
        <Stack.Screen name="author" options={{ headerShown: false }} />
      </Stack>
      <TourOverlay />
    </>
  );
}

// Separate component to access theme context
function ThemedToast() {
  const { isDark } = useTheme();
  return (
    <View style={{ 
      position: 'absolute', 
      top: 0, 
      left: 0, 
      right: 0, 
      zIndex: 999999, 
      elevation: 999999,
      pointerEvents: 'box-none' 
    }}>
      <Toast 
        config={toastConfig(isDark)} 
        position="top"
        topOffset={60}
        visibilityTime={4000}
      />
    </View>
  );
}

// Notifies AppReadyContext once the splash is gone
function SplashDoneNotifier({ showSplash }: { showSplash: boolean }) {
  const { setSplashDone } = useAppReady();
  useEffect(() => {
    if (!showSplash) setSplashDone();
  }, [showSplash]);
  return null;
}

export default function RootLayout() {
  const [showSplash, setShowSplash] = useState(true);
  const fontsLoaded = useFonts();

  // Don't render anything until fonts are loaded
  if (!fontsLoaded) {
    return null;
  }

  return (
    <ErrorBoundary>
      <AppReadyProvider>
        <ThemeProvider>
          <AuthProvider>
            <SetupGuideProvider>
              <TourProvider>
                <RootLayoutNav />
                {showSplash && (
                  <SplashScreenAnimation onFinish={() => {
                    setShowSplash(false);
                  }} />
                )}
                <SplashDoneNotifier showSplash={showSplash} />
                <SetupGuideOverlay />
                <ThemedToast />
              </TourProvider>
            </SetupGuideProvider>
          </AuthProvider>
        </ThemeProvider>
      </AppReadyProvider>
    </ErrorBoundary>
  );
}