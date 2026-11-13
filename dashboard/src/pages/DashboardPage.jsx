import {
	ArrowDownTrayIcon,
	ArrowPathIcon,
	ArrowUpTrayIcon,
	CircleStackIcon,
	ClockIcon,
	CpuChipIcon,
	ServerStackIcon,
	ShieldCheckIcon,
	SignalIcon,
	UserGroupIcon,
	UsersIcon,
} from "@heroicons/react/24/outline";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "react-query";
import { Link } from "react-router-dom";
import { AdminAnalyticsDashboard } from "components/AdminAnalyticsDashboard";
import { DashboardHeaderActions } from "components/linear/DashboardHeaderActions";
import { Card, Spinner } from "components/linear/UI";
import useGetUser from "hooks/useGetUser";
import { fetch } from "service/http";
import { AdminRole } from "types/Admin";
import { formatBytes } from "utils/formatByte";

const avgOf = (arr) => {
	if (!Array.isArray(arr) || !arr.length) return 0;
	const vals = arr.map((e) => Number(e?.value ?? e ?? 0)).filter(Number.isFinite);
	return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
};

const peakOf = (arr) => {
	if (!Array.isArray(arr) || !arr.length) return 0;
	const vals = arr.map((e) => Number(e?.value ?? e ?? 0)).filter(Number.isFinite);
	return vals.length ? Math.max(...vals) : 0;
};

const formatDuration = (seconds) => {
	const s = Math.max(0, Math.floor(Number(seconds) || 0));
	if (!s) return "0m";
	const days = Math.floor(s / 86400);
	const hours = Math.floor((s % 86400) / 3600);
	const mins = Math.floor((s % 3600) / 60);
	const parts = [];
	if (days) parts.push(`${days}d`);
	if (hours) parts.push(`${hours}h`);
	if (mins || !parts.length) parts.push(`${mins}m`);
	return parts.join(" ");
};

const RingGauge = ({ percent = 0, size = 54, stroke = 4.5, label }) => {
	const pct = Math.min(100, Math.max(0, Number(percent) || 0));
	const r = (size - stroke) / 2;
	const c = 2 * Math.PI * r;
	const offset = c - (pct / 100) * c;
	return (
		<div className="relative flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
			<svg width={size} height={size} className="-rotate-90">
				<circle
					cx={size / 2}
					cy={size / 2}
					r={r}
					fill="none"
					stroke="currentColor"
					strokeWidth={stroke}
					className="text-surface-3"
				/>
				<circle
					cx={size / 2}
					cy={size / 2}
					r={r}
					fill="none"
					stroke="currentColor"
					strokeWidth={stroke}
					strokeLinecap="round"
					strokeDasharray={c}
					strokeDashoffset={offset}
					className="text-accent transition-all duration-300"
				/>
			</svg>
			<span className="absolute text-[11px] font-semibold text-ink tabular-nums">
				{label ?? `${Math.round(pct)}%`}
			</span>
		</div>
	);
};

const ResourceCard = ({
	icon: Icon,
	title,
	value,
	totalValue,
	percent = 0,
	badgeText,
	footerLeft,
	footerRight,
	subLine,
	nested = false,
}) => (
	<div
		className={`flex flex-col justify-between rounded-panel border border-hairline p-4 ${
			nested ? "bg-surface-2" : "bg-surface-1"
		}`}
	>
		<div className="flex items-center justify-between gap-2">
			<div className="flex items-center gap-2 text-xs font-medium text-ink-muted">
				<span className="flex h-6 w-6 items-center justify-center rounded-md border border-hairline bg-surface-2 text-accent">
					<Icon className="h-3.5 w-3.5" />
				</span>
				<span>{title}</span>
			</div>
			<Link
				to="/usage"
				className="rounded-md border border-hairline bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-ink-subtle transition-colors hover:border-hairline-strong hover:text-ink"
			>
				View history
			</Link>
		</div>

		<div className="my-3.5 flex items-center justify-between gap-3">
			<div className="min-w-0">
				<div className="flex items-baseline gap-1.5">
					<span className="text-xl font-semibold tracking-tight text-ink tabular-nums">{value}</span>
					{totalValue && (
						<span className="text-xs text-ink-tertiary tabular-nums">/ {totalValue}</span>
					)}
				</div>
				{badgeText && (
					<div className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-indigo-500/30 bg-accent-soft px-1.5 py-0.5 text-[10px] font-medium text-accent tabular-nums">
						{badgeText}
					</div>
				)}
				{subLine && <div className="mt-1 text-[11px] text-ink-tertiary tabular-nums">{subLine}</div>}
			</div>
			<RingGauge percent={percent} />
		</div>

		<div className="flex items-center justify-between border-t border-hairline pt-2 text-[11px] text-ink-tertiary tabular-nums">
			<span>{footerLeft}</span>
			<span>{footerRight}</span>
		</div>
	</div>
);

