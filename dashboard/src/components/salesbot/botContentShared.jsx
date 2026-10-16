import { Box, Link, Text } from "@chakra-ui/react";
import React, { useMemo } from "react";

export const BOT_MESSAGE_FORMATS = [
    { label: "B", title: "بولد", tag: "b" },
    { label: "I", title: "ایتالیک", tag: "i" },
    { label: "U", title: "زیرخط", tag: "u" },
    { label: "S", title: "خط‌خوردگی", tag: "s" },
    { label: "‹›", title: "کد", tag: "code" },
];

export const BTN_STYLE_OPTIONS = [
    { value: "", label: "پیش‌فرض (شیشه‌ای)", swatch: "transparent" },
    { value: "primary", label: "آبی", swatch: "#3390EC" },
    { value: "success", label: "سبز", swatch: "#31A24C" },
    { value: "danger", label: "قرمز", swatch: "#E5484D" },
];

export const PREVIEW_BUTTON_PALETTE = {
    primary: { bg: "#3390EC", color: "#ffffff", hover: "#2f83d8" },
    success: { bg: "#31A24C", color: "#ffffff", hover: "#2c9345" },
    danger: { bg: "#E5484D", color: "#ffffff", hover: "#d14045" },
    "": { bg: "rgba(255,255,255,0.07)", color: "#6ab0f3", hover: "rgba(255,255,255,0.14)" },
};

export const CUSTOM_BUTTON_PREFIX = "custom_";

export const BUTTON_ACTION_LABELS = {
    buy_panel: "باز کردن منوی خرید پنل",
    my_panels: "نمایش پنل‌های کاربر",
    wallet: "نمایش کیف پول",
    test_panel: "دریافت پنل تست",
    support: "نمایش پیام پشتیبانی",
    confirm_buy_panel: "تایید و ساخت پنل نمایندگی",
    deposit: "منوی افزایش موجودی",
    gift_code: "ورود کد هدیه",
    back: "بازگشت به منوی اصلی",
    back_panel: "بازگشت به جزئیات پنل",
    deposit_5min: "واریز کارت‌به‌کارت هوشمند (۵ دقیقه‌ای)",
    deposit_receipt: "واریز با ارسال فیش",
    deposit_crypto: "پرداخت با رمزارز",
    open_url: "ورود به درگاه پنل (لینک)",
    create_new: "ساخت پنل جدید",
    list_back: "بازگشت به لیست پنل‌ها",
    chpass: "تغییر رمز عبور پنل",
    delpanel: "حذف پنل",
    gen_pass: "ساخت رمز عبور تصادفی",
    input_pass: "تایپ رمز دلخواه",
    confirm_del: "تایید حذف پنل",
};

export const PREVIEW_TARGETS = {
    main_menu: "main_menu",
    buy_panel: "buy_intro",
    my_panels: "panels_list",
    wallet: "wallet_menu",
    test_panel: "test_success",
    support: "back_menu",
    back: "main_menu",
    back_panel: "panel_detail",
    deposit: "deposit_menu",
    deposit_5min: "back_menu",
    deposit_receipt: "back_menu",
    deposit_crypto: "back_menu",
    create_new: "buy_intro",
    list_back: "panels_list",
    chpass: "change_pass",
    delpanel: "confirm_delete",
    confirm_del: "panels_list",
    gen_pass: "pass_changed",
    input_pass: "pass_changed",
};

export const KB_SAMPLE_MESSAGE_KEYS = {
    main_menu: "welcome",
    buy_intro: "terms",
    empty_panels: "panels_empty",
    wallet_menu: "wallet",
    deposit_menu: "deposit_menu",
    back_menu: "support",
};

// -------------------------------------------------------------
// Telegram HTML subset parser (no dangerouslySetInnerHTML)
// -------------------------------------------------------------

const TELEGRAM_TAG_RE =
    /<(\/?)(b|strong|i|em|u|s|strike|del|code|pre|a|tg-spoiler)(?:\s+href\s*=\s*(?:"([^"]*)"|'([^']*)'))?\s*>/gi;

const unescapeHtml = (text) =>
    text
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, "&");

export const parseTelegramHtml = (input) => {
    const text = String(input ?? "");
    const root = { tag: "root", children: [] };
    const stack = [root];
    let lastIndex = 0;
    TELEGRAM_TAG_RE.lastIndex = 0;
    let match = TELEGRAM_TAG_RE.exec(text);
    while (match !== null) {
        if (match.index > lastIndex) {
            stack[stack.length - 1].children.push({
                type: "text",
                value: unescapeHtml(text.slice(lastIndex, match.index)),
            });
        }
        lastIndex = TELEGRAM_TAG_RE.lastIndex;
        const isClosing = match[1] === "/";
        const tag = match[2].toLowerCase();
        const href = match[3] ?? match[4] ?? "";
        if (isClosing) {
            for (let i = stack.length - 1; i > 0; i -= 1) {
                if (stack[i].tag === tag) {
                    stack.length = i;
                    break;
                }
            }
        } else {
            const node = { tag, href, children: [] };
            stack[stack.length - 1].children.push(node);
            stack.push(node);
        }
        match = TELEGRAM_TAG_RE.exec(text);
    }
    if (lastIndex < text.length) {
        stack[stack.length - 1].children.push({ type: "text", value: unescapeHtml(text.slice(lastIndex)) });
    }
    return root.children;
};

