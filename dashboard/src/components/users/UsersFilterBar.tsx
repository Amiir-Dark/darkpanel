import {
	Badge,
	Box,
	Button,
	Checkbox,
	chakra,
	Flex,
	HStack,
	IconButton,
	Menu,
	MenuButton,
	MenuItem,
	MenuList,
	Popover,
	PopoverArrow,
	PopoverBody,
	PopoverCloseButton,
	PopoverContent,
	PopoverHeader,
	PopoverTrigger,
	Portal,
	Spacer,
	Stack,
	Text,
	Tooltip,
} from "@chakra-ui/react";
import {
	AdjustmentsHorizontalIcon,
	ArrowPathIcon,
	ChevronDownIcon,
	PlusIcon,
	QuestionMarkCircleIcon,
} from "@heroicons/react/24/outline";
import { PanelSelect as Select } from "components/common/PanelSelect";
import { SearchInput } from "components/common/SearchInput";
import { ADVANCED_FILTER_OPTIONS } from "components/Filters";
import { useAdminsStore } from "contexts/AdminsContext";
import { useDashboard } from "contexts/DashboardContext";
import { useServicesStore } from "contexts/ServicesContext";
import useGetUser from "hooks/useGetUser";
import debounce from "lodash.debounce";
import type React from "react";
import { type FC, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AdminRole, AdminStatus, UserPermissionToggle } from "types/Admin";
import { canViewUserTraffic, isUserManagementLocked } from "utils/adminTraffic";

const iconProps = {
	baseStyle: {
		w: 5,
		h: 5,
	},
};

const FilterIcon = chakra(AdjustmentsHorizontalIcon, iconProps);
const PlusIconStyled = chakra(PlusIcon, iconProps);
const ReloadIconStyled = chakra(ArrowPathIcon, iconProps);
const HelpIcon = chakra(QuestionMarkCircleIcon, { baseStyle: { w: 4, h: 4 } });

const formatChipCount = (value: number, locale: string) =>
	new Intl.NumberFormat(locale || "en").format(value);

const AUTO_REFRESH_INTERVALS = [3_000, 5_000, 10_000, 30_000] as const;

export interface UsersFilterBarProps {
	onRefresh?: () => void;
	isRefreshing?: boolean;
	autoRefreshInterval?: number;
	onAutoRefreshChange?: (interval: number) => void;
}

