import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { useTheme } from '../context/ThemeContext';

interface DisabledButtonProps {
  onPress: () => void;
  disabled: boolean;
  disabledReason?: string;
  isViewOnly?: boolean;
  children: React.ReactNode;
  style?: any;
  textStyle?: any;
  icon?: keyof typeof Ionicons.glyphMap;
  iconSize?: number;
}

export const DisabledButton: React.FC<DisabledButtonProps> = ({
  onPress,
  disabled,
  disabledReason,
  isViewOnly = false,
  children,
  style,
  textStyle,
  icon,
  iconSize = 20,
}) => {
  const { theme } = useTheme();

  const handlePress = () => {
    if (disabled && disabledReason) {
      Toast.show({
        type: isViewOnly ? 'info' : 'error',
        text1: isViewOnly ? 'View-Only Mode' : 'Access Denied',
        text2: disabledReason,
        visibilityTime: 3000,
      });
      return;
    }
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      style={[
        style,
        disabled && styles.disabledButton,
        disabled && { opacity: 0.5 },
      ]}
      android_ripple={disabled ? undefined : { color: theme.primary + '25' }}
    >
      {disabled && (
        <View style={styles.lockBadge}>
          <Ionicons 
            name={isViewOnly ? 'eye-off' : 'lock-closed'} 
            size={12} 
            color="#FFF" 
          />
        </View>
      )}
      {icon && <Ionicons name={icon} size={iconSize} color={disabled ? theme.subtext : textStyle?.color || theme.text} />}
      {typeof children === 'string' ? (
        <Text style={[textStyle, disabled && { color: theme.subtext }]}>{children}</Text>
      ) : (
        children
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  disabledButton: {
    position: 'relative',
  },
  lockBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    borderWidth: 2,
    borderColor: '#FFF',
  },
});
