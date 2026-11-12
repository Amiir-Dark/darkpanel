import {
	CheckIcon,
	ClipboardDocumentIcon,
	QrCodeIcon,
	SparklesIcon,
	TrashIcon,
} from "@heroicons/react/24/outline";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "react-query";
import { appToast } from "components/linear/Toast";
import { Badge, Button, IconButton, Input, Modal, Select, Spinner, Textarea } from "components/linear/UI";
import { useDashboard } from "contexts/DashboardContext";
import { fetch } from "service/http";
import { copyTextToClipboard } from "utils/clipboard";
import { generateUserLinks } from "utils/userLinks";

const GB = 1024 * 1024 * 1024;

const randomUsername = () => {
	const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
	let out = "";
	for (let i = 0; i < 8; i++) {
		out += chars[Math.floor(Math.random() * chars.length)];
	}
	return out;
};

export const UserDialog = () => {
	const { t } = useTranslation();
	const editingUser = useDashboard((s) => s.editingUser);
	const isCreatingNewUser = useDashboard((s) => s.isCreatingNewUser);
	const onCreateUser = useDashboard((s) => s.onCreateUser);
	const onEditingUser = useDashboard((s) => s.onEditingUser);
	const createUserWithService = useDashboard((s) => s.createUserWithService);
	const editUser = useDashboard((s) => s.editUser);
	const deleteUser = useDashboard((s) => s.deleteUser);
	const setQRCode = useDashboard((s) => s.setQRCode);
	const setSubLink = useDashboard((s) => s.setSubLink);
	const linkTemplates = useDashboard((s) => s.linkTemplates);

	const isEditing = Boolean(editingUser);
	const isOpen = isCreatingNewUser || isEditing;

	const { data: servicesData } = useQuery(
		"user-dialog-services",
		() => fetch("/v2/services?limit=1000&offset=0"),
		{ enabled: isOpen, staleTime: 30000 },
	);
	const services = useMemo(
		() => (Array.isArray(servicesData?.services) ? servicesData.services : Array.isArray(servicesData) ? servicesData : []),
		[servicesData],
	);

	const [activeTab, setActiveTab] = useState("edit");
	const [saving, setSaving] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const [error, setError] = useState("");
	const [copiedKey, setCopiedKey] = useState("");

	const [username, setUsername] = useState("");
	const [serviceId, setServiceId] = useState("");
	const [status, setStatus] = useState("active");
	const [dataLimitGb, setDataLimitGb] = useState("");
	const [resetStrategy, setResetStrategy] = useState("no_reset");
	const [expireDays, setExpireDays] = useState("");
	const [onHoldDays, setOnHoldDays] = useState("30");
	const [ipLimit, setIpLimit] = useState("");
	const [note, setNote] = useState("");

	const [hwids, setHwids] = useState([]);
	const [loadingHwids, setLoadingHwids] = useState(false);

	useEffect(() => {
		if (!isOpen) return;
		setError("");
		setActiveTab("edit");
		if (editingUser) {
			setUsername(editingUser.username || "");
			setServiceId(editingUser.service_id ? String(editingUser.service_id) : "");
			setStatus(editingUser.status || "active");
			setDataLimitGb(
				editingUser.data_limit ? String(Math.round((editingUser.data_limit / GB) * 100) / 100) : "",
			);
			setResetStrategy(editingUser.data_limit_reset_strategy || "no_reset");
			if (editingUser.expire) {
				const daysLeft = Math.max(0, Math.ceil((editingUser.expire * 1000 - Date.now()) / 86400000));
				setExpireDays(String(daysLeft));
			} else {
				setExpireDays("");
			}
			setOnHoldDays(
				editingUser.on_hold_expire_duration
					? String(Math.max(1, Math.round(editingUser.on_hold_expire_duration / 86400)))
					: "30",
			);
			setIpLimit(editingUser.ip_limit != null ? String(editingUser.ip_limit) : "");
			setNote(editingUser.note || "");
		} else {
			setUsername(randomUsername());
			setStatus("active");
			setDataLimitGb("");
			setResetStrategy("no_reset");
			setExpireDays("");
			setOnHoldDays("30");
			setIpLimit("");
			setNote("");
		}
	}, [isOpen, editingUser?.username]);

	useEffect(() => {
		if (!isEditing && !serviceId && services.length > 0) {
			setServiceId(String(services[0].id));
		}
	}, [isEditing, serviceId, services]);

	useEffect(() => {
		if (activeTab !== "hwid" || !editingUser?.username) return;
		let cancelled = false;
		setLoadingHwids(true);
		fetch(`/user/${encodeURIComponent(editingUser.username)}/hwids`)
			.then((res) => {
				if (!cancelled) {
					setHwids(Array.isArray(res?.hwids) ? res.hwids : Array.isArray(res) ? res : []);
				}
			})
			.catch(() => {
				if (!cancelled) setHwids([]);
			})
			.finally(() => {
				if (!cancelled) setLoadingHwids(false);
			});
		return () => {
			cancelled = true;
		};
	}, [activeTab, editingUser?.username]);

	const onClose = () => {
		onCreateUser(false);
		onEditingUser(null);
	};

	const formatSubLink = (link) => {
		if (!link) return "";
		return link.startsWith("/") ? window.location.origin + link : link;
	};

	const openQrForUser = (user) => {
		if (!user) return;
		const sub = formatSubLink(user.subscription_url || user.key_subscription_url);
		const links = generateUserLinks(user, linkTemplates, { includeInactive: true });
		if (!sub && !links.length) return;
		setSubLink(sub || null);
		setQRCode(links, user.username);
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		setError("");
		const parsedLimit = dataLimitGb.trim() ? Math.round(Number(dataLimitGb) * GB) : null;
		const parsedDays = expireDays.trim() ? Number(expireDays) : null;
		const expireTs =
			status !== "on_hold" && parsedDays !== null && !Number.isNaN(parsedDays) && parsedDays > 0
				? Math.floor(Date.now() / 1000) + Math.round(parsedDays * 86400)
				: null;
		const holdSec =
			status === "on_hold" ? Math.max(1, Number(onHoldDays) || 30) * 86400 : null;
		const parsedIp = ipLimit.trim() !== "" ? Number(ipLimit) : null;

		setSaving(true);
		try {
			if (isEditing) {
				const body = {
					status,
					service_id: serviceId ? Number(serviceId) : null,
					data_limit: parsedLimit,
					data_limit_reset_strategy: parsedLimit ? resetStrategy : "no_reset",
					expire: expireTs,
					on_hold_expire_duration: holdSec,
					ip_limit: parsedIp,
					note: note.trim() || null,
				};
				await editUser(editingUser.username, body);
				appToast({
					title: t("userDialog.userEdited", { username: editingUser.username }) || "User updated",
					status: "success",
				});
				onClose();
			} else {
				if (!username.trim()) {
					setError("Username is required");
					setSaving(false);
					return;
				}
				if (!serviceId) {
					setError("Please select a service");
					setSaving(false);
					return;
				}
				const body = {
					username: username.trim(),
					service_id: Number(serviceId),
					status: status === "on_hold" ? "on_hold" : status === "disabled" ? "disabled" : "active",
					data_limit: parsedLimit,
					data_limit_reset_strategy: parsedLimit ? resetStrategy : "no_reset",
					expire: expireTs,
					on_hold_expire_duration: holdSec,
					ip_limit: parsedIp,
					note: note.trim() || null,
				};
				const createdUser = await createUserWithService(body);
				appToast({
					title: t("userDialog.userCreated", { username: body.username }) || "User created",
					status: "success",
				});
				onClose();
				if (createdUser && (createdUser.subscription_url || createdUser.links?.length)) {
					openQrForUser(createdUser);
				} else {
					fetch(`/user/${encodeURIComponent(body.username)}`)
						.then(openQrForUser)
						.catch(() => {});
				}
			}
		} catch (err) {
			setError(err?.response?._data?.detail || err?.message || "Operation failed");
		} finally {
			setSaving(false);
		}
	};

	const handleDelete = async () => {
		if (!editingUser) return;
		setDeleting(true);
		try {
			await deleteUser(editingUser);
			appToast({ title: t("deleteUser.success") || "User deleted", status: "success" });
			onClose();
		} catch (err) {
			setError(err?.message || "Failed to delete user");
		} finally {
			setDeleting(false);
		}
	};

	const handleCopy = (key, text) => {
		if (!text) return;
		void copyTextToClipboard(text).then(() => {
			setCopiedKey(key);
			window.setTimeout(() => setCopiedKey(""), 1200);
		});
	};

	const userLinks = isEditing ? generateUserLinks(editingUser, linkTemplates, { includeInactive: true }) : [];
	const subLink = isEditing ? formatSubLink(editingUser?.subscription_url) : "";

	return (
		<Modal
			open={isOpen}
			onClose={onClose}
			title={isEditing ? editingUser.username : t("userDialog.createUser") || "Create User"}
			subtitle={isEditing ? t("userDialog.editUser") || "Edit user configuration" : t("userDialog.newUser") || "Provision a new user"}
			maxWidth="max-w-xl"
			footer={
				activeTab === "edit" ? (
					<div className="flex w-full items-center justify-between gap-2">
						<div>
							{isEditing && (
								<Button variant="danger" size="sm" loading={deleting} onClick={() => void handleDelete()}>
									<TrashIcon className="h-3.5 w-3.5" />
									<span>{t("delete") || "Delete"}</span>
								</Button>
							)}
						</div>
						<div className="flex items-center gap-2">
							<Button size="sm" onClick={onClose}>
								{t("cancel") || "Cancel"}
							</Button>
							<Button type="submit" form="user-dialog-form" variant="primary" size="sm" loading={saving}>
								{isEditing ? t("save") || "Save Changes" : t("create") || "Create User"}
							</Button>
						</div>
					</div>
				) : (
					<Button size="sm" onClick={onClose}>
						{t("close") || "Close"}
					</Button>
				)
			}
		>
			{isEditing && (
				<div className="mb-4 flex gap-1 border-b border-hairline pb-2">
					{[
						{ id: "edit", label: t("userDialog.tabs.edit") || "Settings" },
						{ id: "links", label: t("userDialog.tabs.links") || "Links" },
						{ id: "hwid", label: "HWIDs" },
					].map((tab) => (
						<button
							key={tab.id}
							type="button"
							onClick={() => setActiveTab(tab.id)}
							className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
								activeTab === tab.id
									? "bg-surface-3 text-ink"
									: "text-ink-subtle hover:bg-surface-2 hover:text-ink-muted"
							}`}
						>
							{tab.label}
						</button>
					))}
				</div>
			)}

			{error && (
				<div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
					{typeof error === "string" ? error : JSON.stringify(error)}
				</div>
			)}

			{activeTab === "edit" && (
				<form id="user-dialog-form" onSubmit={handleSubmit} className="space-y-4">
					<div className="grid gap-3 sm:grid-cols-2">
						<div>
							<label className="mb-1 block text-xs font-medium text-ink-muted">
								{t("username") || "Username"}
							</label>
							<div className="flex gap-1.5">
								<Input
									value={username}
									disabled={isEditing}
									onChange={(e) => setUsername(e.target.value)}
									placeholder="username"
								/>
								{!isEditing && (
									<IconButton
										variant="secondary"
										size="md"
										title="Random"
										onClick={() => setUsername(randomUsername())}
									>
										<SparklesIcon className="h-4 w-4" />
									</IconButton>
								)}
							</div>
						</div>

						<div>
							<label className="mb-1 block text-xs font-medium text-ink-muted">
								{t("service") || "Service"}
							</label>
							<Select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
								<option value="">{t("selectService") || "Select service..."}</option>
								{services.map((svc) => (
									<option key={svc.id} value={svc.id}>
										{svc.name}
									</option>
								))}
							</Select>
						</div>
					</div>

					<div className="grid gap-3 sm:grid-cols-2">
						<div>
							<label className="mb-1 block text-xs font-medium text-ink-muted">
								{t("status") || "Status"}
							</label>
							<Select value={status} onChange={(e) => setStatus(e.target.value)}>
								<option value="active">{t("status_active") || "Active"}</option>
								<option value="on_hold">{t("status_on_hold") || "On Hold"}</option>
								<option value="disabled">{t("status_disabled") || "Disabled"}</option>
							</Select>
						</div>

						{status === "on_hold" ? (
							<div>
								<label className="mb-1 block text-xs font-medium text-ink-muted">
									{t("userDialog.onHoldDays") || "On-Hold Duration (Days)"}
								</label>
								<Input
									type="number"
									min="1"
									value={onHoldDays}
									onChange={(e) => setOnHoldDays(e.target.value)}
								/>
							</div>
						) : (
							<div>
								<label className="mb-1 block text-xs font-medium text-ink-muted">
									{t("userDialog.expireDays") || "Expiry (Days from now, empty = ∞)"}
								</label>
								<Input
									type="number"
									min="0"
									value={expireDays}
									onChange={(e) => setExpireDays(e.target.value)}
									placeholder="∞"
								/>
							</div>
						)}
					</div>

					<div className="grid gap-3 sm:grid-cols-3">
						<div>
							<label className="mb-1 block text-xs font-medium text-ink-muted">
								{t("userDialog.dataLimitGb") || "Data Limit (GB)"}
							</label>
							<Input
								type="number"
								step="any"
								min="0"
								value={dataLimitGb}
								onChange={(e) => setDataLimitGb(e.target.value)}
								placeholder="∞"
							/>
						</div>

						<div>
							<label className="mb-1 block text-xs font-medium text-ink-muted">
								{t("userDialog.resetStrategy") || "Reset Strategy"}
							</label>
							<Select value={resetStrategy} onChange={(e) => setResetStrategy(e.target.value)}>
								<option value="no_reset">No Reset</option>
								<option value="day">Daily</option>
								<option value="week">Weekly</option>
								<option value="month">Monthly</option>
								<option value="year">Yearly</option>
							</Select>
						</div>

						<div>
							<label className="mb-1 block text-xs font-medium text-ink-muted">
								{t("userDialog.ipLimit") || "IP / Device Limit"}
							</label>
							<Input
								type="number"
								min="0"
								value={ipLimit}
								onChange={(e) => setIpLimit(e.target.value)}
								placeholder="∞"
							/>
						</div>
					</div>

					<div>
						<label className="mb-1 block text-xs font-medium text-ink-muted">
							{t("note") || "Note"}
						</label>
						<Textarea
							rows={2}
							value={note}
							onChange={(e) => setNote(e.target.value)}
							placeholder={t("userDialog.notePlaceholder") || "Optional note..."}
						/>
					</div>
				</form>
			)}

			{activeTab === "links" && (
				<div className="space-y-4">
					<div>
						<div className="mb-1.5 text-xs font-medium text-ink-muted">
							{t("userDialog.links.subscription") || "Subscription Link"}
						</div>
						{subLink ? (
							<div className="flex items-center gap-2 rounded-lg border border-hairline bg-surface-2 px-3 py-2">
								<span className="min-w-0 flex-1 truncate font-mono text-xs text-ink-muted">
									{subLink}
								</span>
								<IconButton onClick={() => handleCopy("sub", subLink)} title="Copy">
									{copiedKey === "sub" ? (
										<CheckIcon className="h-4 w-4 text-emerald-400" />
									) : (
										<ClipboardDocumentIcon className="h-4 w-4" />
									)}
								</IconButton>
								<IconButton onClick={() => openQrForUser(editingUser)} title="QR">
									<QrCodeIcon className="h-4 w-4" />
								</IconButton>
							</div>
						) : (
							<div className="text-xs text-ink-tertiary">No subscription link</div>
						)}
					</div>

					<div>
						<div className="mb-1.5 flex items-center justify-between">
							<span className="text-xs font-medium text-ink-muted">
								{t("userDialog.links.configs") || "Config Links"} ({userLinks.length})
							</span>
							{userLinks.length > 0 && (
								<Button
									size="xs"
									onClick={() => handleCopy("all", userLinks.join("\n"))}
								>
									{copiedKey === "all" ? <CheckIcon className="h-3.5 w-3.5 text-emerald-400" /> : <ClipboardDocumentIcon className="h-3.5 w-3.5" />}
									<span>{t("userDialog.links.copyAllConfigs") || "Copy All"}</span>
								</Button>
							)}
						</div>
						<div className="max-h-56 space-y-1.5 overflow-y-auto">
							{userLinks.length === 0 ? (
								<div className="rounded-lg border border-hairline bg-surface-2 p-3 text-xs text-ink-tertiary">
									{t("userDialog.links.noConfigs") || "No config links available"}
								</div>
							) : (
								userLinks.map((link, idx) => (
									<div
										key={idx}
										className="flex items-center gap-2 rounded-lg border border-hairline bg-surface-2 px-3 py-1.5"
									>
										<span className="min-w-0 flex-1 truncate font-mono text-[11px] text-ink-muted">
											{link}
										</span>
										<IconButton onClick={() => handleCopy(`cfg-${idx}`, link)} title="Copy">
											{copiedKey === `cfg-${idx}` ? (
												<CheckIcon className="h-3.5 w-3.5 text-emerald-400" />
											) : (
												<ClipboardDocumentIcon className="h-3.5 w-3.5" />
											)}
										</IconButton>
										<IconButton
											onClick={() => {
												setSubLink(null);
												setQRCode([link], editingUser.username);
											}}
											title="QR"
										>
											<QrCodeIcon className="h-3.5 w-3.5" />
										</IconButton>
									</div>
								))
							)}
						</div>
					</div>
				</div>
			)}

			{activeTab === "hwid" && (
				<div className="space-y-3">
					{loadingHwids ? (
						<div className="flex justify-center py-8">
							<Spinner />
						</div>
					) : hwids.length === 0 ? (
						<div className="rounded-lg border border-hairline bg-surface-2 p-4 text-center text-xs text-ink-tertiary">
							No HWID devices recorded
						</div>
					) : (
						<div className="space-y-2">
							{hwids.map((hw, i) => (
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
		</Modal>
	);
};

export default UserDialog;
