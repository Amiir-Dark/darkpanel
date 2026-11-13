import {
	ArrowTrendingUpIcon,
	ClockIcon,
	ExclamationTriangleIcon,
	SignalIcon,
	UsersIcon,
} from "@heroicons/react/24/outline";
import { Badge, Card, Spinner } from "components/linear/UI";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { useMemo, useState } from "react";

dayjs.extend(utc);
import { useTranslation } from "react-i18next";
import { useQuery } from "react-query";
import { Link as RouterLink } from "react-router-dom";
import { fetch as apiFetch } from "service/http";
import { formatBytes } from "utils/formatByte";

const DAY_SECONDS = 86400;

const parseClientApp = (ua = "") => {
	const v = String(ua || "").toLowerCase();
	if (!v.trim()) return "No app yet";
	if (v.includes("v2rayng")) return "v2rayNG";
	if (v.includes("happ")) return "Happ";
	if (v.includes("v2rayn")) return "v2rayN";
	if (v.includes("clash") || v.includes("mihomo") || v.includes("stash")) return "Clash";
	if (v.includes("hiddify")) return "Hiddify";
	if (v.includes("shadowrocket")) return "Shadowrocket";
	if (v.includes("streisand")) return "Streisand";
	if (v.includes("nekobox") || v.includes("nekoray")) return "NekoBox";
	return "Other app";
};

const SmoothSparkline = ({ values = [], color = "#6366f1", id = "spark" }) => {
	const width = 260;
	const height = 56;
	const padX = 6;
	const padY = 8;
	const safe = values.length ? values : [0, 0, 0, 0, 0, 0, 0];
	const max = Math.max(1, ...safe);
	const stepX = safe.length > 1 ? (width - padX * 2) / (safe.length - 1) : 0;

	const pts = safe.map((v, i) => ({
		x: padX + i * stepX,
		y: height - padY - (v / max) * (height - padY * 2),
	}));

	let path = "";
	if (pts.length > 0) {
		path = `M ${pts[0].x} ${pts[0].y}`;
		for (let i = 0; i < pts.length - 1; i++) {
			const cx = (pts[i].x + pts[i + 1].x) / 2;
			path += ` C ${cx} ${pts[i].y}, ${cx} ${pts[i + 1].y}, ${pts[i + 1].x} ${pts[i + 1].y}`;
		}
	}

	const area = pts.length
		? `${path} L ${pts[pts.length - 1].x} ${height} L ${pts[0].x} ${height} Z`
		: "";

	return (
		<svg viewBox={`0 0 ${width} ${height}`} className="h-14 w-full overflow-visible">
			<defs>
				<linearGradient id={`grad-${id}`} x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stopColor={color} stopOpacity="0.28" />
					<stop offset="100%" stopColor={color} stopOpacity="0" />
				</linearGradient>
			</defs>
			{area && <path d={area} fill={`url(#grad-${id})`} />}
			{path && (
				<path
					d={path}
					fill="none"
					stroke={color}
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			)}
			{pts.length > 0 && (
				<circle
					cx={pts[pts.length - 1].x}
					cy={pts[pts.length - 1].y}
					r="3"
					fill={color}
					className="drop-shadow"
				/>
			)}
		</svg>
	);
};

