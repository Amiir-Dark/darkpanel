import { Box, Button, Flex, Text, } from "@chakra-ui/react";
import { useEffect, useRef, } from "react";
export { BulkActionBar } from "./BulkActionBar";
export { DataTable } from "./DataTable";
export { PageLoadingSkeleton } from "./PageLoadingSkeleton";
export { ResourceListCard, ResourceRefreshButton, } from "./ResourceListCard";
export { RowActionsMenu } from "./DataTableRowActions";
export const PageHeader = ({ children, title, description, actions, ...props }) => {
    if (!title && !description && !actions) {
        return (<Box w="full" color="panel.text" {...props}>
				{children}
			</Box>);
    }
    return (<Box w="full" color="panel.text" {...props}>
			<Flex align={{ base: "flex-start", md: "center" }} justify="space-between" gap={3} flexWrap="wrap">
				<Box minW={0}>
					{title && (<Text as="h1" fontSize="2xl" fontWeight="semibold">
							{title}
						</Text>)}
					{description && (<Text fontSize="sm" color="panel.textSecondary" mt={title ? 1 : 0}>
							{description}
						</Text>)}
					{children}
				</Box>
				{actions && <Box flexShrink={0}>{actions}</Box>}
			</Flex>
		</Box>);
};
export const TabSystem = ({ tabs, ...props }) => {
    const activeTabRef = useRef(null);
    const activeValue = tabs.find((tab) => tab.isActive)?.value;
    useEffect(() => {
        if (!activeValue)
            return;
        activeTabRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
    }, [activeValue]);
    return (<Box className="rb-tab-system" display="flex" gap={6} minH="10" px={{ base: 2, md: 3 }} overflowX="auto" overflowY="hidden" maxW="full" whiteSpace="nowrap" role="tablist" sx={{
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: "none",
            "&::-webkit-scrollbar": { display: "none" },
            "& > button": { flex: "0 0 auto" },
        }} {...props}>
			{tabs.map((tab) => (<Button key={tab.value} ref={tab.isActive ? activeTabRef : undefined} role="tab" aria-selected={tab.isActive} variant="ghost" size="sm" px={0} h="10" borderRadius="0" borderBottomWidth="2px" borderColor={tab.isActive ? "panel.accent" : "transparent"} color={tab.isActive ? "panel.accent" : "panel.text"} fontWeight="700" _hover={{ bg: "transparent", color: "panel.accentHover" }} onClick={tab.onClick}>
					{tab.label}
				</Button>))}
		</Box>);
};
export const PageTabs = TabSystem;
