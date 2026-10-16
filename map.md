# نقشه پروژه Rebecca / DarkPanel

این تنها پرونده‌ی «نقشه» پروژه است: توضیح می‌دهد هر بخش کجاست، برای چیست،
چطور کار می‌کند و برای ادامه‌ی کار باید سراغ چه فایل‌هایی رفت.

> قاعده‌ی نگهداری: هر وقت فایل/پوشه‌ی جدید مهمی اضافه کردی، ویژگی جدیدی ساختی
> یا مسیر داده‌ای تغییر کرد، همین پرونده را به‌روز کن. هر توسعه‌دهنده‌ای
> (از جمله خودت) **قبل از تغییر کد** باید این فایل را بخواند و بعد از هر تغییر
> مهم، به‌روزش کند. این فایل باید همیشه نقطه‌ی شروع باشد.

---

## 1. پروژه در یک نگاه

Rebecca (با نام تجاری DarkPanel) یک پنل مدیریت Xray است که شامل این بخش‌هاست:

| بخش | فناوری | محل |
|---|---|---|
| سرور اصلی (Master) | Go 1.25 + chi router | `cmd/rebecca_gateway` |
| API پنل | Go (`internal/app/api`) | مسیر `/api/*` |
| CLI مدیریتی | Go | `cmd/rebecca_cli` |
| داشبورد | React 18 + Chakra UI + react-query + Vite | `dashboard/` |
| ربات فروش تلگرام | Go | `internal/app/salesbot` + `cmd/darkpanel_bot` |
| نود (سرور جدا) | Go (ریپوی جدا) | `rebeccapanel/Rebecca-node` |
| دیتابیس | SQLite (پیش‌فرض) یا MySQL/MariaDB | `db.sqlite3` |
| Migration | goose | `internal/app/migrations` |

نکته‌ی مهم: پوشه‌ی `bot/` یک **ماژول Go جداگانه** (نسخه‌ی قدیمی ربات) است و
ربات جدید (`internal/app/salesbot`) داخل همین ماژول اصلی زندگی می‌کند.

---

## 2. معماری کلی

```text
مرورگر
  |
  v
rebecca_gateway  (پیش‌فرض :8000، متغیرهای UVICORN_HOST / UVICORN_PORT)
  |-- /api/*             -> internal/app/api (HTTP + منطق دامنه‌ها)
  |-- /dashboard/*       -> internal/app/dashboard (build استاتیک embed شده)
  |-- /sub/*             -> اشتراک کاربر (internal/app/user/subscription.go)
  |-- /webhook/*         -> وب‌هوک‌ها (forapp، پرداخت، تلگرام)
  |-- /internal/*        -> ارتباط node/master
  |-- /docs, /openapi.json -> مستندات API (قابل خاموش‌کردن)
  |
  |-- salesbot (SQLite جداگانه: bot/bot.db) -> Telegram Bot API
  |
  `-- nodecontroller / nodeclient --gRPC(mTLS)--> rebecca-node (سرورهای نود)
