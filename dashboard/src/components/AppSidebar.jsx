import { Box, chakra, Flex, HStack, Image, Text, Tooltip, useColorModeValue, VStack, } from "@chakra-ui/react";
import { ArrowsRightLeftIcon, BellAlertIcon, BoltIcon, BookOpenIcon, BriefcaseIcon, ChartBarIcon, CircleStackIcon, ClockIcon, CodeBracketSquareIcon, Cog6ToothIcon, Cog8ToothIcon, CommandLineIcon, DocumentDuplicateIcon, BellIcon, DocumentTextIcon, EyeIcon, HomeIcon, LinkIcon, ServerStackIcon, ShoppingBagIcon, Squares2X2Icon, UserCircleIcon, UserGroupIcon, WrenchScrewdriverIcon, } from "@heroicons/react/24/outline";
import logoUrl from "assets/logo.svg";
import useGetUser from "hooks/useGetUser";
import { useCallback, useEffect, useState, } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, useHref, useLocation, useNavigate } from "react-router-dom";
import { AdminRole, AdminSection, AdminSudoScope } from "types/Admin";
import { getTutorialManifestUrl, getTutorialSeenKey, normalizeTutorialLang, } from "utils/tutorials";
const iconProps = {
    baseStyle: {
        w: 5,
        h: 5,
    },
};
const HomeIconStyled = chakra(HomeIcon, iconProps);
const UsersIconStyled = chakra(UserGroupIcon, iconProps);
const SalesBotIconStyled = chakra(ShoppingBagIcon, iconProps);
const BulkActionsIconStyled = chakra(BoltIcon, iconProps);
const RecentActionsIconStyled = chakra(ClockIcon, iconProps);
const SettingsIconStyled = chakra(Cog6ToothIcon, iconProps);
const MasterSettingsIconStyled = chakra(Cog8ToothIcon, iconProps);
const NodeIconStyled = chakra(ServerStackIcon, iconProps);
const AdminIconStyled = chakra(BriefcaseIcon, iconProps);
const ServicesIconStyled = chakra(Squares2X2Icon, iconProps);
const HostsIconStyled = chakra(LinkIcon, iconProps);
const HAProxyIconStyled = chakra(ArrowsRightLeftIcon, iconProps);
const UsageIconStyled = chakra(ChartBarIcon, iconProps);
const MyAccountIconStyled = chakra(UserCircleIcon, iconProps);
const NotificationIconStyled = chakra(BellIcon, iconProps);
const InsightsIconStyled = chakra(EyeIcon, iconProps);
const TutorialIconStyled = chakra(BookOpenIcon, iconProps);
const XraySettingsIconStyled = chakra(WrenchScrewdriverIcon, iconProps);
const XrayLogsIconStyled = chakra(DocumentTextIcon, iconProps);
const ApiDocsIconStyled = chakra(CodeBracketSquareIcon, iconProps);
const PHPMyAdminIconStyled = chakra(CircleStackIcon, iconProps);
const ExternalAppsIconStyled = chakra(CommandLineIcon, iconProps);
const PlaceholderIconStyled = chakra(DocumentDuplicateIcon, iconProps);
const SubscriptionIconStyled = chakra(LinkIcon, iconProps);
const TutorialUpdateIconStyled = chakra(BellAlertIcon, {
    baseStyle: {
        w: 3,
        h: 3,
    },
});
export const AppSidebar = ({ collapsed, inDrawer = false, onRequestExpand, }) => {
    const { t, i18n } = useTranslation();
    const location = useLocation();
    const navigate = useNavigate();
    const dashboardRoot = useHref("/");
    const { userData } = useGetUser();
    const currentLanguage = i18n.language || "en";
    const tutorialsUrl = "/tutorials";
    const sectionAccess = userData.permissions?.sections;
    const isFullAccess = userData.role === AdminRole.FullAccess;
    const isPrivilegedAdmin = isFullAccess || userData.role === AdminRole.Sudo;
    const sidebarBg = useColorModeValue("panel.sidebar", "panel.sidebar");
    const sidebarBorderColor = useColorModeValue("panel.border", "panel.border");
    const sidebarPanelBg = useColorModeValue("panel.elevated", "panel.elevated");
    const sidebarPanelBorder = useColorModeValue("panel.border", "panel.border");
    const sidebarShadow = useColorModeValue("0 18px 48px rgba(15, 23, 42, 0.10)", "0 18px 48px rgba(0, 0, 0, 0.32)");
    const itemColor = useColorModeValue("panel.textSecondary", "panel.textSecondary");
    const activeItemBg = useColorModeValue("panel.elevated", "panel.elevated");
    const activeItemColor = useColorModeValue("panel.text", "panel.text");
    const hoverItemBg = useColorModeValue("panel.elevated", "panel.elevated");
    const subNavBorder = useColorModeValue("panel.border", "panel.border");
    const defaultSelfPermissions = {
        self_myaccount: false,
        self_change_password: false,
        self_api_keys: false,
        self_placeholders: false,
        self_subscription: false,
    };
    const baseSelf = userData.permissions?.self_permissions ?? defaultSelfPermissions;
    const selfAccess = isFullAccess
        ? { self_myaccount: true, self_change_password: true, self_api_keys: true }
        : baseSelf;
    const canViewUsage = Boolean(sectionAccess?.[AdminSection.Usage]);
    const canViewAdmins = Boolean(sectionAccess?.[AdminSection.Admins]);
    const canViewServicesSection = Boolean(sectionAccess?.[AdminSection.Services]);
    const canViewRecentActions = isFullAccess ||
        (userData.role === AdminRole.Sudo &&
            Boolean(userData.permissions?.sudo?.[AdminSudoScope.Xray]));
    const canManagePlaceholders = isFullAccess ||
        (userData.role === AdminRole.Sudo &&
            Boolean(userData.permissions?.sudo?.[AdminSudoScope.Subscriptions])) ||
        Boolean(baseSelf.self_placeholders);
    const canManageSubscription = isFullAccess ||
        (userData.role === AdminRole.Sudo &&
            Boolean(userData.permissions?.sudo?.[AdminSudoScope.Subscriptions])) ||
        Boolean(baseSelf.self_subscription);
    const [hasNewTutorials, setHasNewTutorials] = useState(false);
    const checkTutorialUpdates = useCallback(async () => {
        const langKey = normalizeTutorialLang(i18n.language);
        try {
            const response = await fetch(getTutorialManifestUrl(dashboardRoot), {
                headers: { "Cache-Control": "no-cache" },
            });
            if (!response.ok) {
                throw new Error(`Failed to load tutorial meta: ${response.status}`);
            }
            const manifest = (await response.json());
            const version = manifest[langKey]?.toString().trim();
            if (!version) {
                setHasNewTutorials(false);
                return;
            }
            const seenKey = getTutorialSeenKey(langKey);
            const seenVersion = window.localStorage.getItem(seenKey);
            if (seenVersion === null) {
                window.localStorage.setItem(seenKey, version);
                setHasNewTutorials(false);
                return;
            }
            setHasNewTutorials(seenVersion !== version);
        }
        catch (err) {
            console.error("Failed to check tutorial updates", err);
            setHasNewTutorials(false);
        }
    }, [dashboardRoot, i18n.language]);
    useEffect(() => {
        void checkTutorialUpdates();
    }, [checkTutorialUpdates]);
    const baseSettingsSubItems = [
        isPrivilegedAdmin
            ? {
                title: "errors",
                url: "/errors",
                icon: InsightsIconStyled,
            }
            : null,
        sectionAccess?.[AdminSection.Hosts]
            ? {
                title: t("header.hostSettings"),
                url: "/hosts",
                icon: HostsIconStyled,
            }
            : null,
        sectionAccess?.[AdminSection.Nodes]
            ? {
                title: t("header.nodeSettings"),
                url: "/node-settings",
                icon: NodeIconStyled,
            }
            : null,
        sectionAccess?.[AdminSection.Integrations] || canManageSubscription
            ? {
                title: t("header.integrationSettings"),
                url: sectionAccess?.[AdminSection.Integrations]
                    ? "/settings"
                    : "/settings#subscriptions",
                icon: MasterSettingsIconStyled,
            }
            : null,
        sectionAccess?.[AdminSection.Xray]
            ? {
                title: t("header.xraySettings"),
                url: "/xray-settings",
                icon: XraySettingsIconStyled,
            }
            : null,
        sectionAccess?.[AdminSection.Xray]
            ? {
                title: t("pages.xray.logs"),
                url: "/xray-logs",
                icon: XrayLogsIconStyled,
            }
            : null,
        sectionAccess?.[AdminSection.Xray]
            ? {
                title: t("header.accessInsights"),
                url: "/access-insights",
                icon: InsightsIconStyled,
            }
            : null,
        canViewRecentActions
            ? {
                title: t("recentActions.title"),
                url: "/recent-actions",
                icon: RecentActionsIconStyled,
            }
            : null,
        isPrivilegedAdmin
            ? {
                title: t("phpmyadmin.menu"),
                url: "/phpmyadmin",
                icon: PHPMyAdminIconStyled,
            }
            : null,
        canManagePlaceholders
            ? {
                title: isPrivilegedAdmin
                    ? t("placeholders.menu")
                    : t("placeholders.settingsMenu"),
                url: "/placeholders",
                icon: PlaceholderIconStyled,
            }
            : null,
    ].filter(Boolean);
    const settingsSubItems = [...baseSettingsSubItems];
    if (canViewServicesSection) {
        settingsSubItems.unshift({
            title: t("services.title"),
            url: "/services",
            icon: ServicesIconStyled,
        });
    }
    const defaultTabByPath = {
        "/settings": !sectionAccess?.[AdminSection.Integrations]
            ? (canManageSubscription ? "subscriptions" : "placeholders")
            : "panel",
        "/hosts": "inbounds",
        "/usage": "services",
        "/xray-settings": "basic",
    };
    const handleNavClick = (event, targetUrl) => {
        if (inDrawer && onRequestExpand) {
            onRequestExpand();
        }
        if (!targetUrl)
            return;
        if (targetUrl.includes("#")) {
            event?.preventDefault();
            navigate(targetUrl);
            return;
        }
        const defaultTab = defaultTabByPath[targetUrl];
        if (defaultTab) {
            event?.preventDefault();
            const normalized = targetUrl.startsWith("/")
                ? targetUrl
                : `/${targetUrl}`;
            navigate(`${normalized}#${defaultTab}`);
        }
    };
    // 1. Main Navigation: Dashboard, Users, Usage
    const mainItems = [
        { title: t("dashboard"), url: "/", icon: HomeIconStyled },
        { title: t("users"), url: "/users", icon: UsersIconStyled },
    ];
    if (userData?.role !== AdminRole.Reseller) {
        mainItems.push({
            title: t("salesBot.menu", "ربات فروش"),
            url: "/sales-bot",
            icon: SalesBotIconStyled,
        });
    }
    if (canViewUsage) {
        mainItems.push({
            title: t("usage.menu"),
            url: "/usage",
            icon: UsageIconStyled,
        });
    }
    // 2. Infrastructure: Nodes, Services, Hosts
    const infraItems = [];
    if (sectionAccess?.[AdminSection.Nodes]) {
        infraItems.push({
            title: t("header.nodeSettings"),
            url: "/node-settings",
            icon: NodeIconStyled,
        });
    }
    if (canViewServicesSection) {
        infraItems.push({
            title: t("services.title"),
            url: "/services",
            icon: ServicesIconStyled,
        });
    }
    if (sectionAccess?.[AdminSection.Hosts]) {
        infraItems.push({
            title: t("header.hostSettings"),
            url: "/hosts",
            icon: HostsIconStyled,
        });
    }
    // 3. System & Settings
    const systemItems = [];
    if (sectionAccess?.[AdminSection.Integrations] ||
        canManageSubscription ||
        canManagePlaceholders) {
        systemItems.push({
            title: t("header.integrationSettings"),
            url: "/settings",
            icon: MasterSettingsIconStyled,
        });
    }
    if (sectionAccess?.[AdminSection.Xray]) {
        systemItems.push({
            title: t("header.xraySettings"),
            url: "/xray-settings",
            icon: XraySettingsIconStyled,
        }, {
            title: t("pages.xray.logs"),
            url: "/xray-logs",
            icon: XrayLogsIconStyled,
        }, {
            title: t("header.accessInsights"),
            url: "/access-insights",
            icon: InsightsIconStyled,
        });
    }
    if (canViewRecentActions) {
        systemItems.push({
            title: t("recentActions.title"),
            url: "/recent-actions",
            icon: RecentActionsIconStyled,
        });
    }
    if (isPrivilegedAdmin) {
        systemItems.push({
            title: "errors",
            url: "/errors",
            icon: InsightsIconStyled,
        }, {
            title: t("phpmyadmin.menu"),
            url: "/phpmyadmin",
            icon: PHPMyAdminIconStyled,
        });
    }
    // 4. Admin & Account
    const adminAccountItems = [];
    if (canViewAdmins) {
        adminAccountItems.push({
            title: t("admins"),
            url: "/admins",
            icon: AdminIconStyled,
        });
    }
    if (selfAccess.self_myaccount) {
        adminAccountItems.push({
            title: t("myaccount.menu"),
            url: "/myaccount",
            icon: MyAccountIconStyled,
        });
    }
    adminAccountItems.push({
        title: t("notifications.menu"),
        url: "/notifications",
        icon: NotificationIconStyled,
    });
    const sidebarGroups = [
        { id: "main", items: mainItems },
        { id: "infrastructure", items: infraItems },
        { id: "system", items: systemItems },
        { id: "account", items: adminAccountItems },
    ];
    const visibleGroups = sidebarGroups.filter((group) => group.items.length > 0);
    const isItemActive = (itemUrl) => {
        if (itemUrl.includes("#")) {
            const [itemPath, itemHash] = itemUrl.split("#");
            return (location.pathname === itemPath &&
                location.hash === `#${itemHash}`);
        }
        if (itemUrl === "/") {
            return location.pathname === "/";
        }
        if (itemUrl === "/settings") {
            return (location.pathname === "/settings" &&
                location.hash !== "#subscriptions");
        }
        return (location.pathname === itemUrl ||
            location.pathname.startsWith(`${itemUrl}/`));
    };
    const isRTL = i18n.dir(currentLanguage) === "rtl";
    return (<Box w={inDrawer ? "full" : collapsed ? "16" : "56"} h={inDrawer ? "100%" : "calc(100vh - 24px)"} maxH={inDrawer ? "100%" : "calc(100vh - 24px)"} bg={sidebarBg} borderWidth={inDrawer ? undefined : "1px"} borderColor={inDrawer ? undefined : sidebarBorderColor} borderRadius={inDrawer ? undefined : "2xl"} boxShadow={inDrawer ? undefined : sidebarShadow} transition="width 0.3s ease" position={inDrawer ? "relative" : "fixed"} top={inDrawer ? undefined : "12px"} left={inDrawer || isRTL ? undefined : "12px"} right={inDrawer || !isRTL ? undefined : "12px"} overflow="hidden" flexShrink={0} userSelect="none">
			<VStack spacing={2} p={collapsed ? 2 : 4} align="stretch" h="100%" minH={0} justify="space-between">
				<Box flex="1" minH={0} overflowY="auto" overflowX="hidden" className="rb-sidebar-scroll" data-dir={isRTL ? "rtl" : "ltr"} data-collapsed={collapsed ? "true" : "false"} dir={isRTL ? "rtl" : "ltr"}>
					<Box borderWidth="1px" borderColor="panel.border" borderRadius="14px" bg="panel.surface" position="relative" overflow="hidden" mb={4} px={collapsed ? 2 : 3} py={collapsed ? 2 : 3} boxShadow="inset 0 1px 1px 0 rgba(255, 255, 255, 0.05), 0 4px 14px -3px rgba(0, 0, 0, 0.2)" _before={{
            content: '""',
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "1.5px",
            bg: "linear-gradient(90deg, transparent, var(--rb-panel-accent), transparent)",
            opacity: 0.75,
        }}>
						<Flex align="center" gap={3} justify={collapsed ? "center" : "flex-start"}>
							<Image src={logoUrl} alt="Rebecca" w={8} h={8} objectFit="contain" borderRadius="md"/>
							{!collapsed && (<Text fontSize={{ base: "lg", md: "xl" }} fontWeight="bold" fontFamily="'Inter', system-ui, sans-serif" letterSpacing="tight" lineHeight="1" whiteSpace="nowrap" color="panel.text" noOfLines={1}>
									Rebecca
								</Text>)}
						</Flex>
					</Box>
					<VStack align="stretch" spacing={1}>
						{visibleGroups.map((group, groupIdx) => (<Box key={group.id}>
								{groupIdx > 0 && (<Box borderTopWidth="1px" borderColor={subNavBorder} my={2} mx={2} opacity={0.6}/>)}
								<VStack align="stretch" spacing={1}>
											{group.items.map((item) => {
                if (!item.url)
                    return null;
                const itemUrl = item.url;
                const isActive = location.pathname === itemUrl ||
                    (itemUrl !== "/" &&
                        location.pathname.startsWith(itemUrl));
                const Icon = item.icon;
                const showTutorialBadge = itemUrl === tutorialsUrl && hasNewTutorials;
                const navItem = (<Tooltip key={itemUrl} label={collapsed ? item.title : ""} placement={isRTL ? "left" : "right"} hasArrow>
														<HStack spacing={3} px={collapsed ? 2 : 3} py={2} minH="38px" borderRadius="10px" cursor="pointer" position="relative" bg={isActive ? "var(--rb-panel-accent-soft)" : "transparent"} color={isActive ? "var(--rb-panel-accent)" : itemColor} borderWidth="1px" borderColor={isActive ? "var(--rb-panel-accent-glow)" : "transparent"} boxShadow={isActive
                        ? "0 0 14px -3px var(--rb-panel-accent-glow), inset 0 1px 0 rgba(255, 255, 255, 0.05)"
                        : "none"} transition="all 0.25s cubic-bezier(0.16, 1, 0.3, 1)" _hover={{
                        bg: isActive
                            ? "var(--rb-panel-accent-soft)"
                            : "var(--rb-panel-accent-subtle)",
                        color: isActive
                            ? "var(--rb-panel-accent)"
                            : "panel.text",
                        transform: isRTL ? "translateX(-2px)" : "translateX(2px)",
                    }} justifyContent={collapsed ? "center" : "flex-start"}>
															{isActive && (<Box position="absolute" top="7px" bottom="7px" left={isRTL ? undefined : "0"} right={isRTL ? "0" : undefined} w="3px" borderRadius="full" bg="var(--rb-panel-accent)" boxShadow="0 0 8px var(--rb-panel-accent)"/>)}
															{showTutorialBadge && collapsed ? (<Box position="relative" display="inline-flex">
																	<Icon w={collapsed ? 5 : undefined} h={collapsed ? 5 : undefined}/>
																	<Box position="absolute" top="-6px" left={isRTL ? "-7px" : undefined} right={isRTL ? undefined : "-7px"} w="4" h="4" borderRadius="full" bg="var(--rb-panel-accent)" color="white" border="2px solid" borderColor={sidebarBg} display="inline-flex" alignItems="center" justifyContent="center">
																		<TutorialUpdateIconStyled />
																	</Box>
																</Box>) : (<Icon w={collapsed ? 5 : undefined} h={collapsed ? 5 : undefined}/>)}
															{!collapsed && (<>
																	<Text fontSize="sm" fontWeight={isActive ? "700" : "500"} noOfLines={1}>
																		{item.title}
																	</Text>
																	{showTutorialBadge ? (<Box ml={isRTL ? undefined : "auto"} mr={isRTL ? "auto" : undefined} w="5" h="5" borderRadius="full" bg="var(--rb-panel-accent)" color="white" display="inline-flex" alignItems="center" justifyContent="center">
																			<TutorialUpdateIconStyled />
																		</Box>) : null}
																</>)}
														</HStack>
													</Tooltip>);
                return (<NavLink key={itemUrl} to={itemUrl} onClick={(e) => handleNavClick(e, itemUrl)}>
														{navItem}
													</NavLink>);
            })}
								</VStack>
							</Box>))}
					</VStack>
				</Box>
			</VStack>
		</Box>);
};
