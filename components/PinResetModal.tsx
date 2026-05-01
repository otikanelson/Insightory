import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { ModalToast, useModalToast } from './ModalToast';
import { ThemedText } from './ThemedText';

interface PinResetModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title?: string;
  message?: string;
}

export function PinResetModal({
  visible,
  onClose,
  onSuccess,
  title = 'Reset Security PIN',
  message = 'Enter your Login PIN to remove the current Security PIN. You can set a new one in settings.',
}: PinResetModalProps) {
  const { theme } = useTheme();
  const toast = useModalToast();
  const [loginPin, setLoginPin] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);

  const handleReset = async () => {
    if (loginPin.length !== 4) {
      toast.show({ type: 'error', title: 'Invalid PIN', message: 'Please enter your 4-digit Login PIN' });
      return;
    }

    setIsLoading(true);
    try {
      const storedLoginPin = await AsyncStorage.getItem('admin_login_pin');

      if (!storedLoginPin) {
        toast.show({
          type: 'error',
          title: 'Session Expired',
          message: 'Log out and log back in, then try again',
        });
        setIsLoading(false);
        return;
      }

      if (loginPin !== storedLoginPin) {
        toast.show({ type: 'error', title: 'Incorrect Login PIN', message: 'The PIN you entered is wrong' });
        setIsLoading(false);
        return;
      }

      await AsyncStorage.removeItem('admin_security_pin');
      await AsyncStorage.removeItem('admin_last_auth');

      toast.show({ type: 'success', title: 'Security PIN Removed', message: 'Set a new one in settings' });

      // Small delay so user sees the success toast before modal closes
      setTimeout(() => {
        setLoginPin('');
        onSuccess();
      }, 1200);
    } catch (error) {
      console.error('Error resetting Security PIN:', error);
      toast.show({ type: 'error', title: 'Reset Failed', message: 'Could not remove Security PIN' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setLoginPin('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
          <View style={[styles.modalIconBox, { backgroundColor: theme.primary + '15' }]}>
            <Ionicons name="key-outline" size={32} color={theme.primary} />
          </View>

          <ThemedText style={[styles.modalTitle, { color: theme.text }]}>{title}</ThemedText>

          <ThemedText style={[styles.modalMessage, { color: theme.subtext }]}>{message}</ThemedText>

          <View style={styles.inputContainer}>
            <ThemedText style={[styles.inputLabel, { color: theme.text }]}>Enter Login PIN:</ThemedText>
            <TextInput
              style={[styles.textInput, {
                backgroundColor: theme.background,
                borderColor: theme.border,
                color: theme.text,
                textAlign: 'center',
                fontSize: 18,
                letterSpacing: 8,
              }]}
              value={loginPin}
              onChangeText={setLoginPin}
              placeholder="••••"
              placeholderTextColor={theme.subtext}
              keyboardType="numeric"
              maxLength={4}
              secureTextEntry
              autoFocus
            />
          </View>

          <View style={styles.modalActions}>
            <Pressable
              style={[styles.modalBtn, {
                backgroundColor: theme.background,
                borderWidth: 1,
                borderColor: theme.border,
              }]}
              onPress={handleClose}
              disabled={isLoading}
            >
              <ThemedText style={{ color: theme.text }}>Cancel</ThemedText>
            </Pressable>

            <Pressable
              style={[styles.modalBtn, {
                backgroundColor: loginPin.length === 4 && !isLoading ? theme.primary : theme.border,
                opacity: loginPin.length === 4 && !isLoading ? 1 : 0.5,
              }]}
              onPress={handleReset}
              disabled={loginPin.length !== 4 || isLoading}
            >
              {isLoading
                ? <ThemedText style={{ color: '#FFF' }}>Removing...</ThemedText>
                : <ThemedText style={{ color: '#FFF' }}>Remove PIN</ThemedText>
              }
            </Pressable>
          </View>
        </View>

        {/* Toast rendered inside the Modal layer */}
        <ModalToast toast={toast} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    padding: 30,
    borderRadius: 30,
    alignItems: 'center',
  },
  modalIconBox: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 10,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 25,
    lineHeight: 20,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  textInput: {
    height: 50,
    borderWidth: 1,
    borderRadius: 15,
    paddingHorizontal: 15,
    fontSize: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
    width: '100%',
  },
  modalBtn: {
    flex: 1,
    height: 50,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
