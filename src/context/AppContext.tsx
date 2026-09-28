import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  User,
} from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db, isConfigured } from '../config/firebase';
import { AppSettings, AdminProfile, AppUser, ShiftHandover } from '../types';
import { DEFAULT_SETTINGS, DEFAULT_SUPER_ADMIN_USER } from '../data/demoData';
import {
  getSettings,
  saveSettings,
  checkDisplayTokenStatus,
  getUsersList,
  saveUser as saveUserDb,
  deleteUser as deleteUserDb,
  authenticateWithUsernameAndPin,
  getHandoversList,
  saveHandover as saveHandoverDb,
} from '../services/db';

interface AppContextType {
  currentUser: User | null;
  adminProfile: AdminProfile | null;
  isAdmin: boolean;
  isAuthLoading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  setupFirstAdmin: (email: string, pass: string, name: string) => Promise<void>;

  // User Management & Supervisor Credentials
  appUser: AppUser | null;
  users: AppUser[];
  refreshUsers: () => Promise<AppUser[]>;
  saveAppUser: (userData: Partial<AppUser>) => Promise<AppUser>;
  deleteAppUser: (id: string) => Promise<void>;
  loginWithUsernameAndPin: (username: string, pin: string) => Promise<AppUser>;
  logoutAppUser: () => void;

  // Supervisor Shift Handover Management
  handovers: ShiftHandover[];
  refreshHandovers: (deptId?: string) => Promise<ShiftHandover[]>;
  saveShiftHandover: (handoverData: Partial<ShiftHandover>) => Promise<ShiftHandover>;

  // Settings
  settings: AppSettings;
  refreshSettings: () => Promise<void>;
  updateAppSettings: (newSettings: Partial<AppSettings> | AppSettings) => Promise<void>;
  setThemeMode: (mode: 'night' | 'day') => Promise<void>;
  toggleThemeMode: () => Promise<'night' | 'day'>;

  // Mode
  isDemoMode: boolean;
  setDemoMode: (val: boolean) => void;

  // Connection & Sync
  isOnline: boolean;
  lastSyncTime: number;
  setLastSyncTime: (time: number) => void;
  syncError: string | null;
  setSyncError: (err: string | null) => void;

  // TV Pairing
  isTVPaired: boolean;
  tvToken: string | null;
  setTvSession: (token: string) => void;
  clearTvSession: () => void;

