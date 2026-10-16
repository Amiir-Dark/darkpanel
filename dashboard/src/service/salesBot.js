import { fetch as apiFetch } from "./http";

export const getSalesBotOverview = async () => {
    return apiFetch("/sales-bot/overview");
};

export const getSalesBotServiceStatus = async () => {
    return apiFetch("/sales-bot/service/status");
};

export const startSalesBotService = async () => {
    return apiFetch("/sales-bot/service/start", {
        method: "POST",
        body: JSON.stringify({}),
    });
};

export const stopSalesBotService = async () => {
    return apiFetch("/sales-bot/service/stop", {
        method: "POST",
        body: JSON.stringify({}),
    });
};

export const restartSalesBotService = async () => {
    return apiFetch("/sales-bot/service/restart", {
        method: "POST",
        body: JSON.stringify({}),
    });
};

export const getSalesBotSettings = async () => {
    return apiFetch("/sales-bot/settings");
};

export const updateSalesBotSettings = async (settings) => {
    return apiFetch("/sales-bot/settings", {
        method: "POST",
        body: JSON.stringify(settings),
    });
};

export const getSalesBotOrders = async (params = {}) => {
    const searchParams = new URLSearchParams();
    if (params.status) searchParams.set("status", params.status);
    if (params.limit) searchParams.set("limit", String(params.limit));
    const qs = searchParams.toString();
    return apiFetch(`/sales-bot/orders${qs ? `?${qs}` : ""}`);
};

export const orderAction = async (orderId, action) => {
    return apiFetch(`/sales-bot/orders/${encodeURIComponent(orderId)}/${encodeURIComponent(action)}`, {
        method: "POST",
        body: JSON.stringify({}),
    });
};

export const getSalesBotRevenueStats = async (params = {}) => {
    const searchParams = new URLSearchParams();
    if (params.days) searchParams.set("days", String(params.days));
    const qs = searchParams.toString();
    return apiFetch(`/sales-bot/stats/revenue${qs ? `?${qs}` : ""}`);
};

export const getReceiptImage = async (receiptId) => {
    return apiFetch(`/sales-bot/receipts/${encodeURIComponent(receiptId)}/image`, {
        responseType: "blob",
    });
};

export const getSalesBotReceipts = async (params = {}) => {
    const searchParams = new URLSearchParams();
    if (params.status) searchParams.set("status", params.status);
    if (params.limit) searchParams.set("limit", String(params.limit));
    const qs = searchParams.toString();
    return apiFetch(`/sales-bot/receipts${qs ? `?${qs}` : ""}`);
};

export const receiptAction = async (receiptId, action) => {
    return apiFetch(`/sales-bot/receipts/${encodeURIComponent(receiptId)}/${encodeURIComponent(action)}`, {
        method: "POST",
        body: JSON.stringify({}),
    });
};

export const getSalesBotUsers = async (params = {}) => {
    const searchParams = new URLSearchParams();
    if (params.search) searchParams.set("search", params.search);
    if (params.status) searchParams.set("status", params.status);
    if (params.test) searchParams.set("test", params.test);
    if (params.limit) searchParams.set("limit", String(params.limit));
    const qs = searchParams.toString();
    return apiFetch(`/sales-bot/users${qs ? `?${qs}` : ""}`);
};

export const getUserDetails = async (telegramId) => {
    return apiFetch(`/sales-bot/users/${encodeURIComponent(telegramId)}/details`);
};

export const sendUserMessage = async (telegramId, message) => {
    return apiFetch(`/sales-bot/users/${encodeURIComponent(telegramId)}/message`, {
        method: "POST",
        body: JSON.stringify({ message }),
    });
};

export const toggleUserStatus = async (telegramId) => {
    return apiFetch(`/sales-bot/users/${encodeURIComponent(telegramId)}/toggle-status`, {
        method: "POST",
        body: JSON.stringify({}),
    });
};

export const adjustUserWallet = async (telegramId, payload) => {
    return apiFetch(`/sales-bot/users/${encodeURIComponent(telegramId)}/wallet`, {
        method: "POST",
        body: JSON.stringify(payload),
    });
};

export const testSalesBotWebhook = async () => {
    return apiFetch("/sales-bot/webhook/test", {
        method: "POST",
        body: JSON.stringify({}),
    });
};

export const getSalesBotWebhookLogs = async (params = {}) => {
    const searchParams = new URLSearchParams();
    if (params.limit) searchParams.set("limit", String(params.limit));
    const qs = searchParams.toString();
    return apiFetch(`/sales-bot/webhook/logs${qs ? `?${qs}` : ""}`);
};

export const clearSalesBotWebhookLogs = async () => {
    return apiFetch("/sales-bot/webhook/logs/clear", {
        method: "POST",
        body: JSON.stringify({}),
    });
};

export const simulateSalesBotWebhook = async (payload) => {
    return apiFetch("/sales-bot/webhook/simulate", {
        method: "POST",
        body: JSON.stringify(payload),
    });
};

export const broadcastMessage = async (message, buttons = []) => {
    return apiFetch("/sales-bot/broadcast", {
        method: "POST",
        body: JSON.stringify({ message, buttons }),
    });
};

export const getSalesBotMessages = async () => {
    return apiFetch("/sales-bot/messages");
};

export const getGiftCodes = async () => {
    return apiFetch("/sales-bot/gift-codes");
};

export const createGiftCode = async (payload) => {
    return apiFetch("/sales-bot/gift-codes", {
        method: "POST",
        body: JSON.stringify(payload),
    });
};

export const deleteGiftCode = async (id) => {
    return apiFetch(`/sales-bot/gift-codes/${encodeURIComponent(id)}`, {
        method: "DELETE",
    });
};

export const resetAllTestAccess = async () => {
    return apiFetch("/sales-bot/test-resets/all", {
        method: "POST",
        body: JSON.stringify({}),
    });
};

export const resetUserTestAccess = async (telegramId) => {
    return apiFetch(`/sales-bot/users/${encodeURIComponent(telegramId)}/reset-test`, {
        method: "POST",
        body: JSON.stringify({}),
    });
};

