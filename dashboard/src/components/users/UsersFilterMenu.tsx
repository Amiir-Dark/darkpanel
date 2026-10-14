import {
	Box,
	Flex,
	HStack,
	Text,
	useBreakpointValue,
} from "@chakra-ui/react";
import {
	ArrowPathIcon,
	ArrowsUpDownIcon,
	CalendarIcon,
	CheckCircleIcon,
	CheckIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	ClockIcon,
	ExclamationTriangleIcon,
	NoSymbolIcon,
} from "@heroicons/react/24/outline";
import { useDashboard } from "contexts/DashboardContext";
import type { FC, ReactNode } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

// Custom SVG matching Image 1 Status icon (3 checkmarks + 3 lines)
const StatusListIcon: FC<{ width?: number; height?: number }> = ({
	width = 16,
	height = 16,
}) => (
	<svg
		width={width}
		height={height}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
	>
		<path d="M9 6h11M9 12h11M9 18h11" />
		<path d="M4 6l1.5 1.5L8 5M4 12l1.5 1.5L8 11M4 18l1.5 1.5L8 17" />
	</svg>
);

// Custom SVG matching Image 1 & 3 Activation icon (circle with center dot)
const CircleDotIcon: FC<{ width?: number; height?: number }> = ({
	width = 16,
	height = 16,
}) => (
	<svg
		width={width}
		height={height}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
	>
		<circle cx="12" cy="12" r="9" />
		<circle cx="12" cy="12" r="2.5" fill="currentColor" />
	</svg>
);

export interface UsersFilterMenuProps {
	onClose?: () => void;
}

