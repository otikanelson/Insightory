import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '../../components/ThemedText';
import { useAppReady } from '../../context/AppReadyContext';
import { useTheme } from '../../context/ThemeContext';

const FADE_DURATION = 900;    // ms for each fade-in
const PAUSE_BETWEEN = 300;    // ms gap between title and body
const PAUSE_BEFORE_LOGO = 400; // ms pause before logo slides in
const LOGO_SLIDE_DURATION = 600; // ms for logo slide animation
const PAUSE_BEFORE_BUTTON = 300; // ms pause before button fades in

export default function OnboardingWelcome() {
  const { theme, isDark } = useTheme();
  const { splashDone } = useAppReady();
  const router = useRouter();

  const titleOpacity = useRef(new Animated.Value(0)).current;
  const bodyOpacity = useRef(new Animated.Value(0)).current;
  const logoTranslateX = useRef(new Animated.Value(-200)).current; // Start off-screen left
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(0.9)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    if (!splashDone) return; // wait until splash overlay is gone

    // Fade in title → pause → fade in body → pause → slide in logo → pause → fade in button
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
      Animated.delay(PAUSE_BEFORE_LOGO),
      Animated.parallel([
        Animated.timing(logoTranslateX, {
          toValue: 0,
          duration: LOGO_SLIDE_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: LOGO_SLIDE_DURATION,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(PAUSE_BEFORE_BUTTON),
      Animated.parallel([
        Animated.timing(buttonOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.spring(buttonScale, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]),
    ]);

    animationRef.current.start();

    return () => {
      animationRef.current?.stop();
    };
  }, [splashDone]);

  const handleGetStarted = () => {
    if (isNavigating) return;
    setIsNavigating(true);
    
    // Animate button press and navigate
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(() => {
      router.push('/onboarding/pitch');
    });
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <View style={styles.center}>
        <Animated.View 
          style={{ 
            opacity: logoOpacity,
            transform: [{ translateX: logoTranslateX }],
            marginBottom: 30,
          }}
        >
          <Image
            source={isDark ? require('../../assets/images/icon.png') : require('../../assets/images/icon_light.png')}
            style={styles.logo}
            contentFit="contain"
          />
        </Animated.View>
        
        <Animated.View style={{ opacity: titleOpacity }}>
          <ThemedText style={[styles.title, { color: theme.text }]}>
            Welcome to Bocksed
          </ThemedText>
        </Animated.View>
        <Animated.View style={{ opacity: bodyOpacity }}>
          <ThemedText style={[styles.body, { color: theme.subtext }]}>
            Let's help you and your business achieve real-time inventory
            intelligence — track stock, predict demand, scan products, and get
            AI-powered alerts before you run out.
          </ThemedText>
        </Animated.View>
        <Animated.View 
          style={{ 
            opacity: buttonOpacity,
            transform: [{ scale: buttonScale }],
          }}
        >
          <Pressable
            style={[styles.button, { backgroundColor: theme.primary }]}
            onPress={handleGetStarted}
            disabled={isNavigating}
          >
            <ThemedText style={styles.buttonText}>
              Get Started
            </ThemedText>
          </Pressable>
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
  logo: {
    width: 100,
    height: 100,
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
  button: {
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 30,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
});
