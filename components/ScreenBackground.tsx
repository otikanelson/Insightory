import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface ScreenBackgroundProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

/**
 * ScreenBackground — use as the root <View> of every screen.
 * Provides the base background color + a subtle pink glow at the top-right
 * using accent2 (#e32bd8), the existing pink in the theme.
 */
export function ScreenBackground({ children, style }: ScreenBackgroundProps) {
  const { theme, isDark } = useTheme();

  const glowColors = isDark
    ? ['rgba(227, 43, 216, 0.18)', 'rgba(227, 43, 216, 0.07)', 'transparent'] as const
    : ['rgba(227, 43, 216, 0.11)', 'rgba(227, 43, 216, 0.03)', 'transparent'] as const;

  return (
    <View style={[styles.root, { backgroundColor: theme.background }, style]}>
      <LinearGradient
        colors={glowColors}
        start={{ x: 1, y: 0 }}
        end={{ x: 0.15, y: 0.55 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
