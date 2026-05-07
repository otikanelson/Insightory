import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import Toast from 'react-native-toast-message';
import { API_URL } from '../config/api';
import axios from '../utils/axiosConfig';
import { migrateAdminPins } from '../utils/pinMigration';

type UserRole = 'admin' | 'staff' | 'viewer' | null;

interface User {
  id: string;
  name: string;
  role: UserRole;
  storeId?: string;
  storeName?: string;
  isAuthor?: boolean;
  permissions?: {
    viewProducts?: boolean;
    scanProducts?: boolean;
    registerProducts?: boolean;
    addProducts?: boolean;
    processSales?: boolean;
  };
}

interface AuthContextType {
  user: User | null;
  role: UserRole;
  isAuthenticated: boolean;
  loading: boolean;
  login: (pin: string, userRole: 'admin' | 'staff') => Promise<boolean>;
  logout: () => Promise<void>;
  hasPermission: (action: string) => boolean;
  checkAuth: () => Promise<void>;
  updateSession: () => Promise<void>;
  verifySecurityPIN: (pin: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  // Check authentication status on app load
  const checkAuth = async () => {
    try {
      // Run PIN migration before checking auth
      await migrateAdminPins();

      const [userRole, userId, userName, sessionToken, lastLogin, storeId, storeName, userPermissions] = await AsyncStorage.multiGet([
        'auth_user_role',
        'auth_user_id',
        'auth_user_name',
        'auth_session_token',
        'auth_last_login',
        'auth_store_id',
        'auth_store_name',
        'auth_user_permissions',
      ]);

      const roleValue = userRole[1] as UserRole;
      const idValue = userId[1];
      const nameValue = userName[1];
      const tokenValue = sessionToken[1];
      const lastLoginValue = lastLogin[1];
      const storeIdValue = storeId[1];
      const storeNameValue = storeName[1];
      const permissionsValue = userPermissions[1];

      if (roleValue && idValue && tokenValue) {
        // Check if session is still valid (30 minutes)
        const sessionTimeout = 30 * 60 * 1000; // 30 minutes in ms
        const lastLoginTime = lastLoginValue ? parseInt(lastLoginValue) : 0;
        const elapsed = Date.now() - lastLoginTime;

        if (elapsed < sessionTimeout) {
          // Parse stored permissions if available
          let storedPermissions = {};
          if (permissionsValue) {
            try {
              storedPermissions = JSON.parse(permissionsValue);
            } catch {}
          }

          setUser({
            id: idValue,
            name: nameValue || 'User',
            role: roleValue,
            storeId: storeIdValue || undefined,
            storeName: storeNameValue || undefined,
            isAuthor: roleValue === 'admin' && idValue === 'author',
            permissions: storedPermissions,
          });
          setRole(roleValue);
          setIsAuthenticated(true);
        } else {
          // Session expired
          await logout();
        }
      }
    } catch (error) {
      console.error('Error checking auth:', error);
    } finally {
      setLoading(false);
    }
  };

  // Update session timestamp (call this on user activity)
  const updateSession = async () => {
    try {
      await AsyncStorage.setItem('auth_last_login', Date.now().toString());
    } catch (error) {
      console.error('Error updating session:', error);
    }
  };

  // Login function - now uses backend API with comprehensive error handling
  const login = async (pin: string, userRole: 'admin' | 'staff'): Promise<boolean> => {
    try {
      // Try backend API first
      try {
        console.log('🔐 Attempting login to:', `${API_URL}/auth/login`);
        console.log('🔐 Role:', userRole);
        
        const response = await axios.post(`${API_URL}/auth/login`, {
          pin,
          role: userRole
        }, {
          timeout: 30000 // Increased to 30 seconds for Vercel cold starts
        });

        console.log('✅ Login response:', response.data);

        if (response.data.success) {
          const { user: userData, sessionToken } = response.data.data;

          // Prepare storage items
          const storageItems: [string, string][] = [
            ['auth_session_token', sessionToken],
            ['auth_user_role', userData.role],
            ['auth_user_id', userData.id],
            ['auth_user_name', userData.name],
            ['auth_last_login', Date.now().toString()],
            ['auth_store_id', userData.storeId || ''],
            ['auth_store_name', userData.storeName || ''],
            ['onboarding_complete', 'true'], // Mark onboarding as complete on successful login
          ];

          // Store Security PIN for admin users if provided
          if (userData.role === 'admin' && userData.securityPin) {
            storageItems.push(['admin_security_pin', userData.securityPin]);
            // Also set admin_last_auth to avoid immediate Security PIN prompt
            storageItems.push(['admin_last_auth', Date.now().toString()]);
          }

          // Cache the login PIN locally for offline PIN verification features
          // (PIN update, security PIN reset, etc.)
          storageItems.push(['admin_login_pin', pin]);

          // Persist permissions for staff users
          if (userData.role === 'staff' && userData.permissions) {
            storageItems.push(['auth_user_permissions', JSON.stringify(userData.permissions)]);
          }

          // Cache staff login PIN locally for offline PIN verification
          if (userData.role === 'staff') {
            storageItems.push(['staff_login_pin', pin]);
          }

          // Store auth data including store information
          await AsyncStorage.multiSet(storageItems);

          setUser({
            ...userData,
            isAuthor: userData.role === 'admin' && userData.id === 'author',
            permissions: userData.permissions || {},
          });
          setRole(userData.role);
          setIsAuthenticated(true);

          Toast.show({
            type: 'success',
            text1: 'Welcome Back!',
            text2: `Logged in as ${userData.name}`,
          });

          return true;
        } else {
          // Backend returned unsuccessful response
          throw new Error(response.data.error || 'Login failed');
        }
      } catch (apiError: any) {
        // Comprehensive error handling for different failure types
        console.error('❌ Login API Error:', apiError);
        console.error('❌ Error response:', apiError.response?.data);
        console.error('❌ Error status:', apiError.response?.status);
        console.error('❌ Error code:', apiError.code);
        
        let errorMessage = 'Could not connect to server';
        let shouldFallbackToLocal = false;

        if (apiError.response) {
          // Server responded with error status
          const status = apiError.response.status;
          const serverError = apiError.response.data?.error;

          if (status === 401) {
            // Invalid credentials - don't fallback to local
            errorMessage = serverError || 'Invalid PIN';
          } else if (status === 404) {
            // User not found - try local storage
            errorMessage = 'User not found';
            shouldFallbackToLocal = true;
          } else if (status >= 500) {
            // Server error - try local storage
            errorMessage = 'Server error, using offline mode';
            shouldFallbackToLocal = true;
          } else {
            errorMessage = serverError || 'Login failed';
            shouldFallbackToLocal = true;
          }
        } else if (apiError.code === 'ECONNABORTED') {
          // Timeout - try local storage
          errorMessage = 'Connection timeout, using offline mode';
          shouldFallbackToLocal = true;
        } else if (apiError.code === 'ERR_NETWORK' || !apiError.response) {
          // Network error - try local storage
          errorMessage = 'Network error, using offline mode';
          shouldFallbackToLocal = true;
        } else {
          // Unknown error - try local storage
          errorMessage = apiError.message || 'Unknown error occurred';
          shouldFallbackToLocal = true;
        }

        // Fallback to local storage if appropriate
        if (shouldFallbackToLocal) {
          
          let isValid = false;
          let userId = '';
          let userName = '';

          try {
            if (userRole === 'admin') {
              // Validate admin Login PIN from local cache
              const storedLoginPin = await AsyncStorage.getItem('admin_login_pin');
              if (pin === storedLoginPin) {
                isValid = true;
                userId = 'admin_001';
                const storedName = await AsyncStorage.getItem('auth_user_name');
                userName = storedName || 'Admin';
              }
            } else if (userRole === 'staff') {
              // Validate staff PIN from local cache
              const staffPin = await AsyncStorage.getItem('staff_login_pin');
              const staffId = await AsyncStorage.getItem('auth_staff_id');
              const staffName = await AsyncStorage.getItem('auth_staff_name');
              
              if (pin === staffPin && staffId) {
                isValid = true;
                userId = staffId;
                userName = staffName || 'Staff';
              }
            }

            if (isValid) {
              // Generate session token
              const sessionToken = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
              
              // Get store info if available
              const storeId = await AsyncStorage.getItem('auth_store_id');
              const storeName = await AsyncStorage.getItem('auth_store_name');
              
              // Store auth data
              await AsyncStorage.multiSet([
                ['auth_session_token', sessionToken],
                ['auth_user_role', userRole],
                ['auth_user_id', userId],
                ['auth_user_name', userName],
                ['auth_last_login', Date.now().toString()],
                ['onboarding_complete', 'true'], // Mark onboarding as complete on successful login
              ]);

              setUser({ 
                id: userId, 
                name: userName, 
                role: userRole,
                storeId: storeId || undefined,
                storeName: storeName || undefined,
                isAuthor: false,
              });
              setRole(userRole);
              setIsAuthenticated(true);

              Toast.show({
                type: 'success',
                text1: 'Welcome Back!',
                text2: `Logged in as ${userName} (Offline)`,
              });

              return true;
            }
          } catch (localError) {
            console.error('Local storage authentication failed:', localError);
          }
        }

        // If we get here, authentication failed
        Toast.show({
          type: 'error',
          text1: 'Access Denied',
          text2: errorMessage,
        });
        return false;
      }
    } catch (error: any) {
      // Catch-all for any unexpected errors
      console.error('Unexpected login error:', error);
      Toast.show({
        type: 'error',
        text1: 'Login Failed',
        text2: 'An unexpected error occurred',
      });
      return false;
    }
  };

  // Logout function
  const logout = async () => {
    try {
      console.log('🚪 [LOGOUT] Starting logout...');
      
      // Preserve keys that should survive logout
      const onboardingStatus = await AsyncStorage.getItem('onboarding_complete');
      const setupStatus = await AsyncStorage.getItem('admin_first_setup');
      
      console.log('🚪 [LOGOUT] Keys before logout:');
      console.log('  - onboarding_complete:', onboardingStatus);
      console.log('  - admin_first_setup:', setupStatus);
      
      await AsyncStorage.multiRemove([
        'auth_session_token',
        'auth_last_login',
        'auth_user_role',
        'auth_user_id',
        'auth_user_name',
        'auth_store_id',
        'auth_store_name',
        'auth_user_permissions',
        'admin_last_auth',
        'admin_login_pin',
        'staff_login_pin',
      ]);

      // Restore preserved keys after clearing auth data
      const keysToRestore: [string, string][] = [];
      if (onboardingStatus) {
        keysToRestore.push(['onboarding_complete', onboardingStatus]);
      }
      if (setupStatus) {
        keysToRestore.push(['admin_first_setup', setupStatus]);
      }
      
      if (keysToRestore.length > 0) {
        await AsyncStorage.multiSet(keysToRestore);
        console.log('🚪 [LOGOUT] Restored keys:', keysToRestore.map(k => k[0]).join(', '));
      }

      setUser(null);
      setRole(null);
      setIsAuthenticated(false);

      console.log('🚪 [LOGOUT] Logout complete');

      Toast.show({
        type: 'success',
        text1: 'Logged Out',
        text2: 'Session ended successfully',
      });
    } catch (error) {
      console.error('Logout error:', error);
      Toast.show({
        type: 'error',
        text1: 'Logout Failed',
        text2: 'Could not end session',
      });
    }
  };

  // Check if user has permission for an action
  const hasPermission = (action: string): boolean => {
    // Admin has all permissions
    if (role === 'admin') return true;

    // Staff permissions based on their assigned permissions
    if (role === 'staff' && user?.permissions) {
      const permissionMap: Record<string, keyof typeof user.permissions> = {
        view: 'viewInventory',
        viewInventory: 'viewInventory',
        add: 'addProducts',
        addProducts: 'addProducts',
        edit: 'editProducts',
        editProducts: 'editProducts',
        delete: 'deleteProducts',
        deleteProducts: 'deleteProducts',
        sell: 'processSales',
        processSales: 'processSales',
        scan: 'scanBarcodes',
        scanBarcodes: 'scanBarcodes',
        viewAnalytics: 'viewAnalytics',
        exportData: 'exportData',
        manageCategories: 'manageCategories',
      };

      const permKey = permissionMap[action];
      return permKey ? user.permissions[permKey] === true : false;
    }

    // Viewer role (read-only)
    if (role === 'viewer') {
      return action === 'view' || action === 'viewInventory';
    }

    return false;
  };

  // Verify Security PIN for sensitive operations (product registration, deletion)
  const verifySecurityPIN = async (pin: string): Promise<boolean> => {
    try {
      if (!user) {
        console.error('No user logged in');
        return false;
      }

      // For admin users, verify against local admin_security_pin
      if (user.role === 'admin') {
        const storedSecurityPin = await AsyncStorage.getItem('admin_security_pin');
        if (pin === storedSecurityPin) {
          return true;
        } else {
          Toast.show({
            type: 'error',
            text1: 'Access Denied',
            text2: 'Incorrect Admin Security PIN',
          });
          return false;
        }
      }

      // For staff users, verify against admin's Security PIN via backend
      if (user.role === 'staff' && user.storeId) {
        try {
          const response = await axios.post(`${API_URL}/auth/verify-admin-security-pin`, {
            pin,
            storeId: user.storeId
          });

          if (response.data.success) {
            return true;
          } else {
            Toast.show({
              type: 'error',
              text1: 'Access Denied',
              text2: 'Incorrect Admin Security PIN',
            });
            return false;
          }
        } catch (error: any) {
          // Fallback to local storage if backend is unavailable
          const storedSecurityPin = await AsyncStorage.getItem('admin_security_pin');
          if (pin === storedSecurityPin) {
            return true;
          } else {
            Toast.show({
              type: 'error',
              text1: 'Access Denied',
              text2: 'Incorrect Admin Security PIN (Offline)',
            });
            return false;
          }
        }
      }

      return false;
    } catch (error) {
      console.error('Error verifying Security PIN:', error);
      Toast.show({
        type: 'error',
        text1: 'Verification Failed',
        text2: 'Could not verify Security PIN',
      });
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isAuthenticated,
        loading,
        login,
        logout,
        hasPermission,
        checkAuth,
        updateSession,
        verifySecurityPIN,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
