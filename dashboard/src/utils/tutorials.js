export const normalizeTutorialLang = (lang) => (lang || "en").toLowerCase().startsWith("fa") ? "fa" : "en";
const normalizeDashboardRoot = (root) => {
    const normalized = root.replace(/\/+$/, "");
    return normalized === "/" ? "" : normalized;
};
const tutorialContentPath = "tutorial-content";
export const getTutorialsUrl = (dashboardRoot, lang, page = "") => {
    const root = normalizeDashboardRoot(dashboardRoot);
    const locale = normalizeTutorialLang(lang) === "fa" ? "fa/" : "";
    return `${root}/${tutorialContentPath}/${locale}docs/${page.replace(/^\/+/, "")}`;
};
export const getTutorialManifestUrl = (dashboardRoot) => `${normalizeDashboardRoot(dashboardRoot)}/${tutorialContentPath}/manifest.json`;
export const getTutorialSeenKey = (lang) => `rb-tutorials-seen-${normalizeTutorialLang(lang)}`;
