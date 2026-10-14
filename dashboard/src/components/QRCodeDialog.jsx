import { Box, chakra, HStack, Modal, ModalBody, ModalCloseButton, ModalContent, ModalHeader, ModalOverlay, Text, useBreakpointValue, VStack, } from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import { QrCodeIcon } from "@heroicons/react/24/outline";
import { QRCodeCanvas } from "qrcode.react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { copyTextToClipboard } from "utils/clipboard";
import { useDashboard } from "../contexts/DashboardContext";
import { Icon } from "./Icon";
const QRCode = chakra(QRCodeCanvas);
const QRIcon = chakra(QrCodeIcon, {
    baseStyle: {
        w: 5,
        h: 5,
    },
});
const clickPulse = keyframes `
	0% { transform: scale(1); }
	40% { transform: scale(0.94); }
	70% { transform: scale(1.04); }
	100% { transform: scale(1); }
`;
export const QRCodeDialog = () => {
    const QRcodeLinks = useDashboard((state) => state.QRcodeLinks);
    const qrCodeUsername = useDashboard((state) => state.qrCodeUsername);
    const setQRCode = useDashboard((state) => state.setQRCode);
    const setSubLink = useDashboard((state) => state.setSubLink);
    const subscribeUrl = useDashboard((state) => state.subscribeUrl);
    const isOpen = QRcodeLinks !== null;
    const [copied, setCopied] = useState(false);
    const [animSeed, setAnimSeed] = useState(0);
    const { t } = useTranslation();
    const qrSize = useBreakpointValue({ base: 220, sm: 240, md: 260 }) ?? 240;
    const onClose = () => {
        setQRCode(null);
        setSubLink(null);
    };
    const subscribeQrLink = useMemo(() => {
        if (subscribeUrl) {
            return String(subscribeUrl).startsWith("/")
                ? window.location.origin + subscribeUrl
                : String(subscribeUrl);
        }
        if (QRcodeLinks && QRcodeLinks.length > 0) {
            return QRcodeLinks[0];
        }
        return "";
    }, [subscribeUrl, QRcodeLinks]);
    const copyLink = () => {
        if (!subscribeQrLink)
            return;
        void copyTextToClipboard(subscribeQrLink).then(() => {
            setCopied(true);
            setAnimSeed((prev) => prev + 1);
        });
    };
    useEffect(() => {
        if (!isOpen) {
            setCopied(false);
        }
    }, [isOpen]);
    useEffect(() => {
        if (!copied)
            return undefined;
        const timer = window.setTimeout(() => setCopied(false), 1200);
        return () => window.clearTimeout(timer);
    }, [copied]);
    return (<Modal isOpen={isOpen} onClose={onClose} isCentered>
			<ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)"/>
			<ModalContent mx={{ base: 3, md: 4 }} w="full" maxW={{ base: "90vw", sm: "360px", md: "380px" }} borderRadius="20px" overflow="hidden" bg="panel.surface" borderColor="panel.border" borderWidth="1px" boxShadow="0 20px 50px rgba(0, 0, 0, 0.6)">
				<ModalHeader pt={5} pb={2}>
					<HStack spacing={3} align="center">
						<Icon color="primary">
							<QRIcon color="white"/>
						</Icon>
						{qrCodeUsername && (<Box minW={0}>
								<Text fontSize="xs" color="gray.500">
									{t("username")}
								</Text>
								<Text dir="ltr" fontSize="md" fontWeight="semibold" noOfLines={1}>
									{qrCodeUsername}
								</Text>
							</Box>)}
					</HStack>
				</ModalHeader>
				<ModalCloseButton mt={2}/>
				{Boolean(subscribeQrLink) && (<ModalBody px={{ base: 4, sm: 6 }} pb={6} pt={2} display="flex" flexDirection="column" alignItems="center" justifyContent="center">
						<VStack spacing={2.5} align="center" w="full">
							<Text display="block" textAlign="center" fontWeight="semibold" fontSize="md">
								{t("qrcodeDialog.sublink")}
							</Text>
							{copied && (<Box bg="green.500" color="white" fontSize="xs" fontWeight="bold" px={3} py={0.5} borderRadius="full" boxShadow="0 0 10px rgba(16, 185, 129, 0.5)">
									{t("copied")}
								</Box>)}
							<Box key={`sub-qr-${animSeed}`} cursor="pointer" role="button" tabIndex={0} aria-label={t("copy")} animation={copied && animSeed > 0
                ? `${clickPulse} 260ms ease-in-out`
                : "none"} onClick={copyLink} onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    copyLink();
                }
            }} p={3} bg="white" borderRadius="16px" boxShadow="0 4px 20px rgba(0, 0, 0, 0.3)" transition="transform 0.2s ease" _hover={{ transform: "scale(1.02)" }} _active={{ transform: "scale(0.98)" }}>
								<QRCode mx="auto" maxW="100%" size={qrSize} level="L" includeMargin={false} value={subscribeQrLink} bg="white"/>
							</Box>
							<Text fontSize="xs" color="gray.500" textAlign="center">
								{t("qrcodeDialog.clickToCopy")}
							</Text>
						</VStack>
					</ModalBody>)}
			</ModalContent>
		</Modal>);
};
