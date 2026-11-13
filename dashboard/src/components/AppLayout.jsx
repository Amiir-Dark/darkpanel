import {
	ArrowRightOnRectangleIcon,
	Bars3Icon,
	BellIcon,
	CalendarDaysIcon,
	ChartBarIcon,
	ChevronUpDownIcon,
	CircleStackIcon,
	ClockIcon,
	Cog6ToothIcon,
	ComputerDesktopIcon,
	DocumentTextIcon,
	ExclamationTriangleIcon,
	EyeIcon,
	HomeIcon,
	LanguageIcon,
	LinkIcon,
	MoonIcon,
	RectangleStackIcon,
	ServerStackIcon,
	ShieldCheckIcon,
	ShoppingBagIcon,
	SunIcon,
	UserCircleIcon,
	UsersIcon,
	WrenchScrewdriverIcon,
	XMarkIcon,
} from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, Outlet, useLoaderData, useLocation, useNavigate } from "react-router-dom";
import { clearDashboardCache } from "../contexts/DashboardContext";
import { fetch } from "../service/http";
import { updateThemeColor } from "../utils/themeColor";

const getThemePreference = () => {
	if (typeof window === "undefined") return "dark";
	try {
		const stored = localStorage.getItem("rb-theme") || localStorage.getItem("chakra-ui-color-mode") || "dark";
		if (stored === "system" || stored === "light" || stored === "dark") return stored;
	} catch {}
	return "dark";
};

const resolveThemeMode = (pref) => {
	if (pref === "system") {
		if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: light)").matches) {
			return "light";
		}
		return "dark";
	}
	return pref === "light" ? "light" : "dark";
};

const setThemeMode = (pref) => {
	const resolved = resolveThemeMode(pref);
	try {
		localStorage.setItem("rb-theme", pref);
		localStorage.setItem("chakra-ui-color-mode", resolved);
	} catch {}
	const targets = [document.documentElement, document.body].filter(Boolean);
	targets.forEach((target) => {
		target.classList.remove("rb-theme-light", "rb-theme-dark", "chakra-ui-light", "chakra-ui-dark");
		target.classList.add(`rb-theme-${resolved}`, `chakra-ui-${resolved}`);
		target.dataset.theme = resolved;
		target.style.colorScheme = resolved;
	});
	updateThemeColor(resolved);
};