const SegmentedBarCard = ({ title, percent, subtitle, segments = [] }) => {
	const total = segments.reduce((acc, s) => acc + s.value, 0);
	return (
		<Card className="p-4">
			<div className="flex flex-wrap items-baseline justify-between gap-2">
				<div className="flex items-baseline gap-2.5">
					<span className="text-xl font-bold tracking-tight text-ink tabular-nums">
						{percent}%
					</span>
					<span className="text-xs font-medium text-ink-subtle">{subtitle}</span>
				</div>
				<span className="text-[11px] font-medium uppercase tracking-wider text-ink-tertiary">
					{title}
				</span>
			</div>

			<div className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
				{total > 0 ? (
					segments
						.filter((s) => s.value > 0)
						.map((seg) => (
							<div
								key={seg.label}
								title={`${seg.label}: ${seg.displayValue ?? seg.value}`}
								style={{
									width: `${(seg.value / total) * 100}%`,
									backgroundColor: seg.color,
								}}
								className="h-full transition-all duration-300 first:rounded-l-full last:rounded-r-full"
							/>
						))
				) : (
					<div className="h-full w-full bg-white/[0.04]" />
				)}
			</div>

			<div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
				{segments.map((seg) => (
					<div key={seg.label} className="inline-flex items-center gap-1.5 text-xs">
						<span
							className="h-2 w-2 rounded-full shrink-0"
							style={{ backgroundColor: seg.color }}
						/>
						<span className="text-ink-subtle">{seg.label}</span>
						<span className="font-semibold text-ink tabular-nums">
							{seg.displayValue ?? seg.value}
						</span>
					</div>
				))}
			</div>
		</Card>
	);
};

