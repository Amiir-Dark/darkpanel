import {
	ArrowPathIcon,
	CheckIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	ClipboardDocumentIcon,
	EllipsisHorizontalIcon,
	KeyIcon,
	LinkIcon,
	NoSymbolIcon,
	PencilSquareIcon,
	PowerIcon,
	QrCodeIcon,
	SignalIcon,
	TrashIcon,
} from "@heroicons/react/24/outline";
import dayjs from "dayjs";
import { Fragment, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { appToast } from "components/linear/Toast";
import { Badge, Button, Card, IconButton, Modal, Select, Spinner } from "components/linear/UI";
import { useDashboard } from "contexts/DashboardContext";
import { fetch } from "service/http";
import { copyTextToClipboard } from "utils/clipboard";
import { formatBytes } from "utils/formatByte";
import { generateUserLinks } from "utils/userLinks";

const statusVariantMap = {
	active: "success",
	disabled: "neutral",
	limited: "warning",
	expired: "danger",
	on_hold: "accent",
};

const statusLabelMap = {
	active: "Active",
	disabled: "Disabled",
	limited: "Limited",
	expired: "Expired",
	on_hold: "On Hold",
};

const formatExpiry = (user, t) => {
	if (user.status === "on_hold") {
		const days = user.on_hold_expire_duration
			? Math.round(user.on_hold_expire_duration / 86400)
			: null;
		return { text: days ? `${days}d on hold` : "On Hold", danger: false };
	}
	if (!user.expire) {
		return user.status === "expired"
			? { text: t("status_expired", "Expired"), danger: true }
			: { text: "∞", danger: false };
	}
	const diff = user.expire * 1000 - Date.now();
	const relTime = dayjs.unix(user.expire).fromNow(true);
	if (user.status === "expired" || diff <= 0) {
		return { text: t("expired", { time: relTime }), danger: true };
	}
	return { text: relTime, danger: diff < 3 * 86400 * 1000 };
};

export const UsersTable = () => {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const usersResponse = useDashboard((s) => s.users);
	const loading = useDashboard((s) => s.loading);
	const filters = useDashboard((s) => s.filters);
	const onFilterChange = useDashboard((s) => s.onFilterChange);
	const onEditingUser = useDashboard((s) => s.onEditingUser);
	const deleteUser = useDashboard((s) => s.deleteUser);
	const resetDataUsage = useDashboard((s) => s.resetDataUsage);
	const revokeSubscription = useDashboard((s) => s.revokeSubscription);
	const refetchUsers = useDashboard((s) => s.refetchUsers);
	const setQRCode = useDashboard((s) => s.setQRCode);
	const setSubLink = useDashboard((s) => s.setSubLink);
	const linkTemplates = useDashboard((s) => s.linkTemplates);
	const liveUserStats = useDashboard((s) => s.liveUserStats);

	const [copiedId, setCopiedId] = useState(null);
	const [expandedUser, setExpandedUser] = useState(null);
	const [openMenuUser, setOpenMenuUser] = useState(null);
	const [contextMenu, setContextMenu] = useState(null);
	const [connectionsUser, setConnectionsUser] = useState(null);
	const [connectionsTab, setConnectionsTab] = useState("ips");
	const [userIps, setUserIps] = useState([]);
	const [loadingIps, setLoadingIps] = useState(false);
	const [userHwids, setUserHwids] = useState([]);
	const [loadingHwids, setLoadingHwids] = useState(false);
	const [confirmDeleteUser, setConfirmDeleteUser] = useState(null);
	const [deleting, setDeleting] = useState(false);

	useEffect(() => {
		if (!contextMenu) return undefined;
		const close = () => setContextMenu(null);
		const onKey = (e) => {
			if (e.key === "Escape") close();
		};
		window.addEventListener("keydown", onKey);
		window.addEventListener("scroll", close, true);
		return () => {
			window.removeEventListener("keydown", onKey);
			window.removeEventListener("scroll", close, true);
		};
	}, [contextMenu]);

	useEffect(() => {
		if (!connectionsUser?.username) return;
		let cancelled = false;
		const encoded = encodeURIComponent(connectionsUser.username);
		setConnectionsTab("ips");
		setLoadingIps(true);
		setLoadingHwids(true);

		fetch(`/user/${encoded}/ips`)
			.then((res) => {
				if (!cancelled) {
					setUserIps(Array.isArray(res?.ips) ? res.ips : Array.isArray(res) ? res : []);
				}
			})
			.catch(() => {
				if (!cancelled) setUserIps([]);
			})
			.finally(() => {
				if (!cancelled) setLoadingIps(false);
			});

		fetch(`/user/${encoded}/hwids`)
			.then((res) => {
				if (!cancelled) {
					setUserHwids(Array.isArray(res?.hwids) ? res.hwids : Array.isArray(res) ? res : []);
				}
			})
			.catch(() => {
				if (!cancelled) setUserHwids([]);
			})
			.finally(() => {
				if (!cancelled) setLoadingHwids(false);
			});
		return () => {
			cancelled = true;
		};
	}, [connectionsUser?.username]);

	const handleRowContextMenu = (e, user) => {
		e.preventDefault();
		e.stopPropagation();
		setOpenMenuUser(null);
		const menuWidth = 224;
		const menuHeight = 310;
		const x = Math.max(8, Math.min(e.clientX, window.innerWidth - menuWidth - 12));
		const y = Math.max(8, Math.min(e.clientY, window.innerHeight - menuHeight - 12));
		setContextMenu({ user, x, y });
	};

	const users = usersResponse?.users || [];
	const total = usersResponse?.total ?? 0;
	const limit = filters.limit || 10;
	const offset = filters.offset || 0;
	const currentPage = Math.floor(offset / limit) + 1;
	const totalPages = Math.max(1, Math.ceil(total / limit));

	const formatSubLink = (link) => {
		if (!link) return "";
		return link.startsWith("/") ? window.location.origin + link : link;
	};

	const handleCopySub = (user) => {
		const url = formatSubLink(user.subscription_url);
		if (!url) return;
		void copyTextToClipboard(url).then(() => {
			setCopiedId(`sub-${user.username}`);
			window.setTimeout(() => setCopiedId(null), 1000);
		});
	};

	const handleCopyConfigs = async (user) => {
		let links = generateUserLinks(user, linkTemplates);
		if (!links.length) {
			try {
				const detail = await fetch(`/user/${encodeURIComponent(user.username)}`);
				links = Array.isArray(detail?.links) ? detail.links : [];
			} catch {
				links = [];
			}
		}
		if (!links.length) {
			appToast({ title: t("userDialog.links.noConfigs", "No config links"), status: "warning" });
			return;
		}
		await copyTextToClipboard(links.join("\n"));
		setCopiedId(`cfg-${user.username}`);
		window.setTimeout(() => setCopiedId(null), 1000);
	};

	const handleOpenQR = (user) => {
		const url = formatSubLink(user.subscription_url);
		if (url) {
			setSubLink(url);
			setQRCode(generateUserLinks(user, linkTemplates), user.username);
			return;
		}
		setSubLink(null);
		void fetch(`/user/${encodeURIComponent(user.username)}`)
			.then((detail) => setQRCode(Array.isArray(detail?.links) ? detail.links : [], user.username))
			.catch(() => setQRCode([], user.username));
	};

	const handleToggleStatus = async (user) => {
		setOpenMenuUser(null);
		const nextStatus = user.status === "disabled" ? "active" : "disabled";
		try {
			await fetch(`/v2/users/${encodeURIComponent(user.username)}`, {
				method: "PUT",
				body: { status: nextStatus },
			});
			appToast({
				title: nextStatus === "disabled" ? "User disabled" : "User enabled",
				status: "success",
			});
			refetchUsers(true);
		} catch (err) {
			appToast({ title: err?.message || "Failed to update status", status: "error" });
		}
	};

	const handleConfirmDelete = async () => {
		if (!confirmDeleteUser) return;
		setDeleting(true);
		try {
			await deleteUser(confirmDeleteUser);
			appToast({ title: t("deleteUser.success", "User deleted"), status: "success" });
			setConfirmDeleteUser(null);
		} catch (err) {
			appToast({ title: err?.message || "Failed to delete user", status: "error" });
		} finally {
			setDeleting(false);
		}
	};

	return (
		<>
			{/* Mobile Card List */}
			<div className="space-y-2.5 md:hidden">
				{loading && users.length === 0 ? (
					<Card className="py-12 text-center">
						<Spinner className="mx-auto h-5 w-5" />
					</Card>
				) : users.length === 0 ? (
					<Card className="py-12 text-center text-xs text-ink-subtle">
						{t("usersTable.noUsers", "No users found")}
					</Card>
				) : (
					users.map((user) => {
						const live = liveUserStats?.[user.username];
						const isOnline = live?.is_online ?? user.is_online;
						const used = user.used_traffic ?? 0;
						const dataLimit = user.data_limit ?? 0;
						const pct = dataLimit > 0 ? Math.min(100, Math.round((used / dataLimit) * 100)) : 0;
						const expiry = formatExpiry(user, t);
						const isExpanded = expandedUser === user.username;
						const remainingTraffic = dataLimit > 0 ? Math.max(0, dataLimit - used) : null;
						const lifetimeUsed = user.lifetime_used_traffic ?? used;
						const lastConnection = isOnline
							? t("online", "Online")
							: user.online_at
								? dayjs(user.online_at).fromNow()
								: "—";
						const liveSpeed = isOnline && live && (live.upload_speed > 0 || live.download_speed > 0)
							? `↑ ${formatBytes(live.upload_speed)}/s · ↓ ${formatBytes(live.download_speed)}/s`
							: "—";

						return (
							<div
								key={`mobile-${user.username}`}
								onClick={() => setExpandedUser(isExpanded ? null : user.username)}
								className={`cursor-pointer rounded-xl border px-3.5 py-3 transition-all ${
									isExpanded
										? "border-accent/40 bg-surface-1 shadow-lg shadow-black/25"
										: "border-white/[0.06] bg-surface-1 hover:border-white/[0.12]"
								}`}
							>
								{/* Row 1: Username + Inline Service + Status + Quick Link/More */}
								<div className="flex items-center justify-between gap-2">
									<div className="flex min-w-0 flex-1 items-center gap-2">
										<span
											className={`h-2 w-2 shrink-0 rounded-full ${
												isOnline
													? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.75)]"
													: "bg-white/20"
											}`}
										/>
										<span className="truncate text-[13.5px] font-semibold text-ink">
											{user.username}
										</span>
									</div>

									<div
										className="flex shrink-0 items-center gap-1.5"
										onClick={(e) => e.stopPropagation()}
									>
										{isOnline && (
											<button
												type="button"
												onClick={() => setConnectionsUser(user)}
												className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-400"
											>
												{t("online", "Online")}
											</button>
										)}
										<Badge variant={statusVariantMap[user.status] || "neutral"}>
											{t(`status_${user.status}`, statusLabelMap[user.status] || user.status)}
										</Badge>
										<button
											type="button"
											disabled={!user.subscription_url}
											onClick={() => handleCopySub(user)}
											aria-label="Copy link"
											className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-35"
										>
											{copiedId === `sub-${user.username}` ? (
												<CheckIcon className="h-3.5 w-3.5 text-emerald-400" />
											) : (
												<LinkIcon className="h-3.5 w-3.5" />
											)}
										</button>
										<button
											type="button"
											onClick={() => setExpandedUser(isExpanded ? null : user.username)}
											aria-label="More actions"
											className={`inline-flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
												isExpanded
													? "bg-surface-2 text-ink"
													: "text-ink-tertiary hover:bg-surface-2 hover:text-ink"
											}`}
										>
											<EllipsisHorizontalIcon className="h-4 w-4" />
										</button>
									</div>
								</div>

								{/* Row 2: Traffic + Expiry + Thin Progress */}
								<div className="mt-2 ps-4">
									<div className="flex items-center justify-between gap-2 text-[11px] tabular-nums">
										<span className="truncate text-ink-muted">
											<span className="font-medium text-ink">{formatBytes(used)}</span>
											{" / "}
											{dataLimit > 0 ? formatBytes(dataLimit) : "∞"}
											{dataLimit > 0 && pct > 0 && (
												<span className="ms-1 text-[10px] text-ink-tertiary">({pct}%)</span>
											)}
										</span>
										<span
											className={`shrink-0 ${
												expiry.danger ? "font-medium text-red-400" : "text-ink-tertiary"
											}`}
										>
											{expiry.text}
										</span>
									</div>
									<div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-surface-2">
										<div
											className={`h-full rounded-full transition-all ${
												pct >= 90 ? "bg-red-500" : "bg-accent"
											}`}
											style={{ width: `${dataLimit > 0 ? pct : 0}%` }}
										/>
									</div>
								</div>

								{/* Expanded: Details + Actions */}
								{isExpanded && (
									<div
										className="mt-3 space-y-2.5 border-t border-white/[0.06] pt-2.5"
										onClick={(e) => e.stopPropagation()}
									>
										<div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
											{user.admin?.username && (
												<div>
													<span className="text-ink-tertiary">Admin: </span>
													<span className="font-medium text-ink">{user.admin.username}</span>
												</div>
											)}
											{user.service_name && (
												<div>
													<span className="text-ink-tertiary">{t("service", "Service")}: </span>
													<span className="font-medium text-ink">{user.service_name}</span>
												</div>
											)}
											<div>
												<span className="text-ink-tertiary">{t("usersTable.speed", "Speed")}: </span>
												<span className="font-medium tabular-nums text-ink">{liveSpeed}</span>
											</div>
											<div>
												<span className="text-ink-tertiary">{t("usersTable.remainingTraffic", "Remaining")}: </span>
												<span className="font-medium tabular-nums text-ink">
													{remainingTraffic !== null ? formatBytes(remainingTraffic) : "∞"}
												</span>
											</div>
											<div>
												<span className="text-ink-tertiary">{t("usersTable.lifetime", "Lifetime")}: </span>
												<span className="font-medium tabular-nums text-ink">{formatBytes(lifetimeUsed)}</span>
											</div>
											<div>
												<span className="text-ink-tertiary">{t("usersTable.lastConnection", "Last connection")}: </span>
												<span className="font-medium text-ink">{lastConnection}</span>
											</div>
										</div>

										<div className="flex items-center justify-between gap-1 pt-0.5">
											<div className="flex items-center gap-1">
												<button
													type="button"
													onClick={() => void handleCopyConfigs(user)}
													className="inline-flex h-7 items-center gap-1 rounded-lg bg-surface-2 px-2.5 text-[11px] font-medium text-ink-muted transition-colors hover:text-ink"
												>
													{copiedId === `cfg-${user.username}` ? (
														<CheckIcon className="h-3.5 w-3.5 text-emerald-400" />
													) : (
														<ClipboardDocumentIcon className="h-3.5 w-3.5" />
													)}
													<span>Configs</span>
												</button>
												<button
													type="button"
													onClick={() => handleOpenQR(user)}
													aria-label={t("usersTable.qrCode", "QR Code")}
													className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-surface-2 text-ink-muted transition-colors hover:text-ink"
												>
													<QrCodeIcon className="h-3.5 w-3.5" />
												</button>
												<button
													type="button"
													onClick={() => setConnectionsUser(user)}
													aria-label={t("liveConnections.title", "Connections & Devices")}
													className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-surface-2 text-ink-muted transition-colors hover:text-ink"
												>
													<SignalIcon className="h-3.5 w-3.5" />
												</button>
											</div>

											<div className="flex items-center gap-1">
												<button
													type="button"
													onClick={() => void handleToggleStatus(user)}
													aria-label={user.status === "disabled" ? t("enable", "Turn On") : t("disable", "Turn Off")}
													className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-surface-2 transition-colors"
												>
													<PowerIcon
														className={`h-3.5 w-3.5 ${
															user.status === "disabled" ? "text-red-400" : "text-emerald-400"
														}`}
													/>
												</button>
												<button
													type="button"
													onClick={() => onEditingUser(user)}
													aria-label={t("userDialog.editUser", "Edit")}
													className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-surface-2 text-ink-muted transition-colors hover:text-ink"
												>
													<PencilSquareIcon className="h-3.5 w-3.5" />
												</button>
												<button
													type="button"
													onClick={() => setConfirmDeleteUser(user)}
													aria-label={t("delete", "Delete")}
													className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/10 text-red-400 transition-colors hover:bg-red-500/20"
												>
													<TrashIcon className="h-3.5 w-3.5" />
												</button>
											</div>
										</div>
									</div>
								)}
							</div>
						);
					})
				)}
			</div>

			<Card className="mt-2.5 overflow-hidden md:mt-0">
				{/* Desktop Table */}
				<div className="hidden overflow-x-auto md:block">
					<table className="w-full border-collapse text-start text-xs">
						<thead>
							<tr className="border-b border-hairline bg-surface-2 text-[11px] font-medium uppercase tracking-wider text-ink-tertiary">
								<th className="px-3.5 py-2.5 text-start">Online</th>
								<th className="px-3.5 py-2.5 text-start">{t("username", "Username")}</th>
								<th className="px-3.5 py-2.5 text-start">{t("status", "Status")}</th>
								<th className="hidden px-3.5 py-2.5 text-start md:table-cell">{t("service", "Service")}</th>
								<th className="px-3.5 py-2.5 text-start">{t("traffic", "Traffic")}</th>
								<th className="hidden px-3.5 py-2.5 text-start sm:table-cell">{t("expiry", "Expiry")}</th>
								<th className="px-3.5 py-2.5 text-end">{t("actions", "Actions")}</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-hairline">
							{loading && users.length === 0 ? (
								<tr>
									<td colSpan={7} className="py-12 text-center">
										<Spinner className="mx-auto h-5 w-5" />
									</td>
								</tr>
							) : users.length === 0 ? (
								<tr>
									<td colSpan={7} className="py-12 text-center text-ink-subtle">
										{t("usersTable.noUsers", "No users found")}
									</td>
								</tr>
							) : (
								users.map((user) => {
									const live = liveUserStats?.[user.username];
									const isOnline = live?.is_online ?? user.is_online;
									const used = user.used_traffic ?? 0;
									const dataLimit = user.data_limit ?? 0;
									const pct = dataLimit > 0 ? Math.min(100, Math.round((used / dataLimit) * 100)) : 0;
									const expiry = formatExpiry(user, t);
									const menuOpen = openMenuUser === user.username;

									const isExpanded = expandedUser === user.username;
									const remainingTraffic = dataLimit > 0 ? Math.max(0, dataLimit - used) : null;
									const lifetimeUsed = user.lifetime_used_traffic ?? used;
									const lastConnection = isOnline
										? t("online", "Online")
										: user.online_at
											? dayjs(user.online_at).fromNow()
											: "—";
									const liveSpeed = isOnline && live && (live.upload_speed > 0 || live.download_speed > 0)
										? `↑ ${formatBytes(live.upload_speed)}/s · ↓ ${formatBytes(live.download_speed)}/s`
										: "—";

									return (
										<Fragment key={user.username}>
											<tr
												onClick={() => setExpandedUser(isExpanded ? null : user.username)}
												onContextMenu={(e) => handleRowContextMenu(e, user)}
												className={`cursor-pointer transition-colors hover:bg-surface-2 ${isExpanded ? "bg-surface-2/80" : ""}`}
											>
											<td className="px-3.5 py-2.5 whitespace-nowrap">
												<span
													className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
														isOnline
															? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
															: "border-hairline bg-surface-2 text-ink-tertiary"
													}`}
												>
													<span
														className={`h-1.5 w-1.5 rounded-full ${
															isOnline ? "bg-emerald-400" : "bg-ink-tertiary"
														}`}
													/>
													{isOnline ? "Online" : "Offline"}
												</span>
											</td>

											<td className="px-3.5 py-2.5">
												<div className="font-medium text-ink">{user.username}</div>
												{user.admin_username && (
													<div className="text-[11px] text-ink-tertiary">
														by {user.admin_username}
													</div>
												)}
											</td>

											<td className="px-3.5 py-2.5 whitespace-nowrap">
												<Badge variant={statusVariantMap[user.status] || "neutral"}>
													{t(`status_${user.status}`, statusLabelMap[user.status] || user.status)}
												</Badge>
											</td>

											<td className="hidden px-3.5 py-2.5 text-ink-muted md:table-cell">
												{user.service_name || "—"}
											</td>

											<td className="px-3.5 py-2.5 min-w-[140px]">
												<div className="flex items-center justify-between gap-2 text-[11px] tabular-nums">
													<span className="text-ink-muted">
														{formatBytes(used)} / {dataLimit > 0 ? formatBytes(dataLimit) : "∞"}
													</span>
													<span className="text-ink-tertiary">
														{dataLimit > 0 ? `${pct}%` : "∞"}
													</span>
												</div>
												<div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-surface-3">
													<div
														className={`h-full rounded-full ${
															pct >= 90 ? "bg-red-500" : "bg-accent"
														}`}
														style={{ width: `${dataLimit > 0 ? pct : 0}%` }}
													/>
												</div>
											</td>

											<td className="hidden px-3.5 py-2.5 whitespace-nowrap tabular-nums sm:table-cell">
												<span className={expiry.danger ? "font-medium text-red-400" : "text-ink-muted"}>
													{expiry.text}
												</span>
											</td>

											<td
												className="px-3.5 py-2.5 text-end whitespace-nowrap"
												onClick={(e) => e.stopPropagation()}
											>
												<div className="relative inline-flex items-center gap-0.5">
													<IconButton
														title={t("usersTable.copyLink", "Copy subscription")}
														disabled={!user.subscription_url}
														onClick={() => handleCopySub(user)}
													>
														{copiedId === `sub-${user.username}` ? (
															<CheckIcon className="h-4 w-4 text-emerald-400" />
														) : (
															<LinkIcon className="h-4 w-4" />
														)}
													</IconButton>
													<IconButton
														title={t("usersTable.copyConfigs", "Copy configs")}
														onClick={() => void handleCopyConfigs(user)}
													>
														{copiedId === `cfg-${user.username}` ? (
															<CheckIcon className="h-4 w-4 text-emerald-400" />
														) : (
															<ClipboardDocumentIcon className="h-4 w-4" />
														)}
													</IconButton>
													<IconButton
														title={t("usersTable.qrCode", "QR Code")}
														onClick={() => handleOpenQR(user)}
													>
														<QrCodeIcon className="h-4 w-4" />
													</IconButton>
													<IconButton
														title={user.status === "disabled" ? t("enable", "Turn On") : t("disable", "Turn Off")}
														onClick={() => void handleToggleStatus(user)}
													>
														<PowerIcon
															className={`h-4 w-4 ${
																user.status === "disabled" ? "text-red-400" : "text-emerald-400"
															}`}
														/>
													</IconButton>
													<IconButton
														title={t("userDialog.editUser", "Edit")}
														onClick={() => onEditingUser(user)}
													>
														<PencilSquareIcon className="h-4 w-4" />
													</IconButton>
													<IconButton
														title={t("actions", "More")}
														onClick={() => setOpenMenuUser(menuOpen ? null : user.username)}
													>
														<EllipsisHorizontalIcon className="h-4 w-4" />
													</IconButton>

													{menuOpen && (
														<>
															<div
																className="fixed inset-0 z-40"
																onClick={() => setOpenMenuUser(null)}
															/>
															<div className="rb-anim-menu absolute end-0 top-8 z-50 w-44 origin-top-right rounded-lg border border-hairline-strong bg-surface-1 p-1 text-start shadow-xl">
																<button
																	type="button"
																	onClick={() => {
																		setOpenMenuUser(null);
																		void resetDataUsage(user).then(() =>
																			appToast({ title: "Usage reset", status: "success" }),
																		);
																	}}
																	className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-ink-muted hover:bg-surface-2 hover:text-ink"
																>
																	<ArrowPathIcon className="h-3.5 w-3.5" />
																	<span>{t("resetUsage.title", "Reset Usage")}</span>
																</button>
																<button
																	type="button"
																	onClick={() => {
																		setOpenMenuUser(null);
																		void revokeSubscription(user).then(() =>
																			appToast({ title: "Subscription revoked", status: "success" }),
																		);
																	}}
																	className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-ink-muted hover:bg-surface-2 hover:text-ink"
																>
																	<KeyIcon className="h-3.5 w-3.5" />
																	<span>{t("revokeSubscription.title", "Revoke Sub")}</span>
																</button>
																<button
																	type="button"
																	onClick={() => void handleToggleStatus(user)}
																	className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-ink-muted hover:bg-surface-2 hover:text-ink"
																>
																	<span>
																		{user.status === "disabled" ? "Enable User" : "Disable User"}
																	</span>
																</button>
																<div className="my-1 border-t border-hairline" />
																<button
																	type="button"
																	onClick={() => {
																		setOpenMenuUser(null);
																		setConfirmDeleteUser(user);
																	}}
																	className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-red-400 hover:bg-red-500/10"
																>
																	<TrashIcon className="h-3.5 w-3.5" />
																	<span>{t("delete", "Delete")}</span>
																</button>
															</div>
														</>
													)}
												</div>
											</td>
										</tr>
										{isExpanded && (
											<tr className="bg-surface-2/50">
												<td colSpan={7} className="border-t border-hairline px-4 py-3.5">
													<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
														<div className="space-y-1.5 text-xs">
															<div className="flex items-center gap-2">
																<span className="text-ink-tertiary">{t("username", "Username")}</span>
																<span className="font-medium text-ink">{user.username}</span>
															</div>
															<div className="flex items-center gap-2">
																<span className="text-ink-tertiary">{t("service", "Service")}</span>
																<span className="font-medium text-ink">{user.service_name || "—"}</span>
															</div>
															<div className="flex items-center gap-2">
																<span className="text-ink-tertiary">{t("usersTable.speed", "Speed")}</span>
																<span className="font-medium tabular-nums text-ink">{liveSpeed}</span>
															</div>
															<div className="flex items-center gap-2">
																<span className="text-ink-tertiary">{t("usersTable.lifetime", "Lifetime")}</span>
																<span className="font-medium tabular-nums text-ink">{formatBytes(lifetimeUsed)}</span>
															</div>
															<div className="flex items-center gap-2">
																<span className="text-ink-tertiary">{t("admin", "Admin")}</span>
																<span className="font-medium text-ink">
																	{user.admin_username ? `by ${user.admin_username}` : "—"}
																</span>
															</div>
														</div>

														<div className="space-y-1.5 text-xs">
															<div className="flex items-center gap-2">
																<span className="text-ink-tertiary">{t("status", "Status")}</span>
																<Badge variant={statusVariantMap[user.status] || "neutral"}>
																	{t(`status_${user.status}`, statusLabelMap[user.status] || user.status)}
																</Badge>
															</div>
															<div className="flex items-center gap-2">
																<span className="text-ink-tertiary">{t("traffic", "Traffic")}</span>
																<span className="font-medium tabular-nums text-ink">
																	{formatBytes(used)} / {dataLimit > 0 ? formatBytes(dataLimit) : "∞"}
																</span>
															</div>
															<div className="flex items-center gap-2">
																<span className="text-ink-tertiary">{t("usersTable.remainingTraffic", "Remaining traffic")}</span>
																<span className="font-medium tabular-nums text-ink">
																	{remainingTraffic !== null ? formatBytes(remainingTraffic) : "∞"}
																</span>
															</div>
															<div className="flex items-center gap-2">
																<span className="text-ink-tertiary">{t("expiry", "Expiry")}</span>
																<span className={`font-medium tabular-nums ${expiry.danger ? "text-red-400" : "text-ink"}`}>
																	{expiry.text}
																</span>
															</div>
															<div className="flex items-center gap-2">
																<span className="text-ink-tertiary">{t("usersTable.lastConnection", "Last connection")}</span>
																<span className={`font-medium tabular-nums ${isOnline ? "text-emerald-400" : "text-ink"}`}>
																	{lastConnection}
																</span>
															</div>
														</div>
													</div>

													<div
														className="mt-3 flex items-center justify-end gap-1 border-t border-hairline pt-2.5"
														onClick={(e) => e.stopPropagation()}
													>
														<IconButton
															title={user.status === "disabled" ? t("enable", "Enable User") : t("disable", "Disable User")}
															onClick={() => void handleToggleStatus(user)}
														>
															<NoSymbolIcon
																className={`h-4 w-4 ${user.status === "disabled" ? "text-emerald-400" : ""}`}
															/>
														</IconButton>
														<IconButton
															title={t("resetUsage.title", "Reset Usage")}
															onClick={() =>
																void resetDataUsage(user).then(() =>
																	appToast({ title: "Usage reset", status: "success" }),
																)
															}
														>
															<ArrowPathIcon className="h-4 w-4" />
														</IconButton>
														<IconButton
															title={t("usersTable.copyLink", "Copy subscription")}
															disabled={!user.subscription_url}
															onClick={() => handleCopySub(user)}
														>
															{copiedId === `sub-${user.username}` ? (
																<CheckIcon className="h-4 w-4 text-emerald-400" />
															) : (
																<LinkIcon className="h-4 w-4" />
															)}
														</IconButton>
														<IconButton
															title={t("usersTable.copyConfigs", "Copy configs")}
															onClick={() => void handleCopyConfigs(user)}
														>
															{copiedId === `cfg-${user.username}` ? (
																<CheckIcon className="h-4 w-4 text-emerald-400" />
															) : (
																<ClipboardDocumentIcon className="h-4 w-4" />
															)}
														</IconButton>
														<IconButton
															title={t("usersTable.qrCode", "QR Code")}
															onClick={() => handleOpenQR(user)}
														>
															<QrCodeIcon className="h-4 w-4" />
														</IconButton>
														<IconButton
															title={t("userDialog.editUser", "Edit")}
															onClick={() => onEditingUser(user)}
														>
															<PencilSquareIcon className="h-4 w-4" />
														</IconButton>
														<IconButton
															title={t("delete", "Delete")}
															onClick={() => setConfirmDeleteUser(user)}
														>
															<TrashIcon className="h-4 w-4 text-red-400" />
														</IconButton>
													</div>
												</td>
											</tr>
										)}
										</Fragment>
									);
								})
							)}
						</tbody>
					</table>
				</div>

				{/* Pagination */}
				<div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline bg-surface-2 px-4 py-2.5 text-xs text-ink-subtle">
					<div className="flex items-center gap-2">
						<Select
							value={limit}
							onChange={(e) =>
								onFilterChange({
									limit: Number(e.target.value),
									offset: 0,
								})
							}
							className="!h-7 !w-20 text-xs"
						>
							{[10, 25, 50, 100].map((size) => (
								<option key={size} value={size}>
									{size}
								</option>
							))}
						</Select>
						<span>{t("itemsPerPage", "Items per page")}</span>
					</div>

					<div className="flex items-center gap-2">
						<Button
							size="xs"
							disabled={currentPage <= 1}
							onClick={() => onFilterChange({ offset: Math.max(0, offset - limit) })}
						>
							<ChevronLeftIcon className="h-3.5 w-3.5" />
							<span>{t("previous", "Previous")}</span>
						</Button>
						<span className="px-2 tabular-nums text-ink-muted">
							{currentPage} / {totalPages}
						</span>
						<Button
							size="xs"
							disabled={currentPage >= totalPages}
							onClick={() => onFilterChange({ offset: offset + limit })}
						>
							<span>{t("next", "Next")}</span>
							<ChevronRightIcon className="h-3.5 w-3.5" />
						</Button>
					</div>
				</div>
			</Card>

			{contextMenu && (
				<>
					<div
						className="fixed inset-0 z-40"
						onMouseDown={(e) => {
							e.stopPropagation();
							setContextMenu(null);
						}}
						onClick={(e) => {
							e.stopPropagation();
							setContextMenu(null);
						}}
						onContextMenu={(e) => {
							e.preventDefault();
							e.stopPropagation();
							setContextMenu(null);
						}}
					/>
					<div
						style={{ left: contextMenu.x, top: contextMenu.y }}
						className="rb-anim-menu fixed z-50 w-56 rounded-xl border border-hairline-strong bg-surface-1 p-1.5 text-start shadow-2xl"
					>
						<button
							type="button"
							onClick={() => {
								const target = contextMenu.user;
								setContextMenu(null);
								onEditingUser(target);
							}}
							className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-ink transition-colors hover:bg-surface-2"
						>
							<PencilSquareIcon className="h-4 w-4 text-ink-muted" />
							<span>{t("userDialog.editUser", "Edit user")}</span>
						</button>

						<button
							type="button"
							disabled={!contextMenu.user.subscription_url}
							onClick={() => {
								const target = contextMenu.user;
								setContextMenu(null);
								handleCopySub(target);
								appToast({ title: t("copied", "Subscription link copied"), status: "success" });
							}}
							className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-ink transition-colors hover:bg-surface-2 disabled:opacity-40"
						>
							<LinkIcon className="h-4 w-4 text-ink-muted" />
							<span>{t("usersTable.copyLink", "Copy Subscription Link")}</span>
						</button>

						<button
							type="button"
							onClick={() => {
								const target = contextMenu.user;
								setContextMenu(null);
								void handleCopyConfigs(target).then(() =>
									appToast({ title: t("copied", "Configs copied"), status: "success" }),
								);
							}}
							className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-ink transition-colors hover:bg-surface-2"
						>
							<ClipboardDocumentIcon className="h-4 w-4 text-ink-muted" />
							<span>{t("usersTable.copyConfigs", "Copy Configs")}</span>
						</button>

						<button
							type="button"
							onClick={() => {
								const target = contextMenu.user;
								setContextMenu(null);
								handleOpenQR(target);
							}}
							className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-ink transition-colors hover:bg-surface-2"
						>
							<QrCodeIcon className="h-4 w-4 text-ink-muted" />
							<span>{t("usersTable.qrCode", "QR Code")}</span>
						</button>

						<button
							type="button"
							onClick={() => {
								const target = contextMenu.user;
								setContextMenu(null);
								setConnectionsUser(target);
							}}
							className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-ink transition-colors hover:bg-surface-2"
						>
							<SignalIcon className="h-4 w-4 text-ink-muted" />
							<span>{t("usersTable.connectionsAndDevices", "Connections & Devices")}</span>
						</button>

						<div className="my-1 border-t border-hairline" />

						<button
							type="button"
							onClick={() => {
								const target = contextMenu.user;
								setContextMenu(null);
								void handleToggleStatus(target);
							}}
							className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-ink transition-colors hover:bg-surface-2"
						>
							<NoSymbolIcon
								className={`h-4 w-4 ${
									contextMenu.user.status === "disabled" ? "text-emerald-400" : "text-ink-muted"
								}`}
							/>
							<span>
								{contextMenu.user.status === "disabled"
									? t("enableUser", "Enable user")
									: t("disableUser", "Disable user")}
							</span>
						</button>

						<button
							type="button"
							onClick={() => {
								const target = contextMenu.user;
								setContextMenu(null);
								void resetDataUsage(target).then(() =>
									appToast({ title: t("resetUsage.success", "Usage reset"), status: "success" }),
								);
							}}
							className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-ink transition-colors hover:bg-surface-2"
						>
							<ArrowPathIcon className="h-4 w-4 text-ink-muted" />
							<span>{t("resetUsage.title", "Reset usage")}</span>
						</button>

						<div className="my-1 border-t border-hairline" />

						<button
							type="button"
							onClick={() => {
								const target = contextMenu.user;
								setContextMenu(null);
								setConfirmDeleteUser(target);
							}}
							className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10"
						>
							<TrashIcon className="h-4 w-4" />
							<span>{t("deleteUser.title", "Delete User")}</span>
						</button>
					</div>
				</>
			)}

			<Modal
				open={Boolean(connectionsUser)}
				onClose={() => setConnectionsUser(null)}
				title={connectionsUser ? `${connectionsUser.username} · Connections & Devices` : "Connections & Devices"}
				maxWidth="max-w-lg"
				footer={
					<div className="flex w-full items-center justify-between gap-2">
						<Button
							size="sm"
							onClick={() => {
								setConnectionsUser(null);
								navigate("/access-insights");
							}}
						>
							<SignalIcon className="h-3.5 w-3.5" />
							<span>{t("header.accessInsights", "Live connections")}</span>
						</Button>
						<Button size="sm" variant="primary" onClick={() => setConnectionsUser(null)}>
							{t("close", "Close")}
						</Button>
					</div>
				}
			>
				{connectionsUser && (
					<div className="space-y-4">
						<div className="flex items-center justify-between rounded-xl border border-hairline bg-surface-2 px-3.5 py-2.5 text-xs">
							<div className="flex items-center gap-2">
								<span
									className={`h-2 w-2 rounded-full ${
										(liveUserStats?.[connectionsUser.username]?.is_online ?? connectionsUser.is_online)
											? "bg-emerald-400"
											: "bg-ink-tertiary"
									}`}
								/>
								<span className="font-medium text-ink">
									{(liveUserStats?.[connectionsUser.username]?.is_online ?? connectionsUser.is_online)
										? "Online"
										: "Offline"}
								</span>
							</div>
							<div className="flex items-center gap-3 tabular-nums text-ink-muted">
								<span>
									↑ {formatBytes(liveUserStats?.[connectionsUser.username]?.upload_speed || 0)}/s
								</span>
								<span>
									↓ {formatBytes(liveUserStats?.[connectionsUser.username]?.download_speed || 0)}/s
								</span>
							</div>
						</div>

						<div className="grid grid-cols-2 gap-1 rounded-lg border border-hairline bg-surface-2 p-1">
							<button
								type="button"
								onClick={() => setConnectionsTab("ips")}
								className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
									connectionsTab === "ips"
										? "bg-surface-3 text-ink shadow-sm"
										: "text-ink-subtle hover:text-ink"
								}`}
							>
								<span>{t("usersTable.ipsTab", "Connected IPs")}</span>
								<span className="rounded-full bg-surface-1 px-1.5 py-0.5 text-[10px] tabular-nums text-ink-muted">
									{userIps.length}
								</span>
							</button>
							<button
								type="button"
								onClick={() => setConnectionsTab("hwid")}
								className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
									connectionsTab === "hwid"
										? "bg-surface-3 text-ink shadow-sm"
										: "text-ink-subtle hover:text-ink"
								}`}
							>
								<span>{t("usersTable.hwidTab", "Devices (HWID)")}</span>
								<span className="rounded-full bg-surface-1 px-1.5 py-0.5 text-[10px] tabular-nums text-ink-muted">
									{userHwids.length}
								</span>
							</button>
						</div>

						{connectionsTab === "ips" ? (
							<div>
								{loadingIps ? (
									<div className="flex justify-center py-6">
										<Spinner className="h-5 w-5" />
									</div>
								) : userIps.length === 0 ? (
									<div className="rounded-xl border border-hairline bg-surface-2 p-4 text-center text-xs text-ink-tertiary">
										{t("usersTable.noOnlineIps", "No active IP connections recorded")}
									</div>
								) : (
									<div className="max-h-56 space-y-2 overflow-y-auto">
										{userIps.map((item, i) => {
											const nodeLabel = Array.isArray(item.node_names) && item.node_names.length
												? item.node_names.join(", ")
												: item.node_name || "";
											const operatorLabel = item.operator_owner || item.operator_short_name || "";
											return (
												<div
													key={`${item.ip}-${item.node_id || i}`}
													className="flex items-center justify-between gap-2 rounded-lg border border-hairline bg-surface-2 px-3 py-2 text-xs"
												>
													<div className="min-w-0">
														<div className="truncate font-mono text-ink">{item.ip}</div>
														<div className="truncate text-[11px] text-ink-tertiary">
															{[nodeLabel, operatorLabel].filter(Boolean).join(" · ") || "—"}
														</div>
													</div>
													<div className="flex shrink-0 items-center gap-1.5">
														{item.protocol && (
															<Badge variant="accent">{String(item.protocol).toUpperCase()}</Badge>
														)}
														{item.last_seen_at && (
															<span className="text-[11px] text-ink-tertiary">
																{dayjs(item.last_seen_at).fromNow()}
															</span>
														)}
													</div>
												</div>
											);
										})}
									</div>
								)}
							</div>
						) : (
							<div>
								{loadingHwids ? (
									<div className="flex justify-center py-6">
										<Spinner className="h-5 w-5" />
									</div>
								) : userHwids.length === 0 ? (
									<div className="rounded-xl border border-hairline bg-surface-2 p-4 text-center text-xs text-ink-tertiary">
										{t("usersTable.noHwids", "No connected devices recorded")}
									</div>
								) : (
									<div className="max-h-56 space-y-2 overflow-y-auto">
										{userHwids.map((hw, i) => (
											<div
												key={hw.hwid || i}
												className="flex items-center justify-between rounded-lg border border-hairline bg-surface-2 px-3 py-2 text-xs"
											>
												<div className="min-w-0">
													<div className="truncate font-mono text-ink">{hw.hwid}</div>
													<div className="text-[11px] text-ink-tertiary">
														{hw.device_model || hw.platform || "Device"}
													</div>
												</div>
												<Badge>{hw.platform || "HWID"}</Badge>
											</div>
										))}
									</div>
								)}
							</div>
						)}
					</div>
				)}
			</Modal>

			<Modal
				open={Boolean(confirmDeleteUser)}
				onClose={() => setConfirmDeleteUser(null)}
				title={t("deleteUser.title", "Delete User")}
				maxWidth="max-w-sm"
				footer={
					<>
						<Button size="sm" onClick={() => setConfirmDeleteUser(null)}>
							{t("cancel", "Cancel")}
						</Button>
						<Button size="sm" variant="danger" loading={deleting} onClick={() => void handleConfirmDelete()}>
							{t("delete", "Delete")}
						</Button>
					</>
				}
			>
				<p className="text-sm text-ink-muted">
					{t("deleteUser.prompt", { username: confirmDeleteUser?.username }) ||
						`Are you sure you want to delete "${confirmDeleteUser?.username}"?`}
				</p>
			</Modal>
		</>
	);
};

export default UsersTable;
