import { fetch as apiFetch } from "./http";
export const getMyAccount = async (query) => {
    return apiFetch("/myaccount", { query });
};
export const getAdminNodesUsage = async (username, query) => {
    return apiFetch(`/admin/${encodeURIComponent(username)}/usage/nodes`, {
        query,
    });
};
export const changeMyAccountPassword = async (payload) => {
    return apiFetch("/myaccount/change_password", {
        method: "POST",
        body: JSON.stringify(payload),
    });
};
export const listApiKeys = async () => {
    const response = await apiFetch("/myaccount/api-keys");
    if (Array.isArray(response))
        return response;
    if (response && typeof response === "object") {
        const payload = response;
        if (Array.isArray(payload.api_keys))
            return payload.api_keys;
        if (Array.isArray(payload.apiKeys))
            return payload.apiKeys;
        if (Array.isArray(payload.keys))
            return payload.keys;
        if (Array.isArray(payload.obj))
            return payload.obj;
    }
    return [];
};
export const createApiKey = async (lifetime) => {
    return apiFetch("/myaccount/api-keys", {
        method: "POST",
        body: JSON.stringify({ lifetime }),
    });
};
export const deleteApiKey = async (id, current_password) => {
    return apiFetch(`/myaccount/api-keys/${id}`, {
        method: "DELETE",
        body: JSON.stringify({ current_password }),
    });
};
