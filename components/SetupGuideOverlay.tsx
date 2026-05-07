import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSetupGuide } from '../context/SetupGuideContext';
import { useTheme } from '../context/ThemeContext';
import { ThemedText } from './ThemedText';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const AUTO_HIDE_DEFAULT = 3500;

export const SetupGuideOverlay: React.FC = () => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { currentStep, dismissCurrent, isActive } = useSetupGuide();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-20)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const autoHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const floatLoop = useRef<Animated.CompositeAnimation | null>(null);

  // Float loop — runs whenever overlay is visible
  const startFloat = () => {
    floatLoop.current?.stop();
    floatLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -5, duration: 1400, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 1400, useNativeDriver: true }),
      ])
    );
    floatLoop.current.start();
  };

  const animateIn = () => {
    fadeAnim.setValue(0);
    slideAnim.setValue(-20);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 320, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 100, friction: 10 }),
    ]).start();
    startFloat();
  };

  const animateOut = (cb?: () => void) => {
    floatLoop.current?.stop();
    if (autoHideTimer.current) clearTimeout(autoHideTimer.current);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 260, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -16, duration: 260, useNativeDriver: true }),
    ]).start(() => cb?.());
  };

  // Animate in/out when currentStep changes
  useEffect(() => {
    if (currentStep) {
      animateIn();
      const delay = currentStep.autoHideMs ?? AUTO_HIDE_DEFAULT;
      autoHideTimer.current = setTimeout(() => {
        animateOut(() => dismissCurrent());
      }, delay);
    } else {
      animateOut();
    }

    return () => {
      if (autoHideTimer.current) clearTimeout(autoHideTimer.current);
    };
  }, [currentStep?.key]);

  const handleDismiss = () => {
    animateOut(() => dismissCurrent());
  };

  if (!isActive || !currentStep) return null;

  const step = currentStep;
  const accent = step.iconColor;

  // Position bubble at top of screen in safe area
  const BUBBLE_WIDTH = SCREEN_WIDTH - 48;
  const bubbleTop = insets.top + 20;
  const bubbleLeft = 24;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.bubbleContainer,
        {
          top: bubbleTop,
          left: bubbleLeft,
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
          zIndex: 99999,
        },
      ]}
    >
      <View
        style={[
          styles.bubble,
          { backgroundColor: theme.surface, borderColor: accent, width: BUBBLE_WIDTH },
        ]}
      >
        {/* Floating AI avatar badge */}
        <Animated.View
          style={[
            styles.badge,
            { borderColor: accent, shadowColor: accent, transform: [{ translateY: floatAnim }] },
          ]}
        >
          <Ionicons name={step.icon as any} size={16} color={accent} />
        </Animated.View>

        <View style={styles.content}>
          {/* Header row */}
          <View style={styles.headerRow}>
            <ThemedText style={[styles.title, { color: theme.text }]} numberOfLines={1}>
              {step.title}
            </ThemedText>
            <Pressable onPress={handleDismiss} hitSlop={10}>
              <Ionicons name="close" size={16} color={theme.subtext} />
            </Pressable>
          </View>

          <ThemedText style={[styles.body, { color: theme.subtext }]}>
            {step.body}
          </ThemedText>

          {/* Auto-hide progress bar */}
          <AutoHideBar
            durationMs={step.autoHideMs ?? AUTO_HIDE_DEFAULT}
            color={accent}
            key={step.key}
          />
        </View>
      </View>
    </Animated.View>
  );
};

// ─── Thin progress bar that drains over the auto-hide duration ────────────────

const AutoHideBar: React.FC<{ durationMs: number; color: string }> = ({ durationMs, color }) => {
  const widthAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    widthAnim.setValue(1);
    Animated.timing(widthAnim, {
      toValue: 0,
      duration: durationMs,
      useNativeDriver: false,
    }).start();
  }, [durationMs]);

  return (
    <View style={styles.barTrack}>
      <Animated.View
        style={[
          styles.barFill,
          {
            backgroundColor: color,
            width: widthAnim.interpolate({
              inputRange: [0, 1],
              outputRange: ['0%', '100%'],
            }),
          },
        ]}
      />
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  bubbleContainer: {
    position: 'absolute',
    elevation: 99999,
  },
  bubble: {
    borderRadius: 16,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 12,
  },
  badge: {
    position: 'absolute',
    top: -14,
    left: 14,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#111',
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 2,
  },
  content: {
    padding: 14,
    paddingTop: 20,
    gap: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 14,
    flex: 1,
    marginRight: 8,
  },
  body: {
    fontSize: 12,
    lineHeight: 17,
  },
  barTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(128,128,128,0.15)',
    marginTop: 8,
    overflow: 'hidden',
  },
  barFill: {
    height: 3,
    borderRadius: 2,
  },
});
