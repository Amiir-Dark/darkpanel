import {
	ArrowPathIcon,
	MagnifyingGlassIcon,
	PlusIcon,
	XMarkIcon,
} from "@heroicons/react/24/outline";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "react-query";
import { QRCodeDialog } from "components/QRCodeDialog";
import { UserDialog } from "components/UserDialog";
import { UsersTable } from "components/UsersTable";
import { UsersSummaryCards } from "components/users/UsersSummaryCards";
import { Button, Input, Select } from "components/linear/UI";
import { fetchInbounds, useDashboard } from "contexts/DashboardContext";
import useGetUser from "hooks/useGetUser";
import { fetch } from "service/http";
import { AdminRole } from "types/Admin";

export const UsersPage = () => {
	const { t } = useTranslation();
	const filters = useDashboard((s) => s.filters);
	const loading = useDashboard((s) => s.loading);
	const onFilterChange = useDashboard((s) => s.onFilterChange);
	const refetchUsers = useDashboard((s) => s.refetchUsers);
	const onCreateUser = useDashboard((s) => s.onCreateUser);
	const isUserLimitReached = useDashboard((s) => s.isUserLimitReached);
	const isUserDialogOpen = useDashboard((s) => s.isCreatingNewUser || Boolean(s.editingUser));
	const isQRCodeDialogOpen = useDashboard((s) => s.QRcodeLinks !== null);

	const [searchText, setSearchText] = useState(filters.search || "");
	const [autoRefreshMs, setAutoRefreshMs] = useState(5000);
	const searchTimerRef = useRef(null);

	const { userData, getUserIsSuccess } = useGetUser();
	const isPrivilegedAdmin =
		getUserIsSuccess &&
		(userData?.role === AdminRole.FullAccess || userData?.role === AdminRole.Sudo);

	const { data: servicesData } = useQuery(
		"users-filter-services",
		() => fetch("/v2/services", { query: { limit: 1000, offset: 0 } }),
		{ staleTime: 30000 },
	);
	const services = useMemo(
		() =>
			Array.isArray(servicesData?.services)
				? servicesData.services
				: Array.isArray(servicesData)
					? servicesData
					: [],
		[servicesData],
	);

	const { data: adminsData } = useQuery(
		"users-filter-admins",
		() => fetch("/admins", { query: { limit: 1000, offset: 0 } }),
		{ enabled: isPrivilegedAdmin, staleTime: 30000 },
	);
	const admins = useMemo(
		() =>
			Array.isArray(adminsData)
				? adminsData
				: Array.isArray(adminsData?.admins)
					? adminsData.admins
					: [],
		[adminsData],
	);

	const advancedFilters = filters.advancedFilters ?? [];
	const connectionFilter = advancedFilters.includes("online")
		? "online"
		: advancedFilters.includes("offline")
			? "offline"
			: "";

	const handleConnectionChange = (value) => {
		const next = advancedFilters.filter((f) => f !== "online" && f !== "offline");
		if (value === "online" || value === "offline") {
			next.push(value);
		}
		onFilterChange({ advancedFilters: next, offset: 0 });
	};

	const hasActiveFilters = Boolean(
		filters.search ||
			filters.status ||
			connectionFilter ||
			filters.serviceId !== undefined ||
			filters.owner,
	);

	const handleResetFilters = () => {
		setSearchText("");
		if (searchTimerRef.current) window.clearTimeout(searchTimerRef.current);
		onFilterChange({
			search: undefined,
			status: undefined,
			advancedFilters: advancedFilters.filter((f) => f !== "online" && f !== "offline"),
			serviceId: undefined,
			owner: undefined,
			offset: 0,
		});
	};

	const refreshOnlineUsers = useCallback(async () => {
		if (typeof document !== "undefined" && document.visibilityState === "hidden") {
			return;
		}
		try {
			const usernames = (useDashboard.getState().users?.users || []).map((u) => u.username);
			if (!usernames.length) return;
			const response = await fetch("/users/onlines", {
				query: { details: true, usernames },
			});
			const onlineSet = new Set(Array.isArray(response?.users) ? response.users : []);
			const speeds = response?.speeds || {};
			const liveUserStats = {};
			for (const name of usernames) {
				liveUserStats[name] = {
					is_online: onlineSet.has(name),
					upload_speed: speeds[name]?.upload_speed,
					download_speed: speeds[name]?.download_speed,
				};
			}
			useDashboard.setState({ liveUserStats });
		} catch {}
	}, []);

	useEffect(() => {
		useDashboard.getState().refetchUsers(true);
		fetchInbounds();
	}, []);

	useEffect(() => {
		if (!autoRefreshMs) return undefined;
		const timer = window.setInterval(() => void refreshOnlineUsers(), autoRefreshMs);
		return () => window.clearInterval(timer);
	}, [autoRefreshMs, refreshOnlineUsers]);

	const handleSearchChange = (value) => {
		setSearchText(value);
		if (searchTimerRef.current) window.clearTimeout(searchTimerRef.current);
		searchTimerRef.current = window.setTimeout(() => {
			onFilterChange({ search: value, offset: 0 });
		}, 220);
	};

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h1 className="text-lg font-semibold tracking-tight text-ink">
						{t("users", "Users")}
					</h1>
				</div>
				<div className="flex items-center gap-2">
					<Select
						value={autoRefreshMs}
						onChange={(e) => setAutoRefreshMs(Number(e.target.value))}
						className="!h-8 !w-auto min-w-[155px] flex-1 sm:flex-initial text-xs"
						aria-label="Auto refresh"
					>
						<option value={5000}>Auto refresh · 5s</option>
						<option value={15000}>Auto refresh · 15s</option>
						<option value={0}>Auto refresh · Off</option>
					</Select>
					<Button size="sm" onClick={() => refetchUsers(true)} loading={loading}>
						<ArrowPathIcon className="h-3.5 w-3.5" />
					</Button>
					<Button
						variant="primary"
						size="sm"
						disabled={isUserLimitReached}
						onClick={() => onCreateUser(true)}
					>
						<PlusIcon className="h-4 w-4" />
						<span>{t("createUser", "Create User")}</span>
					</Button>
				</div>
			</div>

			<UsersSummaryCards />

			<div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
				<div className="relative col-span-2 sm:min-w-[200px] sm:flex-1">
					<MagnifyingGlassIcon className="pointer-events-none absolute start-3 top-2.5 h-4 w-4 text-ink-tertiary" />
					<Input
						value={searchText}
						onChange={(e) => handleSearchChange(e.target.value)}
						placeholder={t("searchUsers", "Search users...")}
						className="ps-9"
					/>
				</div>

				<Select
					value={filters.status || ""}
					onChange={(e) => onFilterChange({ status: e.target.value || undefined, offset: 0 })}
					className="w-full sm:!w-36"
					aria-label="Status filter"
				>
					<option value="">{t("allStatuses", "All statuses")}</option>
					<option value="active">{t("status_active", "Active")}</option>
					<option value="on_hold">{t("status_on_hold", "On Hold")}</option>
					<option value="limited">{t("status_limited", "Limited")}</option>
					<option value="expired">{t("status_expired", "Expired")}</option>
					<option value="disabled">{t("status_disabled", "Disabled")}</option>
				</Select>

				<Select
					value={connectionFilter}
					onChange={(e) => handleConnectionChange(e.target.value)}
					className="w-full sm:!w-44"
					aria-label="Connection filter"
				>
					<option value="">{t("allConnections", "All connections")}</option>
					<option value="online">{t("online", "Online")}</option>
					<option value="offline">{t("offline", "Offline")}</option>
				</Select>

				<Select
					value={filters.serviceId ?? ""}
					onChange={(e) =>
						onFilterChange({
							serviceId: e.target.value ? Number(e.target.value) : undefined,
							offset: 0,
						})
					}
					className="w-full sm:!w-40"
					aria-label="Service filter"
				>
					<option value="">{t("allServices", "All services")}</option>
					{services.map((service) => (
						<option key={service.id} value={service.id}>
							{service.name}
						</option>
					))}
				</Select>

				{isPrivilegedAdmin && (
					<Select
						value={filters.owner || ""}
						onChange={(e) => onFilterChange({ owner: e.target.value || undefined, offset: 0 })}
						className="w-full sm:!w-40"
						aria-label="Admin filter"
					>
						<option value="">{t("allAdmins", "All admins")}</option>
						{admins.map((admin) => (
							<option key={admin.username} value={admin.username}>
								{admin.username}
							</option>
						))}
					</Select>
				)}

				<Select
					value={filters.sort || "-created_at"}
					onChange={(e) => onFilterChange({ sort: e.target.value, offset: 0 })}
					className={`${isPrivilegedAdmin ? "col-span-2 sm:col-span-1" : ""} w-full sm:!w-40`}
					aria-label="Sort"
				>
					<option value="-created_at">{t("sort.newest", "Newest")}</option>
					<option value="created_at">{t("sort.oldest", "Oldest")}</option>
					<option value="username">{t("sort.username", "Username (A-Z)")}</option>
					<option value="-used_traffic">{t("sort.mostUsed", "Most Traffic")}</option>
				</Select>

				{hasActiveFilters && (
					<Button
						size="sm"
						variant="ghost"
						onClick={handleResetFilters}
						title={t("clearFilters", "Clear filters")}
						className="col-span-2 justify-center sm:col-span-1 sm:w-auto"
					>
						<XMarkIcon className="h-3.5 w-3.5" />
						<span>{t("clear", "Clear")}</span>
					</Button>
				)}
			</div>

			<UsersTable />

			{isUserDialogOpen && <UserDialog />}
			{isQRCodeDialogOpen && <QRCodeDialog />}
		</div>
	);
};

export default UsersPage;
