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
import { useEffect, useRef, useState } from "react";
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
	const [flyoutSide, setFlyoutSide] = useState<"right" | "left">(isRTL ? "left" : "right");
	const containerRef = useRef<HTMLDivElement>(null);
	const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const cancelCloseTimer = () => {
		if (closeTimerRef.current) {
			clearTimeout(closeTimerRef.current);
			closeTimerRef.current = null;
		}
	};

	const handleItemMouseEnter = (key: string) => {
		if (isMobile) return;
		cancelCloseTimer();
		setActiveSubmenu(key);
	};

	const handleContainerMouseLeave = () => {
		if (isMobile) return;
		cancelCloseTimer();
		closeTimerRef.current = setTimeout(() => {
			setActiveSubmenu(null);
		}, 200);
	};

	// Determine if flyout should open right or left based on available window space
	useEffect(() => {
		if (!containerRef.current) return;
		const rect = containerRef.current.getBoundingClientRect();
		const submenuWidth = 200;
		if (isRTL) {
			if (rect.left - submenuWidth < 10 && rect.right + submenuWidth < window.innerWidth - 10) {
				setFlyoutSide("right");
			} else {
				setFlyoutSide("left");
			}
		} else {
			if (rect.right + submenuWidth > window.innerWidth - 10 && rect.left - submenuWidth > 10) {
				setFlyoutSide("left");
			} else {
				setFlyoutSide("right");
			}
		}
	}, [activeSubmenu, isRTL]);

	useEffect(() => {
		return () => {
			cancelCloseTimer();
		};
	}, []);

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
		<Box
			ref={containerRef}
			position="relative"
			w="180px"
			dir={isRTL ? "rtl" : "ltr"}
			onMouseLeave={handleContainerMouseLeave}
		>
			<style>{`
				@keyframes rbMenuIn {
					0% { opacity: 0; transform: translateY(-4px) scale(0.98); }
					100% { opacity: 1; transform: translateY(0) scale(1); }
				}
				@keyframes rbFlyoutInRight {
					0% { opacity: 0; transform: translateX(-6px) scale(0.98); }
					100% { opacity: 1; transform: translateX(0) scale(1); }
				}
				@keyframes rbFlyoutInLeft {
					0% { opacity: 0; transform: translateX(6px) scale(0.98); }
					100% { opacity: 1; transform: translateX(0) scale(1); }
				}
			`}</style>

			{/* Main Menu Box - Fixed width, never moves or shifts */}
			<Box
				bg="#121316"
				borderWidth="1px"
				borderColor="rgba(255, 255, 255, 0.08)"
				borderRadius="14px"
				boxShadow="0 20px 50px rgba(0, 0, 0, 0.85), inset 0 1px 0 rgba(255, 255, 255, 0.08)"
				w="180px"
				py={1.5}
				animation="rbMenuIn 0.18s cubic-bezier(0.16, 1, 0.3, 1) forwards"
			>
				<MainMenuItem
					label={isRTL ? "وضعیت" : "Status"}
					icon={<StatusListIcon width={16} height={16} />}
					isOpen={activeSubmenu === "status"}
					arrowDirection={flyoutSide}
					onMouseEnter={() => handleItemMouseEnter("status")}
					onClick={() => setActiveSubmenu("status")}
				/>
				<MainMenuItem
					label={isRTL ? "فعال‌سازی" : "Activation"}
					icon={<CircleDotIcon width={16} height={16} />}
					isOpen={activeSubmenu === "activation"}
					arrowDirection={flyoutSide}
					onMouseEnter={() => handleItemMouseEnter("activation")}
					onClick={() => setActiveSubmenu("activation")}
				/>
				<MainMenuItem
					label={isRTL ? "ثبت‌نام" : "Registered"}
					icon={<CalendarIcon width={16} height={16} />}
					isOpen={activeSubmenu === "registered"}
					arrowDirection={flyoutSide}
					onMouseEnter={() => handleItemMouseEnter("registered")}
					onClick={() => setActiveSubmenu("registered")}
				/>
				<MainMenuItem
					label={isRTL ? "اولین اتصال" : "First Online"}
					icon={<CalendarIcon width={16} height={16} />}
					isOpen={activeSubmenu === "first_online"}
					arrowDirection={flyoutSide}
					onMouseEnter={() => handleItemMouseEnter("first_online")}
					onClick={() => setActiveSubmenu("first_online")}
				/>
				<MainMenuItem
					label={isRTL ? "آخرین اتصال" : "Last Online"}
					icon={<CalendarIcon width={16} height={16} />}
					isOpen={activeSubmenu === "last_online"}
					arrowDirection={flyoutSide}
					onMouseEnter={() => handleItemMouseEnter("last_online")}
					onClick={() => setActiveSubmenu("last_online")}
				/>
				<MainMenuItem
					label={isRTL ? "مرتب‌سازی" : "Sort by"}
					icon={<ArrowsUpDownIcon width={16} height={16} />}
					isOpen={activeSubmenu === "sort"}
					arrowDirection={flyoutSide}
					onMouseEnter={() => handleItemMouseEnter("sort")}
					onClick={() => setActiveSubmenu("sort")}
				/>

				<Box my={1.5} borderTopWidth="1px" borderColor="rgba(255, 255, 255, 0.08)" />

				<Flex
					align="center"
					gap={2.5}
					px={3}
					h="36px"
					mx={1.5}
					borderRadius="8px"
					cursor={hasAnyActiveFilter ? "pointer" : "default"}
					color={hasAnyActiveFilter ? "rgba(255, 255, 255, 0.9)" : "rgba(255, 255, 255, 0.35)"}
					opacity={hasAnyActiveFilter ? 1 : 0.6}
					fontSize="13px"
					fontWeight="500"
					role="group"
					transition="all 0.18s cubic-bezier(0.16, 1, 0.3, 1)"
					_hover={
						hasAnyActiveFilter
							? { bg: "rgba(255, 255, 255, 0.08)", color: "white" }
							: undefined
					}
					onClick={hasAnyActiveFilter ? handleReset : undefined}
				>
					<Box
						transition="transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
						_groupHover={hasAnyActiveFilter ? { transform: "rotate(-60deg)" } : undefined}
					>
						<ArrowPathIcon width={16} height={16} />
					</Box>
					<Text>{isRTL ? "بازنشانی" : "Reset"}</Text>
				</Flex>
			</Box>

			{/* Submenu Flyout Box (Desktop) - Absolutely positioned so it NEVER shifts the Main Menu */}
			{!isMobile && activeSubmenu && (
				<Box
					position="absolute"
					top={0}
					left={flyoutSide === "right" ? "calc(100% + 5px)" : "auto"}
					right={flyoutSide === "left" ? "calc(100% + 5px)" : "auto"}
					bg="#121316"
					borderWidth="1px"
					borderColor="rgba(255, 255, 255, 0.08)"
					borderRadius="14px"
					boxShadow="0 20px 50px rgba(0, 0, 0, 0.85), inset 0 1px 0 rgba(255, 255, 255, 0.08)"
					minW="190px"
					py={1.5}
					zIndex={100}
					animation={
						flyoutSide === "right"
							? "rbFlyoutInRight 0.16s cubic-bezier(0.16, 1, 0.3, 1) forwards"
							: "rbFlyoutInLeft 0.16s cubic-bezier(0.16, 1, 0.3, 1) forwards"
					}
					onMouseEnter={cancelCloseTimer}
					_before={{
						content: '""',
						position: "absolute",
						top: 0,
						bottom: 0,
						left: flyoutSide === "right" ? "-10px" : "auto",
						right: flyoutSide === "left" ? "-10px" : "auto",
						width: "12px",
					}}
				>
					{renderSubmenuContent()}
				</Box>
			)}
		</Box>
	);
};

