import { chakra } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
/**
 * "by <admin>" tag for rows owned by another admin/reseller. Deliberately
 * muted and uniform (styled via .rb-user-admin-chip with the panel theme
 * tokens) so it reads as quiet metadata rather than a colored label.
 */
export const UserAdminChip = ({ adminUsername, show = true, }) => {
    const { t } = useTranslation();
    if (!show || !adminUsername)
        return null;
    return (<chakra.span className="rb-user-admin-chip" dir="ltr" sx={{ unicodeBidi: "isolate" }}>
			{t("usersTable.by")}{" "}
			<chakra.span fontWeight="semibold">{adminUsername}</chakra.span>
		</chakra.span>);
};
