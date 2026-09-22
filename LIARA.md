# استقرار INANA GOLD روی لیارا

این شاخه برای سرویس Node.js لیارا و PostgreSQL آماده است.

## تنظیمات برنامه

- Build command: `npm run build`
- Start command: `npm start`
- Node.js: نسخه 22
- Branch: `main`

## جلوگیری از طولانی‌شدن استقرار

ابزارهای ساخت در `devDependencies` هستند و هنگام ساخت باید نصب شوند. هوک
`liara_post_build.sh` پس از ساخت موفق، آن‌ها و کش npm را از تصویر نهایی حذف
می‌کند؛ فقط وابستگی‌های اجرای سرور باقی می‌مانند. `.liaraignore` نیز مانع
ارسال فایل‌های محلی، کلیدها، کش‌ها و پوشه‌های ابزارهای CLI می‌شود.

اگر ساخت موفق بود ولی مرحلهٔ `Pushing` به محدودیت زمان رسید، مشکل مربوط به
انتقال تصویر است؛ هشدار اندازهٔ فایل JavaScript به‌تنهایی خطای استقرار نیست.

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
LIARA_ENDPOINT=https://storage.c2.liara.site
LIARA_BUCKET_NAME=inana
LIARA_ACCESS_KEY=YOUR_OBJECT_STORAGE_ACCESS_KEY
LIARA_SECRET_KEY=YOUR_OBJECT_STORAGE_SECRET_KEY
```

برنامه در نخستین درخواست، جدول `site_records` را به‌صورت خودکار می‌سازد. پس از تنظیم چهار متغیر Object Storage، تصاویر جدید محصولات و فیش‌ها در باکت لیارا ذخیره می‌شوند. فایل‌های قبلی همچنان از PostgreSQL خوانده می‌شوند و فیش‌ها فقط برای صاحب سفارش یا مدیر قابل دریافت‌اند.