// Item in the Main Menu
const MainMenuItem: FC<{
	label: string;
	icon: ReactNode;
	isOpen?: boolean;
	arrowDirection?: "left" | "right";
	onMouseEnter?: () => void;
	onClick?: () => void;
}> = ({ label, icon, isOpen = false, arrowDirection = "right", onMouseEnter, onClick }) => (
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
		color={isOpen ? "white" : "rgba(255, 255, 255, 0.75)"}
		bg={isOpen ? "rgba(255, 255, 255, 0.08)" : "transparent"}
		transition="all 0.18s cubic-bezier(0.16, 1, 0.3, 1)"
		role="group"
		_hover={{
			bg: "rgba(255, 255, 255, 0.08)",
			color: "white",
		}}
		onMouseEnter={onMouseEnter}
		onClick={onClick}
	>
		<HStack
			spacing={2.5}
			align="center"
			transition="transform 0.18s cubic-bezier(0.16, 1, 0.3, 1)"
			_groupHover={{
				transform: arrowDirection === "left" ? "translateX(-3px)" : "translateX(3px)",
			}}
		>
			<Box
				color={isOpen ? "var(--rb-panel-accent, #3b82f6)" : "inherit"}
				transition="color 0.15s ease"
			>
				{icon}
			</Box>
			<Text>{label}</Text>
		</HStack>
		<Box
			color="rgba(255, 255, 255, 0.45)"
			transition="all 0.18s cubic-bezier(0.16, 1, 0.3, 1)"
			_groupHover={{
				color: "white",
				transform: arrowDirection === "left" ? "translateX(-2px)" : "translateX(2px)",
			}}
		>
			{arrowDirection === "left" ? (
				<ChevronLeftIcon width={13} strokeWidth={2.2} />
			) : (
				<ChevronRightIcon width={13} strokeWidth={2.2} />
			)}
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
		color={isSelected ? "white" : "rgba(255, 255, 255, 0.75)"}
		bg={isSelected ? "rgba(37, 99, 235, 0.15)" : "transparent"}
		transition="all 0.18s cubic-bezier(0.16, 1, 0.3, 1)"
		role="group"
		_hover={{
			bg: isSelected ? "rgba(37, 99, 235, 0.25)" : "rgba(255, 255, 255, 0.08)",
			color: "white",
		}}
		onClick={onClick}
	>
		<HStack
			spacing={2.5}
			align="center"
			transition="transform 0.18s cubic-bezier(0.16, 1, 0.3, 1)"
			_groupHover={{
				transform: "translateX(3px)",
			}}
		>
			{icon && (
				<Box
					color={isSelected ? "var(--rb-panel-accent, #3b82f6)" : "inherit"}
					transition="color 0.15s ease"
				>
					{icon}
				</Box>
			)}
			<Text>{label}</Text>
		</HStack>
		{isSelected && (
			<Box
				color="white"
				ml={3}
				transition="transform 0.18s cubic-bezier(0.16, 1, 0.3, 1)"
				_groupHover={{ transform: "scale(1.15)" }}
			>
				<CheckIcon width={15} height={15} strokeWidth={2.5} />
			</Box>
		)}
	</Flex>
);
