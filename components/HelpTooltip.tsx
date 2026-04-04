import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { lineHeight } from '../constants/spacing';
import { useTheme } from '../context/ThemeContext';

// Define glossary of terms with their definitions
const GLOSSARY: Record<string, { title: string; definition: string }> = {
  'risk score': {
    title: 'Risk Score',
    definition: 'Numbers from 0-100 showing how likely a product will expire before selling. High (70+) means urgent - product may waste soon. Medium (50-69) needs monitoring. Low (<50) is healthy stock moving well.',
  },
  'risk scores': {
    title: 'Risk Score',
    definition: 'Numbers from 0-100 showing how likely a product will expire before selling. High (70+) means urgent - product may waste soon. Medium (50-69) needs monitoring. Low (<50) is healthy stock moving well.',
  },
  'velocity': {
    title: 'Velocity',
    definition: 'How fast products sell, measured in units per day. Example: 5.2 units/day means you sell about 5 units daily. Higher velocity = faster sales.',
  },
  'confidence': {
    title: 'Confidence',
    definition: 'How sure the AI is about its prediction (0-100%). Predictions above 80% confidence are more reliable. Low confidence means AI needs more sales data to be accurate.',
  },
  'accuracy': {
    title: 'Accuracy',
    definition: 'Shows how often AI predictions are correct. 87% overall means AI is right 87 times out of 100. High confidence predictions (when AI is very sure) are 92% accurate.',
  },
  'fefo': {
    title: 'FEFO Logic',
    definition: 'First-Expired-First-Out: Automatically sells products closest to expiry date first to minimize waste. The system picks which batch to deduct from based on expiry dates.',
  },
};

interface HelpTooltipProps {
  title: string;
  content: string | string[]; // Can be a single string or array of paragraphs
  icon?: keyof typeof Ionicons.glyphMap;
  iconSize?: number;
  iconColor?: string;
  style?: object;
}

