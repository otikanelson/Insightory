import React, { createContext, useContext, useState } from 'react';

interface AppReadyContextType {
  splashDone: boolean;
  setSplashDone: () => void;
}

const AppReadyContext = createContext<AppReadyContextType>({
  splashDone: false,
  setSplashDone: () => {},
});

export const useAppReady = () => useContext(AppReadyContext);

export const AppReadyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [splashDone, setSplashDoneState] = useState(false);
  return (
    <AppReadyContext.Provider value={{ splashDone, setSplashDone: () => setSplashDoneState(true) }}>
      {children}
    </AppReadyContext.Provider>
  );
};
