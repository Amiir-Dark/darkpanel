import {
	ArchiveBoxIcon,
	ArrowDownTrayIcon,
	ArrowPathIcon,
	ArrowUpCircleIcon,
	ArrowUpTrayIcon,
	ChartBarIcon,
} from "@heroicons/react/24/outline";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "react-query";
import { Link } from "react-router-dom";
import { appToast } from "components/linear/Toast";
import { Button, Input, Modal, Select } from "components/linear/UI";
import useGetUser from "hooks/useGetUser";
import { AdminRole } from "types/Admin";
import { fetch } from "service/http";
import { exportRebeccaBackup, importRebeccaBackup } from "service/settings";
import { getAPIWebSocketURL } from "utils/websocket";

const shouldWaitForPanelReturn = (operation) =>
	Boolean(operation?.restarting || operation?.needs_reload || operation?.phase === "restarting");

const ansiEscapePattern =
	// biome-ignore lint/suspicious/noControlCharactersInRegex: Strip ANSI escape codes from terminal logs
	/\u001B|\u009B|[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[a-zA-Z\d]*)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g;

const cleanTerminalOutput = (logs) =>
	(logs || [])
		.join("\n")
		.replace(ansiEscapePattern, "")
		// biome-ignore lint/suspicious/noControlCharactersInRegex: Strip backspace characters from logs
		.replace(/\x08/g, "")
		.trimEnd();

const buildBackupFilename = (scope) => {
	const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
	return `rebecca-${scope}-${timestamp}.rbbackup`;
};