const UsersDonut = ({ total, active, limited, expired, onHold }) => {
	const size = 126;
	const stroke = 11;
	const r = (size - stroke) / 2;
	const c = 2 * Math.PI * r;
	const sum = Math.max(1, active + limited + expired + onHold);
	const segments = [
		{ value: active, color: "text-accent" },
		{ value: onHold, color: "text-sky-400" },
		{ value: limited, color: "text-amber-400" },
		{ value: expired, color: "text-red-400" },
	];

	let acc = 0;
	return (
		<div className="relative flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
			<svg width={size} height={size} className="-rotate-90">
				<circle
					cx={size / 2}
					cy={size / 2}
					r={r}
					fill="none"
					stroke="currentColor"
					strokeWidth={stroke}
					className="text-surface-3"
				/>
				{total > 0 &&
					segments.map((seg, idx) => {
						if (!seg.value) return null;
						const len = (seg.value / sum) * c;
						const dashOffset = -acc;
						acc += len;
						return (
							<circle
								key={idx}
								cx={size / 2}
								cy={size / 2}
								r={r}
								fill="none"
								stroke="currentColor"
								strokeWidth={stroke}
								strokeDasharray={`${len} ${c - len}`}
								strokeDashoffset={dashOffset}
								className={seg.color}
							/>
						);
					})}
			</svg>
			<div className="absolute text-center">
				<div className="text-2xl font-bold leading-none text-ink tabular-nums">{total}</div>
				<div className="mt-1 text-[10px] font-medium uppercase tracking-wider text-ink-tertiary">
					Total
				</div>
			</div>
		</div>
	);
};

const getAdaptiveRefreshMs = (data, latencyMs = 0, hasError = false) => {
	if (hasError || !data) return 5000;
	const cpu = Number(data.cpu_usage ?? 0);
	const mem = Number(data.memory?.percent ?? 0);
	const panelCpu = Number(data.panel_cpu_percent ?? 0);
	if (cpu >= 75 || mem >= 90 || panelCpu >= 50 || latencyMs >= 800) return 5000;
	if (cpu >= 45 || mem >= 75 || latencyMs >= 350) return 3000;
	if (cpu >= 20) return 2000;
	return 1500;
};

