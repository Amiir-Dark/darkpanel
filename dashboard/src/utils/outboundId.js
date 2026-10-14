const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const normalizeOutboundConfig = (outbound) => {
    if (!isObject(outbound))
        return {};
    const cloned = { ...outbound };
    delete cloned.tag;
    return cloned;
};
const sortDeep = (value) => {
    if (Array.isArray(value)) {
        return value.map(sortDeep);
    }
    if (isObject(value)) {
        const sorted = {};
        for (const key of Object.keys(value).sort()) {
            sorted[key] = sortDeep(value[key]);
        }
        return sorted;
    }
    return value;
};
const stableStringify = (value) => JSON.stringify(sortDeep(value));
const bufferToHex = (buffer) => Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
const fallbackHash = (input) => {
    // Lightweight deterministic hash (FNV-1a 32-bit) as a safety net.
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i += 1) {
        hash ^= input.charCodeAt(i);
        hash = (hash * 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, "0").slice(0, 16);
};
export const computeOutboundId = async (outbound) => {
    const normalized = normalizeOutboundConfig(outbound);
    const serialized = stableStringify(normalized);
    try {
        if (globalThis.crypto?.subtle?.digest) {
            const encoded = new TextEncoder().encode(serialized);
            const digest = await globalThis.crypto.subtle.digest("SHA-256", encoded);
            return bufferToHex(digest).slice(0, 16);
        }
    }
    catch {
        // Fall through to fallback hash.
    }
    return fallbackHash(serialized);
};
export const computeOutboundIds = async (outbounds) => Promise.all(outbounds.map(computeOutboundId));
