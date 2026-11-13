import { LinkIcon, Squares2X2Icon } from "@heroicons/react/24/outline";
import { HostsManager } from "components/HostsManager";
import { InboundsManager } from "components/InboundsManager";
import { fetchInbounds } from "contexts/DashboardContext";
import { useHosts } from "contexts/HostsContext";
import useGetUser from "hooks/useGetUser";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";

export const HostsPage = () => {
	const location = useLocation();
	const { t } = useTranslation();
	const { userData, getUserIsSuccess } = useGetUser();
	const fetchHosts = useHosts((state) => state.fetchHosts);
	const [activeTab, setActiveTab] = useState(0);
	const tabKeys = useMemo(() => ["inbounds", "hosts"], []);
	const hostsTabIndex = 1;
	const canManageHosts = getUserIsSuccess && Boolean(userData.permissions?.sections.hosts);

	const readHashTab = useCallback(
		(hash = window.location.hash) => (hash || "").replace(/^#/, "").toLowerCase(),
		[],
	);

	useEffect(() => {
		const syncFromHash = (hash) => {
			const idx = tabKeys.indexOf(readHashTab(hash));
			if (idx >= 0) {
				setActiveTab(idx);
			} else {
				setActiveTab(0);
				window.history.replaceState(
					null,
					"",
					`${window.location.pathname}${window.location.search}#${tabKeys[0]}`,
				);
			}
		};
		syncFromHash(location.hash);
		const onHashChange = () => syncFromHash(window.location.hash);
		window.addEventListener("hashchange", onHashChange);
		return () => window.removeEventListener("hashchange", onHashChange);
	}, [location.hash, readHashTab, tabKeys]);

	useEffect(() => {
		if (activeTab !== hostsTabIndex || !canManageHosts) return;
		fetchInbounds();
		fetchHosts();
	}, [activeTab, canManageHosts, fetchHosts]);

	const handleTabChange = (index) => {
		setActiveTab(index);
		const key = tabKeys[index] || "";
		if (readHashTab() !== key) {
			window.location.hash = key;
		}
	};

	if (!canManageHosts) {
		return (
			<div className="space-y-2">
				<h1 className="text-lg font-semibold tracking-tight text-ink">
					{t("header.hostSettings", "Inbounds & Hosts")}
				</h1>
				<p className="text-xs text-ink-tertiary">
					{t("hostsPage.noPermission", "You do not have permission to manage hosts.")}
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline pb-3">
				<div className="inline-flex rounded-lg border border-hairline bg-surface-2 p-1">
					{[
						{
							idx: 0,
							label: t("hostsPage.tabInbounds", "Inbounds"),
							Icon: LinkIcon,
						},
						{
							idx: 1,
							label: t("hostsPage.tabHosts", "Hosts"),
							Icon: Squares2X2Icon,
						},
					].map(({ idx, label, Icon }) => {
						const active = activeTab === idx;
						return (
							<button
								key={idx}
								type="button"
								onClick={() => handleTabChange(idx)}
								className={`inline-flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors ${
									active
										? "bg-surface-3 text-ink shadow-sm"
										: "text-ink-subtle hover:text-ink"
								}`}
							>
								<Icon className={`h-4 w-4 ${active ? "text-accent" : ""}`} />
								<span>{label}</span>
							</button>
						);
					})}
				</div>
			</div>

			{activeTab === 0 ? <InboundsManager /> : <HostsManager />}
		</div>
	);
};

export default HostsPage;
