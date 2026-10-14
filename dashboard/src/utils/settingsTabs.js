export const integrationTabKeys = [
    "panel",
    "telegram",
    "subscriptions",
    "ssl",
    "placeholders",
];
export const parseSettingsHash = (value) => {
    const [tabWithQuery = ""] = value.replace(/^#/, "").split("#").filter(Boolean);
    const [tab = "", query = ""] = tabWithQuery.split("?");
    const index = integrationTabKeys.findIndex((key) => key.toLowerCase() === tab.toLowerCase());
    return {
        tab,
        focus: query ? new URLSearchParams(query).get("focus") || "" : "",
        index: index >= 0 ? index : 0,
    };
};