```

جریان داده‌ی اصلی:
1. `rebecca_gateway` بارگذاری تنظیمات (`gateway.LoadConfig`) و ساخت `api.Server`.
2. `api.StartBackground(ctx)` ورکرهای پس‌زمینه (node ops، usage، lifecycle، notification، webhook) را بالا می‌آورد.
3. درخواست‌ها به `api.Handler()` می‌رسند و بر اساس مسیر به handler مربوطه می‌روند.
4. داشبورد به‌صورت build شده داخل باینری سرو می‌شود؛ در حالت توسعه با `npm run dev` روی `:3000`.

---

## 3. نقشه پوشه‌ها

### ریشه

| مسیر | توضیح |
|---|---|
| `cmd/` | نقاط ورود (main) باینری‌ها |
| `internal/` | کد Go (غیرقابل import از بیرون) |
| `dashboard/` | سورس فرانت‌اند React |
| `bot/` | ماژول قدیمی ربات تلگرام (فقط تاریخی/مرجع) |
| `templates/` | قالب‌های اشتراک (clash, singbox, v2ray, mux, subscription, user_agent, home) |
| `scripts/` | اسکریپت‌های نصب/بیلد (`scripts/rebecca/…`, `scripts/darkpanel/…`) |
| `docs/` | مستندات (فارسی/روسی/چینی، TODOها، نقشه Alembic) |
| `tutorials/` | محتوای آموزش‌های داخل داشبورد |
| `sponsors/` | فایل‌های اسپانسر (manifest اختیاری) |
| `scratch/` | فضای کار موقت |
| `.github/` | workflowها و قالب issue |
| `.kilo/` | تنظیمات ابزار agent |
| `db.sqlite3` | دیتابیس اصلی (پیش‌فرض) |
| `.env` / `.env.example` | متغیرهای محیطی |
| `go.mod` | ماژول `github.com/rebeccapanel/rebecca` (Go 1.25) |
| `docker-compose.yml`, `Dockerfile` | اجرای داکری |
| `map.md` | همین فایل: نقشه‌ی پروژه |

### `cmd/`

| فایل | کار |
|---|---|
| `cmd/rebecca_gateway/main.go` | باینری اصلی؛ سرور HTTP + API + داشبورد + شروع ورکرها |
| `cmd/rebecca_gateway/database_maintenance.go` | نگهداری خودکار دیتابیس در استارت |
| `cmd/rebecca_cli/main.go` | CLI: `admin`, `user`, `subscription`, `migrate` |
| `cmd/darkpanel_bot/main.go` | اجرای مستقل ربات فروش (`salesbot.GetService().Start`) |

### `internal/gateway` و `internal/platform`

| مسیر | توضیح |
|---|---|
| `internal/gateway/` | پیاده‌سازی سرور HTTP، TLS، PROXY protocol، سرو داشبورد استاتیک، multi-port اشتراک |
| `internal/platform/` | لایه‌های زیرساختی مشترک (اتصال دیتابیس و…) |

### `internal/app/*` (منطق دامنه)

| پکیج | مسئولیت |
|---|---|
| `api/` | فقط HTTP: مسیرها (`routes.go`)، میان‌افزار، auth، تبدیل ورودی/خروجی، OpenAPI. منطق دامنه اینجا نیست |
| `admin/` | هویت ادمین، هش رمز، JWT، API key، نقش‌ها و مجوزها |
| `user/` | کاربران: CRUD، lifecycle، اشتراک (`subscription.go`, `links.go`, `dto.go`, `repository.go`) |
| `settings/` | تنظیمات پنل و اشتراک، override هر ادمین، قالب‌های اشتراک |
| `node/`, `nodeclient/`, `nodecontroller/` | مدیریت نود: رکوردها، کلاینت gRPC (mTLS)، همگام‌سازی کانفیگ و وضعیت |
| `xrayconfig/` | پارس/اعتبارسنجی/نرمال‌سازی کانفیگ Xray و هدف‌های ذخیره |
| `usage/` | حسابداری مصرف (کاربر، ادمین، سرویس، نود، outbound) |
| `online/` | تشخیص کاربران آنلاین |
| `system/` | متریک‌های سیستم و نگهداری |
| `backup/` | خروجی/ورودی پشتیبان با فرمت `.rbbackup` |
| `migrations/` | موتور migration مبتنی بر goose + سازگاری با Alembic قدیمی |
| `notifications/`, `telegram/` | اعلان‌ها و یکپارچه‌سازی تلگرام |
| `webhook/` | پردازش رخدادهای وب‌هوک |
| `externalapps/` | اپ‌های خارجی (آرشیو/فایل/پروکسی) |
| `outboundsub/` | اشتراک outbound |
| `rowtemplates/`, `searchmatch/`, `certificates/`, `logging/` | قالب ردیف، جست‌وجو، گواهی‌ها، لاگ |
| `nordvpn/`, `warp/` | یکپارچه‌سازی NordVPN و Cloudflare WARP |
| `ads/` | غیرفعال (فقط کد تاریخی) |
| `salesbot/` | ربات فروش تلگرام (بخش 6.6 را ببین) |

---

## 4. باینری‌ها و نقاط ورود

```bash
# سرور اصلی (master)
go build -o rebecca ./cmd/rebecca_gateway
./rebecca

# CLI
go build -o rebecca-cli ./cmd/rebecca_cli
./rebecca-cli admin create USERNAME --role sudo --password PASS
./rebecca-cli migrate up
./rebecca-cli migrate status

# ربات فروش به‌صورت مستقل (اختیاری؛ به‌طور پیش‌فرض از API هم قابل روشن‌کردن است)
go build -o darkpanel-bot ./cmd/darkpanel_bot
```

نود (`rebecca-node`) در این ریپو نیست و از ریپوی جدا
`rebeccapanel/Rebecca-node` نصب می‌شود (`scripts/rebecca/rebecca-node-binary.sh`).

---

## 5. داده‌ها و تنظیمات کجاست

| داده | محل / کلید |
|---|---|
| دیتابیس اصلی | `db.sqlite3` (پیش‌فرض)؛ با `SQLALCHEMY_DATABASE_URL` می‌توان MySQL/MariaDB داد |
| دیتابیس ربات فروش | مسیر از `BOT_DATABASE_PATH`؛ در غیر این صورت به ترتیب: `/opt/darkpanel/bot/bot.db`, `/opt/rebecca/bot/bot.db`, `/var/lib/...`, `REBECCA_DATA_DIR/bot/bot.db`, `REBECCA_APP_DIR/bot/bot.db`, `bot/bot.db`, `bot.db` |
| تنظیمات پنل/اشتراک | جدول `settings` و `subscription_settings` (کد: `internal/app/settings`) |
| تنظیمات ربات | جدول `settings` در دیتابیس ربات (`GetSetting`/`SetSetting`) |
| متغیرهای محیطی | `.env` (نمونه: `.env.example`): پورت، TLS، مسیر داده، اینتروال ورکرها و… |
| قالب‌های اشتراک | `templates/{clash,singbox,v2ray,mux,subscription,user_agent,home}` |
| گواهی‌ها | `REBECCA_CERT_BASE` (پیش‌فرض `/var/lib/rebecca/certs`) |
| کانفیگ | `REBECCA_CONFIG_DIR` (پیش‌فرض `/etc/rebecca`) |
| کش اسپانسر | `REBECCA_SPONSOR_CACHE_DIR` |
| بکاپ | خروجی `.rbbackup` (کد: `internal/app/backup`) |
| داشبورد build شده | `dashboard/build/` (embed در باینری) |
| Migrationها | `internal/app/migrations/0000NN_*.go` |

هشدار: فایل‌های `internal/app/salesbot/bot/bot.db*` به‌اشتباه در گیت ترک شده‌اند
(آرتیفکت اجرای تست). نباید کامیت شوند؛ `.gitignore` را ببین/به‌روز کن.

---

## 6. چطور کار می‌کند (جریان‌های مهم)

### 6.1 راه‌اندازی
`cmd/rebecca_gateway/main.go` → `gateway.LoadConfig` → `api.New` →
`api.StartBackground` (ورکرها) → `gateway.NewServer` → `server.Run`.
داشبورد از تنظیمات (`DashboardPath`) و پورت‌های اضافه‌ی اشتراک از
`SubscriptionSettings` خوانده می‌شوند.

### 6.2 احراز هویت
- ورود: `POST /api/auth/login` (`internal/app/api/admin_auth.go`)، نشست با کوکی + JWT (`internal/app/admin`).
- 2FA در `admin_auth.go`، مدیریت API key در `admin_api_keys.go`.
- در فرانت‌اند: درخواست‌ها با `credentials: "include"` و `apiBaseURL` از `dashboard/src/service/http.js`.

### 6.3 Migrationها
- موتور goose: `internal/app/migrations/runner.go`.
- شماره‌ی آخرین نسخه در `latestGooseVersion` نگه داشته می‌شود (اکنون **69**)؛
  هر migration جدید باید این مقدار را یکی جلو ببرد و نامش `0000NN_توضیح.go` باشد.
- الگوهای موجود: `addColumn`, `ensureSubscriptionSettingsTable`, `CreateTableIfMissing`,
  `NormalizeDialect`, `HasTable`.
- اجرا: `rebecca-cli migrate up` یا اجرای خودکار در استارت.
- سازگاری با Alembic قدیمی: `docs/MIGRATION_GO_PORT_MAP.md`.

### 6.4 اشتراک کاربر
`internal/app/user/subscription.go` → `RenderSubscription` خروجی بر اساس
فرمت کلاینت (v2ray/clash/singbox/…)، هدرهای مخصوص (Happ و…)، قالب‌های
`subscription_templates`، و تنظیمات `subscription_settings`.
دکمه‌ها/پیام‌های صفحه‌ی اشتراک و «پیام اپ‌های بلاک‌شده» اینجا مدیریت می‌شوند
(`blockedClientPlaceholder`, `subscriptionHeaders`, `isClientAppBlocked`).

### 6.5 نودها
`nodecontroller` با `nodeclient` (gRPC + mTLS) به `rebecca-node` وصل می‌شود:
status/metrics، sync کانفیگ Xray، ریستارت، geo، و پروکسی templateها.

### 6.6 ربات فروش (`internal/app/salesbot`)
| فایل | کار |
|---|---|
| `service.go` | چرخه‌ی عمر سرویس، polling تلگرام، ورکر واریز/انقضا، پیام همگانی |
| `handlers.go` | هندل پیام/کالبک، متن‌ها، کیبوردها (wrapperهای موتور دکمه) |
| `telegram_client.go` | کلاینت خام Telegram Bot API (`SendMessage`, `EditMessageText`, …) |
| `database.go` | SQLite ربات، `User`, `UserPanel`, `GetSetting`/`SetSetting` |
| `admin_creator.go` | ساخت پنل نمایندگی از master و تست |
| `forapp_webhook.go` | وبهوک درگاه forapp |
| `force_join.go` | اجبار عضویت کانال |
| `messages.go` | رجیستری پیام‌ها + موتور `{{variable}}` |
| `buttons.go` | موتور کیبوردهای inline (چیدمان/متن/مخفی‌کردن/رنگ/دکمه سفارشی) + کاتالوگ actionها |

**مدیریت پیام‌ها:** هر پیام یک `Key` و کلید ذخیره در جدول settings دارد
(`welcome_message`, `terms_message` و بقیه `msg_<key>`). متن خالی = استفاده از
پیش‌فرض. متغیرها با `{{name}}` و امثال آن جای‌گذاری می‌شوند
(`RenderTemplate`, `baseBotVars`).

**مدیریت دکمه‌ها:** هر منو یک `BotKeyboardDef` دارد (idها، متن پیش‌فرض، چیدمان
سطری). override هر منو در کلید `kbd_<key>` به‌صورت JSON ذخیره می‌شود:
`{"rows": [["id",...]], "labels": {"id":"متن"}, "hidden": ["id"],
"styles": {"id":"danger|success|primary"}, "custom": [{"id":"custom_x","text":"...",
"url":"..." یا "callback":"..."}]}`. استایل با فیلد `style` در Bot API 10.3+ کار می‌کند.
دکمه‌های پویا (مثل لیست پنل‌های کاربر) قفل‌اند و فقط دکمه‌های ثابت قابل ویرایش‌اند.
دکمه سفارشی فقط وقتی رندر می‌شود که در `rows` جایی داشته باشد (id با پیشوند `custom_`،
حداکثر 64 کاراکتر؛ URL فقط `http(s)://` یا `tg://`).
`ListBotActions()` کاتالوگ actionهای ربات را برمی‌گرداند و در پاسخ
`GET /sales-bot/buttons` زیر کلید `actions` می‌آید.

**افزودن پیام جدید:** یک `BotMessageDef` به `botMessageRegistry` اضافه کن و
`getBotMessage("key", vars)` را در محل ارسال صدا بزن.
**افزودن دکمه‌ی جدید:** به `botKeyboardRegistry` اضافه کن، در
`kbButtonVisible` (شرط نمایش) و `kbButtonAction` (کالبک/URL) ثبتش کن، و در
`kbButtonText` اگر متن خاص لازم است.

**APIهای مرتبط** (`internal/app/api/sales_bot.go`):
`/sales-bot/settings`, `/sales-bot/messages`, `/sales-bot/buttons`,
`/sales-bot/broadcast`, `/sales-bot/service/{start,stop,restart}`, سفارش‌ها، فیش‌ها، کدهای هدیه.

### 6.7 داشبورد (فرانت‌اند)
- ساختار: `src/{pages,components,service,hooks,contexts,locales,types,utils}`.
- هر صفحه یک API سرویس متناظر در `src/service/` دارد (مثلاً `salesBot.js`).
- صفحه‌ی ربات: `src/pages/SalesBotPage.jsx` (تب‌ها: نمای کلی، سفارشات، فیش‌ها، مشتریان، کدهای هدیه، ارسال همگانی، تنظیمات، پیام‌ها و دکمه‌ها، لاگ‌ها).
- کامپوننت‌های تب «پیام‌ها و دکمه‌ها»: `src/components/salesbot/{botContentShared,BotMessagesManager,BotButtonsManager}.jsx`
  (پارسر HTML تلگرام، پیش‌نمایش زنده و تعاملی، درگ‌واندراپ چیدمان، رنگ دکمه، دکمه سفارشی).
- صفحه‌ی تنظیمات اشتراک/کلاینت‌ها: `src/pages/IntegrationSettingsPage.jsx`.
- ترجمه‌ها: `public/statics/locales/{en,fa}.json`.
- اجرای توسعه: `npm run dev` (با `VITE_BASE_API` پروکسی می‌شود).

### 6.8 ورکرهای پس‌زمینه
`node_operations_worker.go`, `node_usage_worker.go`, `user_lifecycle_worker.go`,
`webhook_worker.go`, `node_recovery_worker.go` — با اینتروال‌های قابل تنظیم در `.env`.

---

## 7. دستورات روزمره

```bash
# Go
go build ./...
go vet ./...
go test ./internal/app/salesbot/
go test ./internal/app/api/
gofmt -w path/to/file.go

# داشبورد
cd dashboard
npm run dev      # توسعه :3000
npm run build    # خروجی در build/
npm run lint     # biome lint src
npm test         # vitest run
```

اسکریپت‌های بیلد/نصب: `scripts/build_binary.sh`, `scripts/build_dashboard.sh`,
`scripts/build_bot.sh`, `scripts/build_go_cli.sh`, `scripts/darkpanel/*.sh`.

---

## 8. قواعد و نکات مهم (اشتباه رایج)

1. لایه‌بندی: `internal/app/api` فقط HTTP است؛ منطق دامنه را در پکیج خودش بگذار.
2. هر migration جدید: نام `0000NN_*.go` + آپدیت `latestGooseVersion`.
3. تلگرام: `parse_mode=HTML`؛ استایل دکمه‌های inline (`style`: `danger/success/primary`) فقط از Bot API 10.3+ پشتیبانی می‌شود و در کلاینت‌های قدیمی رنگ پیش‌فرض دیده می‌شود.
4. Chakra: `FormLabel`/`FormHelperText` باید داخل `<FormControl>` باشند.
5. بعضی فایل‌های Go از قبل gofmt-clean نیستند؛ فقط فایل‌هایی را فرمت کن که خودت دست زده‌ای تا diff بی‌دلیل بزرگ نشود.
6. `bot/bot.db` و `db.sqlite3*` داده‌ی اجرا هستند؛ مراقب کامیت‌شدنشان باش.
7. تست‌های `salesbot` با `main_test.go` دیتابیس را به temp منتقل می‌کنند؛ باینری‌های دیگر را دست نزن.
8. قبل از هر تغییر در متن‌های ربات، `messages.go` منبع حقیقت است؛ متن پیش‌فرض را همان‌جا عوض کن.
9. `formatCurrency` برای اعداد با کاما و `normalizeDigits` برای اعداد فارسی در `handlers.go`.

---

## 9. وضعیت کارهای اخیر (تا این لحظه)

- پیام قابل‌تنظیم برای بلاک‌کردن اپ‌های کلاینت + migration 68.
- اجبار چارست utf8mb4 برای جدول `subscription_settings` + migration 69.
- رفع باگ نمایش «0» در Happ (حذف fallback در `subscriptionHeaders`).
- دکمه‌های قابل‌تنظیم برای پیام همگانی (`BroadcastMessage` + UI سازنده).
- مدیریت کامل پیام‌ها (`{{variable}}`) و چیدمان دکمه‌ها در تب جدید «پیام‌ها و دکمه‌ها».
- ارتقای تب «پیام‌ها و دکمه‌ها»: پیش‌نمایش زنده تلگرام، drag & drop چیدمان، رنگ دکمه (Bot API 10.3+)، دکمه سفارشی (url/action) و ناوبری تعاملی بین منوها.
- رفع مرتب‌سازی Hosts و چند فیکس UI/پیام دیگر.
- یک‌پارچه‌سازی نقشه‌ی پروژه در همین فایل (`map.md`) و حذف `PROJECT_MAP.md`.

---

## 10. ادامه از کجا (Next steps پیشنهادی)

- [ ] خارج‌کردن `internal/app/salesbot/bot/bot.db*` از گیت و اضافه‌کردن به `.gitignore`.
- [ ] ایزوله‌کردن `BOT_DATABASE_PATH` در تست‌های `internal/app/api` (مثل `salesbot/main_test.go`) تا دیتابیس مخزن دست‌نخورده بماند.
- [ ] رسیدگی به `docs/TODO_GO_ACCESS_INSIGHTS.md` و `docs/TODO_GO_SETTINGS.md`.
- [ ] برای هر صفحه‌ی جدید داشبورد، سرویس `src/service/*` + ترجمه `locales` + تست (اگر منطق دارد) اضافه کن.
- [ ] بعد از هر فیچر بک‌اند، تست پکیج مربوطه + `go build ./...` + `npm run build` را اجرا کن.

---

## 11. منابع

- `docs/` : مستندات چندزبانه، نقشه‌ی Alembic، TODOها.
- `internal/app/*/README.md` : توضیح کوتاه هر پکیج دامنه.
- `scripts/rebecca/` : نصب و مدیریت نسخه‌ی رسمی.
- `tutorials/` : آموزش‌های داخل داشبورد.
- `rebecca.code-workspace` : تنظیمات VS Code.