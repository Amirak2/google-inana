import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Activity,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  Filter,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  Trash2,
  TrendingUp,
  ShoppingBag,
  ExternalLink,
  Copy,
  Check,
  Eye,
  X,
  Sparkles,
  Server,
  Layers,
  Terminal,
} from 'lucide-react';
import { SystemLogEntry, SystemLogLevel, SystemLogModule, SystemLogStats } from '../types';
import { toPersianDigits } from '../utils/persianFormatter';
import { getAuthHeaders } from '../utils/authHelper';

export const SystemLogsViewer: React.FC = () => {
  const [logs, setLogs] = useState<SystemLogEntry[]>([]);
  const [stats, setStats] = useState<SystemLogStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);

  // Filters
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [selectedModule, setSelectedModule] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected Log for JSON detail inspect modal
  const [inspectedLog, setInspectedLog] = useState<SystemLogEntry | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedDetails, setCopiedDetails] = useState<boolean>(false);

  // Clear confirmation modal
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);
  const [isClearing, setIsClearing] = useState<boolean>(false);
  const [testLogLoading, setTestLogLoading] = useState<boolean>(false);

  // Fetch logs and statistics
  const fetchLogs = async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) setRefreshing(true);
    try {
      const queryParams = new URLSearchParams();
      if (selectedLevel !== 'all') queryParams.append('level', selectedLevel);
      if (selectedModule !== 'all') queryParams.append('module', selectedModule);
      if (searchQuery.trim()) queryParams.append('search', searchQuery.trim());
      queryParams.append('limit', '100');

      const [logsRes, statsRes] = await Promise.all([
        fetch(`/api/admin/logs?${queryParams.toString()}`, {
          headers: { ...getAuthHeaders() },
        }),
        fetch('/api/admin/logs/stats', {
          headers: { ...getAuthHeaders() },
        }),
      ]);

      if (logsRes.ok) {
        const data = await logsRes.json();
        setLogs(data.logs || []);
      }
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
    } catch (err) {
      console.error('Failed to fetch system logs:', err);
    } finally {
      setLoading(false);
      if (showRefreshIndicator) setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [selectedLevel, selectedModule, searchQuery]);

  // Auto-refresh interval (every 5 seconds)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchLogs(false);
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, selectedLevel, selectedModule, searchQuery]);

  // Copy helper
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Test log trigger
  const handleCreateTestLog = async () => {
    setTestLogLoading(true);
    try {
      const res = await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: 'info',
          module: 'SYSTEM',
          message: `ثبت لاگ آزمایشی مانیتورینگ سیستم در زمان ${new Date().toLocaleTimeString('fa-IR')}`,
          details: {
            triggeredBy: 'admin_dashboard_test_button',
            sampleLatencyMs: 14.8,
            status: 'operational',
          },
        }),
      });
      if (res.ok) {
        await fetchLogs(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTestLogLoading(false);
    }
  };

  // Clear logs handler
  const handleClearLogs = async () => {
    setIsClearing(true);
    try {
      const res = await fetch('/api/admin/logs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ retainCount: 0 }),
      });
      if (res.ok) {
        setShowClearConfirm(false);
        await fetchLogs(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsClearing(false);
    }
  };

  // Level badge styling helper
  const getLevelBadge = (level: SystemLogLevel) => {
    switch (level) {
      case 'error':
        return {
          bg: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
          dot: 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]',
          label: 'خطا (Error)',
          icon: AlertCircle,
        };
      case 'warn':
        return {
          bg: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
          dot: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]',
          label: 'هشدار (Warn)',
          icon: AlertTriangle,
        };
      case 'security':
        return {
          bg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
          dot: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]',
          label: 'امنیت (Security)',
          icon: Shield,
        };
      case 'order':
        return {
          bg: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40',
          dot: 'bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.6)]',
          label: 'سفارش (Order)',
          icon: ShoppingBag,
        };
      case 'price':
        return {
          bg: 'bg-[#D4AF37]/15 text-[#F5E8C7] border-[#D4AF37]/40',
          dot: 'bg-[#D4AF37] shadow-[0_0_8px_rgba(212,175,55,0.6)]',
          label: 'نرخ طلا (Price)',
          icon: TrendingUp,
        };
      case 'info':
      default:
        return {
          bg: 'bg-slate-800 text-slate-300 border-slate-700',
          dot: 'bg-slate-400',
          label: 'اطلاعات (Info)',
          icon: Activity,
        };
    }
  };

  const getModuleBadge = (mod: SystemLogModule) => {
    switch (mod) {
      case 'API':
        return 'bg-blue-950/60 text-blue-300 border-blue-800/60';
      case 'AUTH':
        return 'bg-purple-950/60 text-purple-300 border-purple-800/60';
      case 'ORDERS':
        return 'bg-teal-950/60 text-teal-300 border-teal-800/60';
      case 'GOLD_PRICE':
        return 'bg-amber-950/60 text-[#F5E8C7] border-amber-800/60';
      case 'INVENTORY':
        return 'bg-indigo-950/60 text-indigo-300 border-indigo-800/60';
      case 'CLIENT':
        return 'bg-rose-950/60 text-rose-300 border-rose-800/60';
      case 'SYSTEM':
      default:
        return 'bg-slate-900 text-slate-400 border-slate-800';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="p-5 bg-gradient-to-r from-[#0E1A33] via-[#0A1324] to-[#050A14] border border-[#D4AF37]/30 rounded-3xl relative overflow-hidden shadow-2xl">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#D4AF37]/20 via-[#0E1A33] to-slate-900 border border-[#D4AF37]/40 flex items-center justify-center text-[#D4AF37] shadow-inner flex-shrink-0">
              <Terminal className="w-6 h-6 text-[#D4AF37]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-white">
                  سیستم لاگینگ، ردگیری رویدادها و مانیتورینگ امنیتی
                </h2>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  <span>ثبت فعال رویدادها</span>
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                ردگیری دقیق تراکنش‌های کارت به کارت، تغییرات نرخ روز طلا، لاگین و امنیت، درخواست‌های API و خطاهای کلاینت به صورت ساختاریافته.
              </p>
            </div>
          </div>

          {/* Quick Action Bar */}
          <div className="flex items-center gap-2 flex-wrap self-end lg:self-center">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                autoRefresh
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40 hover:bg-emerald-900/60'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
              }`}
              title="بروزرسانی خودکار هر ۵ ثانیه"
            >
              <span
                className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`}
              />
              <span>بروزرسانی زنده {autoRefresh ? 'روشن' : 'خاموش'}</span>
            </button>

            <button
              onClick={() => fetchLogs(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[#D4AF37]' : ''}`} />
              <span>بازخوانی</span>
            </button>

            <button
              onClick={handleCreateTestLog}
              disabled={testLogLoading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#13254A] hover:bg-[#1A3264] text-[#D4AF37] border border-[#D4AF37]/40 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
              title="ثبت یک لاگ تستی برای بررسی سرعت مانیتورینگ"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>لاگ آزمایشی</span>
            </button>

            <div className="relative group">
              <a
                href="/api/admin/logs/export?format=json"
                download="inana_system_logs.json"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all"
              >
                <Download className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>خروجی JSON</span>
              </a>
            </div>

            <a
              href="/api/admin/logs/export?format=csv"
              download="inana_system_logs.csv"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>خروجی CSV</span>
            </a>

            <button
              onClick={() => setShowClearConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-semibold transition-all cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>پاکسازی</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 bg-[#091122] border border-slate-800 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>کل رویدادها</span>
            <Activity className="w-4 h-4 text-[#D4AF37]" />
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-white font-mono dir-ltr">
            {toPersianDigits(stats?.total || logs.length)}
          </div>
          <span className="text-[10px] text-slate-500 block mt-0.5">در بافر سیستم</span>
        </div>

        <div className="p-3.5 bg-[#091122] border border-rose-900/40 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between text-rose-300 text-xs">
            <span>خطاهای ثبت‌شده</span>
            <AlertCircle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-rose-400 font-mono dir-ltr flex items-center gap-2">
            <span>{toPersianDigits(stats?.errorsCount ?? 0)}</span>
            {(stats?.errorsCount ?? 0) > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            )}
          </div>
          <span className="text-[10px] text-slate-500 block mt-0.5">نیازمند بررسی</span>
        </div>

        <div className="p-3.5 bg-[#091122] border border-amber-900/40 rounded-2xl">
          <div className="flex items-center justify-between text-amber-300 text-xs">
            <span>هشدارها (Warn)</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-amber-400 font-mono dir-ltr">
            {toPersianDigits(stats?.warningsCount ?? 0)}
          </div>
          <span className="text-[10px] text-slate-500 block mt-0.5">کدهای ۴xx و اعتبارسنجی</span>
        </div>

        <div className="p-3.5 bg-[#091122] border border-emerald-900/40 rounded-2xl">
          <div className="flex items-center justify-between text-emerald-300 text-xs">
            <span>رویدادهای امنیتی</span>
            <Shield className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-emerald-400 font-mono dir-ltr">
            {toPersianDigits(stats?.securityCount ?? 0)}
          </div>
          <span className="text-[10px] text-slate-500 block mt-0.5">ورود و دسترسی‌ها</span>
        </div>

        <div className="p-3.5 bg-[#091122] border border-cyan-900/40 rounded-2xl">
          <div className="flex items-center justify-between text-cyan-300 text-xs">
            <span>تراکنش‌ها و سفارشات</span>
            <ShoppingBag className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-cyan-400 font-mono dir-ltr">
            {toPersianDigits(stats?.ordersCount ?? 0)}
          </div>
          <span className="text-[10px] text-slate-500 block mt-0.5">کارت به کارت و پیش‌فاکتور</span>
        </div>

        <div className="p-3.5 bg-[#091122] border border-[#D4AF37]/30 rounded-2xl">
          <div className="flex items-center justify-between text-[#F5E8C7] text-xs">
            <span>رویدادهای نرخ طلا</span>
            <TrendingUp className="w-4 h-4 text-[#D4AF37]" />
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-[#D4AF37] font-mono dir-ltr">
            {toPersianDigits(stats?.priceCount ?? 0)}
          </div>
          <span className="text-[10px] text-slate-500 block mt-0.5">همگام‌سازی نوسان</span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 bg-[#0A1120] border border-slate-800 rounded-2xl space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجو در پیام‌ها، آدرس IP، ایمیل، شناسه سفارش، اندپوینت..."
              className="w-full pl-3 pr-10 py-2.5 bg-slate-900/90 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#D4AF37]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Module Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 whitespace-nowrap">ماژول:</span>
            <select
              value={selectedModule}
              onChange={(e) => setSelectedModule(e.target.value)}
              className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-[#D4AF37] cursor-pointer"
            >
              <option value="all">همه ماژول‌ها</option>
              <option value="API">API و درخواست‌ها</option>
              <option value="ORDERS">سفارشات و تراکنش‌ها (ORDERS)</option>
              <option value="AUTH">احراز هویت و دسترسی (AUTH)</option>
              <option value="GOLD_PRICE">نرخ لحظه‌ای طلا (GOLD_PRICE)</option>
              <option value="INVENTORY">موجودی و رزرو سبد (INVENTORY)</option>
              <option value="CLIENT">خطاهای مرورگر کاربر (CLIENT)</option>
              <option value="SYSTEM">سیستم و دیتابیس (SYSTEM)</option>
            </select>
          </div>
        </div>

        {/* Level Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
          <span className="text-xs text-slate-400 ml-1 whitespace-nowrap">سطح رویداد:</span>
          {[
            { id: 'all', label: 'همه سطوح' },
            { id: 'error', label: 'فقط خطاها (Errors)', count: stats?.errorsCount },
            { id: 'warn', label: 'هشدارها (Warnings)', count: stats?.warningsCount },
            { id: 'security', label: 'امنیت (Security)', count: stats?.securityCount },
            { id: 'order', label: 'سفارشات (Orders)', count: stats?.ordersCount },
            { id: 'price', label: 'نرخ طلا (Price)', count: stats?.priceCount },
            { id: 'info', label: 'اطلاعات عمومی (Info)' },
          ].map((lvl) => {
            const isActive = selectedLevel === lvl.id;
            return (
              <button
                key={lvl.id}
                onClick={() => setSelectedLevel(lvl.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer flex-shrink-0 ${
                  isActive
                    ? 'bg-[#D4AF37] text-slate-950 font-bold shadow-md'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                <span>{lvl.label}</span>
                {lvl.count !== undefined && lvl.count > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono dir-ltr ${
                      isActive ? 'bg-slate-950 text-[#D4AF37]' : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {toPersianDigits(lvl.count)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Log Stream / Table */}
      <div className="bg-[#091122] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-4 py-3 bg-[#0A1324] border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#D4AF37]" />
            <span className="font-semibold text-white">جریان رویدادهای زنده سیستم</span>
            <span className="text-[11px] text-slate-500">
              (نمایش {toPersianDigits(logs.length)} مورد)
            </span>
          </div>
          {refreshing && (
            <span className="text-[11px] text-[#D4AF37] flex items-center gap-1">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>در حال همگام‌سازی...</span>
            </span>
          )}
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-[#D4AF37]" />
            <span className="text-xs">در حال بارگذاری لاگ‌های سیستم...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 opacity-60" />
            <span className="text-sm font-semibold text-slate-300">هیچ لاگی با فیلترهای انتخابی یافت نشد</span>
            <span className="text-xs text-slate-500">می‌توانید فیلتر سطح یا متن جستجو را تغییر دهید.</span>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80 max-h-[620px] overflow-y-auto">
            {logs.map((log) => {
              const badge = getLevelBadge(log.level);
              const Icon = badge.icon;
              return (
                <div
                  key={log.id}
                  className="p-3.5 hover:bg-[#0E1A33]/50 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    {/* Level Icon Dot */}
                    <div className="mt-0.5 flex-shrink-0">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-semibold ${badge.bg}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                        <span>{badge.label.split(' ')[0]}</span>
                      </span>
                    </div>

                    {/* Module Badge */}
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-md border font-mono dir-ltr flex-shrink-0 ${getModuleBadge(
                        log.module
                      )}`}
                    >
                      {log.module}
                    </span>

                    {/* Message */}
                    <div className="min-w-0 flex-1">
                      <p className="text-slate-200 font-medium truncate leading-relaxed">
                        {log.message}
                      </p>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1 flex-wrap font-mono dir-ltr">
                        {log.ip && (
                          <span className="text-slate-400 flex items-center gap-1">
                            <span>IP:</span>
                            <span className="text-slate-300">{log.ip}</span>
                          </span>
                        )}
                        {log.userEmail && (
                          <span className="text-slate-400 flex items-center gap-1">
                            <span>User:</span>
                            <span className="text-slate-300">{log.userEmail}</span>
                          </span>
                        )}
                        {log.details?.statusCode && (
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                              log.details.statusCode >= 500
                                ? 'bg-rose-950 text-rose-300'
                                : log.details.statusCode >= 400
                                ? 'bg-amber-950 text-amber-300'
                                : 'bg-emerald-950 text-emerald-300'
                            }`}
                          >
                            HTTP {log.details.statusCode}
                          </span>
                        )}
                        {log.details?.durationMs !== undefined && (
                          <span className="text-slate-500">{log.details.durationMs}ms</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Timestamp & Inspect Button */}
                  <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0 text-[11px] text-slate-400">
                    <div className="text-left font-mono dir-ltr text-slate-400">
                      {log.jalaliTimestamp || log.timestamp.substring(11, 19)}
                    </div>
                    <button
                      onClick={() => setInspectedLog(log)}
                      className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                      title="مشاهده جزئیات کامل لاگ"
                    >
                      <Eye className="w-4 h-4 text-[#D4AF37]" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail Inspector Modal */}
      {inspectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#091122] border border-slate-700 rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="px-5 py-4 bg-[#0A1324] border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Terminal className="w-5 h-5 text-[#D4AF37]" />
                <div>
                  <h3 className="text-sm font-bold text-white">جزئیات کامل رکورد لاگ</h3>
                  <span className="text-[11px] text-slate-400 font-mono dir-ltr">
                    {inspectedLog.id}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setInspectedLog(null)}
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Summary Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div className="p-2.5 bg-[#050A14] border border-slate-800 rounded-xl">
                  <span className="text-slate-400 block">سطح رویداد:</span>
                  <span className="font-bold text-white mt-0.5 block">{inspectedLog.level}</span>
                </div>
                <div className="p-2.5 bg-[#050A14] border border-slate-800 rounded-xl">
                  <span className="text-slate-400 block">ماژول:</span>
                  <span className="font-bold text-white mt-0.5 block">{inspectedLog.module}</span>
                </div>
                <div className="p-2.5 bg-[#050A14] border border-slate-800 rounded-xl">
                  <span className="text-slate-400 block">آدرس IP:</span>
                  <span className="font-bold text-white mt-0.5 block font-mono dir-ltr">
                    {inspectedLog.ip || 'نامشخص'}
                  </span>
                </div>
                <div className="p-2.5 bg-[#050A14] border border-slate-800 rounded-xl">
                  <span className="text-slate-400 block">زمان ثبت:</span>
                  <span className="font-bold text-white mt-0.5 block font-mono dir-ltr">
                    {inspectedLog.jalaliTimestamp}
                  </span>
                </div>
              </div>

              {/* Message */}
              <div>
                <label className="text-slate-400 font-semibold block mb-1">پیام رویداد:</label>
                <div className="p-3 bg-[#050A14] border border-slate-800 rounded-xl text-slate-200 font-medium leading-relaxed">
                  {inspectedLog.message}
                </div>
              </div>

              {/* JSON Payload Details */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-400 font-semibold">داده‌های ساختاریافته (Details Payload):</label>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(inspectedLog, null, 2));
                      setCopiedDetails(true);
                      setTimeout(() => setCopiedDetails(false), 2000);
                    }}
                    className="text-[#D4AF37] hover:text-[#F5E8C7] flex items-center gap-1 text-[11px] font-semibold transition-colors cursor-pointer"
                  >
                    {copiedDetails ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedDetails ? 'کپی شد' : 'کپی کل JSON'}</span>
                  </button>
                </div>
                <pre className="p-3 bg-[#050A14] border border-slate-800 rounded-xl text-slate-300 font-mono text-[11px] dir-ltr text-left overflow-x-auto max-h-60">
                  {JSON.stringify(inspectedLog.details || {}, null, 2)}
                </pre>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 bg-[#0A1324] border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setInspectedLog(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#091122] border border-rose-500/40 rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30 mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1.5">
              <h3 className="text-base font-bold text-white">پاکسازی تاریخچه لاگ‌های سیستم</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                آیا از پاکسازی تمام رکوردهای ثبت‌شده اطمینان دارید؟ این عملیات غیرقابل بازگشت است، هرچند یک رکورد امنیتی از اقدام پاکسازی ثبت خواهد شد.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all cursor-pointer"
              >
                انصراف
              </button>
              <button
                onClick={handleClearLogs}
                disabled={isClearing}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                {isClearing ? 'در حال پاکسازی...' : 'بله، پاکسازی شود'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
