import { $fetch, apiBaseURL, fetch as apiFetch, reportAPIError, useAPIRequestErrors } from "./http";
const disabledTelegramSettings = {
    api_token: null,
    use_telegram: false,
    proxy_url: null,
    admin_chat_ids: [],
    logs_chat_id: null,
    logs_chat_is_forum: false,
    backup_chat_id: null,
    backup_chat_is_forum: false,
    default_vless_flow: null,
    forum_topics: {},
    event_toggles: {},
    backup_enabled: false,
    backup_scope: "database",
    backup_interval_value: 24,
    backup_interval_unit: "hours",
    backup_last_sent_at: null,
    backup_last_error: null,
};
const isGoneResponse = (error) => {
    const maybeError = error;
    return (maybeError?.status === 410 ||
        maybeError?.statusCode === 410 ||
        maybeError?.response?.status === 410 ||
        maybeError?.data?.status === 410);
};
export const getTelegramSettings = async () => {
    try {
        return await apiFetch("/settings/telegram");
    }
    catch (error) {
        if (isGoneResponse(error))
            return disabledTelegramSettings;
        throw error;
    }
};
export const updateTelegramSettings = async (payload) => {
    return apiFetch("/settings/telegram", {
        method: "PUT",
        body: JSON.stringify(payload),
    });
};
export const testTelegramSettings = async () => {
    return apiFetch("/settings/telegram/test", {
        method: "POST",
        body: JSON.stringify({}),
    });
};
export const sendTelegramBackup = async (scope) => {
    return apiFetch("/settings/telegram/backup/send", {
        method: "POST",
        body: JSON.stringify({ scope }),
    });
};
export const getSubscriptionPlaceholderSettings = async () => apiFetch("/settings/placeholders");
export const updateSubscriptionPlaceholderSetting = async (payload) => apiFetch("/settings/placeholders", {
    method: "PUT",
    body: JSON.stringify(payload),
});
export const updateAllSettings = async (payload) => {
    return apiFetch("/settings/all", {
        method: "PUT",
        body: JSON.stringify(payload),
    });
};
export const getRuntimeSettings = async () => {
    return apiFetch("/settings");
};
export const updateRuntimeSettings = async (payload) => {
    return apiFetch("/settings", {
        method: "PUT",
        body: JSON.stringify(payload),
    });
};
export const getPHPMyAdminStatus = async () => {
    return apiFetch("/settings/phpmyadmin");
};
export const enablePHPMyAdmin = async (payload) => {
    return apiFetch("/settings/phpmyadmin/enable", {
        method: "POST",
        body: JSON.stringify(payload),
        timeout: 600000,
    });
};
export const disablePHPMyAdmin = async () => {
    return apiFetch("/settings/phpmyadmin/disable", {
        method: "POST",
        body: JSON.stringify({}),
        timeout: 600000,
    });
};
export const getExternalApps = async () => {
    return apiFetch("/settings/external-apps");
};
export const installExternalArchive = async (payload) => {
    const body = new FormData();
    body.set("domain", payload.domain);
    body.set("name", payload.name);
    body.set("runtime", payload.runtime);
    body.set("create_database", String(payload.create_database));
    if (payload.archive)
        body.set("archive", payload.archive);
    if (payload.create_database) {
        body.set("database", payload.database ?? "");
        body.set("database_user", payload.database_user ?? "");
        body.set("database_password", payload.database_password ?? "");
    }
    return $fetch("/settings/external-apps/archive", {
        method: "POST",
        body,
        timeout: 20 * 60 * 1000,
    });
};
export const installMirzaBot = async (payload) => {
    const body = new FormData();
    body.set("domain", payload.domain);
    body.set("bot_token", payload.bot_token);
    body.set("admin_id", payload.admin_id);
    if (payload.database_backup) {
        body.set("database_backup", payload.database_backup);
    }
    return $fetch("/settings/external-apps/mirzabot", {
        method: "POST",
        body,
        timeout: 20 * 60 * 1000,
    });
};
export const installFaoxima = async (payload) => {
    const body = new FormData();
    body.set("domain", payload.domain);
    body.set("bot_token", payload.bot_token);
    body.set("admin_id", payload.admin_id);
    if (payload.database_backup) {
        body.set("database_backup", payload.database_backup);
    }
    return $fetch("/settings/external-apps/faoxima", {
        method: "POST",
        body,
        timeout: 20 * 60 * 1000,
    });
};
export const setExternalAppEnabled = async (payload) => {
    return apiFetch(`/settings/external-apps/${encodeURIComponent(payload.id)}/${payload.enabled ? "enable" : "disable"}`, { method: "POST", body: JSON.stringify({}), timeout: 120000 });
};
export const updateExternalMirzaBot = async (id) => {
    return apiFetch(externalAppPath(id, "/update"), {
        method: "POST",
        body: JSON.stringify({}),
        timeout: 20 * 60 * 1000,
    });
};
export const exportExternalAppDatabase = async (id) => {
    return $fetch(externalAppPath(id, "/database-backup"), {
        responseType: "blob",
        credentials: "include",
        timeout: 10 * 60 * 1000,
    });
};
export const updateExternalAppSettings = async (payload) => {
    return apiFetch(externalAppPath(payload.id, "/settings"), {
        method: "PUT",
        body: JSON.stringify({
            index_file: payload.index_file,
            fallback_to_index: payload.fallback_to_index,
            max_request_body_mb: payload.max_request_body_mb,
            static_cache_seconds: payload.static_cache_seconds,
            not_found_file: payload.not_found_file,
        }),
    });
};
export const deleteExternalApp = async (payload) => {
    await apiFetch(`/settings/external-apps/${encodeURIComponent(payload.id)}`, {
        method: "DELETE",
        body: JSON.stringify({ keep_database: payload.keep_database }),
        timeout: 10 * 60 * 1000,
    });
};
const externalAppPath = (id, suffix = "") => `/settings/external-apps/${encodeURIComponent(id)}${suffix}`;
export const getExternalAppFiles = async (domain) => {
    return apiFetch(externalAppPath(domain, "/files"));
};
export const getExternalAppFile = async (domain, path) => {
    return apiFetch(`${externalAppPath(domain, "/files/content")}?path=${encodeURIComponent(path)}`);
};
export const saveExternalAppFile = async (payload) => {
    await apiFetch(externalAppPath(payload.domain, "/files/content"), {
        method: "PUT",
        body: JSON.stringify({ path: payload.path, content: payload.content }),
    });
};
export const createExternalAppFolder = async (payload) => {
    await apiFetch(externalAppPath(payload.domain, "/files/folder"), {
        method: "POST",
        body: JSON.stringify({ path: payload.path }),
    });
};
export const moveExternalAppFile = async (payload) => {
    await apiFetch(externalAppPath(payload.domain, "/files/move"), {
        method: "POST",
        body: JSON.stringify(payload),
    });
};
export const deleteExternalAppFiles = async (payload) => {
    await apiFetch(externalAppPath(payload.domain, "/files/delete"), {
        method: "POST",
        body: JSON.stringify({ paths: payload.paths }),
    });
};
const externalAppAPIBase = (apiBaseURL || "/api").replace(/\/$/, "");
export const externalAppFileUploadURL = (domain) => `${externalAppAPIBase}${externalAppPath(domain, "/files/upload")}`;
export const externalAppFileDownloadURL = (domain, path) => `${externalAppAPIBase}${externalAppPath(domain, "/files/download")}?path=${encodeURIComponent(path)}`;
export const getExternalAppPHPConfig = async (domain) => {
    return apiFetch(externalAppPath(domain, "/php-config"));
};
export const saveExternalAppPHPConfig = async (payload) => {
    await apiFetch(externalAppPath(payload.domain, "/php-config"), {
        method: "PUT",
        body: JSON.stringify({ content: payload.content }),
    });
};
export const getPHPMyAdminEmbedHTML = async (theme) => {
    const search = theme ? `?theme=${encodeURIComponent(theme)}` : "";
    return apiFetch(`/settings/phpmyadmin/embed-html${search}`, {
        responseType: "text",
    });
};
export const getPanelSettings = async () => {
    return apiFetch("/settings/panel");
};
export const updatePanelSettings = async (payload) => {
    return apiFetch("/settings/panel", {
        method: "PUT",
        body: JSON.stringify(payload),
    });
};
export const exportRebeccaBackup = async (scope) => {
    return $fetch(`/settings/backup/export?scope=${scope}`, {
        responseType: "blob",
        credentials: "include",
    });
};
export const importRebeccaBackup = async (file, onProgress) => {
    return new Promise((resolve, reject) => {
        const errorKey = "POST /settings/backup/import";
        const fail = (error) => {
            reportAPIError(errorKey, error);
            reject(error);
        };
        const body = new FormData();
        body.append("file", file);
        const xhr = new XMLHttpRequest();
        const baseURL = (apiBaseURL || "/api").replace(/\/$/, "");
        xhr.open("POST", `${baseURL}/settings/backup/import`);
        xhr.withCredentials = true;
        xhr.responseType = "json";
        const responseBody = () => {
            if (xhr.response !== null && xhr.response !== undefined) {
                return xhr.response;
            }
            try {
                const text = xhr.responseText?.trim();
                if (!text)
                    return undefined;
                return JSON.parse(text);
            }
            catch {
                return undefined;
            }
        };
        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
                onProgress?.(Math.min(100, Math.round((event.loaded / event.total) * 100)));
            }
        };
        xhr.upload.onload = () => onProgress?.(100);
        xhr.onload = () => {
            const response = responseBody();
            if (xhr.status >= 200 && xhr.status < 300) {
                useAPIRequestErrors.getState().clear(errorKey);
                resolve(response);
                return;
            }
            const responseRecord = response && typeof response === "object"
                ? response
                : undefined;
            const detail = typeof response === "string"
                ? response
                : typeof responseRecord?.detail === "string"
                    ? responseRecord.detail
                    : typeof responseRecord?.message === "string"
                        ? responseRecord.message
                        : `Request failed (HTTP ${xhr.status})`;
            const error = new Error(detail);
            error.response = {
                status: xhr.status,
                _data: response,
            };
            fail(error);
        };
        xhr.onerror = () => fail(new Error("Backup upload failed; check your connection and retry"));
        xhr.ontimeout = () => fail(new Error("Backup upload timed out; retry with a stable connection"));
        xhr.onabort = () => reject(new Error("Backup upload was cancelled"));
        onProgress?.(0);
        xhr.send(body);
    });
};
export const getSubscriptionSettings = async () => {
    return apiFetch("/settings/subscriptions");
};
export const updateSubscriptionSettings = async (payload) => {
    return apiFetch("/settings/subscriptions", {
        method: "PUT",
        body: JSON.stringify(payload),
    });
};
export const updateAdminSubscriptionSettings = async (adminId, payload) => {
    return apiFetch(`/settings/subscriptions/admins/${adminId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
    });
};
export const issueSubscriptionCertificate = async (payload) => {
    return apiFetch("/settings/subscriptions/certificates/issue", {
        method: "POST",
        body: JSON.stringify(payload),
    });
};
export const renewSubscriptionCertificate = async (payload) => {
    return apiFetch("/settings/subscriptions/certificates/renew", {
        method: "POST",
        body: JSON.stringify(payload),
    });
};
export const importSubscriptionCertificate = async (payload) => {
    return apiFetch("/settings/subscriptions/certificates/import", {
        method: "POST",
        body: JSON.stringify(payload),
    });
};
export const revokeSubscriptionCertificate = async (domain) => {
    return apiFetch(`/settings/subscriptions/certificates/${encodeURIComponent(domain)}/revoke`, { method: "POST", body: JSON.stringify({}) });
};
export const deleteSubscriptionCertificate = async (domain) => {
    return apiFetch(`/settings/subscriptions/certificates/${encodeURIComponent(domain)}`, { method: "DELETE" });
};
export const updateSubscriptionCertificateServing = async (domain, serveTLS) => {
    return apiFetch(`/settings/subscriptions/certificates/${encodeURIComponent(domain)}`, {
        method: "PUT",
        body: JSON.stringify({ serve_tls: serveTLS }),
    });
};
export const getUserHWIDs = async (username) => {
    return apiFetch(`/user/${encodeURIComponent(username)}/hwids`, {
        method: "GET",
    });
};
export const resetUserHWIDs = async (username) => {
    return apiFetch(`/user/${encodeURIComponent(username)}/hwids`, {
        method: "DELETE",
    });
};
export const testResellerTelegram = async (payload) => {
    return apiFetch("/settings/subscriptions/reseller/telegram/test", {
        method: "POST",
        body: JSON.stringify(payload),
    });
};
export const triggerResellerBackup = async (payload) => {
    return apiFetch("/settings/subscriptions/reseller/telegram/backup", {
        method: "POST",
        body: JSON.stringify(payload || {}),
    });
};
