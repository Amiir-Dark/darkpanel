export const parseHostClientSettings = (value) => {
    const parsed = JSON.parse(value.trim() || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Client settings must be a JSON object.");
    }
    if (new TextEncoder().encode(value).length > 65536) {
        throw new Error("Client settings must not exceed 64 KiB.");
    }
    return parsed;
};
export const hostClientSettingsError = (value) => {
    try {
        parseHostClientSettings(value);
        return null;
    }
    catch (error) {
        return error instanceof Error ? error.message : "Invalid client settings.";
    }
};
