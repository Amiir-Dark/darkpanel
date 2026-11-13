import {
	ArrowPathIcon,
	DocumentDuplicateIcon,
	MagnifyingGlassIcon,
	PencilSquareIcon,
	PlusIcon,
	TrashIcon,
} from "@heroicons/react/24/outline";
import { appToast } from "components/linear/Toast";
import {
	Badge,
	Button,
	Card,
	IconButton,
	Input,
	Modal,
	Select,
	Spinner,
} from "components/linear/UI";
import { fetchInbounds as refreshInboundsStore } from "contexts/DashboardContext";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { fetch, getAPIErrorMessage } from "service/http";
import {
	buildInboundPayload,
	getInboundTraffic,
	protocolOptions,
} from "utils/inbounds";
import { SizeFormatter } from "utils/outbound";
import { DEFAULT_SEARCH_MATCH_OPTIONS, matchesAnySearch } from "utils/searchMatch";
import { sortByTraffic } from "utils/trafficSort";
import { InboundFormModal } from "./FormDrawer";

const normalizeTargetRefs = (value) => {
	if (!Array.isArray(value)) return [];
	return value
		.map((item) => {
			if (typeof item === "string") return item;
			if (item && typeof item === "object" && "id" in item) {
				const id = item.id;
				return typeof id === "string" ? id : "";
			}
			return "";
		})
		.filter(Boolean);
};

const normalizeInboundTargets = (inbound) => ({
	...inbound,
	targets: normalizeTargetRefs(inbound.targets),
	effective_targets: normalizeTargetRefs(inbound.effective_targets),
});

const getInboundTargetIds = (inbound) =>
	inbound.effective_targets?.length
		? inbound.effective_targets
		: inbound.targets?.length
			? inbound.targets
			: ["master"];

