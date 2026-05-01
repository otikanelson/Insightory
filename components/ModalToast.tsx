/**
 * ModalToast — renders a toast notification inside a Modal's own layer.
 *
 * On Android, React Native's <Modal> creates a new native window that sits
 * above the JS root view. Any Toast rendered outside the Modal (even with
 * zIndex: 999999) is invisible while the Modal is open. The only fix is to
 * render the toast *inside* the Modal tree.
 *
 * Usage:
 *   const toast = useModalToast();
 *   toast.show({ type: 'error', title: 'Oops', message: 'Something went wrong' });
 *   <ModalToast toast={toast} />
 */

import { Ionicons } from '@expo/vector-icons';
import { useCallback, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { ThemedText } from './ThemedText';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastState {
  visible: boolean;
  type: ToastType;
  title: string;
  message?: string;
}

export interface ModalToastHandle {
  show: (opts: { type: ToastType; title: string; message?: string }) => void;
}

export function useModalToast(): ModalToastHandle {
  const [state, setState] = useState<ToastState>({
    visible: false,
    type: 'info',
    title: '',
    message: '',
  });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    ({ type, title, message }: { type: ToastType; title: string; message?: string }) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setState({ visible: true, type, title, message });
      timerRef.current = setTimeout(() => {
        setState(prev => ({ ...prev, visible: false }));
      }, 3500);
    },
    []
  );

  // Attach state so ModalToast can read it
  (show as any)._state = state;

  return { show };
}

const COLORS: Record<ToastType, string> = {
  success: '#10B981',
  error:   '#EF4444',
  warning: '#F59E0B',
  info:    '#6366F1',
};

const ICONS: Record<ToastType, string> = {
  success: 'checkmark-circle',
  error:   'close-circle',
  warning: 'warning',
  info:    'information-circle',
};

interface ModalToastProps {
  toast: ModalToastHandle;
}

export function ModalToast({ toast }: ModalToastProps) {
  const { theme } = useTheme();
  const state: ToastState = (toast.show as any)._state ?? { visible: false, type: 'info', title: '' };
  const opacity = useRef(new Animated.Value(0)).current;

  // Animate in/out when visibility changes
  Animated.timing(opacity, {
    toValue: state.visible ? 1 : 0,
    duration: 200,
    useNativeDriver: true,
  }).start();

  if (!state.visible && (opacity as any)._value === 0) return null;

  const color = COLORS[state.type];
  const icon = ICONS[state.type];

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: theme.surface,
          borderLeftColor: color,
          opacity,
        },
      ]}
      pointerEvents="none"
    >
      <View style={[styles.iconWrap, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon as any} size={22} color={color} />
      </View>
      <View style={styles.textWrap}>
        <ThemedText style={[styles.title, { color: theme.text }]} numberOfLines={1}>
          {state.title}
        </ThemedText>
        {!!state.message && (
          <ThemedText style={[styles.message, { color: theme.subtext }]} numberOfLines={2}>
            {state.message}
          </ThemedText>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 20,
    zIndex: 9999,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textWrap: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  message: {
    fontSize: 12,
    lineHeight: 16,
  },
});
