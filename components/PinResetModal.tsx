import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import React from 'react';
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { ModalToast, useModalToast } from './ModalToast';
import { ThemedText } from './ThemedText';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/api';

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
  message = 'Enter your Login PIN to verify identity, then set a new Security PIN.',
}: PinResetModalProps) {
  const { theme } = useTheme();
  const toast = useModalToast();
  const [loginPin, setLoginPin] = React.useState('');
  const [newSecurityPin, setNewSecurityPin] = React.useState('');
  const [confirmSecurityPin, setConfirmSecurityPin] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);

  const handleReset = async () => {
    if (loginPin.length !== 4) {
      toast.show({ type: 'error', title: 'Invalid PIN', message: 'Enter your 4-digit Login PIN' });
      return;
    }
    if (newSecurityPin.length !== 4 || !/^\d{4}$/.test(newSecurityPin)) {
      toast.show({ type: 'error', title: 'Invalid PIN', message: 'New Security PIN must be 4 digits' });
      return;
    }
    if (newSecurityPin !== confirmSecurityPin) {
      toast.show({ type: 'error', title: 'PIN Mismatch', message: 'New PINs do not match' });
      return;
    }

    setIsLoading(true);
    try {
      const token = await AsyncStorage.getItem('auth_session_token');

      // Use the reset endpoint — verifies via login PIN, sets new security PIN in DB
      await axios.post(
        `${API_URL}/auth/admin/reset-security-pin`,
        { loginPin, newSecurityPin },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Update local cache
      await AsyncStorage.setItem('admin_security_pin', newSecurityPin);
      await AsyncStorage.setItem('admin_last_auth', Date.now().toString());

      toast.show({ type: 'success', title: 'Security PIN Reset', message: 'New Security PIN is active' });

      setTimeout(() => {
        setLoginPin('');
        setNewSecurityPin('');
        setConfirmSecurityPin('');
        onSuccess();
      }, 1200);
    } catch (error: any) {
      const msg = error?.response?.data?.error || 'Could not reset Security PIN';
      toast.show({ type: 'error', title: 'Reset Failed', message: msg });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setLoginPin('');
    setNewSecurityPin('');
    setConfirmSecurityPin('');
    onClose();
  };

  const canSubmit = loginPin.length === 4 && newSecurityPin.length === 4 && confirmSecurityPin.length === 4 && !isLoading;

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
            <ThemedText style={[styles.inputLabel, { color: theme.subtext }]}>Login PIN (to verify it's you)</ThemedText>
            <TextInput
              style={[styles.textInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
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

          <View style={styles.inputContainer}>
            <ThemedText style={[styles.inputLabel, { color: theme.subtext }]}>New Security PIN</ThemedText>
            <TextInput
              style={[styles.textInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
              value={newSecurityPin}
              onChangeText={setNewSecurityPin}
              placeholder="••••"
              placeholderTextColor={theme.subtext}
              keyboardType="numeric"
              maxLength={4}
              secureTextEntry
            />
          </View>

          <View style={styles.inputContainer}>
            <ThemedText style={[styles.inputLabel, { color: theme.subtext }]}>Confirm New Security PIN</ThemedText>
            <TextInput
              style={[styles.textInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
              value={confirmSecurityPin}
              onChangeText={setConfirmSecurityPin}
              placeholder="••••"
              placeholderTextColor={theme.subtext}
              keyboardType="numeric"
              maxLength={4}
              secureTextEntry
            />
          </View>

          <View style={styles.modalActions}>
            <Pressable
              style={[styles.modalBtn, { backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border }]}
              onPress={handleClose}
              disabled={isLoading}
            >
              <ThemedText style={{ color: theme.text }}>Cancel</ThemedText>
            </Pressable>

            <Pressable
              style={[styles.modalBtn, { backgroundColor: canSubmit ? theme.primary : theme.border, opacity: canSubmit ? 1 : 0.5 }]}
              onPress={handleReset}
              disabled={!canSubmit}
            >
              <ThemedText style={{ color: '#FFF' }}>
                {isLoading ? 'Resetting...' : 'Reset PIN'}
              </ThemedText>
            </Pressable>
          </View>
        </View>

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
    marginBottom: 20,
    lineHeight: 20,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  textInput: {
    height: 50,
    borderWidth: 1,
    borderRadius: 15,
    paddingHorizontal: 15,
    fontSize: 18,
    textAlign: 'center',
    letterSpacing: 8,
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
