import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  updateProfile as firebaseUpdateProfile,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db, googleProvider, PRIMARY_ADMIN_EMAIL, checkIsAdmin } from '../lib/firebase';
import { UserProfile, UserRole } from '../types';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  phoneNumber?: string | null;
  photoURL?: string | null;
}

interface AuthContextType {
  currentUser: AuthUser | User | null;
  userProfile: UserProfile | null;
  isAdmin: boolean;
  loading: boolean;
  isAuthModalOpen: boolean;
  authModalMode: 'login' | 'register' | 'profile';
  openAuthModal: (mode?: 'login' | 'register' | 'profile') => void;
  closeAuthModal: () => void;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (email: string, pass: string, displayName: string, phoneNumber?: string) => Promise<void>;
  sendSmsOtp: (mobile: string) => Promise<{ expiresInSeconds: number; isRegistered: boolean }>;
  verifySmsOtp: (mobile: string, code: string, displayName?: string) => Promise<{ isNewUser: boolean }>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  updateUserProfileData: (data: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_STORAGE_SESSION_KEY = 'inana_user_session';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AuthUser | User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register' | 'profile'>('login');

  const openAuthModal = (mode: 'login' | 'register' | 'profile' = 'login') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
  };

  // Restore stored session from server auth if available
  const restoreLocalSession = (): boolean => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
      if (!saved) return false;
      const parsed = JSON.parse(saved);
      if (parsed && parsed.user && parsed.user.uid) {
        const u = parsed.user as UserProfile;
        const authUser: AuthUser = {
          uid: u.uid,
          email: u.email,
          displayName: u.displayName,
          phoneNumber: u.phoneNumber,
        };
        setCurrentUser(authUser);
        setUserProfile(u);
        setIsAdmin(checkIsAdmin(u.email, u.role));
        return true;
      }
    } catch (e) {
      console.warn('Failed to parse local session:', e);
    }
    return false;
  };

  // Sync profile from Firestore for Google Auth
  const syncProfile = async (user: User) => {
    try {
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);

      const isPrimaryAdmin = user.email?.toLowerCase().trim() === PRIMARY_ADMIN_EMAIL.toLowerCase().trim();

      if (userSnap.exists()) {
        const data = userSnap.data() as UserProfile;
        const effectiveRole: UserRole = isPrimaryAdmin || data.role === 'admin' ? 'admin' : 'customer';
        const profile: UserProfile = {
          ...data,
          role: effectiveRole,
        };
        setUserProfile(profile);
        setIsAdmin(checkIsAdmin(user.email, profile.role));
      } else {
        const newRole: UserRole = isPrimaryAdmin ? 'admin' : 'customer';
        const initialProfile: UserProfile = {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || 'کاربر گالری اینانا',
          phoneNumber: user.phoneNumber || '',
          role: newRole,
          address: '',
          createdAt: new Date().toISOString(),
        };
        await setDoc(userRef, initialProfile);
        setUserProfile(initialProfile);
        setIsAdmin(checkIsAdmin(user.email, newRole));
      }
    } catch (error) {
      console.error('Error syncing user profile from Firestore:', error);
      const isPrimary = user.email?.toLowerCase().trim() === PRIMARY_ADMIN_EMAIL.toLowerCase().trim();
      const fallbackProfile: UserProfile = {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || 'کاربر گالری اینانا',
        role: isPrimary ? 'admin' : 'customer',
        createdAt: new Date().toISOString(),
      };
      setUserProfile(fallbackProfile);
      setIsAdmin(isPrimary);
    }
  };

  useEffect(() => {
    // 1. Listen for Firebase Auth changes (e.g. Google Sign In)
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setCurrentUser(firebaseUser);
        await syncProfile(firebaseUser);
        setLoading(false);
      } else {
        // 2. If no Firebase user, check if we have a persistent email/password session
        const hasSession = restoreLocalSession();
        if (!hasSession) {
          setCurrentUser(null);
          setUserProfile(null);
          setIsAdmin(false);
        }
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const loginWithEmail = async (email: string, pass: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password: pass }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'ایمیل یا کلمه عبور وارد شده نادرست است.');
    }

    const u: UserProfile = data.user;
    localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify({ user: u, token: data.token }));

    const authUser: AuthUser = {
      uid: u.uid,
      email: u.email,
      displayName: u.displayName,
      phoneNumber: u.phoneNumber,
    };
    setCurrentUser(authUser);
    setUserProfile(u);
    setIsAdmin(checkIsAdmin(u.email, u.role));
    closeAuthModal();
  };

  const registerWithEmail = async (
    email: string,
    pass: string,
    displayName: string,
    phoneNumber?: string
  ) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.trim(),
        password: pass,
        displayName: displayName.trim(),
        phoneNumber: phoneNumber?.trim() || '',
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'خطا در ثبت‌نام حساب کاربری.');
    }

    const u: UserProfile = data.user;
    localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify({ user: u, token: data.token }));

    const authUser: AuthUser = {
      uid: u.uid,
      email: u.email,
      displayName: u.displayName,
      phoneNumber: u.phoneNumber,
    };
    setCurrentUser(authUser);
    setUserProfile(u);
    setIsAdmin(checkIsAdmin(u.email, u.role));
    closeAuthModal();
  };

  const sendSmsOtp = async (mobile: string): Promise<{ expiresInSeconds: number; isRegistered: boolean }> => {
    const res = await fetch('/api/auth/otp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile: mobile.trim() }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'خطا در ارسال کد پیامکی تایید.');
    }

    return {
      expiresInSeconds: data.expiresInSeconds || 180,
      isRegistered: Boolean(data.isRegistered),
    };
  };

  const verifySmsOtp = async (
    mobile: string,
    code: string,
    displayName?: string
  ): Promise<{ isNewUser: boolean }> => {
    const res = await fetch('/api/auth/otp/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mobile: mobile.trim(),
        code: code.trim(),
        displayName: displayName?.trim(),
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'کد تایید وارد شده نامعتبر یا منقضی است.');
    }

    const u: UserProfile = data.user;
    localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify({ user: u, token: data.token }));

    const authUser: AuthUser = {
      uid: u.uid,
      email: u.email,
      displayName: u.displayName,
      phoneNumber: u.phoneNumber,
    };
    setCurrentUser(authUser);
    setUserProfile(u);
    setIsAdmin(checkIsAdmin(u.email, u.role));
    closeAuthModal();

    return { isNewUser: Boolean(data.isNewUser) };
  };

  const loginWithGoogle = async () => {
    // Clear any previous email session before Google login
    localStorage.removeItem(LOCAL_STORAGE_SESSION_KEY);
    const res = await signInWithPopup(auth, googleProvider);
    await syncProfile(res.user);

    // Obtain cryptographically signed Firebase ID token to prove identity to the server
    const idToken = await res.user.getIdToken(true);

    // Sync Google user with server auth store by providing verified cryptographic ID token
    try {
      const syncRes = await fetch('/api/auth/google-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      if (syncRes.ok) {
        const syncData = await syncRes.json();
        if (syncData.token && syncData.user) {
          localStorage.setItem(
            LOCAL_STORAGE_SESSION_KEY,
            JSON.stringify({ user: syncData.user, token: syncData.token })
          );
          setUserProfile(syncData.user);
          setIsAdmin(checkIsAdmin(syncData.user.email, syncData.user.role));
        }
      } else {
        const errJson = await syncRes.json().catch(() => ({}));
        console.error('[AUTH] Google server-sync error:', errJson);
      }
    } catch (syncErr) {
      console.warn('[AUTH] Google server-sync notice:', syncErr);
    }

    closeAuthModal();
  };

  const logout = async () => {
    // Invalidate session on server
    const localSession = localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
    if (localSession) {
      try {
        const { token } = JSON.parse(localSession);
        if (token) {
          await fetch('/api/auth/logout', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          }).catch(() => {});
        }
      } catch {}
    }

    try {
      await signOut(auth);
    } catch {
      // ignore
    }
    localStorage.removeItem(LOCAL_STORAGE_SESSION_KEY);
    setCurrentUser(null);
    setUserProfile(null);
    setIsAdmin(false);
    closeAuthModal();
  };

  const updateUserProfileData = async (data: Partial<UserProfile>) => {
    if (!currentUser || !userProfile) return;

    // Check if user is an email/token session user
    const localSession = localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
    if (localSession) {
      try {
        const { token } = JSON.parse(localSession);
        const res = await fetch('/api/auth/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(data),
        });

        if (res.ok) {
          const resData = await res.json();
          if (resData.success && resData.user) {
            const updatedProfile = resData.user as UserProfile;
            localStorage.setItem(
              LOCAL_STORAGE_SESSION_KEY,
              JSON.stringify({ user: updatedProfile, token })
            );
            setUserProfile(updatedProfile);
            setCurrentUser({
              uid: updatedProfile.uid,
              email: updatedProfile.email,
              displayName: updatedProfile.displayName,
              phoneNumber: updatedProfile.phoneNumber,
            });
            return;
          }
        }
      } catch (err) {
        console.warn('Could not update profile via server:', err);
      }
    }

    // Fallback: If Firebase user
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const updated = {
        ...data,
        updatedAt: new Date().toISOString(),
      };
      await updateDoc(userRef, updated);
      setUserProfile((prev) => (prev ? { ...prev, ...updated } : null));

      if ('updateProfile' in currentUser && data.displayName && data.displayName !== currentUser.displayName) {
        await firebaseUpdateProfile(currentUser as User, { displayName: data.displayName });
      }
    } catch (err) {
      console.warn('Could not update Firestore profile:', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        isAdmin,
        loading,
        isAuthModalOpen,
        authModalMode,
        openAuthModal,
        closeAuthModal,
        loginWithEmail,
        registerWithEmail,
        sendSmsOtp,
        verifySmsOtp,
        loginWithGoogle,
        logout,
        updateUserProfileData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

