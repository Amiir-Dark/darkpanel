<p align="center">
  <a href="https://github.com/Amiir-Dark/darkpanel" target="_blank" rel="noopener noreferrer">
    <img width="160" height="160" src="../dashboard/src/assets/logo.svg" alt="DarkPanel logo">
  </a>
</p>

<h1 align="center">دارک‌پنل (DarkPanel)</h1>

<p align="center">
     راهکار یکپارچه و مدرن مدیریت پروکسی و ضد فیلترینگ با هسته قدرتمند <a href="https://github.com/XTLS/Xray-core">Xray</a>
</p>

<br/>
<p align="center">
  <a href="https://github.com/Amiir-Dark/darkpanel/actions">
    <img src="https://img.shields.io/github/actions/workflow/status/Amiir-Dark/darkpanel/build.yml?style=flat-square" />
  </a>
  <a href="https://github.com/Amiir-Dark/darkpanel/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/Amiir-Dark/darkpanel?style=flat-square" />
  </a>
  <a href="https://github.com/Amiir-Dark/darkpanel/stargazers">
    <img src="https://img.shields.io/github/stars/Amiir-Dark/darkpanel?style=social" />
  </a>
</p>

<p align="center">
	<a href="../README.md">
	English
	</a>
	/
	<a href="./README-fa.md">
	فارسی
	</a>
  /
  <a href="./README-zh-cn.md">
	简体中文
	</a>
   /
  <a href="./README-ru.md">
 Русский
 </a>
</p>

