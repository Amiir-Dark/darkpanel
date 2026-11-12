import { useTranslation } from "react-i18next";
import { Badge, Card } from "components/linear/UI";
import { useDashboard } from "contexts/DashboardContext";
import { formatBytes } from "utils/formatByte";

export const UsersSummaryCards = () => {
	const { t } = useTranslation();
	const users = useDashboard((state) => state.users);

	const total = users.total ?? 0;
	const active = users.status_breakdown?.active ?? 0;
	const expired = users.status_breakdown?.expired ?? 0;
	const limited = users.status_breakdown?.limited ?? 0;
	const online = users.online_total ?? 0;
	const usageTotal = users.usage_total ?? 0;

	const items = [
		{
			label: t("usersSummary.totalUsers") || "Total Users",
			value: total,
			sub: `${formatBytes(usageTotal)} ${t("total") || "total usage"}`,
		},
		{
			label: t("usersSummary.activeUsers") || "Active Users",
			value: active,
			sub: `${total > 0 ? Math.round((active / total) * 100) : 0}% of total`,
			badge: total > 0 ? `${Math.round((active / total) * 100)}%` : undefined,
			badgeVariant: "success",
		},
		{
			label: t("usersSummary.onlineUsers") || "Online Users",
			value: online,
			sub: online > 0 ? t("usersSummary.activeConnections") || "Active connections" : t("usersSummary.noActiveConnections") || "No active connections",
			badge: online > 0 ? "Live" : "Idle",
			badgeVariant: online > 0 ? "success" : "neutral",
		},
		{
			label: t("usersSummary.limitedUsers") || "Limited / Expired",
			value: limited + expired,
			sub: `${limited} limited · ${expired} expired`,
			badge: limited + expired > 0 ? `${limited + expired}` : undefined,
			badgeVariant: limited + expired > 0 ? "warning" : "neutral",
		},
	];

	return (
		<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
			{items.map((item) => (
				<Card key={item.label} className="p-3.5 sm:p-4">
					<div className="flex items-center justify-between gap-2">
						<span className="truncate text-xs font-medium text-ink-subtle">{item.label}</span>
						{item.badge && <Badge variant={item.badgeVariant || "neutral"}>{item.badge}</Badge>}
					</div>
					<div className="mt-1.5 text-xl font-semibold tracking-tight text-ink tabular-nums sm:text-2xl">
						{item.value}
					</div>
					<div className="mt-0.5 truncate text-[11px] text-ink-tertiary tabular-nums">
						{item.sub}
					</div>
				</Card>
			))}
		</div>
	);
};

export default UsersSummaryCards;
