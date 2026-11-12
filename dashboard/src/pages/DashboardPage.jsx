import {
	ArrowPathIcon,
	CpuChipIcon,
	ServerStackIcon,
	SignalIcon,
	UsersIcon,
} from "@heroicons/react/24/outline";
import { useTranslation } from "react-i18next";
import { useQuery } from "react-query";
import { Link } from "react-router-dom";
import { Badge, Button, Card, Spinner } from "components/linear/UI";
import { fetch } from "service/http";
import { formatBytes } from "utils/formatByte";

const StatCard = ({ label, value, sub, badge, badgeVariant = "neutral" }) => (
	<Card className="p-4">
		<div className="flex items-center justify-between gap-2">
			<span className="text-xs font-medium text-ink-subtle">{label}</span>
			{badge && <Badge variant={badgeVariant}>{badge}</Badge>}
		</div>
		<div className="mt-2 text-2xl font-semibold tracking-tight text-ink tabular-nums">
			{value}
		</div>
		{sub && <div className="mt-1 text-xs text-ink-tertiary tabular-nums">{sub}</div>}
	</Card>
);

const ProgressRow = ({ label, value, percent, detail }) => (
	<div className="space-y-1.5">
		<div className="flex items-center justify-between text-xs">
			<span className="font-medium text-ink-muted">{label}</span>
			<span className="text-ink-subtle tabular-nums">{value}</span>
		</div>
		<div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
			<div
				className="h-full rounded-full bg-accent transition-all"
				style={{ width: `${Math.min(100, Math.max(0, Number(percent) || 0))}%` }}
			/>
		</div>
		{detail && <div className="text-[11px] text-ink-tertiary tabular-nums">{detail}</div>}
	</div>
);

