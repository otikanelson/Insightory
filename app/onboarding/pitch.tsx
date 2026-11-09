import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Animated, Dimensions, Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '../../components/ThemedText';
import { useTheme } from '../../context/ThemeContext';

const { width } = Dimensions.get('window');

interface PitchSlide {
  imageUrl: string | any;
  title: string;
  description: string;
}

export default function PitchScreen() {
  const { theme, isDark } = useTheme();
  
  const pitchSlides: PitchSlide[] = [
    {
      imageUrl: require('../../assets/images/frustrated.png'),
      title: 'Frustrated with your current inventory management?',
      description: 'Manual tracking, stockouts, and expired products costing you money?',
    },
    {
      imageUrl: isDark ? require('../../assets/images/icon.png') : require('../../assets/images/icon_light.png'),
      title: 'Meet Bocksed',
      description: 'Your intelligent inventory companion powered by AI and real-time analytics.',
    },
    {
      imageUrl: require('../../assets/images/scan.png'),
      title: 'Scan your business data',
      description: 'Track, predict, and optimize your inventory with data-driven intelligence.',
    },
    {
      imageUrl: require('../../assets/images/business.png'),
      title: 'Ready to transform your business?',
      description: 'Join businesses already saving time and money with Bocksed.',
    },
  ];
  const router = useRouter();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [fadeAnim] = useState(new Animated.Value(1));
  const [scaleAnim] = useState(new Animated.Value(1));
  const [imageRotateAnim] = useState(new Animated.Value(0));

  const isLastSlide = currentSlide === pitchSlides.length - 1;
  const isFirstSlide = currentSlide === 0;
  const currentPitch = pitchSlides[currentSlide];

  const handleNext = () => {
    if (isLastSlide) {
      // Navigate to setup
      router.push('/auth/setup' as any);
    } else {
      // Fade out, scale down, change slide, fade in, scale up
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Change slide
        setCurrentSlide(currentSlide + 1);
        
        // Fade in and scale up
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 350,
            useNativeDriver: true,
          }),
          Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 8,
            tension: 40,
            useNativeDriver: true,
          }),
        ]).start();
      });
    }
  };

  const handleBack = () => {
    if (isFirstSlide) {
      // Go back to welcome screen
      router.back();
    } else {
      // Go to previous slide
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Change slide
        setCurrentSlide(currentSlide - 1);
        
        // Fade in and scale up
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 350,
            useNativeDriver: true,
          }),
          Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 8,
            tension: 40,
            useNativeDriver: true,
          }),
        ]).start();
      });
    }
  };

  const handleSkip = () => {
    router.push('/auth/setup' as any);
  };

  // Subtle floating animation for images
  React.useEffect(() => {
    const floatAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(imageRotateAnim, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        }),
        Animated.timing(imageRotateAnim, {
          toValue: 0,
          duration: 3000,
          useNativeDriver: true,
        }),
      ])
    );
    floatAnimation.start();
    
    return () => floatAnimation.stop();
  }, []);

  const imageTranslateY = imageRotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -10],
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Skip Button */}
      <Pressable style={styles.skipButton} onPress={handleSkip}>
        <ThemedText style={[styles.skipText, { color: theme.subtext }]}>
          Skip
        </ThemedText>
      </Pressable>

      {/* Content */}
      <Animated.View 
        style={[
          styles.content, 
          { 
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          }
        ]}
      >
        {/* Illustration */}
        <Animated.View 
          style={[
            styles.illustrationContainer,
            {
              transform: [{ translateY: imageTranslateY }],
            }
          ]}
        >
          <Image
            source={typeof currentPitch.imageUrl === 'string' ? { uri: currentPitch.imageUrl } : currentPitch.imageUrl}
            style={styles.illustration}
            contentFit="contain"
          />
        </Animated.View>

        {/* Title */}
        <ThemedText style={[styles.title, { color: theme.text }]}>
          {currentPitch.title}
        </ThemedText>

        {/* Description */}
        <ThemedText style={[styles.description, { color: theme.subtext }]}>
          {currentPitch.description}
        </ThemedText>
      </Animated.View>

      {/* Bottom Section */}
      <View style={styles.bottomSection}>
        {/* Progress Dots */}
        <View style={styles.dotsContainer}>
          {pitchSlides.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                {
                  backgroundColor:
                    index === currentSlide ? theme.primary : theme.border,
                  width: index === currentSlide ? 24 : 8,
                },
              ]}
            />
          ))}
        </View>

        {/* Navigation Buttons */}
        <View style={styles.navigationButtons}>
          {/* Back Button - Only show if not first slide */}
          {!isFirstSlide && (
            <Pressable
              style={[
                styles.backButton,
                { 
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                }
              ]}
              onPress={handleBack}
            >
              <Ionicons name="arrow-back" size={24} color={theme.text} />
            </Pressable>
          )}

          {/* Next Button */}
          <Pressable
            style={[
              styles.nextButton, 
              { backgroundColor: theme.primary },
              !isFirstSlide && styles.nextButtonWithBack
            ]}
            onPress={handleNext}
          >
            <ThemedText style={styles.nextButtonText}>
              {isLastSlide ? "Get Started" : "Next"}
            </ThemedText>
            <Ionicons name="arrow-forward" size={20} color="#FFF" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    paddingBottom: 40,
  },
  skipButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  skipText: {
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  illustrationContainer: {
    width: width * 0.65,
    height: width * 0.65,
    marginBottom: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  illustration: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 36,
    letterSpacing: 0.3,
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    letterSpacing: 0.2,
  },
  bottomSection: {
    paddingHorizontal: 30,
    gap: 24,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  navigationButtons: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  backButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  nextButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  nextButtonWithBack: {
    // When back button is visible, next button takes remaining space
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
