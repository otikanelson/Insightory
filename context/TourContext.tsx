import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePathname, useRouter } from 'expo-router';
import React, { createContext, useContext, useEffect, useState } from 'react';

const TOUR_KEY = '@inventease_tour_completed';

interface TourContextType {
  isTourActive: boolean;
  currentStep: number;
  startTour: () => void;
  nextStep: () => void;
  previousStep: () => void;
  skipTour: () => void;
  completeTour: () => void;
  resetTour: () => void;
}

const TourContext = createContext<TourContextType | undefined>(undefined);

export const useTour = () => {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error('useTour must be used within TourProvider');
  }
  return context;
};

// Tour steps with screen navigation and precise coordinates
export const tourSteps = [
  { id: 0, screen: '/(tabs)/', title: 'Welcome!', description: 'Let me show you around your inventory system.', highlight: { x: 0, y: 540, width: 350, height: 80 } },
  { id: 1, screen: '/(tabs)/', title: 'Stats Overview', description: 'See total inventory, expiring items, and low stock alerts.', highlight: { x: 20, y: 130, width: 350, height: 130 } },
  { id: 2, screen: '/(tabs)/', title: 'AI Insights', description: 'Get smart recommendations based on your inventory data.', highlight: { x: 20, y: 305, width: 350, height: 70 } },
  { id: 3, screen: '/(tabs)/', title: 'Quick Actions', description: 'Scan, search, add products, or view statistics.', highlight: { x: 20, y: 490, width: 350, height: 140 } },
  { id: 4, screen: '/(tabs)/', title: 'FEFO Priority', description: 'Products expiring soon appear here first.', highlight: { x: 20, y: 750, width: 350, height: 180 } },
  { id: 5, screen: '/(tabs)/scan', title: 'Scanner', description: 'Scan barcodes instantly - 10x faster than manual entry!', highlight: { x: 0, y: 300, width: 380, height: 400 } },
  { id: 6, screen: '/(tabs)/inventory', title: 'Inventory', description: 'Browse all products. Search, filter, and view details.', highlight: { x: 0, y: 70, width: 390, height: 400 } },
  { id: 7, screen: '/(tabs)/FEFO', title: 'FEFO Queue', description: 'First Expired, First Out! Toggle AI Risk for smart sorting.', highlight: { x: 20, y: 160, width: 390, height: 300 } },
  { id: 8, screen: '/(tabs)/add-products', title: 'Add Products', description: 'Manually add items without barcodes here.', highlight: { x: 20, y: 190, width: 390, height: 400 } },
  { id: 9, screen: '/(tabs)/', title: 'All Set!', description: 'You\'re ready to manage inventory like a pro!', highlight: { x: 20, y: 140, width: 350, height: 80 } },
];

export const TourProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isTourActive, setIsTourActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasCompletedTour, setHasCompletedTour] = useState<boolean | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  // Check if tour was completed
  useEffect(() => {
    checkTourStatus();
  }, []);

  // Auto-start tour if not completed
  useEffect(() => {
    // Check if user is on the main tabs screen (index)
    // The pathname can be '/(tabs)/', '/(tabs)', '/', or '/(tabs)/index'
    const isOnMainScreen = 
      pathname === '/(tabs)/' || 
      pathname === '/(tabs)' || 
      pathname === '/' ||
      pathname === '/(tabs)/index' ||
      pathname.startsWith('/(tabs)') && !pathname.includes('/scan') && !pathname.includes('/inventory') && !pathname.includes('/FEFO') && !pathname.includes('/add-products');
    
    console.log('Tour check - pathname:', pathname, 'isOnMainScreen:', isOnMainScreen, 'hasCompletedTour:', hasCompletedTour);
    
    if (hasCompletedTour === false && isOnMainScreen && !isTourActive) {
      console.log('Auto-starting main tour in 2 seconds');
      const timer = setTimeout(() => {
        console.log('Starting main tour now!');
        startTour();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [hasCompletedTour, pathname, isTourActive]);

  // Navigate to correct screen when step changes
  useEffect(() => {
    if (isTourActive && currentStep < tourSteps.length) {
      const targetScreen = tourSteps[currentStep].screen;
      if (pathname !== targetScreen) {
        router.push(targetScreen as any);
      }
    }
  }, [currentStep, isTourActive]);

  const checkTourStatus = async () => {
    try {
      const completed = await AsyncStorage.getItem(TOUR_KEY);
      const tourCompleted = completed === 'true';
      console.log('Main tour status:', tourCompleted ? 'completed' : 'not completed');
      setHasCompletedTour(tourCompleted);
    } catch (error) {
      console.error('Error checking tour status:', error);
      setHasCompletedTour(false);
    }
  };

  const startTour = () => {
    setIsTourActive(true);
    setCurrentStep(0);
    router.push('/(tabs)');
  };

  const nextStep = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      completeTour();
    }
  };

  const previousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const skipTour = () => {
    completeTour();
  };

  const completeTour = async () => {
    try {
      await AsyncStorage.setItem(TOUR_KEY, 'true');
      setHasCompletedTour(true);
      setIsTourActive(false);
      setCurrentStep(0);
      router.push('/(tabs)');
    } catch (error) {
      console.error('Error completing tour:', error);
    }
  };

  const resetTour = async () => {
    try {
      await AsyncStorage.removeItem(TOUR_KEY);
      setHasCompletedTour(false);
      setIsTourActive(false);
      setCurrentStep(0);
    } catch (error) {
      console.error('Error resetting tour:', error);
    }
  };

  return (
    <TourContext.Provider
      value={{
        isTourActive,
        currentStep,
        startTour,
        nextStep,
        previousStep,
        skipTour,
        completeTour,
        resetTour,
      }}
    >
      {children}
    </TourContext.Provider>
  );
};
