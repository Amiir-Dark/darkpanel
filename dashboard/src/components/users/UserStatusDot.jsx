import { Box, HStack, Text } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
export const UserOnlineBadge = ({ isOnline }) => {
    const { t } = useTranslation();
    return (<HStack as="span" className="rb-user-online-tag" data-online={isOnline ? "true" : "false"} spacing={1}>
			<Box as="span" className="rb-user-status-dot" aria-hidden="true"/>
			<Text as="span">
				{t(isOnline ? "usersTable.online" : "usersTable.offline")}
			</Text>
		</HStack>);
};
