import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '../../context/ThemeContext';

const FULL_TITLE = 'Welcome to Insightory';
const FULL_BODY =
  "Let's help you and your business achieve real-time inventory intelligence — track stock, predict demand, scan products, and get AI-powered alerts before you run out.";

// Characters typed per second
const TITLE_SPEED = 38; // ms per char
const BODY_SPEED = 22;  // ms per char
// Pause between title finishing and body starting
const PAUSE_AFTER_TITLE = 400;
// Pause after body finishes before navigating
const PAUSE_AFTER_BODY = 1800;

export default function OnboardingWelcome() {
  const { theme } = useTheme();
  const router = useRouter();

  const [titleText, setTitleText] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [titleDone, setTitleDone] = useState(false);

  const navigated = useRef(false);

  // Type out title
  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setTitleText(FULL_TITLE.slice(0, i));
      if (i >= FULL_TITLE.length) {
        clearInterval(interval);
        setTimeout(() => setTitleDone(true), PAUSE_AFTER_TITLE);
      }
    }, TITLE_SPEED);
    return () => clearInterval(interval);
  }, []);

  // Type out body after title is done
  useEffect(() => {
    if (!titleDone) return;
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setBodyText(FULL_BODY.slice(0, i));
      if (i >= FULL_BODY.length) {
        clearInterval(interval);
        setTimeout(() => {
          if (!navigated.current) {
            navigated.current = true;
            router.replace('/onboarding/setup' as any);
          }
        }, PAUSE_AFTER_BODY);
      }
    }, BODY_SPEED);
    return () => clearInterval(interval);
  }, [titleDone]);

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <View style={styles.center}>
        <ThemedText style={[styles.title, { color: theme.text }]}>
          {titleText}
        </ThemedText>
        {titleDone && (
          <ThemedText style={[styles.body, { color: theme.subtext }]}>
            {bodyText}
          </ThemedText>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 36,
    gap: 20,
  },
  title: {
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: 0.3,
  },
  body: {
    fontSize: 16,
    lineHeight: 26,
    letterSpacing: 0.1,
  },
});
