import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
    Dimensions,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    View
} from 'react-native';
import { ThemedText } from '../components/ThemedText';
import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');

interface AIOnboardingModalProps {
  visible: boolean;
  onClose: () => void;
  onLearnMore: () => void;
}

export const AIOnboardingModal: React.FC<AIOnboardingModalProps> = ({
  visible,
  onClose,
  onLearnMore,
}) => {
  const { theme } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: theme.surface }]}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Icon */}
            <View style={[styles.iconContainer, { backgroundColor: theme.primary + '20' }]}>
              <Ionicons name="analytics" size={48} color={theme.primary} />
            </View>

            {/* Title */}
            <ThemedText style={[styles.title, { color: theme.text }]}>
              Welcome to AI-Powered Predictions
            </ThemedText>

            {/* Subtitle */}
            <ThemedText style={[styles.subtitle, { color: theme.subtext }]}>
              Bocksed uses artificial intelligence to help you make smarter inventory decisions
            </ThemedText>

            {/* Features */}
            <View style={styles.featuresContainer}>
              <FeatureItem
                icon="trending-up"
                title="Demand Forecasting"
                description="Predict future sales for 7, 14, and 30 days"
                theme={theme}
              />
              <FeatureItem
                icon="warning"
                title="Risk Detection"
                description="Identify products at risk of expiring"
                theme={theme}
              />
              <FeatureItem
                icon="bulb"
                title="Smart Recommendations"
                description="Get actionable suggestions to reduce waste"
                theme={theme}
              />
            </View>

            {/* Requirements */}
            <View style={[styles.requirementsBox, { backgroundColor: theme.background, borderColor: theme.border }]}>
              <ThemedText style={[styles.requirementsTitle, { color: theme.text }]}>
                To activate AI predictions:
              </ThemedText>
              <View style={styles.requirementItem}>
                <Ionicons name="checkmark-circle" size={20} color={theme.primary} />
                <ThemedText style={[styles.requirementText, { color: theme.subtext }]}>
                  Add at least 10 products to inventory
                </ThemedText>
              </View>
              <View style={styles.requirementItem}>
                <Ionicons name="checkmark-circle" size={20} color={theme.primary} />
                <ThemedText style={[styles.requirementText, { color: theme.subtext }]}>
                  Record at least 20 sales transactions
                </ThemedText>
              </View>
              <View style={styles.requirementItem}>
                <Ionicons name="checkmark-circle" size={20} color={theme.primary} />
                <ThemedText style={[styles.requirementText, { color: theme.subtext }]}>
                  Wait 7-14 days for optimal accuracy
                </ThemedText>
              </View>
            </View>

            {/* Privacy Note */}
            <View style={styles.privacyNote}>
              <Ionicons name="shield-checkmark" size={16} color={theme.subtext} />
              <ThemedText style={[styles.privacyText, { color: theme.subtext }]}>
                Your data stays on your server. We don't collect or share any information.
              </ThemedText>
            </View>

            {/* Actions */}
            <View style={styles.actions}>
              <Pressable
                style={[styles.secondaryButton, { borderColor: theme.border }]}
                onPress={onLearnMore}
              >
                <ThemedText style={[styles.secondaryButtonText, { color: theme.text }]}>
                  Learn More
                </ThemedText>
              </Pressable>
              <Pressable
                style={[styles.primaryButton, { backgroundColor: theme.primary }]}
                onPress={onClose}
              >
                <ThemedText style={styles.primaryButtonText}>Got It!</ThemedText>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

interface FeatureItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  theme: any;
}

const FeatureItem: React.FC<FeatureItemProps> = ({ icon, title, description, theme }) => (
  <View style={styles.featureItem}>
    <View style={[styles.featureIcon, { backgroundColor: theme.primary + '15' }]}>
      <Ionicons name={icon} size={24} color={theme.primary} />
    </View>
    <View style={styles.featureText}>
      <ThemedText style={[styles.featureTitle, { color: theme.text }]}>{title}</ThemedText>
      <ThemedText style={[styles.featureDescription, { color: theme.subtext }]}>
        {description}
      </ThemedText>
    </View>
  </View>
);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    width: width - 40,
    maxWidth: 500,
    borderRadius: 24,
    maxHeight: '90%',
  },
  scrollContent: {
    padding: 24,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 30,
  },
  featuresContainer: {
    gap: 16,
    marginBottom: 24,
  },
  featureItem: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  requirementsBox: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  requirementsTitle: {
    fontSize: 15,
    marginBottom: 12,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  requirementText: {
    fontSize: 14,
    flex: 1,
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  privacyText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 16,
    },
  secondaryButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 2,
  },
  secondaryButtonText: {
    fontSize: 16,
    },
});

