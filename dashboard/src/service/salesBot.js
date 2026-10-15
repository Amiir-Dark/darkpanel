import { fetch as apiFetch } from "./http";

export const getSalesBotOverview = async () => {
    return apiFetch("/sales-bot/overview");
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
    if (params.limit) searchParams.set("limit", String(params.limit));
    const qs = searchParams.toString();
    return apiFetch(`/sales-bot/users${qs ? `?${qs}` : ""}`);
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