export const AppLayout = () => {
	const session = useLoaderData();
	const { t, i18n } = useTranslation();
	const navigate = useNavigate();
	const location = useLocation();
	const [mobileOpen, setMobileOpen] = useState(false);
	const [theme, setTheme] = useState(getThemePreference);
	const [unreadCount, setUnreadCount] = useState(0);
	const [accountMenuOpen, setAccountMenuOpen] = useState(false);
	const [settingsDockOpen, setSettingsDockOpen] = useState(false);

	const isDisabled = session?.state === "disabled";
	const role = session?.admin?.role || (session?.is_sudo ? "full_access" : "reseller");
	const username = session?.admin?.username || session?.username || "admin";
	const isFullAccess = role === "full_access";
	const selfPerms = session?.admin?.permissions?.self_permissions || {};
	const canAccessSettings =
		isFullAccess ||
		Boolean(session?.admin?.permissions?.sections?.integrations) ||
		Boolean(selfPerms.self_subscription) ||
		Boolean(selfPerms.self_client_apps) ||
		Boolean(selfPerms.self_config_remarks) ||
		Boolean(selfPerms.self_placeholders);

	useEffect(() => {
		setMobileOpen(false);
		setAccountMenuOpen(false);
		setSettingsDockOpen(false);
	}, [location.pathname]);

	useEffect(() => {
		setThemeMode(theme);
		if (theme !== "system" || typeof window === "undefined" || !window.matchMedia) {
			return undefined;
		}
		const media = window.matchMedia("(prefers-color-scheme: light)");
		const handleChange = () => setThemeMode("system");
		media.addEventListener?.("change", handleChange);
		return () => media.removeEventListener?.("change", handleChange);
	}, [theme]);

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

	const selectTheme = (next) => {
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
				{ to: "/", label: t("dashboard", "Dashboard"), icon: HomeIcon, end: true, show: !isDisabled },
				{ to: "/users", label: t("users", "Users"), icon: UsersIcon, show: true },
				{ to: "/sales-bot", label: t("salesBot.menu", "Sales Bot"), icon: ShoppingBagIcon, show: !isDisabled && isFullAccess },
				{ to: "/usage", label: t("usage.menu", "Usage"), icon: ChartBarIcon, show: !isDisabled && isFullAccess },
			],
		},
		{
			items: [
				{ to: "/node-settings", label: t("header.nodeSettings", "Node"), icon: ServerStackIcon, show: !isDisabled && isFullAccess },
				{ to: "/services", label: t("services.title", "Services"), icon: RectangleStackIcon, show: !isDisabled && isFullAccess },
				{ to: "/hosts", label: t("header.hostSettings", "Inbounds & Hosts"), icon: LinkIcon, show: !isDisabled && isFullAccess },
			],
		},
		{
			items: [
				{ to: "/settings", label: t("header.settings", "Settings"), icon: Cog6ToothIcon, show: !isDisabled && canAccessSettings },
				{ to: "/xray-settings", label: t("header.xraySettings", "Xray Settings"), icon: WrenchScrewdriverIcon, show: !isDisabled && isFullAccess },
				{ to: "/xray-logs", label: t("header.xrayLogs", "Logs"), icon: DocumentTextIcon, show: !isDisabled && isFullAccess },
				{ to: "/access-insights", label: t("header.accessInsights", "Live connections"), icon: EyeIcon, show: !isDisabled && isFullAccess },
				{ to: "/recent-actions", label: t("recentActions.title", "Recent Actions"), icon: ClockIcon, show: !isDisabled && isFullAccess },
				{ to: "/errors", label: t("header.errors", "Errors"), icon: ExclamationTriangleIcon, show: !isDisabled && isFullAccess },
				{ to: "/phpmyadmin", label: t("phpmyadmin.menu", "phpMyAdmin"), icon: CircleStackIcon, show: !isDisabled && isFullAccess },
			],
		},
		{
			items: [
				{ to: "/admins", label: t("admins", "Admins"), icon: ShieldCheckIcon, show: !isDisabled && isFullAccess },
				{ to: "/myaccount", label: t("myaccount.menu", "My Account"), icon: UserCircleIcon, show: !isDisabled },
				{ to: "/notifications", label: t("notifications.menu", "Notifications"), icon: BellIcon, badge: unreadCount, show: !isDisabled && isFullAccess },
			],
		},
	];

	const currentNavItem = navGroups
		.flatMap((g) => g.items)
		.find((item) => (item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)));
	const mobileSettingsMenuItems = [
		{ to: "/errors", label: t("header.errors", "Errors"), icon: ExclamationTriangleIcon, show: !isDisabled && isFullAccess },
		{ to: "/services", label: t("services.title", "Services"), icon: RectangleStackIcon, show: !isDisabled && isFullAccess },
		{ to: "/hosts", label: t("header.hostSettings", "Inbounds & Hosts"), icon: LinkIcon, show: !isDisabled && isFullAccess },
		{ to: "/node-settings", label: t("header.nodeSettings", "Node"), icon: ServerStackIcon, show: !isDisabled && isFullAccess },
		{ to: "/settings", label: t("header.settings", "Settings"), icon: Cog6ToothIcon, show: !isDisabled && canAccessSettings },
		{ to: "/xray-settings", label: t("header.xraySettings", "Xray Settings"), icon: WrenchScrewdriverIcon, show: !isDisabled && isFullAccess },
		{ to: "/xray-logs", label: t("header.xrayLogs", "Logs"), icon: DocumentTextIcon, show: !isDisabled && isFullAccess },
		{ to: "/access-insights", label: t("header.accessInsights", "Live connections"), icon: EyeIcon, show: !isDisabled && isFullAccess },
		{ to: "/recent-actions", label: t("recentActions.title", "Recent Actions"), icon: ClockIcon, show: !isDisabled && isFullAccess },
		{ to: "/phpmyadmin", label: t("phpmyadmin.menu", "phpMyAdmin"), icon: CircleStackIcon, show: !isDisabled && isFullAccess },
	].filter((item) => item.show);

	const isSettingsMenuActive = mobileSettingsMenuItems.some((item) =>
		location.pathname.startsWith(item.to)
	);

	const mobileDockItems = [
		{ to: "/users", label: t("users", "Users"), icon: UsersIcon, show: true },
		{ to: "/admins", label: t("admins", "Admins"), icon: ShieldCheckIcon, show: !isDisabled && isFullAccess },
		{ to: "/", label: t("dashboard", "Dashboard"), icon: HomeIcon, end: true, show: !isDisabled },
		{ to: "/myaccount", label: t("myaccount.menu", "My Account"), icon: UserCircleIcon, show: !isDisabled },
		{
			to: "/settings",
			label: t("header.settings", "Settings"),
			icon: Cog6ToothIcon,
			isSettingsTrigger: true,
			show: !isDisabled && mobileSettingsMenuItems.length > 0,
		},
	].filter((item) => item.show);
	const currentPageTitle = currentNavItem?.label || t("dashboard", "Dashboard");
	const formattedDate = new Intl.DateTimeFormat(i18n.language || "en", {
		weekday: "long",
		month: "long",
		day: "numeric",
		year: "numeric",
	}).format(new Date());

	const renderNav = () => (
		<nav className="rb-no-scrollbar flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-2.5">
			{navGroups.map((group, gi) => {
				const visible = group.items.filter((i) => i.show);
				if (!visible.length) return null;
				return (
					<div key={gi} className="flex flex-col gap-0.5">
						{gi > 0 && <div className="mx-1.5 my-2 h-px bg-hairline" />}
						{visible.map((item) => {
							const IconComp = item.icon;
							return (
								<NavLink
									key={item.to}
									to={item.to}
									end={item.end}
									className={({ isActive }) =>
										`group relative flex items-center justify-between rounded-lg px-3 py-1.5 text-[13.5px] font-medium transition-colors duration-150 ${
											isActive
												? "bg-accent-soft text-accent shadow-[inset_0_0_0_1px_rgba(94,106,210,0.28)]"
												: "text-ink-subtle hover:bg-surface-2 hover:text-ink"
										}`
									}
								>
									{({ isActive }) => (
										<>
											{isActive && (
												<span className="absolute start-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-e-full bg-accent" />
											)}
											<span className="flex items-center gap-3 truncate">
												<IconComp
													className={`h-[18px] w-[18px] shrink-0 transition-colors ${
														isActive ? "text-accent" : "text-ink-tertiary group-hover:text-ink-muted"
													}`}
												/>
												<span className="truncate">{item.label}</span>
											</span>
											{item.badge > 0 && (
												<span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-white tabular-nums">
													{item.badge}
												</span>
											)}
										</>
									)}
								</NavLink>
							);
						})}
					</div>
				);
			})}
		</nav>
	);

	const renderSidebarFooter = (isMobile = false) => (
		<div className="relative border-t border-hairline p-2">
			<button
				type="button"
				onClick={() => setAccountMenuOpen((v) => !v)}
				className={`flex w-full items-center justify-between gap-2.5 rounded-xl px-2 py-1.5 text-start transition-colors ${
					accountMenuOpen ? "bg-surface-2" : "hover:bg-surface-2"
				}`}
				aria-expanded={accountMenuOpen}
			>
				<div className="flex min-w-0 items-center gap-2.5">
					<span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-bold uppercase text-white">
						{username.slice(0, 1)}
					</span>
					<div className="min-w-0">
						<div className="truncate text-xs font-medium text-ink">{username}</div>
						<div className="truncate text-[10px] text-ink-tertiary">{role}</div>
					</div>
				</div>
				<ChevronUpDownIcon className="h-4 w-4 shrink-0 text-ink-tertiary" />
			</button>

			{accountMenuOpen && (
				<>
					<div className="fixed inset-0 z-40" onClick={() => setAccountMenuOpen(false)} />
					<div
						className={`rb-anim-menu absolute z-50 w-64 rounded-xl border border-hairline-strong bg-surface-1 p-2 shadow-2xl ${
							isMobile
								? "bottom-full start-2 mb-2 origin-bottom"
								: "bottom-2 start-full ms-2 origin-bottom-left"
						}`}
					>
						<div className="flex items-center gap-2.5 px-2 py-1.5">
							<span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-bold uppercase text-white">
								{username.slice(0, 1)}
							</span>
							<div className="min-w-0 flex-1">
								<div className="truncate text-xs font-semibold text-ink">{username}</div>
								<div className="truncate text-[10px] text-ink-tertiary">{role}</div>
							</div>
						</div>

						<div className="my-1.5 border-t border-hairline" />

						<div className="px-2 py-1">
							<div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-ink-tertiary">
								{t("theme", "Theme")}
							</div>
							<div className="grid grid-cols-3 gap-1 rounded-lg border border-hairline bg-surface-2 p-0.5">
								{[
									{ id: "light", label: t("themeLight", "Light"), Icon: SunIcon },
									{ id: "dark", label: t("themeDark", "Dark"), Icon: MoonIcon },
									{ id: "system", label: t("themeSystem", "System"), Icon: ComputerDesktopIcon },
								].map(({ id, label, Icon }) => {
									const active = theme === id;
									return (
										<button
											key={id}
											type="button"
											onClick={() => selectTheme(id)}
											className={`flex items-center justify-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium transition-colors ${
												active
													? "bg-accent text-white shadow-sm"
													: "text-ink-subtle hover:text-ink"
											}`}
										>
											<Icon className="h-3.5 w-3.5 shrink-0" />
											<span className="truncate">{label}</span>
										</button>
									);
								})}
							</div>
						</div>

						<div className="px-2 py-1">
							<div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-ink-tertiary">
								<LanguageIcon className="h-3 w-3" />
								<span>{t("language", "Language")}</span>
							</div>
							<div className="grid grid-cols-2 gap-1 rounded-lg border border-hairline bg-surface-2 p-0.5">
								{[
									{ code: "en", label: "English" },
									{ code: "fa", label: "فارسی" },
								].map((lang) => (
									<button
										key={lang.code}
										type="button"
										onClick={() => {
											void i18n.changeLanguage(lang.code);
											setAccountMenuOpen(false);
										}}
										className={`flex items-center justify-center rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
											i18n.language?.startsWith(lang.code)
												? "bg-accent text-white shadow-sm"
												: "text-ink-subtle hover:text-ink"
										}`}
									>
										<span>{lang.label}</span>
									</button>
								))}
							</div>
						</div>

						<div className="my-1.5 border-t border-hairline" />

						<button
							type="button"
							onClick={() => {
								setAccountMenuOpen(false);
								void handleLogout();
							}}
							className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10"
						>
							<ArrowRightOnRectangleIcon className="h-4 w-4 shrink-0" />
							<span>{t("logout", "Log out")}</span>
						</button>
					</div>
				</>
			)}
		</div>
	);

	return (
		<div className="flex h-screen overflow-hidden bg-canvas text-ink">
			{/* Desktop Floating Sidebar */}
			<aside className="my-3 ms-3 hidden h-[calc(100vh-1.5rem)] w-64 shrink-0 flex-col rounded-2xl border border-hairline bg-surface-1 md:flex">
				<div className="flex h-14 items-center justify-between border-b border-hairline px-4">
					<NavLink to="/" className="flex items-center gap-2.5 text-base font-semibold tracking-tight text-ink">
						<span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-xs font-bold text-white">
							D
						</span>
						<span>Dark Panel</span>
					</NavLink>
				</div>
				{renderNav()}
				{renderSidebarFooter(false)}
			</aside>

			{/* Mobile Sidebar Drawer */}
			{mobileOpen && (
				<div className="fixed inset-0 z-50 flex md:hidden">
					<div className="rb-anim-backdrop fixed inset-0 bg-black/70" onClick={() => setMobileOpen(false)} />
					<aside className="rb-anim-drawer relative z-10 flex w-64 max-w-[80vw] flex-col border-e border-hairline bg-surface-1">
						<div className="flex h-12 items-center justify-between border-b border-hairline px-4">
							<span className="text-sm font-semibold text-ink">Dark Panel</span>
							<button
								type="button"
								onClick={() => setMobileOpen(false)}
								className="rounded-md p-1 text-ink-subtle hover:bg-surface-2 hover:text-ink"
							>
								<XMarkIcon className="h-5 w-5" />
							</button>
						</div>
						{renderNav()}
						{renderSidebarFooter(true)}
					</aside>
				</div>
			)}

			{/* Main Content */}
			<div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
				<header className="sticky top-3 z-30 mx-4 mt-3 flex h-12 items-center justify-between rounded-xl border border-hairline bg-surface-1 px-3.5 sm:mx-6">
					<div className="flex items-center gap-2.5">
						<button
							type="button"
							onClick={() => setMobileOpen(true)}
							className="rounded-lg p-1.5 text-ink-subtle hover:bg-surface-2 hover:text-ink md:hidden"
							aria-label="Menu"
						>
							<Bars3Icon className="h-5 w-5" />
						</button>
						<span className="text-xs font-medium text-ink-muted">{currentPageTitle}</span>
					</div>

					<div className="flex items-center gap-2">
						<div className="hidden items-center gap-1.5 rounded-lg border border-hairline bg-surface-2 px-2.5 py-1 text-[11px] text-ink-subtle lg:flex">
							<CalendarDaysIcon className="h-3.5 w-3.5 text-ink-tertiary" />
							<span>{formattedDate}</span>
						</div>

						<NavLink
							to="/notifications"
							className="relative inline-flex h-8 w-8 items-center justify-center rounded-lg border border-hairline bg-surface-2 text-ink-subtle transition-colors hover:border-hairline-strong hover:text-ink"
							title={t("notifications.menu", "Notifications")}
						>
							<BellIcon className="h-4 w-4" />
							{unreadCount > 0 && (
								<span className="absolute -end-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-white tabular-nums">
									{unreadCount > 9 ? "9+" : unreadCount}
								</span>
							)}
						</NavLink>
					</div>
				</header>

				<main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-24 pt-5 sm:px-6 md:pb-5">
					<Outlet />
				</main>

				{mobileDockItems.length > 0 && (
					<>
						{settingsDockOpen && (
							<div
								className="fixed inset-0 z-30 bg-black/40 backdrop-blur-[1px] md:hidden"
								onClick={() => setSettingsDockOpen(false)}
							/>
						)}
						<nav
							aria-label="Quick navigation"
							className="fixed inset-x-2.5 bottom-2.5 z-40 mx-auto max-w-md md:hidden"
						>
							{settingsDockOpen && mobileSettingsMenuItems.length > 0 && (
								<div className="rb-anim-menu absolute bottom-[calc(100%+8px)] end-0 max-h-[55vh] w-48 max-w-[calc(100vw-20px)] overflow-y-auto rounded-[20px] border border-hairline-strong bg-surface-1/95 p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.65)] backdrop-blur-xl">
									<div className="flex flex-col gap-0.5">
										{mobileSettingsMenuItems.map((subItem) => {
											const SubIcon = subItem.icon;
											return (
												<NavLink
													key={subItem.to}
													to={subItem.to}
													onClick={() => setSettingsDockOpen(false)}
													className={({ isActive }) =>
														`flex items-center gap-2.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${
															isActive
																? "bg-accent-soft text-accent shadow-[inset_0_0_0_1px_rgba(94,106,210,0.28)]"
																: "text-ink-muted hover:bg-surface-2 hover:text-ink"
														}`
													}
												>
													{({ isActive }) => (
														<>
															<SubIcon
																className={`h-4 w-4 shrink-0 ${
																	isActive ? "text-accent" : "text-ink-subtle"
																}`}
															/>
															<span className="truncate">{subItem.label}</span>
														</>
													)}
												</NavLink>
											);
										})}
									</div>
								</div>
							)}

							<div className="flex items-center justify-around rounded-[24px] border border-hairline-strong bg-surface-1/90 px-1.5 py-1.5 shadow-[0_14px_38px_rgba(0,0,0,0.55)] backdrop-blur-xl">
								{mobileDockItems.map((item) => {
									const IconComp = item.icon;
									if (item.isSettingsTrigger && mobileSettingsMenuItems.length > 1) {
										const isActive = settingsDockOpen || isSettingsMenuActive;
										return (
											<button
												key="dock-settings"
												type="button"
												onClick={() => setSettingsDockOpen((prev) => !prev)}
												aria-expanded={settingsDockOpen}
												className="group flex min-w-0 flex-1 flex-col items-center gap-0.5 px-0.5"
											>
												<span
													className={`flex h-7 w-10 items-center justify-center rounded-full transition-all duration-150 ${
														isActive
															? "bg-accent-soft text-accent shadow-[inset_0_0_0_1px_rgba(94,106,210,0.35)]"
															: "text-ink-muted group-hover:bg-surface-2 group-hover:text-ink"
													}`}
												>
													<IconComp className="h-[18px] w-[18px]" />
												</span>
												<span
													className={`max-w-full truncate text-[10px] leading-tight transition-colors ${
														isActive
															? "font-semibold text-accent"
															: "font-medium text-ink-subtle group-hover:text-ink"
													}`}
												>
													{item.label}
												</span>
											</button>
										);
									}

									return (
										<NavLink
											key={item.to}
											to={item.to}
											end={item.end}
											onClick={() => setSettingsDockOpen(false)}
											className="group flex min-w-0 flex-1 flex-col items-center gap-0.5 px-0.5"
										>
											{({ isActive }) => (
												<>
													<span
														className={`flex h-7 w-10 items-center justify-center rounded-full transition-all duration-150 ${
															isActive
																? "bg-accent-soft text-accent shadow-[inset_0_0_0_1px_rgba(94,106,210,0.35)]"
																: "text-ink-muted group-hover:bg-surface-2 group-hover:text-ink"
														}`}
													>
														<IconComp className="h-[18px] w-[18px]" />
													</span>
													<span
														className={`max-w-full truncate text-[10px] leading-tight transition-colors ${
															isActive
																? "font-semibold text-accent"
																: "font-medium text-ink-subtle group-hover:text-ink"
														}`}
													>
														{item.label}
													</span>
												</>
											)}
										</NavLink>
									);
								})}
							</div>
						</nav>
					</>
				)}
			</div>
		</div>
	);
};

export default AppLayout;