export const DashboardPage = () => {
	const { t } = useTranslation();
	const { data, isLoading, isFetching, refetch } = useQuery(
		"dashboard-system-overview",
		() => fetch("/system"),
		{
			refetchInterval: 10000,
			staleTime: 5000,
		},
	);

	if (isLoading && !data) {
		return (
			<div className="flex h-64 items-center justify-center">
				<Spinner className="h-6 w-6" />
			</div>
		);
	}

	const totalUsers = data?.total_user ?? 0;
	const activeUsers = data?.users_active ?? 0;
	const onlineUsers = data?.online_users ?? 0;
	const expiredOrLimited = (data?.users_expired ?? 0) + (data?.users_limited ?? 0);
	const totalTraffic = formatBytes(data?.panel_total_bandwidth ?? 0);
	const cpuPct = Math.round(data?.cpu_usage ?? 0);
	const memPct = Math.round(data?.memory?.percent ?? 0);
	const diskPct = Math.round(data?.disk?.percent ?? 0);

	return (
		<div className="space-y-5">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h1 className="text-lg font-semibold tracking-tight text-ink">
						{t("dashboard") || "Dashboard"}
					</h1>
					<p className="text-xs text-ink-subtle">
						{data?.os || "Rebecca Control Plane"} · v{data?.version || "1.6.0"}
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Button size="sm" onClick={() => void refetch()} loading={isFetching}>
						<ArrowPathIcon className="h-3.5 w-3.5" />
						<span>{t("refresh") || "Refresh"}</span>
					</Button>
					<Link to="/users">
						<Button variant="primary" size="sm">
							<UsersIcon className="h-3.5 w-3.5" />
							<span>{t("users") || "Users"}</span>
						</Button>
					</Link>
				</div>
			</div>

			<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
				<StatCard
					label={t("statistics.totalUsers") || "Total Users"}
					value={totalUsers}
					sub={`${totalTraffic} ${t("total") || "total usage"}`}
					badge={data?.admin_overview ? `${data.admin_overview.total_admins} admins` : undefined}
				/>
				<StatCard
					label={t("statistics.activeUsers") || "Active Users"}
					value={activeUsers}
					sub={`${totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100) : 0}% of total`}
					badgeVariant="success"
					badge={t("active") || "Active"}
				/>
				<StatCard
					label={t("statistics.onlineUsers") || "Online Users"}
					value={onlineUsers}
					sub={`↑ ${formatBytes(data?.online_users_upload_speed ?? 0)}/s · ↓ ${formatBytes(data?.online_users_download_speed ?? 0)}/s`}
					badgeVariant={onlineUsers > 0 ? "success" : "neutral"}
					badge={onlineUsers > 0 ? "Live" : "Idle"}
				/>
				<StatCard
					label={t("statistics.limitedExpired") || "Expired / Limited"}
					value={expiredOrLimited}
					sub={`${data?.users_expired ?? 0} expired · ${data?.users_limited ?? 0} limited`}
					badgeVariant={expiredOrLimited > 0 ? "warning" : "neutral"}
				/>
			</div>

			<div className="grid gap-4 lg:grid-cols-2">
				<Card className="p-4 sm:p-5">
					<div className="mb-4 flex items-center justify-between">
						<div className="flex items-center gap-2">
							<CpuChipIcon className="h-4 w-4 text-accent" />
							<h2 className="text-sm font-semibold text-ink">
								{t("statistics.systemResources") || "System Resources"}
							</h2>
						</div>
						<Badge variant={data?.xray_running ? "success" : "neutral"}>
							{data?.xray_running
								? `Xray ${data?.xray_version || "Running"}`
								: "Xray Stopped"}
						</Badge>
					</div>
					<div className="space-y-4">
						<ProgressRow
							label="CPU"
							value={`${cpuPct}%`}
							percent={cpuPct}
							detail={`${data?.cpu_cores ?? 0} cores / ${data?.cpu_threads ?? 0} threads · Panel ${(data?.panel_cpu_percent ?? 0).toFixed(1)}%`}
						/>
						<ProgressRow
							label="Memory"
							value={`${memPct}%`}
							percent={memPct}
							detail={`${formatBytes(data?.memory?.current ?? 0)} / ${formatBytes(data?.memory?.total ?? 0)} · Panel ${formatBytes(data?.app_memory ?? 0)}`}
						/>
						<ProgressRow
							label="Disk"
							value={`${diskPct}%`}
							percent={diskPct}
							detail={`${formatBytes(data?.disk?.current ?? 0)} / ${formatBytes(data?.disk?.total ?? 0)}`}
						/>
					</div>
				</Card>

				<Card className="p-4 sm:p-5">
					<div className="mb-4 flex items-center justify-between">
						<div className="flex items-center gap-2">
							<SignalIcon className="h-4 w-4 text-accent" />
							<h2 className="text-sm font-semibold text-ink">
								{t("statistics.networkTraffic") || "Bandwidth & Traffic"}
							</h2>
						</div>
						<span className="text-xs text-ink-tertiary tabular-nums">
							{totalTraffic}
						</span>
					</div>
					<div className="grid grid-cols-2 gap-3">
						<div className="rounded-lg border border-hairline bg-surface-2 p-3">
							<div className="text-[11px] text-ink-subtle">Incoming</div>
							<div className="mt-1 text-base font-semibold text-ink tabular-nums">
								{formatBytes(data?.incoming_bandwidth ?? 0)}
							</div>
							<div className="mt-0.5 text-[11px] text-ink-tertiary tabular-nums">
								{formatBytes(data?.incoming_bandwidth_speed ?? 0)}/s
							</div>
						</div>
						<div className="rounded-lg border border-hairline bg-surface-2 p-3">
							<div className="text-[11px] text-ink-subtle">Outgoing</div>
							<div className="mt-1 text-base font-semibold text-ink tabular-nums">
								{formatBytes(data?.outgoing_bandwidth ?? 0)}
							</div>
							<div className="mt-0.5 text-[11px] text-ink-tertiary tabular-nums">
								{formatBytes(data?.outgoing_bandwidth_speed ?? 0)}/s
							</div>
						</div>
					</div>
					<div className="mt-4 flex flex-wrap gap-2 border-t border-hairline pt-3">
						<Link to="/users">
							<Button size="xs">
								<UsersIcon className="h-3.5 w-3.5" />
								<span>Manage Users</span>
							</Button>
						</Link>
						<Link to="/node-settings">
							<Button size="xs">
								<ServerStackIcon className="h-3.5 w-3.5" />
								<span>Nodes</span>
							</Button>
						</Link>
						<Link to="/xray-settings">
							<Button size="xs">
								<CpuChipIcon className="h-3.5 w-3.5" />
								<span>Core Settings</span>
							</Button>
						</Link>
					</div>
				</Card>
			</div>
		</div>
	);
};

export default DashboardPage;
