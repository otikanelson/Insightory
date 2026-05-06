import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StyleSheet, View, Pressable } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '../../context/ThemeContext';

const OPTIONS = [
  {
    id: 'admin',
    icon: 'shield-checkmark' as const,
    title: 'Create Admin Account',
    description:
      'Set up a new store and become the admin. You get full control over inventory, staff, and settings.',
    accent: '#5B4FE8',
  },
  {
    id: 'staff-new',
    icon: 'person-add' as const,
    title: 'Create Staff Profile',
    description:
      'Register as a staff member on an existing store. You will need the store name and admin PIN to verify.',
    accent: '#10B981',
  },
] as const;

export default function OnboardingSetup() {
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Staggered entrance animations
  const headerOpacity = useSharedValue(0);
  const headerY = useSharedValue(20);
  const card0Opacity = useSharedValue(0);
  const card0Y = useSharedValue(30);
  const card1Opacity = useSharedValue(0);
  const card1Y = useSharedValue(30);

  useEffect(() => {
    headerOpacity.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.quad) });
    headerY.value = withTiming(0, { duration: 500, easing: Easing.out(Easing.quad) });

    card0Opacity.value = withDelay(200, withTiming(1, { duration: 450, easing: Easing.out(Easing.quad) }));
    card0Y.value = withDelay(200, withTiming(0, { duration: 450, easing: Easing.out(Easing.quad) }));

    card1Opacity.value = withDelay(380, withTiming(1, { duration: 450, easing: Easing.out(Easing.quad) }));
    card1Y.value = withDelay(380, withTiming(0, { duration: 450, easing: Easing.out(Easing.quad) }));
  }, []);

  const headerStyle = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
    transform: [{ translateY: headerY.value }],
  }));

  const cardStyles = [
    useAnimatedStyle(() => ({ opacity: card0Opacity.value, transform: [{ translateY: card0Y.value }] })),
    useAnimatedStyle(() => ({ opacity: card1Opacity.value, transform: [{ translateY: card1Y.value }] })),
  ];

  const markOnboardingComplete = async () => {
    await AsyncStorage.setItem('onboarding_complete', 'true');
  };

  const handleSelect = async (id: 'admin' | 'staff-new') => {
    await markOnboardingComplete();
    if (id === 'admin') {
      router.replace('/auth/setup' as any);
    } else {
      // Staff joining an existing store
      router.replace('/auth/staff-register' as any);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      {/* Header */}
      <Animated.View style={[styles.header, headerStyle]}>
        <Image
          source={
            isDark
              ? require('../../assets/images/Logo.png')
              : require('../../assets/images/Logo_Light.png')
          }
          style={styles.logo}
          contentFit="contain"
        />
        <ThemedText style={[styles.heading, { color: theme.text }]}>
          How would you like to get started?
        </ThemedText>
        <ThemedText style={[styles.subheading, { color: theme.subtext }]}>
          Choose the option that fits your role
        </ThemedText>
      </Animated.View>

      {/* Option cards */}
      <View style={styles.cards}>
        {OPTIONS.map((opt, i) => (
          <Animated.View key={opt.id} style={cardStyles[i]}>
            <Pressable
              style={({ pressed }) => [
                styles.card,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                  opacity: pressed ? 0.85 : 1,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                },
              ]}
              onPress={() => handleSelect(opt.id)}
            >
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: opt.accent + '18' },
                ]}
              >
                <Ionicons name={opt.icon} size={32} color={opt.accent} />
              </View>

              <View style={styles.cardText}>
                <ThemedText style={[styles.cardTitle, { color: theme.text }]}>
                  {opt.title}
                </ThemedText>
                <ThemedText style={[styles.cardDesc, { color: theme.subtext }]}>
                  {opt.description}
                </ThemedText>
              </View>

              <Ionicons name="chevron-forward" size={20} color={theme.subtext} />
            </Pressable>
          </Animated.View>
        ))}
      </View>

      {/* Already have an account */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 24 }]}>
        <ThemedText style={[styles.footerLabel, { color: theme.subtext }]}>
          Already have an account?
        </ThemedText>
        <View style={styles.footerButtons}>
          <Pressable
            style={[styles.footerBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={async () => {
              await markOnboardingComplete();
              router.replace('/auth/login?role=admin' as any);
            }}
          >
            <Ionicons name="shield-checkmark-outline" size={18} color={theme.primary} />
            <ThemedText style={[styles.footerBtnText, { color: theme.text }]}>Admin Login</ThemedText>
          </Pressable>
          <Pressable
            style={[styles.footerBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={async () => {
              await markOnboardingComplete();
              router.replace('/auth/login?role=staff' as any);
            }}
          >
            <Ionicons name="people-outline" size={18} color={theme.primary} />
            <ThemedText style={[styles.footerBtnText, { color: theme.text }]}>Staff Login</ThemedText>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 32,
    paddingBottom: 16,
  },
  logo: {
    width: 60,
    height: 60,
    marginBottom: 20,
  },
  heading: {
    fontSize: 24,
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 32,
  },
  subheading: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  cards: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 16,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  cardText: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontSize: 16,
    lineHeight: 22,
  },
  cardDesc: {
    fontSize: 13,
    lineHeight: 19,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    alignItems: 'center',
    gap: 12,
  },
  footerLabel: {
    fontSize: 13,
  },
  footerButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  footerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  footerBtnText: {
    fontSize: 14,
  },
});
