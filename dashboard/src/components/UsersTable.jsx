import {
	ArrowPathIcon,
	CheckIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	ClipboardDocumentIcon,
	EllipsisHorizontalIcon,
	KeyIcon,
	LinkIcon,
	PencilSquareIcon,
	QrCodeIcon,
	TrashIcon,
} from "@heroicons/react/24/outline";
import dayjs from "dayjs";
import { useState } from "react";
import { useTranslation } from "react-i18next";
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

const formatExpiry = (user, t) => {
	if (user.status === "expired") {
		return { text: t("expired") || "EXPIRED", danger: true };
	}
	if (user.status === "on_hold") {
		const days = user.on_hold_expire_duration
			? Math.round(user.on_hold_expire_duration / 86400)
			: null;
		return { text: days ? `${days}d on hold` : "On Hold", danger: false };
	}
	if (!user.expire) {
		return { text: "∞", danger: false };
	}
	const diff = user.expire * 1000 - Date.now();
	if (diff <= 0) {
		return { text: t("expired") || "EXPIRED", danger: true };
	}
	return { text: dayjs.unix(user.expire).fromNow(true), danger: diff < 3 * 86400 * 1000 };
};

export const UsersTable = () => {
	const { t } = useTranslation();
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
	const [openMenuUser, setOpenMenuUser] = useState(null);
	const [confirmDeleteUser, setConfirmDeleteUser] = useState(null);
	const [deleting, setDeleting] = useState(false);

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
			appToast({ title: t("userDialog.links.noConfigs") || "No config links", status: "warning" });
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
			appToast({ title: t("deleteUser.success") || "User deleted", status: "success" });
			setConfirmDeleteUser(null);
		} catch (err) {
			appToast({ title: err?.message || "Failed to delete user", status: "error" });
		} finally {
			setDeleting(false);
		}
	};

	return (
		<>
			<Card className="overflow-hidden">
				<div className="overflow-x-auto">
					<table className="w-full border-collapse text-start text-xs">
						<thead>
							<tr className="border-b border-hairline bg-surface-2/60 text-[11px] font-medium uppercase tracking-wider text-ink-tertiary">
								<th className="px-3.5 py-2.5 text-start">Online</th>
								<th className="px-3.5 py-2.5 text-start">{t("username") || "Username"}</th>
								<th className="px-3.5 py-2.5 text-start">{t("status") || "Status"}</th>
								<th className="hidden px-3.5 py-2.5 text-start md:table-cell">{t("service") || "Service"}</th>
								<th className="px-3.5 py-2.5 text-start">{t("traffic") || "Traffic"}</th>
								<th className="hidden px-3.5 py-2.5 text-start sm:table-cell">{t("expiry") || "Expiry"}</th>
								<th className="px-3.5 py-2.5 text-end">{t("actions") || "Actions"}</th>
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
										{t("usersTable.noUsers") || "No users found"}
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

									return (
										<tr
											key={user.username}
											onClick={() => onEditingUser(user)}
											className="cursor-pointer transition-colors hover:bg-surface-2/70"
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
													{t(`status_${user.status}`) || user.status}
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
														title={t("usersTable.copyLink") || "Copy subscription"}
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
														title={t("usersTable.copyConfigs") || "Copy configs"}
														onClick={() => void handleCopyConfigs(user)}
													>
														{copiedId === `cfg-${user.username}` ? (
															<CheckIcon className="h-4 w-4 text-emerald-400" />
														) : (
															<ClipboardDocumentIcon className="h-4 w-4" />
														)}
													</IconButton>
													<IconButton
														title={t("usersTable.qrCode") || "QR Code"}
														onClick={() => handleOpenQR(user)}
													>
														<QrCodeIcon className="h-4 w-4" />
													</IconButton>
													<IconButton
														title={t("userDialog.editUser") || "Edit"}
														onClick={() => onEditingUser(user)}
													>
														<PencilSquareIcon className="h-4 w-4" />
													</IconButton>
													<IconButton
														title={t("actions") || "More"}
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
															<div className="absolute end-0 top-8 z-50 w-44 rounded-lg border border-hairline-strong bg-surface-1 p-1 text-start shadow-xl">
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
																	<span>{t("resetUsage.title") || "Reset Usage"}</span>
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
																	<span>{t("revokeSubscription.title") || "Revoke Sub"}</span>
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
																	<span>{t("delete") || "Delete"}</span>
																</button>
															</div>
														</>
													)}
												</div>
											</td>
										</tr>
									);
								})
							)}
						</tbody>
					</table>
				</div>

				{/* Pagination */}
				<div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline bg-surface-2/40 px-4 py-2.5 text-xs text-ink-subtle">
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
						<span>{t("itemsPerPage") || "Items per page"}</span>
					</div>

					<div className="flex items-center gap-2">
						<Button
							size="xs"
							disabled={currentPage <= 1}
							onClick={() => onFilterChange({ offset: Math.max(0, offset - limit) })}
						>
							<ChevronLeftIcon className="h-3.5 w-3.5" />
							<span>{t("previous") || "Previous"}</span>
						</Button>
						<span className="px-2 tabular-nums text-ink-muted">
							{currentPage} / {totalPages}
						</span>
						<Button
							size="xs"
							disabled={currentPage >= totalPages}
							onClick={() => onFilterChange({ offset: offset + limit })}
						>
							<span>{t("next") || "Next"}</span>
							<ChevronRightIcon className="h-3.5 w-3.5" />
						</Button>
					</div>
				</div>
			</Card>

			<Modal
				open={Boolean(confirmDeleteUser)}
				onClose={() => setConfirmDeleteUser(null)}
				title={t("deleteUser.title") || "Delete User"}
				maxWidth="max-w-sm"
				footer={
					<>
						<Button size="sm" onClick={() => setConfirmDeleteUser(null)}>
							{t("cancel") || "Cancel"}
						</Button>
						<Button size="sm" variant="danger" loading={deleting} onClick={() => void handleConfirmDelete()}>
							{t("delete") || "Delete"}
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
