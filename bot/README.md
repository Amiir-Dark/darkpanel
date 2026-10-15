# 🤖 ربات تلگرام فروش و مدیریت اشتراک DarkPanel (مدل Pay-As-You-Go)

این پروژه یک ربات تلگرام مستقل و سبک به زبان **Go (Golang)** برای پنل **DarkPanel** است که به صورت پرداخت به میزان مصرف (**Pay As You Go / شارژی**) کار می‌کند.

---

## 🌟 ویژگی‌های کلیدی

1. **فروش اشتراک کامل پنل (لینک سابسکریپشن هوشمند):**
   - کاربر اکانت تکی یا کانفیگ خام تحویل نمی‌گیرد، بلکه لینک سابسکریپشن کامل پنل DarkPanel (شامل تمامی پروتکل‌های Vless, Vmess, Trojan, Shadowsocks, Hysteria, MTProto, OpenVPN) را دریافت می‌کند.
2. **سیستم شارژی هوشمند بر اساس گیگابایت مصرفی (Pay-As-You-Go):**
   - ادمین قیمت هر گیگابایت را تعیین می‌کند (مثلاً ۵,۰۰۰ تومان).
   - موتور پس‌زمینه ربات در بازه‌های منظم (مثلاً هر ۲ دقیقه) مصرف واقعی کاربر را از API پنل دریافت می‌کند.
   - میزان حجم مصرفی محاسبه شده و هزینه دقیق آن از کیف پول کسر می‌گردد.
   - در صورت اتمام موجودی کیف پول، اکانت در پنل به صورت خودکار غیرفعال (`disabled`) شده و به کاربر پیام هشدار ارسال می‌شود.
   - با شارژ مجدد کیف پول توسط کاربر، اکانت بلافاصله به صورت خودکار مجدداً فعال (`active`) می‌شود.
3. **روش‌های شارژ کیف پول:**
   - **کارت به کارت:** کاربر مبلغ را وارد کرده، مشخصات کارت بانکی ادمین را مشاهده می‌کند و تصویر فیش را می‌فرستد. فیش برای تمامی ادمین‌ها با دکمه‌های شیشه‌ای `[ ✅ تایید و شارژ ]` و `[ ❌ رد فیش ]` ارسال می‌شود.
   - **ارز دیجیتال (تتر TRC20 / TON):** نمایش آدرس کیف پول‌های رمزارز ادمین جهت واریز.
4. **پنل مدیریت پیشرفته داخل ربات (`/admin`):**
   - تنظیم و تغییر قیمت هر گیگابایت ترافیک
   - تغییر مشخصات کارت بانکی (شماره کارت، شبا، نام صاحب حساب)
   - تغییر آدرس کیف پول تتر TRC20
   - فعال یا غیرفعال‌سازی سرویس تست رایگان (Trial)
   - آمار کلی (تعداد اعضا، سرویس‌های فعال، کل واریزی‌ها، کل حجم مصرفی)
   - ارسال پیام همگانی (Broadcast) به تمام کاربران ربات
   - مشاهده لیست کاربران و وضعیت شارژ آن‌ها

---

## 🚀 راهنمای نصب و راه‌اندازی

### ۱. تنظیم فایل کانفیگ (`.env`)
فایل `.env.example` را به `.env` تغییر نام داده و مقادیر زیر را تکمیل کنید:

```bash
cp .env.example .env
nano .env
```

نمونه محتوای `.env`:
```env
BOT_TOKEN=123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ
PANEL_URL=http://127.0.0.1:8000
PANEL_USERNAME=Amir
PANEL_PASSWORD=your_password
ADMIN_IDS=12345678
PRICE_PER_GB=5000
MIN_BALANCE_TO_START=5000
SYNC_INTERVAL_SECONDS=120
SUPPORT_USERNAME=@AdminSupport
```

### ۲. کامپایل و اجرا

```bash
# بیلد کردن پروژه
go build -o darkpanel-bot .

# اجرای ربات
./darkpanel-bot
```

### ۳. اجرا به عنوان سرویس دائمی (Systemd در لینوکس)

یک سرویس در مسیر `/etc/systemd/system/darkpanel-bot.service` بسازید:

```ini
[Unit]
Description=DarkPanel Telegram Bot
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/darkpanel/bot
ExecStart=/opt/darkpanel/bot/darkpanel-bot
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

فعال‌سازی و اجرا:
```bash
systemctl daemon-reload
systemctl enable darkpanel-bot
systemctl start darkpanel-bot
systemctl status darkpanel-bot
```
