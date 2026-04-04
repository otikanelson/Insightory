import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View
} from "react-native";
import { AIStatusIndicator } from '../components/AIStatusIndicator';
import { useTheme } from '../context/ThemeContext';

export default function AIInfoScreen() {
  const router = useRouter();
  const { theme, isDark } = useTheme();

    const [aiStatus, setAiStatus] = useState<any>(null);

  useEffect(() => {
    fetchAIStatus();
  }, []);

  const fetchAIStatus = async () => {
    try {
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/analytics/ai-status`
      );
      if (response.data.success) {
        setAiStatus(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching AI status:', error);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surface }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          AI Predictions
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Status Card */}
        <AIStatusIndicator />

        {/* What is AI Predictions */}
        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="information-circle" size={24} color={theme.primary} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              What are AI Predictions?
            </Text>
          </View>
          <Text style={[styles.sectionText, { color: theme.subtext }]}>
            StockQ uses artificial intelligence to analyze your sales history and inventory patterns. 
            The system learns from your data to provide accurate forecasts and recommendations.
          </Text>
        </View>

        {/* How It Works */}
        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="cog" size={24} color={theme.primary} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              How It Works
            </Text>
          </View>
          
          <View style={styles.stepContainer}>
            <View style={styles.step}>
              <View style={[styles.stepNumber, { backgroundColor: theme.primary }]}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={[styles.stepTitle, { color: theme.text }]}>Data Collection</Text>
                <Text style={[styles.stepText, { color: theme.subtext }]}>
                  The system collects data from your product inventory and sales transactions.
                </Text>
              </View>
            </View>

            <View style={styles.step}>
              <View style={[styles.stepNumber, { backgroundColor: theme.primary }]}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={[styles.stepTitle, { color: theme.text }]}>Pattern Analysis</Text>
                <Text style={[styles.stepText, { color: theme.subtext }]}>
                  AI analyzes sales velocity, trends, and seasonal patterns to understand demand.
                </Text>
              </View>
            </View>

            <View style={styles.step}>
              <View style={[styles.stepNumber, { backgroundColor: theme.primary }]}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={[styles.stepTitle, { color: theme.text }]}>Predictions</Text>
                <Text style={[styles.stepText, { color: theme.subtext }]}>
                  Generates forecasts for 7, 14, and 30 days, plus risk scores for each product.
                </Text>
              </View>
            </View>

            <View style={styles.step}>
              <View style={[styles.stepNumber, { backgroundColor: theme.primary }]}>
                <Text style={styles.stepNumberText}>4</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={[styles.stepTitle, { color: theme.text }]}>Recommendations</Text>
                <Text style={[styles.stepText, { color: theme.subtext }]}>
                  Provides actionable suggestions like discounts, restocking, or order adjustments.
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Features */}
        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="sparkles" size={24} color={theme.primary} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Key Features
            </Text>
          </View>

          <FeatureItem
            icon="trending-up"
            title="Demand Forecasting"
            description="Predict how many units you'll sell in the next 7, 14, or 30 days"
            theme={theme}
          />
          <FeatureItem
            icon="alert-circle"
            title="Risk Scoring"
            description="Get risk scores (0-100) for products likely to expire before selling"
            theme={theme}
          />
          <FeatureItem
            icon="speedometer"
            title="Sales Velocity"
            description="Track how fast products are selling (units per day)"
            theme={theme}
          />
          <FeatureItem
            icon="calendar"
            title="Stockout Prediction"
            description="Know exactly when you'll run out of stock at current sales rate"
            theme={theme}
          />
          <FeatureItem
            icon="bulb"
            title="Smart Recommendations"
            description="Get actionable suggestions to reduce waste and maximize profit"
            theme={theme}
          />
        </View>

        {/* Requirements */}
        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="checkmark-done" size={24} color={theme.primary} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Requirements
            </Text>
          </View>
          <Text style={[styles.sectionText, { color: theme.subtext }]}>
            For accurate predictions, the AI needs:
          </Text>
          
          <View style={styles.requirementsList}>
            <RequirementItem
              icon="cube"
              text="At least 10 products in inventory"
              met={aiStatus?.productCount >= 10}
              theme={theme}
            />
            <RequirementItem
              icon="cart"
              text="At least 20 sales transactions"
              met={aiStatus?.salesCount >= 20}
              theme={theme}
            />
            <RequirementItem
              icon="time"
              text="7-14 days of sales history for optimal accuracy"
              met={aiStatus?.daysActive >= 7}
              theme={theme}
            />
          </View>
        </View>

        {/* Privacy */}
        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="shield-checkmark" size={24} color={theme.primary} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Privacy & Security
            </Text>
          </View>
          <Text style={[styles.sectionText, { color: theme.subtext }]}>
            Your data stays on your server. All AI calculations happen on your backend. 
            We don't collect, store, or share any of your business data with third parties.
          </Text>
        </View>

        {/* Accuracy Note */}
        <View style={[styles.noteBox, { backgroundColor: theme.primary + '15', borderColor: theme.primary }]}>
          <Ionicons name="information-circle" size={20} color={theme.primary} />
          <Text style={[styles.noteText, { color: theme.text }]}>
            Predictions improve over time as the AI learns from more data. 
            The more sales history you have, the more accurate the forecasts become.
          </Text>
        </View>
      </ScrollView>
    </View>
    </View>
  );
}

interface FeatureItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  theme: any;
}

const FeatureItem: React.FC<FeatureItemProps> = ({ icon, title, description, theme }) => (
  <View style={styles.featureItem}>
    <View style={[styles.featureIcon, { backgroundColor: theme.primary + '15' }]}>
      <Ionicons name={icon} size={20} color={theme.primary} />
    </View>
    <View style={styles.featureContent}>
      <Text style={[styles.featureTitle, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.featureDescription, { color: theme.subtext }]}>
        {description}
      </Text>
    </View>
  </View>
);

interface RequirementItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  met: boolean;
  theme: any;
}

const RequirementItem: React.FC<RequirementItemProps> = ({ icon, text, met, theme }) => (
  <View style={styles.requirementItem}>
    <Ionicons name={icon} size={18} color={met ? '#34C759' : theme.subtext} />
    <Text style={[styles.requirementText, { color: met ? theme.text : theme.subtext }]}>
      {text}
    </Text>
    {met && <Ionicons name="checkmark-circle" size={18} color="#34C759" />}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  section: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  sectionText: {
    fontSize: 14,
    lineHeight: 22,
  },
  stepContainer: {
    gap: 20,
  },
  step: {
    flexDirection: 'row',
    gap: 12,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  stepText: {
    fontSize: 13,
    lineHeight: 20,
  },
  featureItem: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 13,
    lineHeight: 19,
  },
  requirementsList: {
    marginTop: 12,
    gap: 12,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  requirementText: {
    flex: 1,
    fontSize: 14,
  },
  noteBox: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    marginBottom: 20,
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
  },
});
