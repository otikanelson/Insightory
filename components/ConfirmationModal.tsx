import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { ModalToast, useModalToast } from './ModalToast';
import { ThemedText } from './ThemedText';

interface ConfirmationModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'warning' | 'danger' | 'info';
  requireStoreNameConfirmation?: boolean;
  storeName?: string;
  onStoreNameChange?: (text: string) => void;
  storeNameValue?: string;
  requirePinConfirmation?: boolean;
  onPinChange?: (text: string) => void;
  pinValue?: string;
  pinPlaceholder?: string;
  isLoading?: boolean;
}

export function ConfirmationModal({
  visible,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'warning',
  requireStoreNameConfirmation = false,
  storeName = '',
  onStoreNameChange,
  storeNameValue = '',
  requirePinConfirmation = false,
  onPinChange,
  pinValue = '',
  pinPlaceholder = 'Enter PIN',
  isLoading = false,
}: ConfirmationModalProps) {
  const { theme } = useTheme();
  const toast = useModalToast();

  const getIconAndColor = () => {
    switch (type) {
      case 'danger':  return { icon: 'warning',            color: '#FF3B30' };
      case 'warning': return { icon: 'alert-circle',       color: '#FF9500' };
      case 'info':    return { icon: 'information-circle', color: theme.primary };
      default:        return { icon: 'alert-circle',       color: '#FF9500' };
    }
  };

  const { icon, color } = getIconAndColor();

  const isConfirmDisabled = () => {
    if (isLoading) return true;
    if (requireStoreNameConfirmation && storeNameValue.trim() !== storeName.trim()) return true;
    if (requirePinConfirmation && pinValue.length !== 4) return true;
    return false;
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
          <View style={[styles.modalIconBox, { backgroundColor: color + '15' }]}>
            <Ionicons name={icon as any} size={32} color={color} />
          </View>

          <ThemedText style={[styles.modalTitle, { color: theme.text }]}>
            {title}
          </ThemedText>

          <ThemedText style={[styles.modalMessage, { color: theme.subtext }]}>
            {message}
          </ThemedText>

          {requireStoreNameConfirmation && (
            <View style={styles.inputContainer}>
              <ThemedText style={[styles.inputLabel, { color: theme.text }]}>
                Type "{storeName}" to confirm:
              </ThemedText>
              <TextInput
                style={[styles.textInput, {
                  backgroundColor: theme.background,
                  borderColor: theme.border,
                  color: theme.text,
                }]}
                value={storeNameValue}
                onChangeText={onStoreNameChange}
                placeholder={`Type ${storeName}`}
                placeholderTextColor={theme.subtext}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          )}

          {requirePinConfirmation && (
            <View style={styles.inputContainer}>
              <ThemedText style={[styles.inputLabel, { color: theme.text }]}>
                {pinPlaceholder}:
              </ThemedText>
              <TextInput
                style={[styles.textInput, {
                  backgroundColor: theme.background,
                  borderColor: theme.border,
                  color: theme.text,
                  textAlign: 'center',
                  fontSize: 18,
                  letterSpacing: 8,
                }]}
                value={pinValue}
                onChangeText={onPinChange}
                placeholder="••••"
                placeholderTextColor={theme.subtext}
                keyboardType="numeric"
                maxLength={4}
                secureTextEntry
              />
            </View>
          )}

          <View style={styles.modalActions}>
            <Pressable
              style={[styles.modalBtn, {
                backgroundColor: theme.background,
                borderWidth: 1,
                borderColor: theme.border,
              }]}
              onPress={onClose}
              disabled={isLoading}
            >
              <ThemedText style={{ color: theme.text }}>{cancelText}</ThemedText>
            </Pressable>

            <Pressable
              style={[styles.modalBtn, {
                backgroundColor: isConfirmDisabled() ? theme.border : color,
                opacity: isConfirmDisabled() ? 0.5 : 1,
              }]}
              onPress={onConfirm}
              disabled={isConfirmDisabled()}
            >
              {isLoading
                ? <ThemedText style={{ color: '#FFF' }}>Loading...</ThemedText>
                : <ThemedText style={{ color: '#FFF' }}>{confirmText}</ThemedText>
              }
            </Pressable>
          </View>
        </View>

        {/* Toast rendered inside the Modal layer so it appears above the overlay */}
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
