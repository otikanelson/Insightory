import { usePathname } from 'expo-router';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

export type SetupRole = 'admin' | 'staff' | null;

export interface GuideStep {
  key: string;        // unique key, e.g. 'store-name', 'admin-name'
  title: string;
  body: string;
  icon: string;
  iconColor: string;
  autoHideMs?: number;
}

// Admin account creation steps — one per internal screen step
const ADMIN_STEPS: GuideStep[] = [
  {
    key: 'welcome',
    title: 'Choose your path',
    body: "Create a new store as an admin, or join an existing store as a staff member.",
    icon: 'hand-right',
    iconColor: '#5B4FE8',
    autoHideMs: 10000, // Give user time to read and choose
  },
  {
    key: 'store-name',
    title: 'Name your store',
    body: "Give your store a name — this is how it'll appear across the app and to your staff.",
    icon: 'storefront',
    iconColor: '#5B4FE8',
  },
  {
    key: 'admin-name',
    title: "What's your name?",
    body: "Enter your name. This shows up in the app so your team knows who the admin is.",
    icon: 'person',
    iconColor: '#5B4FE8',
  },
  {
    key: 'login-pin',
    title: 'Create your Login PIN',
    body: "Pick a 4-digit PIN — you'll enter this every time you open the app.",
    icon: 'log-in',
    iconColor: '#5B4FE8',
  },
  {
    key: 'security-pin',
    title: 'Now a Security PIN',
    body: 'This second PIN protects sensitive actions like deleting products. Keep it different from your Login PIN.',
    icon: 'shield-checkmark',
    iconColor: '#FF9500',
  },
  {
    key: 'complete',
    title: "You're all set! 🎉",
    body: "Your admin account is ready. Tap 'Go to Login' to sign in and start managing your inventory.",
    icon: 'checkmark-circle',
    iconColor: '#34C759',
    autoHideMs: 5000,
  },
];

// Staff registration steps
const STAFF_STEPS: GuideStep[] = [
  {
    key: 'welcome',
    title: 'Join a store',
    body: "You'll need the store name and admin's PIN to join as a staff member.",
    icon: 'hand-right',
    iconColor: '#10B981',
    autoHideMs: 10000,
  },
  {
    key: 'store-verify',
    title: 'Find your store',
    body: "Enter the store name and your admin's Login PIN to verify you're joining the right place.",
    icon: 'storefront',
    iconColor: '#10B981',
  },
  {
    key: 'name',
    title: 'Enter your name',
    body: "Tell us who you are — the admin will see this in the staff list.",
    icon: 'person-add',
    iconColor: '#10B981',
  },
  {
    key: 'permissions',
    title: 'Review your permissions',
    body: "These are the actions you can perform. Your admin may adjust these later.",
    icon: 'shield-half',
    iconColor: '#10B981',
  },
  {
    key: 'pin',
    title: 'Create your PIN',
    body: "Set a 4-digit PIN you'll use to log in. Keep it safe — it can't be recovered if lost.",
    icon: 'key',
    iconColor: '#10B981',
  },
  {
    key: 'complete',
    title: 'Welcome to the team! 🎉',
    body: "You're registered. Tap 'Done' to go to login and start working.",
    icon: 'checkmark-circle',
    iconColor: '#34C759',
    autoHideMs: 5000,
  },
];

interface SetupGuideContextType {
  role: SetupRole;
  isActive: boolean;
  currentStep: GuideStep | null;
  startGuide: (role: SetupRole) => void;
  stopGuide: () => void;
  /** Call when the page moves to a new internal step key */
  showStep: (key: string) => void;
  dismissCurrent: () => void;
}

const SetupGuideContext = createContext<SetupGuideContextType | undefined>(undefined);

export const useSetupGuide = () => {
  const ctx = useContext(SetupGuideContext);
  if (!ctx) throw new Error('useSetupGuide must be used within SetupGuideProvider');
  return ctx;
};

export const SetupGuideProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRole] = useState<SetupRole>(null);
  const [isActive, setIsActive] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const dismissedKeys = useRef<Set<string>>(new Set());
  const pathname = usePathname();

  const steps = role === 'admin' ? ADMIN_STEPS : role === 'staff' ? STAFF_STEPS : [];

  const currentStep = (() => {
    if (!isActive || !activeKey) return null;
    const step = steps.find(s => s.key === activeKey);
    if (!step) return null;
    if (dismissedKeys.current.has(activeKey)) return null;
    return step;
  })();

  const startGuide = (r: SetupRole) => {
    setRole(r);
    setIsActive(true);
    setActiveKey(null);
    dismissedKeys.current = new Set();
  };

  const stopGuide = () => {
    setIsActive(false);
    setRole(null);
    setActiveKey(null);
    dismissedKeys.current = new Set();
  };

  const showStep = (key: string) => {
    dismissedKeys.current.delete(key); // always re-show when explicitly requested
    setActiveKey(key);
  };

  const dismissCurrent = () => {
    if (activeKey) {
      dismissedKeys.current.add(activeKey);
      setActiveKey(null);
    }
  };

  // Stop guide once user leaves auth pages entirely
  useEffect(() => {
    if (!isActive) return;
    if (!pathname.startsWith('/auth/')) stopGuide();
  }, [pathname, isActive]);

  return (
    <SetupGuideContext.Provider
      value={{ role, isActive, currentStep, startGuide, stopGuide, showStep, dismissCurrent }}
    >
      {children}
    </SetupGuideContext.Provider>
  );
};