export const InboundsManager = () => {
	const { t } = useTranslation();
	const [inbounds, setInbounds] = useState([]);
	const [configTargets, setConfigTargets] = useState([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isMutating, setIsMutating] = useState(false);
	const [error, setError] = useState(null);
	const [filter, setFilter] = useState({
		protocol: "all",
		search: "",
		traffic: "default",
	});
	const [selectedInboundTags, setSelectedInboundTags] = useState([]);

	const [isFormOpen, setIsFormOpen] = useState(false);
	const [drawerMode, setDrawerMode] = useState("create");
	const [selected, setSelected] = useState(null);

	const [isCloneOpen, setIsCloneOpen] = useState(false);
	const [cloneTarget, setCloneTarget] = useState(null);

	const [resetTarget, setResetTarget] = useState(null);
	const [deleteTarget, setDeleteTarget] = useState(null);
	const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

	const loadInbounds = useCallback(() => {
		setIsLoading(true);
		setError(null);
		Promise.all([fetch("/inbounds/full"), fetch("/core/config/targets")])
			.then(([data, targetsResponse]) => {
				setInbounds((data || []).map(normalizeInboundTargets));
				setConfigTargets(targetsResponse?.targets || []);
			})
			.catch((err) => {
				setError(getAPIErrorMessage(err) || t("inbounds.error.load", "Failed to load inbounds"));
			})
			.finally(() => setIsLoading(false));
	}, [t]);

	useEffect(() => {
		loadInbounds();
	}, [loadInbounds]);

	const filtered = useMemo(() => {
		const matches = inbounds.filter((inbound) => {
			if (filter.protocol !== "all" && inbound.protocol !== filter.protocol) {
				return false;
			}
			return matchesAnySearch(
				[inbound.tag, inbound.port],
				filter.search,
				DEFAULT_SEARCH_MATCH_OPTIONS,
			);
		});
		return sortByTraffic(matches, filter.traffic, (inbound) => getInboundTraffic(inbound).total);
	}, [inbounds, filter]);

	const targetNameById = useMemo(
		() =>
			Object.fromEntries(
				configTargets.map((target) => [
					target.id,
					target.type === "master" ? t("default", "Default") : target.name || target.id,
				]),
			),
		[configTargets, t],
	);

	const openCreate = () => {
		setDrawerMode("create");
		setSelected(null);
		setIsFormOpen(true);
	};

	const openEdit = (inbound) => {
		setDrawerMode("edit");
		setSelected(inbound);
		setIsFormOpen(true);
	};

	const closeForm = () => {
		setIsFormOpen(false);
	};

	const submitInbound = async (values, options) => {
		const { mode, initial, onSuccess } = options;
		setIsMutating(true);
		try {
			const normalizedTag = (values.tag || "").trim().toLowerCase();
			const isEditMode = mode === "edit";
			const selectedTargets = new Set(values.targetIds?.length ? values.targetIds : ["master"]);
			const tagExists = inbounds.some(
				(inb) =>
					(inb.tag || "").trim().toLowerCase() === normalizedTag &&
					(!isEditMode || inb.tag !== initial?.tag),
			);
			const portExists = inbounds.some((inb) => {
				if (isEditMode && inb.tag === initial?.tag) return false;
				const inboundTargets = getInboundTargetIds(inb);
				return (
					inb.port?.toString() === values.port &&
					inboundTargets.some((targetId) => selectedTargets.has(targetId))
				);
			});
			if (tagExists) throw new Error(t("inbounds.error.tagExists", "Tag already exists"));
			if (portExists) throw new Error(t("inbounds.error.portExists", "Port already in use"));

			const payload = {
				...buildInboundPayload(values, { initial: initial ?? null }),
				targets: values.targetIds?.length ? values.targetIds : ["master"],
			};
			const url =
				mode === "create"
					? "/inbounds"
					: `/inbounds/${encodeURIComponent(payload.tag)}`;
			await fetch(url, {
				method: mode === "create" ? "POST" : "PUT",
				body: payload,
			});
			appToast({
				status: "success",
				title:
					mode === "create"
						? t("inbounds.success.created", "Inbound created")
						: t("inbounds.success.updated", "Inbound updated"),
			});
			refreshInboundsStore();
			await loadInbounds();
			onSuccess();
		} catch (err) {
			appToast({
				status: "error",
				title: err?.data?.detail || err?.message || t("inbounds.error.submit", "Failed to save inbound"),
			});
		} finally {
			setIsMutating(false);
		}
	};

	const handleSubmit = (values) =>
		submitInbound(values, {
			mode: drawerMode,
			initial: selected,
			onSuccess: closeForm,
		});

	const handleCloneSubmit = (values) =>
		submitInbound(values, {
			mode: "create",
			initial: cloneTarget,
			onSuccess: () => {
				setIsCloneOpen(false);
				setCloneTarget(null);
			},
		});

	const handleDelete = async (inbound) => {
		if (!inbound) return;
		setIsMutating(true);
		try {
			await fetch(`/inbounds/${encodeURIComponent(inbound.tag)}`, { method: "DELETE" });
			appToast({
				status: "success",
				title: t("inbounds.success.deleted", "Inbound deleted"),
			});
			refreshInboundsStore();
			await loadInbounds();
			setSelectedInboundTags((current) => current.filter((tag) => tag !== inbound.tag));
			if (selected?.tag === inbound.tag) {
				setSelected(null);
				closeForm();
			}
			if (cloneTarget?.tag === inbound.tag) {
				setCloneTarget(null);
				setIsCloneOpen(false);
			}
			setDeleteTarget(null);
		} catch (err) {
			appToast({
				status: "error",
				title: err?.data?.detail || err?.message || t("inbounds.error.submit", "Delete failed"),
			});
		} finally {
			setIsMutating(false);
		}
	};

	const handleBulkDelete = async () => {
		if (selectedInboundTags.length === 0) return;
		const items = inbounds.filter((item) => selectedInboundTags.includes(item.tag));
		setIsMutating(true);
		try {
			for (const inbound of items) {
				await fetch(`/inbounds/${encodeURIComponent(inbound.tag)}`, { method: "DELETE" });
			}
			appToast({
				status: "success",
				title: t("inbounds.success.bulkDeleted", `${items.length} inbounds deleted`),
			});
			refreshInboundsStore();
			await loadInbounds();
			setSelectedInboundTags([]);
			setBulkDeleteConfirm(false);
		} catch (err) {
			appToast({
				status: "error",
				title: err?.data?.detail || err?.message || t("inbounds.error.bulkDelete", "Bulk delete failed"),
			});
		} finally {
			setIsMutating(false);
		}
	};

	const handleResetUsage = async () => {
		if (!resetTarget) return;
		setIsMutating(true);
		try {
			await fetch(`/inbounds/${encodeURIComponent(resetTarget.tag)}/usage/reset`, {
				method: "POST",
			});
			appToast({
				status: "success",
				title: t("inbounds.resetUsageSuccess", "Inbound traffic reset"),
			});
			await loadInbounds();
		} catch (err) {
			appToast({
				status: "error",
				title: err?.data?.detail || err?.message || t("inbounds.resetUsageError", "Reset failed"),
			});
		} finally {
			setIsMutating(false);
			setResetTarget(null);
		}
	};

	const openClone = useCallback((inbound) => {
		const trimmedTag = (inbound.tag || "").trim();
		const tagMatch = trimmedTag.match(/^(.*?)(?:-(\d+))$/);
		let nextTag = trimmedTag;
		if (tagMatch?.[1]) {
			const base = tagMatch[1];
			const num = Number(tagMatch[2]);
			nextTag = Number.isFinite(num) ? `${base}-${num + 1}` : `${base}-1`;
		} else if (trimmedTag) {
			nextTag = `${trimmedTag}-1`;
		}
		const portNumber = typeof inbound.port === "string" ? Number(inbound.port) : inbound.port;
		const nextPort = Number.isFinite(portNumber) ? portNumber + 1 : inbound.port;
		setCloneTarget({ ...inbound, tag: nextTag, port: nextPort });
		setIsCloneOpen(true);
		setIsFormOpen(false);
	}, []);

	const summary = useMemo(() => {
		const protocolCounts = inbounds.reduce((acc, inbound) => {
			const key = inbound.protocol || "unknown";
			acc[key] = (acc[key] || 0) + 1;
			return acc;
		}, {});
		const multiTargetCount = inbounds.filter(
			(inbound) => getInboundTargetIds(inbound).length > 1,
		).length;
		const sniffingCount = inbounds.filter((inbound) => inbound.sniffing?.enabled).length;
		const mostUsed = Object.entries(protocolCounts).sort((a, b) => b[1] - a[1])[0];
		return [
			{ label: t("total", "Total"), value: inbounds.length },
			{
				label: t("userDialog.protocols", "Protocols"),
				value: Object.keys(protocolCounts).length,
				sub: mostUsed ? `${mostUsed[0].toUpperCase()}: ${mostUsed[1]}` : undefined,
			},
			{ label: t("inbounds.summary.multiTarget", "Multi-target"), value: multiTargetCount },
			{ label: t("inbounds.sniffing", "Sniffing"), value: sniffingCount },
			{ label: t("usersPage.filtered", "Filtered"), value: filtered.length },
		];
	}, [filtered.length, inbounds, t]);

	const allFilteredSelected =
		filtered.length > 0 && filtered.every((item) => selectedInboundTags.includes(item.tag));

	const toggleSelectAll = () => {
		if (allFilteredSelected) {
			setSelectedInboundTags([]);
		} else {
			setSelectedInboundTags(filtered.map((item) => item.tag));
		}
	};

	const toggleSelectRow = (tag) => {
		setSelectedInboundTags((prev) =>
			prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag],
		);
	};

	return (
		<div className="space-y-4">
			{/* Header */}
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h1 className="text-lg font-semibold tracking-tight text-ink">
						{t("inbounds.listHeader", "Inbounds")}
					</h1>
				</div>
				<div className="flex items-center gap-2">
					<Button size="sm" onClick={loadInbounds} loading={isLoading}>
						<ArrowPathIcon className="h-3.5 w-3.5" />
						<span>{t("inbounds.refresh", "Refresh")}</span>
					</Button>
					<Button variant="primary" size="sm" onClick={openCreate}>
						<PlusIcon className="h-4 w-4" />
						<span>{t("inbounds.add", "Add Inbound")}</span>
					</Button>
				</div>
			</div>

			{/* Summary strip */}
			<div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
				{summary.map((item) => (
					<Card key={item.label} className="px-3.5 py-2.5">
						<div className="text-[11px] font-medium text-ink-tertiary">{item.label}</div>
						<div className="mt-1 flex items-baseline justify-between gap-2">
							<span className="text-lg font-semibold tabular-nums text-ink">{item.value}</span>
							{item.sub && (
								<span className="text-[10px] font-medium text-accent">{item.sub}</span>
							)}
						</div>
					</Card>
				))}
			</div>

			{/* Filters */}
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div className="flex flex-1 flex-wrap items-center gap-2">
					<div className="relative min-w-[200px] flex-1 sm:max-w-xs">
						<MagnifyingGlassIcon className="pointer-events-none absolute start-3 top-2.5 h-4 w-4 text-ink-tertiary" />
						<Input
							value={filter.search}
							onChange={(e) => setFilter((prev) => ({ ...prev, search: e.target.value }))}
							placeholder={t("inbounds.searchPlaceholder", "Search tag or port...")}
							className="ps-9"
						/>
					</div>

					<Select
						value={filter.protocol}
						onChange={(e) => setFilter((prev) => ({ ...prev, protocol: e.target.value }))}
						className="!w-36"
						aria-label="Protocol filter"
					>
						<option value="all">{t("inbounds.filterProtocol", "All protocols")}</option>
						{protocolOptions.map((option) => (
							<option key={option} value={option}>
								{option.toUpperCase()}
							</option>
						))}
					</Select>

					<Select
						value={filter.traffic}
						onChange={(e) => setFilter((prev) => ({ ...prev, traffic: e.target.value }))}
						className="!w-40"
						aria-label="Traffic sort"
					>
						<option value="default">{t("trafficSort.default", "Default order")}</option>
						<option value="highest">{t("trafficSort.highest", "Highest traffic")}</option>
						<option value="lowest">{t("trafficSort.lowest", "Lowest traffic")}</option>
					</Select>
				</div>

				{selectedInboundTags.length > 0 && (
					<div className="flex items-center gap-2">
						<Badge variant="accent">
							{selectedInboundTags.length} selected
						</Badge>
						<Button
							size="sm"
							variant="danger"
							loading={isMutating}
							onClick={() => setBulkDeleteConfirm(true)}
						>
							<TrashIcon className="h-3.5 w-3.5" />
							<span>{t("delete", "Delete")}</span>
						</Button>
					</div>
				)}
			</div>

			{error && (
				<div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
					{error}
				</div>
			)}

			{/* Table */}
			<Card className="overflow-hidden">
				<div className="overflow-x-auto lg:overflow-x-hidden">
					<table className="w-full border-collapse text-start text-xs">
						<thead>
							<tr className="border-b border-hairline bg-surface-2 text-[11px] font-medium uppercase tracking-wider text-ink-tertiary">
								<th className="w-9 px-2.5 py-2.5 text-center">
									<input
										type="checkbox"
										checked={allFilteredSelected}
										onChange={toggleSelectAll}
										className="h-3.5 w-3.5 rounded border-hairline-strong bg-surface-1 accent-accent"
									/>
								</th>
								<th className="px-2.5 py-2.5 text-start">{t("inbounds.tag", "Tag")}</th>
								<th className="px-2.5 py-2.5 text-start">{t("protocol", "Protocol")}</th>
								<th className="px-2.5 py-2.5 text-start">{t("port", "Port")}</th>
								<th className="hidden px-2.5 py-2.5 text-start md:table-cell">
									{t("inbounds.network", "Network")}
								</th>
								<th className="hidden px-2.5 py-2.5 text-start lg:table-cell">
									{t("inbounds.security", "Security")}
								</th>
								<th className="px-2.5 py-2.5 text-start">{t("inbounds.traffic", "Traffic")}</th>
								<th className="hidden px-2.5 py-2.5 text-start xl:table-cell">
									{t("inbounds.sniffing", "Sniffing")}
								</th>
								<th className="hidden px-2.5 py-2.5 text-start xl:table-cell">
									{t("inbounds.targets", "Targets")}
								</th>
								<th className="px-2.5 py-2.5 text-end">{t("actions", "Actions")}</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-hairline">
							{isLoading && filtered.length === 0 ? (
								<tr>
									<td colSpan={10} className="py-12 text-center">
										<Spinner className="mx-auto h-5 w-5" />
									</td>
								</tr>
							) : filtered.length === 0 ? (
								<tr>
									<td colSpan={10} className="py-12 text-center text-ink-subtle">
										{t("inbounds.emptyState", "No inbounds found")}
									</td>
								</tr>
							) : (
								filtered.map((inbound) => {
									const traffic = getInboundTraffic(inbound);
									const security = inbound.streamSettings?.security;
									const targetIds = getInboundTargetIds(inbound);
									const visibleTargets = targetIds.slice(0, 3);
									const hiddenCount = Math.max(0, targetIds.length - visibleTargets.length);
									const isChecked = selectedInboundTags.includes(inbound.tag);

									return (
										<tr
											key={inbound.tag}
											className={`transition-colors hover:bg-surface-2 ${
												isChecked ? "bg-accent/5" : ""
											}`}
										>
											<td className="px-2.5 py-2.5 text-center">
												<input
													type="checkbox"
													checked={isChecked}
													onChange={() => toggleSelectRow(inbound.tag)}
													className="h-3.5 w-3.5 rounded border-hairline-strong bg-surface-1 accent-accent"
												/>
											</td>
											<td className="max-w-[180px] px-2.5 py-2.5">
												<div className="truncate font-medium text-ink">{inbound.tag}</div>
												{inbound.listen && (
													<div className="truncate font-mono text-[11px] text-ink-tertiary">
														{inbound.listen}
													</div>
												)}
												{inbound.validation_error && (
													<div className="mt-1 flex items-center gap-1.5">
														<Badge variant="danger">{t("diagnostics.broken", "Broken")}</Badge>
														<span className="max-w-[160px] truncate text-[11px] text-red-400">
															{inbound.validation_error}
														</span>
													</div>
												)}
											</td>
											<td className="px-2.5 py-2.5 whitespace-nowrap">
												<Badge variant="accent">{(inbound.protocol || "").toUpperCase()}</Badge>
											</td>
											<td className="px-2.5 py-2.5 font-mono font-medium tabular-nums text-ink">
												{inbound.port}
											</td>
											<td className="hidden px-2.5 py-2.5 text-ink-muted md:table-cell">
												{inbound.streamSettings?.network || "—"}
											</td>
											<td className="hidden px-2.5 py-2.5 lg:table-cell">
												{security && security !== "none" ? (
													<Badge variant="neutral">{security}</Badge>
												) : (
													<span className="text-ink-tertiary">—</span>
												)}
											</td>
											<td className="px-2.5 py-2.5 whitespace-nowrap tabular-nums">
												<div className="flex items-center gap-2 text-[11px]">
													<span className="text-emerald-400">
														↑ {SizeFormatter.sizeFormat(traffic.upload)}
													</span>
													<span className="text-sky-400">
														↓ {SizeFormatter.sizeFormat(traffic.download)}
													</span>
												</div>
											</td>
											<td className="hidden px-2.5 py-2.5 xl:table-cell">
												<Badge variant={inbound.sniffing?.enabled ? "success" : "neutral"}>
													{inbound.sniffing?.enabled
														? t("inbounds.sniffingEnabled", "Enabled")
														: t("inbounds.sniffingDisabled", "Disabled")}
												</Badge>
											</td>
											<td className="hidden px-2.5 py-2.5 xl:table-cell">
												<div className="flex flex-wrap items-center gap-1">
													{visibleTargets.map((targetId) => (
														<Badge key={targetId} variant="neutral">
															{targetNameById[targetId] || targetId}
														</Badge>
													))}
													{hiddenCount > 0 && <Badge variant="accent">+{hiddenCount}</Badge>}
												</div>
											</td>
											<td className="px-2.5 py-2.5 text-end whitespace-nowrap">
												<div className="inline-flex items-center gap-0.5">
													<IconButton
														title={t("edit", "Edit")}
														onClick={() => openEdit(inbound)}
													>
														<PencilSquareIcon className="h-4 w-4" />
													</IconButton>
													<IconButton
														title={t("clone", "Clone")}
														onClick={() => openClone(inbound)}
													>
														<DocumentDuplicateIcon className="h-4 w-4" />
													</IconButton>
													<IconButton
														title={t("inbounds.resetUsage", "Reset Usage")}
														disabled={isMutating}
														onClick={() => setResetTarget(inbound)}
													>
														<ArrowPathIcon className="h-4 w-4" />
													</IconButton>
													<IconButton
														title={t("delete", "Delete")}
														disabled={isMutating}
														onClick={() => setDeleteTarget(inbound)}
													>
														<TrashIcon className="h-4 w-4 text-red-400" />
													</IconButton>
												</div>
											</td>
										</tr>
									);
								})
							)}
						</tbody>
					</table>
				</div>
			</Card>

			{isFormOpen && (
				<InboundFormModal
					isOpen={isFormOpen}
					mode={drawerMode}
					initialValue={selected}
					isSubmitting={isMutating}
					existingInbounds={inbounds}
					configTargets={configTargets}
					onClose={closeForm}
					onSubmit={handleSubmit}
					onDelete={selected ? () => handleDelete(selected) : undefined}
					onClone={selected ? () => openClone(selected) : undefined}
					isDeleting={isMutating}
				/>
			)}

			{isCloneOpen && (
				<InboundFormModal
					isOpen={isCloneOpen}
					mode="clone"
					initialValue={cloneTarget}
					isSubmitting={isMutating}
					existingInbounds={inbounds}
					configTargets={configTargets}
					onClose={() => {
						setIsCloneOpen(false);
						setCloneTarget(null);
					}}
					onSubmit={handleCloneSubmit}
				/>
			)}

			<Modal
				open={Boolean(resetTarget)}
				onClose={() => !isMutating && setResetTarget(null)}
				title={t("inbounds.resetUsage", "Reset Usage")}
				maxWidth="max-w-sm"
				footer={
					<>
						<Button size="sm" onClick={() => setResetTarget(null)} disabled={isMutating}>
							{t("cancel", "Cancel")}
						</Button>
						<Button size="sm" variant="danger" loading={isMutating} onClick={() => void handleResetUsage()}>
							{t("inbounds.resetUsage", "Reset Usage")}
						</Button>
					</>
				}
			>
				<p className="text-xs text-ink-muted">
					{t("inbounds.resetUsageConfirm", { tag: resetTarget?.tag ?? "" }) ||
						`Reset traffic usage for "${resetTarget?.tag}"?`}
				</p>
			</Modal>

			<Modal
				open={Boolean(deleteTarget)}
				onClose={() => !isMutating && setDeleteTarget(null)}
				title={t("delete", "Delete Inbound")}
				maxWidth="max-w-sm"
				footer={
					<>
						<Button size="sm" onClick={() => setDeleteTarget(null)} disabled={isMutating}>
							{t("cancel", "Cancel")}
						</Button>
						<Button
							size="sm"
							variant="danger"
							loading={isMutating}
							onClick={() => void handleDelete(deleteTarget)}
						>
							{t("delete", "Delete")}
						</Button>
					</>
				}
			>
				<p className="text-xs text-ink-muted">
					{t("inbounds.confirmDelete", { tag: deleteTarget?.tag ?? "" }) ||
						`Are you sure you want to delete "${deleteTarget?.tag}"?`}
				</p>
			</Modal>

			<Modal
				open={bulkDeleteConfirm}
				onClose={() => !isMutating && setBulkDeleteConfirm(false)}
				title={t("delete", "Delete Selected Inbounds")}
				maxWidth="max-w-sm"
				footer={
					<>
						<Button size="sm" onClick={() => setBulkDeleteConfirm(false)} disabled={isMutating}>
							{t("cancel", "Cancel")}
						</Button>
						<Button size="sm" variant="danger" loading={isMutating} onClick={() => void handleBulkDelete()}>
							{t("delete", "Delete")}
						</Button>
					</>
				}
			>
				<p className="text-xs text-ink-muted">
					{t("inbounds.confirmBulkDelete", { count: selectedInboundTags.length }) ||
						`Delete ${selectedInboundTags.length} selected inbounds?`}
				</p>
			</Modal>
		</div>
	);
};
