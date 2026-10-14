import { IconButton, Spinner, Tooltip } from "@chakra-ui/react";
import { BoltIcon } from "@heroicons/react/24/outline";
export const OutboundTestButton = ({ isTesting = false, label, onTest, tag, }) => {
    if (!onTest || !tag || tag.trim().toLowerCase() === "blocked")
        return null;
    return (<Tooltip hasArrow label={label}>
			<IconButton aria-label={label} icon={isTesting ? <Spinner size="xs"/> : <BoltIcon />} size="xs" variant="ghost" isDisabled={isTesting} onClick={() => onTest(tag)}/>
		</Tooltip>);
};