export const UsersFilterMenu: FC<UsersFilterMenuProps> = ({ onClose }) => {
	const { t, i18n } = useTranslation();
	const isRTL = i18n.dir(i18n.language) === "rtl";
	const isMobile = useBreakpointValue({ base: true, md: false }) ?? false;

	const filters = useDashboard((state) => state.filters);
	const onFilterChange = useDashboard((state) => state.onFilterChange);

	const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);

	const advancedFilters = filters.advancedFilters ?? [];
	const currentStatus = filters.status;
	const currentSort = filters.sort || "-created_at";

	// Determine active options
	const activeActivation = advancedFilters.includes("activated")
		? "activated"
		: advancedFilters.includes("not_activated")
			? "not_activated"
			: "all";

	const activeRegistered =
		advancedFilters.find((f) => f.startsWith("registered_")) || "any";

	const activeFirstOnline =
		advancedFilters.find((f) => f.startsWith("first_online_")) || "any";

	const activeLastOnline =
		advancedFilters.find((f) => f.startsWith("last_online_")) || "any";

	// Filter change handlers
	const handleStatusSelect = (statusVal?: "active" | "disabled" | "limited" | "expired" | "on_hold") => {
		onFilterChange({
			status: statusVal,
			offset: 0,
		});
		if (isMobile) {
			setActiveSubmenu(null);
		}
	};

	const handleActivationSelect = (val: "all" | "activated" | "not_activated") => {
		const next = advancedFilters.filter(
			(f) => f !== "activated" && f !== "not_activated",
		);
		if (val !== "all") {
			next.push(val);
		}
		onFilterChange({
			advancedFilters: next,
			offset: 0,
		});
		if (isMobile) {
			setActiveSubmenu(null);
		}
	};

	const handleTimeRangeSelect = (
		prefix: "registered" | "first_online" | "last_online",
		val: string,
	) => {
		const next = advancedFilters.filter((f) => !f.startsWith(`${prefix}_`));
		if (val !== "any") {
			next.push(val);
		}
		onFilterChange({
			advancedFilters: next,
			offset: 0,
		});
		if (isMobile) {
			setActiveSubmenu(null);
		}
	};

	const handleSortSelect = (sortVal: string) => {
		onFilterChange({
			sort: sortVal,
			offset: 0,
		});
		if (isMobile) {
			setActiveSubmenu(null);
		}
	};

	const handleReset = () => {
		const next = advancedFilters.filter(
			(f) =>
				!f.startsWith("registered_") &&
				!f.startsWith("first_online_") &&
				!f.startsWith("last_online_") &&
				f !== "activated" &&
				f !== "not_activated",
		);
		onFilterChange({
			status: undefined,
			advancedFilters: next,
			sort: "-created_at",
			offset: 0,
		});
		setActiveSubmenu(null);
		onClose?.();
	};

	const hasAnyActiveFilter = Boolean(
		currentStatus ||
		activeActivation !== "all" ||
		activeRegistered !== "any" ||
		activeFirstOnline !== "any" ||
		activeLastOnline !== "any" ||
		currentSort !== "-created_at",
	);

	// Definition of submenus
	const renderSubmenuContent = () => {
		switch (activeSubmenu) {
			case "status":
				return (
					<>
						<SubmenuItem
							label={isRTL ? "همه وضعیت‌ها" : "All statuses"}
							icon={<StatusListIcon width={16} height={16} />}
							isSelected={!currentStatus}
							onClick={() => handleStatusSelect(undefined)}
						/>
						<SubmenuItem
							label={isRTL ? "فعال" : "Active"}
							icon={<CheckCircleIcon width={16} height={16} />}
							isSelected={currentStatus === "active"}
							onClick={() => handleStatusSelect("active")}
						/>
						<SubmenuItem
							label={isRTL ? "در انتظار" : "On Hold"}
							icon={<CircleDotIcon width={16} height={16} />}
							isSelected={currentStatus === "on_hold"}
							onClick={() => handleStatusSelect("on_hold")}
						/>
						<SubmenuItem
							label={isRTL ? "منقضی شده" : "Expired"}
							icon={<ClockIcon width={16} height={16} />}
							isSelected={currentStatus === "expired"}
							onClick={() => handleStatusSelect("expired")}
						/>
						<SubmenuItem
							label={isRTL ? "محدود (اتمام حجم)" : "Limited"}
							icon={<ExclamationTriangleIcon width={16} height={16} />}
							isSelected={currentStatus === "limited"}
							onClick={() => handleStatusSelect("limited")}
						/>
						<SubmenuItem
							label={isRTL ? "غیرفعال" : "Disabled"}
							icon={<NoSymbolIcon width={16} height={16} />}
							isSelected={currentStatus === "disabled"}
							onClick={() => handleStatusSelect("disabled")}
						/>
					</>
				);

			case "activation":
				return (
					<>
						<SubmenuItem
							label={isRTL ? "همه" : "All"}
							icon={<CircleDotIcon width={16} height={16} />}
							isSelected={activeActivation === "all"}
							onClick={() => handleActivationSelect("all")}
						/>
						<SubmenuItem
							label={isRTL ? "فعال‌شده" : "Activated"}
							icon={<CheckCircleIcon width={16} height={16} />}
							isSelected={activeActivation === "activated"}
							onClick={() => handleActivationSelect("activated")}
						/>
						<SubmenuItem
							label={isRTL ? "فعال‌نشده" : "Not activated"}
							icon={<NoSymbolIcon width={16} height={16} />}
							isSelected={activeActivation === "not_activated"}
							onClick={() => handleActivationSelect("not_activated")}
						/>
					</>
				);

			case "registered":
				return (
					<>
						<SubmenuItem
							label={isRTL ? "همیشه" : "Any time"}
							isSelected={activeRegistered === "any"}
							onClick={() => handleTimeRangeSelect("registered", "any")}
						/>
						<SubmenuItem
							label={isRTL ? "یک ساعت گذشته" : "Last hour"}
							isSelected={activeRegistered === "registered_1h"}
							onClick={() =>
								handleTimeRangeSelect("registered", "registered_1h")
							}
						/>
						<SubmenuItem
							label={isRTL ? "۲۴ ساعت گذشته" : "Last 24 hours"}
							isSelected={activeRegistered === "registered_24h"}
							onClick={() =>
								handleTimeRangeSelect("registered", "registered_24h")
							}
						/>
						<SubmenuItem
							label={isRTL ? "۷ روز گذشته" : "Last 7 days"}
							isSelected={activeRegistered === "registered_7d"}
							onClick={() =>
								handleTimeRangeSelect("registered", "registered_7d")
							}
						/>
						<SubmenuItem
							label={isRTL ? "۳۰ روز گذشته" : "Last 30 days"}
							isSelected={activeRegistered === "registered_30d"}
							onClick={() =>
								handleTimeRangeSelect("registered", "registered_30d")
							}
						/>
					</>
				);

			case "first_online":
				return (
					<>
						<SubmenuItem
							label={isRTL ? "همیشه" : "Any time"}
							isSelected={activeFirstOnline === "any"}
							onClick={() => handleTimeRangeSelect("first_online", "any")}
						/>
						<SubmenuItem
							label={isRTL ? "یک ساعت گذشته" : "Last hour"}
							isSelected={activeFirstOnline === "first_online_1h"}
							onClick={() =>
								handleTimeRangeSelect("first_online", "first_online_1h")
							}
						/>
						<SubmenuItem
							label={isRTL ? "۲۴ ساعت گذشته" : "Last 24 hours"}
							isSelected={activeFirstOnline === "first_online_24h"}
							onClick={() =>
								handleTimeRangeSelect("first_online", "first_online_24h")
							}
						/>
						<SubmenuItem
							label={isRTL ? "۷ روز گذشته" : "Last 7 days"}
							isSelected={activeFirstOnline === "first_online_7d"}
							onClick={() =>
								handleTimeRangeSelect("first_online", "first_online_7d")
							}
						/>
						<SubmenuItem
							label={isRTL ? "۳۰ روز گذشته" : "Last 30 days"}
							isSelected={activeFirstOnline === "first_online_30d"}
							onClick={() =>
								handleTimeRangeSelect("first_online", "first_online_30d")
							}
						/>
					</>
				);

			case "last_online":
				return (
					<>
						<SubmenuItem
							label={isRTL ? "همیشه" : "Any time"}
							isSelected={activeLastOnline === "any"}
							onClick={() => handleTimeRangeSelect("last_online", "any")}
						/>
						<SubmenuItem
							label={isRTL ? "یک ساعت گذشته" : "Last hour"}
							isSelected={activeLastOnline === "last_online_1h"}
							onClick={() =>
								handleTimeRangeSelect("last_online", "last_online_1h")
							}
						/>
						<SubmenuItem
							label={isRTL ? "۲۴ ساعت گذشته" : "Last 24 hours"}
							isSelected={activeLastOnline === "last_online_24h"}
							onClick={() =>
								handleTimeRangeSelect("last_online", "last_online_24h")
							}
						/>
						<SubmenuItem
							label={isRTL ? "۷ روز گذشته" : "Last 7 days"}
							isSelected={activeLastOnline === "last_online_7d"}
							onClick={() =>
								handleTimeRangeSelect("last_online", "last_online_7d")
							}
						/>
						<SubmenuItem
							label={isRTL ? "۳۰ روز گذشته" : "Last 30 days"}
							isSelected={activeLastOnline === "last_online_30d"}
							onClick={() =>
								handleTimeRangeSelect("last_online", "last_online_30d")
							}
						/>
					</>
				);

			case "sort":
				return (
					<>
						<SubmenuItem
							label={isRTL ? "تاریخ ساخت (جدیدترین)" : "Date created (Newest)"}
							isSelected={currentSort === "-created_at"}
							onClick={() => handleSortSelect("-created_at")}
						/>
						<SubmenuItem
							label={isRTL ? "تاریخ ساخت (قدیمی‌ترین)" : "Date created (Oldest)"}
							isSelected={currentSort === "created_at"}
							onClick={() => handleSortSelect("created_at")}
						/>
						<SubmenuItem
							label={isRTL ? "مصرف ترافیک (بیشترین)" : "Traffic used (Highest)"}
							isSelected={currentSort === "-used_traffic"}
							onClick={() => handleSortSelect("-used_traffic")}
						/>
						<SubmenuItem
							label={isRTL ? "مصرف ترافیک (کمترین)" : "Traffic used (Lowest)"}
							isSelected={currentSort === "used_traffic"}
							onClick={() => handleSortSelect("used_traffic")}
						/>
						<SubmenuItem
							label={isRTL ? "سقف حجم (بیشترین)" : "Data limit (Highest)"}
							isSelected={currentSort === "-data_limit"}
							onClick={() => handleSortSelect("-data_limit")}
						/>
						<SubmenuItem
							label={isRTL ? "تاریخ انقضا (نزدیک‌ترین)" : "Expire date (Soonest)"}
							isSelected={currentSort === "expire"}
							onClick={() => handleSortSelect("expire")}
						/>
						<SubmenuItem
							label={isRTL ? "تاریخ انقضا (دورترین)" : "Expire date (Latest)"}
							isSelected={currentSort === "-expire"}
							onClick={() => handleSortSelect("-expire")}
						/>
						<SubmenuItem
							label={isRTL ? "نام کاربری (الف - ی)" : "Username (A - Z)"}
							isSelected={currentSort === "username"}
							onClick={() => handleSortSelect("username")}
						/>
						<SubmenuItem
							label={isRTL ? "نام کاربری (ی - الف)" : "Username (Z - A)"}
							isSelected={currentSort === "-username"}
							onClick={() => handleSortSelect("-username")}
						/>
					</>
				);

			default:
				return null;
		}
	};

	// On mobile, if activeSubmenu is set, show full-view submenu with a back button
	if (isMobile && activeSubmenu) {
		const submenuTitle =
			activeSubmenu === "status"
				? isRTL ? "وضعیت" : "Status"
				: activeSubmenu === "activation"
					? isRTL ? "فعال‌سازی" : "Activation"
					: activeSubmenu === "registered"
						? isRTL ? "تاریخ ثبت‌نام" : "Registered"
						: activeSubmenu === "first_online"
							? isRTL ? "اولین اتصال" : "First Online"
							: activeSubmenu === "last_online"
								? isRTL ? "آخرین اتصال" : "Last Online"
								: isRTL ? "مرتب‌سازی" : "Sort by";

		return (
			<Box
				bg="panel.surface"
				borderWidth="1px"
				borderColor="panel.border"
				borderRadius="14px"
				boxShadow="0 16px 40px rgba(0, 0, 0, 0.7)"
				w="220px"
				py={1.5}
				dir={isRTL ? "rtl" : "ltr"}
			>
				<Flex
					align="center"
					gap={2}
					px={3}
					py={2}
					borderBottomWidth="1px"
					borderColor="panel.border"
					cursor="pointer"
					color="panel.textPrimary"
					fontWeight="bold"
					fontSize="xs"
					onClick={() => setActiveSubmenu(null)}
					_hover={{ bg: "panel.hover" }}
				>
					{isRTL ? <ChevronRightIcon width={14} /> : <ChevronLeftIcon width={14} />}
					<Text>{submenuTitle}</Text>
				</Flex>
				<Box pt={1}>{renderSubmenuContent()}</Box>
			</Box>
		);
	}

	return (
		<Flex
			align="flex-start"
			gap={1.5}
			dir={isRTL ? "rtl" : "ltr"}
			onMouseLeave={() => !isMobile && setActiveSubmenu(null)}
		>
			{/* Main Menu Box */}
			<Box
				bg="panel.surface"
				borderWidth="1px"
				borderColor="panel.border"
				borderRadius="14px"
				boxShadow="0 16px 40px rgba(0, 0, 0, 0.7)"
				w="180px"
				py={1.5}
				flexShrink={0}
			>
				<MainMenuItem
					label={isRTL ? "وضعیت" : "Status"}
					icon={<StatusListIcon width={16} height={16} />}
					isOpen={activeSubmenu === "status"}
					isRTL={isRTL}
					onMouseEnter={() => !isMobile && setActiveSubmenu("status")}
					onClick={() => setActiveSubmenu("status")}
				/>
				<MainMenuItem
					label={isRTL ? "فعال‌سازی" : "Activation"}
					icon={<CircleDotIcon width={16} height={16} />}
					isOpen={activeSubmenu === "activation"}
					isRTL={isRTL}
					onMouseEnter={() => !isMobile && setActiveSubmenu("activation")}
					onClick={() => setActiveSubmenu("activation")}
				/>
				<MainMenuItem
					label={isRTL ? "ثبت‌نام" : "Registered"}
					icon={<CalendarIcon width={16} height={16} />}
					isOpen={activeSubmenu === "registered"}
					isRTL={isRTL}
					onMouseEnter={() => !isMobile && setActiveSubmenu("registered")}
					onClick={() => setActiveSubmenu("registered")}
				/>
				<MainMenuItem
					label={isRTL ? "اولین اتصال" : "First Online"}
					icon={<CalendarIcon width={16} height={16} />}
					isOpen={activeSubmenu === "first_online"}
					isRTL={isRTL}
					onMouseEnter={() => !isMobile && setActiveSubmenu("first_online")}
					onClick={() => setActiveSubmenu("first_online")}
				/>
				<MainMenuItem
					label={isRTL ? "آخرین اتصال" : "Last Online"}
					icon={<CalendarIcon width={16} height={16} />}
					isOpen={activeSubmenu === "last_online"}
					isRTL={isRTL}
					onMouseEnter={() => !isMobile && setActiveSubmenu("last_online")}
					onClick={() => setActiveSubmenu("last_online")}
				/>
				<MainMenuItem
					label={isRTL ? "مرتب‌سازی" : "Sort by"}
					icon={<ArrowsUpDownIcon width={16} height={16} />}
					isOpen={activeSubmenu === "sort"}
					isRTL={isRTL}
					onMouseEnter={() => !isMobile && setActiveSubmenu("sort")}
					onClick={() => setActiveSubmenu("sort")}
				/>

				<Box my={1.5} borderTopWidth="1px" borderColor="panel.border" />

				<Flex
					align="center"
					gap={2.5}
					px={3}
					h="36px"
					mx={1.5}
					borderRadius="8px"
					cursor={hasAnyActiveFilter ? "pointer" : "default"}
					color={hasAnyActiveFilter ? "panel.textPrimary" : "panel.textMuted"}
					opacity={hasAnyActiveFilter ? 1 : 0.6}
					fontSize="13px"
					fontWeight="500"
					transition="all 0.15s ease"
					_hover={
						hasAnyActiveFilter
							? { bg: "panel.hover", color: "panel.textPrimary" }
							: undefined
					}
					onClick={hasAnyActiveFilter ? handleReset : undefined}
				>
					<ArrowPathIcon width={16} height={16} />
					<Text>{isRTL ? "بازنشانی" : "Reset"}</Text>
				</Flex>
			</Box>

			{/* Submenu Flyout Box (Desktop) */}
			{!isMobile && activeSubmenu && (
				<Box
					bg="panel.surface"
					borderWidth="1px"
					borderColor="panel.border"
					borderRadius="14px"
					boxShadow="0 16px 40px rgba(0, 0, 0, 0.7)"
					minW="180px"
					py={1.5}
					flexShrink={0}
				>
					{renderSubmenuContent()}
				</Box>
			)}
		</Flex>
	);
};

