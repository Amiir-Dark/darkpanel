import React, { useRef } from "react";
import { Input, HStack, Badge, Text, Box, Tooltip, useColorModeValue, } from "@chakra-ui/react";
export const VariableTemplateInput = ({ value, onChange, variables = [
    { key: "{username}", label: "username", description: "Subscriber Username" },
    { key: "{id}", label: "id", description: "Subscriber User ID" },
], helperText, placeholder, size = "sm", ...rest }) => {
    const inputRef = useRef(null);
    const badgeBg = useColorModeValue("purple.50", "purple.900");
    const badgeBorder = useColorModeValue("purple.200", "purple.700");
    const badgeColor = useColorModeValue("purple.700", "purple.200");
    const handleInsert = (variableKey) => {
        const el = inputRef.current;
        const currentVal = value || "";
        if (!el) {
            onChange(currentVal + variableKey);
            return;
        }
        const start = el.selectionStart ?? currentVal.length;
        const end = el.selectionEnd ?? currentVal.length;
        const nextVal = currentVal.slice(0, start) + variableKey + currentVal.slice(end);
        onChange(nextVal);
        requestAnimationFrame(() => {
            el.focus();
            const nextCursor = start + variableKey.length;
            el.setSelectionRange(nextCursor, nextCursor);
        });
    };
    return (<Box w="full">
			<Input ref={inputRef} size={size} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} {...rest}/>

			{variables && variables.length > 0 && (<HStack spacing={1.5} mt={1.5} mb={helperText ? 1 : 0} flexWrap="wrap" align="center">
					<Text fontSize="10px" fontWeight="semibold" color="gray.500" userSelect="none">
						Variables:
					</Text>
					{variables.map((item) => {
                const key = typeof item === "string" ? item : item.key;
                const desc = typeof item === "string" ? "" : item.description || "";
                return (<Tooltip key={key} label={desc ? `${desc} (${key})` : `Insert ${key}`} placement="top" hasArrow fontSize="11px">
								<Badge as="button" type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => handleInsert(key)} cursor="pointer" px={2} py={0.5} borderRadius="md" fontSize="11px" fontWeight="semibold" textTransform="none" bg={badgeBg} color={badgeColor} border="1px solid" borderColor={badgeBorder} _hover={{
                        bg: "purple.500",
                        color: "white",
                        borderColor: "purple.500",
                        transform: "translateY(-1px)",
                        shadow: "sm",
                    }} _active={{
                        transform: "scale(0.96)",
                    }} transition="all 0.15s ease-in-out">
									+ {key}
								</Badge>
							</Tooltip>);
            })}
				</HStack>)}

			{helperText && (<Box mt={0.5} fontSize="11px" color="gray.500">
					{helperText}
				</Box>)}
		</Box>);
};
export default VariableTemplateInput;
