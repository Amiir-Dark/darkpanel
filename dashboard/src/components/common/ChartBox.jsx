import { Box, Flex, Text, useColorModeValue, } from "@chakra-ui/react";
export const ChartBox = ({ title, children, headerActions, ...props }) => {
    const borderColor = useColorModeValue("panel.border", "panel.border");
    const bg = useColorModeValue("panel.surface", "panel.surface");
    const headerBg = useColorModeValue("transparent", "transparent");
    return (<Box borderWidth="1px" borderColor={borderColor} borderRadius="xl" bg={bg} overflow="hidden" transition="box-shadow 0.2s ease, border-color 0.2s ease" sx={{
            "@media (prefers-reduced-motion: reduce)": {
                transition: "none",
            },
        }} _hover={{
            "@media (min-width: 768px)": {
                boxShadow: "sm",
                borderColor: "panel.borderStrong",
            },
        }} {...props}>
			{(title || headerActions) && (<Flex px={{ base: 4, md: 5 }} py={4} borderBottomWidth="1px" borderBottomColor={borderColor} bg={headerBg} justifyContent="space-between" alignItems={{ base: "stretch", md: "center" }} gap={3} flexWrap="wrap">
					{title && (<Text fontWeight="bold" fontSize={{ base: "md", md: "lg" }} color="panel.text" flex="1" minW={{ base: "full", md: "220px" }}>
							{title}
						</Text>)}
					{headerActions && <Box maxW="full">{headerActions}</Box>}
				</Flex>)}
			<Box p={{ base: 4, md: 5 }}>{children}</Box>
		</Box>);
};
