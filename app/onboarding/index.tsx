import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, {
    Easing,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withSequence,
    withTiming,
} from 'react-native-reanimated';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '../../context/ThemeContext';

const { width } = Dimensions.get('window');

const LINES = [
  'Welcome to Insightory.',
  "Let's help you and your business\nachieve real-time inventory intelligence",
  '— track stock, predict demand,\nscan products, and get AI-powered alerts\nbefore you run out.',
];

// Duration each line is visible (ms)
const LINE_DURATION = 2200;
// Fade in / out duration
const FADE_DURATION = 600;

export default function OnboardingWelcome() {
  const { theme, isDark } = useTheme();
  const router = useRouter();

  // Shared values for each line
  const opacities = [
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
  ];
  const translateYs = [
    useSharedValue(18),
    useSharedValue(18),
    useSharedValue(18),
  ];

  // Logo
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.85);

  // Overall container fade-out at the end
  const containerOpacity = useSharedValue(1);

  const navigated = useRef(false);

  const goToSetup = () => {
    if (navigated.current) return;
    navigated.current = true;
    router.replace('/onboarding/setup' as any);
  };

  useEffect(() => {
    // Logo fades in first
    logoOpacity.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.quad) });
    logoScale.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.back(1.4)) });

    // Animate each line sequentially
    LINES.forEach((_, i) => {
      const startDelay = 600 + i * (LINE_DURATION + FADE_DURATION);

      opacities[i].value = withDelay(
        startDelay,
        withSequence(
          withTiming(1, { duration: FADE_DURATION, easing: Easing.out(Easing.quad) }),
          withDelay(
            LINE_DURATION,
            withTiming(0, { duration: FADE_DURATION, easing: Easing.in(Easing.quad) })
          )
        )
      );

      translateYs[i].value = withDelay(
        startDelay,
        withSequence(
          withTiming(0, { duration: FADE_DURATION, easing: Easing.out(Easing.quad) }),
          withDelay(
            LINE_DURATION,
            withTiming(-10, { duration: FADE_DURATION, easing: Easing.in(Easing.quad) })
          )
        )
      );
    });

    // After all lines finish, fade out and navigate
    const totalDuration =
      600 + LINES.length * (LINE_DURATION + FADE_DURATION) + 400;

    const timer = setTimeout(() => {
      containerOpacity.value = withTiming(
        0,
        { duration: 500, easing: Easing.in(Easing.quad) },
        () => runOnJS(goToSetup)()
      );
    }, totalDuration);

    return () => clearTimeout(timer);
  }, []);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <Animated.View style={[styles.container, containerStyle]}>
        {/* Logo */}
        <Animated.View style={[styles.logoWrap, logoStyle]}>
          <Image
            source={
              isDark
                ? require('../../assets/images/Logo.png')
                : require('../../assets/images/Logo_Light.png')
            }
            style={styles.logo}
            contentFit="contain"
          />
        </Animated.View>

        {/* Animated text lines */}
        <View style={styles.textArea}>
          {LINES.map((line, i) => {
            // eslint-disable-next-line react-hooks/rules-of-hooks
            const lineStyle = useAnimatedStyle(() => ({
              opacity: opacities[i].value,
              transform: [{ translateY: translateYs[i].value }],
            }));

            return (
              <Animated.View key={i} style={[styles.lineWrap, lineStyle]}>
                <ThemedText
                  style={[
                    styles.lineText,
                    i === 0 && styles.lineTextLarge,
                    i === 2 && styles.lineTextSmall,
                    { color: i === 0 ? theme.text : theme.subtext },
                  ]}
                >
                  {line}
                </ThemedText>
              </Animated.View>
            );
          })}
        </View>

        {/* Subtle winding line decoration */}
        <View style={styles.decorRow}>
          {Array.from({ length: 5 }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.decorDot,
                {
                  backgroundColor: theme.primary,
                  opacity: 0.15 + i * 0.12,
                  width: 6 + i * 2,
                  height: 6 + i * 2,
                  borderRadius: (6 + i * 2) / 2,
                },
              ]}
            />
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 36,
  },
  logoWrap: {
    marginBottom: 48,
  },
  logo: {
    width: 80,
    height: 80,
  },
  textArea: {
    width: '100%',
    alignItems: 'center',
    minHeight: 160,
    justifyContent: 'center',
  },
  lineWrap: {
    position: 'absolute',
    width: width - 72,
    alignItems: 'center',
  },
  lineText: {
    fontSize: 18,
    textAlign: 'center',
    lineHeight: 28,
    letterSpacing: 0.2,
  },
  lineTextLarge: {
    fontSize: 26,
    lineHeight: 34,
    letterSpacing: 0.4,
  },
  lineTextSmall: {
    fontSize: 15,
    lineHeight: 24,
  },
  decorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 80,
  },
  decorDot: {},
});