// Item in the Main Menu
const MainMenuItem: FC<{
	label: string;
	icon: ReactNode;
	isOpen?: boolean;
	isRTL?: boolean;
	onMouseEnter?: () => void;
	onClick?: () => void;
}> = ({ label, icon, isOpen = false, isRTL = false, onMouseEnter, onClick }) => (
	<Flex
		align="center"
		justify="space-between"
		px={3}
		h="36px"
		mx={1.5}
		borderRadius="8px"
		cursor="pointer"
		fontSize="13px"
		fontWeight="500"
		color={isOpen ? "white" : "panel.textSecondary"}
		bg={isOpen ? "panel.hover" : "transparent"}
		transition="all 0.15s ease"
		_hover={{
			bg: "panel.hover",
			color: "white",
		}}
		onMouseEnter={onMouseEnter}
		onClick={onClick}
	>
		<HStack spacing={2.5} align="center">
			<Box color={isOpen ? "var(--rb-panel-accent, #3b82f6)" : "inherit"}>
				{icon}
			</Box>
			<Text>{label}</Text>
		</HStack>
		<Box color="panel.textMuted">
			{isRTL ? <ChevronLeftIcon width={13} /> : <ChevronRightIcon width={13} />}
		</Box>
	</Flex>
);

// Item in the Submenu
const SubmenuItem: FC<{
	label: string;
	icon?: ReactNode;
	isSelected?: boolean;
	onClick?: () => void;
}> = ({ label, icon, isSelected = false, onClick }) => (
	<Flex
		align="center"
		justify="space-between"
		px={3}
		h="36px"
		mx={1.5}
		borderRadius="8px"
		cursor="pointer"
		fontSize="13px"
		fontWeight="500"
		color={isSelected ? "white" : "panel.textSecondary"}
		bg={isSelected ? "panel.hover" : "transparent"}
		transition="all 0.15s ease"
		_hover={{
			bg: "panel.hover",
			color: "white",
		}}
		onClick={onClick}
	>
		<HStack spacing={2.5} align="center">
			{icon && (
				<Box color={isSelected ? "var(--rb-panel-accent, #3b82f6)" : "inherit"}>
					{icon}
				</Box>
			)}
			<Text>{label}</Text>
		</HStack>
		{isSelected && (
			<Box color="white" ml={3}>
				<CheckIcon width={15} height={15} strokeWidth={2.5} />
			</Box>
		)}
	</Flex>
);
