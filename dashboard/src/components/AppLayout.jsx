import {
	ArrowRightOnRectangleIcon,
	Bars3Icon,
	BellIcon,
	ChartBarIcon,
	Cog6ToothIcon,
	CpuChipIcon,
	GlobeAltIcon,
	HomeIcon,
	LanguageIcon,
	MoonIcon,
	RectangleStackIcon,
	ServerStackIcon,
	ShieldCheckIcon,
	SunIcon,
	UserCircleIcon,
	UsersIcon,
	XMarkIcon,
} from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, Outlet, useLoaderData, useLocation, useNavigate } from "react-router-dom";
import { clearDashboardCache } from "../contexts/DashboardContext";
import { fetch } from "../service/http";
import { updateThemeColor } from "../utils/themeColor";

const getThemeMode = () => {
	if (typeof document === "undefined") return "dark";
	return document.documentElement.classList.contains("rb-theme-light") ? "light" : "dark";
};

const setThemeMode = (mode) => {
	try {
		localStorage.setItem("rb-theme", mode);
		localStorage.setItem("chakra-ui-color-mode", mode);
	} catch {}
	const targets = [document.documentElement, document.body].filter(Boolean);
	targets.forEach((target) => {
		target.classList.remove("rb-theme-light", "rb-theme-dark", "chakra-ui-light", "chakra-ui-dark");
		target.classList.add(`rb-theme-${mode}`, `chakra-ui-${mode}`);
		target.dataset.theme = mode;
		target.style.colorScheme = mode;
	});
	updateThemeColor(mode);
};

