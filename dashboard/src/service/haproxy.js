import { fetch as apiFetch } from "./http";
export const haproxyMatcherPriority = [
    "sni",
    "http_path",
    "http_host",
    "default",
];
export const preferredHAProxyMatcher = (matchers) => haproxyMatcherPriority
    .map((type) => matchers.find((matcher) => matcher.type === type))
    .find(Boolean) ?? matchers[0];
export const cloneHAProxyTargetForNode = (source, nodeID, candidates, templates, randomizeTemplates, random = Math.random) => {
    const target = JSON.parse(JSON.stringify(source));
    target.node_id = nodeID;
    delete target.generated_config;
    const missing = new Set();
    for (const listener of target.listeners) {
        listener.routes = listener.routes.map((route) => {
            if (route.source !== "xray")
                return route;
            const candidate = candidates.find((item) => item.tag === route.inbound_tag &&
                item.matchers.some((matcher) => matcher.type === route.match_type &&
                    (matcher.value || "") === (route.match_value || "")));
            if (!candidate) {
                missing.add(route.inbound_tag || route.name);
                return route;
            }
            return {
                ...route,
                protocol: candidate.protocol,
                backend_host: "127.0.0.1",
                backend_port: candidate.port,
            };
        });
        listener.sites =
            listener.sites ?? (listener.site?.enabled ? [listener.site] : []);
        delete listener.site;
        if (!randomizeTemplates)
            continue;
        const used = new Set();
        for (const site of listener.sites) {
            if (site.source !== "templatemo" || templates.length === 0)
                continue;
            const current = site.template_id ||
                site.template_url?.match(/\/tm-([0-9]{3}-[a-z0-9-]+)/i)?.[1] ||
                "";
            const unused = templates.filter((template) => template.id !== current && !used.has(template.id));
            const alternatives = templates.filter((template) => template.id !== current);
            const pool = unused.length
                ? unused
                : alternatives.length
                    ? alternatives
                    : templates;
            const template = pool[Math.floor(Math.max(0, Math.min(0.999999999, random())) * pool.length)];
            if (!template)
                continue;
            used.add(template.id);
            site.template_id = template.id;
            site.template_url = "";
        }
    }
    return missing.size
        ? { missingInbounds: [...missing] }
        : { target, missingInbounds: [] };
};
export const getHAProxyOverview = () => apiFetch("/haproxy");
export const getHAProxyCandidates = (nodeID) => apiFetch(`/haproxy/candidates/${nodeID}`);
export const createHAProxyConfig = (config) => apiFetch("/haproxy", { method: "POST", body: config });
export const updateHAProxyConfig = (config) => apiFetch(`/haproxy/${config.id}`, {
    method: "PUT",
    body: config,
});
export const deleteHAProxyConfig = (id) => apiFetch(`/haproxy/${id}`, { method: "DELETE" });
export const previewHAProxyConfig = (config) => apiFetch("/haproxy/preview", { method: "POST", body: config });
export const uploadHAProxyTemplate = (name, archive) => {
    const body = new FormData();
    body.set("name", name);
    body.set("archive", archive);
    return apiFetch("/haproxy/templates", {
        method: "POST",
        body,
    });
};