## فهرست مطالب
- [بررسی اجمالی](#بررسی-اجمالی)
  - [چرا دارک‌پنل؟](#چرا-دارک‌پنل)
    - [امکانات](#امکانات)
- [راهنمای نصب](#راهنمای-نصب)
- [تنظیمات](#تنظیمات)
- [ربات تلگرام](#ربات-تلگرام)
- [ارسال اعلان‌ها به آدرس وبهوک](#ارسال-اعلانها-به-آدرس-وبهوک)
- [کمک مالی](#کمک-مالی)
- [لایسنس](#لایسنس)
- [مشارکت در توسعه](#مشارکت-در-توسعه)


# بررسی اجمالی

دارک‌پنل (DarkPanel) یک نرم‌افزار جامع مدیریت پروکسی با رابط کاربری مدرن و واکنش‌گرا است که امکان مدیریت حرفه‌ای صدها حساب پروکسی را فراهم می‌کند. این پنل از [Xray-core](https://github.com/XTLS/Xray-core) قدرت گرفته و با بک‌اند پرسرعت Go و فرانت‌اند React پیاده‌سازی شده است.

## چرا دارک‌پنل؟

دارک‌پنل دارای یک رابط کاربری ساده، زیبا و پرامکانات است که امکان ایجاد انواع پروتکل‌های پروکسی را بدون نیاز به پیکربندی‌های پیچیده فراهم می‌کند. با استفاده از داشبورد اختصاصی، می‌توانید مصرف کاربران را مانیتور کنید، محدودیت دستگاه اعمال نمایید، هاست‌ها را مرتب‌سازی کنید و به سادگی کل سرورها را مدیریت نمایید.

### امکانات

- **رابط کاربری مدرن تحت وب** با تم تاریک، انیمیشن‌های نرم و طراحی رسپانسیو
- معماری استاندارد بر پایه **REST API**
- پشتیبانی از **چند نود (Multi-Node)** برای توزیع بار و مقیاس‌پذیری زیرساخت
- پشتیبانی کامل از پروتکل‌های **Vmess**, **VLESS**, **Trojan**, **Shadowsocks** و **WireGuard**
- امکان فعال‌سازی **چند پروتکل** برای هر کاربر
- امکان ساخت **چند کاربر** بر روی یک اینباند
- پشتیبانی از **چندین اینباند** بر روی **یک پورت** (از طریق Fallbacks)
- محدودیت ترافیک و تاریخ انقضا
- محدودیت ترافیک دوره‌ای (روزانه، هفتگی و...)
- **محدودیت تعداد دستگاه همزمان و شناسه سخت‌افزار (HWID Limiter)**
- پشتیبانی از **لینک اشتراک (Subscription)** سازگار با V2RayNG، Sing-Box، Nekoray، Clash و ClashMeta
- تولید خودکار **لینک اشتراک‌گذاری** و **QR Code**
- مانیتورینگ منابع سرور و **آمار مصرف لحظه‌ای**
- **فیلتر پیشرفته اینباندها و اولویت‌بندی ترتیبی هاست‌ها از بالا تا پایین**
- پشتیبانی از **TLS**، **REALITY** و **ECH**
- **ربات تلگرام** هوشمند و سیستم وب‌هوک
- **رابط خط فرمان (CLI)** قدرتمند
- سیستم مدیریت چند ادمین با سطوح دسترسی مختلف

# راهنمای نصب

برای نصب نسخه اصلی دارک‌پنل (DarkPanel):

```bash
curl -sL https://raw.githubusercontent.com/Amiir-Dark/darkpanel/main/scripts/darkpanel/darkpanel-binary.sh | sudo bash -s -- install
```

> **نکته مهم:** نصاب‌ها را با `sudo bash -c "$(curl ...)"` اجرا نکنید؛ متن اسکریپت ممکن است از محدودیت آرگومان لینوکس بزرگ‌تر شود و خطای `Argument list too long` بدهد. همیشه مطابق نمونه بالا دانلود را به `sudo bash -s --` پایپ کنید.

برای نصب DarkPanel-node روی سرورهای نود:

```bash
curl -sL https://raw.githubusercontent.com/Amiir-Dark/darkpanel/main/scripts/darkpanel/darkpanel-node-binary.sh | sudo bash -s -- install
```

نصاب‌های باینری سرویس‌های native systemd ایجاد می‌کنند و باینری متناسب با معماری سرور را به صورت خودکار دانلود می‌نمایند. سرور اصلی از دیتابیس‌های SQLite، MySQL و MariaDB پشتیبانی می‌کند؛ نصاب نود فقط ران‌تایم نود را نصب کرده و اتصال آن به سرور اصلی با توکن و سرتیفیکیت از داخل پنل برقرار می‌شود.

پس از پایان نصب:

- فایل‌های اجرایی در مسیر `/opt/rebecca` قرار می‌گیرند.
- فایل تنظیمات در مسیر `/opt/rebecca/.env` قرار دارد ([تنظیمات](#تنظیمات) را مشاهده کنید).
- داده‌های برنامه در مسیر `/var/lib/rebecca` ذخیره می‌شوند.
- به دلایل امنیتی، داشبورد به طور مستقیم با آی‌پی خام بدون SSL باز نمی‌شود. شما می‌توانید دامنه خود را متصل کرده و از طریق `https://YOUR_DOMAIN:8000/dashboard/` وارد داشبورد شوید (نام دامنه خود را جایگزین YOUR_DOMAIN کنید).
- همچنین برای تست اولیه بدون دامنه، می‌توانید از SSH Port Forwarding استفاده کنید:

```bash
ssh -L 8000:localhost:8000 user@serverip
```

سپس در مرورگر خود آدرس زیر را باز کنید:

```
http://localhost:8000/dashboard/
```

در مرحله بعد، با دستور زیر یک مدیر با دسترسی کامل (Full Access) بسازید:

```bash
rebecca cli admin create --role full_access
```

تبریک! اکنون با اطلاعات ایجاد شده می‌توانید وارد داشبورد دارک‌پنل شوید.

برای مشاهده راهنمای دستورات خط فرمان:

```bash
rebecca --help
```

اگر مشتاق هستید که رِبِکا را از سورس و به صورت دستی اجرا کنید، مراحل زیر را مشاهده کنید
<details markdown="1">
<summary><h3>نصب به صورت دستی (پیچیده)</h3></summary>

لطفا xray را نصب کنید.
شما میتواند به کمک [Xray-install](https://github.com/XTLS/Xray-install) این کار را انجام دهید.

```bash
curl -L https://github.com/XTLS/Xray-install/raw/main/install-release.sh | bash -s -- install
```

پروژه را clone کنید و داشبورد و باینری‌های Go را بسازید.

```bash
git clone https://github.com/Amiir-Dark/darkpanel.git
cd darkpanel
cd dashboard
npm ci
VITE_BASE_API=/api/ npm run build -- --outDir=build --assetsDir=statics
cp ./build/index.html ./build/404.html
cd ..
bash scripts/build_binary.sh
```

سپس کامند زیر را اجرا کنید تا migrationهای Go دیتابیس اجرا شوند.

```bash
rebecca migrate up
```

اگر می‌خواهید از CLI استفاده کنید، می‌توانید فایل `Go CLI` موجود را به نام اجرایی جدید لینک کنید و تکمیل خودکار آن را نصب کنید:

```bash
sudo install -m 755 ./dist/rebecca-cli /usr/local/bin/rebecca
rebecca cli --help

```

حالا یک کپی از `.env.example` با نام `.env` بسازید و با یک ادیتور آن را باز کنید و تنظیمات دلخواه خود را انجام دهید. یه عنوان مثال نام کاربری و رمز عبور را می توانید در این فایل تغییر دهید.

```bash
cp .env.example .env
nano .env
```

> برای اطلاعات بیشتر بخش [تنظیمات](#تنظیمات) را مطالعه کنید.

در انتها، رِبِکا را به کمک دستور زیر اجرا کنید.

```bash
./dist/rebecca-server
```

برای نصب دستی با systemd، یک unit برای باینری Go بسازید:

```ini
[Unit]
Description=Rebecca
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/rebecca
EnvironmentFile=/opt/rebecca/.env
ExecStart=/opt/rebecca/dist/rebecca-server
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

سپس آن را فعال کنید:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now rebecca
```

اجرا با nginx
```
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name  example.com;

    ssl_certificate      /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key  /etc/letsencrypt/live/example.com/privkey.pem;

  location ~* /(dashboard|statics|sub|api|docs|redoc|openapi.json) {
        proxy_pass http://0.0.0.0:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```
or
```
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
  server_name  rebecca.example.com;

    ssl_certificate      /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key  /etc/letsencrypt/live/example.com/privkey.pem;

    location / {
        proxy_pass http://0.0.0.0:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

به صورت پیش‌فرض رِبِکا در آدرس `http://localhost:8000/dashboard` اجرا می‌شود. شما می‌توانید با تغییر `UVICORN_HOST` و `UVICORN_PORT` هاست و پورت را تغییر دهید.
</details>

# تنظیمات

> متغیر های زیر در فایل ‍`env` یا `.env` استفاده میشوند. شما می توانید با تعریف و تغییر آن ها، تنظیمات رِبِکا را تغییر دهید.

| توضیحات | متغیر |
| ---: | :---: |
| آدرس دیتابیس؛ این نام legacy برای سازگاری با runtime جدید Go حفظ شده است | SQLALCHEMY_DATABASE_URL |
| هاست gateway گو (پیش‌فرض: `0.0.0.0`) | UVICORN_HOST |
| پورت gateway گو (پیش‌فرض: `8000`) | UVICORN_PORT |
| مسیر گواهی TLS برای gateway گو | UVICORN_SSL_CERTFILE |
| مسیر کلید TLS برای gateway گو | UVICORN_SSL_KEYFILE |
| نوع CA برای اسکریپت‌های نصب: `public` یا `private` | UVICORN_SSL_CA_TYPE |
| آدرس کامل gateway؛ مقدار `UVICORN_HOST` و `UVICORN_PORT` را override می‌کند | REBECCA_GATEWAY_ADDR |
| فاصله پردازش صف node operations | REBECCA_NODE_OPERATIONS_POLL_INTERVAL |
| فاصله بررسی lifecycle کاربران | REBECCA_USER_LIFECYCLE_INTERVAL |
| فاصله reset دوره‌ای مصرف کاربران | REBECCA_USER_USAGE_RESET_INTERVAL |
| حذف خودکار کاربران منقضی پس از این تعداد روز؛ مقدار منفی یعنی غیرفعال | USERS_AUTODELETE_DAYS |
| شامل کردن کاربران limited در حذف خودکار | USER_AUTODELETE_INCLUDE_LIMITED_ACCOUNTS |
| زمان انقضای JWT access token بر حسب دقیقه | JWT_ACCESS_TOKEN_EXPIRE_MINUTES |
| timeout لیست بزرگ کاربران؛ مقدار `0` یعنی غیرفعال | USERS_LIST_TIMEOUT_SECONDS |
| مسیر پایه certificateهای مدیریت‌شده | REBECCA_CERT_BASE |
| ریشه configهایی که در full backup قرار می‌گیرند | REBECCA_CONFIG_DIR |


# ربات تلگرام
رِبِکا دارای یک ربات تلگرام داخلی است که می‌تواند مدیریت سرور، ایجاد و حذف کاربر و ارسال اعلان‌ها را انجام دهد. این ربات را می‌توان با چند مرحله ساده فعال کرد.

برای فعال کردن ربات تلگرام:

1. در تنظیمات، متغیر`TELEGRAM_API_TOKEN` را به API TOKEN ربات تلگرام خود تنظیم کنید.
2. همینطور، متغیر`TELEGRAM_ADMIN_ID` را به شناسه عددی حساب تلگرام خود تنظیم کنید. شما می‌توانید شناسه خود را از [@userinfobot](https://t.me/userinfobot) دریافت کنید.


# ارسال اعلان‌ها به آدرس وبهوک
شما می‌توانید آدرسی را برای رِبِکا فراهم کنید تا تغییرات کاربران را به صورت اعلان برای شما ارسال کند.

اعلان‌ها به صورت یک درخواست POST به آدرسی که در `WEBHOOK_ADDRESS` فراهم شده به همراه مقدار تعیین شده در `WEBHOOK_SECRET` به عنوان `x-webhook-secret` در header درخواست ارسال می‌شوند.

نمونه‌ای از درخواست ارسال شده توسط رِبِکا:

```
Headers:
Host: 0.0.0.0:9000
User-Agent: python-requests/2.28.1
Accept-Encoding: gzip, deflate
Accept: */*
Connection: keep-alive
x-webhook-secret: something-very-very-secret
Content-Length: 107
Content-Type: application/json



Body:
{"username": "rebecca_test_user", "action": "user_updated", "enqueued_at": 1680506457.636369, "tries": 0}
```

انواع مختلف actionهایی که رِبِکا ارسال می‌کند: `user_created`, `user_updated`, `user_deleted`, `user_limited`, `user_expired`, `user_disabled`, `user_enabled`


# کمک مالی
اگر رِبِکا را برای شما مفید بوده و می‌خواهید از توسعه آن حمایت کنید، می‌توانید در یکی از شبکه های کریپتو زیر کمک مالی کنید:

- TRON network (TRC20): `TGftLESDAeRncE7yMAHrTUCsixuUwPc6qp`
- ETH, BNB, MATIC network (ERC20, BEP20): `0x413eb47C430a3eb0E4262f267C1AE020E0C7F84D`
- TON network: `UQDNpA3SlFMorlrCJJcqQjix93ijJfhAwIxnbTwZTLiHZ0Xa`


از حمایت شما متشکرم!


# لایسنس

توسعه‌یافته در [ناشناس!] و منتشر شده تحت لایسنس [AGPL-3.0](./LICENSE).


# مشارکت در توسعه
این ❤️‍🔥 تقدیم به همه‌ی کسانی که در توسعه دارک‌پنل مشارکت می‌کنند! اگر می‌خواهید مشارکت داشته باشید، لطفاً [دستورالعمل‌های مشارکت](CONTRIBUTING.md) را بررسی کنید و در صورت تمایل Pull Request ارسال کنید یا یک Issue باز کنید.

لطفاً با بررسی [لیست کارها و مشکلات](https://github.com/Amiir-Dark/darkpanel/issues) به ما در بهبود دارک‌پنل کمک کنید. کمک‌های شما با آغوش باز پذیرفته می‌شود.

<p align="center">
با تشکر از همه کسانی که به بهبود دارک‌پنل کمک کرده‌اند:
</p>
<p align="center">
<a href="https://github.com/Amiir-Dark/darkpanel/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=Amiir-Dark/darkpanel" />
</a>
</p>
<p align="center">
  ساخته شده با <a rel="noopener noreferrer" target="_blank" href="https://contrib.rocks">contrib.rocks</a>
</p>