export const DashboardPage = () => {
	const { t } = useTranslation();
	const { userData, getUserIsSuccess } = useGetUser();
	const isPrivilegedAdmin =
		!getUserIsSuccess ||
		userData?.role === AdminRole.FullAccess ||
		userData?.role === AdminRole.Sudo;
	const [dashboardView, setDashboardView] = useState("system"); // system | analytics
	const showAnalytics = (getUserIsSuccess && !isPrivilegedAdmin) || dashboardView === "analytics";
	const [userScope, setUserScope] = useState("all"); // all | mine
	const latencyRef = useRef(0);

	const { data, isLoading, isFetching, isError, refetch } = useQuery(
		"dashboard-system-overview",
		async () => {
			const started = performance.now();
			const res = await fetch("/system");
			latencyRef.current = Math.round(performance.now() - started);
			return res;
		},
		{
			enabled: !showAnalytics,
			refetchInterval: (latest, query) =>
				getAdaptiveRefreshMs(latest, latencyRef.current, query?.state?.status === "error"),
			refetchIntervalInBackground: false,
			staleTime: 1000,
		},
	);

	const viewSwitcher = isPrivilegedAdmin ? (
		<div className="grid w-full grid-cols-2 rounded-lg border border-hairline bg-surface-2 p-0.5 sm:inline-flex sm:w-auto">
			<button
				type="button"
				onClick={() => setDashboardView("system")}
				className={`rounded-md px-2.5 py-1.5 text-center text-xs font-medium transition-colors sm:py-1 ${
					dashboardView === "system"
						? "bg-surface-3 text-ink shadow-sm"
						: "text-ink-subtle hover:text-ink"
				}`}
			>
				{t("dashboard.system.title", "System overview")}
			</button>
			<button
				type="button"
				onClick={() => setDashboardView("analytics")}
				className={`rounded-md px-2.5 py-1.5 text-center text-xs font-medium transition-colors sm:py-1 ${
					dashboardView === "analytics"
						? "bg-indigo-500/20 text-indigo-300 shadow-sm"
						: "text-ink-subtle hover:text-ink"
				}`}
			>
				{t("dashboard.analytics.tab", "Users analytics")}
			</button>
		</div>
	) : null;

	if (showAnalytics) {
		return (
			<div className="space-y-4">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div>
						<h1 className="text-lg font-semibold tracking-tight text-ink">
							{t("dashboard.analytics.title", "Dashboard")}
						</h1>
						<p className="mt-0.5 text-xs text-ink-subtle">
							{userData?.username
								? `${userData.username} · ${t("dashboard.analytics.subtitle", "Users & traffic overview")}`
								: t("dashboard.analytics.subtitle", "Users & traffic overview")}
						</p>
					</div>
					<div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
						{viewSwitcher}
						<DashboardHeaderActions />
					</div>
				</div>
				<AdminAnalyticsDashboard userData={userData} />
			</div>
		);
	}

	const refreshMs = getAdaptiveRefreshMs(data, latencyRef.current, isError);

	if (isLoading && !data) {
		return (
			<div className="flex h-64 items-center justify-center">
				<Spinner className="h-6 w-6" />
			</div>
		);
	}

	const cpuPct = Number(data?.cpu_usage ?? 0);
	const memPct = Number(data?.memory?.percent ?? 0);
	const swapPct = Number(data?.swap?.percent ?? 0);
	const diskPct = Number(data?.disk?.percent ?? 0);

	const cpuAvg = avgOf(data?.cpu_history);
	const cpuPeak = peakOf(data?.cpu_history);
	const memAvg = avgOf(data?.memory_history);
	const memPeak = peakOf(data?.memory_history);
	const swapAvg = avgOf(data?.swap_history);
	const swapPeak = peakOf(data?.swap_history);
	const diskFree = Math.max(0, (data?.disk?.total ?? 0) - (data?.disk?.current ?? 0));

	const panelCpuPct = Number(data?.panel_cpu_percent ?? 0);
	const panelCpuAvg = avgOf(data?.panel_cpu_history);
	const panelCpuPeak = peakOf(data?.panel_cpu_history);
	const appMemBytes = Number(data?.app_memory ?? 0);
	const totalMemBytes = Number(data?.memory?.total ?? 0);
	const panelMemPct = totalMemBytes > 0 ? (appMemBytes / totalMemBytes) * 100 : 0;

	const mine = userScope === "mine" && data?.my_users_overview ? data.my_users_overview : null;
	const totalUsers = mine ? mine.total_user ?? 0 : data?.total_user ?? 0;
	const activeUsers = mine ? mine.users_active ?? 0 : data?.users_active ?? 0;
	const onlineUsers = mine ? mine.online_users ?? 0 : data?.online_users ?? 0;
	const onHoldUsers = mine ? mine.users_on_hold ?? 0 : data?.users_on_hold ?? 0;
	const limitedUsers = mine ? mine.users_limited ?? 0 : data?.users_limited ?? 0;
	const expiredUsers = mine ? mine.users_expired ?? 0 : data?.users_expired ?? 0;

	const activePct = totalUsers > 0 ? ((activeUsers / totalUsers) * 100).toFixed(1) : "0.0";
	const onlinePct = totalUsers > 0 ? ((onlineUsers / totalUsers) * 100).toFixed(1) : "0.0";

	const adminOv = data?.admin_overview;

	return (
		<div className="space-y-4">
			{/* Top Overview Header */}
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="min-w-0">
					<h1 className="text-lg font-semibold tracking-tight text-ink">
						{t("dashboard.system.title", "System overview")}
					</h1>
					<div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-subtle">
						<span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap">
							<span className="h-2 w-2 rounded-full bg-emerald-400" />
							<span className="font-medium text-emerald-400">
								{data?.xray_running ? "Running" : "Active"}
							</span>
						</span>
						<span>·</span>
						<span className="max-w-[170px] truncate sm:max-w-none">{data?.os || "Dark Panel"}</span>
						<span>·</span>
						<span className="shrink-0 whitespace-nowrap font-mono text-[11px]">v{data?.version || "1.6.0"}</span>
						<span>·</span>
						<span className="shrink-0 whitespace-nowrap font-mono text-[11px] text-ink-tertiary tabular-nums">
							Auto {(refreshMs / 1000).toFixed(1).replace(/\.0$/, "")}s
						</span>
					</div>
				</div>

				<div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
					{viewSwitcher}
					<DashboardHeaderActions />
				</div>
			</div>

			{/* 4 System Resource Cards */}
			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
				<ResourceCard
					icon={CpuChipIcon}
					title={t("dashboard.system.cpuUsage", "CPU usage")}
					value={`${cpuPct.toFixed(1)}%`}
					percent={cpuPct}
					badgeText={`${data?.cpu_cores ?? 0} Core`}
					subLine={
						Array.isArray(data?.load_average) && data.load_average.length
							? `Load: ${data.load_average.map((n) => Number(n).toFixed(2)).join(" · ")}`
							: undefined
					}
					footerLeft={`• Avg: ${cpuAvg.toFixed(1)}%`}
					footerRight={`• Peak: ${cpuPeak.toFixed(1)}%`}
				/>
				<ResourceCard
					icon={ServerStackIcon}
					title={t("dashboard.system.memoryUsage", "Memory usage")}
					value={formatBytes(data?.memory?.current ?? 0)}
					totalValue={formatBytes(data?.memory?.total ?? 0)}
					percent={memPct}
					badgeText={`${memPct.toFixed(1)}%`}
					footerLeft={`• Avg: ${memAvg.toFixed(1)}%`}
					footerRight={`• Peak: ${memPeak.toFixed(1)}%`}
				/>
				<ResourceCard
					icon={CircleStackIcon}
					title={t("dashboard.system.swapUsage", "Swap usage")}
					value={formatBytes(data?.swap?.current ?? 0)}
					totalValue={formatBytes(data?.swap?.total ?? 0)}
					percent={swapPct}
					badgeText={`${swapPct.toFixed(0)}%`}
					footerLeft={`• Avg: ${swapAvg.toFixed(0)}%`}
					footerRight={`• Peak: ${swapPeak.toFixed(0)}%`}
				/>
				<ResourceCard
					icon={CircleStackIcon}
					title={t("dashboard.system.diskUsage", "Disk usage")}
					value={formatBytes(data?.disk?.current ?? 0)}
					totalValue={formatBytes(data?.disk?.total ?? 0)}
					percent={diskPct}
					badgeText={`${diskPct.toFixed(1)}%`}
					footerLeft={`• Free: ${formatBytes(diskFree)}`}
					footerRight={`• Used: ${Math.round(diskPct)}%`}
				/>
			</div>

			{/* Bandwidth Speed + Uptime */}
			<div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
				<Card className="p-4">
					<div className="mb-3 flex items-center justify-between">
						<div className="flex items-center gap-2 text-xs font-semibold text-ink">
							<span className="flex h-6 w-6 items-center justify-center rounded-md border border-hairline bg-surface-2 text-accent">
								<SignalIcon className="h-3.5 w-3.5" />
							</span>
							<span>{t("dashboard.system.bandwidthSpeed", "Bandwidth speed")}</span>
						</div>
						<Link
							to="/usage"
							className="rounded-md border border-hairline bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-ink-subtle hover:border-hairline-strong hover:text-ink"
						>
							View history
						</Link>
					</div>
					<div className="space-y-2.5">
						<div className="flex items-center justify-between rounded-lg border border-hairline bg-surface-2 px-3 py-2.5">
							<div className="flex items-center gap-2.5">
								<span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-400">
									<ArrowDownTrayIcon className="h-4 w-4" />
								</span>
								<div>
									<div className="text-xs font-medium text-ink">Incoming speed</div>
									<div className="text-[11px] text-ink-tertiary tabular-nums">
										Total: {formatBytes(data?.incoming_bandwidth ?? 0)}
									</div>
								</div>
							</div>
							<span className="text-sm font-semibold text-ink tabular-nums">
								{formatBytes(data?.incoming_bandwidth_speed ?? 0)}/s
							</span>
						</div>
						<div className="flex items-center justify-between rounded-lg border border-hairline bg-surface-2 px-3 py-2.5">
							<div className="flex items-center gap-2.5">
								<span className="flex h-7 w-7 items-center justify-center rounded-md bg-sky-500/10 text-sky-400">
									<ArrowUpTrayIcon className="h-4 w-4" />
								</span>
								<div>
									<div className="text-xs font-medium text-ink">Outgoing speed</div>
									<div className="text-[11px] text-ink-tertiary tabular-nums">
										Total: {formatBytes(data?.outgoing_bandwidth ?? 0)}
									</div>
								</div>
							</div>
							<span className="text-sm font-semibold text-ink tabular-nums">
								{formatBytes(data?.outgoing_bandwidth_speed ?? 0)}/s
							</span>
						</div>
					</div>
				</Card>

				<Card className="p-4">
					<div className="mb-3 flex items-center justify-between">
						<div className="flex items-center gap-2 text-xs font-semibold text-ink">
							<span className="flex h-6 w-6 items-center justify-center rounded-md border border-hairline bg-surface-2 text-accent">
								<ClockIcon className="h-3.5 w-3.5" />
							</span>
							<span>{t("dashboard.system.uptime", "Uptime")}</span>
						</div>
						<span className="text-[11px] text-ink-tertiary">
							Xray {data?.xray_version || "-"}
						</span>
					</div>
					<div className="space-y-2.5">
						<div className="flex items-center justify-between rounded-lg border border-hairline bg-surface-2 px-3 py-2.5">
							<div className="flex items-center gap-2.5">
								<span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-400">
									<ServerStackIcon className="h-4 w-4" />
								</span>
								<span className="text-xs font-medium text-ink">System uptime</span>
							</div>
							<span className="text-sm font-semibold text-ink tabular-nums">
								{formatDuration(data?.uptime_seconds)}
							</span>
						</div>
						<div className="flex items-center justify-between rounded-lg border border-hairline bg-surface-2 px-3 py-2.5">
							<div className="flex items-center gap-2.5">
								<span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-soft text-accent">
									<CpuChipIcon className="h-4 w-4" />
								</span>
								<span className="text-xs font-medium text-ink">Panel uptime</span>
							</div>
							<span className="text-sm font-semibold text-ink tabular-nums">
								{formatDuration(data?.panel_uptime_seconds)}
							</span>
						</div>
					</div>
				</Card>
			</div>

			{/* Panel Usage Stats */}
			<Card className="p-4">
				<div className="mb-3 flex items-center justify-between">
					<div className="flex items-center gap-2 text-xs font-semibold text-ink">
						<span className="flex h-6 w-6 items-center justify-center rounded-md border border-hairline bg-surface-2 text-accent">
							<CpuChipIcon className="h-3.5 w-3.5" />
						</span>
						<span>Panel Usage Stats</span>
					</div>
					<span className="text-[11px] text-ink-tertiary tabular-nums">
						Total Traffic: {formatBytes(data?.panel_total_bandwidth ?? 0)}
					</span>
				</div>
				<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
					<ResourceCard
						nested
						icon={CpuChipIcon}
						title="CPU usage (Panel)"
						value={`${panelCpuPct.toFixed(1)}%`}
						percent={panelCpuPct}
						badgeText={`${data?.app_threads ?? 0} Thread`}
						footerLeft={`• Avg: ${panelCpuAvg.toFixed(1)}%`}
						footerRight={`• Peak: ${panelCpuPeak.toFixed(1)}%`}
					/>
					<ResourceCard
						nested
						icon={ServerStackIcon}
						title="Memory usage (Panel)"
						value={formatBytes(appMemBytes)}
						totalValue={formatBytes(totalMemBytes)}
						percent={panelMemPct}
						badgeText={`${panelMemPct.toFixed(1)}%`}
						footerLeft={`• Process RSS`}
						footerRight={`• System: ${formatBytes(totalMemBytes)}`}
					/>
				</div>
			</Card>

			{/* Bottom Row: Users Overview + Admin Overview */}
			<div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
				<Card className="p-4">
					<div className="mb-4 flex items-center justify-between gap-2">
						<div className="flex items-center gap-2 text-xs font-semibold text-ink">
							<span className="flex h-6 w-6 items-center justify-center rounded-md border border-hairline bg-surface-2 text-accent">
								<UserGroupIcon className="h-3.5 w-3.5" />
							</span>
							<span>Users overview</span>
						</div>
						{data?.my_users_overview && (
							<div className="inline-flex rounded-lg border border-hairline bg-surface-2 p-0.5 text-[11px]">
								<button
									type="button"
									onClick={() => setUserScope("all")}
									className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
										userScope === "all"
											? "bg-accent text-white"
											: "text-ink-subtle hover:text-ink"
									}`}
								>
									All Users
								</button>
								<button
									type="button"
									onClick={() => setUserScope("mine")}
									className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
										userScope === "mine"
											? "bg-accent text-white"
											: "text-ink-subtle hover:text-ink"
									}`}
								>
									My Users
								</button>
							</div>
						)}
					</div>

					<div className="flex flex-col items-center gap-5 sm:flex-row">
						<UsersDonut
							total={totalUsers}
							active={activeUsers}
							limited={limitedUsers}
							expired={expiredUsers}
							onHold={onHoldUsers}
						/>
						<div className="w-full flex-1 space-y-2 text-xs">
							<div className="flex items-center justify-between">
								<span className="flex items-center gap-2 text-ink-muted">
									<span className="h-2 w-2 rounded-full bg-accent" />
									Total
								</span>
								<span className="font-semibold text-ink tabular-nums">{totalUsers}</span>
							</div>
							<div className="flex items-center justify-between">
								<span className="flex items-center gap-2 text-ink-muted">
									<span className="h-2 w-2 rounded-full bg-emerald-400" />
									Active
									<span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-400 tabular-nums">
										{activePct}%
									</span>
								</span>
								<span className="font-semibold text-ink tabular-nums">{activeUsers}</span>
							</div>
							<div className="flex items-center justify-between">
								<span className="flex items-center gap-2 text-ink-muted">
									<span className="h-2 w-2 rounded-full bg-sky-400" />
									Online
									<span className="rounded bg-sky-500/10 px-1.5 py-0.5 text-[10px] text-sky-400 tabular-nums">
										{onlinePct}%
									</span>
								</span>
								<span className="font-semibold text-ink tabular-nums">{onlineUsers}</span>
							</div>
							<div className="flex items-center justify-between">
								<span className="flex items-center gap-2 text-ink-muted">
									<span className="h-2 w-2 rounded-full bg-indigo-400" />
									On Hold
								</span>
								<span className="font-semibold text-ink tabular-nums">{onHoldUsers}</span>
							</div>
							<div className="flex items-center justify-between">
								<span className="flex items-center gap-2 text-ink-muted">
									<span className="h-2 w-2 rounded-full bg-amber-400" />
									Limited
								</span>
								<span className="font-semibold text-ink tabular-nums">{limitedUsers}</span>
							</div>
							<div className="flex items-center justify-between">
								<span className="flex items-center gap-2 text-ink-muted">
									<span className="h-2 w-2 rounded-full bg-red-400" />
									Expired
								</span>
								<span className="font-semibold text-ink tabular-nums">{expiredUsers}</span>
							</div>
						</div>
					</div>
				</Card>

				<Card className="p-4">
					<div className="mb-4 flex items-center justify-between">
						<div className="flex items-center gap-2 text-xs font-semibold text-ink">
							<span className="flex h-6 w-6 items-center justify-center rounded-md border border-hairline bg-surface-2 text-accent">
								<ShieldCheckIcon className="h-3.5 w-3.5" />
							</span>
							<span>Admin overview</span>
						</div>
						<Link
							to="/admins"
							className="text-[11px] font-medium text-accent hover:underline"
						>
							Manage admins
						</Link>
					</div>

					<div className="grid grid-cols-3 gap-2.5">
						<div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3">
							<div className="flex items-center gap-1.5 text-[11px] text-ink-subtle">
								<span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
								<span className="truncate">Full-access</span>
							</div>
							<div className="mt-2 text-lg font-semibold text-ink tabular-nums">
								{adminOv?.full_access_admins ?? 0}
							</div>
						</div>
						<div className="rounded-lg border border-indigo-500/30 bg-accent-soft p-3">
							<div className="flex items-center gap-1.5 text-[11px] text-ink-subtle">
								<span className="h-1.5 w-1.5 rounded-full bg-accent" />
								<span className="truncate">Sudo admins</span>
							</div>
							<div className="mt-2 text-lg font-semibold text-ink tabular-nums">
								{adminOv?.sudo_admins ?? 0}
							</div>
						</div>
						<div className="rounded-lg border border-sky-500/25 bg-sky-500/5 p-3">
							<div className="flex items-center gap-1.5 text-[11px] text-ink-subtle">
								<span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
								<span className="truncate">Standard</span>
							</div>
							<div className="mt-2 text-lg font-semibold text-ink tabular-nums">
								{adminOv?.standard_admins ?? 0}
							</div>
						</div>
					</div>

					<div className="mt-3 flex items-center justify-between rounded-lg border border-hairline bg-surface-2 px-3 py-2 text-xs">
						<span className="flex items-center gap-2 text-ink-muted">
							<span className="h-2 w-2 rounded-full bg-accent" />
							Total admins
						</span>
						<span className="font-semibold text-ink tabular-nums">
							{adminOv?.total_admins ?? 0}
						</span>
					</div>

					<div className="mt-2.5 flex items-center justify-between rounded-lg border border-indigo-500/30 bg-accent-soft px-3 py-2.5">
						<div>
							<div className="text-[10px] uppercase tracking-wider text-ink-tertiary">
								Top admin
							</div>
							<div className="text-sm font-semibold text-ink">
								{adminOv?.top_admin_username || "admin"}
							</div>
						</div>
						<span className="rounded-md border border-indigo-500/30 bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent tabular-nums">
							{formatBytes(adminOv?.top_admin_usage ?? 0)}
						</span>
					</div>
				</Card>
			</div>
		</div>
	);
};

export default DashboardPage;