export const DashboardHeaderActions = () => {
	const { t } = useTranslation();
	const { userData, getUserIsSuccess } = useGetUser();
	const isFullAccess = getUserIsSuccess && userData?.role === AdminRole.FullAccess;
	const [backupMenuOpen, setBackupMenuOpen] = useState(false);
	const [modal, setModal] = useState(null); // null | "export" | "import" | "update" | "restart"
	const [exportScope, setExportScope] = useState("database");
	const [selectedFile, setSelectedFile] = useState(null);
	const [uploadProgress, setUploadProgress] = useState(null);
	const [selectedChannel, setSelectedChannel] = useState("latest");
	const [selectedVersion, setSelectedVersion] = useState("");
	const [dockerImage, setDockerImage] = useState("rebeccapanel/rebecca");
	const [dockerTag, setDockerTag] = useState("");
	const [updateOperation, setUpdateOperation] = useState(null);
	const [waitingForAPI, setWaitingForAPI] = useState(false);
	const panelReturnPollRef = useRef(null);
	const panelReturnSawOfflineRef = useRef(false);
	const updateLogsRef = useRef(null);

	const info = useQuery(
		["dashboard-maintenance-info"],
		() => fetch("/maintenance/info", { timeout: 8000 }),
		{
			enabled: isFullAccess,
			refetchOnWindowFocus: false,
			staleTime: 5 * 60 * 1000,
			retry: false,
		},
	);

	const builds = useQuery(
		["maintenance-builds", "panel"],
		() => fetch("/maintenance/builds?target=panel", { timeout: 12000 }),
		{
			enabled: modal === "update",
			refetchOnWindowFocus: false,
			staleTime: 10 * 60 * 1000,
			retry: false,
		},
	);

	const panel = info.data?.panel;
	const update = panel?.update;
	const updateAvailable = Boolean(update?.available);
	const installMode = panel?.mode || panel?.install_mode;
	const isBinary = installMode === "binary";

	const stableBuilds = Array.isArray(builds.data?.stable) ? builds.data.stable : [];
	const devBuilds = Array.isArray(builds.data?.dev) ? builds.data.dev : [];
	const latestStable = update?.latest_release?.tag || stableBuilds[0]?.version || "";
	const latestDev = update?.latest_dev?.tag || devBuilds[0]?.version || "";
	const currentVersion = panel?.tag || update?.current || "";
	const resolvedChannel =
		panel?.channel && panel.channel !== "unknown" ? panel.channel : "latest";

	useEffect(() => {
		if (panel?.image && !panel.image.includes("binary")) {
			setDockerImage(panel.image);
		}
		if (resolvedChannel === "dev" || resolvedChannel === "main" || resolvedChannel === "latest") {
			setSelectedChannel(resolvedChannel);
		}
	}, [panel?.image, resolvedChannel]);

	useEffect(() => {
		if (modal !== "update") return;
		const autoVer =
			selectedChannel === "dev" || selectedChannel === "main"
				? latestDev || latestStable
				: latestStable || latestDev || update?.target || "";
		if (!selectedVersion && autoVer) {
			setSelectedVersion(autoVer);
		}
		if (!dockerTag && (autoVer || currentVersion)) {
			setDockerTag(autoVer || currentVersion || "latest");
		}
	}, [modal, selectedChannel, latestStable, latestDev, update?.target, currentVersion, selectedVersion, dockerTag]);

	const exportMutation = useMutation(exportRebeccaBackup, {
		onSuccess: (blob, scope) => {
			const url = URL.createObjectURL(blob);
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = buildBackupFilename(scope);
			document.body.appendChild(anchor);
			anchor.click();
			anchor.remove();
			URL.revokeObjectURL(url);
			setModal(null);
			appToast({
				title: t("dashboard.backup.exportReady", "Backup ready and downloaded"),
				status: "success",
			});
		},
		onError: (err) => {
			appToast({
				title: err?.response?._data?.detail || err?.message || "Backup download failed",
				status: "error",
			});
		},
	});

	const importMutation = useMutation(
		(file) => importRebeccaBackup(file, setUploadProgress),
		{
			onMutate: () => setUploadProgress(0),
			onSuccess: (result) => {
				appToast({
					title: t("dashboard.backup.importDone", {
						tables: result?.tables_restored ?? 0,
						rows: result?.rows_restored ?? 0,
						defaultValue: "Backup restored successfully",
					}),
					status: "success",
				});
				setSelectedFile(null);
				setModal(null);
			},
			onError: (err) => {
				appToast({
					title: err?.response?._data?.detail || err?.message || "Backup restore failed",
					status: "error",
				});
			},
			onSettled: () => setUploadProgress(null),
		},
	);

	const clearPanelReturnPolling = useCallback(() => {
		if (panelReturnPollRef.current !== null) {
			window.clearInterval(panelReturnPollRef.current);
			panelReturnPollRef.current = null;
		}
	}, []);

	const startPanelReturnPolling = useCallback(() => {
		if (panelReturnPollRef.current !== null) return;
		const startedAt = Date.now();
		panelReturnSawOfflineRef.current = false;
		setWaitingForAPI(true);
		panelReturnPollRef.current = window.setInterval(async () => {
			try {
				await fetch("/maintenance/info", { timeout: 2500 });
				if (panelReturnSawOfflineRef.current || Date.now() - startedAt > 5000) {
					clearPanelReturnPolling();
					window.location.reload();
				}
			} catch {
				panelReturnSawOfflineRef.current = true;
			}
		}, 2000);
	}, [clearPanelReturnPolling]);

	useEffect(() => () => clearPanelReturnPolling(), [clearPanelReturnPolling]);

	useEffect(() => {
		if (!updateOperation?.id || waitingForAPI) return undefined;
		const url = getAPIWebSocketURL("/maintenance/status", { id: updateOperation.id });
		if (!url) return undefined;
		const socket = new WebSocket(url);
		socket.onmessage = (event) => {
			try {
				const status = JSON.parse(event.data);
				if (status.id !== updateOperation.id) return;
				setUpdateOperation(status);
				if (shouldWaitForPanelReturn(status)) {
					startPanelReturnPolling();
				} else if (status.action === "update" && !status.running && !status.error) {
					window.setTimeout(() => window.location.reload(), 1200);
				}
			} catch {}
		};
		socket.onerror = () => {
			if (updateOperation?.running) {
				startPanelReturnPolling();
			}
		};
		return () => {
			socket.close();
		};
	}, [updateOperation?.id, waitingForAPI, startPanelReturnPolling]);

	useEffect(() => {
		if (updateLogsRef.current) {
			updateLogsRef.current.scrollTop = updateLogsRef.current.scrollHeight;
		}
	}, [updateOperation?.logs]);

	const updateMutation = useMutation(
		() =>
			fetch("/maintenance/update", {
				method: "POST",
				body: isBinary
					? {
							channel: selectedChannel,
							...(selectedVersion ? { version: selectedVersion } : {}),
						}
					: {
							source: "docker",
							channel: selectedChannel === "current" ? "latest" : selectedChannel,
							...(dockerImage.trim() ? { image: dockerImage.trim() } : {}),
							...(dockerTag.trim() ? { version: dockerTag.trim() } : {}),
						},
				timeout: 8000,
			}),
		{
			onSuccess: (res) => {
				setWaitingForAPI(false);
				clearPanelReturnPolling();
				if (res?.operation?.id) {
					setUpdateOperation(res.operation);
					setModal("update-progress");
				} else {
					setModal(null);
					appToast({
						title: t("dashboard.maintenance.updateTriggered", "Panel update started"),
						status: "success",
					});
					startPanelReturnPolling();
				}
			},
			onError: (err) => {
				appToast({
					title: err?.response?._data?.detail || err?.message || "Panel update failed",
					status: "error",
				});
			},
		},
	);

	const restartMutation = useMutation(
		() => fetch("/maintenance/restart", { method: "POST", body: { force: true }, timeout: 4000 }),
		{
			onSuccess: () => {
				setModal(null);
				appToast({
					title: t("dashboard.maintenance.restartTriggered", "Panel restart initiated"),
					status: "success",
				});
				window.setTimeout(() => window.location.reload(), 3000);
			},
			onError: (err) => {
				if (!err?.response) {
					setModal(null);
					appToast({
						title: t("dashboard.maintenance.restartTriggered", "Panel restarting..."),
						status: "info",
					});
					window.setTimeout(() => window.location.reload(), 3000);
					return;
				}
				appToast({
					title: err?.response?._data?.detail || err?.message || "Panel restart failed",
					status: "error",
				});
			},
		},
	);

	if (!isFullAccess) {
		return null;
	}

	return (
		<>
			<div className="flex flex-wrap items-center gap-2">
				<Link to="/usage">
					<Button size="xs" variant="secondary">
						<ChartBarIcon className="h-3.5 w-3.5" />
						<span>{t("usage.menu", "Analytics View")}</span>
					</Button>
				</Link>

				<Button
					size="xs"
					variant={updateAvailable ? "primary" : "secondary"}
					onClick={() => setModal("update")}
				>
					<ArrowUpCircleIcon className="h-3.5 w-3.5" />
					<span>
						{updateAvailable
							? t("dashboard.maintenance.updateAvailable", "Update available")
							: t("dashboard.maintenance.updatePanel", "Update panel")}
					</span>
					{updateAvailable && (
						<span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
					)}
				</Button>

				<div className="relative">
					<Button
						size="xs"
						variant="secondary"
						onClick={() => setBackupMenuOpen((v) => !v)}
					>
						<ArchiveBoxIcon className="h-3.5 w-3.5" />
						<span>{t("dashboard.backup.tabTitle", "Backup")}</span>
					</Button>
					{backupMenuOpen && (
						<>
							<div
								className="fixed inset-0 z-40"
								onClick={() => setBackupMenuOpen(false)}
							/>
							<div className="rb-anim-menu absolute end-0 top-9 z-50 w-48 origin-top-right rounded-lg border border-hairline-strong bg-surface-1 p-1 shadow-xl">
								<button
									type="button"
									onClick={() => {
										setBackupMenuOpen(false);
										setModal("export");
									}}
									className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-xs text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
								>
									<ArrowDownTrayIcon className="h-4 w-4 text-accent" />
									<span>{t("dashboard.backup.download", "Download backup")}</span>
								</button>
								<button
									type="button"
									onClick={() => {
										setBackupMenuOpen(false);
										setModal("import");
									}}
									className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-xs text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
								>
									<ArrowUpTrayIcon className="h-4 w-4 text-emerald-400" />
									<span>{t("dashboard.backup.import", "Upload backup")}</span>
								</button>
							</div>
						</>
					)}
				</div>

				<Button size="xs" variant="danger" onClick={() => setModal("restart")}>
					<ArrowPathIcon className="h-3.5 w-3.5" />
					<span>{t("dashboard.maintenance.restartPanel", "Restart panel")}</span>
				</Button>
			</div>

			{/* Download Backup Modal */}
			<Modal
				open={modal === "export"}
				onClose={() => !exportMutation.isLoading && setModal(null)}
				title={t("dashboard.backup.exportTitle", "Download Backup")}
				maxWidth="max-w-md"
				footer={
					<>
						<Button
							size="sm"
							variant="ghost"
							onClick={() => setModal(null)}
							disabled={exportMutation.isLoading}
						>
							{t("cancel", "Cancel")}
						</Button>
						<Button
							size="sm"
							variant="primary"
							loading={exportMutation.isLoading}
							onClick={() => exportMutation.mutate(exportScope)}
						>
							<ArrowDownTrayIcon className="h-3.5 w-3.5" />
							<span>{t("dashboard.backup.download", "Download")}</span>
						</Button>
					</>
				}
			>
				<div className="space-y-3 text-xs text-ink-subtle">
					<p>{t("dashboard.backup.exportHint", "Export a backup archive of your panel data.")}</p>
					<div>
						<label className="mb-1.5 block text-xs font-medium text-ink-muted">
							{t("dashboard.backup.scope", "Backup scope")}
						</label>
						<Select
							value={exportScope}
							onChange={(e) => setExportScope(e.target.value)}
						>
							<option value="database">
								{t("dashboard.backup.databaseOnly", "Database only")}
							</option>
							<option value="full">
								{t("dashboard.backup.full", "Full backup")}
							</option>
						</Select>
					</div>
				</div>
			</Modal>

			{/* Upload Backup Modal */}
			<Modal
				open={modal === "import"}
				onClose={() => !importMutation.isLoading && setModal(null)}
				title={t("dashboard.backup.import", "Upload & Restore Backup")}
				maxWidth="max-w-md"
				footer={
					<>
						<Button
							size="sm"
							variant="ghost"
							onClick={() => setModal(null)}
							disabled={importMutation.isLoading}
						>
							{t("cancel", "Cancel")}
						</Button>
						<Button
							size="sm"
							variant="danger"
							loading={importMutation.isLoading}
							disabled={!selectedFile}
							onClick={() => selectedFile && importMutation.mutate(selectedFile)}
						>
							<ArrowUpTrayIcon className="h-3.5 w-3.5" />
							<span>{t("dashboard.backup.import", "Restore backup")}</span>
						</Button>
					</>
				}
			>
				<div className="space-y-3">
					<p className="text-xs text-ink-subtle">
						{t("dashboard.backup.importHint", "Select a .rbbackup, .tar.gz, or .zip archive to restore.")}
					</p>
					<label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-hairline-strong bg-surface-2 p-5 text-center transition-colors hover:border-indigo-500/30">
						<ArrowUpTrayIcon className="mb-2 h-6 w-6 text-accent" />
						<span className="text-xs font-medium text-ink">
							{selectedFile ? selectedFile.name : "Choose backup file..."}
						</span>
						<span className="mt-1 text-[11px] text-ink-tertiary">
							.rbbackup · .tar.gz · .zip
						</span>
						<input
							type="file"
							accept=".rbbackup,.tar.gz,.tgz,.zip"
							className="hidden"
							onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
						/>
					</label>
					{importMutation.isLoading && uploadProgress !== null && (
						<div className="space-y-1">
							<div className="flex justify-between text-[11px] text-ink-subtle tabular-nums">
								<span>{uploadProgress < 100 ? "Uploading..." : "Restoring..."}</span>
								<span>{uploadProgress}%</span>
							</div>
							<div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
								<div
									className="h-full rounded-full bg-accent transition-all"
									style={{ width: `${uploadProgress}%` }}
								/>
							</div>
						</div>
					)}
				</div>
			</Modal>

			{/* Update Panel Modal */}
			<Modal
				open={modal === "update"}
				onClose={() => !updateMutation.isLoading && setModal(null)}
				title={t("dashboard.maintenance.updatePanel", "Update panel")}
				maxWidth="max-w-md"
				footer={
					<>
						<Button size="sm" variant="ghost" onClick={() => setModal(null)}>
							{t("cancel", "Cancel")}
						</Button>
						<Button
							size="sm"
							variant="primary"
							loading={updateMutation.isLoading}
							onClick={() => updateMutation.mutate()}
						>
							{t("dashboard.maintenance.updatePanel", "Update panel")}
						</Button>
					</>
				}
			>
				<div className="space-y-3 text-xs text-ink-subtle">
					<div className="flex items-center justify-between rounded-lg border border-hairline bg-surface-2 px-3 py-2 text-[11px]">
						<span>
							Current: <strong className="font-mono text-ink">{currentVersion || "v1.6.0"}</strong>
						</span>
						<span>
							Latest:{" "}
							<strong className="font-mono text-accent">
								{builds.isFetching ? "Checking..." : latestStable || latestDev || "latest"}
							</strong>
						</span>
					</div>

					{!isBinary && (
						<div className="space-y-3">
							<div className="rounded-lg border border-indigo-500/30 bg-accent-soft px-3 py-2 text-[11px] text-ink-muted">
								Docker mode detected — pulls the selected image & tag and recreates the container via Docker.
							</div>
							<div>
								<label className="mb-1.5 block text-xs font-medium text-ink-muted">
									Docker Image
								</label>
								<Input
									value={dockerImage}
									onChange={(e) => setDockerImage(e.target.value)}
									placeholder="rebeccapanel/rebecca"
								/>
							</div>
							<div>
								<label className="mb-1.5 block text-xs font-medium text-ink-muted">
									Target Tag
								</label>
								<Input
									value={dockerTag}
									onChange={(e) => setDockerTag(e.target.value)}
									placeholder={latestStable || "latest"}
								/>
							</div>
						</div>
					)}

					<div>
						<label className="mb-1.5 block text-xs font-medium text-ink-muted">
							Release channel
						</label>
						<Select
							value={selectedChannel}
							onChange={(e) => {
								const next = e.target.value;
								setSelectedChannel(next);
								const nextVer =
									next === "dev" || next === "main"
										? latestDev || latestStable
										: latestStable || latestDev;
								if (nextVer) {
									setSelectedVersion(nextVer);
									setDockerTag(nextVer);
								}
							}}
						>
							<option value="current">Current ({resolvedChannel})</option>
							<option value="latest">Stable (latest)</option>
							<option value="dev">Development (dev)</option>
							<option value="main">Main (main)</option>
						</Select>
					</div>

					{(stableBuilds.length > 0 || devBuilds.length > 0) && (
						<div>
							<label className="mb-1.5 block text-xs font-medium text-ink-muted">
								Target Version
							</label>
							<Select
								value={selectedVersion}
								onChange={(e) => {
									setSelectedVersion(e.target.value);
									if (e.target.value) setDockerTag(e.target.value);
								}}
							>
								<option value="">Auto ({latestStable || latestDev || "latest"})</option>
								{stableBuilds.map((b) => (
									<option key={`s-${b.version}`} value={b.version}>
										{b.version} (stable)
									</option>
								))}
								{devBuilds.map((b) => (
									<option key={`d-${b.version}`} value={b.version}>
										{b.version} ({b.channel || "dev"})
									</option>
								))}
							</Select>
						</div>
					)}
				</div>
			</Modal>

			{/* Update Panel Progress Modal */}
			<Modal
				open={modal === "update-progress"}
				onClose={() => {
					if (updateOperation?.error) {
						setModal(null);
						setUpdateOperation(null);
					}
				}}
				title={t("dashboard.maintenance.updateProgressTitle", "Updating Panel")}
				maxWidth="max-w-lg"
				footer={
					updateOperation?.error ? (
						<Button
							size="sm"
							onClick={() => {
								setModal(null);
								setUpdateOperation(null);
							}}
						>
							{t("close", "Close")}
						</Button>
					) : null
				}
			>
				<div className="space-y-3 text-xs">
					<div className="rounded-xl border border-hairline bg-surface-2 p-3.5">
						<div className="mb-2 flex items-center justify-between gap-2">
							<div className="flex items-center gap-2">
								<span
									className={`h-2 w-2 rounded-full ${
										updateOperation?.error
											? "bg-red-500"
											: updateOperation?.phase === "completed"
												? "bg-emerald-500"
												: "animate-pulse bg-accent"
									}`}
								/>
								<span className="font-semibold text-ink">
									{updateOperation?.phase
										? t(`dashboard.maintenance.phase.${updateOperation.phase}`, updateOperation.phase)
										: t("dashboard.maintenance.phase.queued", "Preparing...")}
								</span>
							</div>
							{typeof updateOperation?.progress === "number" && (
								<span className="font-mono text-xs font-bold tabular-nums text-accent">
									{Math.round(updateOperation.progress)}%
								</span>
							)}
						</div>

						<p className="mb-2.5 text-[11px] text-ink-muted">
							{updateOperation?.error
								? updateOperation.error
								: updateOperation?.message || t("dashboard.maintenance.message.preparingUpdate", "Downloading and installing update...")}
						</p>

						<div className="h-2 w-full overflow-hidden rounded-full bg-surface-3">
							<div
								className={`h-full rounded-full transition-all duration-300 ${
									updateOperation?.error
										? "bg-red-500"
										: updateOperation?.phase === "completed"
											? "bg-emerald-500"
											: "bg-accent"
								}`}
								style={{
									width: `${
										typeof updateOperation?.progress === "number"
											? Math.max(4, Math.min(100, updateOperation.progress))
											: 25
									}%`,
								}}
							/>
						</div>
					</div>

					{waitingForAPI && (
						<div className="rounded-lg border border-indigo-500/30 bg-accent-soft px-3 py-2 text-center text-[11px] text-ink-muted">
							{t(
								"dashboard.maintenance.autoRefreshAfterRestart",
								"Panel is restarting... Page will refresh automatically.",
							)}
						</div>
					)}

					<div className="overflow-hidden rounded-xl border border-hairline bg-surface-2">
						<div className="border-b border-hairline px-3 py-1.5 text-[11px] font-medium text-ink-muted">
							{t("dashboard.maintenance.liveLogs", "Live Output")}
						</div>
						<pre
							ref={updateLogsRef}
							dir="ltr"
							className="max-h-48 overflow-y-auto whitespace-pre-wrap break-all p-3 font-mono text-[11px] leading-relaxed text-ink-subtle"
						>
							{cleanTerminalOutput(updateOperation?.logs) ||
								t("dashboard.maintenance.waitingForOutput", "Waiting for output...")}
						</pre>
					</div>
				</div>
			</Modal>

			{/* Restart Panel Modal */}
			<Modal
				open={modal === "restart"}
				onClose={() => !restartMutation.isLoading && setModal(null)}
				title={t("dashboard.maintenance.restartPanel", "Restart panel")}
				maxWidth="max-w-sm"
				footer={
					<>
						<Button size="sm" variant="ghost" onClick={() => setModal(null)}>
							{t("cancel", "Cancel")}
						</Button>
						<Button
							size="sm"
							variant="danger"
							loading={restartMutation.isLoading}
							onClick={() => restartMutation.mutate()}
						>
							{t("dashboard.maintenance.restartPanel", "Restart panel")}
						</Button>
					</>
				}
			>
				<p className="text-xs text-ink-subtle">
					{t(
						"dashboard.maintenance.restartConfirm",
						"Are you sure you want to restart the panel service? Active dashboard connections will reconnect shortly.",
					)}
				</p>
			</Modal>
		</>
	);
};

