# استقرار INANA GOLD روی لیارا

این شاخه برای سرویس Node.js لیارا و PostgreSQL آماده است.

## تنظیمات برنامه

- Build command: `npm run build`
- Start command: `npm start`
- Node.js: نسخه 20 یا جدیدتر
- Branch: `main`

## متغیرهای ضروری

مقادیر واقعی را فقط در بخش Environment Variables لیارا ثبت کنید:

```env
NODE_ENV=production
PG_URI=postgresql://USER:PASSWORD@pgo:5432/postgres
DATABASE_SSL=false
SESSION_SECRET=RANDOM_SECRET_WITH_AT_LEAST_32_CHARACTERS
ADMIN_EMAIL=amirbiashad@gmail.com
ADMIN_PHONE=09128481806
ADMIN_DEFAULT_PASSWORD=CHOOSE_A_STRONG_PASSWORD
GOLD_API_KEY=YOUR_NAVASAN_KEY
SMS_OTP_URL=https://s.api.ir/api/sw1/SmsOTP
SMS_OTP_API_KEY=YOUR_SMS_BEARER_TOKEN
FIREBASE_WEB_API_KEY=YOUR_FIREBASE_WEB_API_KEY
FIREBASE_PROJECT_ID=inanagold
FIREBASE_MESSAGING_SENDER_ID=YOUR_FIREBASE_SENDER_ID
FIREBASE_APP_ID=YOUR_FIREBASE_APP_ID
GOOGLE_CLIENT_ID=YOUR_GOOGLE_WEB_CLIENT_ID
```

برنامه در نخستین درخواست، جدول `site_records` را به‌صورت خودکار می‌سازد. تصاویر محصولات و فیش‌های کوچک نیز فعلاً در PostgreSQL ذخیره می‌شوند؛ برای حجم بالاتر بهتر است فضای ذخیره‌سازی ابری لیارا متصل شود.
