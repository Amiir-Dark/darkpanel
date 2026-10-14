import { fetch } from "./http";
export const login = (username, password) => fetch("/auth/login", {
    method: "POST",
    body: { username, password },
});
export const getSession = () => fetch("/auth/session");
export const logout = () => fetch("/auth/logout", { method: "POST" });
export const verify2FA = (code) => fetch("/auth/2fa/verify", { method: "POST", body: { code } });
export const start2FASetup = () => fetch("/auth/2fa/setup", { method: "POST" });
export const confirm2FASetup = (code) => fetch("/auth/2fa/confirm", { method: "POST", body: { code } });
export const listSessions = async () => {
    const response = await fetch("/auth/sessions");
    return response.sessions;
};
export const revokeSession = (id) => fetch(`/auth/sessions/${id}`, { method: "DELETE" });
export const disable2FA = (password, code) => fetch("/auth/2fa", {
    method: "DELETE",
    body: { password, code },
});
export const listAdminSessions = async (username) => {
    const response = await fetch(`/admin/${encodeURIComponent(username)}/sessions`);
    return response.sessions;
};
export const revokeAdminSession = (username, id) => fetch(`/admin/${encodeURIComponent(username)}/sessions/${id}`, {
    method: "DELETE",
});
export const setupAdmin2FA = (username) => fetch(`/admin/${encodeURIComponent(username)}/2fa/setup`, {
    method: "POST",
});
export const disableAdmin2FA = (username) => fetch(`/admin/${encodeURIComponent(username)}/2fa`, {
    method: "DELETE",
});
export const listAdminApiKeys = (username) => fetch(`/admin/${encodeURIComponent(username)}/api-keys`);
export const createAdminApiKey = (username, lifetime) => fetch(`/admin/${encodeURIComponent(username)}/api-keys`, {
    method: "POST",
    body: { lifetime },
});
export const deleteAdminApiKey = (username, id) => fetch(`/admin/${encodeURIComponent(username)}/api-keys/${id}`, {
    method: "DELETE",
});
