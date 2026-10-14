import { fetch as apiFetch } from "./http";
export const getNotifications = async (query) => {
    return apiFetch("/notifications", { query });
};
export const markNotificationsRead = async (payload) => {
    return apiFetch("/notifications/read", {
        method: "POST",
        body: JSON.stringify(payload),
    });
};
export const sendNotification = async (payload) => {
    return apiFetch("/notifications", {
        method: "POST",
        body: JSON.stringify(payload),
    });
};
export const getSentNotifications = async () => {
    return apiFetch("/notifications/sent");
};
export const getNotificationRecipients = async () => {
    return apiFetch("/notifications/recipients");
};
export const getNotificationRules = async () => {
    return apiFetch("/notifications/rules");
};
export const updateNotificationRule = async (key, payload) => {
    return apiFetch(`/notifications/rules/${encodeURIComponent(key)}`, {
        method: "PUT",
        body: JSON.stringify(payload),
    });
};