export const HelpTooltip = ({
  title,
  content,
  icon = 'help-circle-outline',
  iconSize = 20,
  iconColor,
  style,
}: HelpTooltipProps): JSX.Element => {
  const { theme } = useTheme();
  const [showModal, setShowModal] = useState(false);
  const [showGlossary, setShowGlossary] = useState(false);
  const [selectedTerm, setSelectedTerm] = useState<{ title: string; definition: string } | null>(null);

  const contentArray = Array.isArray(content) ? content : [content];

  // Function to parse text and identify glossary terms
  const parseTextWithLinks = (text: string) => {
    const parts: Array<{ text: string; isLink: boolean; term?: string }> = [];
    let remainingText = text;
    
    // Sort terms by length (longest first) to match longer phrases first
    const sortedTerms = Object.keys(GLOSSARY).sort((a, b) => b.length - a.length);
    
    while (remainingText.length > 0) {
      let foundMatch = false;
      
      for (const term of sortedTerms) {
        const lowerText = remainingText.toLowerCase();
        const index = lowerText.indexOf(term.toLowerCase());
        
        if (index !== -1) {
          // Add text before the match
          if (index > 0) {
            parts.push({ text: remainingText.substring(0, index), isLink: false });
          }
          
          // Add the matched term as a link
          parts.push({
            text: remainingText.substring(index, index + term.length),
            isLink: true,
            term: term,
          });
          
          remainingText = remainingText.substring(index + term.length);
          foundMatch = true;
          break;
        }
      }
      
      if (!foundMatch) {
        parts.push({ text: remainingText, isLink: false });
        break;
      }
    }
    
    return parts;
  };

  const handleTermPress = (term: string) => {
    const glossaryEntry = GLOSSARY[term.toLowerCase()];
    if (glossaryEntry) {
      setSelectedTerm(glossaryEntry);
      setShowGlossary(true);
    }
  };

  return (
    <>
      <Pressable onPress={() => setShowModal(true)} style={style}>
        <Ionicons name={icon} size={iconSize} color={iconColor || theme.primary} />
      </Pressable>

      {/* Main Help Modal */}
      <Modal visible={showModal} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={[styles.modal, { backgroundColor: theme.surface }]}>
            <View style={[styles.iconContainer, { backgroundColor: theme.primary + '20' }]}>
              <Ionicons name="information-circle" size={32} color={theme.primary} />
            </View>

            <Text style={[styles.title, { color: theme.text }]}>{title}</Text>

            <ScrollView
              style={styles.contentScroll}
              showsVerticalScrollIndicator={false}
            >
              {contentArray.map((paragraph, index) => {
                const parts = parseTextWithLinks(paragraph);
                
                return (
                  <View
                    key={index}
                    style={[
                      styles.paragraphContainer,
                      index < contentArray.length - 1 && styles.paragraphSpacing,
                    ]}
                  >
                    <View style={styles.bulletPoint}>
                      <View style={[styles.bullet, { backgroundColor: theme.primary }]} />
                    </View>
                    <View style={styles.paragraphContent}>
                      <Text style={[styles.content, { color: theme.text }]}>
                        {parts.map((part, partIndex) =>
                          part.isLink ? (
                            <Text
                              key={partIndex}
                              style={[styles.linkText, { color: theme.primary }]}
                              onPress={() => handleTermPress(part.term!)}
                            >
                              {part.text}
                            </Text>
                          ) : (
                            <Text key={partIndex}>{part.text}</Text>
                          )
                        )}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            <Pressable
              style={[styles.closeButton, { backgroundColor: theme.primary }]}
              onPress={() => setShowModal(false)}
            >
              <Text style={styles.closeButtonText}>Got It</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Glossary Definition Modal */}
      <Modal visible={showGlossary} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={[styles.glossaryModal, { backgroundColor: theme.surface }]}>
            <View style={[styles.glossaryHeader, { borderBottomColor: theme.border }]}>
              <View style={[styles.glossaryIconContainer, { backgroundColor: theme.primary + '15' }]}>
                <Ionicons name="book-outline" size={24} color={theme.primary} />
              </View>
              <Text style={[styles.glossaryTitle, { color: theme.text }]}>
                {selectedTerm?.title}
              </Text>
              <Pressable
                onPress={() => setShowGlossary(false)}
                style={styles.glossaryCloseButton}
              >
                <Ionicons name="close" size={24} color={theme.subtext} />
              </Pressable>
            </View>

            <View style={styles.glossaryContent}>
              <Text style={[styles.glossaryDefinition, { color: theme.text }]}>
                {selectedTerm?.definition}
              </Text>
            </View>

            <Pressable
              style={[styles.glossaryBackButton, { backgroundColor: theme.background, borderColor: theme.border }]}
              onPress={() => setShowGlossary(false)}
            >
              <Ionicons name="arrow-back" size={16} color={theme.primary} />
              <Text style={[styles.glossaryBackText, { color: theme.primary }]}>
                Back to Help
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '85%',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 20,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  contentScroll: {
    maxHeight: 400,
    width: '100%',
  },
  paragraphContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
  },
  paragraphSpacing: {
    marginBottom: 16,
  },
  bulletPoint: {
    paddingTop: 4,
    marginRight: 12,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  paragraphContent: {
    flex: 1,
  },
  content: {
    fontSize: 15,
    lineHeight: lineHeight.body * 15,
    textAlign: 'left',
    fontWeight: '500',
  },
  linkText: {
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  closeButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  closeButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  
  // Glossary Modal Styles
  glossaryModal: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  glossaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  glossaryIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  glossaryTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  glossaryCloseButton: {
    padding: 4,
  },
  glossaryContent: {
    padding: 24,
  },
  glossaryDefinition: {
    fontSize: 15,
    lineHeight: lineHeight.body * 15,
    fontWeight: '500',
  },
  glossaryBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    margin: 20,
    marginTop: 0,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  glossaryBackText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
