import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { ThemedText } from '../../components/ThemedText';
import { useAppReady } from '../../context/AppReadyContext';
import { useTheme } from '../../context/ThemeContext';

const FADE_DURATION = 900;    // ms for each fade-in
const PAUSE_BETWEEN = 300;    // ms gap between title and body
const PAUSE_AFTER_BODY = 2200; // ms to linger after body appears

export default function OnboardingWelcome() {
  const { theme } = useTheme();
  const { splashDone } = useAppReady();
  const router = useRouter();

  const titleOpacity = useRef(new Animated.Value(0)).current;
  const bodyOpacity = useRef(new Animated.Value(0)).current;
  const navigated = useRef(false);
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (!splashDone) return; // wait until splash overlay is gone

    // Fade in title → pause → fade in body → linger → navigate
    animationRef.current = Animated.sequence([
      Animated.timing(titleOpacity, {
        toValue: 1,
        duration: FADE_DURATION,
        useNativeDriver: true,
      }),
      Animated.delay(PAUSE_BETWEEN),
      Animated.timing(bodyOpacity, {
        toValue: 1,
        duration: FADE_DURATION,
        useNativeDriver: true,
      }),
      Animated.delay(PAUSE_AFTER_BODY),
    ]);

    animationRef.current.start(() => {
      if (!navigated.current) {
        navigated.current = true;
        router.push('/auth/setup' as any);
      }
    });

    return () => {
      animationRef.current?.stop();
    };
  }, [splashDone]);

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <View style={styles.center}>
        <Animated.View style={{ opacity: titleOpacity }}>
          <ThemedText style={[styles.title, { color: theme.text }]}>
            Welcome to Insightory
          </ThemedText>
        </Animated.View>
        <Animated.View style={{ opacity: bodyOpacity }}>
          <ThemedText style={[styles.body, { color: theme.subtext }]}>
            Let's help you and your business achieve real-time inventory
            intelligence — track stock, predict demand, scan products, and get
            AI-powered alerts before you run out.
          </ThemedText>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 36,
    gap: 20,
  },
  title: {
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  body: {
    fontSize: 16,
    lineHeight: 26,
    letterSpacing: 0.1,
    textAlign: 'center',
  },
});
