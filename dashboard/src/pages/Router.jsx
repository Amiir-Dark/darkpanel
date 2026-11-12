import { lazy, Suspense, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { createBrowserRouter, isRouteErrorResponse, Navigate, redirect, useNavigate, useRouteError, } from "react-router-dom";
import { Button, Spinner } from "../components/linear/UI";
import { fetch } from "../service/http";
import { recoverFromStaleChunk } from "../utils/chunkRecovery";
import { Login } from "./Login";
import { AppLayout } from "../components/AppLayout";
import { DashboardPage } from "./DashboardPage";
import { UsersPage } from "./UsersPage";
const LegacyChakraWrapper = lazy(() => import("../components/linear/LegacyChakraWrapper"));
const AccessInsightsPage = lazy(() => import("./AccessInsightsPage"));
const AdminsPage = lazy(() => import("./AdminsPage"));
const ApiDocsPage = lazy(async () => ({
    default: (await import("./ApiDocsPage")).ApiDocsPage,
}));
const BulkActionsPage = lazy(() => import("./BulkActionsPage"));
const CoreSettingsPage = lazy(() => import("./CoreSettingsPage"));
const HostsPage = lazy(() => import("./HostsPage"));
const HAProxyPage = lazy(() => import("./HAProxyPage"));
const IntegrationSettingsPage = lazy(async () => ({
    default: (await import("./IntegrationSettingsPage")).IntegrationSettingsPage,
}));
const PlaceholderSettingsPage = lazy(() => import("./PlaceholderSettingsPage"));
const RecentActionsPage = lazy(async () => ({
    default: (await import("./RecentActionsPage")).RecentActionsPage,
}));
const MyAccountPage = lazy(() => import("./MyAccountPage"));
const NodesPage = lazy(() => import("./NodesPage"));
const PhpMyAdminPage = lazy(async () => ({
    default: (await import("./PhpMyAdminPage")).PhpMyAdminPage,
}));
const ExternalAppsPage = lazy(async () => ({
    default: (await import("./ExternalAppsPage")).ExternalAppsPage,
}));
const ServicesPage = lazy(() => import("./ServicesPage"));
const TutorialsPage = lazy(async () => ({
    default: (await import("./TutorialsPage")).TutorialsPage,
}));
const UsagePage = lazy(() => import("./UsagePage"));
const XrayLogsPage = lazy(() => import("./XrayLogsPage"));
const ErrorsPage = lazy(() => import("./ErrorsPage"));
const NotificationsPage = lazy(() => import("./NotificationsPage"));
const SalesBotPage = lazy(async () => ({
    default: (await import("./SalesBotPage")).SalesBotPage,
}));
const PageLoading = () => (
	<div className="flex h-64 items-center justify-center">
		<Spinner className="h-6 w-6" />
	</div>
);
const LazyPage = ({ Page }) => (
	<Suspense fallback={<PageLoading />}>
		<LegacyChakraWrapper>
			<Page />
		</LegacyChakraWrapper>
	</Suspense>
);
const routeErrorMessage = (error) => {
    if (isRouteErrorResponse(error)) {
        return error.statusText || `Request failed with status ${error.status}`;
    }
    if (error instanceof Error) {
        return error.message;
    }
    return "The page could not be loaded.";
};
const RouteErrorPage = () => {
    const error = useRouteError();
    const navigate = useNavigate();
    const { t } = useTranslation();
    useEffect(() => {
        recoverFromStaleChunk(error);
    }, [error]);
    return (
		<div className="min-h-screen bg-canvas px-6 py-10 text-ink">
			<div className="mx-auto flex max-w-2xl flex-col items-start gap-4">
				<h1 className="text-xl font-semibold">{t("router.errorTitle") || "Something went wrong"}</h1>
				<p className="text-sm text-ink-subtle">{t("router.errorDescription") || "An unexpected error occurred."}</p>
				<pre className="w-full whitespace-pre-wrap rounded-lg border border-red-500/30 bg-red-500/10 p-4 font-mono text-xs text-red-400">
					{routeErrorMessage(error)}
				</pre>
				<Button variant="primary" onClick={() => navigate("/")}>
					{t("router.backToDashboard") || "Back to dashboard"}
				</Button>
			</div>
		</div>
	);
};
const routeSegments = new Set([
    "login",
    "users",
    "bulk-actions",
    "admins",
    "myaccount",
    "usage",
    "services",
    "hosts",
    "node-settings",
    "integrations",
    "settings",
    "xray-settings",
    "xray-logs",
    "errors",
    "notifications",
    "access-insights",
    "phpmyadmin",
    "recent-actions",
    "placeholders",
    "sales-bot",
]);
const trimTrailingSlash = (value) => {
    if (value.length <= 1)
        return value;
    return value.replace(/\/+$/, "");
};
const getDashboardBasename = () => {
    if (typeof window === "undefined")
        return "/dashboard";
    const segments = window.location.pathname.split("/").filter(Boolean);
    if (!segments.length)
        return import.meta.env.DEV ? "/" : "/dashboard";
    const routeIndex = segments.findIndex((segment) => routeSegments.has(segment));
    if (routeIndex > 0) {
        return `/${segments.slice(0, routeIndex).join("/")}`;
    }
    if (routeIndex === 0)
        return "/";
    return trimTrailingSlash(window.location.pathname) || "/";
};
const normalizeLegacyHashRoute = (basename) => {
    if (typeof window === "undefined")
        return;
    const { hash, search } = window.location;
    if (!hash.startsWith("#/"))
        return;
    const hashRoute = hash.slice(1);
    if (!hashRoute || hashRoute === "/")
        return;
    const base = basename === "/" ? "" : basename;
    const nextPath = `${base}${hashRoute}`;
    const nextURL = `${nextPath}${search}`;
    if (`${window.location.pathname}${search}` !== nextURL) {
        window.history.replaceState(null, "", nextURL);
    }
};
const dashboardBasename = getDashboardBasename();
normalizeLegacyHashRoute(dashboardBasename);
const fetchAdminLoader = async ({ request }) => {
    try {
        const response = await fetch("/auth/session");
        if (response?.state === "disabled") {
            const pathname = new URL(request.url).pathname.replace(/\/+$/, "");
            if (!pathname.endsWith("/users"))
                throw redirect("/users/");
        }
        else if (response?.state !== "active") {
            throw redirect("/login/");
        }
        if (response && typeof response === "object" && "error" in response) {
            throw new Error(`API error: ${response.error || "Unknown error"}`);
        }
        return response;
    }
    catch (error) {
        const status = error?.response
            ?.status ?? error?.status;
        if (status === 401 || status === 403) {
            throw redirect("/login/");
        }
        console.error("Loader error:", error);
        throw error;
    }
};
export const router = createBrowserRouter([
    {
        path: "/",
        element: <AppLayout />,
        hydrateFallbackElement: <PageLoading />,
        errorElement: <RouteErrorPage />,
        loader: fetchAdminLoader,
        children: [
            {
                index: true,
                element: <DashboardPage />,
            },
            {
                path: "users",
                element: <UsersPage />,
            },
            {
                path: "bulk-actions",
                element: <Navigate to="/users" replace/>,
            },
            {
                path: "admins",
                element: <LazyPage Page={AdminsPage}/>,
            },
            {
                path: "myaccount",
                element: <LazyPage Page={MyAccountPage}/>,
            },
            {
                path: "usage",
                element: <LazyPage Page={UsagePage}/>,
            },
            {
                path: "tutorials",
                element: <Navigate to="/settings" replace/>,
            },
            {
                path: "services",
                element: <LazyPage Page={ServicesPage}/>,
            },
            {
                path: "hosts",
                element: <LazyPage Page={HostsPage}/>,
            },
            {
                path: "haproxy",
                element: <Navigate to="/settings" replace/>,
            },
            {
                path: "node-settings",
                element: <LazyPage Page={NodesPage}/>,
            },
            {
                path: "settings",
                element: <LazyPage Page={IntegrationSettingsPage}/>,
            },
            {
                path: "placeholders",
                element: <Navigate to="/settings#placeholders" replace/>,
            },
            {
                path: "integrations",
                element: <Navigate to="/settings#panel" replace/>,
            },
            {
                path: "xray-settings",
                element: <LazyPage Page={CoreSettingsPage}/>,
            },
            {
                path: "xray-logs",
                element: <LazyPage Page={XrayLogsPage}/>,
            },
            {
                path: "errors",
                element: <LazyPage Page={ErrorsPage}/>,
            },
            {
                path: "notifications",
                element: <LazyPage Page={NotificationsPage}/>,
            },
            {
                path: "access-insights",
                element: <LazyPage Page={AccessInsightsPage}/>,
            },
            {
                path: "recent-actions",
                element: <LazyPage Page={RecentActionsPage}/>,
            },
            {
                path: "api-docs",
                element: <Navigate to="/settings" replace/>,
            },
            {
                path: "phpmyadmin",
                element: <LazyPage Page={PhpMyAdminPage}/>,
            },
            {
                path: "external-apps",
                element: <Navigate to="/settings" replace/>,
            },
            {
                path: "sales-bot",
                element: <LazyPage Page={SalesBotPage}/>,
            },
        ],
    },
    {
        path: "/login",
        element: <Login />,
    },
], { basename: dashboardBasename });