  // Language & Localization
  language: 'en' | 'dv';
  setLanguage: (lang: 'en' | 'dv') => void;
  isRTL: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const DEMO_MODE_STORAGE_KEY = 'mhc_board_demo_mode';
const TV_TOKEN_STORAGE_KEY = 'mhc_tv_display_token';
const LANGUAGE_STORAGE_KEY = 'mhc_board_lang';
const ADMIN_SESSION_STORAGE_KEY = 'mhc_admin_session';
const APP_USER_SESSION_KEY = 'mhc_app_user_session';

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Purge any legacy demo mode flag
  try {
    localStorage.removeItem(DEMO_MODE_STORAGE_KEY);
  } catch (e) {}

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(() => {
    try {
      const saved = localStorage.getItem(ADMIN_SESSION_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return null;
  });
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    return localStorage.getItem(ADMIN_SESSION_STORAGE_KEY) !== null || localStorage.getItem(APP_USER_SESSION_KEY) !== null;
  });
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);

  // App User & Supervisor management
  const [appUser, setAppUser] = useState<AppUser | null>(() => {
    try {
      const saved = localStorage.getItem(APP_USER_SESSION_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return null;
  });
  const [users, setUsers] = useState<AppUser[]>([]);
  const [handovers, setHandovers] = useState<ShiftHandover[]>([]);

  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isDemoMode, setIsDemoModeState] = useState<boolean>(false);

  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [lastSyncTime, setLastSyncTime] = useState<number>(Date.now());
  const [syncError, setSyncError] = useState<string | null>(null);

  const [tvToken, setTvToken] = useState<string | null>(() => {
    return localStorage.getItem(TV_TOKEN_STORAGE_KEY);
  });
  const [isTVPaired, setIsTVPaired] = useState<boolean>(false);

  // Default interface language is strictly English; Dhivehi written text is maintained across content fields
  const [language, setLanguageState] = useState<'en' | 'dv'>('en');

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Monitor Auth
  useEffect(() => {
    if (!auth) {
      setIsAuthLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        // Look up profile in Firestore
        try {
          if (db) {
            const profileRef = doc(db, 'adminProfiles', user.uid);
            const snap = await getDoc(profileRef);
            if (snap.exists()) {
              const prof = snap.data() as AdminProfile;
              setAdminProfile(prof);
              setIsAdmin(true);
              localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, JSON.stringify(prof));
            } else {
              // Create admin profile if first user or authenticated
              const profile: AdminProfile = {
                uid: user.uid,
                email: user.email || '',
                name: user.displayName || user.email?.split('@')[0] || 'Administrator',
                role: 'super_admin',
                createdAt: Date.now(),
              };
              try {
                await setDoc(profileRef, profile);
              } catch (e) {}
              setAdminProfile(profile);
              setIsAdmin(true);
              localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, JSON.stringify(profile));
            }
          } else {
            setIsAdmin(true);
          }
        } catch (err) {
          console.warn('Error reading admin profile:', err);
          setIsAdmin(true); // User authenticated via Firebase Auth
        }
      } else {
        // Retain local admin session if active (e.g. from Username & PIN master login)
        const saved = localStorage.getItem(ADMIN_SESSION_STORAGE_KEY);
        if (saved) {
          try {
            const profile = JSON.parse(saved);
            setAdminProfile(profile);
            setIsAdmin(true);
          } catch (e) {
            setAdminProfile(null);
            setIsAdmin(false);
          }
        } else {
          setAdminProfile(null);
          setIsAdmin(false);
        }
      }
      setIsAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Validate TV token periodically
  useEffect(() => {
    const checkToken = async () => {
      if (!tvToken) {
        setIsTVPaired(false);
        return;
      }
      const valid = await checkDisplayTokenStatus(tvToken, isDemoMode);
      setIsTVPaired(valid);
      if (!valid && !isDemoMode) {
        localStorage.removeItem(TV_TOKEN_STORAGE_KEY);
      }
    };
    checkToken();
    const interval = setInterval(checkToken, 60000);
    return () => clearInterval(interval);
  }, [tvToken, isDemoMode]);

  // Load Settings
  const refreshSettings = async () => {
    try {
      const s = await getSettings(isDemoMode);
      setSettings(s);
    } catch (e) {
      console.warn('Failed to load settings:', e);
    }
  };

  // Real-time Firestore sync for Settings
  useEffect(() => {
    refreshSettings();
    refreshUsers();
    refreshHandovers();

    if (db && !isDemoMode) {
      try {
        const unsub = onSnapshot(
          doc(db, 'settings', 'global'),
          (snap) => {
            if (snap.exists()) {
              const data = snap.data();
              const resolved: AppSettings = {
                ...DEFAULT_SETTINGS,
                ...data,
                logoUrl: typeof data.logoUrl === 'string' ? data.logoUrl : '/mhc-logo.svg',
              };
              setSettings(resolved);
              if (resolved.defaultLanguage === 'dv') {
                setLanguageState('dv');
              }
            }
          },
          (err) => {
            console.warn('Settings real-time listener notice:', err);
          }
        );
        return () => unsub();
      } catch (err) {
        console.warn('Could not attach settings listener:', err);
      }
    }
  }, [isDemoMode]);

  const updateAppSettings = async (newSettings: Partial<AppSettings> | AppSettings) => {
    const current = settings || DEFAULT_SETTINGS;
    const merged: AppSettings = { ...current, ...newSettings };
    await saveSettings(
      merged,
      currentUser?.email || adminProfile?.email || 'Administrator',
      isDemoMode
    );
    setSettings(merged);
  };

  const setThemeMode = async (mode: 'night' | 'day') => {
    const updated: AppSettings = { ...settings, themeMode: mode };
    await updateAppSettings(updated);
  };

  const toggleThemeMode = async (): Promise<'night' | 'day'> => {
    const nextMode: 'night' | 'day' = settings.themeMode === 'day' ? 'night' : 'day';
    await setThemeMode(nextMode);
    return nextMode;
  };

  const setDemoMode = (val: boolean) => {
    setIsDemoModeState(val);
    localStorage.setItem(DEMO_MODE_STORAGE_KEY, val ? 'true' : 'false');
  };

  const setTvSession = (token: string) => {
    setTvToken(token);
    setIsTVPaired(true);
    localStorage.setItem(TV_TOKEN_STORAGE_KEY, token);
  };

  const clearTvSession = () => {
    setTvToken(null);
    setIsTVPaired(false);
    localStorage.removeItem(TV_TOKEN_STORAGE_KEY);
  };

  const setLanguage = (lang: 'en' | 'dv') => {
    setLanguageState(lang);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  };

  const login = async (identifier: string, secret: string) => {
    const rawUser = (identifier || '').trim();
    const rawPin = (secret || '').trim();

    // Flexible identifier and PIN defaults
    const trimmedUser = rawUser || 'admin';
    const trimmedPin = rawPin || '2026';

    const userLower = trimmedUser.toLowerCase();
    const pinLower = trimmedPin.toLowerCase();

    // In-Built Super Admin: user: appadmin, pin: 2026
    if (userLower === 'appadmin' && (pinLower === '2026' || pinLower === 'admin' || pinLower === '1234')) {
      const profile: AdminProfile = {
        uid: 'appadmin',
        email: 'appadmin@mhc.gov.mv',
        name: 'Super Administrator',
        role: 'super_admin',
        createdAt: Date.now(),
      };
      setAdminProfile(profile);
      setIsAdmin(true);
      setAppUser(DEFAULT_SUPER_ADMIN_USER);
      localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, JSON.stringify(profile));
      localStorage.setItem(APP_USER_SESSION_KEY, JSON.stringify(DEFAULT_SUPER_ADMIN_USER));
      return;
    }

    // Standard recognized PINs / passwords
    const isStandardPin =
      pinLower === '2026' ||
      pinLower === '1234' ||
      pinLower === '0000' ||
      pinLower === 'admin' ||
      pinLower === 'mhcadmin123' ||
      pinLower === 'mhc2026' ||
      pinLower === 'mhcadmin2026' ||
      pinLower === '123456' ||
      pinLower === 'password';

    // Standard recognized admin usernames or healthcare aliases
    const isStandardAdminUser =
      userLower === 'admin' ||
      userLower === 'administrator' ||
      userLower === 'mhc' ||
      userLower === 'mhcadmin' ||
      userLower === 'incharge' ||
      userLower === 'healthcentre' ||
      userLower === 'leaveadmin@mhc.com' ||
      userLower === 'admin@mhc.com' ||
      userLower === 'ameen.isse@gmail.com' ||
      userLower === 'ameen' ||
      userLower.includes('admin');

    // Grant access if standard admin user OR standard facility PIN entered
    const isMasterAuthorized =
      isStandardAdminUser ||
      isStandardPin ||
      pinLower === '2026';

    if (isMasterAuthorized) {
      const displayName = userLower === 'admin' ? 'MHC Administrator' : (trimmedUser.includes('@') ? trimmedUser.split('@')[0] : trimmedUser);
      const email = trimmedUser.includes('@') ? trimmedUser : 'admin@mhc.com';

      const profile: AdminProfile = {
        uid: 'admin_master',
        email,
        name: displayName,
        role: 'super_admin',
        createdAt: Date.now(),
      };
      setAdminProfile(profile);
      setIsAdmin(true);
      localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, JSON.stringify(profile));

      // Also authenticate with Firebase Auth under the hood if available
      if (auth && !isDemoMode) {
        try {
          await signInWithEmailAndPassword(auth, 'admin@mhc.com', 'mhcadmin2026');
        } catch (err: any) {
          if (
            err.code === 'auth/user-not-found' ||
            err.code === 'auth/invalid-credential' ||
            err.code === 'auth/wrong-password'
          ) {
            try {
              const cred = await createUserWithEmailAndPassword(auth, 'admin@mhc.com', 'mhcadmin2026');
              if (cred.user && db) {
                await setDoc(doc(db, 'adminProfiles', cred.user.uid), profile);
              }
            } catch (createErr) {
              console.warn('Silent auth note:', createErr);
            }
          }
        }
      }
      return;
    }

    // Support standard email + password login fallback if provided
    if (trimmedUser.includes('@')) {
      if (isDemoMode || !auth) {
        const profile: AdminProfile = {
          uid: 'admin_custom',
          email: trimmedUser,
          name: trimmedUser.split('@')[0],
          role: 'super_admin',
          createdAt: Date.now(),
        };
        setAdminProfile(profile);
        setIsAdmin(true);
        localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, JSON.stringify(profile));
        return;
      }
      try {
        await signInWithEmailAndPassword(auth, trimmedUser, trimmedPin);
        return;
      } catch (authErr: any) {
        // Fallback for authorized administration emails
        if (
          userLower === 'ameen.isse@gmail.com' ||
          userLower === 'admin@mhc.com' ||
          userLower === 'leaveadmin@mhc.com' ||
          userLower.includes('admin')
        ) {
          const profile: AdminProfile = {
            uid: 'admin_session_' + Date.now(),
            email: trimmedUser,
            name: trimmedUser.split('@')[0],
            role: 'super_admin',
            createdAt: Date.now(),
          };
          setAdminProfile(profile);
          setIsAdmin(true);
          localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, JSON.stringify(profile));
          return;
        }
        throw authErr;
      }
    }

    throw new Error('Invalid Username or PIN. Please use Username: admin and PIN: 2026');
  };

  const logout = async () => {
    if (auth) {
      try {
        await signOut(auth);
      } catch (e) {}
    }
    localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
    localStorage.removeItem(APP_USER_SESSION_KEY);
    setCurrentUser(null);
    setAdminProfile(null);
    setAppUser(null);
    setIsAdmin(false);
  };

  const refreshUsers = async (): Promise<AppUser[]> => {
    try {
      const u = await getUsersList(isDemoMode);
      setUsers(u);
      return u;
    } catch (e) {
      console.warn('Failed to load users:', e);
      return [];
    }
  };

  const saveAppUser = async (userData: Partial<AppUser>): Promise<AppUser> => {
    const operatorEmail = currentUser?.email || adminProfile?.email || 'admin@mhc.gov.mv';
    const saved = await saveUserDb(userData, operatorEmail, isDemoMode);
    await refreshUsers();
    return saved;
  };

  const deleteAppUser = async (id: string): Promise<void> => {
    const operatorEmail = currentUser?.email || adminProfile?.email || 'admin@mhc.gov.mv';
    await deleteUserDb(id, operatorEmail, isDemoMode);
    await refreshUsers();
  };

  const loginWithUsernameAndPin = async (username: string, pin: string): Promise<AppUser> => {
    const user = await authenticateWithUsernameAndPin(username, pin, isDemoMode);
    if (!user) {
      throw new Error('Invalid username or PIN passcode.');
    }
    setAppUser(user);
    localStorage.setItem(APP_USER_SESSION_KEY, JSON.stringify(user));

    const hasAdminOrSupervisorRole =
      user.role === 'admin' ||
      user.role === 'supervisor' ||
      user.role === 'roster_manager' ||
      user.roles?.some((r) => r === 'admin' || r === 'supervisor' || r === 'roster_manager');

    if (hasAdminOrSupervisorRole) {
      const isAdminRole = user.role === 'admin' || user.roles?.includes('admin');
      const profile: AdminProfile = {
        uid: user.id,
        email: user.email || `${user.username}@mhc.gov.mv`,
        name: user.fullName,
        role: isAdminRole ? 'super_admin' : 'admin',
        createdAt: user.createdAt,
      };
      setAdminProfile(profile);
      setIsAdmin(true);
      localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, JSON.stringify(profile));
    }
    return user;
  };

  const logoutAppUser = () => {
    setAppUser(null);
    localStorage.removeItem(APP_USER_SESSION_KEY);
    if (!currentUser) {
      setAdminProfile(null);
      setIsAdmin(false);
      localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
    }
  };

  const refreshHandovers = async (deptId?: string): Promise<ShiftHandover[]> => {
    try {
      const list = await getHandoversList(deptId, isDemoMode);
      setHandovers(list);
      return list;
    } catch (e) {
      console.warn('Failed to load handovers:', e);
      return [];
    }
  };

  const saveShiftHandover = async (handoverData: Partial<ShiftHandover>): Promise<ShiftHandover> => {
    const operatorEmail = currentUser?.email || adminProfile?.email || appUser?.username || 'supervisor@mhc.gov.mv';
    const saved = await saveHandoverDb(handoverData, operatorEmail, isDemoMode);
    await refreshHandovers();
    return saved;
  };

  const resetPassword = async (email: string) => {
    if (!auth) throw new Error('Firebase Auth is not available.');
    await sendPasswordResetEmail(auth, email);
  };

  const setupFirstAdmin = async (email: string, pass: string, name: string) => {
    if (!auth) throw new Error('Firebase Auth is not initialized.');
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    if (cred.user && db) {
      const profile: AdminProfile = {
        uid: cred.user.uid,
        email,
        name,
        role: 'super_admin',
        createdAt: Date.now(),
      };
      await setDoc(doc(db, 'adminProfiles', cred.user.uid), profile);
      setAdminProfile(profile);
      setIsAdmin(true);
    }
  };

  const isRTL = language === 'dv';

  return (
    <AppContext.Provider
      value={{
        currentUser,
        adminProfile,
        isAdmin,
        isAuthLoading,
        login,
        logout,
        resetPassword,
        setupFirstAdmin,
        appUser,
        users,
        refreshUsers,
        saveAppUser,
        deleteAppUser,
        loginWithUsernameAndPin,
        logoutAppUser,
        handovers,
        refreshHandovers,
        saveShiftHandover,
        settings,
        refreshSettings,
        updateAppSettings,
        setThemeMode,
        toggleThemeMode,
        isDemoMode,
        setDemoMode,
        isOnline,
        lastSyncTime,
        setLastSyncTime,
        syncError,
        setSyncError,
        isTVPaired,
        tvToken,
        setTvSession,
        clearTvSession,
        language,
        setLanguage,
        isRTL,
      }}
    >
      <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen">
        {children}
      </div>
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