export const AppLayout = () => {
	const session = useLoaderData();
	const { t, i18n } = useTranslation();
	const navigate = useNavigate();
	const location = useLocation();
	const [mobileOpen, setMobileOpen] = useState(false);
	const [theme, setTheme] = useState(getThemeMode);
	const [unreadCount, setUnreadCount] = useState(0);
	const [langMenuOpen, setLangMenuOpen] = useState(false);

	const isDisabled = session?.state === "disabled";
	const role = session?.admin?.role || (session?.is_sudo ? "full_access" : "reseller");
	const username = session?.admin?.username || session?.username || "admin";
	const isFullAccess = role === "full_access" || Boolean(session?.is_sudo);

	useEffect(() => {
		setMobileOpen(false);
	}, [location.pathname]);

	useEffect(() => {
		let cancelled = false;
		fetch("/notifications?limit=6")
			.then((res) => {
				if (cancelled) return;
				const items = Array.isArray(res?.notifications) ? res.notifications : Array.isArray(res) ? res : [];
				const unread = typeof res?.unread_count === "number"
					? res.unread_count
					: items.filter((n) => !n.is_read && !n.read).length;
				setUnreadCount(unread);
			})
			.catch(() => {});
		return () => {
			cancelled = true;
		};
	}, [location.pathname]);

	const toggleTheme = () => {
		const next = theme === "dark" ? "light" : "dark";
		setThemeMode(next);
		setTheme(next);
	};

	const handleLogout = async () => {
		try {
			await fetch("/auth/logout", { method: "POST" });
		} catch {}
		clearDashboardCache();
		navigate("/login", { replace: true });
	};

	const navGroups = [
		{
			items: [
				{ to: "/", label: t("dashboard") || "Dashboard", icon: HomeIcon, end: true, show: !isDisabled },
				{ to: "/users", label: t("users") || "Users", icon: UsersIcon, show: true },
				{ to: "/services", label: t("services.title") || "Services", icon: RectangleStackIcon, show: !isDisabled && isFullAccess },
				{ to: "/hosts", label: t("hosts") || "Hosts", icon: GlobeAltIcon, show: !isDisabled && isFullAccess },
				{ to: "/node-settings", label: t("nodes.title") || "Nodes", icon: ServerStackIcon, show: !isDisabled && isFullAccess },
				{ to: "/xray-settings", label: t("xraySettings.title") || "Core Settings", icon: CpuChipIcon, show: !isDisabled && isFullAccess },
			],
		},
		{
			label: t("management") || "System",
			items: [
				{ to: "/admins", label: t("admins.title") || "Admins", icon: ShieldCheckIcon, show: !isDisabled && isFullAccess },
				{ to: "/usage", label: t("usage.title") || "Usage", icon: ChartBarIcon, show: !isDisabled },
				{ to: "/notifications", label: t("notifications.title") || "Notifications", icon: BellIcon, badge: unreadCount, show: !isDisabled },
				{ to: "/settings", label: t("settings.title") || "Settings", icon: Cog6ToothIcon, show: !isDisabled && isFullAccess },
				{ to: "/myaccount", label: t("myAccount.title") || "My Account", icon: UserCircleIcon, show: !isDisabled },
			],
		},
	];

	const renderNav = () => (
		<nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-2.5 py-3">
			{navGroups.map((group, gi) => {
				const visible = group.items.filter((i) => i.show);
				if (!visible.length) return null;
				return (
					<div key={gi} className="flex flex-col gap-0.5">
						{group.label && (
							<div className="mb-1 px-2.5 text-[11px] font-medium uppercase tracking-wider text-ink-tertiary">
								{group.label}
							</div>
						)}
						{visible.map((item) => {
							const IconComp = item.icon;
							return (
								<NavLink
									key={item.to}
									to={item.to}
									end={item.end}
									className={({ isActive }) =>
										`group flex items-center justify-between rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors ${
											isActive
												? "bg-surface-3 text-ink"
												: "text-ink-subtle hover:bg-surface-2 hover:text-ink-muted"
										}`
									}
								>
									<span className="flex items-center gap-2.5 truncate">
										<IconComp className="h-4 w-4 shrink-0" />
										<span className="truncate">{item.label}</span>
									</span>
									{item.badge > 0 && (
										<span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-white tabular-nums">
											{item.badge}
										</span>
									)}
								</NavLink>
							);
						})}
					</div>
				);
			})}
		</nav>
	);

	return (
		<div className="flex min-h-screen bg-canvas text-ink">
			{/* Desktop Sidebar */}
			<aside className="hidden w-56 shrink-0 flex-col border-e border-hairline bg-surface-1 md:flex">
				<div className="flex h-12 items-center justify-between border-b border-hairline px-4">
					<NavLink to="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight text-ink">
						<span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent text-xs font-bold text-white">
							R
						</span>
						<span>Rebecca</span>
					</NavLink>
				</div>
				{renderNav()}
				<div className="border-t border-hairline p-2.5">
					<div className="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs">
						<div className="min-w-0">
							<div className="truncate font-medium text-ink">{username}</div>
							<div className="truncate text-[11px] text-ink-tertiary">{role}</div>
						</div>
						<button
							type="button"
							onClick={handleLogout}
							title={t("logout") || "Logout"}
							className="rounded-md p-1.5 text-ink-subtle hover:bg-surface-3 hover:text-red-400"
						>
							<ArrowRightOnRectangleIcon className="h-4 w-4" />
						</button>
					</div>
				</div>
			</aside>

			{/* Mobile Sidebar Drawer */}
			{mobileOpen && (
				<div className="fixed inset-0 z-50 flex md:hidden">
					<div className="fixed inset-0 bg-black/70" onClick={() => setMobileOpen(false)} />
					<aside className="relative z-10 flex w-64 max-w-[80vw] flex-col border-e border-hairline bg-surface-1">
						<div className="flex h-12 items-center justify-between border-b border-hairline px-4">
							<span className="text-sm font-semibold text-ink">Rebecca</span>
							<button
								type="button"
								onClick={() => setMobileOpen(false)}
								className="rounded-md p-1 text-ink-subtle hover:bg-surface-2 hover:text-ink"
							>
								<XMarkIcon className="h-5 w-5" />
							</button>
						</div>
						{renderNav()}
						<div className="border-t border-hairline p-2.5">
							<button
								type="button"
								onClick={handleLogout}
								className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-red-400 hover:bg-surface-2"
							>
								<ArrowRightOnRectangleIcon className="h-4 w-4" />
								<span>{t("logout") || "Logout"}</span>
							</button>
						</div>
					</aside>
				</div>
			)}

			{/* Main Content */}
			<div className="flex min-w-0 flex-1 flex-col">
				<header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b border-hairline bg-canvas/95 px-4 sm:px-6">
					<div className="flex items-center gap-2.5">
						<button
							type="button"
							onClick={() => setMobileOpen(true)}
							className="rounded-lg p-1.5 text-ink-subtle hover:bg-surface-2 hover:text-ink md:hidden"
							aria-label="Menu"
						>
							<Bars3Icon className="h-5 w-5" />
						</button>
						<span className="text-xs font-medium text-ink-subtle md:hidden">Rebecca</span>
					</div>

					<div className="flex items-center gap-1.5">
						<div className="relative">
							<button
								type="button"
								onClick={() => setLangMenuOpen((v) => !v)}
								className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-hairline bg-surface-1 px-2.5 text-xs font-medium text-ink-muted hover:border-hairline-strong hover:text-ink"
								title="Language"
							>
								<LanguageIcon className="h-3.5 w-3.5" />
								<span className="uppercase">{(i18n.language || "en").slice(0, 2)}</span>
							</button>
							{langMenuOpen && (
								<>
									<div className="fixed inset-0 z-40" onClick={() => setLangMenuOpen(false)} />
									<div className="absolute end-0 z-50 mt-1.5 w-28 rounded-lg border border-hairline-strong bg-surface-1 p-1 shadow-xl">
										{[
											{ code: "en", label: "English" },
											{ code: "fa", label: "فارسی" },
											{ code: "ru", label: "Русский" },
											{ code: "zh", label: "中文" },
										].map((lang) => (
											<button
												key={lang.code}
												type="button"
												onClick={() => {
													void i18n.changeLanguage(lang.code);
													setLangMenuOpen(false);
												}}
												className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-xs ${
													i18n.language?.startsWith(lang.code)
														? "bg-accent-soft text-accent font-medium"
														: "text-ink-muted hover:bg-surface-2 hover:text-ink"
												}`}
											>
												<span>{lang.label}</span>
											</button>
										))}
									</div>
								</>
							)}
						</div>

						<button
							type="button"
							onClick={toggleTheme}
							className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-hairline bg-surface-1 text-ink-subtle hover:border-hairline-strong hover:text-ink"
							title="Toggle theme"
							aria-label="Toggle theme"
						>
							{theme === "dark" ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
						</button>
					</div>
				</header>

				<main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:px-6">
					<Outlet />
				</main>
			</div>
		</div>
	);
};

export default AppLayout;
