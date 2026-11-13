import { Text, VStack, } from "@chakra-ui/react";
import AdminDetailsDrawer from "components/AdminDetailsDrawer";
import { AdminDialog } from "components/AdminDialog";
import { AdminsTable } from "components/AdminsTable";
import { Filters, ReloadIcon } from "components/Filters";
import { Pagination } from "components/Pagination";
import { ArrowPathIcon, PlusIcon } from "@heroicons/react/24/outline";
import { Button as LinearButton } from "components/linear/UI";
import { PageHeader } from "components/ui";
import { useAdminsStore } from "contexts/AdminsContext";
import useGetUser from "hooks/useGetUser";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
export const AdminsPage = () => {
    const { t } = useTranslation();
    const fetchAdmins = useAdminsStore((s) => s.fetchAdmins);
    const adminsLoading = useAdminsStore((s) => s.loading);
    const openAdminDialog = useAdminsStore((s) => s.openAdminDialog);
    const { userData, getUserIsSuccess } = useGetUser();
    const canViewAdmins = getUserIsSuccess && Boolean(userData.permissions?.sections.admins);
    useEffect(() => {
        if (canViewAdmins) {
            fetchAdmins(undefined, { force: true });
        }
    }, [fetchAdmins, canViewAdmins]);
    useEffect(() => {
        if (!canViewAdmins)
            return;
        const shouldOpenCreate = sessionStorage.getItem("openCreateAdmin");
        if (shouldOpenCreate === "true") {
            sessionStorage.removeItem("openCreateAdmin");
            openAdminDialog();
        }
    }, [canViewAdmins, openAdminDialog]);
    if (!canViewAdmins) {
        return (<VStack spacing={4} align="stretch">
				<PageHeader title={t("admins")} description={t("admins.pageDescription")}/>
				<Text color="panel.textMuted">
					{t("admins.noPermission")}
				</Text>
			</VStack>);
    }
    return (<VStack className="mx-auto max-w-[1440px]" px={{ base: 4, md: 6 }} py={{ base: 5, md: 6 }} spacing={5} align="stretch">
			<div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline pb-4">
				<div>
					<h1 className="text-lg font-semibold text-ink">{t("admins")}</h1>
					<p className="text-xs text-ink-subtle mt-0.5">{t("admins.pageDescription")}</p>
				</div>
				<div className="flex items-center gap-2">
					<LinearButton size="sm" variant="secondary" icon={ArrowPathIcon} loading={adminsLoading} onClick={() => fetchAdmins(undefined, { force: true })}>
						{t("refresh")}
					</LinearButton>
					<LinearButton size="sm" variant="primary" icon={PlusIcon} onClick={() => openAdminDialog()}>
						{t("admins.addAdmin")}
					</LinearButton>
				</div>
			</div>
			<AdminsTable toolbar={<Filters for="admins" py={0} showRefresh={false} showCreate={false}/>}/>
			<Pagination for="admins"/>
			<AdminDialog />
			<AdminDetailsDrawer />
		</VStack>);
};
export default AdminsPage;
