import { ChakraProvider, localStorageManager } from "@chakra-ui/react";
import { theme } from "../../../chakra.config";

export const LegacyChakraWrapper = ({ children }) => (
	<ChakraProvider theme={theme} colorModeManager={localStorageManager}>
		{children}
	</ChakraProvider>
);

export default LegacyChakraWrapper;