export const AdminAnalyticsDashboard = ({ userData }) => {
	const { t } = useTranslation();
	const [usageDays, setUsageDays] = useState(7);

	const { data: usersResponse, isLoading: isUsersLoading } = useQuery(
		["admin-analytics-users", userData?.username],
		() => apiFetch("/users", { query: { offset: 0, limit: 2000 } }),
		{ staleTime: 30_000, refetchOnWindowFocus: false },
	);

	const { data: dailyUsageResponse, isLoading: isUsageLoading } = useQuery(
		["admin-analytics-usage", userData?.username, usageDays],
		async () => {
			if (!userData?.username) return { usages: [] };
			const end = dayjs().endOf("day").utc().format("YYYY-MM-DDTHH:mm:ss[Z]");
			const start = dayjs()
				.subtract(usageDays - 1, "day")
				.startOf("day")
				.utc()
				.format("YYYY-MM-DDTHH:mm:ss[Z]");
			return apiFetch(`/admin/${encodeURIComponent(userData.username)}/usage/daily`, {
				query: { start, end },
			});
		},
		{
			enabled: Boolean(userData?.username),
			staleTime: 30_000,
			refetchOnWindowFocus: false,
		},
	);

	const analytics = useMemo(() => {
		const users = Array.isArray(usersResponse?.users) ? usersResponse.users : [];
		const now = dayjs();
		const nowUnix = now.unix();
		const todayStart = now.startOf("day").unix();

		const dayBuckets = Array.from({ length: 7 }, (_, i) => {
			const d = now.subtract(6 - i, "day");
			return {
				label: d.format("ddd"),
				start: d.startOf("day").unix(),
				end: d.endOf("day").unix(),
				created: 0,
				expired: 0,
				limited: 0,
			};
		});

		let prevWeekCreated = 0;
		let prevWeekExpired = 0;
		let prevWeekLimited = 0;
		const prevWeekStart = now.subtract(13, "day").startOf("day").unix();
		const prevWeekEnd = now.subtract(7, "day").endOf("day").unix();

		const counts = {
			active: 0,
			limited: 0,
			expired: 0,
			on_hold: 0,
			disabled: 0,
		};

		let onlineCount = 0;
		let totalUsedTraffic = 0;
		let totalDataLimit = 0;

		const lastSeen = {
			today: 0,
			week: 0,
			month: 0,
			older: 0,
		};

		const appMap = new Map();
		const expiredOrLimitedToday = [];
		const lowOnResources = [];

		users.forEach((u) => {
			const status = String(u.status || "active").toLowerCase();
			if (status in counts) counts[status] += 1;
			else counts.active += 1;

			const createdUnix = u.created_at ? dayjs(u.created_at).unix() : 0;
			const expireUnix = Number(u.expire || 0);
			const onlineUnix = u.online_at ? dayjs(u.online_at).unix() : 0;
			const used = Number(u.used_traffic || 0);
			const limit = Number(u.data_limit || 0);

			totalUsedTraffic += used;
			if (limit > 0) totalDataLimit += limit;

			if (onlineUnix > 0 && nowUnix - onlineUnix <= 300) {
				onlineCount += 1;
			}

			// Last seen buckets
			if (onlineUnix >= todayStart) lastSeen.today += 1;
			else if (onlineUnix >= nowUnix - 7 * DAY_SECONDS) lastSeen.week += 1;
			else if (onlineUnix >= nowUnix - 30 * DAY_SECONDS) lastSeen.month += 1;
			else lastSeen.older += 1;

			// Client app distribution
			const app = parseClientApp(u.sub_last_user_agent);
			appMap.set(app, (appMap.get(app) || 0) + 1);

			// Weekly sparkline buckets
			dayBuckets.forEach((b) => {
				if (createdUnix >= b.start && createdUnix <= b.end) b.created += 1;
				if (expireUnix >= b.start && expireUnix <= b.end && status === "expired") b.expired += 1;
				if (status === "limited" && onlineUnix >= b.start && onlineUnix <= b.end) b.limited += 1;
			});

			if (createdUnix >= prevWeekStart && createdUnix <= prevWeekEnd) prevWeekCreated += 1;
			if (expireUnix >= prevWeekStart && expireUnix <= prevWeekEnd && status === "expired") {
				prevWeekExpired += 1;
			}
			if (status === "limited" && onlineUnix >= prevWeekStart && onlineUnix <= prevWeekEnd) {
				prevWeekLimited += 1;
			}

			// Attention lists
			if (status === "limited" || (status === "expired" && expireUnix >= todayStart)) {
				expiredOrLimitedToday.push({
					username: u.username,
					status,
				});
			}

			if (status === "active") {
				const secondsLeft = expireUnix > 0 ? expireUnix - nowUnix : Infinity;
				const bytesLeft = limit > 0 ? Math.max(0, limit - used) : Infinity;
				const lowTime = secondsLeft > 0 && secondsLeft <= 5 * DAY_SECONDS;
				const lowVol =
					limit > 0 && (bytesLeft <= 2 * 1024 * 1024 * 1024 || bytesLeft / limit <= 0.15);

				if (lowTime || lowVol) {
					lowOnResources.push({
						username: u.username,
						lowTime,
						lowVol,
						secondsLeft,
						bytesLeft,
						label: lowVol
							? `${formatBytes(bytesLeft)} left`
							: `${Math.max(1, Math.ceil(secondsLeft / DAY_SECONDS))}d left`,
					});
				}
			}
		});

		const total = users.length;
		const activePct = total > 0 ? ((counts.active / total) * 100).toFixed(1) : "0.0";
		const available = counts.active + counts.on_hold;
		const unavailable = total - available;
		const availablePct = total > 0 ? ((available / total) * 100).toFixed(1) : "0.0";

		const onAppCount = total - (appMap.get("No app yet") || 0);
		const onAppPct = total > 0 ? ((onAppCount / total) * 100).toFixed(1) : "0.0";

		const trafficPct =
			totalDataLimit > 0
				? Math.min(100, (totalUsedTraffic / totalDataLimit) * 100).toFixed(1)
				: "0.0";
		const remainingTraffic = Math.max(0, totalDataLimit - totalUsedTraffic);

		const appPalette = {
			v2rayNG: "#10b981",
			Happ: "#f59e0b",
			v2rayN: "#6366f1",
			Clash: "#ec4899",
			Hiddify: "#06b6d4",
			Shadowrocket: "#8b5cf6",
			Streisand: "#14b8a6",
			NekoBox: "#3b82f6",
			"Other app": "#64748b",
			"No app yet": "#3f3f46",
		};

		const appSegments = Array.from(appMap.entries())
			.sort((a, b) => b[1] - a[1])
			.map(([label, value]) => ({
				label,
				value,
				color: appPalette[label] || "#6366f1",
			}));

		return {
			total,
			onlineCount,
			counts,
			activePct,
			available,
			unavailable,
			availablePct,
			onAppCount,
			onAppPct,
			appSegments,
			totalUsedTraffic,
			totalDataLimit,
			remainingTraffic,
			trafficPct,
			dayBuckets,
			thisWeekCreated: dayBuckets.reduce((a, b) => a + b.created, 0),
			prevWeekCreated,
			thisWeekExpired: dayBuckets.reduce((a, b) => a + b.expired, 0),
			prevWeekExpired,
			thisWeekLimited: dayBuckets.reduce((a, b) => a + b.limited, 0),
			prevWeekLimited,
			lastSeen,
			expiredOrLimitedToday: expiredOrLimitedToday.slice(0, 6),
			lowOnResources: lowOnResources.slice(0, 6),
			lowTimeCount: lowOnResources.filter((r) => r.lowTime).length,
			lowVolCount: lowOnResources.filter((r) => r.lowVol).length,
		};
	}, [usersResponse]);

	const dailyChart = useMemo(() => {
		const raw = Array.isArray(dailyUsageResponse?.usages) ? dailyUsageResponse.usages : [];
		const byDate = new Map();
		raw.forEach((entry) => {
			const key = String(entry?.date || "").slice(0, 10);
			if (key) byDate.set(key, (byDate.get(key) || 0) + Number(entry?.usage || 0));
		});

		const days = Array.from({ length: usageDays }, (_, i) => {
			const d = dayjs().subtract(usageDays - 1 - i, "day");
			const key = d.format("YYYY-MM-DD");
			return {
				key,
				label: d.format("MM/DD"),
				usage: byDate.get(key) || 0,
			};
		});

		const total = days.reduce((a, b) => a + b.usage, 0);
		const avg = days.length > 0 ? total / days.length : 0;
		const max = Math.max(1, ...days.map((d) => d.usage));

		return { days, total, avg, max };
	}, [dailyUsageResponse, usageDays]);

	if (isUsersLoading && !usersResponse) {
		return (
			<div className="flex h-64 items-center justify-center">
				<Spinner className="h-6 w-6" />
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{/* Top 3 Weekly Sparkline Cards */}
			<div className="grid grid-cols-1 gap-3 md:grid-cols-3">
				{[
					{
						id: "created",
						leftTitle: t("dashboard.analytics.thisWeekUsers", "This week users"),
						leftVal: `+${analytics.thisWeekCreated}`,
						rightTitle: t("dashboard.analytics.lastWeekUsers", "Last week"),
						rightVal: `+${analytics.prevWeekCreated}`,
						values: analytics.dayBuckets.map((d) => d.created),
						color: "#6366f1",
						accentBorder: "border-l-indigo-500",
					},
					{
						id: "expired",
						leftTitle: t("dashboard.analytics.thisWeekExpired", "This week expired"),
						leftVal: `+${analytics.thisWeekExpired}`,
						rightTitle: t("dashboard.analytics.lastWeekExpired", "Last week"),
						rightVal: `+${analytics.prevWeekExpired}`,
						values: analytics.dayBuckets.map((d) => d.expired),
						color: "#a855f7",
						accentBorder: "border-l-purple-500",
					},
					{
						id: "limited",
						leftTitle: t("dashboard.analytics.thisWeekLimited", "This week limited"),
						leftVal: `+${analytics.thisWeekLimited}`,
						rightTitle: t("dashboard.analytics.lastWeekLimited", "Last week"),
						rightVal: `+${analytics.prevWeekLimited}`,
						values: analytics.dayBuckets.map((d) => d.limited),
						color: "#10b981",
						accentBorder: "border-l-emerald-500",
					},
				].map((card) => (
					<Card key={card.id} className="p-4">
						<div className="flex items-start justify-between gap-2">
							<div className={`border-l-2 pl-2.5 ${card.accentBorder}`}>
								<div className="text-[11px] font-medium text-ink-subtle">
									{card.leftTitle}
								</div>
								<div className="mt-0.5 text-xl font-bold text-ink tabular-nums">
									{card.leftVal}
								</div>
							</div>
							<div className="text-right">
								<div className="text-[11px] font-medium text-ink-tertiary">
									{card.rightTitle}
								</div>
								<div className="mt-0.5 text-base font-semibold text-ink-muted tabular-nums">
									{card.rightVal}
								</div>
							</div>
						</div>

						<div className="mt-2">
							<SmoothSparkline values={card.values} color={card.color} id={card.id} />
							<div className="mt-1 flex items-center justify-between text-[10px] text-ink-tertiary">
								{analytics.dayBuckets.map((b, idx) => (
									<span key={idx}>{b.label}</span>
								))}
							</div>
						</div>
					</Card>
				))}
			</div>

			{/* User Status & Client Apps Distribution */}
			<SegmentedBarCard
				title={t("dashboard.analytics.userStatus", "User status")}
				percent={analytics.activePct}
				subtitle={`${analytics.counts.active}/${analytics.total} ${t("dashboard.analytics.usersActive", "users active")}`}
				segments={[
					{ label: t("active", "Active"), value: analytics.counts.active, color: "#10b981" },
					{ label: t("status.limited", "Limited"), value: analytics.counts.limited, color: "#ef4444" },
					{ label: t("status.expired", "Expired"), value: analytics.counts.expired, color: "#f59e0b" },
					{ label: t("status.on_hold", "On Hold"), value: analytics.counts.on_hold, color: "#6366f1" },
					{ label: t("disabled", "Disabled"), value: analytics.counts.disabled, color: "#52525b" },
				]}
			/>

			<SegmentedBarCard
				title={t("dashboard.analytics.clientApps", "Client apps")}
				percent={analytics.onAppPct}
				subtitle={`${analytics.onAppCount}/${analytics.total} ${t("dashboard.analytics.usersOnApp", "users on an app")}`}
				segments={analytics.appSegments}
			/>

			{/* Available Users & Traffic Used */}
			<div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
				<SegmentedBarCard
					title={t("dashboard.analytics.availability", "Availability")}
					percent={analytics.availablePct}
					subtitle={`${analytics.available}/${analytics.total} ${t("dashboard.analytics.usersAvailable", "users available")}`}
					segments={[
						{ label: t("dashboard.analytics.available", "Available"), value: analytics.available, color: "#6366f1" },
						{ label: t("dashboard.analytics.unavailable", "Unavailable"), value: analytics.unavailable, color: "#3f3f46" },
					]}
				/>
				<SegmentedBarCard
					title={t("dashboard.analytics.traffic", "Traffic allocation")}
					percent={analytics.trafficPct}
					subtitle={`${formatBytes(analytics.totalUsedTraffic)} / ${analytics.totalDataLimit > 0 ? formatBytes(analytics.totalDataLimit) : "∞"}`}
					segments={[
						{
							label: t("dashboard.analytics.used", "Used"),
							value: analytics.totalUsedTraffic,
							displayValue: formatBytes(analytics.totalUsedTraffic),
							color: "#6366f1",
						},
						{
							label: t("dashboard.analytics.remaining", "Remaining"),
							value: analytics.remainingTraffic,
							displayValue: formatBytes(analytics.remainingTraffic),
							color: "#3f3f46",
						},
					]}
				/>
			</div>

			{/* Last Seen + Daily Usage Bar Chart */}
			<div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
				<Card className="p-4 lg:col-span-5">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-6">
							<div>
								<div className="text-[11px] font-medium text-ink-subtle">
									{t("dashboard.analytics.totalUsers", "Total users")}
								</div>
								<div className="mt-0.5 flex items-center gap-2 text-2xl font-bold text-ink tabular-nums">
									<UsersIcon className="h-5 w-5 text-indigo-400" />
									{analytics.total}
								</div>
							</div>
							<div>
								<div className="text-[11px] font-medium text-ink-subtle">
									{t("dashboard.analytics.onlineUsers", "Online users")}
								</div>
								<div className="mt-0.5 flex items-center gap-2 text-2xl font-bold text-ink tabular-nums">
									<span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
									{analytics.onlineCount}
								</div>
							</div>
						</div>
						<RouterLink
							to="/users"
							className="rounded-lg border border-hairline bg-surface-2 px-2.5 py-1 text-xs font-medium text-ink-muted transition-colors hover:border-hairline-strong hover:text-ink"
						>
							{t("users", "Users")} →
						</RouterLink>
					</div>

					<div className="mt-4 text-[11px] font-medium uppercase tracking-wider text-ink-tertiary">
						{t("dashboard.analytics.byLastSeen", "Users by last seen")}
					</div>

					<div className="mt-2.5 grid grid-cols-2 gap-2.5">
						{[
							{ label: t("today", "Today"), count: analytics.lastSeen.today, color: "border-l-indigo-500" },
							{ label: "1–7 days ago", count: analytics.lastSeen.week, color: "border-l-purple-500" },
							{ label: "8–30 days ago", count: analytics.lastSeen.month, color: "border-l-amber-500" },
							{ label: "30+ days ago", count: analytics.lastSeen.older, color: "border-l-zinc-500" },
						].map((item) => {
							const pct = analytics.total > 0 ? Math.round((item.count / analytics.total) * 100) : 0;
							return (
								<div
									key={item.label}
									className={`rounded-lg border border-hairline border-l-2 ${item.color} bg-white/[0.02] px-3 py-2.5`}
								>
									<div className="text-xs font-medium text-ink">{item.label}</div>
									<div className="mt-1 text-xs text-ink-subtle tabular-nums">
										<span className="font-semibold text-ink">{pct}%</span> · {item.count}
									</div>
								</div>
							);
						})}
					</div>
				</Card>

				<Card className="flex flex-col justify-between p-4 lg:col-span-7">
					<div className="flex flex-wrap items-start justify-between gap-3">
						<div className="flex items-center gap-6">
							<div>
								<div className="text-[11px] font-medium text-ink-subtle">
									{t("dashboard.analytics.totalUsage", "Total usage")}
								</div>
								<div className="mt-0.5 flex items-center gap-2 text-2xl font-bold text-ink tabular-nums">
									<ArrowTrendingUpIcon className="h-5 w-5 text-indigo-400" />
									{formatBytes(dailyChart.total)}
								</div>
							</div>
							<div>
								<div className="text-[11px] font-medium text-ink-subtle">
									{t("dashboard.analytics.average", "Daily average")}
								</div>
								<div className="mt-0.5 text-xl font-semibold text-ink-muted tabular-nums">
									{formatBytes(dailyChart.avg)}
								</div>
							</div>
						</div>

						<select
							value={usageDays}
							onChange={(e) => setUsageDays(Number(e.target.value))}
							className="h-8 rounded-lg border border-hairline bg-surface-2 px-2.5 text-xs font-medium text-ink focus:border-indigo-500 focus:outline-none"
						>
							<option value={7}>7 days</option>
							<option value={14}>14 days</option>
							<option value={30}>30 days</option>
						</select>
					</div>

					<div className="mt-5">
						{isUsageLoading ? (
							<div className="flex h-36 items-center justify-center">
								<Spinner className="h-5 w-5" />
							</div>
						) : (
							<div className="flex h-36 items-end gap-1.5 border-b border-hairline pb-2">
								{dailyChart.days.map((day) => {
									const heightPct = Math.max(4, Math.round((day.usage / dailyChart.max) * 100));
									return (
										<div
											key={day.key}
											title={`${day.key}: ${formatBytes(day.usage)}`}
											className="group relative flex h-full flex-1 flex-col items-center justify-end"
										>
											<div
												style={{ height: `${heightPct}%` }}
												className="w-full max-w-[24px] rounded-t-md bg-indigo-500/75 transition-all duration-200 group-hover:bg-indigo-400"
											/>
										</div>
									);
								})}
							</div>
						)}
						<div className="mt-1.5 flex items-center justify-between text-[10px] text-ink-tertiary tabular-nums">
							<span>{dailyChart.days[0]?.label}</span>
							<span>{dailyChart.days[Math.floor(dailyChart.days.length / 2)]?.label}</span>
							<span>{dailyChart.days[dailyChart.days.length - 1]?.label}</span>
						</div>
					</div>
				</Card>
			</div>

			{/* Bottom 2 Attention Lists */}
			<div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
				<Card className="p-4">
					<div className="flex items-center justify-between border-b border-hairline pb-3">
						<div className="flex items-center gap-4">
							<div className="border-l-2 border-amber-500 pl-2.5">
								<div className="text-[11px] font-medium text-ink-subtle">
									{t("dashboard.analytics.expiredToday", "Expired today")}
								</div>
								<div className="text-lg font-bold text-ink tabular-nums">
									+{analytics.expiredOrLimitedToday.filter((u) => u.status === "expired").length}
								</div>
							</div>
							<div className="border-l-2 border-rose-500 pl-2.5">
								<div className="text-[11px] font-medium text-ink-subtle">
									{t("dashboard.analytics.limited", "Limited")}
								</div>
								<div className="text-lg font-bold text-ink tabular-nums">
									+{analytics.counts.limited}
								</div>
							</div>
						</div>
						<ExclamationTriangleIcon className="h-4 w-4 text-ink-tertiary" />
					</div>

					<div className="mt-2 divide-y divide-white/[0.05]">
						{analytics.expiredOrLimitedToday.length === 0 ? (
							<div className="py-6 text-center text-xs text-ink-tertiary">
								{t("dashboard.analytics.noLimitedOrExpired", "No expired or limited users right now")}
							</div>
						) : (
							analytics.expiredOrLimitedToday.map((u) => (
								<div key={u.username} className="flex items-center justify-between py-2 text-xs">
									<span className="font-medium text-ink">{u.username}</span>
									<Badge variant={u.status === "limited" ? "danger" : "warning"}>
										{u.status.toUpperCase()}
									</Badge>
								</div>
							))
						)}
					</div>
				</Card>

				<Card className="p-4">
					<div className="flex items-center justify-between border-b border-hairline pb-3">
						<div className="flex items-center gap-4">
							<div className="border-l-2 border-amber-500 pl-2.5">
								<div className="text-[11px] font-medium text-ink-subtle">
									{t("dashboard.analytics.lowOnTime", "Low on time")}
								</div>
								<div className="text-lg font-bold text-ink tabular-nums">
									{analytics.lowTimeCount}
								</div>
							</div>
							<div className="border-l-2 border-rose-500 pl-2.5">
								<div className="text-[11px] font-medium text-ink-subtle">
									{t("dashboard.analytics.lowOnVolume", "Low on volume")}
								</div>
								<div className="text-lg font-bold text-ink tabular-nums">
									{analytics.lowVolCount}
								</div>
							</div>
						</div>
						<ClockIcon className="h-4 w-4 text-ink-tertiary" />
					</div>

					<div className="mt-2 divide-y divide-white/[0.05]">
						{analytics.lowOnResources.length === 0 ? (
							<div className="py-6 text-center text-xs text-ink-tertiary">
								{t("dashboard.analytics.noLowResources", "All active users have healthy time & volume")}
							</div>
						) : (
							analytics.lowOnResources.map((u) => (
								<div key={u.username} className="flex items-center justify-between py-2 text-xs">
									<span className="font-medium text-ink">{u.username}</span>
									<span className={`font-mono text-[11px] font-medium ${u.lowVol ? "text-rose-400" : "text-amber-400"}`}>
										{u.label}
									</span>
								</div>
							))
						)}
					</div>
				</Card>
			</div>
		</div>
	);
};

export default AdminAnalyticsDashboard;
