import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  updateProfile as firebaseUpdateProfile,
} from 'firebase/auth';
import { auth, googleProvider, checkIsAdmin } from '../lib/firebase';
import { UserProfile } from '../types';

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

  // Exchange the Firebase identity proof for the site's own server session.
  const syncProfile = async (user: User) => {
    const idToken = await user.getIdToken(true);
    const response = await fetch('/api/auth/google-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.token || !data.user) {
      localStorage.removeItem(LOCAL_STORAGE_SESSION_KEY);
      setUserProfile(null);
      setIsAdmin(false);
      throw new Error(data.error || 'ورود با گوگل در سرور تایید نشد.');
    }

    const profile = data.user as UserProfile;
    localStorage.setItem(
      LOCAL_STORAGE_SESSION_KEY,
      JSON.stringify({ user: profile, token: data.token })
    );
    setCurrentUser(user);
    setUserProfile(profile);
    setIsAdmin(checkIsAdmin(profile.email, profile.role));
  };

  useEffect(() => {
    // 1. Listen for Firebase Auth changes (e.g. Google Sign In)
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          await syncProfile(firebaseUser);
        } catch (error) {
          console.error('Google session verification failed:', error);
          setCurrentUser(null);
          setUserProfile(null);
          setIsAdmin(false);
        } finally {
          setLoading(false);
        }
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

    const localSession = localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
    if (!localSession) throw new Error('نشست کاربری معتبر نیست. لطفاً دوباره وارد شوید.');

    const { token } = JSON.parse(localSession);
    const res = await fetch('/api/auth/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    const resData = await res.json().catch(() => ({}));
    if (!res.ok || !resData.success || !resData.user) {
      throw new Error(resData.error || 'ذخیره اطلاعات حساب انجام نشد.');
    }

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

    if ('getIdToken' in currentUser && data.displayName && data.displayName !== currentUser.displayName) {
      await firebaseUpdateProfile(currentUser as User, { displayName: data.displayName });
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