export const renderTelegramNodes = (nodes, keyPrefix = "tg") =>
    nodes.map((node, index) => {
        const key = `${keyPrefix}-${index}`;
        if (node.type === "text") return node.value;
        const children = renderTelegramNodes(node.children, key);
        switch (node.tag) {
            case "b":
            case "strong":
                return <strong key={key}>{children}</strong>;
            case "i":
            case "em":
                return <em key={key}>{children}</em>;
            case "u":
                return (
                    <Text as="u" key={key}>
                        {children}
                    </Text>
                );
            case "s":
            case "strike":
            case "del":
                return <s key={key}>{children}</s>;
            case "code":
                return (
                    <Text key={key} as="code" fontFamily="mono" fontSize="0.85em" bg="whiteAlpha.200" borderRadius="sm" px={1}>
                        {children}
                    </Text>
                );
            case "pre":
                return (
                    <Box
                        key={key}
                        as="pre"
                        fontFamily="mono"
                        fontSize="0.85em"
                        bg="whiteAlpha.200"
                        borderRadius="sm"
                        px={2}
                        py={1}
                        my={1}
                        whiteSpace="pre-wrap"
                    >
                        {children}
                    </Box>
                );
            case "a":
                return (
                    <Link key={key} href={node.href || "#"} isExternal color="blue.300">
                        {children}
                    </Link>
                );
            case "tg-spoiler":
                return (
                    <Box
                        key={key}
                        as="span"
                        bg="blackAlpha.500"
                        borderRadius="sm"
                        px={1}
                        filter="blur(3px)"
                        transition="filter .15s ease"
                        _hover={{ filter: "none" }}
                    >
                        {children}
                    </Box>
                );
            default:
                return <React.Fragment key={key}>{children}</React.Fragment>;
        }
    });

export const applyTemplateVars = (template, vars) =>
    String(template ?? "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => vars[key] ?? match);

export const useSampleBotVars = (formSettings) =>
    useMemo(
        () => ({
            name: "کاربر نمونه",
            full_name: "کاربر نمونه",
            username: "sample_user",
            telegram_id: "123456789",
            brand: formSettings?.brand_name || "zonixvpn",
            panel_name: "panel_demo",
            panel_url: "https://panel.example.com",
            panel_expire: "1405/01/15",
            price_per_gb: formSettings?.price_per_gb || "5,000",
            balance: "120,000",
            min_balance: formSettings?.min_balance_to_start || "50,000",
            support: formSettings?.support_username || "@AdminSupport",
            channel: formSettings?.channel_username || "@MyChannel",
            max_panels: formSettings?.max_panels_per_user || "1",
            active_panels: "1",
            test_limit: formSettings?.test_limit_per_user || "1",
            amount: "200,000",
        }),
        [formSettings]
    );

export const shortenLabel = (text, max = 38) => {
    const clean = String(text ?? "")
        .replace(/\s+/g, " ")
        .trim();
    return clean.length > max ? `${clean.slice(0, max)}…` : clean;
};

export const actionLabelOf = (action, actions) => actions?.find((a) => a.action === action)?.label || action || "دستور سفارشی";

export const parseOverride = (value) => {
    if (!value) return null;
    try {
        const parsed = JSON.parse(value);
        if (parsed && Array.isArray(parsed.rows)) return parsed;
    } catch {
        return null;
    }
    return null;
};

export const normalizeOverride = (value, defaults) => {
    const parsed = parseOverride(value);
    return {
        rows: parsed?.rows ? parsed.rows.map((r) => (Array.isArray(r) ? [...r] : [])) : defaults,
        labels: parsed?.labels && typeof parsed.labels === "object" ? { ...parsed.labels } : {},
        hidden: Array.isArray(parsed?.hidden) ? [...parsed.hidden] : [],
        styles: parsed?.styles && typeof parsed.styles === "object" ? { ...parsed.styles } : {},
        custom: Array.isArray(parsed?.custom) ? parsed.custom.map((c) => ({ ...c })) : [],
    };
};

export const serializeOverride = (state) =>
    JSON.stringify({
        rows: state.rows,
        labels: state.labels,
        hidden: state.hidden,
        styles: state.styles,
        custom: state.custom,
    });

export const makeCustomButtonID = () =>
    `${CUSTOM_BUTTON_PREFIX}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
