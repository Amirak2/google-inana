import React, { useState, useEffect } from 'react';
import {
  X,
  User as UserIcon,
  Mail,
  Lock,
  Phone,
  Eye,
  EyeOff,
  ShieldCheck,
  LogOut,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  KeyRound,
  ArrowRight,
  RefreshCw,
  MessageSquare,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Order } from '../types';
import { formatToman, toPersianDigits } from '../utils/persianFormatter';
import { getAuthHeaders } from '../utils/authHelper';

export const AuthModal: React.FC = () => {
  const {
    currentUser,
    userProfile,
    isAdmin,
    isAuthModalOpen,
    authModalMode,
    closeAuthModal,
    loginWithEmail,
    registerWithEmail,
    sendSmsOtp,
    verifySmsOtp,
    loginWithGoogle,
    logout,
    updateUserProfileData,
  } = useAuth();

  const [mode, setMode] = useState<'otp' | 'login' | 'register' | 'profile'>('otp');

  // OTP State
  const [otpStep, setOtpStep] = useState<'phone' | 'code'>('phone');
  const [mobileNumber, setMobileNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpDisplayName, setOtpDisplayName] = useState('');
  const [isOtpNewUser, setIsOtpNewUser] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);

  // Email/Password State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [userOrders, setUserOrders] = useState<Order[]>([]);
  const [loadingUserOrders, setLoadingUserOrders] = useState(false);

  // Sync state when modal opens
  useEffect(() => {
    if (currentUser) {
      setMode('profile');
      setDisplayName(userProfile?.displayName || currentUser.displayName || '');
      setPhoneNumber(userProfile?.phoneNumber || '');
      setAddress(userProfile?.address || '');
    } else {
      setMode('otp'); // Default to convenient SMS OTP
      setOtpStep('phone');
      setOtpCode('');
    }
    setErrorMsg(null);
    setSuccessMsg(null);
  }, [isAuthModalOpen, authModalMode, currentUser, userProfile]);

  useEffect(() => {
    if (!isAuthModalOpen || !currentUser || isAdmin) {
      setUserOrders([]);
      return;
    }

    let cancelled = false;
    setLoadingUserOrders(true);
    fetch('/api/orders', { headers: { ...getAuthHeaders() } })
      .then(async (response) => {
        if (!response.ok) throw new Error('دریافت سفارش‌ها انجام نشد.');
        return response.json() as Promise<Order[]>;
      })
      .then((orders) => {
        if (!cancelled) {
          setUserOrders(
            [...orders].sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            )
          );
        }
      })
      .catch(() => {
        if (!cancelled) setUserOrders([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingUserOrders(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthModalOpen, currentUser, isAdmin]);

  // Countdown timer for OTP resend
  useEffect(() => {
    if (otpCountdown <= 0) return;
    const timer = setInterval(() => {
      setOtpCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [otpCountdown]);

  if (!isAuthModalOpen) return null;

  const normalizePhone = (num: string) => {
    return num
      .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
      .replace(/\D/g, '');
  };

  // 1. Send SMS OTP Request
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanPhone = normalizePhone(mobileNumber);
    if (!cleanPhone || cleanPhone.length !== 11 || !cleanPhone.startsWith('09')) {
      setErrorMsg('لطفاً شماره موبایل ۱۱ رقمی معتبر با فرمت ...۰۹ وارد کنید.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await sendSmsOtp(cleanPhone);
      setIsOtpNewUser(!res.isRegistered);
      setOtpStep('code');
      setOtpCountdown(60); // 60s cooldown for resend
      setSuccessMsg(`کد تایید پیامکی به شماره ${cleanPhone} ارسال شد.`);
    } catch (err: any) {
      setErrorMsg(err.message || 'خطا در ارسال کد تایید پیامکی.');
    } finally {
      setSubmitting(false);
    }
  };

  // 2. Verify SMS OTP Code
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = normalizePhone(mobileNumber);
    const cleanCode = normalizePhone(otpCode);

    if (!cleanCode || cleanCode.length < 4) {
      setErrorMsg('لطفاً کد تایید پیامک‌شده را وارد کنید.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    try {
      const result = await verifySmsOtp(cleanPhone, cleanCode, otpDisplayName);
      setSuccessMsg(
        result.isNewUser
          ? 'خوش آمدید! حساب کاربری شما با موفقیت فعال شد.'
          : 'با موفقیت وارد حساب شدید.'
      );
    } catch (err: any) {
      setErrorMsg(err.message || 'کد تایید اشتباه یا منقضی شده است.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('لطفاً ایمیل و رمز عبور را وارد کنید.');
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await loginWithEmail(email, password);
    } catch (err: any) {
      setErrorMsg(err.message || 'ایمیل یا کلمه عبور نادرست است.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !displayName) {
      setErrorMsg('لطفاً نام، ایمیل و رمز عبور را تکمیل فرمایید.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('رمز عبور باید حداقل ۶ کاراکتر باشد.');
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await registerWithEmail(email, password, displayName, phoneNumber);
    } catch (err: any) {
      setErrorMsg(err.message || 'خطا در ایجاد حساب کاربری.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      setErrorMsg(err.message || 'خطا در ورود با گوگل.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await updateUserProfileData({
        displayName,
        phoneNumber,
        address,
      });
      setSuccessMsg('اطلاعات حساب کاربری شما با موفقیت بروزرسانی شد.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg('خطا در ذخیره اطلاعات: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-3.5 sm:p-4 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-300">
      <div
        id="auth-modal-card"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md max-h-[92vh] flex flex-col bg-[#060B15] border border-[#D4AF37]/40 rounded-3xl overflow-hidden shadow-[0_20px_70px_rgba(0,0,0,0.9)] text-slate-100 my-auto"
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#D4AF37]/25 bg-[#0A1224]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#D4AF37] to-[#F5E8C7] flex items-center justify-center text-slate-950 font-bold shadow-md">
              <Sparkles className="w-4 h-4 text-slate-950" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {mode === 'profile'
                  ? 'حساب کاربری اینانا'
                  : mode === 'otp'
                  ? 'ورود و ثبت‌نام سریع با پیامک'
                  : mode === 'register'
                  ? 'عضویت در باشگاه مشتریان'
                  : 'ورود با ایمیل و گذرواژه'}
              </h2>
              <span className="text-[11px] text-[#E6CA65]">
                {mode === 'profile'
                  ? isAdmin
                    ? 'سطح دسترسی: مدیر سیستم'
                    : 'مشتری وفادار گالری طلا'
                  : 'رمز یکبار مصرف امن (OTP) بدون نیاز به رمز عبور'}
              </span>
            </div>
          </div>
          <button
            onClick={closeAuthModal}
            className="p-1.5 rounded-full hover:bg-[#0B152B] text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher (When not in profile mode) */}
        {!currentUser && (
          <div className="flex border-b border-[#D4AF37]/20 bg-[#081224] px-4 pt-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setMode('otp');
              }}
              className={`flex-1 py-2.5 font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 ${
                mode === 'otp'
                  ? 'border-[#D4AF37] text-[#D4AF37]'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>کد پیامکی (OTP)</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#D4AF37]/20 text-[#E6CA65] font-normal">
                پیشنهادی
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setMode('login');
              }}
              className={`flex-1 py-2.5 font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 ${
                mode === 'login' || mode === 'register'
                  ? 'border-[#D4AF37] text-[#D4AF37]'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              <span>ایمیل و گذرواژه</span>
            </button>
          </div>
        )}

        <div className="p-6 overflow-y-auto">
          {/* Status Messages */}
          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-start gap-2 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs flex items-start gap-2 animate-in fade-in duration-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* ============================================================== */}
          {/* 1. OTP AUTHENTICATION VIEW */}
          {/* ============================================================== */}
          {mode === 'otp' && !currentUser && (
            <div>
              {otpStep === 'phone' ? (
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      شماره تلفن همراه خود را وارد نمایید
                    </label>
                    <div className="relative flex items-center">
                      <Phone className="w-4 h-4 text-[#D4AF37] absolute right-3 pointer-events-none" />
                      <input
                        type="tel"
                        dir="ltr"
                        autoFocus
                        required
                        value={mobileNumber}
                        onChange={(e) => setMobileNumber(e.target.value)}
                        className="w-full bg-[#0A1120] border border-slate-700 rounded-xl pr-9 pl-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-[#D4AF37] focus:outline-none text-left tracking-wider font-mono"
                        placeholder="09120000000"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                      کد تایید ۵ رقمی امن بلافاصله از طریق سامانه پیامکی اختصاصی به این شماره ارسال خواهد شد.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#E6CA65] text-slate-950 font-bold text-xs shadow-lg hover:shadow-[#D4AF37]/25 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {submitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>در حال ارسال پیامک...</span>
                      </>
                    ) : (
                      <>
                        <span>دریافت کد تایید پیامکی</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-700/80"></div>
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="px-2 bg-[#0E1A33] text-slate-400">یا ورود با</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={submitting}
                    className="w-full py-2.5 rounded-xl bg-[#13254A] hover:bg-[#1A3264] border border-slate-700 text-slate-200 font-semibold text-xs flex items-center justify-center gap-2 transition-all"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>ورود با حساب گوگل (Google)</span>
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <div className="text-xs text-slate-300">
                      <span>ارسال به شماره: </span>
                      <span className="font-mono font-bold text-white dir-ltr inline-block mr-1">
                        {toPersianDigits(mobileNumber)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setOtpStep('phone');
                        setErrorMsg(null);
                        setOtpCode('');
                      }}
                      className="text-[11px] text-[#D4AF37] hover:underline"
                    >
                      ویرایش شماره
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      کد تایید پیامک‌شده
                    </label>
                    <div className="relative flex items-center">
                      <KeyRound className="w-4 h-4 text-[#D4AF37] absolute right-3 pointer-events-none" />
                      <input
                        type="text"
                        dir="ltr"
                        autoFocus
                        required
                        maxLength={6}
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                        className="w-full bg-[#0A1120] border border-[#D4AF37]/60 rounded-xl pr-9 pl-3 py-2.5 text-base text-white placeholder-slate-500 focus:border-[#D4AF37] focus:outline-none text-center tracking-[0.4em] font-mono font-bold"
                        placeholder="•••••"
                      />
                    </div>
                  </div>

                  {isOtpNewUser && (
                    <div className="animate-in fade-in duration-200">
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        نام و نام خانوادگی (اختیاری جهت صدور فاکتور رسمی)
                      </label>
                      <div className="relative flex items-center">
                        <UserIcon className="w-4 h-4 text-slate-400 absolute right-3 pointer-events-none" />
                        <input
                          type="text"
                          value={otpDisplayName}
                          onChange={(e) => setOtpDisplayName(e.target.value)}
                          className="w-full bg-[#0A1120] border border-slate-700 rounded-xl pr-9 pl-3 py-2 text-xs text-white placeholder-slate-500 focus:border-[#D4AF37] focus:outline-none"
                          placeholder="مثال: پرنیان رضایی"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                    {otpCountdown > 0 ? (
                      <span className="text-[11px] text-slate-400">
                        ارسال مجدد کد پس از {toPersianDigits(otpCountdown)} ثانیه
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSendOtp()}
                        disabled={submitting}
                        className="text-xs text-[#D4AF37] hover:underline font-semibold flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>ارسال مجدد کد پیامکی</span>
                      </button>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || otpCode.trim().length < 4}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#E6CA65] text-slate-950 font-bold text-xs shadow-lg hover:shadow-[#D4AF37]/25 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {submitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>در حال بررسی کد...</span>
                      </>
                    ) : (
                      <span>تایید و ورود به سامانه</span>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* 2. USER PROFILE VIEW */}
          {/* ============================================================== */}
          {mode === 'profile' && currentUser && (
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="p-4 rounded-2xl bg-[#13254A]/80 border border-[#D4AF37]/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#D4AF37]/30 to-[#1E3A8A] flex items-center justify-center text-[#D4AF37] font-extrabold border border-[#D4AF37]/40 text-lg">
                    {userProfile?.displayName ? userProfile.displayName.charAt(0) : 'U'}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white">
                      {userProfile?.displayName || 'کاربر گرامی'}
                    </h3>
                    <p className="text-xs text-slate-300 font-mono dir-ltr">
                      {userProfile?.phoneNumber || currentUser.email}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {isAdmin ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#D4AF37] text-slate-950">
                          <ShieldCheck className="w-3 h-3" />
                          مدیریت ارشد گالری
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                          مشتری وفادار اینانا
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={logout}
                  className="p-2 rounded-xl bg-red-900/30 hover:bg-red-900/50 text-red-300 border border-red-500/30 text-xs flex items-center gap-1 transition-all"
                  title="خروج از حساب"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">خروج</span>
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  نام و نام خانوادگی
                </label>
                <div className="relative flex items-center">
                  <UserIcon className="w-4 h-4 text-slate-400 absolute right-3 pointer-events-none" />
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full bg-[#0A1120] border border-slate-700 rounded-xl pr-9 pl-3 py-2.5 text-xs text-white placeholder-slate-500 focus:border-[#D4AF37] focus:outline-none"
                    placeholder="مثال: سارا محمدی"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  شماره موبایل جهت هماهنگی و ارسال
                </label>
                <div className="relative flex items-center">
                  <Phone className="w-4 h-4 text-slate-400 absolute right-3 pointer-events-none" />
                  <input
                    type="tel"
                    dir="ltr"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full bg-[#0A1120] border border-slate-700 rounded-xl pr-9 pl-3 py-2.5 text-xs text-white placeholder-slate-500 focus:border-[#D4AF37] focus:outline-none text-left"
                    placeholder="09123456789"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  آدرس پیش‌فرض تحویل سفارش
                </label>
                <div className="relative flex items-start">
                  <MapPin className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                  <textarea
                    rows={2}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full bg-[#0A1120] border border-slate-700 rounded-xl pr-9 pl-3 py-2 text-xs text-white placeholder-slate-500 focus:border-[#D4AF37] focus:outline-none"
                    placeholder="تهران، خیابان ولیعصر..."
                  />
                </div>
              </div>

              {!isAdmin && <div className="rounded-2xl border border-[#D4AF37]/25 bg-[#0A1120] p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">سفارش‌های من</span>
                  <span className="text-[10px] text-slate-400">
                    {loadingUserOrders ? 'در حال دریافت...' : `${toPersianDigits(userOrders.length)} سفارش`}
                  </span>
                </div>

                {!loadingUserOrders && userOrders.length === 0 ? (
                  <p className="text-[11px] text-slate-500 py-1">هنوز سفارشی با این حساب ثبت نشده است.</p>
                ) : (
                  <div className="space-y-2">
                    {userOrders.slice(0, 3).map((order) => (
                      <div
                        key={order.id}
                        className="rounded-xl border border-slate-800 bg-[#060B15] px-3 py-2.5 text-[11px]"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono font-bold text-[#E6CA65]" dir="ltr">
                            {order.trackingCode}
                          </span>
                          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-slate-200">
                            {order.status}
                          </span>
                        </div>
                        <div className="mt-1.5 flex items-center justify-between text-slate-400">
                          <span>{new Date(order.createdAt).toLocaleDateString('fa-IR')}</span>
                          <span className="font-semibold text-white">{formatToman(order.totalPrice)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#E6CA65] text-slate-950 font-bold text-xs shadow-lg hover:shadow-[#D4AF37]/25 transition-all disabled:opacity-50 mt-2"
              >
                {submitting ? 'در حال ذخیره‌سازی...' : 'ذخیره تغییرات پروفایل'}
              </button>
            </form>
          )}

          {/* ============================================================== */}
          {/* 3. EMAIL/PASSWORD LOGIN VIEW */}
          {/* ============================================================== */}
          {mode === 'login' && !currentUser && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  آدرس ایمیل
                </label>
                <div className="relative flex items-center">
                  <Mail className="w-4 h-4 text-slate-400 absolute right-3 pointer-events-none" />
                  <input
                    type="email"
                    dir="ltr"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#0A1120] border border-slate-700 rounded-xl pr-9 pl-3 py-2.5 text-xs text-white placeholder-slate-500 focus:border-[#D4AF37] focus:outline-none text-left"
                    placeholder="name@example.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  رمز عبور
                </label>
                <div className="relative flex items-center">
                  <Lock className="w-4 h-4 text-slate-400 absolute right-3 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    dir="ltr"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[#0A1120] border border-slate-700 rounded-xl pr-9 pl-9 py-2.5 text-xs text-white placeholder-slate-500 focus:border-[#D4AF37] focus:outline-none text-left"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 text-slate-400 hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#E6CA65] text-slate-950 font-bold text-xs shadow-lg hover:shadow-[#D4AF37]/25 transition-all disabled:opacity-50 mt-2"
              >
                {submitting ? 'در حال ورود...' : 'ورود به حساب کاربری'}
              </button>

              <div className="text-center pt-2">
                <span className="text-xs text-slate-400">حساب کاربری ایمیلی ندارید؟ </span>
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    setMode('register');
                  }}
                  className="text-xs font-bold text-[#D4AF37] hover:underline"
                >
                  ثبت‌نام با ایمیل
                </button>
              </div>
            </form>
          )}

          {/* ============================================================== */}
          {/* 4. EMAIL REGISTER VIEW */}
          {/* ============================================================== */}
          {mode === 'register' && !currentUser && (
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  نام و نام خانوادگی
                </label>
                <div className="relative flex items-center">
                  <UserIcon className="w-4 h-4 text-slate-400 absolute right-3 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full bg-[#0A1120] border border-slate-700 rounded-xl pr-9 pl-3 py-2 text-xs text-white placeholder-slate-500 focus:border-[#D4AF37] focus:outline-none"
                    placeholder="مثال: پرنیان رضایی"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  آدرس ایمیل
                </label>
                <div className="relative flex items-center">
                  <Mail className="w-4 h-4 text-slate-400 absolute right-3 pointer-events-none" />
                  <input
                    type="email"
                    dir="ltr"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#0A1120] border border-slate-700 rounded-xl pr-9 pl-3 py-2 text-xs text-white placeholder-slate-500 focus:border-[#D4AF37] focus:outline-none text-left"
                    placeholder="name@example.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  شماره موبایل (اختیاری)
                </label>
                <div className="relative flex items-center">
                  <Phone className="w-4 h-4 text-slate-400 absolute right-3 pointer-events-none" />
                  <input
                    type="tel"
                    dir="ltr"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full bg-[#0A1120] border border-slate-700 rounded-xl pr-9 pl-3 py-2 text-xs text-white placeholder-slate-500 focus:border-[#D4AF37] focus:outline-none text-left"
                    placeholder="0912..."
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  کلمه عبور (حداقل ۶ کاراکتر)
                </label>
                <div className="relative flex items-center">
                  <Lock className="w-4 h-4 text-slate-400 absolute right-3 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    dir="ltr"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[#0A1120] border border-slate-700 rounded-xl pr-9 pl-9 py-2 text-xs text-white placeholder-slate-500 focus:border-[#D4AF37] focus:outline-none text-left"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 text-slate-400 hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#E6CA65] text-slate-950 font-bold text-xs shadow-lg hover:shadow-[#D4AF37]/25 transition-all disabled:opacity-50 mt-2"
              >
                {submitting ? 'در حال ثبت‌نام...' : 'ایجاد حساب کاربری'}
              </button>

              <div className="text-center pt-2">
                <span className="text-xs text-slate-400">قبلاً عضو شده‌اید؟ </span>
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    setMode('login');
                  }}
                  className="text-xs font-bold text-[#D4AF37] hover:underline"
                >
                  ورود به حساب
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
