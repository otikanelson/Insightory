import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface DisabledFeatureOverlayProps {
  reason: string;
  isViewOnly?: boolean;
}

export const DisabledFeatureOverlay: React.FC<DisabledFeatureOverlayProps> = ({ 
  reason, 
  isViewOnly = false 
}) => {
  const { theme } = useTheme();
  const bgColor = isViewOnly ? '#FF9500' : '#FF3B30';

  return (
    <View style={[styles.overlay, { backgroundColor: bgColor + 'F5' }]}>
      <View style={styles.content}>
        <View style={[styles.iconCircle, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
          <Ionicons 
            name={isViewOnly ? 'eye-off' : 'lock-closed'} 
            size={48} 
            color="#FFF" 
          />
        </View>
        <Text style={styles.title}>
          {isViewOnly ? 'VIEW-ONLY MODE' : 'ACCESS DENIED'}
        </Text>
        <Text style={styles.message}>{reason}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    zIndex: 1000,
  },
  content: {
    alignItems: 'center',
    maxWidth: 300,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: 1,
  },
  message: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 22,
  },
});