export const UsersFilterBar: FC<UsersFilterBarProps> = ({
	onRefresh,
	isRefreshing = false,
	autoRefreshInterval,
	onAutoRefreshChange,
}) => {
	const loading = useDashboard((state) => state.loading);
	const filters = useDashboard((state) => state.filters);
	const onFilterChange = useDashboard((state) => state.onFilterChange);
	const onCreateUser = useDashboard((state) => state.onCreateUser);
	const { t, i18n } = useTranslation();
	const locale = i18n.language || "en";
	const isRTL = i18n.dir(i18n.language) === "rtl";
	const [search, setSearch] = useState("");
	const { userData } = useGetUser();
	const hasPrivilegedRole =
		userData.role === AdminRole.Sudo || userData.role === AdminRole.FullAccess;
	const hasFullAccess = userData.role === AdminRole.FullAccess;
	const userManagementLocked = isUserManagementLocked(userData);
	const isCurrentAdminDisabled =
		!hasPrivilegedRole && userData.status === AdminStatus.Disabled;
	const canCreateUsers =
		hasFullAccess ||
		Boolean(userData.permissions?.users?.[UserPermissionToggle.Create]);
	const showCreateButton =
		canCreateUsers && !isCurrentAdminDisabled && !userManagementLocked;
	const canViewTraffic = canViewUserTraffic(userData);

	const activeFilters = filters.advancedFilters ?? [];
	const serviceId = filters.serviceId;
	const ownerFilter = filters.owner;
	const matchOptions = {
		matchCase: Boolean(filters.matchCase),
		matchWholeWord: Boolean(filters.matchWholeWord),
	};
	const rawServiceOptions = useServicesStore((state) => state.serviceOptions);
	const fetchServiceOptions = useServicesStore(
		(state) => state.fetchServiceOptions,
	);
	const serviceOptions = Array.isArray(rawServiceOptions)
		? rawServiceOptions
		: [];
	const adminOptions = useAdminsStore((state) => state.adminOptions);
	const fetchAdminOptions = useAdminsStore((state) => state.fetchAdminOptions);
	const safeAdminOptions = Array.isArray(adminOptions) ? adminOptions : [];

	const debouncedSearchChange = useMemo(
		() =>
			debounce((nextSearch: string) => {
				onFilterChange({
					search: nextSearch,
					offset: 0,
				});
			}, 300),
		[onFilterChange],
	);

	useEffect(() => {
		return () => {
			debouncedSearchChange.cancel();
		};
	}, [debouncedSearchChange]);

	useEffect(() => {
		fetchServiceOptions({ limit: 1000 });
	}, [fetchServiceOptions]);

	useEffect(() => {
		if (hasPrivilegedRole) {
			fetchAdminOptions({ limit: 1000, offset: 0, sort: "username" });
		}
	}, [fetchAdminOptions, hasPrivilegedRole]);

	useEffect(() => {
		setSearch(filters.search ?? "");
	}, [filters.search]);

	const getFilterLabel = (filterKey: string) => {
		const option = ADVANCED_FILTER_OPTIONS.find(
			(item) => item.key === filterKey,
		);
		return option ? t(option.labelKey, option.fallback) : filterKey;
	};

	const toggleAdvancedFilter = (filterKey: string) => {
		const nextFilters = activeFilters.includes(filterKey)
			? activeFilters.filter((item) => item !== filterKey)
			: [...activeFilters, filterKey];
		onFilterChange({
			advancedFilters: nextFilters,
			offset: 0,
		});
	};

	const clearAdvancedFilters = () => {
		if (activeFilters.length === 0 && !serviceId && !ownerFilter) {
			return;
		}
		onFilterChange({
			advancedFilters: [],
			serviceId: undefined,
			owner: undefined,
			offset: 0,
		});
	};

	const handleServiceChange = (value: string) => {
		onFilterChange({
			serviceId: value ? Number(value) : undefined,
			offset: 0,
		});
	};

	const handleAdminChange = (value: string) => {
		onFilterChange({
			owner: value || undefined,
			offset: 0,
		});
	};

	const onSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		setSearch(event.target.value);
		debouncedSearchChange(event.target.value);
	};

	const clearSearch = () => {
		debouncedSearchChange.cancel();
		setSearch("");
		onFilterChange({
			...filters,
			offset: 0,
			search: "",
		});
	};

	const handleCreate = () => {
		if (!showCreateButton) return;
		onCreateUser(true);
	};

	const activeFilterTotal =
		activeFilters.length + (serviceId ? 1 : 0) + (ownerFilter ? 1 : 0);
	const hasClearableFilters = activeFilterTotal > 0;

	return (
		<Flex align="center" gap={2} w="full" minW={0}>
			{/* 1. Search users input - exactly matching Photo 2 */}
			<SearchInput
				containerProps={{
					flex: { base: "1 1 auto", md: "0 0 340px" },
					minW: 0,
					maxW: { base: "100%", md: "380px" },
				}}
				className="rb-users-search-input"
				placeholder={t("users.searchPlaceholder", "Search users...")}
				value={search}
				onChange={onSearchChange}
				matchOptions={matchOptions}
				onMatchOptionsChange={(options) =>
					onFilterChange({
						matchCase: options.matchCase,
						matchWholeWord: options.matchWholeWord,
						offset: 0,
					})
				}
				isLoading={loading}
				onClear={clearSearch}
				borderRadius="12px"
				h="40px"
				borderColor="panel.border"
				bg="panel.surface"
				_hover={{
					borderColor: "panel.borderStrong",
				}}
				_focusVisible={{
					borderColor: "blue.500",
					boxShadow: "0 0 16px -2px rgba(37, 99, 235, 0.4)",
					bg: "panel.surface",
				}}
				rightElement={
					<Tooltip label={t("users.searchHelp")} placement="top" hasArrow>
						<Box
							display="inline-flex"
							alignItems="center"
							color="panel.textMuted"
							px={1}
						>
							<HelpIcon />
						</Box>
					</Tooltip>
				}
			/>

			{/* 2. Mobile Create Button [ + ] - blue rounded box, right after search input */}
			{showCreateButton && (
				<IconButton
					className="rb-users-create-btn-mobile"
					display={{ base: "inline-flex", md: "none" }}
					aria-label={t("createUser")}
					icon={<PlusIconStyled w={5} h={5} color="white" />}
					bg="#2563eb"
					_hover={{ bg: "#1d4ed8" }}
					_active={{ bg: "#1e40af", transform: "scale(0.96)" }}
					color="white"
					borderRadius="12px"
					w="40px"
					h="40px"
					minW="40px"
					flexShrink={0}
					boxShadow="0 2px 8px rgba(37, 99, 235, 0.35)"
					transition="all 0.2s ease"
					onClick={handleCreate}
				/>
			)}

			{/* Spacer for desktop layout: pushes actions to the right */}
			<Spacer display={{ base: "none", md: "block" }} />

			{/* 3. Filter Button [ 🎛 ] - dark box with AdjustmentsHorizontalIcon */}
			<Popover placement="bottom-end">
				<PopoverTrigger>
					<Box position="relative" flexShrink={0}>
						<IconButton
							aria-label={t("filters.advancedButton")}
							icon={<FilterIcon w={5} h={5} />}
							variant="ghost"
							borderRadius="12px"
							borderWidth="1px"
							borderColor="panel.border"
							bg="panel.surface"
							w="40px"
							h="40px"
							minW="40px"
							color="panel.textSecondary"
							transition="all 0.2s ease"
							_hover={{
								borderColor: "panel.borderStrong",
								bg: "panel.hover",
								color: "panel.textPrimary",
							}}
							_active={{
								transform: "scale(0.96)",
							}}
						/>
						{hasClearableFilters && (
							<Badge
								className="rb-users-filter-badge"
								bg="blue.500"
								color="white"
								boxShadow="0 0 10px rgba(37, 99, 235, 0.5)"
								variant="solid"
								borderRadius="full"
								position="absolute"
								top="-3px"
								insetInlineEnd="-3px"
								fontSize="0.62rem"
								px={1.5}
								py={0.2}
								pointerEvents="none"
							>
								{formatChipCount(activeFilterTotal, locale)}
							</Badge>
						)}
					</Box>
				</PopoverTrigger>
				<PopoverContent
					bg="panel.surface"
					borderColor="panel.border"
					borderRadius="18px"
					boxShadow="inset 0 1px 1px 0 rgba(255, 255, 255, 0.08), 0 20px 50px rgba(0, 0, 0, 0.6)"
					minW="270px"
					overflow="hidden"
				>
					<PopoverArrow bg="panel.surface" />
					<PopoverCloseButton />
					<PopoverHeader
						fontWeight="bold"
						borderColor="panel.border"
						fontSize="sm"
						py={3}
					>
						{t("filters.advancedTitle")}
					</PopoverHeader>
					<PopoverBody py={3}>
						<Stack spacing={2.5}>
							{ADVANCED_FILTER_OPTIONS.filter(
								(option) => option.key !== "top_speed" || canViewTraffic,
							).map((option) => (
								<Checkbox
									key={option.key}
									isChecked={activeFilters.includes(option.key)}
									onChange={() => toggleAdvancedFilter(option.key)}
									colorScheme="blue"
								>
									<Text fontSize="sm">{getFilterLabel(option.key)}</Text>
								</Checkbox>
							))}
						</Stack>
						<Stack spacing={3} mt={4} pt={3} borderTopWidth="1px" borderColor="panel.border">
							<Box>
								<Text fontSize="xs" fontWeight="bold" color="panel.textSecondary" mb={1.5}>
									{t("filters.advanced.serviceLabel")}
								</Text>
								<Select
									value={serviceId ? String(serviceId) : ""}
									onChange={(event) => handleServiceChange(event.target.value)}
									portalled={false}
									size="sm"
									borderRadius="10px"
								>
									<option value="">{t("filters.advanced.serviceAll")}</option>
									{serviceOptions.map((service) => (
										<option key={service.id} value={String(service.id)}>
											{service.name}
										</option>
									))}
								</Select>
							</Box>
							{hasPrivilegedRole && (
								<Box>
									<Text fontSize="xs" fontWeight="bold" color="panel.textSecondary" mb={1.5}>
										{t("filters.advanced.adminLabel")}
									</Text>
									<Select
										value={ownerFilter ?? ""}
										onChange={(event) => handleAdminChange(event.target.value)}
										portalled={false}
										size="sm"
										borderRadius="10px"
									>
										<option value="">{t("filters.advanced.adminAll")}</option>
										<option value={userData.username}>
											{t("filters.advanced.adminMyUsers")}
										</option>
										{safeAdminOptions.map((record) => (
											<option key={record.username} value={record.username}>
												{record.username}
											</option>
										))}
									</Select>
								</Box>
							)}
							{onAutoRefreshChange && (
								<Box pt={2} borderTopWidth="1px" borderColor="panel.border">
									<Text fontSize="xs" fontWeight="bold" color="panel.textSecondary" mb={1.5}>
										{t("usersTable.autoRefresh")}
									</Text>
									<HStack spacing={1.5} flexWrap="wrap">
										{([0, 3000, 5000, 10000, 30000] as const).map((interval) => (
											<Button
												key={interval}
												size="xs"
												variant={autoRefreshInterval === interval ? "solid" : "outline"}
												colorScheme={autoRefreshInterval === interval ? "blue" : "gray"}
												borderRadius="8px"
												onClick={() => onAutoRefreshChange(interval)}
											>
												{interval === 0 ? t("usersTable.autoRefreshOff") : `${interval / 1000}s`}
											</Button>
										))}
									</HStack>
								</Box>
							)}
						</Stack>
						<Button
							variant="ghost"
							size="sm"
							mt={3.5}
							w="full"
							borderRadius="10px"
							onClick={clearAdvancedFilters}
							isDisabled={!hasClearableFilters}
						>
							{t("filters.advancedClear")}
						</Button>
					</PopoverBody>
				</PopoverContent>
			</Popover>

			{/* 4. Refresh Button [ 🔄 ] - dark box with circular reload icon */}
			{onRefresh && (
				<IconButton
					aria-label={t("refresh")}
					icon={
						<ReloadIconStyled
							w={5}
							h={5}
							style={
								isRefreshing
									? { animation: "spin 0.8s linear infinite" }
									: undefined
							}
						/>
					}
					variant="ghost"
					borderRadius="12px"
					borderWidth="1px"
					borderColor="panel.border"
					bg="panel.surface"
					w="40px"
					h="40px"
					minW="40px"
					flexShrink={0}
					color="panel.textSecondary"
					transition="all 0.2s ease"
					_hover={{
						borderColor: "panel.borderStrong",
						bg: "panel.hover",
						color: "panel.textPrimary",
					}}
					_active={{
						transform: "scale(0.96)",
					}}
					onClick={onRefresh}
					isDisabled={isRefreshing}
				/>
			)}

			{/* 5. Desktop-only Auto-refresh menu pill */}
			{autoRefreshInterval !== undefined && onAutoRefreshChange && (
				<Menu placement={isRTL ? "bottom-start" : "bottom-end"} isLazy>
					<MenuButton
						as={Button}
						display={{ base: "none", md: "inline-flex" }}
						size="sm"
						variant="ghost"
						rightIcon={<ChevronDownIcon width={14} />}
						aria-label={t("usersTable.autoRefresh")}
						borderRadius="12px"
						borderWidth="1px"
						borderColor="panel.border"
						bg="panel.surface"
						px={3}
						h="40px"
						fontSize="xs"
						fontWeight="600"
						transition="all 0.2s ease"
						_hover={{
							borderColor: "panel.borderStrong",
							bg: "panel.hover",
						}}
					>
						{autoRefreshInterval
							? `${t("usersTable.autoRefresh")} · ${autoRefreshInterval / 1000}s`
							: t("usersTable.autoRefreshOff")}
					</MenuButton>
					<Portal>
						<MenuList
							zIndex={1800}
							minW="180px"
							bg="panel.surface"
							borderColor="panel.border"
							borderRadius="14px"
							boxShadow="inset 0 1px 1px 0 rgba(255, 255, 255, 0.08), 0 16px 40px rgba(0, 0, 0, 0.6)"
							p={1.5}
						>
							<MenuItem
								onClick={() => onAutoRefreshChange(0)}
								fontWeight={autoRefreshInterval === 0 ? "bold" : "normal"}
								borderRadius="8px"
								fontSize="xs"
							>
								{t("usersTable.autoRefreshOff")}
							</MenuItem>
							{AUTO_REFRESH_INTERVALS.map((interval) => (
								<MenuItem
									key={interval}
									onClick={() => onAutoRefreshChange(interval)}
									fontWeight={autoRefreshInterval === interval ? "bold" : "normal"}
									borderRadius="8px"
									fontSize="xs"
								>
									{interval / 1000}s
								</MenuItem>
							))}
						</MenuList>
					</Portal>
				</Menu>
			)}

			{/* 6. Desktop-only Create User button with text */}
			{showCreateButton && (
				<Button
					className="rb-users-create-btn"
					display={{ base: "none", md: "inline-flex" }}
					leftIcon={<PlusIconStyled w={4} h={4} />}
					bg="#2563eb"
					_hover={{ bg: "#1d4ed8" }}
					_active={{ bg: "#1e40af", transform: "scale(0.98)" }}
					color="white"
					borderRadius="12px"
					h="40px"
					px={4}
					fontSize="sm"
					fontWeight="600"
					whiteSpace="nowrap"
					flexShrink={0}
					boxShadow="0 2px 8px rgba(37, 99, 235, 0.35)"
					transition="all 0.2s ease"
					onClick={handleCreate}
				>
					{t("createUser")}
				</Button>
			)}
		</Flex>
	);
};
