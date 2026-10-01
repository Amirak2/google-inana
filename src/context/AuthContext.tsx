import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { UserProfile } from '../types';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  phoneNumber?: string | null;
  photoURL?: string | null;
}

interface AuthContextType {
  currentUser: AuthUser | null;
  userProfile: UserProfile | null;
  isAdmin: boolean;
  loading: boolean;
  isAuthModalOpen: boolean;
  authModalMode: 'login' | 'profile';
  openAuthModal: (mode?: 'login' | 'profile') => void;
  closeAuthModal: () => void;
  sendSmsOtp: (mobile: string) => Promise<{ expiresInSeconds: number; isRegistered: boolean }>;
  verifySmsOtp: (mobile: string, code: string, displayName?: string) => Promise<{ isNewUser: boolean }>;
  requestPhoneChange: (newMobile: string) => Promise<void>;
  verifyPhoneChange: (code: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUserProfileData: (data: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_STORAGE_SESSION_KEY = 'inana_user_session';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const authEpoch = useRef(0);
  const activeAccount = useRef<string | undefined>(undefined);
  activeAccount.current = currentUser?.uid;
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'profile'>('login');

  const openAuthModal = (mode: 'login' | 'profile' = 'login') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
  };

  // Restore stored session from server auth if available
  const restoreLocalSession = async (): Promise<boolean> => {
    const epoch = authEpoch.current;
    localStorage.removeItem(LOCAL_STORAGE_SESSION_KEY);
    try {
      const response = await fetch('/api/auth/me');
      const data = await response.json();
      if (epoch !== authEpoch.current || !response.ok || !data.user) return false;
      setCurrentUser(data.user);
      setUserProfile(data.user);
      setIsAdmin(data.user.role === 'admin');
      return true;
    } catch { return false; }
  };

  useEffect(() => {
    const epoch = authEpoch.current;
    restoreLocalSession().then((hasSession) => {
      if (epoch !== authEpoch.current) return;
      if (!hasSession) {
        setCurrentUser(null);
        setUserProfile(null);
        setIsAdmin(false);
      }
      setLoading(false);
    });
  }, []);

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
    const epoch = ++authEpoch.current;
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

    if (epoch !== authEpoch.current) throw new Error('عملیات ورود تغییر کرده است. دوباره تلاش کنید.');
    const u: UserProfile = data.user;

    const authUser: AuthUser = {
      uid: u.uid,
      email: u.email,
      displayName: u.displayName,
      phoneNumber: u.phoneNumber,
    };
    setCurrentUser(authUser);
    setUserProfile(u);
    setIsAdmin(u.role === 'admin');
    closeAuthModal();

    return { isNewUser: Boolean(data.isNewUser) };
  };

  const requestPhoneChange = async (newMobile: string): Promise<void> => {
    const res = await fetch('/api/auth/phone/change-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newMobile }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'ارسال کد تغییر شماره انجام نشد.');
    }
  };

  const verifyPhoneChange = async (code: string): Promise<void> => {
    const epoch = authEpoch.current;
    const uid = currentUser?.uid;
    const res = await fetch('/api/auth/phone/change-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success || !data.user) {
      throw new Error(data.error || 'تأیید شماره جدید انجام نشد.');
    }
    if (epoch !== authEpoch.current || activeAccount.current !== uid) return;
    const user = data.user as UserProfile;
    setUserProfile(user);
    setCurrentUser({ uid: user.uid, email: user.email, displayName: user.displayName, phoneNumber: user.phoneNumber });
    setIsAdmin(user.role === 'admin');
  };

  const logout = async () => {
    const epoch = ++authEpoch.current;
    const response = await fetch('/api/auth/logout', { method: 'POST' });
    if (!response.ok) throw new Error('خروج از حساب انجام نشد. دوباره تلاش کنید.');
    if (epoch !== authEpoch.current) return;

    localStorage.removeItem(LOCAL_STORAGE_SESSION_KEY);
    setCurrentUser(null);
    setUserProfile(null);
    setIsAdmin(false);
    closeAuthModal();
  };

  const updateUserProfileData = async (data: Partial<UserProfile>) => {
    if (!currentUser || !userProfile) return;
    const epoch = authEpoch.current;

    const res = await fetch('/api/auth/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    const resData = await res.json().catch(() => ({}));
    if (!res.ok || !resData.success || !resData.user) {
      throw new Error(resData.error || 'ذخیره اطلاعات حساب انجام نشد.');
    }

    if (epoch !== authEpoch.current || activeAccount.current !== currentUser.uid) return;
    const updatedProfile = resData.user as UserProfile;
    setUserProfile(updatedProfile);
    setCurrentUser({
      uid: updatedProfile.uid,
      email: updatedProfile.email,
      displayName: updatedProfile.displayName,
      phoneNumber: updatedProfile.phoneNumber,
    });

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
        sendSmsOtp,
        verifySmsOtp,
        requestPhoneChange,
        verifyPhoneChange,
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

