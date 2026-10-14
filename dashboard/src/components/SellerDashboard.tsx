import {
	Badge,
	Box,
	Button,
	Flex,
	HStack,
	Icon,
	Progress,
	Select,
	SimpleGrid,
	Skeleton,
	Stack,
	Text,
	Tooltip,
	useColorMode,
	VStack,
} from "@chakra-ui/react";
import {
	AdjustmentsHorizontalIcon,
	CheckCircleIcon,
	ClockIcon,
	ExclamationTriangleIcon,
	Squares2X2Icon,
	XCircleIcon,
} from "@heroicons/react/24/outline";
import dayjs from "dayjs";
import type React from "react";
import { type FC, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "react-query";
import { useNavigate } from "react-router-dom";
import { fetch as apiFetch } from "service/http";
import type { UserListItem, UsersListResponse } from "types/User";
import { formatBytes } from "utils/formatByte";

interface SellerDashboardProps {
	adminUsername: string;
}

interface SparklinePoint {
	label: string;
	count: number;
}

export function detectClientApp(userAgent?: string | null): string {
	if (!userAgent || typeof userAgent !== "string") return "No app yet";
	const ua = userAgent.toLowerCase();
	if (ua.includes("happ")) return "Happ";
	if (ua.includes("v2rayng")) return "v2rayNG";
	if (ua.includes("streisand")) return "Streisand";
	if (ua.includes("clash")) return "Clash";
	if (
		ua.includes("sing-box") ||
		ua.includes("sfa") ||
		ua.includes("sfi") ||
		ua.includes("sfm")
	)
		return "sing-box";
	if (ua.includes("shadowrocket")) return "Shadowrocket";
	if (ua.includes("hiddify")) return "Hiddify";
	if (ua.includes("karing")) return "Karing";
	if (ua.includes("v2raytun")) return "V2RayTun";
	if (ua.includes("nekobox")) return "NekoBox";
	if (ua.includes("outline")) return "Outline";
	if (ua.includes("v2rayn")) return "v2rayN";
	if (ua.includes("foxray")) return "FoXray";
	return "Other app";
}

// Mini Sparkline SVG component for smooth weekly trend
const SparklineTrend: FC<{
	points: SparklinePoint[];
	color: string;
	height?: number;
}> = ({ points, color, height = 70 }) => {
	const maxVal = Math.max(...points.map((p) => p.count), 1);
	const width = 280;
	const paddingY = 8;
	const usableHeight = height - paddingY * 2;

	const coords = points.map((p, i) => {
		const x = (i / Math.max(points.length - 1, 1)) * (width - 20) + 10;
		const y =
			height - paddingY - (Math.min(p.count, maxVal) / maxVal) * usableHeight;
		return { x, y };
	});

	// Build smooth bezier curve
	let pathD = `M ${coords[0].x},${coords[0].y}`;
	for (let i = 0; i < coords.length - 1; i++) {
		const p0 = coords[i];
		const p1 = coords[i + 1];
		const cpX = (p0.x + p1.x) / 2;
		pathD += ` C ${cpX},${p0.y} ${cpX},${p1.y} ${p1.x},${p1.y}`;
	}

	const areaD = `${pathD} L ${coords[coords.length - 1].x},${height} L ${coords[0].x},${height} Z`;

	return (
		<Box w="full" position="relative" pt={2} overflow="hidden">
			<svg
				viewBox={`0 0 ${width} ${height}`}
				width="100%"
				height={height}
				style={{ overflow: "visible" }}
			>
				<defs>
					<linearGradient
						id={`grad-${color.replace("#", "")}`}
						x1="0"
						y1="0"
						x2="0"
						y2="1"
					>
						<stop offset="0%" stopColor={color} stopOpacity="0.25" />
						<stop offset="100%" stopColor={color} stopOpacity="0.0" />
					</linearGradient>
				</defs>
				{/* Horizontal dashed baseline */}
				<line
					x1="5"
					y1={height / 2}
					x2={width - 5}
					y2={height / 2}
					stroke="currentColor"
					strokeOpacity="0.1"
					strokeDasharray="4 4"
				/>
				<path d={areaD} fill={`url(#grad-${color.replace("#", "")})`} />
				<path
					d={pathD}
					fill="none"
					stroke={color}
					strokeWidth="2.2"
					strokeLinecap="round"
				/>
				{coords.map((c, i) => (
					<circle
						key={`coord-${c.x}-${c.y}-${i}`}
						cx={c.x}
						cy={c.y}
						r="2.5"
						fill={color}
						opacity={points[i].count > 0 ? 1 : 0.4}
					/>
				))}
			</svg>
			<Flex justify="space-between" px={1} mt={1}>
				{points.map((p, i) => (
					<Text
						key={`pt-lbl-${p.label}-${i}`}
						fontSize="11px"
						color="gray.400"
						fontWeight="medium"
						textAlign="center"
						w="32px"
					>
						{p.label}
					</Text>
				))}
			</Flex>
		</Box>
	);
};

export const SellerDashboard: FC<SellerDashboardProps> = ({
	adminUsername,
}) => {
	const { t, i18n } = useTranslation();
	const isRTL = i18n.dir(i18n.language) === "rtl";
	const navigate = useNavigate();
	const { colorMode } = useColorMode();
	const isDark = colorMode === "dark";

	const [usagePeriodDays, setUsagePeriodDays] = useState<number>(7);

	// Fetch users scoped to this seller
	const { data: usersResponse, isLoading: isUsersLoading } =
		useQuery<UsersListResponse>(
			["seller-dashboard-users", adminUsername],
			() =>
				apiFetch<UsersListResponse>("/users", {
					query: { limit: 1000 },
				}),
			{
				staleTime: 10_000,
				refetchInterval: 15_000,
			},
		);

	// Fetch daily usage history for bar chart
	const { data: usageHistory, isLoading: isUsageLoading } = useQuery<{
		usages?: Array<{ date?: string; used_traffic?: number }>;
	}>(
		["seller-dashboard-usage", adminUsername, usagePeriodDays],
		async () => {
			const start = dayjs()
				.subtract(usagePeriodDays - 1, "day")
				.startOf("day")
				.toISOString();
			const end = dayjs().endOf("day").toISOString();
			return apiFetch(`/admin/${encodeURIComponent(adminUsername)}/usage/daily`, {
				query: { start, end },
			});
		},
		{
			staleTime: 30_000,
			refetchInterval: 60_000,
		},
	);

	const users: UserListItem[] = useMemo(
		() => usersResponse?.users || [],
		[usersResponse],
	);
	const totalUsers = usersResponse?.total ?? users.length;

	// Calculate weekly boundaries (Middle Eastern Saturday to Friday)
	const {
		thisWeekUsers,
		lastWeekUsers,
		usersTrendPoints,
		thisWeekExpired,
		lastWeekExpired,
		expiredTrendPoints,
		thisWeekLimited,
		lastWeekLimited,
		limitedTrendPoints,
	} = useMemo(() => {
		const now = dayjs();
		const daysSinceSat = (now.day() + 1) % 7;
		const thisWeekSat = now.subtract(daysSinceSat, "day").startOf("day");
		const lastWeekSat = thisWeekSat.subtract(7, "day");
		const lastWeekFriEnd = thisWeekSat.subtract(1, "millisecond");

		const dayLabels = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];

		const uTrend: SparklinePoint[] = dayLabels.map((lbl) => ({
			label: lbl,
			count: 0,
		}));
		const eTrend: SparklinePoint[] = dayLabels.map((lbl) => ({
			label: lbl,
			count: 0,
		}));
		const lTrend: SparklinePoint[] = dayLabels.map((lbl) => ({
			label: lbl,
			count: 0,
		}));

		let twU = 0;
		let lwU = 0;
		let twE = 0;
		let lwE = 0;
		let twL = 0;
		let lwL = 0;

		for (const u of users) {
			// Created trend
			if (u.created_at) {
				const cDate = dayjs(u.created_at);
				if (cDate.isAfter(thisWeekSat)) {
					twU++;
					const dIdx = (cDate.day() + 1) % 7;
					if (dIdx >= 0 && dIdx < 7) uTrend[dIdx].count++;
				} else if (cDate.isAfter(lastWeekSat) && cDate.isBefore(lastWeekFriEnd)) {
					lwU++;
				}
			}

			// Expired trend
			if (u.status === "expired" || (u.expire && u.expire * 1000 < Date.now())) {
				const expDate = u.expire ? dayjs(u.expire * 1000) : null;
				if (expDate) {
					if (expDate.isAfter(thisWeekSat)) {
						twE++;
						const dIdx = (expDate.day() + 1) % 7;
						if (dIdx >= 0 && dIdx < 7) eTrend[dIdx].count++;
					} else if (
						expDate.isAfter(lastWeekSat) &&
						expDate.isBefore(lastWeekFriEnd)
					) {
						lwE++;
					}
				} else {
					twE++;
				}
			}

			// Limited trend
			if (u.status === "limited") {
				twL++;
				const dIdx = (now.day() + 1) % 7;
				if (dIdx >= 0 && dIdx < 7) lTrend[dIdx].count++;
			}
		}

		return {
			thisWeekUsers: twU,
			lastWeekUsers: lwU,
			usersTrendPoints: uTrend,
			thisWeekExpired: twE,
			lastWeekExpired: lwE,
			expiredTrendPoints: eTrend,
			thisWeekLimited: twL,
			lastWeekLimited: lwL,
			limitedTrendPoints: lTrend,
		};
	}, [users]);

	// Status counts & percentages
	const statusCounts = useMemo(() => {
		const counts = {
			active: 0,
			limited: 0,
			expired: 0,
			on_hold: 0,
			disabled: 0,
		};
		for (const u of users) {
			const s = u.status?.toLowerCase();
			if (s === "active") counts.active++;
			else if (s === "limited") counts.limited++;
			else if (s === "expired") counts.expired++;
			else if (s === "on_hold") counts.on_hold++;
			else if (s === "disabled") counts.disabled++;
			else counts.active++;
		}
		return counts;
	}, [users]);

	const activePct = totalUsers > 0 ? (statusCounts.active / totalUsers) * 100 : 0;

	// Client app counts
	const appCounts = useMemo(() => {
		const map: Record<string, number> = {};
		let withApp = 0;
		for (const u of users) {
			const app = detectClientApp(u.sub_last_user_agent);
			map[app] = (map[app] || 0) + 1;
			if (app !== "No app yet") withApp++;
		}
		return { map, withApp };
	}, [users]);

	const appPct = totalUsers > 0 ? (appCounts.withApp / totalUsers) * 100 : 0;

	// Availability (Available = Active users not expired/limited, Unavailable = Limited/Expired/Disabled)
	const availableCount = statusCounts.active;
	const unavailableCount = Math.max(0, totalUsers - availableCount);
	const availPct = totalUsers > 0 ? (availableCount / totalUsers) * 100 : 0;

	// Volume Limits
	const volumeStats = useMemo(() => {
		let totalLimit = 0;
		let totalUsed = 0;
		let hasLimits = false;

		for (const u of users) {
			totalUsed += Number(u.used_traffic) || 0;
			if (u.data_limit && u.data_limit > 0) {
				hasLimits = true;
				totalLimit += u.data_limit;
			}
		}

		const remaining = Math.max(0, totalLimit - totalUsed);
		const pct = totalLimit > 0 ? Math.min(100, (totalUsed / totalLimit) * 100) : 0;

		return {
			hasLimits,
			totalUsed,
			remaining,
			totalLimit,
			pct,
		};
	}, [users]);

	// Last seen distribution
	const lastSeenStats = useMemo(() => {
		let today = 0;
		let week = 0;
		let month = 0;
		let older = 0;
		let online = 0;

		const now = Date.now();
		const oneDay = 24 * 3600 * 1000;

		for (const u of users) {
			if (u.is_online) online++;
			if (!u.online_at) {
				older++;
				continue;
			}
			const diff = now - new Date(u.online_at).getTime();
			if (diff <= oneDay) today++;
			else if (diff <= 7 * oneDay) week++;
			else if (diff <= 30 * oneDay) month++;
			else older++;
		}

		const calcPct = (c: number) =>
			totalUsers > 0 ? Math.round((c / totalUsers) * 100) : 0;

		return {
			online,
			today,
			todayPct: calcPct(today),
			week,
			weekPct: calcPct(week),
			month,
			monthPct: calcPct(month),
			older,
			olderPct: calcPct(older),
		};
	}, [users, totalUsers]);

	// Daily usage points for bar chart
	const { dailyUsageBars, totalPeriodUsage, avgDailyUsage } = useMemo(() => {
		const usages = usageHistory?.usages || [];
		const barData: Array<{ label: string; date: string; bytes: number }> = [];

		let total = 0;
		for (let i = usagePeriodDays - 1; i >= 0; i--) {
			const d = dayjs().subtract(i, "day").format("YYYY-MM-DD");
			const found = usages.find((u) => u.date?.startsWith(d));
			const bytes = Number(found?.used_traffic) || 0;
			total += bytes;
			barData.push({
				label: dayjs(d).format("MM/DD"),
				date: d,
				bytes,
			});
		}

		const avg = usagePeriodDays > 0 ? total / usagePeriodDays : 0;
		return {
			dailyUsageBars: barData,
			totalPeriodUsage: total,
			avgDailyUsage: avg,
		};
	}, [usageHistory, usagePeriodDays]);

	// Today expired & limited lists
	const { expiredTodayList, limitedTodayList } = useMemo(() => {
		const todayStart = dayjs().startOf("day").valueOf();
		const todayEnd = dayjs().endOf("day").valueOf();

		const expiredToday: UserListItem[] = [];
		const limitedToday: UserListItem[] = [];

		for (const u of users) {
			if (u.status === "expired" && u.expire) {
				const expMs = u.expire * 1000;
				if (expMs >= todayStart && expMs <= todayEnd) {
					expiredToday.push(u);
				}
			}
			if (u.status === "limited") {
				limitedToday.push(u);
			}
		}

		return {
			expiredTodayList: expiredToday,
			limitedTodayList: limitedToday,
		};
	}, [users]);

	// Low on time & Low on volume lists
	const { lowOnTimeList, lowOnVolumeList } = useMemo(() => {
		const now = Date.now();
		const threeDaysMs = 3 * 24 * 3600 * 1000;

		const lowTime: UserListItem[] = [];
		const lowVol: UserListItem[] = [];

		for (const u of users) {
			if (u.status === "active" && u.expire) {
				const expMs = u.expire * 1000;
				const remaining = expMs - now;
				if (remaining > 0 && remaining <= threeDaysMs) {
					lowTime.push(u);
				}
			}
			if (u.status === "active" && u.data_limit && u.data_limit > 0) {
				const ratio = (u.used_traffic || 0) / u.data_limit;
				if (ratio >= 0.85) {
					lowVol.push(u);
				}
			}
		}

		return {
			lowOnTimeList: lowTime,
			lowOnVolumeList: lowVol,
		};
	}, [users]);

	const maxBarUsage = Math.max(...dailyUsageBars.map((b) => b.bytes), 1);

	return (
		<Stack spacing={{ base: 4, md: 5 }} w="full" dir={isRTL ? "rtl" : "ltr"}>
			{/* Header Title */}
			<Flex align="center" gap={2} px={1} mb={-1}>
				<Icon
					as={Squares2X2Icon}
					boxSize={5}
					color={isDark ? "blue.400" : "blue.600"}
				/>
				<Text fontSize="lg" fontWeight="bold" color="panel.text">
					{t("menu.dashboard", "Dashboard")}
				</Text>
			</Flex>

			{/* Row 1: Three Trend KPI Cards */}
			<SimpleGrid columns={{ base: 1, md: 3 }} spacing={{ base: 3, md: 4 }}>
				{/* Card 1: Users Growth */}
				<Box
					bg="panel.surface"
					borderWidth="1px"
					borderColor="panel.border"
					borderRadius="xl"
					p={{ base: 4, sm: 5 }}
					boxShadow="sm"
				>
					<Flex justify="space-between" align="flex-start" mb={2}>
						<HStack align="flex-start" spacing={3}>
							<Box w="3px" h="38px" borderRadius="full" bg="blue.500" />
							<VStack align="flex-start" spacing={0}>
								<Text fontSize="xs" color="gray.400" fontWeight="medium">
									This week user
								</Text>
								<Text fontSize="2xl" fontWeight="bold" color="panel.text">
									+{thisWeekUsers}
								</Text>
							</VStack>
						</HStack>
						<HStack align="flex-start" spacing={3}>
							<Box w="3px" h="38px" borderRadius="full" bg="cyan.400" />
							<VStack align="flex-start" spacing={0}>
								<Text fontSize="xs" color="gray.400" fontWeight="medium">
									Last week user
								</Text>
								<Text fontSize="2xl" fontWeight="bold" color="panel.text">
									+{lastWeekUsers}
								</Text>
							</VStack>
						</HStack>
					</Flex>
					<SparklineTrend points={usersTrendPoints} color="#3B82F6" />
				</Box>

				{/* Card 2: Expired Growth */}
				<Box
					bg="panel.surface"
					borderWidth="1px"
					borderColor="panel.border"
					borderRadius="xl"
					p={{ base: 4, sm: 5 }}
					boxShadow="sm"
				>
					<Flex justify="space-between" align="flex-start" mb={2}>
						<HStack align="flex-start" spacing={3}>
							<Box w="3px" h="38px" borderRadius="full" bg="purple.500" />
							<VStack align="flex-start" spacing={0}>
								<Text fontSize="xs" color="gray.400" fontWeight="medium">
									This week expired
								</Text>
								<Text fontSize="2xl" fontWeight="bold" color="panel.text">
									+{thisWeekExpired}
								</Text>
							</VStack>
						</HStack>
						<HStack align="flex-start" spacing={3}>
							<Box w="3px" h="38px" borderRadius="full" bg="purple.300" />
							<VStack align="flex-start" spacing={0}>
								<Text fontSize="xs" color="gray.400" fontWeight="medium">
									Last week expired
								</Text>
								<Text fontSize="2xl" fontWeight="bold" color="panel.text">
									+{lastWeekExpired}
								</Text>
							</VStack>
						</HStack>
					</Flex>
					<SparklineTrend points={expiredTrendPoints} color="#8B5CF6" />
				</Box>

				{/* Card 3: Limited Growth */}
				<Box
					bg="panel.surface"
					borderWidth="1px"
					borderColor="panel.border"
					borderRadius="xl"
					p={{ base: 4, sm: 5 }}
					boxShadow="sm"
				>
					<Flex justify="space-between" align="flex-start" mb={2}>
						<HStack align="flex-start" spacing={3}>
							<Box w="3px" h="38px" borderRadius="full" bg="green.500" />
							<VStack align="flex-start" spacing={0}>
								<Text fontSize="xs" color="gray.400" fontWeight="medium">
									This week limited
								</Text>
								<Text fontSize="2xl" fontWeight="bold" color="panel.text">
									+{thisWeekLimited}
								</Text>
							</VStack>
						</HStack>
						<HStack align="flex-start" spacing={3}>
							<Box w="3px" h="38px" borderRadius="full" bg="teal.300" />
							<VStack align="flex-start" spacing={0}>
								<Text fontSize="xs" color="gray.400" fontWeight="medium">
									Last week limited
								</Text>
								<Text fontSize="2xl" fontWeight="bold" color="panel.text">
									+{lastWeekLimited}
								</Text>
							</VStack>
						</HStack>
					</Flex>
					<SparklineTrend points={limitedTrendPoints} color="#10B981" />
				</Box>
			</SimpleGrid>

			{/* Row 2: Users Active Status Distribution */}
			<Box
				bg="panel.surface"
				borderWidth="1px"
				borderColor="panel.border"
				borderRadius="xl"
				p={{ base: 4, sm: 5 }}
				boxShadow="sm"
			>
				<Flex align="baseline" gap={2} mb={3}>
					<Text fontSize="2xl" fontWeight="bold" color="panel.text">
						{activePct.toFixed(1)}%
					</Text>
					<Text fontSize="sm" color="gray.400" fontWeight="medium">
						{statusCounts.active}/{totalUsers} users active
					</Text>
				</Flex>

				{/* Multi-segment Segmented Bar */}
				<Box
					w="full"
					h="12px"
					borderRadius="full"
					bg={isDark ? "gray.700" : "gray.100"}
					overflow="hidden"
					display="flex"
					mb={3}
				>
					{totalUsers > 0 ? (
						<>
							<Box
								w={`${(statusCounts.active / totalUsers) * 100}%`}
								h="full"
								bg="#10B981"
								title={`Active: ${statusCounts.active}`}
							/>
							<Box
								w={`${(statusCounts.limited / totalUsers) * 100}%`}
								h="full"
								bg="#EF4444"
								title={`Limited: ${statusCounts.limited}`}
							/>
							<Box
								w={`${(statusCounts.expired / totalUsers) * 100}%`}
								h="full"
								bg="#F59E0B"
								title={`Expired: ${statusCounts.expired}`}
							/>
							<Box
								w={`${(statusCounts.on_hold / totalUsers) * 100}%`}
								h="full"
								bg="#8B5CF6"
								title={`On Hold: ${statusCounts.on_hold}`}
							/>
							<Box
								w={`${(statusCounts.disabled / totalUsers) * 100}%`}
								h="full"
								bg="#6B7280"
								title={`Disabled: ${statusCounts.disabled}`}
							/>
						</>
					) : (
						<Box w="full" h="full" bg={isDark ? "gray.800" : "gray.200"} />
					)}
				</Box>

				{/* Status Legend */}
				<Flex wrap="wrap" gap={{ base: 3, sm: 5 }} align="center">
					<HStack spacing={1.5}>
						<Box w="8px" h="8px" borderRadius="full" bg="#10B981" />
						<Text fontSize="xs" color="gray.400">
							Active <Text as="span" fontWeight="bold" color="panel.text">{statusCounts.active}</Text>
						</Text>
					</HStack>
					<HStack spacing={1.5}>
						<Box w="8px" h="8px" borderRadius="full" bg="#EF4444" />
						<Text fontSize="xs" color="gray.400">
							Limited <Text as="span" fontWeight="bold" color="panel.text">{statusCounts.limited}</Text>
						</Text>
					</HStack>
					<HStack spacing={1.5}>
						<Box w="8px" h="8px" borderRadius="full" bg="#F59E0B" />
						<Text fontSize="xs" color="gray.400">
							Expired <Text as="span" fontWeight="bold" color="panel.text">{statusCounts.expired}</Text>
						</Text>
					</HStack>
					<HStack spacing={1.5}>
						<Box w="8px" h="8px" borderRadius="full" bg="#8B5CF6" />
						<Text fontSize="xs" color="gray.400">
							On Hold <Text as="span" fontWeight="bold" color="panel.text">{statusCounts.on_hold}</Text>
						</Text>
					</HStack>
					<HStack spacing={1.5}>
						<Box w="8px" h="8px" borderRadius="full" bg="#6B7280" />
						<Text fontSize="xs" color="gray.400">
							Disabled <Text as="span" fontWeight="bold" color="panel.text">{statusCounts.disabled}</Text>
						</Text>
					</HStack>
				</Flex>
			</Box>

			{/* Row 3: Users On An App Distribution */}
			<Box
				bg="panel.surface"
				borderWidth="1px"
				borderColor="panel.border"
				borderRadius="xl"
				p={{ base: 4, sm: 5 }}
				boxShadow="sm"
			>
				<Flex align="baseline" gap={2} mb={3}>
					<Text fontSize="2xl" fontWeight="bold" color="panel.text">
						{appPct.toFixed(1)}%
					</Text>
					<Text fontSize="sm" color="gray.400" fontWeight="medium">
						{appCounts.withApp}/{totalUsers} users on an app
					</Text>
				</Flex>

				<Box
					w="full"
					h="12px"
					borderRadius="full"
					bg={isDark ? "gray.700" : "gray.100"}
					overflow="hidden"
					display="flex"
					mb={3}
				>
					{totalUsers > 0 && appCounts.withApp > 0 ? (
						Object.entries(appCounts.map)
							.filter(([app]) => app !== "No app yet")
							.map(([app, count], idx) => {
								const colors = [
									"#3B82F6",
									"#10B981",
									"#F59E0B",
									"#8B5CF6",
									"#EC4899",
									"#06B6D4",
								];
								const c = colors[idx % colors.length];
								return (
									<Box
										key={app}
										w={`${(count / totalUsers) * 100}%`}
										h="full"
										bg={c}
										title={`${app}: ${count}`}
									/>
								);
							})
					) : (
						<Box w="full" h="full" bg={isDark ? "gray.800" : "gray.200"} />
					)}
				</Box>

				<Flex wrap="wrap" gap={{ base: 3, sm: 5 }} align="center">
					{Object.entries(appCounts.map).map(([app, count], idx) => {
						const isNone = app === "No app yet";
						const colors = [
							"#3B82F6",
							"#10B981",
							"#F59E0B",
							"#8B5CF6",
							"#EC4899",
							"#06B6D4",
						];
						const dotColor = isNone ? "#9CA3AF" : colors[idx % colors.length];
						return (
							<HStack key={app} spacing={1.5}>
								<Box w="8px" h="8px" borderRadius="full" bg={dotColor} />
								<Text fontSize="xs" color="gray.400">
									{app} <Text as="span" fontWeight="bold" color="panel.text">{count}</Text>
								</Text>
							</HStack>
						);
					})}
				</Flex>
			</Box>

			{/* Row 4: Two Half-Width Cards (Available Users & Volume Limits) */}
			<SimpleGrid columns={{ base: 1, md: 2 }} spacing={{ base: 3, md: 4 }}>
				{/* Availability */}
				<Box
					bg="panel.surface"
					borderWidth="1px"
					borderColor="panel.border"
					borderRadius="xl"
					p={{ base: 4, sm: 5 }}
					boxShadow="sm"
				>
					<Flex align="baseline" gap={2} mb={3}>
						<Text fontSize="2xl" fontWeight="bold" color="panel.text">
							{availPct.toFixed(1)}%
						</Text>
						<Text fontSize="sm" color="gray.400" fontWeight="medium">
							{availableCount}/{totalUsers} users available
						</Text>
					</Flex>

					<Box
						w="full"
						h="10px"
						borderRadius="full"
						bg={isDark ? "gray.700" : "gray.100"}
						overflow="hidden"
						display="flex"
						mb={3}
					>
						{totalUsers > 0 ? (
							<>
								<Box
									w={`${(availableCount / totalUsers) * 100}%`}
									h="full"
									bg="#3B82F6"
								/>
								<Box
									w={`${(unavailableCount / totalUsers) * 100}%`}
									h="full"
									bg="#9CA3AF"
								/>
							</>
						) : (
							<Box w="full" h="full" bg={isDark ? "gray.800" : "gray.200"} />
						)}
					</Box>

					<Flex gap={5} align="center">
						<HStack spacing={1.5}>
							<Box w="8px" h="8px" borderRadius="full" bg="#3B82F6" />
							<Text fontSize="xs" color="gray.400">
								Available <Text as="span" fontWeight="bold" color="panel.text">{availableCount}</Text>
							</Text>
						</HStack>
						<HStack spacing={1.5}>
							<Box w="8px" h="8px" borderRadius="full" bg="#9CA3AF" />
							<Text fontSize="xs" color="gray.400">
								Unavailable <Text as="span" fontWeight="bold" color="panel.text">{unavailableCount}</Text>
							</Text>
						</HStack>
					</Flex>
				</Box>

				{/* Volume Limits */}
				<Box
					bg="panel.surface"
					borderWidth="1px"
					borderColor="panel.border"
					borderRadius="xl"
					p={{ base: 4, sm: 5 }}
					boxShadow="sm"
				>
					<Flex align="baseline" gap={2} mb={3}>
						<Text fontSize="2xl" fontWeight="bold" color="panel.text">
							{volumeStats.pct.toFixed(1)}%
						</Text>
						<Text fontSize="sm" color="gray.400" fontWeight="medium">
							{volumeStats.hasLimits
								? `${formatBytes(volumeStats.totalUsed)} / ${formatBytes(volumeStats.totalLimit)} used`
								: "No volume limits set yet"}
						</Text>
					</Flex>

					<Box
						w="full"
						h="10px"
						borderRadius="full"
						bg={isDark ? "gray.700" : "gray.100"}
						overflow="hidden"
						display="flex"
						mb={3}
					>
						{volumeStats.hasLimits ? (
							<>
								<Box w={`${volumeStats.pct}%`} h="full" bg="#3B82F6" />
								<Box
									w={`${Math.max(0, 100 - volumeStats.pct)}%`}
									h="full"
									bg="#93C5FD"
								/>
							</>
						) : (
							<Box w="full" h="full" bg={isDark ? "gray.800" : "gray.200"} />
						)}
					</Box>

					<Flex gap={5} align="center">
						<HStack spacing={1.5}>
							<Box w="8px" h="8px" borderRadius="full" bg="#3B82F6" />
							<Text fontSize="xs" color="gray.400">
								Used{" "}
								<Text as="span" fontWeight="bold" color="panel.text">
									{formatBytes(volumeStats.totalUsed)}
								</Text>
							</Text>
						</HStack>
						<HStack spacing={1.5}>
							<Box w="8px" h="8px" borderRadius="full" bg="#93C5FD" />
							<Text fontSize="xs" color="gray.400">
								Remaining{" "}
								<Text as="span" fontWeight="bold" color="panel.text">
									{formatBytes(volumeStats.remaining)}
								</Text>
							</Text>
						</HStack>
					</Flex>
				</Box>
			</SimpleGrid>

			{/* Row 5: Users by Last Seen & Total Usage with Chart */}
			<SimpleGrid columns={{ base: 1, md: 2 }} spacing={{ base: 3, md: 4 }}>
				{/* Users by Last Seen */}
				<Box
					bg="panel.surface"
					borderWidth="1px"
					borderColor="panel.border"
					borderRadius="xl"
					p={{ base: 4, sm: 5 }}
					boxShadow="sm"
				>
					<Flex justify="space-between" align="center" mb={4}>
						<HStack spacing={6}>
							<VStack align="flex-start" spacing={0}>
								<Text fontSize="xs" color="gray.400" fontWeight="medium">
									Total users
								</Text>
								<Text fontSize="2xl" fontWeight="bold" color="panel.text">
									{totalUsers}
								</Text>
							</VStack>
							<VStack align="flex-start" spacing={0}>
								<Text fontSize="xs" color="gray.400" fontWeight="medium">
									Online users
								</Text>
								<Text fontSize="2xl" fontWeight="bold" color="panel.text">
									{lastSeenStats.online}
								</Text>
							</VStack>
						</HStack>

						<Button
							size="sm"
							variant="outline"
							leftIcon={<Icon as={AdjustmentsHorizontalIcon} boxSize={4} />}
							onClick={() => navigate("/users")}
							borderRadius="lg"
							fontSize="xs"
						>
							Filter
						</Button>
					</Flex>

					<Text fontSize="xs" fontWeight="semibold" color="gray.400" mb={3}>
						Users by last seen
					</Text>

					<SimpleGrid columns={2} spacing={3}>
						{/* Today */}
						<Box
							p={3}
							borderRadius="lg"
							borderWidth="1px"
							borderColor="panel.border"
							borderStartWidth="4px"
							borderStartColor="#3B82F6"
							bg={isDark ? "whiteAlpha.50" : "gray.50"}
						>
							<Text fontSize="xs" fontWeight="bold" color="panel.text">
								Today
							</Text>
							<Text fontSize="xs" color="gray.400" mt={0.5}>
								{lastSeenStats.todayPct}% - {lastSeenStats.today}
							</Text>
						</Box>

						{/* 1-7 days ago */}
						<Box
							p={3}
							borderRadius="lg"
							borderWidth="1px"
							borderColor="panel.border"
							borderStartWidth="4px"
							borderStartColor="#06B6D4"
							bg={isDark ? "whiteAlpha.50" : "gray.50"}
						>
							<Text fontSize="xs" fontWeight="bold" color="panel.text">
								1-7 days ago
							</Text>
							<Text fontSize="xs" color="gray.400" mt={0.5}>
								{lastSeenStats.weekPct}% - {lastSeenStats.week}
							</Text>
						</Box>

						{/* 8-30 days ago */}
						<Box
							p={3}
							borderRadius="lg"
							borderWidth="1px"
							borderColor="panel.border"
							borderStartWidth="4px"
							borderStartColor="#10B981"
							bg={isDark ? "whiteAlpha.50" : "gray.50"}
						>
							<Text fontSize="xs" fontWeight="bold" color="panel.text">
								8-30 days ago
							</Text>
							<Text fontSize="xs" color="gray.400" mt={0.5}>
								{lastSeenStats.monthPct}% - {lastSeenStats.month}
							</Text>
						</Box>

						{/* 30+ days ago */}
						<Box
							p={3}
							borderRadius="lg"
							borderWidth="1px"
							borderColor="panel.border"
							borderStartWidth="4px"
							borderStartColor="#F59E0B"
							bg={isDark ? "whiteAlpha.50" : "gray.50"}
						>
							<Text fontSize="xs" fontWeight="bold" color="panel.text">
								30+ days ago
							</Text>
							<Text fontSize="xs" color="gray.400" mt={0.5}>
								{lastSeenStats.olderPct}% - {lastSeenStats.older}
							</Text>
						</Box>
					</SimpleGrid>
				</Box>

				{/* Total Usage & Bar Chart */}
				<Box
					bg="panel.surface"
					borderWidth="1px"
					borderColor="panel.border"
					borderRadius="xl"
					p={{ base: 4, sm: 5 }}
					boxShadow="sm"
				>
					<Flex justify="space-between" align="center" mb={4}>
						<HStack spacing={6}>
							<VStack align="flex-start" spacing={0}>
								<Text fontSize="xs" color="gray.400" fontWeight="medium">
									Total usage
								</Text>
								<Text fontSize="2xl" fontWeight="bold" color="panel.text">
									{formatBytes(totalPeriodUsage)}
								</Text>
							</VStack>
							<VStack align="flex-start" spacing={0}>
								<Text fontSize="xs" color="gray.400" fontWeight="medium">
									Average
								</Text>
								<Text fontSize="2xl" fontWeight="bold" color="panel.text">
									{formatBytes(avgDailyUsage)}
								</Text>
							</VStack>
						</HStack>

						<Select
							size="sm"
							w="100px"
							value={usagePeriodDays}
							onChange={(e) => setUsagePeriodDays(Number(e.target.value))}
							borderRadius="lg"
							fontSize="xs"
						>
							<option value={7}>7 days</option>
							<option value={14}>14 days</option>
							<option value={30}>30 days</option>
						</Select>
					</Flex>

					{/* Vertical Bar Chart */}
					<Box h="110px" w="full" position="relative" pt={2}>
						{/* Dashed guidelines */}
						<Box
							position="absolute"
							top="30%"
							left={0}
							right={0}
							borderBottom="1px dashed"
							borderColor="panel.border"
							opacity={0.6}
						/>
						<Box
							position="absolute"
							top="60%"
							left={0}
							right={0}
							borderBottom="1px dashed"
							borderColor="panel.border"
							opacity={0.6}
						/>

						<Flex
							h="85px"
							align="flex-end"
							justify="space-between"
							gap={{ base: 1, sm: 2 }}
							px={1}
						>
							{dailyUsageBars.map((bar, i) => {
								const heightRatio =
									bar.bytes > 0 ? (bar.bytes / maxBarUsage) * 100 : 8;
								return (
									<Tooltip
										key={`bar-${bar.date || i}`}
										label={`${bar.date}: ${formatBytes(bar.bytes)}`}
										hasArrow
										placement="top"
									>
										<VStack
											flex={1}
											h="full"
											justify="flex-end"
											spacing={1}
											cursor="pointer"
										>
											<Box
												w="full"
												maxW="26px"
												h={`${Math.max(8, heightRatio)}%`}
												bg={
													bar.bytes > 0
														? isDark
															? "blue.400"
															: "blue.500"
														: isDark
															? "whiteAlpha.200"
															: "gray.200"
												}
												borderRadius="4px"
												transition="all 0.2s"
												_hover={{
													bg: isDark ? "blue.300" : "blue.600",
													transform: "scaleY(1.05)",
												}}
											/>
										</VStack>
									</Tooltip>
								);
							})}
						</Flex>

						{/* X-axis labels */}
						<Flex justify="space-between" px={1} mt={1}>
							{dailyUsageBars
								.filter(
									(_, idx) =>
										idx === 0 ||
										idx === Math.floor(dailyUsageBars.length / 2) ||
										idx === dailyUsageBars.length - 1,
								)
								.map((b, i) => (
									<Text key={`bar-lbl-${b.label}-${i}`} fontSize="10px" color="gray.400">
										{b.label}
									</Text>
								))}
						</Flex>
					</Box>
				</Box>
			</SimpleGrid>

			{/* Row 6: Two Half-Width Cards (Expired/Limited Today & Low on Quota) */}
			<SimpleGrid columns={{ base: 1, md: 2 }} spacing={{ base: 3, md: 4 }}>
				{/* Expired Today & Limited Today */}
				<Box
					bg="panel.surface"
					borderWidth="1px"
					borderColor="panel.border"
					borderRadius="xl"
					p={{ base: 4, sm: 5 }}
					boxShadow="sm"
				>
					<Flex justify="space-between" align="flex-start" mb={4}>
						<HStack align="flex-start" spacing={3}>
							<Box w="3px" h="38px" borderRadius="full" bg="#F59E0B" />
							<VStack align="flex-start" spacing={0}>
								<Text fontSize="xs" color="gray.400" fontWeight="medium">
									Expired today
								</Text>
								<Text fontSize="2xl" fontWeight="bold" color="panel.text">
									+{expiredTodayList.length}
								</Text>
							</VStack>
						</HStack>

						<HStack align="flex-start" spacing={3}>
							<Box w="3px" h="38px" borderRadius="full" bg="#EF4444" />
							<VStack align="flex-start" spacing={0}>
								<Text fontSize="xs" color="gray.400" fontWeight="medium">
									Limited today
								</Text>
								<Text fontSize="2xl" fontWeight="bold" color="panel.text">
									+{limitedTodayList.length}
								</Text>
							</VStack>
						</HStack>
					</Flex>

					{/* Users List or Empty / Placeholder Lines */}
					<Stack spacing={2}>
						{expiredTodayList.length === 0 && limitedTodayList.length === 0 ? (
							<VStack spacing={2.5} align="stretch" py={2} opacity={0.35}>
								{[1, 2, 3].map((idx) => (
									<HStack key={idx} justify="space-between">
										<Box
											w="120px"
											h="12px"
											borderRadius="full"
											bg={isDark ? "gray.700" : "gray.200"}
										/>
										<Box
											w="60px"
											h="12px"
											borderRadius="full"
											bg={isDark ? "gray.700" : "gray.200"}
										/>
									</HStack>
								))}
							</VStack>
						) : (
							<>
								{expiredTodayList.slice(0, 3).map((u) => (
									<Flex
										key={u.id}
										justify="space-between"
										align="center"
										py={1.5}
										borderBottomWidth="1px"
										borderColor="panel.border"
									>
										<Text fontSize="xs" fontWeight="semibold" color="panel.text">
											{u.username}
										</Text>
										<Badge colorScheme="orange" fontSize="10px">
											Expired
										</Badge>
									</Flex>
								))}
								{limitedTodayList.slice(0, 3).map((u) => (
									<Flex
										key={u.id}
										justify="space-between"
										align="center"
										py={1.5}
										borderBottomWidth="1px"
										borderColor="panel.border"
									>
										<Text fontSize="xs" fontWeight="semibold" color="panel.text">
											{u.username}
										</Text>
										<Badge colorScheme="red" fontSize="10px">
											Limited
										</Badge>
									</Flex>
								))}
							</>
						)}
					</Stack>
				</Box>

				{/* Low on Time & Low on Volume */}
				<Box
					bg="panel.surface"
					borderWidth="1px"
					borderColor="panel.border"
					borderRadius="xl"
					p={{ base: 4, sm: 5 }}
					boxShadow="sm"
				>
					<Flex justify="space-between" align="flex-start" mb={4}>
						<HStack align="flex-start" spacing={3}>
							<Box w="3px" h="38px" borderRadius="full" bg="#F59E0B" />
							<VStack align="flex-start" spacing={0}>
								<Text fontSize="xs" color="gray.400" fontWeight="medium">
									Low on time
								</Text>
								<Text fontSize="2xl" fontWeight="bold" color="panel.text">
									{lowOnTimeList.length}
								</Text>
							</VStack>
						</HStack>

						<HStack align="flex-start" spacing={3}>
							<Box w="3px" h="38px" borderRadius="full" bg="#EF4444" />
							<VStack align="flex-start" spacing={0}>
								<Text fontSize="xs" color="gray.400" fontWeight="medium">
									Low on volume
								</Text>
								<Text fontSize="2xl" fontWeight="bold" color="panel.text">
									{lowOnVolumeList.length}
								</Text>
							</VStack>
						</HStack>
					</Flex>

					{/* Users List or Empty / Placeholder Lines */}
					<Stack spacing={2}>
						{lowOnTimeList.length === 0 && lowOnVolumeList.length === 0 ? (
							<VStack spacing={2.5} align="stretch" py={2} opacity={0.35}>
								{[1, 2, 3].map((idx) => (
									<HStack key={idx} justify="space-between">
										<Box
											w="120px"
											h="12px"
											borderRadius="full"
											bg={isDark ? "gray.700" : "gray.200"}
										/>
										<Box
											w="60px"
											h="12px"
											borderRadius="full"
											bg={isDark ? "gray.700" : "gray.200"}
										/>
									</HStack>
								))}
							</VStack>
						) : (
							<>
								{lowOnTimeList.slice(0, 3).map((u) => {
									const remainingDays = u.expire
										? Math.max(
												0,
												Math.ceil(
													(u.expire * 1000 - Date.now()) / (24 * 3600 * 1000),
												),
											)
										: 0;
									return (
										<Flex
											key={u.id}
											justify="space-between"
											align="center"
											py={1.5}
											borderBottomWidth="1px"
											borderColor="panel.border"
										>
											<Text
												fontSize="xs"
												fontWeight="semibold"
												color="panel.text"
											>
												{u.username}
											</Text>
											<Text fontSize="xs" color="orange.400" fontWeight="medium">
												{remainingDays} days left
											</Text>
										</Flex>
									);
								})}
								{lowOnVolumeList.slice(0, 3).map((u) => {
									const remainingBytes = Math.max(
										0,
										(u.data_limit || 0) - (u.used_traffic || 0),
									);
									return (
										<Flex
											key={u.id}
											justify="space-between"
											align="center"
											py={1.5}
											borderBottomWidth="1px"
											borderColor="panel.border"
										>
											<Text
												fontSize="xs"
												fontWeight="semibold"
												color="panel.text"
											>
												{u.username}
											</Text>
											<Text fontSize="xs" color="red.400" fontWeight="medium">
												{formatBytes(remainingBytes)} left
											</Text>
										</Flex>
									);
								})}
							</>
						)}
					</Stack>
				</Box>
			</SimpleGrid>
		</Stack>
	);
};

export default SellerDashboard;
