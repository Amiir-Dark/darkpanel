import {
	ArrowPathIcon,
	CheckIcon,
	ChevronDownIcon,
	ClipboardDocumentIcon,
	ExclamationTriangleIcon,
	MagnifyingGlassIcon,
	PowerIcon,
	QrCodeIcon,
	SparklesIcon,
	TrashIcon,
	UserIcon,
	UserPlusIcon,
} from "@heroicons/react/24/outline";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "react-query";
import { appToast } from "components/linear/Toast";
import { Badge, Button, IconButton, Input, Modal, Select, Spinner, Textarea } from "components/linear/UI";
import { useDashboard } from "contexts/DashboardContext";
import { fetch } from "service/http";
import { copyTextToClipboard } from "utils/clipboard";
import { formatBytes } from "utils/formatByte";
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
	const resetDataUsage = useDashboard((s) => s.resetDataUsage);
	const refetchUsers = useDashboard((s) => s.refetchUsers);
	const setQRCode = useDashboard((s) => s.setQRCode);
	const setSubLink = useDashboard((s) => s.setSubLink);
	const linkTemplates = useDashboard((s) => s.linkTemplates);

	const isEditing = Boolean(editingUser);
	const isOpen = isCreatingNewUser || isEditing;

	const { data: servicesData, isLoading: loadingServices } = useQuery(
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
	const [togglingPower, setTogglingPower] = useState(false);
	const [resettingUsage, setResettingUsage] = useState(false);
	const [error, setError] = useState("");
	const [copiedKey, setCopiedKey] = useState("");
	const [serviceSearch, setServiceSearch] = useState("");

	const [showOtherInfo, setShowOtherInfo] = useState(false);

	const [username, setUsername] = useState("");
	const [serviceId, setServiceId] = useState("");
	const [status, setStatus] = useState("active");
	const [usedTraffic, setUsedTraffic] = useState(0);
	const [dataLimitGb, setDataLimitGb] = useState("");
	const [resetStrategy, setResetStrategy] = useState("no_reset");
	const [expireDays, setExpireDays] = useState("");
	const [onHoldDays, setOnHoldDays] = useState("30");
	const [ipLimit, setIpLimit] = useState("");
	const [deviceLimitType, setDeviceLimitType] = useState("ip");
	const [flow, setFlow] = useState("");
	const [note, setNote] = useState("");

	const [hwids, setHwids] = useState([]);
	const [loadingHwids, setLoadingHwids] = useState(false);

	useEffect(() => {
		if (!isOpen) return;
		setError("");
		setActiveTab("edit");
		setServiceSearch("");
		setShowOtherInfo(false);
		if (editingUser) {
			setUsername(editingUser.username || "");
			setServiceId(editingUser.service_id ? String(editingUser.service_id) : "");
			setStatus(editingUser.status || "active");
			setUsedTraffic(editingUser.used_traffic ?? 0);
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
			setDeviceLimitType(editingUser.device_limit_type || "ip");
			setFlow(editingUser.flow || "");
			setNote(editingUser.note || "");
		} else {
			setUsername("");
			setStatus("active");
			setUsedTraffic(0);
			setDataLimitGb("");
			setResetStrategy("no_reset");
			setExpireDays("");
			setOnHoldDays("30");
			setIpLimit("");
			setDeviceLimitType("ip");
			setFlow("");
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

	const filteredServices = useMemo(() => {
		const q = serviceSearch.trim().toLowerCase();
		if (!q) return services;
		return services.filter(
			(svc) =>
				(svc.name || "").toLowerCase().includes(q) ||
				(svc.description || "").toLowerCase().includes(q),
		);
	}, [services, serviceSearch]);

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

	const handleQuickPowerToggle = async () => {
		if (!editingUser || togglingPower) return;
		const nextStatus = status === "disabled" ? "active" : "disabled";
		setTogglingPower(true);
		setError("");
		try {
			await fetch(`/v2/users/${encodeURIComponent(editingUser.username)}`, {
				method: "PUT",
				body: { status: nextStatus },
			});
			setStatus(nextStatus);
			onEditingUser({ ...editingUser, status: nextStatus });
			refetchUsers(true);
			appToast({
				title:
					nextStatus === "disabled"
						? t("userDialog.userDisabled", "User turned off")
						: t("userDialog.userEnabled", "User turned on"),
				status: "success",
			});
		} catch (err) {
			setError(err?.response?._data?.detail || err?.message || "Failed to update user status");
		} finally {
			setTogglingPower(false);
		}
	};

	const handleQuickResetUsage = async () => {
		if (!editingUser || resettingUsage) return;
		setResettingUsage(true);
		setError("");
		try {
			await resetDataUsage(editingUser);
			setUsedTraffic(0);
			onEditingUser({ ...editingUser, used_traffic: 0 });
			appToast({
				title: t("resetUsage.success", "Data usage reset to 0"),
				status: "success",
			});
		} catch (err) {
			setError(err?.response?._data?.detail || err?.message || "Failed to reset usage");
		} finally {
			setResettingUsage(false);
		}
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		setError("");
		const parsedLimit = dataLimitGb.trim() ? Math.round(Number(dataLimitGb) * GB) : null;
		const parsedDays = expireDays.trim() ? Number(expireDays) : null;
		const isOnHold = status === "on_hold";
		const expireTs =
			!isOnHold && parsedDays !== null && !Number.isNaN(parsedDays) && parsedDays > 0
				? Math.floor(Date.now() / 1000) + Math.round(parsedDays * 86400)
				: null;
		const holdSec = isOnHold ? Math.max(1, Number(onHoldDays) || 30) * 86400 : null;
		const parsedIp = ipLimit.trim() !== "" ? Number(ipLimit) : null;
		const resolvedFlow = flow.trim() || null;

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
					device_limit_type: deviceLimitType,
					flow: resolvedFlow,
					note: note.trim() || null,
				};
				await editUser(editingUser.username, body);
				appToast({
					title: t("userDialog.userEdited", { username: editingUser.username }) || "User updated",
					status: "success",
				});
				onClose();
			} else {
				const finalUsername = username.trim() || randomUsername();
				if (!serviceId) {
					setError("Please select a service");
					setSaving(false);
					return;
				}
				const body = {
					username: finalUsername,
					service_id: Number(serviceId),
					status: isOnHold ? "on_hold" : status === "disabled" ? "disabled" : "active",
					data_limit: parsedLimit,
					data_limit_reset_strategy: parsedLimit ? resetStrategy : "no_reset",
					expire: expireTs,
					on_hold_expire_duration: holdSec,
					ip_limit: parsedIp,
					device_limit_type: deviceLimitType,
					flow: resolvedFlow,
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
			appToast({ title: t("deleteUser.success", "User deleted"), status: "success" });
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
	const isDisabled = status === "disabled";
	const isOnHold = status === "on_hold";

	return (
		<Modal
			open={isOpen}
			onClose={onClose}
			title={
				<span className="flex items-center gap-2.5">
					<span className="flex h-7 w-7 items-center justify-center rounded-lg border border-accent/25 bg-accent/15 text-accent">
						{isEditing ? <UserIcon className="h-4 w-4" /> : <UserPlusIcon className="h-4 w-4" />}
					</span>
					<span>
						{isEditing ? editingUser.username : t("userDialog.createUser", "Create new user")}
					</span>
				</span>
			}
			maxWidth="max-w-xl"
			footer={
				activeTab === "edit" ? (
					<div className="flex w-full items-center justify-between gap-2">
						<div className="flex items-center gap-2">
							{isEditing && (
								<>
									<Button variant="danger" size="sm" loading={deleting} onClick={() => void handleDelete()}>
										<TrashIcon className="h-3.5 w-3.5" />
										<span>{t("delete", "Delete")}</span>
									</Button>
									<Button size="sm" loading={resettingUsage} onClick={() => void handleQuickResetUsage()}>
										<ArrowPathIcon className="h-3.5 w-3.5" />
										<span>{t("resetUsage.title", "Reset Usage")}</span>
									</Button>
									<Button
										size="sm"
										variant={isDisabled ? "primary" : "secondary"}
										loading={togglingPower}
										onClick={() => void handleQuickPowerToggle()}
									>
										<PowerIcon className={`h-3.5 w-3.5 ${isDisabled ? "" : "text-emerald-400"}`} />
										<span>{isDisabled ? t("enable", "Turn On") : t("disable", "Turn Off")}</span>
									</Button>
								</>
							)}
						</div>
						<div className="flex items-center gap-2">
							<Button size="sm" onClick={onClose}>
								{t("cancel", "Cancel")}
							</Button>
							<Button type="submit" form="user-dialog-form" variant="primary" size="sm" loading={saving}>
								{isEditing ? t("save", "Save Changes") : t("create", "Create User")}
							</Button>
						</div>
					</div>
				) : (
					<Button size="sm" onClick={onClose}>
						{t("close", "Close")}
					</Button>
				)
			}
		>
			<div className="mb-3 flex items-center justify-between border-b border-hairline">
				<div className="flex gap-4">
					{(isEditing
						? [
								{ id: "edit", label: t("userDialog.tabs.edit", "Edit") },
								{ id: "links", label: t("userDialog.tabs.links", "Links") },
								{ id: "hwid", label: "HWIDs" },
							]
						: [{ id: "edit", label: t("userDialog.tabs.edit", "Edit") }]
					).map((tab) => (
						<button
							key={tab.id}
							type="button"
							onClick={() => setActiveTab(tab.id)}
							className={`-mb-px border-b-2 px-1 pb-2 text-xs font-medium transition-colors ${
								activeTab === tab.id
									? "border-accent text-accent"
									: "border-transparent text-ink-subtle hover:text-ink"
							}`}
						>
							{tab.label}
						</button>
					))}
				</div>

				{isEditing && (
					<div className="flex items-center gap-2 pb-1.5 text-[11px] tabular-nums text-ink-tertiary">
						<span>
							{formatBytes(usedTraffic)} / {dataLimitGb.trim() ? `${dataLimitGb} GB` : "∞"}
						</span>
						<Badge variant={isDisabled ? "danger" : isOnHold ? "accent" : "success"}>
							{isDisabled ? "Disabled" : isOnHold ? "On Hold" : "Active"}
						</Badge>
					</div>
				)}
			</div>

			{error && (
				<div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
					{typeof error === "string" ? error : JSON.stringify(error)}
				</div>
			)}

			{activeTab === "edit" && (
				<form id="user-dialog-form" onSubmit={handleSubmit}>
					<div className="space-y-3 rounded-xl border border-hairline bg-surface-2/40 p-3">
						<div className="grid gap-3.5 md:grid-cols-2">
							{/* Left Column */}
							<div className="space-y-2.5">
								<div>
									<div className="mb-1 flex items-center justify-between">
										<label className="text-xs font-medium text-ink-muted">
											{t("username", "Username")}
										</label>
										<span className="text-[10px] tabular-nums text-ink-tertiary">
											{username.length}/32
										</span>
									</div>
									<div className="relative flex items-center">
										<Input
											value={username}
											maxLength={32}
											disabled={isEditing}
											onChange={(e) => setUsername(e.target.value)}
											placeholder={t("username", "Username")}
											className={!isEditing ? "!h-8 pe-9" : "!h-8"}
										/>
										{!isEditing && (
											<button
												type="button"
												title="Random username"
												onClick={() => setUsername(randomUsername())}
												className="absolute end-1.5 rounded p-1 text-ink-tertiary transition-colors hover:bg-surface-3 hover:text-ink"
											>
												<SparklesIcon className="h-3.5 w-3.5" />
											</button>
										)}
									</div>
								</div>

								<div>
									<label className="mb-1 block text-xs font-medium text-ink-muted">
										{t("userDialog.dataLimit", "Data Limit")}
									</label>
									<div className="flex items-stretch">
										<Input
											type="number"
											step="any"
											min="0"
											value={dataLimitGb}
											onChange={(e) => setDataLimitGb(e.target.value)}
											placeholder="∞"
											className="!h-8 rounded-e-none"
										/>
										<span className="inline-flex items-center rounded-e-lg border border-s-0 border-hairline-strong bg-surface-2 px-2.5 text-xs font-medium text-ink-muted">
											GB
										</span>
									</div>
								</div>

								<div>
									<div className="mb-1 flex items-center justify-between gap-2">
										<label className="text-xs font-medium text-ink-muted">
											{t("userDialog.ipLimit", "IP limit")}
										</label>
										<div className="inline-flex rounded-md border border-hairline-strong bg-surface-2 p-0.5 text-[10px] font-medium">
											{["ip", "hwid"].map((mode) => (
												<button
													key={mode}
													type="button"
													onClick={() => setDeviceLimitType(mode)}
													className={`rounded px-1.5 py-0.5 uppercase transition-colors ${
														deviceLimitType === mode
															? "bg-accent text-white"
															: "text-ink-subtle hover:text-ink"
													}`}
												>
													{mode}
												</button>
											))}
										</div>
									</div>
									<div className="flex items-stretch">
										<Input
											type="number"
											min="0"
											value={ipLimit}
											onChange={(e) => setIpLimit(e.target.value)}
											placeholder={t("unlimited", "Unlimited")}
											className="!h-8 rounded-e-none"
										/>
										<span className="inline-flex items-center rounded-e-lg border border-s-0 border-hairline-strong bg-surface-2 px-2.5 text-xs font-medium uppercase text-ink-muted">
											{deviceLimitType}
										</span>
									</div>
								</div>

								<div>
									<label className="mb-1 block text-xs font-medium text-ink-muted">
										{isOnHold
											? t("userDialog.onHoldDays", "On-Hold Duration (Days)")
											: t("userDialog.expireDays", "Expiration (Days)")}
									</label>
									<div className="flex items-center gap-1.5">
										<Input
											type="number"
											min={isOnHold ? "1" : "0"}
											value={isOnHold ? onHoldDays : expireDays}
											onChange={(e) =>
												isOnHold ? setOnHoldDays(e.target.value) : setExpireDays(e.target.value)
											}
											placeholder={isOnHold ? "30" : "∞"}
											className="!h-8 flex-1"
										/>
										<button
											type="button"
											onClick={() => setStatus(isOnHold ? "active" : "on_hold")}
											className={`h-8 shrink-0 rounded-lg border px-2.5 text-xs font-medium transition-colors ${
												isOnHold
													? "border-accent bg-accent/15 text-accent"
													: "border-hairline-strong bg-surface-2 text-ink-muted hover:bg-surface-3 hover:text-ink"
											}`}
										>
											{t("status_on_hold", "On Hold")}
										</button>
									</div>
								</div>

								<div>
									<label className="mb-1 block text-xs font-medium text-ink-muted">
										Flow
									</label>
									<Select value={flow} onChange={(e) => setFlow(e.target.value)} className="!h-8">
										<option value="">None</option>
										<option value="xtls-rprx-vision">xtls-rprx-vision</option>
									</Select>
								</div>
							</div>

							{/* Right Column: Service Cards */}
							<div className="flex flex-col">
								<div className="mb-1.5 flex items-center justify-between gap-2">
									<label className="text-xs font-medium text-ink-muted">
										{t("service", "Service")} <span className="text-red-400">*</span>
									</label>
									{services.length > 4 && (
										<div className="relative w-40">
											<MagnifyingGlassIcon className="pointer-events-none absolute start-2.5 top-2 h-3.5 w-3.5 text-ink-tertiary" />
											<Input
												value={serviceSearch}
												onChange={(e) => setServiceSearch(e.target.value)}
												placeholder={t("search", "Search...")}
												className="!h-7 ps-8 !text-[11px]"
											/>
										</div>
									)}
								</div>

								{loadingServices ? (
									<div className="flex flex-1 items-center justify-center rounded-xl border border-hairline bg-surface-1 py-10">
										<Spinner className="h-5 w-5" />
									</div>
								) : filteredServices.length === 0 ? (
									<div className="rounded-xl border border-hairline bg-surface-1 px-3 py-6 text-center text-xs text-ink-tertiary">
										{services.length === 0
											? t("services.empty", "No services available")
											: t("noResults", "No matching service")}
									</div>
								) : (
									<div className="max-h-[250px] space-y-2 overflow-y-auto pr-1">
										{filteredServices.map((svc) => {
											const isSelected = String(svc.id) === String(serviceId);
											const hasIssue = svc.broken || svc.has_hosts === false;
											return (
												<button
													key={svc.id}
													type="button"
													onClick={() => setServiceId(String(svc.id))}
													className={`w-full rounded-xl border px-3 py-2 text-start transition-colors ${
														isSelected
															? "border-accent bg-accent/10"
															: "border-hairline-strong bg-surface-1/60 hover:border-ink-tertiary/40 hover:bg-surface-2"
													}`}
												>
													<div className="flex items-start justify-between gap-2">
														<div className="flex min-w-0 items-center gap-1.5">
															<span className="truncate text-xs font-semibold text-ink">
																{svc.name}
															</span>
															{hasIssue && (
																<ExclamationTriangleIcon
																	className="h-3.5 w-3.5 shrink-0 text-amber-400"
																	title={svc.broken ? "Broken service" : "No hosts assigned"}
																/>
															)}
														</div>
														<span className="shrink-0 text-[11px] tabular-nums text-ink-tertiary">
															{svc.host_count ?? 0} hosts, {svc.user_count ?? 0} users
														</span>
													</div>
													{svc.description && (
														<div className="mt-1 truncate text-[11px] text-ink-muted">
															{svc.description}
														</div>
													)}
												</button>
											);
										})}
									</div>
								)}
							</div>
						</div>

						{/* Collapsible Accordions */}
						<div className="space-y-2 pt-0.5">
							<div className="rounded-xl border border-hairline-strong bg-surface-1/50">
								<button
									type="button"
									onClick={() => setShowOtherInfo((v) => !v)}
									className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-ink"
								>
									<span>{t("userDialog.otherInfo", "Other info")}</span>
									<ChevronDownIcon
										className={`h-4 w-4 text-ink-tertiary transition-transform ${
											showOtherInfo ? "rotate-180" : ""
										}`}
									/>
								</button>
								{showOtherInfo && (
									<div className="border-t border-hairline px-4 py-3">
										<label className="mb-1 block text-xs font-medium text-ink-muted">
											{t("note", "Note")}
										</label>
										<Textarea
											rows={2}
											value={note}
											onChange={(e) => setNote(e.target.value)}
											placeholder={t("userDialog.notePlaceholder", "Optional note...")}
										/>
									</div>
								)}
							</div>
						</div>
					</div>
				</form>
			)}

			{activeTab === "links" && (
				<div className="space-y-4">
					<div>
						<div className="mb-1.5 text-xs font-medium text-ink-muted">
							{t("userDialog.links.subscription", "Subscription Link")}
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
								{t("userDialog.links.configs", "Config Links")} ({userLinks.length})
							</span>
							{userLinks.length > 0 && (
								<Button size="xs" onClick={() => handleCopy("all", userLinks.join("\n"))}>
									{copiedKey === "all" ? (
										<CheckIcon className="h-3.5 w-3.5 text-emerald-400" />
									) : (
										<ClipboardDocumentIcon className="h-3.5 w-3.5" />
									)}
									<span>{t("userDialog.links.copyAllConfigs", "Copy All")}</span>
								</Button>
							)}
						</div>
						<div className="max-h-56 space-y-1.5 overflow-y-auto">
							{userLinks.length === 0 ? (
								<div className="rounded-lg border border-hairline bg-surface-2 p-3 text-xs text-ink-tertiary">
									{t("userDialog.links.noConfigs", "No config links available")}
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
